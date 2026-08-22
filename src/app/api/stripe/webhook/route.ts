import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Configuração de webhook inválida.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Assinatura inválida:', err);
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 });
  }

  // ── Processa eventos ──────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    console.log('[stripe/webhook] Pagamento confirmado:', {
      session_id: session.id,
      customer_email: session.customer_details?.email,
      amount: session.amount_total,
      metadata: session.metadata,
    });

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('diagnostico_pedidos').insert([
          {
            nome_pagador: session.customer_details?.name || 'Cliente Stripe',
            email: session.customer_details?.email || '',
            whatsapp: session.customer_details?.phone || '',
            metodo_pagamento: 'stripe_cartao',
            valor: (session.amount_total || 19700) / 100,
            status: 'confirmado',
            session_id: session.id,
            observacoes: 'Aprovado via Stripe Checkout',
          },
        ]);
      }
    } catch (dbErr) {
      console.error('[stripe/webhook] Erro ao gravar no Supabase:', dbErr);
    }
  }

  return NextResponse.json({ received: true });
}
