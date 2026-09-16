import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { ADMIN_PERSONAL_WHATSAPP } from '@/lib/solo/constants';
import { format } from 'date-fns';

export interface FeedbackData {
  phone: string;
  message: string;
  clientId?: string | null;
  clientName?: string | null;
  type?: 'sugestao' | 'critica' | 'elogio' | 'outro';
}

/**
 * Registra o feedback ou sugestão do cliente no banco de dados
 * e envia alerta IMEDIATO para o WhatsApp pessoal do Marcos (administrador)
 */
export async function recordClientFeedback(data: FeedbackData): Promise<{
  success: boolean;
  userReply: string;
}> {
  const supabase = createServiceRoleClient();
  const cleanPhone = data.phone.replace(/\D/g, '');

  // 1. Identifica se existe cliente vinculado
  let clientId = data.clientId || null;
  let clientName = data.clientName || null;

  if (!clientId || !clientName) {
    const { data: c } = await supabase
      .from('clients')
      .select('id, name')
      .eq('whatsapp_number', cleanPhone)
      .maybeSingle();

    if (c) {
      clientId = c.id;
      clientName = clientName || c.name;
    }
  }

  // Se ainda não achou nome, tenta em trial_leads
  if (!clientName) {
    const { data: t } = await supabase
      .from('trial_leads')
      .select('company_name')
      .eq('whatsapp_number', cleanPhone)
      .maybeSingle();

    clientName = t?.company_name || 'Cliente WhatsApp';
  }

  // 2. Classifica tipo de feedback se não informado
  let feedbackType: 'sugestao' | 'critica' | 'elogio' | 'outro' = data.type || 'sugestao';
  const lower = data.message.toLowerCase();
  if (lower.includes('critica') || lower.includes('reclama') || lower.includes('ruim') || lower.includes('erro') || lower.includes('falha') || lower.includes('problema')) {
    feedbackType = 'critica';
  } else if (lower.includes('elogio') || lower.includes('parabens') || lower.includes('excelente') || lower.includes('otimo') || lower.includes('maravilha')) {
    feedbackType = 'elogio';
  }

  // 3. Salva no banco de dados na tabela client_feedbacks
  const { data: inserted, error: insertError } = await supabase
    .from('client_feedbacks')
    .insert({
      client_id: clientId,
      whatsapp_number: cleanPhone,
      client_name: clientName,
      feedback_type: feedbackType,
      message: data.message.trim(),
      status: 'pending',
    })
    .select('id, created_at')
    .single();

  if (insertError) {
    console.error('[Feedback] Erro ao registrar feedback no Supabase:', insertError);
  }

  // 4. Envia notificação imediata no WhatsApp pessoal do Marcos (Administrador)
  try {
    const dataHoraStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const emojiType = feedbackType === 'critica' ? '⚠️ CRÍTICA' : feedbackType === 'elogio' ? '⭐ ELOGIO' : '💡 SUGESTÃO';

    const adminAlertText = `📬 *Novo Feedback de Cliente no AnalisAí!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Tipo:* ${emojiType}
👤 *Cliente:* ${clientName}
📱 *WhatsApp:* wa.me/${cleanPhone}
📅 *Data/Hora:* ${dataHoraStr}

📝 *Mensagem Registrada:*
"${data.message.trim()}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Salvo no banco de dados (ID: ${inserted?.id || 'salvo'}) para sua avaliação direta._`;

    await sendEvolutionText({
      phone: ADMIN_PERSONAL_WHATSAPP,
      text: adminAlertText,
    });
  } catch (notifErr) {
    console.error('[Feedback] Erro ao notificar administrador no WhatsApp:', notifErr);
  }

  // 5. Retorna resposta carinhosa e profissional para o cliente
  const userReply = `🙏 *Muito obrigado pela sua mensagem!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A sua opinião é fundamental para a constante evolução do AnalisAí.

A sua ${feedbackType === 'critica' ? 'crítica construtiva' : feedbackType === 'elogio' ? 'mensagem carinhosa' : 'sugestão'} foi registrada no nosso sistema e encaminhada **diretamente para a diretoria analisar**.

Se for algo que exija retorno, nossa equipe entrará em contato com você em breve! Conte sempre conosco.`;

  return { success: true, userReply };
}

/**
 * Detecta se uma mensagem do usuário expressa intenção de dar crítica ou sugestão
 */
export function isFeedbackMessage(text: string): { isFeedback: boolean; cleanMessage: string } {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Comandos diretos: !feedback, !sugestao, !critica, !sugestão, !crítica
  const cmdMatch = trimmed.match(/^!(sugestao|sugestão|critica|crítica|feedback|reclamacao|reclamação)\s*(.*)/i);
  if (cmdMatch) {
    const content = cmdMatch[2].trim();
    return { isFeedback: true, cleanMessage: content || trimmed };
  }

  // Frases naturais que indicam registro de feedback
  const feedbackPhrases = [
    'quero dar uma sugestao',
    'quero dar uma sugestão',
    'tenho uma sugestao',
    'tenho uma sugestão',
    'minha sugestao e',
    'minha sugestão é',
    'tenho uma critica',
    'tenho uma crítica',
    'quero fazer uma critica',
    'quero fazer uma crítica',
    'quero deixar um feedback',
    'gostaria de sugerir',
    'poderiam melhorar',
    'uma melhoria seria',
    'deixo como sugestao',
    'deixo como sugestão',
  ];

  for (const phrase of feedbackPhrases) {
    if (lower.includes(phrase)) {
      return { isFeedback: true, cleanMessage: trimmed };
    }
  }

  return { isFeedback: false, cleanMessage: '' };
}
