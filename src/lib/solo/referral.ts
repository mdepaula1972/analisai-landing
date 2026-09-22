import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { OFFICIAL_BOT_WHATSAPP, OFFICIAL_BOT_PHONE_DISPLAY } from '@/lib/solo/constants';
import {
  enviarCodigo2FAAlteracaoPix,
  notificarAlteracaoPixConcluida,
  enviarCodigo2FATrocaEmail,
  notificarTrocaEmailConcluida,
} from '@/lib/email';
import { maskEmail } from '@/lib/solo/phone-change';
import { addMinutes } from 'date-fns';

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
  isDocumentPixKey: boolean;
  taxIdFormatted?: string | null;
  clientEmail?: string | null;
  referrerPlanName?: string;
  hasPaidFirstInvoice: boolean;
  referralLink: string;
  phone: string;
}

/**
 * Utilitário de formatação de CNPJ ou CPF
 */
export function formatTaxId(taxId?: string | null): string {
  if (!taxId) return '';
  const clean = taxId.replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return taxId;
}

/**
 * Garante que qualquer pessoa (cliente existente ou novo divulgador) tenha um
 * registro em clients para associar indicações e comissões.
 */
export async function ensureClientForAnalisador(
  phoneOrClientId: string,
  pushName?: string
): Promise<{
  id: string;
  name: string;
  email?: string | null;
  email_updated_at?: string | null;
  whatsapp_number: string;
  tax_id?: string | null;
  tax_type?: string | null;
  pix_key?: string | null;
  is_analisador?: boolean;
}> {
  const supabase = createServiceRoleClient();
  const cleanInput = phoneOrClientId.trim();

  // Se já for um UUID de cliente
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanInput);
  if (isUuid) {
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, name, email, email_updated_at, whatsapp_number, tax_id, tax_type, pix_key, is_analisador')
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
    .select('id, name, email, email_updated_at, whatsapp_number, tax_id, tax_type, pix_key, is_analisador')
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
    .select('id, name, email, email_updated_at, whatsapp_number, tax_id, tax_type, pix_key, is_analisador')
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

  const formattedTaxId = client.tax_id ? formatTaxId(client.tax_id) : null;
  const cleanTaxDigits = (client.tax_id || '').replace(/\D/g, '');
  const cleanPixDigits = (client.pix_key || '').replace(/\D/g, '');

  // Padrão Inteligente: se não cadastrou Pix customizado, assume o CNPJ/CPF oficial da assinatura
  const activePixKey = client.pix_key || (formattedTaxId || null);
  const isDocumentPixKey = Boolean(
    cleanTaxDigits && (cleanPixDigits === cleanTaxDigits || !client.pix_key)
  );

  return {
    totalReferrals: total,
    activeQualified,
    neededForExemption,
    isExempt: isExempt || isAnalisadorOficial,
    isAnalisador: true,
    isAnalisadorOficial,
    monthlyEarningsCents,
    monthlyEarningsFormatted,
    pixKey: activePixKey,
    isDocumentPixKey,
    taxIdFormatted: formattedTaxId,
    clientEmail: client.email || null,
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
    txt += `• Chave Pix cadastrada: \`${status.pixKey}\` ${status.isDocumentPixKey ? '🛡️ *(CNPJ/CPF Oficial)*' : '✅'}\n\n`;
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
• *!pix [chave]* → Alterar chave Pix (com proteção 2FA)
• *!analisador* → Atualizar seu painel e saldo de comissões`;

  return txt;
}

/**
 * Solicitação de alteração de chave Pix com proteção de segurança 2FA (Abordagem 2)
 * - Se a chave informada for o próprio CNPJ/CPF oficial da empresa: atualiza direto sem atrito.
 * - Se for uma chave alternativa (e-mail, telefone, chave aleatória): exige 2FA via e-mail do titular.
 */
export async function solicitarAlteracaoPix(
  phoneOrClientId: string,
  rawPixKey: string
): Promise<{ success: boolean; requires2FA: boolean; message: string; maskedEmail?: string }> {
  const supabase = createServiceRoleClient();
  const cleanPixKey = rawPixKey.trim();

  if (!cleanPixKey || cleanPixKey.length < 3) {
    return {
      success: false,
      requires2FA: false,
      message: `⚠️ Por favor, informe uma chave Pix válida.\nExemplo: *!pix 12.345.678/0001-90* ou *!pix financeiro@empresa.com*`,
    };
  }

  const client = await ensureClientForAnalisador(phoneOrClientId);
  const clientTaxDigits = (client.tax_id || '').replace(/\D/g, '');
  const inputDigits = cleanPixKey.replace(/\D/g, '');

  // 1. Se a chave informada for exatamente o próprio CNPJ ou CPF do titular
  const isOwnDocument = Boolean(clientTaxDigits && inputDigits === clientTaxDigits);
  if (isOwnDocument) {
    const formattedDoc = formatTaxId(client.tax_id);
    await supabase
      .from('clients')
      .update({ pix_key: formattedDoc, is_analisador: true })
      .eq('id', client.id);

    const cleanPhone = client.whatsapp_number.replace(/\D/g, '');
    await supabase
      .from('trial_leads')
      .update({ pix_key: formattedDoc })
      .eq('whatsapp_number', cleanPhone);

    return {
      success: true,
      requires2FA: false,
      message: `✅ *Chave Pix Atualizada com o Documento Oficial da sua Empresa!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sua chave Pix registrada:
👉 \`${formattedDoc}\` 🛡️ *(CNPJ/CPF Oficial do Titular)*

Como esta chave é o próprio documento do seu contrato, a atualização foi concluída imediatamente com **blindagem bancária total**!

💡 Digite *!analisador* para ver seu painel completo.`,
    };
  }

  // 2. Trava de Quarentena Bancária (Cooling-off Period de 24 horas):
  // Se o e-mail foi alterado recentemente, bloqueia a troca de Pix para terceiros
  if (client.email_updated_at) {
    const hoursSinceEmailUpdate =
      (Date.now() - new Date(client.email_updated_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceEmailUpdate < 24) {
      const remainingHours = Math.ceil(24 - hoursSinceEmailUpdate);
      return {
        success: false,
        requires2FA: false,
        message: `🛡️ *Quarentena de Segurança Ativa (Proteção 24h)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seu e-mail de segurança foi alterado recentemente. Por normas de proteção bancária contra fraudes, alterações de chave Pix para contas alternativas ficam suspensas por **24 horas** após uma mudança de e-mail (restam ~${remainingHours}h).

Durante este período, seus repasses são transferidos exclusivamente para o **CNPJ oficial da sua empresa** (\`${formatTaxId(client.tax_id)}\`).`,
      };
    }
  }

  // 3. A chave informada é uma chave alternativa (e-mail, telefone, chave aleatória, etc.)
  // Exige validação 2FA pelo e-mail do titular
  if (!client.email || !client.email.includes('@')) {
    return {
      success: false,
      requires2FA: false,
      message: `⚠️ *Proteção de Segurança 2FA Obrigatória*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para cadastrar uma chave Pix alternativa (\`${cleanPixKey}\`) diferente do CNPJ oficial da sua empresa, é obrigatório ter um e-mail de segurança cadastrado para validação em 2 etapas.

Isso impede que qualquer pessoa que pegue este aparelho desvie suas comissões!

👉 Por favor, registre seu e-mail enviando:
*!email seu_email@empresa.com*`,
    };
  }

  // 3. Gera código OTP seguro de 6 dígitos
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const maskedEmail = maskEmail(client.email);

  // Expira solicitações pendentes anteriores de chave Pix
  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'expired' })
    .eq('client_id', client.id)
    .eq('action_type', 'change_pix_key')
    .eq('status', 'pending');

  // Registra nova confirmação pendente de 2FA
  const { error: insErr } = await supabase.from('bot_action_confirmations').insert({
    client_id: client.id,
    phone_number: client.whatsapp_number,
    action_type: 'change_pix_key',
    status: 'pending',
    expires_at: addMinutes(new Date(), 10).toISOString(),
    proposed_payload: {
      proposed_pix_key: cleanPixKey,
      otp_code: otpCode,
      email: client.email,
      client_name: client.name,
    },
  });

  if (insErr) {
    console.error('[2FA Pix Error]:', insErr);
    return {
      success: false,
      requires2FA: false,
      message: `⚠️ Ocorreu uma instabilidade ao gerar seu código de segurança. Tente novamente em instantes.`,
    };
  }

  // Envia e-mail com o código de 6 dígitos
  await enviarCodigo2FAAlteracaoPix({
    emailDestino: client.email,
    nomeCliente: client.name,
    codigoOtp: otpCode,
    novaChavePix: cleanPixKey,
  });

  return {
    success: true,
    requires2FA: true,
    maskedEmail,
    message: `🔒 *Confirmação de Segurança 2FA Obrigatória*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para garantir que **apenas o titular** autorize a mudança da conta de recebimento para a chave \`${cleanPixKey}\`, enviamos um código de segurança de 6 dígitos para o seu e-mail cadastrado:
📧 *${maskedEmail}*

👉 Digite o código aqui no WhatsApp para autorizar:
*!confirmarpix CÓDIGO* (ou envie apenas os 6 dígitos)

⏱️ *Validade:* 10 minutos.
_(Se você não solicitou essa alteração, basta ignorar. Sua conta e comissões continuam 100% seguras!)_`,
  };
}

/**
 * Confirma a alteração da chave Pix validando o código OTP de 6 dígitos
 */
export async function confirmarAlteracaoPix(
  phoneOrClientId: string,
  rawOtp: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const cleanOtp = rawOtp.replace(/\D/g, '').trim();

  if (cleanOtp.length !== 6) {
    return {
      success: false,
      message: `⚠️ O código de segurança deve ter exatamente 6 dígitos numéricos.\nExemplo: *!confirmarpix 729184* (ou envie apenas *729184*)`,
    };
  }

  const client = await ensureClientForAnalisador(phoneOrClientId);
  const nowIso = new Date().toISOString();

  // Localiza a solicitação pendente mais recente dentro do prazo
  const { data: pendingList } = await supabase
    .from('bot_action_confirmations')
    .select('*')
    .eq('client_id', client.id)
    .eq('action_type', 'change_pix_key')
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  const pending = pendingList?.[0];

  if (!pending) {
    return {
      success: false,
      message: `⚠️ *Nenhuma solicitação pendente!*
Não encontramos nenhuma solicitação de alteração de chave Pix aguardando confirmação (ou o prazo de 10 minutos já expirou).

Para solicitar novamente, envie: *!pix sua_chave*`,
    };
  }

  const payload = pending.proposed_payload as any;

  if (payload?.otp_code !== cleanOtp) {
    return {
      success: false,
      message: `❌ *Código de Segurança Incorreto!*
O código de 6 dígitos informado não confere com o enviado ao seu e-mail *${maskEmail(payload?.email || client.email || '')}*.

Verifique sua caixa de entrada (ou pasta de spam) e envie novamente:
*!confirmarpix CÓDIGO*`,
    };
  }

  // Código correto! Efetiva a alteração da chave Pix
  const newPixKey = payload.proposed_pix_key;

  await supabase
    .from('clients')
    .update({ pix_key: newPixKey, is_analisador: true })
    .eq('id', client.id);

  const cleanPhone = client.whatsapp_number.replace(/\D/g, '');
  await supabase
    .from('trial_leads')
    .update({ pix_key: newPixKey })
    .eq('whatsapp_number', cleanPhone);

  // Marca ação como confirmada
  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'confirmed' })
    .eq('id', pending.id);

  // Dispara e-mail de auditoria ao titular
  if (payload?.email) {
    await notificarAlteracaoPixConcluida({
      emailDestino: payload.email,
      nomeCliente: client.name,
      novaChavePix: newPixKey,
    });
  }

  return {
    success: true,
    message: `✅ *Chave Pix Autorizada e Atualizada com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sua nova chave Pix cadastrada:
👉 \`${newPixKey}\`

Autenticação em duas etapas (2FA) concluída com sucesso!
Todas as comissões das suas indicações ativas como **Analisador** serão transferidas para esta conta.

💡 Digite *!analisador* a qualquer momento para ver seu painel de comissões e link de convite.`,
  };
}

/**
 * Cancela qualquer solicitação pendente de alteração de chave Pix
 */
export async function cancelarAlteracaoPix(phoneOrClientId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const client = await ensureClientForAnalisador(phoneOrClientId);

  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'rejected' })
    .eq('client_id', client.id)
    .eq('action_type', 'change_pix_key')
    .eq('status', 'pending');

  return `🛡️ *Solicitação de Alteração de Pix Cancelada!*
A alteração foi descartada e sua chave Pix cadastrada anteriormente continua mantida com segurança total.`;
}

/**
 * Solicitação de alteração ou cadastro de e-mail com proteção 2FA (Segurança da Corrente de Custódia)
 * - Se já possui e-mail cadastrado: envia código OTP para o E-MAIL ATUAL (ANTIGO) para autorizar a troca!
 * - Se não possui e-mail cadastrado: envia código OTP para o novo e-mail para validar posse da caixa postal.
 */
export async function solicitarAlteracaoEmail(
  phoneOrClientId: string,
  rawEmail: string
): Promise<{ success: boolean; requires2FA: boolean; message: string; maskedEmail?: string }> {
  const supabase = createServiceRoleClient();
  const cleanEmail = rawEmail.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return {
      success: false,
      requires2FA: false,
      message: `⚠️ Por favor, informe um endereço de e-mail válido.\nExemplo: *!email financeiro@suaempresa.com.br*`,
    };
  }

  const client = await ensureClientForAnalisador(phoneOrClientId);

  // Se o novo e-mail for idêntico ao já cadastrado
  if (client.email && client.email.toLowerCase() === cleanEmail) {
    return {
      success: true,
      requires2FA: false,
      message: `ℹ️ O e-mail \`${cleanEmail}\` já é o e-mail oficial cadastrado na sua conta.`,
    };
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Cancela pendências anteriores de alteração de e-mail
  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'expired' })
    .eq('client_id', client.id)
    .eq('action_type', 'change_email')
    .eq('status', 'pending');

  // CENÁRIO 1: Cliente JÁ possui e-mail cadastrado
  // O código 2FA DEVE ser enviado para o e-mail ATUAL (ANTIGO) para impedir que invasor troque o e-mail!
  if (client.email && client.email.includes('@')) {
    const maskedCurrent = maskEmail(client.email);

    await supabase.from('bot_action_confirmations').insert({
      client_id: client.id,
      phone_number: client.whatsapp_number,
      action_type: 'change_email',
      status: 'pending',
      expires_at: addMinutes(new Date(), 10).toISOString(),
      proposed_payload: {
        novo_email: cleanEmail,
        email_antigo: client.email,
        otp_code: otpCode,
        client_name: client.name,
      },
    });

    await enviarCodigo2FATrocaEmail({
      emailAtual: client.email,
      nomeCliente: client.name,
      codigoOtp: otpCode,
      novoEmail: cleanEmail,
    });

    return {
      success: true,
      requires2FA: true,
      maskedEmail: maskedCurrent,
      message: `🔒 *Autorização de Troca de E-mail Obrigatória (2FA)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para proteger sua empresa contra invasões, o e-mail de segurança só pode ser alterado mediante autorização enviada para o seu **e-mail ATUAL**:
📧 *${maskedCurrent}*

👉 Digite o código de 6 dígitos recebido no e-mail atual:
*!confirmaremail CÓDIGO* (ou envie apenas os 6 dígitos)

⏱️ *Validade:* 10 minutos.
_(Se você não solicitou essa troca, ignore este aviso. Sua conta permanece 100% protegida!)_`,
    };
  }

  // CENÁRIO 2: Cliente AINDA NÃO possui e-mail cadastrado (cadastro inicial)
  // Envia código para o novo e-mail para validar posse da caixa de entrada
  await supabase.from('bot_action_confirmations').insert({
    client_id: client.id,
    phone_number: client.whatsapp_number,
    action_type: 'change_email',
    status: 'pending',
    expires_at: addMinutes(new Date(), 10).toISOString(),
    proposed_payload: {
      novo_email: cleanEmail,
      email_antigo: null,
      otp_code: otpCode,
      client_name: client.name,
    },
  });

  await enviarCodigo2FATrocaEmail({
    emailAtual: cleanEmail,
    nomeCliente: client.name,
    codigoOtp: otpCode,
    novoEmail: cleanEmail,
  });

  return {
    success: true,
    requires2FA: true,
    maskedEmail: maskEmail(cleanEmail),
    message: `📧 *Confirmação de E-mail Obrigatória*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enviamos um código de segurança de 6 dígitos para o e-mail informado:
👉 *${cleanEmail}*

Digite o código aqui no WhatsApp para confirmar o vínculo:
*!confirmaremail CÓDIGO* (ou envie apenas os 6 dígitos)

⏱️ *Validade:* 10 minutos.`,
  };
}

/**
 * Confirma a alteração ou cadastro do e-mail validando o OTP de 6 dígitos
 */
export async function confirmarAlteracaoEmail(
  phoneOrClientId: string,
  rawOtp: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const cleanOtp = rawOtp.replace(/\D/g, '').trim();

  if (cleanOtp.length !== 6) {
    return {
      success: false,
      message: `⚠️ O código de segurança deve ter exatamente 6 dígitos numéricos.\nExemplo: *!confirmaremail 729184* (ou envie apenas *729184*)`,
    };
  }

  const client = await ensureClientForAnalisador(phoneOrClientId);
  const nowIso = new Date().toISOString();

  const { data: pendingList } = await supabase
    .from('bot_action_confirmations')
    .select('*')
    .eq('client_id', client.id)
    .eq('action_type', 'change_email')
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  const pending = pendingList?.[0];

  if (!pending) {
    return {
      success: false,
      message: `⚠️ *Nenhuma solicitação de troca de e-mail pendente!*
Não encontramos nenhuma solicitação aguardando confirmação (ou o prazo de 10 minutos expirou).

Para solicitar novamente, envie: *!email novo_email@empresa.com*`,
    };
  }

  const payload = pending.proposed_payload as any;

  if (payload?.otp_code !== cleanOtp) {
    return {
      success: false,
      message: `❌ *Código de Segurança Incorreto!*
O código de 6 dígitos digitado não confere. Verifique sua caixa de entrada e pasta de spam e tente novamente:
*!confirmaremail CÓDIGO*`,
    };
  }

  // Código correto! Atualiza o e-mail e ativa a quarentena de 24h
  const newEmail = payload.novo_email;
  const nowTimestamp = new Date().toISOString();

  await supabase
    .from('clients')
    .update({ email: newEmail, email_updated_at: nowTimestamp })
    .eq('id', client.id);

  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'confirmed' })
    .eq('id', pending.id);

  // Notifica ambos os e-mails
  if (payload.email_antigo) {
    await notificarTrocaEmailConcluida({
      emailAntigo: payload.email_antigo,
      novoEmail: newEmail,
      nomeCliente: client.name,
    });
  }

  return {
    success: true,
    message: `✅ *E-mail de Segurança Atualizado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Novo e-mail registrado:
👉 \`${newEmail}\`

🛡️ *Proteção de Quarentena Ativa (24h):*
Por diretrizes de segurança bancária contra fraudes, alterações de chave Pix para contas de terceiros ficam suspensas pelas próximas **24 horas**. Durante esse período, seus repasses são efetuados exclusivamente para o CNPJ oficial da sua empresa.`,
  };
}

/**
 * Cancela qualquer solicitação pendente de troca de e-mail
 */
export async function cancelarAlteracaoEmail(phoneOrClientId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const client = await ensureClientForAnalisador(phoneOrClientId);

  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'rejected' })
    .eq('client_id', client.id)
    .eq('action_type', 'change_email')
    .eq('status', 'pending');

  return `🛡️ *Solicitação de Alteração de E-mail Cancelada!*
O e-mail anterior permanece mantido sem qualquer modificação.`;
}

/**
 * Cadastra ou atualiza o e-mail de segurança do cliente (compatibilidade)
 */
export async function cadastrarEmailCliente(
  phoneOrClientId: string,
  rawEmail: string
): Promise<{ success: boolean; message: string }> {
  const res = await solicitarAlteracaoEmail(phoneOrClientId, rawEmail);
  return {
    success: res.success,
    message: res.message,
  };
}

/**
 * Compatibilidade legada com a assinatura anterior
 */
export async function setAnalisadorPixKey(
  phoneOrClientId: string,
  rawPixKey: string
): Promise<{ success: boolean; message: string; pixKey: string }> {
  const res = await solicitarAlteracaoPix(phoneOrClientId, rawPixKey);
  return {
    success: res.success,
    message: res.message,
    pixKey: rawPixKey.trim(),
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
