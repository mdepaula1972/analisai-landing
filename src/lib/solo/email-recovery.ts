import { createServiceRoleClient } from '@/lib/supabase-server';
import { addMinutes } from 'date-fns';

/**
 * Inicia a recuperação de e-mail por Prova Social via Supabase Auth (OAuth Google/Apple)
 * Elimina qualquer fragilidade de dados públicos de CNPJ da Receita Federal!
 */
export async function iniciarDesafioRecuperacaoEmail(
  phoneOrClientId: string,
  rawNovoEmail: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const cleanEmail = rawNovoEmail.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return {
      success: false,
      message: `⚠️ Por favor, informe um endereço de e-mail novo válido.\nExemplo: *!recuperaremail financeiro@novodominio.com.br*`,
    };
  }

  const cleanPhone = phoneOrClientId.replace(/\D/g, '');
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number, email')
    .or(`id.eq.${phoneOrClientId},whatsapp_number.ilike.%${cleanPhone}%`)
    .limit(1)
    .single();

  if (!client) {
    return {
      success: false,
      message: `❌ Perfil de cliente não localizado. Por favor, entre em contato com o suporte da Solucione.`,
    };
  }

  // Cancela pendências anteriores de recuperação
  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'expired' })
    .eq('client_id', client.id)
    .eq('action_type', 'social_email_recovery')
    .eq('status', 'pending');

  // Cria a solicitação pendente de Prova Social com token seguro
  const { data: newPending, error: insErr } = await supabase
    .from('bot_action_confirmations')
    .insert({
      client_id: client.id,
      phone_number: client.whatsapp_number,
      action_type: 'social_email_recovery',
      status: 'pending',
      expires_at: addMinutes(new Date(), 15).toISOString(),
      proposed_payload: {
        novo_email: cleanEmail,
        email_antigo: client.email,
        client_name: client.name,
      },
    })
    .select('id')
    .single();

  if (insErr || !newPending) {
    console.error('[Social Email Recovery Insert Error]:', insErr);
    return {
      success: false,
      message: `⚠️ Ocorreu uma instabilidade ao gerar seu link seguro. Tente novamente em instantes.`,
    };
  }

  const recoveryUrl = `https://analisai.me/recuperar?token=${newPending.id}`;

  return {
    success: true,
    message: `🔐 *Recuperação de Acesso por Prova Social (Supabase Auth)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para garantir total blindagem contra golpistas e ex-funcionários que tenham acesso a dados públicos da sua empresa, sua titularidade é comprovada via **Prova Social Oficial (Google / Apple)**.

👉 Toque no link seguro abaixo para autenticar:
${recoveryUrl}

⏱️ *Validade:* 15 minutos.
🛡️ Apenas você, com a biometria/senha da sua conta pessoal no celular, consegue aprovar esta recuperação!

_(Assim que autenticar, seu e-mail será atualizado automaticamente e avisaremos você aqui!)_`,
  };
}

/**
 * Processador de respostas de fallback ou cancelamento
 */
export async function processarRespostaDesafioEmail(
  phoneOrClientId: string,
  rawResposta: string
): Promise<{ handled: boolean; message?: string }> {
  const clean = rawResposta.trim().toLowerCase();
  if (clean === '!cancelarrecuperacao' || clean === '/cancelarrecuperacao' || clean === 'cancelar') {
    const supabase = createServiceRoleClient();
    const cleanPhone = phoneOrClientId.replace(/\D/g, '');

    await supabase
      .from('bot_action_confirmations')
      .update({ status: 'rejected' })
      .eq('action_type', 'social_email_recovery')
      .eq('status', 'pending')
      .or(`client_id.eq.${phoneOrClientId},phone_number.ilike.%${cleanPhone}%`);

    return {
      handled: true,
      message: `🛡️ *Solicitação de Recuperação por Prova Social Cancelada!*
Sua conta permanece protegida e inalterada.`,
    };
  }

  return { handled: false };
}
