import { createServiceRoleClient } from '@/lib/supabase-server';
import { addMinutes } from 'date-fns';
import { enviarCodigo2FATrocaEmail } from '@/lib/email';
import { maskEmail } from './referral';

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Inicia o desafio cadastral oficial da Receita Federal para recuperação de e-mail
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
    .select('id, name, whatsapp_number, email, tax_id')
    .or(`id.eq.${phoneOrClientId},whatsapp_number.ilike.%${cleanPhone}%`)
    .limit(1)
    .single();

  if (!client) {
    return {
      success: false,
      message: `❌ Perfil de cliente não localizado. Por favor, entre em contato com o suporte da Solucione.`,
    };
  }

  const cleanTaxId = (client.tax_id || '').replace(/\D/g, '');
  if (!cleanTaxId || cleanTaxId.length !== 14) {
    return {
      success: false,
      message: `⚠️ *Recuperação Automatizada Indisponível:*
Não identificamos um CNPJ de 14 dígitos registrado na sua conta para consulta oficial na Receita Federal.

Por favor, solicite a atualização diretamente ao suporte humano da Solucione pelo WhatsApp oficial.`,
    };
  }

  // Consulta dados oficiais do CNPJ na BrasilAPI
  let anoFundacao = '';
  const sociosValidos: string[] = [];

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanTaxId}`, {
      headers: { 'User-Agent': 'AnalisAI-TaxEngine/2.4' },
    });
    if (res.ok) {
      const cnpjData = await res.json();
      if (cnpjData.data_inicio_atividade) {
        anoFundacao = cnpjData.data_inicio_atividade.split('-')[0].trim();
      }
      if (Array.isArray(cnpjData.qsa)) {
        for (const socio of cnpjData.qsa) {
          const nome = socio.nome_socio || socio.nome || '';
          const primeiroNome = normalizeText(nome.split(' ')[0] || '');
          if (primeiroNome) sociosValidos.push(primeiroNome);
        }
      }
    }
  } catch (err) {
    console.warn('[Email Recovery] Falha ao consultar BrasilAPI:', err);
  }

  // Fallback caso a BrasilAPI não retorne QSA
  if (sociosValidos.length === 0 && client.name) {
    const primeiroNomeCliente = normalizeText(client.name.split(' ')[0] || '');
    if (primeiroNomeCliente) sociosValidos.push(primeiroNomeCliente);
  }

  if (!anoFundacao) {
    // Se a consulta pública estiver instável, orienta suporte
    return {
      success: false,
      message: `⚠️ O serviço da Receita Federal está momentaneamente instável para validação automática do CNPJ.
Por favor, entre em contato direto com o suporte da Solucione para atualização soberana do e-mail.`,
    };
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Expira desafios anteriores
  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'expired' })
    .eq('client_id', client.id)
    .eq('action_type', 'email_recovery_challenge')
    .eq('status', 'pending');

  // Cria o desafio cadastral no banco
  const { error: insErr } = await supabase.from('bot_action_confirmations').insert({
    client_id: client.id,
    phone_number: client.whatsapp_number,
    action_type: 'email_recovery_challenge',
    status: 'pending',
    expires_at: addMinutes(new Date(), 15).toISOString(),
    proposed_payload: {
      novo_email: cleanEmail,
      etapa_atual: 1,
      tentativas_restantes: 3,
      ano_fundacao: anoFundacao,
      socios_validos: sociosValidos,
      otp_code: otpCode,
      client_name: client.name,
      email_antigo: client.email,
    },
  });

  if (insErr) {
    console.error('[Email Recovery Insert Error]:', insErr);
    return {
      success: false,
      message: `⚠️ Instabilidade temporária. Tente novamente em instantes.`,
    };
  }

  return {
    success: true,
    message: `🔐 *Recuperação de Conta por Desafio Cadastral (Receita Federal)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Como você perdeu o acesso ao e-mail anterior, vamos comprovar sua legitimidade através de **2 perguntas cadastrais oficiais** vinculadas ao CNPJ da sua empresa:

📝 *Pergunta 1 de 2:*
Qual o **ano de abertura da sua empresa** conforme o registro oficial da Receita Federal? (Exemplo: 2018)

⏱️ *Validade:* 15 minutos (até 3 tentativas).
_(Para cancelar a qualquer momento, digite: *!cancelarrecuperacao* ou *cancelar*)_`,
  };
}

/**
 * Processa as respostas do usuário ao desafio cadastral da Receita Federal
 */
export async function processarRespostaDesafioEmail(
  phoneOrClientId: string,
  rawResposta: string
): Promise<{ handled: boolean; message?: string }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phoneOrClientId.replace(/\D/g, '');

  const nowIso = new Date().toISOString();
  const { data: pendingList } = await supabase
    .from('bot_action_confirmations')
    .select('*')
    .or(`client_id.eq.${phoneOrClientId},phone_number.ilike.%${cleanPhone}%`)
    .eq('action_type', 'email_recovery_challenge')
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  const pending = pendingList?.[0];
  if (!pending) {
    return { handled: false };
  }

  const payload = pending.proposed_payload as any;
  const textoLimpo = rawResposta.trim();

  // Cancelamento
  if (
    textoLimpo.toLowerCase() === '!cancelarrecuperacao' ||
    textoLimpo.toLowerCase() === '/cancelarrecuperacao' ||
    textoLimpo.toLowerCase() === 'cancelar'
  ) {
    await supabase
      .from('bot_action_confirmations')
      .update({ status: 'rejected' })
      .eq('id', pending.id);

    return {
      handled: true,
      message: `🛡️ *Recuperação por Desafio Cadastral Cancelada!*
Sua conta continua segura e inalterada. Caso precise, você também pode solicitar a recuperação diretamente ao suporte humano da Solucione.`,
    };
  }

  // ETAPA 1: Validação do Ano de Fundação
  if (payload.etapa_atual === 1) {
    const anoDigitado = textoLimpo.replace(/\D/g, '');
    const anoEsperado = payload.ano_fundacao;

    if (anoDigitado === anoEsperado) {
      // Acertou a etapa 1! Avança para etapa 2
      payload.etapa_atual = 2;
      await supabase
        .from('bot_action_confirmations')
        .update({ proposed_payload: payload })
        .eq('id', pending.id);

      return {
        handled: true,
        message: `✅ *Ano de fundação confirmado com sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 *Pergunta 2 de 2:*
Qual o **primeiro nome** de um dos sócios ou administradores registrados no CNPJ da sua empresa na Receita Federal? (Apenas o primeiro nome)`,
      };
    }

    // Errou a etapa 1
    payload.tentativas_restantes -= 1;
    if (payload.tentativas_restantes <= 0) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'rejected', proposed_payload: payload })
        .eq('id', pending.id);

      return {
        handled: true,
        message: `❌ *Tentativas Esgotadas no Desafio Cadastral!*
Por segurança bancária, a recuperação automatizada foi suspensa.
Por favor, entre em contato direto com o suporte humano da Solucione para efetuar a validação assistida.`,
      };
    }

    await supabase
      .from('bot_action_confirmations')
      .update({ proposed_payload: payload })
      .eq('id', pending.id);

    return {
      handled: true,
      message: `⚠️ *Ano incorreto!* Restam ${payload.tentativas_restantes} tentativa(s).
Por favor, digite o ano de fundação correto da empresa (Ex: 2018):`,
    };
  }

  // ETAPA 2: Validação do Nome do Sócio
  if (payload.etapa_atual === 2) {
    const nomeDigitado = normalizeText(textoLimpo.split(' ')[0] || '');
    const sociosEsperados: string[] = payload.socios_validos || [];

    const acertouSocio = sociosEsperados.some(s => normalizeText(s) === nomeDigitado);

    if (acertouSocio) {
      // Acertou ambas as perguntas com louvor!
      // Registra a pendência final de confirmação de e-mail (change_email)
      const novoEmail = payload.novo_email;
      const otpCode = payload.otp_code;

      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'confirmed' })
        .eq('id', pending.id);

      // Cria a confirmação pendente de e-mail apontando para a nova caixa
      await supabase.from('bot_action_confirmations').insert({
        client_id: pending.client_id,
        phone_number: pending.phone_number,
        action_type: 'change_email',
        status: 'pending',
        expires_at: addMinutes(new Date(), 10).toISOString(),
        proposed_payload: {
          novo_email: novoEmail,
          email_antigo: payload.email_antigo,
          otp_code: otpCode,
          client_name: payload.client_name,
        },
      });

      // Dispara o e-mail com o código de 6 dígitos para o NOVO e-mail
      await enviarCodigo2FATrocaEmail({
        emailAtual: novoEmail,
        nomeCliente: payload.client_name,
        codigoOtp: otpCode,
        novoEmail: novoEmail,
      });

      return {
        handled: true,
        message: `🎉 *Identidade Comprovada com Sucesso na Receita Federal!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você acertou todas as perguntas cadastrais da sua empresa.

Para concluir a ativação da sua nova caixa postal, enviamos um código de segurança de 6 dígitos para o seu **NOVO e-mail**:
📧 *${novoEmail}*

👉 Digite o código aqui no WhatsApp para finalizar:
*!confirmaremail CÓDIGO* (ou envie apenas os 6 dígitos)

⏱️ *Validade:* 10 minutos.`,
      };
    }

    // Errou a etapa 2
    payload.tentativas_restantes -= 1;
    if (payload.tentativas_restantes <= 0) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'rejected', proposed_payload: payload })
        .eq('id', pending.id);

      return {
        handled: true,
        message: `❌ *Tentativas Esgotadas no Desafio Cadastral!*
O nome informado não confere com o Quadro de Sócios da Receita Federal.
Por segurança, entre em contato direto com o suporte humano da Solucione.`,
      };
    }

    await supabase
      .from('bot_action_confirmations')
      .update({ proposed_payload: payload })
      .eq('id', pending.id);

    return {
      handled: true,
      message: `⚠️ *Nome não identificado no Quadro de Sócios!* Restam ${payload.tentativas_restantes} tentativa(s).
Informe apenas o primeiro nome de um dos sócios ou administradores registrados no CNPJ:`,
    };
  }

  return { handled: false };
}
