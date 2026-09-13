import { createServiceRoleClient } from '@/lib/supabase-server';
import { ASAAS_PLANS } from '@/lib/solo/constants';
import { formatDueDateDetails } from '@/lib/solo/date-utils';

export interface TrialStatus {
  hasUsedTrial: boolean;
  docData?: any;
}

/**
 * Consulta se este número de WhatsApp já utilizou a degustação gratuita de 1 documento
 */
export async function checkTrialStatus(phone: string): Promise<TrialStatus> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data } = await supabase
    .from('trial_leads')
    .select('doc_processed, doc_data')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (data && data.doc_processed) {
    return { hasUsedTrial: true, docData: data.doc_data };
  }

  return { hasUsedTrial: false };
}

/**
 * Registra o uso da degustação gratuita para este número
 */
export async function recordTrialUsage(phone: string, docData: any): Promise<void> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');

  await supabase
    .from('trial_leads')
    .upsert(
      {
        whatsapp_number: cleanPhone,
        doc_processed: true,
        doc_data: docData,
        trial_completed_at: new Date().toISOString(),
      },
      { onConflict: 'whatsapp_number' }
    );
}

/**
 * Mensagem de boas-vindas com convite para a Degustação Gratuita (sem fricção)
 */
export function getTrialWelcomeMessage(): string {
  return `Olá! 👋 Bem-vindo ao *AnalisAí*.

🎁 *Que tal experimentar uma degustação gratuita agora mesmo?*
Envie uma foto ou PDF de qualquer **boleto ou nota fiscal** aqui nesta conversa.

Em menos de 15 segundos, nosso robô com inteligência artificial vai:
1️⃣ Ler e auditar todos os dados do seu documento;
2️⃣ Entregar o código de barras limpo para você pagar no seu banco;
3️⃣ Calcular o vencimento exato e gerar uma dica de fluxo de caixa!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *Já quer assinar seu plano direto pelo WhatsApp?*
• *AnalisAí Start* (R$ 39,90/mês): ${ASAAS_PLANS.monthly.start.checkoutUrl}
• *AnalisAí Solo* (R$ 87,99/mês - Áudio & IA de Caixa): ${ASAAS_PLANS.monthly.solo.checkoutUrl}
• *AnalisAí Solo Plus* (R$ 157,99/mês): ${ASAAS_PLANS.monthly.solo_plus.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Já é cliente e trocou de número?*
Envie seu **CPF ou CNPJ cadastrado** nesta conversa para transferir sua conta com segurança via verificação por e-mail (LGPD).`;
}

/**
 * Mensagem quando o lead já utilizou sua degustação gratuita de 1 documento
 */
export function getTrialLimitReachedMessage(): string {
  return `🎁 *Sua degustação gratuita já foi utilizada com sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para continuar organizando todos os seus boletos e notas fiscais, receber avisos diários antes dos vencimentos e contar com consultoria financeira sem planilhas, escolha seu plano:

1️⃣ *AnalisAí Start* — R$ 39,90/mês
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}
_(Até 30 documentos/mês, leitura automática e status financeiro)_

2️⃣ *AnalisAí Solo* — R$ 87,99/mês ⭐ *Mais Escolhido*
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}
_(Até 80 documentos/mês, comandos de voz por áudio e consultor de caixa)_

3️⃣ *AnalisAí Solo Plus* — R$ 157,99/mês
👉 ${ASAAS_PLANS.monthly.solo_plus.checkoutUrl}
_(Até 200 documentos/mês, suporte contábil prioritário e máxima potência)_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *A ativação é automática e instantânea logo após o pagamento no Asaas!*
Dúvidas? Pode perguntar por aqui!`;
}

/**
 * Formata o resumo do documento processado na degustação gratuita
 */
export function formatTrialDocSummary(doc: any): string {
  const dueInfo = doc.due_date ? formatDueDateDetails(doc.due_date) : 'Não identificado';
  const valFormatted = doc.amount
    ? Number(doc.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Não identificado';

  let txt = `📄 *Análise Documental Concluída — Degustação AnalisAí*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `🏢 *Cedente/Fornecedor:* ${doc.supplier_name || 'Não identificado'}\n`;
  txt += `📑 *Tipo de Documento:* ${doc.document_type || 'Boleto/Conta'}\n`;
  txt += `💰 *Valor:* ${valFormatted}\n`;
  txt += `📅 *Vencimento:* ${dueInfo}\n`;
  if (doc.category) {
    txt += `📂 *Categoria:* ${doc.category}\n`;
  }
  txt += `\n💡 *Dica Inteligente do AnalisAí:* Conta cadastrada com sucesso! Recomendamos programar o pagamento com 1 dia de antecedência para evitar juros e manter seu score bancário positivo.`;

  return txt;
}

/**
 * Menu de conversão e contratação enviado logo após a degustação do documento
 */
export function getTrialConversionMenu(): string {
  return `✨ *Gostou da velocidade e precisão? Esse é só o começo!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Imagine nunca mais digitar um código de barras, receber avisos diários no seu WhatsApp para não esquecer vencimentos e comandar todo o seu fluxo de caixa por áudio.

🚀 *Escolha seu plano e ative seu assistente contábil agora mesmo:*

1️⃣ *AnalisAí Start* (R$ 39,90/mês)
• 30 documentos/mês
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}

2️⃣ *AnalisAí Solo* (R$ 87,99/mês) ⭐ *Mais Escolhido*
• 80 docs/mês + Comandos por Áudio + Consultor de Caixa
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}

3️⃣ *AnalisAí Solo Plus* (R$ 157,99/mês)
• 200 documentos/mês + Suporte VIP
👉 ${ASAAS_PLANS.monthly.solo_plus.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Precisa de ajuda ou tem dúvidas? Pode responder aqui mesmo!*`;
}
