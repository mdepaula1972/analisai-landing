import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export interface ReferralStatus {
  totalReferrals: number;
  activeQualified: number;
  neededForExemption: number;
  isExempt: boolean;
  referrerPlanName?: string;
  hasPaidFirstInvoice: boolean;
}

/**
 * Consulta o progresso do programa de indicação de um cliente
 * (3 pagantes no mesmo plano ou superior = mensalidade 100% gratuita)
 */
export async function getReferralStatus(clientId: string): Promise<ReferralStatus> {
  const supabase = createServiceRoleClient();

  // Consulta assinatura e plano do cliente
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, is_referral_exempt, asaas_payment_id, status, plans(name, monthly_price_cents)')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle();

  const plan = (sub as any)?.plans;
  const isExempt = Boolean(sub?.is_referral_exempt);
  const hasPaidFirstInvoice = Boolean(sub?.asaas_payment_id);

  // Consulta indicados
  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, status, referred_client_id, subscriptions!referred_client_id(status, asaas_payment_id, plans(monthly_price_cents))')
    .eq('referrer_client_id', clientId);

  const total = referrals?.length || 0;
  let activeQualified = 0;

  if (referrals && plan?.monthly_price_cents) {
    for (const ref of referrals) {
      const refSub = (ref as any).subscriptions;
      if (
        ref.status === 'qualified_active' &&
        refSub?.status === 'active' &&
        refSub?.asaas_payment_id &&
        (refSub.plans?.monthly_price_cents || 0) >= plan.monthly_price_cents
      ) {
        activeQualified++;
      }
    }
  }

  return {
    totalReferrals: total,
    activeQualified,
    neededForExemption: Math.max(0, 3 - activeQualified),
    isExempt,
    referrerPlanName: plan?.name,
    hasPaidFirstInvoice,
  };
}

/**
 * Mensagem amigável com o link de indicação do cliente e seu progresso atual
 */
export async function getReferralShareMessage(clientId: string, phone: string): Promise<string> {
  const status = await getReferralStatus(clientId);
  const cleanPhone = phone.replace(/\D/g, '');
  const referralLink = `https://wa.me/551331500987?text=${encodeURIComponent(
    `Olá! Vim por indicação do cliente ${cleanPhone} para testar o AnalisAí.`
  )}`;

  let txt = `🎁 *Programa de Indicação AnalisAí — Próximas Mensalidades Grátis!*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `Ajude outros empresários a organizarem suas contas sem estresse!\n\n`;
  txt += `⭐ *Como funciona a regra oficial de isenção:*
1️⃣ *Assinatura Ativa:* Você precisa ter uma assinatura contratada (1ª mensalidade paga);
2️⃣ *Indique 3 Parceiros:* Compartilhe seu link exclusivo com amigos empresários;
3️⃣ *Mensalidade Zero:* Com **3 indicados pagantes** ativos no mesmo plano que o seu (ou superior), **suas próximas faturas ficam 100% GRATUITAS** a partir da fatura seguinte à ativação deles e enquanto continuarem ativos! O AnalisAí se paga sozinho!\n\n`;

  txt += `📊 *Seu Progresso Atual:*\n`;
  txt += `• Indicados ativos qualificados: *${status.activeQualified} de 3*\n`;
  
  if (!status.hasPaidFirstInvoice) {
    txt += `• Status do seu plano: ⚠️ *Aguardando 1ª mensalidade paga*\n`;
    txt += `  _(A isenção é ativada a partir do ciclo seguinte à sua ativação de plano e adesão dos seus 3 indicados)_\n\n`;
  } else {
    txt += `• Status da sua mensalidade: ${
      status.isExempt
        ? '🎉 *ISENTO (100% Gratuito!)*'
        : `Pagante normal (faltam ${status.neededForExemption} indicados ativos para zerar suas próximas faturas)`
    }\n\n`;
  }

  txt += `👉 *Seu link exclusivo para compartilhar no WhatsApp:*
${referralLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Ao clicar no link acima, seu indicado abre uma conversa direta com o robô oficial do AnalisAí no WhatsApp (13) 3150-0987, com seu código de indicação vinculado automaticamente!_`;

  return txt;
}

/**
 * Registra o vínculo do novo lead com o cliente que o indicou
 */
export async function linkReferralLead(referredPhone: string, referrerPhone: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const cleanReferred = referredPhone.replace(/\D/g, '');
  const cleanReferrer = referrerPhone.replace(/\D/g, '');

  if (cleanReferred === cleanReferrer) return;

  // Localiza cliente indicador
  const { data: referrer } = await supabase
    .from('clients')
    .select('id, name')
    .eq('whatsapp_number', cleanReferrer)
    .maybeSingle();

  if (!referrer) return;

  // Salva no trial_leads
  await supabase
    .from('trial_leads')
    .update({ referrer_phone: cleanReferrer })
    .eq('whatsapp_number', cleanReferred);
}

/**
 * Ativa a qualificação da indicação quando o novo cliente realiza o 1º pagamento
 */
export async function qualifyReferralOnPayment(referredClientId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  // Localiza o cliente recém-pago para ver seu número
  const { data: referredClient } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number')
    .eq('id', referredClientId)
    .maybeSingle();

  if (!referredClient) return;

  // Verifica se ele veio com indicação anotada em trial_leads
  const { data: trial } = await supabase
    .from('trial_leads')
    .select('referrer_phone')
    .eq('whatsapp_number', referredClient.whatsapp_number)
    .maybeSingle();

  if (!trial?.referrer_phone) return;

  // Localiza o indicador
  const { data: referrer } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number')
    .eq('whatsapp_number', trial.referrer_phone)
    .maybeSingle();

  if (!referrer || referrer.id === referredClientId) return;

  // Insere ou atualiza na tabela referrals
  await supabase.from('referrals').upsert(
    {
      referrer_client_id: referrer.id,
      referred_client_id: referredClientId,
      status: 'qualified_active',
      first_paid_at: new Date().toISOString(),
    },
    { onConflict: 'referred_client_id' }
  );

  // Executa apuração da isenção
  const { data: isExempt } = await supabase.rpc('evaluate_referral_exemption', {
    p_client_id: referrer.id,
  });

  // Notifica o indicador no WhatsApp
  const progress = await getReferralStatus(referrer.id);
  let notifyMsg = `🎉 *Boas notícias! Sua indicação foi confirmada!*\n`;
  notifyMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  notifyMsg += `O cliente *${referredClient.name.split(' ')[0]}* que você indicou acabou de ativar o plano dele no AnalisAí!\n\n`;
  notifyMsg += `📊 *Seu saldo de indicações: ${progress.activeQualified} de 3 ativos.*\n`;

  if (isExempt || progress.activeQualified >= 3) {
    notifyMsg += `\n🚀 *PARABÉNS! Você atingiu a meta de 3 indicados ativos!*\n`;
    notifyMsg += `A sua mensalidade do AnalisAí agora é **100% GRATUITA** enquanto eles continuarem ativos no sistema!`;
  } else {
    notifyMsg += `\nFalta(m) apenas *${progress.neededForExemption} indicação(ões)* para você zerar totalmente a sua fatura mensal!`;
  }

  await sendEvolutionText({
    phone: referrer.whatsapp_number,
    text: notifyMsg,
  });
}
