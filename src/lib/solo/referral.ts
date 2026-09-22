import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { OFFICIAL_BOT_WHATSAPP, OFFICIAL_BOT_PHONE_DISPLAY } from '@/lib/solo/constants';

/**
 * Tabela Oficial de Comissões Recorrentes por Plano (~20% da mensalidade)
 * Remuneração mensal no Pix enquanto o cliente indicado permanecer ativo.
 */
export const PLAN_COMMISSIONS_CENTS: Record<string, number> = {
  start: 800,       // R$ 8,00/mês  (Mensalidade R$ 39,90)
  solo: 1800,      // R$ 18,00/mês (Mensalidade R$ 87,99)
  solo_plus: 3200, // R$ 32,00/mês (Mensalidade R$ 157,99)
  pro: 6000,       // R$ 60,00/mês (Mensalidade R$ 297,00)
  super: 12000,    // R$ 120,00/mês(Mensalidade R$ 597,00)
};

export const PLAN_COMMISSIONS_DISPLAY: Record<string, string> = {
  start: 'R$ 8,00',
  solo: 'R$ 18,00',
  solo_plus: 'R$ 32,00',
  pro: 'R$ 60,00',
  super: 'R$ 120,00',
};

export interface ReferralStatus {
  totalReferrals: number;
  activeQualified: number;
  neededForExemption: number;
  isExempt: boolean;
  isAnalisador: boolean;
  isAnalisadorOficial: boolean;
  monthlyEarningsCents: number;
  monthlyEarningsFormatted: string;
  pixKey?: string | null;
  referrerPlanName?: string;
  hasPaidFirstInvoice: boolean;
  referralLink: string;
  phone: string;
}

/**
 * Garante que qualquer pessoa (cliente existente ou novo divulgador) tenha um
 * registro em clients para associar indicações e comissões.
 */
export async function ensureClientForAnalisador(
  phoneOrClientId: string,
  pushName?: string
): Promise<{ id: string; name: string; whatsapp_number: string; pix_key?: string | null; is_analisador?: boolean }> {
  const supabase = createServiceRoleClient();
  const cleanInput = phoneOrClientId.trim();

  // Se já for um UUID de cliente
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanInput);
  if (isUuid) {
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, name, whatsapp_number, pix_key, is_analisador')
      .eq('id', cleanInput)
      .maybeSingle();

    if (existingClient) return existingClient;
  }

  // É um número de telefone
  const cleanPhone = cleanInput.replace(/\D/g, '');
  const phoneVariations = [
    cleanPhone,
    cleanPhone.startsWith('55') ? cleanPhone.slice(2) : `55${cleanPhone}`,
  ];

  // Busca cliente existente pelo telefone
  const { data: clientByPhone } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number, pix_key, is_analisador')
    .in('whatsapp_number', phoneVariations)
    .limit(1)
    .maybeSingle();

  if (clientByPhone) {
    return clientByPhone;
  }

  // Busca se já tem Pix salvo em trial_leads
  const { data: trialLead } = await supabase
    .from('trial_leads')
    .select('pix_key')
    .in('whatsapp_number', phoneVariations)
    .limit(1)
    .maybeSingle();

  const formattedName = pushName ? `${pushName.trim()}` : `Analisador ${cleanPhone.slice(-4)}`;

  // Cria cliente simplificado para o Analisador
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      name: formattedName,
      whatsapp_number: cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`,
      status: 'active',
      is_analisador: true,
      pix_key: trialLead?.pix_key || null,
    })
    .select('id, name, whatsapp_number, pix_key, is_analisador')
    .single();

  if (error || !newClient) {
    throw new Error(`Falha ao registrar Analisador para o telefone ${cleanPhone}: ${error?.message}`);
  }

  return newClient;
}

/**
 * Consulta o status completo do programa Analisador para um cliente ou telefone.
 */
export async function getReferralStatus(phoneOrClientId: string): Promise<ReferralStatus> {
  const supabase = createServiceRoleClient();
  const client = await ensureClientForAnalisador(phoneOrClientId);

  const cleanPhone = client.whatsapp_number.replace(/\D/g, '');
  const referralLink = `https://wa.me/${OFFICIAL_BOT_WHATSAPP}?text=${encodeURIComponent(
    `Olá! Vim por indicação do Analisador ${cleanPhone} para testar o AnalisAí.`
  )}`;

  // Consulta assinatura e plano do cliente
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, is_referral_exempt, asaas_payment_id, status, plans(name, code, monthly_price_cents)')
    .eq('client_id', client.id)
    .eq('status', 'active')
    .maybeSingle();

  const plan = (sub as any)?.plans;
  const isExempt = Boolean(sub?.is_referral_exempt);
  const hasPaidFirstInvoice = Boolean(sub?.asaas_payment_id);

  // Consulta indicados
  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, status, commission_cents, referred_client_id, subscriptions!referred_client_id(status, asaas_payment_id, plans(code, name, monthly_price_cents))')
    .eq('referrer_client_id', client.id);

  const total = referrals?.length || 0;
  let activeQualified = 0;
  let monthlyEarningsCents = 0;

  if (referrals && referrals.length > 0) {
    for (const ref of referrals) {
      const refSub = (ref as any).subscriptions;
      const refPlanCode = (refSub?.plans?.code || '').toLowerCase();

      // Indicado ativo pagante
      if (ref.status === 'qualified_active' && refSub?.status === 'active') {
        activeQualified++;

        // Comissão mensal do plano
        const planCommission =
          ref.commission_cents && ref.commission_cents > 0
            ? ref.commission_cents
            : PLAN_COMMISSIONS_CENTS[refPlanCode] || 1800; // Default Solo (R$ 18,00)

        monthlyEarningsCents += planCommission;
      }
    }
  }

  const isAnalisadorOficial = activeQualified >= 3 || Boolean(client.is_analisador && activeQualified >= 3);
  const neededForExemption = Math.max(0, 3 - activeQualified);
  const monthlyEarningsFormatted = (monthlyEarningsCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return {
    totalReferrals: total,
    activeQualified,
    neededForExemption,
    isExempt: isExempt || isAnalisadorOficial,
    isAnalisador: true,
    isAnalisadorOficial,
    monthlyEarningsCents,
    monthlyEarningsFormatted,
    pixKey: client.pix_key || null,
    referrerPlanName: plan?.name,
    hasPaidFirstInvoice,
    referralLink,
    phone: cleanPhone,
  };
}

/**
 * Cria a barra de progresso visual para as metas do Analisador
 */
function renderProgressBar(current: number, target: number = 3): string {
  const safeCurrent = Math.min(Math.max(0, current), target);
  const totalBlocks = 10;
  const filledBlocks = Math.round((safeCurrent / target) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  return `[${bar}] ${safeCurrent}/${target}`;
}

/**
 * Painel Oficial do Analisador (mensagem vibrante, jovem e completa)
 */
export async function getReferralShareMessage(phoneOrClientId: string, pushName?: string): Promise<string> {
  const status = await getReferralStatus(phoneOrClientId);

  let txt = `⚡ *Painel do Analisador • AnalisAí* ⚡\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `Transforme suas conexões em renda mensal no Pix e use o AnalisAí de graça!\n\n`;

  // Status e Selo
  if (status.isAnalisadorOficial) {
    txt += `🎖️ *Selo Conquistado:* *ANALISADOR OFICIAL* 🏆\n`;
    txt += `🎁 *Sua Assinatura Solo:* 🎉 *100% GRATUITA* (Zero custo para você todo mês!)\n\n`;
  } else {
    txt += `🎯 *Seu Selo:* *Analisador em Ação*\n`;
    txt += `🎁 *Meta para Selo Oficial:* Faltam apenas *${status.neededForExemption} indicação(ões) ativas* para conquistar o **Selo Analisador Oficial** e ter o **AnalisAí Solo 100% GRATUITO** para sempre!\n\n`;
  }

  // Barra de Progresso
  txt += `📊 *Régua de Meta (Gratuidade Solo):*\n`;
  txt += `${renderProgressBar(status.activeQualified, 3)} `;
  if (status.isAnalisadorOficial) {
    txt += `*(Meta 100% Atingida!)* 🚀\n\n`;
  } else {
    txt += `*(${status.activeQualified} de 3 ativos)*\n\n`;
  }

  // Renda Mensal no Pix
  txt += `💰 *Sua Renda Mensal Recorrente no Pix:*\n`;
  txt += `• Clientes ativos indicados: *${status.activeQualified}*\n`;
  txt += `• Comissão mensal acumulada: *${status.monthlyEarningsFormatted}/mês*\n`;
  
  if (status.pixKey) {
    txt += `• Chave Pix cadastrada: \`${status.pixKey}\` ✅\n\n`;
  } else {
    txt += `• Chave Pix cadastrada: ⚠️ *Nenhuma chave informada ainda!*\n`;
    txt += `  _(Cadastre agora enviando: *!pix sua_chave* para receber suas comissões)_\n\n`;
  }

  // Tabela de Comissões por Plano
  txt += `📋 *Comissões Recorrentes por Plano (~20%/mês no Pix):*\n`;
  txt += `• *Plano Start (R$ 39,90):* +R$ 8,00 / mês\n`;
  txt += `• *Plano Solo (R$ 87,99):* +R$ 18,00 / mês\n`;
  txt += `• *Plano Solo Plus (R$ 157,99):* +R$ 32,00 / mês\n`;
  txt += `• *Plano Pro (R$ 297,00):* +R$ 60,00 / mês\n`;
  txt += `• *Plano Super (R$ 597,00):* +R$ 120,00 / mês\n`;
  txt += `_(A comissão cai na sua conta todo mês enquanto seu indicado mantiver o plano ativo. Sem limite de indicados!)_\n\n`;

  // Link Oficial de Divulgação
  txt += `🔗 *Seu Link Exclusivo de Analisador:*
${status.referralLink}

📲 *Mensagem pronta para você copiar e enviar:*
_"Opa! Estou usando o AnalisAí para organizar minhas contas e pagar tudo sem estresse direto pelo WhatsApp. Você pode testar de graça agora enviando uma foto de conta ou boleto para o robô oficial: ${status.referralLink}"_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Comandos Rápidos:*
• *!pix [chave]* → Cadastrar ou alterar sua chave Pix
• *!analisador* → Atualizar seu painel e saldo de comissões`;

  return txt;
}

/**
 * Salva ou atualiza a chave Pix do Analisador
 */
export async function setAnalisadorPixKey(
  phoneOrClientId: string,
  rawPixKey: string
): Promise<{ success: boolean; message: string; pixKey: string }> {
  const supabase = createServiceRoleClient();
  const cleanPixKey = rawPixKey.trim();

  if (!cleanPixKey || cleanPixKey.length < 3) {
    return {
      success: false,
      message: `⚠️ Por favor, informe uma chave Pix válida.\nExemplo: *!pix 13978122222* ou *!pix financeiro@empresa.com*`,
      pixKey: '',
    };
  }

  const client = await ensureClientForAnalisador(phoneOrClientId);

  // Atualiza no clients
  await supabase
    .from('clients')
    .update({ pix_key: cleanPixKey, is_analisador: true })
    .eq('id', client.id);

  // Atualiza também no trial_leads se houver registro por telefone
  const cleanPhone = client.whatsapp_number.replace(/\D/g, '');
  await supabase
    .from('trial_leads')
    .update({ pix_key: cleanPixKey })
    .eq('whatsapp_number', cleanPhone);

  const msg = `✅ *Chave Pix Registrada com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sua chave Pix cadastrada:
👉 \`${cleanPixKey}\`

Todo mês, as comissões das suas indicações ativas como **Analisador** serão transferidas diretamente para esta chave!

💡 Digite *!analisador* a qualquer momento para ver seus ganhos acumulados e seu link de convite.`;

  return {
    success: true,
    message: msg,
    pixKey: cleanPixKey,
  };
}

/**
 * Registra o vínculo do novo lead com o Analisador que o indicou
 */
export async function linkReferralLead(referredPhone: string, referrerPhone: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const cleanReferred = referredPhone.replace(/\D/g, '');
  const cleanReferrer = referrerPhone.replace(/\D/g, '');

  if (!cleanReferred || !cleanReferrer || cleanReferred === cleanReferrer) return;

  // Garante que o indicador tenha registro em clients
  const referrer = await ensureClientForAnalisador(cleanReferrer);

  // Salva no trial_leads do novo contato
  const { data: existingLead } = await supabase
    .from('trial_leads')
    .select('id')
    .eq('whatsapp_number', cleanReferred)
    .maybeSingle();

  if (existingLead) {
    await supabase
      .from('trial_leads')
      .update({ referrer_phone: cleanReferrer })
      .eq('whatsapp_number', cleanReferred);
  } else {
    await supabase
      .from('trial_leads')
      .insert({
        whatsapp_number: cleanReferred,
        referrer_phone: cleanReferrer,
        first_interaction_at: new Date().toISOString(),
      });
  }
}

/**
 * Ativa a qualificação da indicação quando o novo cliente realiza o 1º pagamento.
 * Executa cálculo de comissão e notifica o Analisador no WhatsApp com seus novos ganhos!
 */
export async function qualifyReferralOnPayment(referredClientId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  // Localiza o cliente recém-pago e seu plano contratado
  const { data: referredClient } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number')
    .eq('id', referredClientId)
    .maybeSingle();

  if (!referredClient) return;

  // Busca plano ativo contratado pelo novo cliente
  const { data: refSub } = await supabase
    .from('subscriptions')
    .select('id, plans(code, name, monthly_price_cents)')
    .eq('client_id', referredClientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const planCode = ((refSub as any)?.plans?.code || 'solo').toLowerCase();
  const planName = (refSub as any)?.plans?.name || 'AnalisAí Solo';
  const commissionCents = PLAN_COMMISSIONS_CENTS[planCode] || 1800;
  const commissionFormatted = (commissionCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  // Verifica se ele veio com indicação anotada em trial_leads
  const cleanReferredPhone = referredClient.whatsapp_number.replace(/\D/g, '');
  const { data: trial } = await supabase
    .from('trial_leads')
    .select('referrer_phone')
    .eq('whatsapp_number', cleanReferredPhone)
    .maybeSingle();

  if (!trial?.referrer_phone) return;

  const cleanReferrerPhone = trial.referrer_phone.replace(/\D/g, '');
  const referrer = await ensureClientForAnalisador(cleanReferrerPhone);

  if (!referrer || referrer.id === referredClientId) return;

  // Insere ou atualiza na tabela referrals com a comissão do plano
  await supabase.from('referrals').upsert(
    {
      referrer_client_id: referrer.id,
      referred_client_id: referredClientId,
      status: 'qualified_active',
      commission_cents: commissionCents,
      first_paid_at: new Date().toISOString(),
    },
    { onConflict: 'referred_client_id' }
  );

  // Executa apuração da isenção de gratuidade Solo (se atingiu 3 indicados)
  await supabase.rpc('evaluate_referral_exemption', {
    p_client_id: referrer.id,
  });

  // Consulta status atualizado para a mensagem comemorativa
  const progress = await getReferralStatus(referrer.id);
  const clientFirstName = (referredClient.name || 'Um amigo').split(' ')[0];

  let notifyMsg = `🎉 *Boas notícias, Analisador! Nova Comissão Confirmada!*\n`;
  notifyMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  notifyMsg += `O cliente *${clientFirstName}* que você indicou acabou de ativar o plano *${planName}* no AnalisAí!\n\n`;
  notifyMsg += `💵 *Você acabou de garantir:* +*${commissionFormatted}/mês* recorrente no seu Pix!\n`;
  notifyMsg += `💰 *Sua renda mensal total agora:* *${progress.monthlyEarningsFormatted}/mês*\n\n`;

  if (progress.isAnalisadorOficial) {
    notifyMsg += `🚀 *PARABÉNS! VOCÊ CONQUISTOU O SELO ANALISADOR OFICIAL!* 🎖️\n`;
    notifyMsg += `Você tem **${progress.activeQualified} clientes ativos**! Além das comissões mensais no Pix, o seu AnalisAí Solo agora é **100% GRATUITO** todo mês!`;
  } else {
    notifyMsg += `📊 *Progresso para a Gratuidade Solo:* ${progress.activeQualified} de 3 indicados ativos.\n`;
    notifyMsg += `Falta(m) apenas *${progress.neededForExemption} indicação(ões)* para você zerar 100% a sua assinatura Solo!`;
  }

  notifyMsg += `\n\n💡 Digite *!analisador* para conferir seu painel completo.`;

  await sendEvolutionText({
    phone: referrer.whatsapp_number,
    text: notifyMsg,
  });
}
