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

    // TODO: adicionar aqui lógica extra quando necessário:
    // - Gravar pedido no Supabase
    // - Enviar e-mail/WhatsApp com link do formulário
  }

  return NextResponse.json({ received: true });
}
