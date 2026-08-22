import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!priceId) {
      return NextResponse.json({ error: 'STRIPE_PRICE_ID não configurado.' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/diagnostico/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/diagnostico?cancelado=1`,
      locale: 'pt-BR',
      payment_method_types: ['card'],
      custom_text: {
        submit: {
          message: 'Após o pagamento você receberá o formulário por e-mail ou WhatsApp. Entrega em até 72h.',
        },
      },
      metadata: {
        produto: 'diagnostico-financeiro',
        versao: 'v1.0',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/checkout] Erro ao criar sessão:', error);
    return NextResponse.json({ error: 'Erro ao criar sessão de pagamento.' }, { status: 500 });
  }
}
