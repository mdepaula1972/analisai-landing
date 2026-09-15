import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { ASAAS_WEBHOOK_AUTH_TOKEN, ASAAS_PLANS, ASAAS_ONE_OFF } from '@/lib/solo/constants';
import { addDays, format } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AsaasPaymentPayload {
  event: string;
  payment?: {
    id: string;
    customer?: string;
    dateCreated?: string;
    value?: number;
    netValue?: number;
    billingType?: string;
    status?: string;
    description?: string;
    externalReference?: string;
    paymentLink?: string;
    invoiceUrl?: string;
    dueDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    // Campos estendidos quando preenchidos pelo pagador
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerCpfCnpj?: string;
    creditCard?: {
      creditCardNumber?: string;
      creditCardBrand?: string;
    };
  };
}

// Mapeador de links e valores para identificação infalível do produto
function identifyProduct(payment: NonNullable<AsaasPaymentPayload['payment']>) {
  const link = (payment.paymentLink || '').toLowerCase();
  const desc = (payment.description || '').toLowerCase();
  const value = Math.round((payment.value || 0) * 100); // centavos

  // 1. Por slug do link de pagamento
  if (link.includes(ASAAS_PLANS.monthly.start.slug) || link.includes('u6coqlztwsm1h4l8')) {
    return { type: 'subscription', planCode: 'start', billingPeriod: 'monthly', planName: 'AnalisAí Start' };
  }
  if (link.includes(ASAAS_PLANS.monthly.solo.slug) || link.includes('5swlpaq9pb9gr6vj')) {
    return { type: 'subscription', planCode: 'solo', billingPeriod: 'monthly', planName: 'AnalisAí Solo' };
  }
  if (link.includes(ASAAS_PLANS.monthly.solo_plus.slug) || link.includes('4q4ibc9k87yl03l3')) {
    return { type: 'subscription', planCode: 'solo_plus', billingPeriod: 'monthly', planName: 'AnalisAí Solo Plus' };
  }
  if (link.includes(ASAAS_PLANS.annual.start.slug) || link.includes('rx7u0rghulotvxqy')) {
    return { type: 'subscription', planCode: 'start', billingPeriod: 'annual', planName: 'AnalisAí Start (Anual)' };
  }
  if (link.includes(ASAAS_PLANS.annual.solo.slug) || link.includes('eng7q7ppj002flzb')) {
    return { type: 'subscription', planCode: 'solo', billingPeriod: 'annual', planName: 'AnalisAí Solo (Anual)' };
  }
  if (link.includes(ASAAS_PLANS.annual.solo_plus.slug) || link.includes('hmm2qnvy6kur1v6l')) {
    return { type: 'subscription', planCode: 'solo_plus', billingPeriod: 'annual', planName: 'AnalisAí Solo Plus (Anual)' };
  }
  if (link.includes(ASAAS_PLANS.monthly.pro.slug)) {
    return { type: 'subscription', planCode: 'pro', billingPeriod: 'monthly', planName: 'AnalisAí Pro' };
  }
  if (link.includes(ASAAS_PLANS.annual.pro.slug)) {
    return { type: 'subscription', planCode: 'pro', billingPeriod: 'annual', planName: 'AnalisAí Pro (Anual)' };
  }
  if (link.includes(ASAAS_PLANS.monthly.super.slug)) {
    return { type: 'subscription', planCode: 'super', billingPeriod: 'monthly', planName: 'AnalisAí Super' };
  }
  if (link.includes(ASAAS_PLANS.annual.super.slug)) {
    return { type: 'subscription', planCode: 'super', billingPeriod: 'annual', planName: 'AnalisAí Super (Anual)' };
  }
  if (link.includes(ASAAS_ONE_OFF.dreConsolidatedMultiCnpj.slug) || desc.includes('dre agrupado')) {
    return { type: 'one_off', orderType: 'dre_consolidated_multi_cnpj', name: 'DRE Agrupado Multi-CNPJ' };
  }
  if (link.includes(ASAAS_ONE_OFF.bankReconciliationExtra.slug) || desc.includes('conciliação extra') || desc.includes('conciliacao extra')) {
    return { type: 'one_off', orderType: 'bank_reconciliation_extra', name: 'Conciliação Bancária Extra' };
  }
  if (link.includes('85t737y1uom4k2b5')) {
    return { type: 'one_off', orderType: 'cash_flow_extra', name: 'Análise de Fluxo de Caixa' };
  }
  if (link.includes('opzifr0h6d2pds70')) {
    return { type: 'one_off', orderType: 'supplier_xray', name: 'Raio-X de Fornecedores' };
  }
  if (link.includes('mlxgbfsqmh4blf4j')) {
    return { type: 'one_off', orderType: 'certificado_digital_a1', name: 'Certificado Digital A1' };
  }
  if (link.includes('82tfkx0s9pu1vdd9') || desc.includes('pacote') || desc.includes('extra')) {
    return { type: 'one_off', orderType: 'extra_docs_package', name: 'Pacote Extra (+20 Documentos)' };
  }

  // 2. Por Valor aproximado (fallback)
  if (value === 3990) {
    return { type: 'subscription', planCode: 'start', billingPeriod: 'monthly', planName: 'AnalisAí Start' };
  }
  if (value === 8799) {
    return { type: 'subscription', planCode: 'solo', billingPeriod: 'monthly', planName: 'AnalisAí Solo' };
  }
  if (value === 15799) {
    return { type: 'subscription', planCode: 'solo_plus', billingPeriod: 'monthly', planName: 'AnalisAí Solo Plus' };
  }
  if (value === 29700) {
    return { type: 'subscription', planCode: 'pro', billingPeriod: 'monthly', planName: 'AnalisAí Pro' };
  }
  if (value === 59700) {
    return { type: 'subscription', planCode: 'super', billingPeriod: 'monthly', planName: 'AnalisAí Super' };
  }
  if (value === 38304) {
    return { type: 'subscription', planCode: 'start', billingPeriod: 'annual', planName: 'AnalisAí Start (Anual)' };
  }
  if (value === 84470) {
    return { type: 'subscription', planCode: 'solo', billingPeriod: 'annual', planName: 'AnalisAí Solo (Anual)' };
  }
  if (value === 151670) {
    return { type: 'subscription', planCode: 'solo_plus', billingPeriod: 'annual', planName: 'AnalisAí Solo Plus (Anual)' };
  }
  if (value === 285120) {
    return { type: 'subscription', planCode: 'pro', billingPeriod: 'annual', planName: 'AnalisAí Pro (Anual)' };
  }
  if (value === 573120) {
    return { type: 'subscription', planCode: 'super', billingPeriod: 'annual', planName: 'AnalisAí Super (Anual)' };
  }
  if (value === 1490) {
    return { type: 'one_off', orderType: 'cash_flow_extra', name: 'Análise de Fluxo de Caixa' };
  }
  if (value === 2799) {
    return { type: 'one_off', orderType: 'dre_consolidated_multi_cnpj', name: 'DRE Agrupado Multi-CNPJ' };
  }
  if (value === 3700) {
    return { type: 'one_off', orderType: 'bank_reconciliation_extra', name: 'Conciliação Bancária Extra' };
  }
  if (value === 5990) {
    return { type: 'one_off', orderType: 'supplier_xray', name: 'Raio-X de Fornecedores' };
  }
  if (value === 17000) {
    return { type: 'one_off', orderType: 'certificado_digital_a1', name: 'Certificado Digital A1' };
  }

  // 3. Por descrição
  if (desc.includes('super')) {
    return { type: 'subscription', planCode: 'super', billingPeriod: 'monthly', planName: 'AnalisAí Super' };
  }
  if (desc.includes('pro')) {
    return { type: 'subscription', planCode: 'pro', billingPeriod: 'monthly', planName: 'AnalisAí Pro' };
  }
  if (desc.includes('plus')) {
    return { type: 'subscription', planCode: 'solo_plus', billingPeriod: 'monthly', planName: 'AnalisAí Solo Plus' };
  }
  if (desc.includes('start')) {
    return { type: 'subscription', planCode: 'start', billingPeriod: 'monthly', planName: 'AnalisAí Start' };
  }
  if (desc.includes('solo')) {
    return { type: 'subscription', planCode: 'solo', billingPeriod: 'monthly', planName: 'AnalisAí Solo' };
  }
  if (desc.includes('raio-x') || desc.includes('fornecedor')) {
    return { type: 'one_off', orderType: 'supplier_xray', name: 'Raio-X de Fornecedores' };
  }
  if (desc.includes('caixa') || desc.includes('fluxo')) {
    return { type: 'one_off', orderType: 'cash_flow_extra', name: 'Análise de Fluxo de Caixa' };
  }

  // Default se nada bater
  return { type: 'subscription', planCode: 'solo', billingPeriod: 'monthly', planName: 'AnalisAí Solo' };
}

export async function POST(req: NextRequest) {
  const supabase = createServiceRoleClient();
  let rawBodyText = '';

  try {
    // 1. Validação do Token de Acesso do Asaas
    const tokenHeader =
      req.headers.get('asaas-access-token') ||
      req.headers.get('x-asaas-access-token') ||
      req.nextUrl.searchParams.get('token');

    if (tokenHeader && tokenHeader !== ASAAS_WEBHOOK_AUTH_TOKEN) {
      console.warn('[Asaas Webhook] Token inválido recebido:', tokenHeader);
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    rawBodyText = await req.text();
    const payload = JSON.parse(rawBodyText) as AsaasPaymentPayload;
    const { event, payment } = payload;

    console.log(`[Asaas Webhook] Evento recebido: ${event}, paymentId: ${payment?.id}`);

    // Registra o log no Supabase para auditoria total
    await supabase.from('asaas_webhook_logs').insert({
      event: event || 'UNKNOWN',
      payment_id: payment?.id || null,
      payload: payload,
      processed: false,
    });

    // Processa apenas pagamentos confirmados ou recebidos
    const validEvents = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];
    if (!validEvents.includes(event) || !payment) {
      console.log(`[Asaas Webhook] Evento ${event} ignorado.`);
      return NextResponse.json({ received: true, status: 'ignored_event' }, { status: 200 });
    }

    // 2. Identificação do Cliente
    let clientId: string | null = null;
    let clientPhone: string | null = null;
    let clientName: string | null = null;

    // A. Busca por externalReference (pode ser UUID do cliente ou número de telefone)
    if (payment.externalReference) {
      const extRef = payment.externalReference.trim();
      // Verifica se é UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(extRef)) {
        const { data: c } = await supabase.from('clients').select('id, whatsapp_number, name').eq('id', extRef).single();
        if (c) {
          clientId = c.id;
          clientPhone = c.whatsapp_number;
          clientName = c.name;
        }
      } else {
        // Pode ser telefone limpo
        const cleanRefPhone = extRef.replace(/\D/g, '');
        const { data: c } = await supabase
          .from('clients')
          .select('id, whatsapp_number, name')
          .or(`whatsapp_number.eq.${cleanRefPhone},whatsapp_number.eq.55${cleanRefPhone}`)
          .single();
        if (c) {
          clientId = c.id;
          clientPhone = c.whatsapp_number;
          clientName = c.name;
        }
      }
    }

    // B. Busca por asaas_customer_id
    if (!clientId && payment.customer) {
      const { data: c } = await supabase
        .from('clients')
        .select('id, whatsapp_number, name')
        .eq('asaas_customer_id', payment.customer)
        .single();
      if (c) {
        clientId = c.id;
        clientPhone = c.whatsapp_number;
        clientName = c.name;
      }
    }

    // C. Busca por Telefone do Pagador
    if (!clientId && payment.customerPhone) {
      const cleanPhone = payment.customerPhone.replace(/\D/g, '');
      const { data: c } = await supabase
        .from('clients')
        .select('id, whatsapp_number, name')
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.55${cleanPhone}`)
        .single();
      if (c) {
        clientId = c.id;
        clientPhone = c.whatsapp_number;
        clientName = c.name;
      }
    }

    // D. Busca por CPF/CNPJ
    if (!clientId && payment.customerCpfCnpj) {
      const cleanDoc = payment.customerCpfCnpj.replace(/\D/g, '');
      const { data: c } = await supabase
        .from('clients')
        .select('id, whatsapp_number, name')
        .eq('tax_id', cleanDoc)
        .single();
      if (c) {
        clientId = c.id;
        clientPhone = c.whatsapp_number;
        clientName = c.name;
      }
    }

    // E. Se ainda não encontrado, busca o cliente mais recente ou cria um novo cliente
    if (!clientId) {
      if (payment.customerPhone || payment.customerCpfCnpj) {
        const doc = payment.customerCpfCnpj ? payment.customerCpfCnpj.replace(/\D/g, '') : '00000000000';
        const phone = payment.customerPhone ? payment.customerPhone.replace(/\D/g, '') : '';
        const name = payment.customerName || 'Cliente Asaas';
        const email = payment.customerEmail ? payment.customerEmail.trim().toLowerCase() : null;

        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            name,
            tax_id: doc,
            tax_type: doc.length > 11 ? 'CNPJ' : 'CPF',
            whatsapp_number: phone.startsWith('55') ? phone : `55${phone}`,
            asaas_customer_id: payment.customer || null,
            email: email,
            status: 'active',
          })
          .select('id, whatsapp_number, name')
          .single();

        if (newClient) {
          clientId = newClient.id;
          clientPhone = newClient.whatsapp_number;
          clientName = newClient.name;
        }
      } else {
        // Fallback: pega o cliente administrador/marcos para atribuir o teste se nenhum dado foi enviado
        const { data: adminClient } = await supabase
          .from('clients')
          .select('id, whatsapp_number, name')
          .eq('is_admin', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (adminClient) {
          clientId = adminClient.id;
          clientPhone = adminClient.whatsapp_number;
          clientName = adminClient.name;
        }
      }
    }

    // Se o cliente já existia e recebemos o e-mail pelo Asaas, atualiza se estiver vazio
    if (clientId && payment.customerEmail) {
      await supabase
        .from('clients')
        .update({ email: payment.customerEmail.trim().toLowerCase() })
        .eq('id', clientId)
        .is('email', null);
    }

    if (!clientId) {
      console.warn('[Asaas Webhook] Cliente não identificado após todas as tentativas.');
      return NextResponse.json({ received: true, status: 'client_not_found' }, { status: 200 });
    }

    // Atualiza o asaas_customer_id no cliente caso ainda não esteja salvo
    if (payment.customer) {
      await supabase
        .from('clients')
        .update({ asaas_customer_id: payment.customer })
        .eq('id', clientId);
    }

    // 3. Identifica o Produto Pago
    const product = identifyProduct(payment);
    const amountCents = Math.round((payment.value || 0) * 100);

    // ── Fluxo 1: Produtos Avulsos (One-Off) ──────────────────────────────────
    if (product.type === 'one_off') {
      await supabase.from('one_off_orders').insert({
        client_id: clientId,
        order_type: product.orderType,
        amount_cents: amountCents,
        asaas_payment_id: payment.id,
        payment_status: 'paid',
        delivery_status: product.orderType === 'supplier_xray' ? 'processing' : 'delivered',
        paid_at: new Date().toISOString(),
      });

      if (product.orderType === 'cash_flow_extra') {
        if (clientPhone) {
          await sendEvolutionText({
            phone: clientPhone,
            text: `🎉 *Pagamento Confirmado no Asaas! (Análise de Caixa Avulsa)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sua consulta estratégica de fluxo de caixa foi liberada com sucesso!

Você já pode me enviar um áudio ou perguntar:
👉 *"Qual conta devo adiar este mês diante do aperto financeiro?"*`,
          });
        }
      } else if (product.orderType === 'supplier_xray') {
        if (clientPhone) {
          await sendEvolutionText({
            phone: clientPhone,
            text: `🎉 *Pagamento Confirmado no Asaas! (Raio-X de Fornecedores)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recebemos a confirmação da sua solicitação. O seu relatório detalhado de inteligência de compras está sendo processado e chegará aqui em instantes!`,
          });
        }

        const { executeAndSendSupplierXRay } = await import('@/lib/solo/supplier-xray');
        executeAndSendSupplierXRay(clientId).catch((err) => {
          console.error('[Asaas Webhook] Erro ao gerar Raio-X de Fornecedores:', err);
        });
      } else if (product.orderType === 'certificado_digital_a1') {
        if (clientPhone) {
          await sendEvolutionText({
            phone: clientPhone,
            text: `🎉 *Pagamento Confirmado! (Certificado Digital A1)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recebemos a confirmação do seu Certificado Digital A1.
Nossa equipe de validação entrará em contato para agendar sua videoconferência de emissão expressa!`,
          });
        }
      } else if (product.orderType === 'extra_docs_package') {
        const validityDays = 60;
        const expiresAt = addDays(new Date(), validityDays).toISOString();
        const docsAmount = 20;

        await supabase.from('extra_document_credits').insert({
          client_id: clientId,
          amount_docs: docsAmount,
          used_docs: 0,
          asaas_payment_id: payment.id,
          expires_at: expiresAt,
        });

        if (clientPhone) {
          const expFormatted = format(addDays(new Date(), validityDays), 'dd/MM/yyyy');
          await sendEvolutionText({
            phone: clientPhone,
            text: `🎉 *Pacote Extra de Documentos Confirmado!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Adicionamos *+${docsAmount} documentos extras* à sua carteira de reserva!

📅 *Validade:* 60 dias (até ${expFormatted})
💡 *Como funciona:* Seus documentos extras ficam guardados com segurança e só serão consumidos caso você ultrapasse a cota do seu plano mensal. Eles são independentes da sua mensalidade!`,
          });
        }
      }

      // Atualiza log como processado
      await supabase
        .from('asaas_webhook_logs')
        .update({ processed: true })
        .eq('payment_id', payment.id);

      return NextResponse.json({ success: true, processed: product.orderType });
    }

    // ── Fluxo 2: Assinaturas de Planos (Start, Solo, Solo Plus) ─────────────
    const planCode = product.planCode || 'solo';
    const billingPeriod = product.billingPeriod || 'monthly';
    const periodDays = billingPeriod === 'annual' ? 365 : 30;
    const periodEnd = addDays(new Date(), periodDays).toISOString();

    const { data: plan } = await supabase
      .from('plans')
      .select('id, name')
      .eq('code', planCode)
      .single();

    if (plan) {
      await supabase.from('subscriptions').upsert(
        {
          client_id: clientId,
          plan_id: plan.id,
          billing_period: billingPeriod,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          asaas_payment_id: payment.id,
          asaas_customer_id: payment.customer || null,
          auto_renew: billingPeriod === 'monthly',
        },
        { onConflict: 'client_id' }
      );

      // Garante que o ciclo de consumo seja renovado
      const { data: activeSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('client_id', clientId)
        .single();

      if (activeSub) {
        await supabase.from('usage_cycles').upsert(
          {
            client_id: clientId,
            subscription_id: activeSub.id,
            cycle_start: new Date().toISOString(),
            cycle_end: periodEnd,
            docs_processed_count: 0,
            bot_interactions_count: 0,
            cash_flow_analyses_count: 0,
            hit_doc_limit: false,
            hit_bot_limit: false,
            hit_analysis_limit: false,
            upsell_status: 'none',
          },
          { onConflict: 'subscription_id' }
        );
      }

      // Transiciona o lead em degustação para cliente pagante ativo
      if (clientPhone) {
        const cleanDigits = clientPhone.replace(/\D/g, '');
        const phoneNoCountry = cleanDigits.replace(/^55/, '');
        await supabase
          .from('trial_leads')
          .update({ converted_to_client: true })
          .or(`whatsapp_number.eq.${cleanDigits},whatsapp_number.eq.${phoneNoCountry}`);
      }

      if (clientPhone) {
        const firstName = (clientName || 'Cliente').split(' ')[0];
        await sendEvolutionText({
          phone: clientPhone,
          text: `🎉 *Assinatura ${billingPeriod === 'annual' ? 'Anual' : 'Mensal'} Confirmada no Asaas!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parabéns, ${firstName}! O seu plano *${plan.name}* está 100% ativo.

🚀 *O que você pode fazer agora:*
1. Enviar fotos ou PDFs de notas fiscais, cupons e boletos para registro imediato no seu Livro Caixa.
2. Tirar dúvidas sobre contas a pagar e receber direto no WhatsApp.
3. Consultar o saldo e o resumo financeiro com o comando *!status*.`,
        });
      }
    }

    // Atualiza log como processado
    await supabase
      .from('asaas_webhook_logs')
      .update({ processed: true })
      .eq('payment_id', payment.id);

    return NextResponse.json({ success: true, processed: 'subscription', plan: planCode });
  } catch (err: unknown) {
    console.error('[Asaas Webhook Error]:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
