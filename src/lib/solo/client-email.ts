import { createServiceRoleClient } from '@/lib/supabase-server';
import { enviarCodigo2FATrocaEmail } from '@/lib/email';
import { addMinutes } from 'date-fns';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

async function resolveClient(phoneOrClientId: string) {
  const supabase = createServiceRoleClient();
  const cleanDigits = phoneOrClientId.replace(/\D/g, '');

  if (phoneOrClientId.includes('-') && phoneOrClientId.length > 20) {
    const { data } = await supabase.from('clients').select('*').eq('id', phoneOrClientId).maybeSingle();
    if (data) return data;
  }

  const { data } = await supabase
    .from('clients')
    .select('*')
    .or(`whatsapp_number.eq.${cleanDigits},whatsapp_number.eq.55${cleanDigits}`)
    .maybeSingle();

  return data;
}

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

  const client = await resolveClient(phoneOrClientId);
  if (!client) {
    return {
      success: false,
      requires2FA: false,
      message: `⚠️ Cliente não localizado para atualizar e-mail.`,
    };
  }

  if (client.email && client.email.toLowerCase() === cleanEmail) {
    return {
      success: true,
      requires2FA: false,
      message: `ℹ️ O e-mail \`${cleanEmail}\` já é o e-mail oficial cadastrado na sua conta.`,
    };
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'expired' })
    .eq('client_id', client.id)
    .eq('action_type', 'change_email')
    .eq('status', 'pending');

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
      extracted_payload: {
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
Para proteger sua empresa, o e-mail de segurança só pode ser alterado mediante autorização enviada para o seu **e-mail ATUAL**:
📧 *${maskedCurrent}*

👉 Digite o código de 6 dígitos recebido no e-mail atual:
*!confirmaremail CÓDIGO* (ou envie apenas os 6 dígitos)

⏱️ *Validade:* 10 minutos.`,
    };
  }

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
    extracted_payload: {
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

Digite o código aqui no WhatsApp para confirmar:
*!confirmaremail CÓDIGO* (ou envie apenas os 6 dígitos)

⏱️ *Validade:* 10 minutos.`,
  };
}

export async function confirmarAlteracaoEmail(
  phoneOrClientId: string,
  rawOtp: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const cleanOtp = rawOtp.replace(/\D/g, '').trim();

  if (cleanOtp.length !== 6) {
    return {
      success: false,
      message: `⚠️ O código de segurança deve ter exatamente 6 dígitos numéricos.\nExemplo: *!confirmaremail 729184*`,
    };
  }

  const client = await resolveClient(phoneOrClientId);
  if (!client) {
    return { success: false, message: 'Cliente não localizado.' };
  }

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
Não encontramos nenhuma solicitação aguardando confirmação (ou o prazo expirou).
Envie: *!email novo_email@empresa.com*`,
    };
  }

  const payload = (pending.extracted_payload || pending.proposed_payload) as any;

  if (payload?.otp_code !== cleanOtp) {
    return {
      success: false,
      message: `❌ *Código de Segurança Incorreto!*
O código de 6 dígitos digitado não confere. Verifique sua caixa de entrada e tente novamente.`,
    };
  }

  const novoEmail = payload.novo_email;

  await supabase
    .from('clients')
    .update({ email: novoEmail })
    .eq('id', client.id);

  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'confirmed' })
    .eq('id', pending.id);

  return {
    success: true,
    message: `✅ *E-mail de Segurança Atualizado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seu novo e-mail oficial:
👉 \`${novoEmail}\``,
  };
}

export async function cancelarAlteracaoEmail(
  phoneOrClientId: string
): Promise<string> {
  const supabase = createServiceRoleClient();
  const client = await resolveClient(phoneOrClientId);
  if (client) {
    await supabase
      .from('bot_action_confirmations')
      .update({ status: 'cancelled' })
      .eq('client_id', client.id)
      .eq('action_type', 'change_email')
      .eq('status', 'pending');
  }

  return `🛡️ *Solicitação de Alteração de E-mail Cancelada!*
O e-mail anterior permanece mantido sem qualquer modificação.`;
}

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
