import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { ADMIN_PERSONAL_WHATSAPP } from '@/lib/solo/constants';

export interface AntiLoopCheckResult {
  allowed: boolean;
  reason?: 'permanent_blocked' | 'temporarily_blocked' | 'silenced' | 'appeal_received';
  userMessage?: string;
}

/**
 * Níveis da Escada de Bloqueio Progressivo:
 * Nível 1: 3 tentativas -> Encerramento com silêncio de 15 minutos
 * Nível 2: 2 tentativas -> Encerramento com silêncio de 30 minutos
 * Nível 3: 1 tentativa  -> Bloqueio do Dia (24 horas)
 * Nível 4: 1 tentativa  -> Bloqueio de 7 Dias (1 semana)
 * Nível 5: 1 tentativa  -> Bloqueio de 30 Dias (1 mês)
 * Nível 6: 1 tentativa  -> Bloqueio Definitivo + Ouvidoria/Admin
 */
export function getMaxAttemptsForLevel(level: number): number {
  if (level <= 1) return 3;
  if (level === 2) return 2;
  return 1; // Níveis 3, 4, 5 e 6 toleram apenas 1 tentativa infrutífera
}

/**
 * 1. Verifica se a mensagem de entrada é permitida ou se o número está bloqueado/silenciado
 */
export async function checkAntiLoopStatus(
  phone: string,
  rawText: string
): Promise<AntiLoopCheckResult> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();

  const { data: record } = await supabase
    .from('bot_loop_tracking')
    .select('*')
    .eq('whatsapp_number', cleanPhone)
    .maybeSingle();

  if (!record) {
    return { allowed: true };
  }

  const now = new Date();
  const isPermanent = record.is_permanent_blocked;
  const isTempBlocked = record.blocked_until && new Date(record.blocked_until) > now;
  const isSilenced = record.silenced_until && new Date(record.silenced_until) > now;

  // 1.1 Trata solicitação formal de recurso/desbloqueio
  const isAppeal = lower.startsWith('desbloqueio') || lower.startsWith('desbloquear');
  if (isAppeal && (isPermanent || isTempBlocked)) {
    const appealText = trimmed.replace(/^(desbloqueio|desbloquear)\s*:?\s*/i, '').trim() || 'Sem justificativa informada.';

    await supabase
      .from('bot_loop_tracking')
      .update({
        appeal_message: appealText,
        appeal_status: 'pending_admin',
        updated_at: now.toISOString(),
      })
      .eq('whatsapp_number', cleanPhone);

    // Alerta imediato no WhatsApp pessoal do Marcos (Fundador)
    try {
      const adminAlert = `🚨 *Solicitação de Desbloqueio Recebida (Anti-Looping)!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 *Número:* wa.me/${cleanPhone}
📊 *Nível do Bloqueio:* ${isPermanent ? 'Definitivo (Nível 6)' : `Temporário até ${new Date(record.blocked_until).toLocaleDateString('pt-BR')}`}
📝 *Justificativa do Usuário:*
"${appealText}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 Para autorizar o desbloqueio agora, responda:
*!desbloquear ${cleanPhone}*`;

      await sendEvolutionText({
        phone: ADMIN_PERSONAL_WHATSAPP,
        text: adminAlert,
      });
    } catch (notifErr) {
      console.error('[AntiLoop] Erro ao notificar admin sobre apelação:', notifErr);
    }

    const reply = `📬 *Solicitação de Desbloqueio Registrada!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sua mensagem foi encaminhada à nossa diretoria para análise manual.
Assim que o administrador avaliar, você receberá a confirmação aqui!`;

    await sendEvolutionText({ phone: cleanPhone, text: reply });
    return { allowed: false, reason: 'appeal_received', userMessage: reply };
  }

  // 1.2 Bloqueio Permanente ativo -> Silêncio absoluto para evitar ping-pong
  if (isPermanent) {
    return { allowed: false, reason: 'permanent_blocked' };
  }

  // 1.3 Bloqueio Temporal ativo (Dia, Semana ou Mês) -> Silêncio absoluto
  if (isTempBlocked) {
    return { allowed: false, reason: 'temporarily_blocked' };
  }

  // 1.4 Silêncio de Encerramento recente (15 a 30 min) -> Silêncio absoluto
  if (isSilenced) {
    return { allowed: false, reason: 'silenced' };
  }

  return { allowed: true };
}

/**
 * 2. Registra uma tentativa infrutífera (mensagem repetitiva ou sem intenção contábil/documental válida)
 * Avança na Escada de Bloqueio Progressivo conforme as regras de negócio
 */
export async function recordFruitlessAttempt(
  phone: string,
  rawText: string
): Promise<{ level: number; attempts: number; actionTaken: string }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');
  const now = new Date();

  // Busca ou cria registro
  let { data: record } = await supabase
    .from('bot_loop_tracking')
    .select('*')
    .eq('whatsapp_number', cleanPhone)
    .maybeSingle();

  if (!record) {
    const { data: created } = await supabase
      .from('bot_loop_tracking')
      .insert({
        whatsapp_number: cleanPhone,
        cycle_level: 1,
        current_attempts: 0,
        last_message_text: rawText.slice(0, 300),
      })
      .select('*')
      .maybeSingle();
    record = created || { cycle_level: 1, current_attempts: 0 };
  }

  const currentLevel = record?.cycle_level || 1;
  const newAttempts = (record.current_attempts || 0) + 1;
  const maxAllowed = getMaxAttemptsForLevel(currentLevel);

  // Ainda não atingiu o limite do nível atual
  if (newAttempts < maxAllowed) {
    await supabase
      .from('bot_loop_tracking')
      .update({
        current_attempts: newAttempts,
        last_message_text: rawText.slice(0, 300),
        last_message_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('whatsapp_number', cleanPhone);

    return { level: currentLevel, attempts: newAttempts, actionTaken: 'increment' };
  }

  // Atingiu o limite do nível -> Aplica penalidade da escada progressiva
  let nextLevel = currentLevel + 1;
  let silencedUntil: string | null = null;
  let blockedUntil: string | null = null;
  let isPermanent = false;
  let alertMessage = '';
  let actionTaken = '';

  switch (currentLevel) {
    case 1: {
      // Nível 1: 3 tentativas -> Encerramento com silêncio de 15 minutos
      actionTaken = 'closed_cycle_1';
      silencedUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      alertMessage = `Percebi que não conseguimos avançar por aqui no momento. Para poupar seu tempo e evitar mensagens repetitivas, este atendimento foi encerrado temporariamente.

Quando precisar, basta nos chamar novamente com uma mensagem clara sobre o que deseja fazer! 😊`;
      break;
    }
    case 2: {
      // Nível 2: 2 tentativas -> Encerramento com silêncio de 30 minutos
      actionTaken = 'closed_cycle_2';
      silencedUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
      alertMessage = `Atendimento encerrado temporariamente para evitar repetições automáticas.`;
      break;
    }
    case 3: {
      // Nível 3: 1 tentativa -> Bloqueio do Dia (24 horas)
      actionTaken = 'blocked_day';
      blockedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      alertMessage = `⚠️ *Limite de tentativas consecutivas atingido.*
Por segurança, nosso atendimento automático para este número está pausado até amanhã.`;
      break;
    }
    case 4: {
      // Nível 4: 1 tentativa -> Bloqueio de 7 Dias (1 semana)
      actionTaken = 'blocked_week';
      blockedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      alertMessage = `⚠️ *Atendimento pausado por 7 dias* devido a repetições automáticas frequentes detectadas.`;
      break;
    }
    case 5: {
      // Nível 5: 1 tentativa -> Bloqueio de 30 Dias (1 mês)
      actionTaken = 'blocked_month';
      blockedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      alertMessage = `⚠️ *Atendimento pausado por 30 dias* devido a reincidência de loops automáticos.`;
      break;
    }
    default: {
      // Nível 6+: 1 tentativa -> Bloqueio Definitivo + Ouvidoria/Admin
      actionTaken = 'blocked_permanent';
      isPermanent = true;
      nextLevel = 6;
      alertMessage = `🚫 *Atendimento suspenso definitivamente* por detecção de comportamento de automação/loop repetitivo.

Para solicitar o desbloqueio manual, envie a palavra *DESBLOQUEIO* acompanhada da sua justificativa para análise da diretoria.`;
      break;
    }
  }

  // Atualiza banco de dados
  await supabase
    .from('bot_loop_tracking')
    .update({
      cycle_level: nextLevel,
      current_attempts: 0,
      silenced_until: silencedUntil,
      blocked_until: blockedUntil,
      is_permanent_blocked: isPermanent,
      last_message_text: rawText.slice(0, 300),
      last_message_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('whatsapp_number', cleanPhone);

  // Envia a mensagem de encerramento/bloqueio ao usuário
  if (alertMessage) {
    try {
      await sendEvolutionText({ phone: cleanPhone, text: alertMessage });
    } catch (sendErr) {
      console.error('[AntiLoop] Erro ao enviar mensagem de bloqueio:', sendErr);
    }
  }

  return { level: nextLevel, attempts: 0, actionTaken };
}

/**
 * 3. Zera tentativas ativas quando o usuário envia um documento, comando ou intenção financeira válida
 */
export async function resetAntiLoopAttempts(phone: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');

  await supabase
    .from('bot_loop_tracking')
    .update({
      current_attempts: 0,
      silenced_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('whatsapp_number', cleanPhone)
    .eq('is_permanent_blocked', false);
}

/**
 * 4. Desbloqueio soberano realizado pelo Marcos (Administrador)
 */
export async function unblockNumberByAdmin(targetPhone: string): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = createServiceRoleClient();
  const cleanPhone = targetPhone.replace(/\D/g, '');

  const { data: record } = await supabase
    .from('bot_loop_tracking')
    .select('*')
    .eq('whatsapp_number', cleanPhone)
    .maybeSingle();

  if (!record) {
    return {
      success: false,
      message: `Número ${cleanPhone} não encontrado nos registros de anti-looping.`,
    };
  }

  await supabase
    .from('bot_loop_tracking')
    .update({
      cycle_level: 1,
      current_attempts: 0,
      silenced_until: null,
      blocked_until: null,
      is_permanent_blocked: false,
      appeal_status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('whatsapp_number', cleanPhone);

  // Envia mensagem cordial ao cliente informado o desbloqueio
  try {
    await sendEvolutionText({
      phone: cleanPhone,
      text: `🎉 *Atendimento Restabelecido!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O seu número foi desbloqueado com sucesso pela nossa diretoria.
Você já pode enviar comprovantes, notas fiscais ou consultar seus resumos financeiros normalmente!`,
    });
  } catch (err) {
    console.error('[AntiLoop] Erro ao avisar cliente sobre desbloqueio:', err);
  }

  return {
    success: true,
    message: `✅ *Número ${cleanPhone} desbloqueado com sucesso!*\nA escada de ciclos foi reiniciada para o Nível 1 e o cliente foi notificado.`,
  };
}

/**
 * 5. Lista números suspensos ou em apelação
 */
export async function listActiveBotBlocks(): Promise<string> {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: blocks } = await supabase
    .from('bot_loop_tracking')
    .select('*')
    .or(`is_permanent_blocked.eq.true,blocked_until.gt.${now},appeal_status.eq.pending_admin`)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (!blocks || blocks.length === 0) {
    return '🛡️ *Nenhum número bloqueado ou em apelação no momento.* Todos os clientes estão operando normalmente.';
  }

  let text = `🛡️ *Relatório de Bloqueios Anti-Looping (${blocks.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  for (const b of blocks) {
    const isPerm = b.is_permanent_blocked;
    const isApp = b.appeal_status === 'pending_admin';
    const statusStr = isPerm ? '🚫 Bloqueio Definitivo' : isApp ? '📬 Recurso Pendente' : `⏳ Pausado até ${new Date(b.blocked_until).toLocaleDateString('pt-BR')}`;
    text += `• *wa.me/${b.whatsapp_number}* [Nível ${b.cycle_level}]:\n  ↳ Status: ${statusStr}\n`;
    if (b.appeal_message) {
      text += `  ↳ Justificativa: "${b.appeal_message}"\n`;
    }
    text += `  👉 Para liberar: \`!desbloquear ${b.whatsapp_number}\`\n\n`;
  }

  return text;
}
