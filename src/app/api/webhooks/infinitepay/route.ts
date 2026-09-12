import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { addDays } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InfinitePayWebhookPayload {
  event: string;
  data: {
    id: string;
    status: 'approved' | 'paid' | 'refused' | 'canceled';
    amount: number;
    customer?: {
      email?: string;
      phone_number?: string;
      document?: string;
      name?: string;
    };
    metadata?: {
      client_id?: string;
      order_type?: string;
      order_id?: string;
      plan_code?: string;
      billing_period?: string;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as InfinitePayWebhookPayload;
    const { status, id: transactionId, customer, metadata } = payload.data || {};

    if (status !== 'approved' && status !== 'paid') {
      return NextResponse.json({ received: true, status: 'ignored_unpaid' }, { status: 200 });
    }

    const supabase = createServiceRoleClient();

    // 1. Identifica o cliente por ID de metadata ou pelo telefone/CPF
    let clientId = metadata?.client_id;

    if (!clientId && customer?.phone_number) {
      const cleanPhone = customer.phone_number.replace(/\D/g, '');
      const { data: client } = await supabase
        .from('clients')
        .select('id, whatsapp_number, name')
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.55${cleanPhone}`)
        .single();
      clientId = client?.id;
    }

    if (!clientId && customer?.document) {
      const cleanDoc = customer.document.replace(/\D/g, '');
      const { data: client } = await supabase
        .from('clients')
        .select('id, whatsapp_number, name')
        .eq('tax_id', cleanDoc)
        .single();
      clientId = client?.id;
    }

    if (!clientId) {
      console.warn('[InfinitePay Webhook] Cliente não identificado no payload:', payload.data);
      return NextResponse.json({ received: true, status: 'client_not_found' }, { status: 200 });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, name, whatsapp_number')
      .eq('id', clientId)
      .single();

    if (!client) {
      return NextResponse.json({ received: true, status: 'client_record_missing' }, { status: 200 });
    }

    const orderType = metadata?.order_type;

    // ── Fluxo A: Pagamento de Análise Extra de Fluxo de Caixa (R$ 14,90) ───
    if (orderType === 'cash_flow_extra') {
      await supabase.from('one_off_orders').insert({
        client_id: client.id,
        order_type: 'cash_flow_extra',
        amount_cents: payload.data.amount || 1490,
        infinitepay_order_id: transactionId,
        payment_status: 'paid',
        delivery_status: 'delivered',
        paid_at: new Date().toISOString(),
      });

      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `🎉 *Pagamento Confirmado! (Análise de Caixa Avulsa)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sua consulta estratégica de fluxo de caixa foi liberada com sucesso!

Você já pode me enviar um áudio ou perguntar:
👉 *"Qual conta devo adiar este mês diante do aperto financeiro?"*`,
      });

      return NextResponse.json({ success: true, processed: 'cash_flow_extra' });
    }

    // ── Fluxo B: Pagamento de Raio-X de Fornecedores (R$ 59,90) ───────────
    if (orderType === 'supplier_xray') {
      await supabase.from('one_off_orders').insert({
        client_id: client.id,
        order_type: 'supplier_xray',
        amount_cents: payload.data.amount || 5990,
        infinitepay_order_id: transactionId,
        payment_status: 'paid',
        delivery_status: 'processing',
        paid_at: new Date().toISOString(),
      });

      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `🎉 *Pagamento Confirmado! (Raio-X de Fornecedores)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nossa IA já iniciou o mapeamento e pesquisa regional de fornecedores para o seu negócio.
O relatório completo com a marca AnalisAí será enviado em PDF aqui no WhatsApp em instantes!`,
      });

      return NextResponse.json({ success: true, processed: 'supplier_xray' });
    }

    // ── Fluxo C: Renovação ou Ativação de Assinatura Anual ou Mensal ──────
    const billingPeriod = metadata?.billing_period === 'annual' ? 'annual' : 'monthly';
    const planCode = metadata?.plan_code || 'solo';

    const { data: plan } = await supabase
      .from('plans')
      .select('id, name')
      .eq('code', planCode)
      .single();

    if (plan) {
      const periodDays = billingPeriod === 'annual' ? 365 : 30;
      const periodEnd = addDays(new Date(), periodDays).toISOString();

      await supabase.from('subscriptions').upsert(
        {
          client_id: client.id,
          plan_id: plan.id,
          billing_period: billingPeriod,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          infinitepay_last_payment_id: transactionId,
          auto_renew: billingPeriod === 'monthly',
        },
        { onConflict: 'client_id' }
      );

      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `🎉 *Assinatura ${billingPeriod === 'annual' ? 'Anual' : 'Mensal'} Confirmada!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parabéns, ${client.name.split(' ')[0]}! O seu plano *${plan.name}* está 100% ativo.
Você já pode enviar fotos ou PDFs de comprovantes e boletos para registrar automaticamente no seu Livro Caixa!`,
      });
    }

    return NextResponse.json({ success: true, processed: 'subscription' });
  } catch (err: unknown) {
    console.error('[InfinitePay Webhook Error]:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
