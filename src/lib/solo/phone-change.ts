import { createServiceRoleClient } from '@/lib/supabase-server';
import { enviarCodigo2FATrocaNumero, notificarTrocaNumeroConcluida } from '@/lib/email';
import { addMinutes } from 'date-fns';

/**
 * Utilitário para mascarar e-mail em conformidade estrita com a LGPD
 * Exemplo: 1972marcosantonio@gmail.com -> 1***o@gmail.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'e-mail cadastrado';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}***@${domain}`;
  }
  const first = user.slice(0, 2);
  const last = user.slice(-1);
  return `${first}***${last}@${domain}`;
}

export interface SolicitacaoTrocaResult {
  sucesso: boolean;
  motivo?: 'cliente_nao_encontrado' | 'sem_email_cadastrado' | 'erro_envio_email';
  clientName?: string;
  maskedEmail?: string;
  erro?: string;
}

/**
 * Inicia o desafio de segurança 2FA para troca de número de WhatsApp
 */
export async function solicitarTrocaNumeroCom2FA(newPhone: string, taxId: string): Promise<SolicitacaoTrocaResult> {
  const supabase = createServiceRoleClient();
  const cleanDoc = taxId.replace(/\D/g, '');

  // 1. Busca cliente por CPF/CNPJ
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email, whatsapp_number, tax_id')
    .eq('tax_id', cleanDoc)
    .maybeSingle();

  if (!client) {
    return { sucesso: false, motivo: 'cliente_nao_encontrado' };
  }

  // 2. Verifica se o cliente possui e-mail cadastrado
  if (!client.email || !client.email.trim()) {
    return {
      sucesso: false,
      motivo: 'sem_email_cadastrado',
      clientName: client.name,
    };
  }

  // 3. Gera código OTP seguro de 6 dígitos numéricos
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = addMinutes(new Date(), 10).toISOString();

  // Invalida tokens anteriores não usados para este telefone ou cliente
  await supabase
    .from('phone_change_tokens')
    .update({ used: true })
    .or(`new_phone.eq.${newPhone},client_id.eq.${client.id}`)
    .eq('used', false);

  // Insere novo token no banco
  const { error: insertErr } = await supabase
    .from('phone_change_tokens')
    .insert({
      client_id: client.id,
      new_phone: newPhone,
      token: otpCode,
      attempts: 0,
      used: false,
      expires_at: expiresAt,
    });

  if (insertErr) {
    console.error('[2FA Troca de Número] Erro ao gravar token:', insertErr);
    return { sucesso: false, erro: 'Falha ao gerar token de segurança' };
  }

  // 4. Dispara e-mail com o código de 6 dígitos via Resend
  const emailRes = await enviarCodigo2FATrocaNumero({
    emailDestino: client.email,
    nomeCliente: client.name,
    codigoOtp: otpCode,
    novoTelefone: newPhone,
  });

  if (!emailRes.sucesso) {
    console.error('[2FA Troca de Número] Falha no disparo do e-mail:', emailRes.erro);
    return { sucesso: false, motivo: 'erro_envio_email', erro: emailRes.erro };
  }

  return {
    sucesso: true,
    clientName: client.name,
    maskedEmail: maskEmail(client.email),
  };
}

export interface ValidacaoTrocaResult {
  valido: boolean;
  motivo?: 'sem_solicitacao' | 'bloqueado_tentativas' | 'codigo_incorreto' | 'expirado';
  clientName?: string;
  tentativasRestantes?: number;
}

/**
 * Valida o código OTP de 6 dígitos e efetiva a troca do número com conformidade LGPD
 */
export async function validarCodigo2FATrocaNumero(phone: string, token: string): Promise<ValidacaoTrocaResult> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // Busca token ativo mais recente para este número
  const { data: tokenRecord } = await supabase
    .from('phone_change_tokens')
    .select('id, client_id, token, attempts, used, expires_at')
    .or(`new_phone.eq.${cleanPhone},new_phone.eq.${altPhone}`)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRecord) {
    return { valido: false, motivo: 'sem_solicitacao' };
  }

  // Verifica expiração
  if (new Date(tokenRecord.expires_at) < new Date()) {
    await supabase.from('phone_change_tokens').update({ used: true }).eq('id', tokenRecord.id);
    return { valido: false, motivo: 'expirado' };
  }

  // Verifica limite de tentativas (máximo 3)
  if (tokenRecord.attempts >= 3) {
    await supabase.from('phone_change_tokens').update({ used: true }).eq('id', tokenRecord.id);
    return { valido: false, motivo: 'bloqueado_tentativas' };
  }

  // Código incorreto
  if (tokenRecord.token !== token.trim()) {
    const newAttempts = (tokenRecord.attempts || 0) + 1;
    const isExhausted = newAttempts >= 3;
    await supabase
      .from('phone_change_tokens')
      .update({
        attempts: newAttempts,
        used: isExhausted,
      })
      .eq('id', tokenRecord.id);

    return {
      valido: false,
      motivo: isExhausted ? 'bloqueado_tentativas' : 'codigo_incorreto',
      tentativasRestantes: Math.max(0, 3 - newAttempts),
    };
  }

  // Código CORRETO! Atualiza o número do WhatsApp na tabela clients
  const { data: updatedClient } = await supabase
    .from('clients')
    .update({ whatsapp_number: cleanPhone })
    .eq('id', tokenRecord.client_id)
    .select('id, name, email')
    .single();

  // Queima o token
  await supabase.from('phone_change_tokens').update({ used: true }).eq('id', tokenRecord.id);

  // Dispara e-mail de notificação de segurança se o cliente tiver e-mail
  if (updatedClient?.email) {
    try {
      await notificarTrocaNumeroConcluida({
        emailDestino: updatedClient.email,
        nomeCliente: updatedClient.name,
        novoTelefone: cleanPhone,
      });
    } catch (notifErr) {
      console.warn('[2FA Troca de Número] Erro ao enviar aviso de conclusão:', notifErr);
    }
  }

  return {
    valido: true,
    clientName: updatedClient?.name || 'Cliente',
  };
}
