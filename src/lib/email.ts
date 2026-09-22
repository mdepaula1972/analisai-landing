/**
 * Serviço de Envio de E-mails via Resend API
 */

interface NotificacaoColetaEmailParams {
  nome_negocio: string;
  setor?: string;
  faturamento_medio?: string;
  custos_fixos?: string;
  custos_variaveis?: string;
  dividas_parcelamentos?: string;
  email: string;
  whatsapp: string;
  pedido_id?: string | null;
}

export interface NotificacaoLeadDiagnosticoParams {
  tipo: 'PJ' | 'PF';
  nome: string;
  email: string;
  whatsapp: string;
  empresa_ou_ocupacao?: string;
  setor?: string;
  faturamento_ou_renda?: string;
  custos_ou_gastos?: string;
  desafio_ou_objetivo?: string;
  score_ou_classificacao?: string;
  detalhes_adicionais?: Record<string, any>;
}

export async function notificarAdminNovaColetaEmail(dados: NotificacaoColetaEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const emailDestino = process.env.ADMIN_EMAIL || 'mdepaula1972@gmail.com';

  if (!apiKey) {
    console.warn('[Resend Email] RESEND_API_KEY não configurada nas variáveis de ambiente.');
    return { sucesso: false, erro: 'API Key do Resend ausente.' };
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05)); padding: 24px; border-bottom: 1px solid #334155; text-align: center; }
        .badge { display: inline-block; background-color: #10b981; color: #020617; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
        .content { padding: 24px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .table td { padding: 10px 12px; border-bottom: 1px solid #1e293b; font-size: 14px; }
        .label { color: #94a3b8; font-weight: 600; width: 40%; }
        .value { color: #f8fafc; font-weight: 700; }
        .highlight { color: #f59e0b; }
        .footer { background-color: #020617; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">Novo Diagnóstico Recebido</span>
          <h1 class="title">Coleta de Dados — AnalisAI.me</h1>
        </div>
        <div class="content">
          <p style="margin-top: 0; color: #cbd5e1; font-size: 14px;">
            Uma nova empresa acabou de enviar as informações financeiras na Sala de Coleta.
          </p>
          <table class="table">
            <tr>
              <td class="label">🏢 Nome da Empresa:</td>
              <td class="value highlight">${dados.nome_negocio}</td>
            </tr>
            <tr>
              <td class="label">📂 Setor / Ramo:</td>
              <td class="value">${dados.setor || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">💰 Faturamento Médio:</td>
              <td class="value">R$ ${dados.faturamento_medio || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">🏛️ Custos Fixos:</td>
              <td class="value">R$ ${dados.custos_fixos || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">📦 Custos Variáveis:</td>
              <td class="value">R$ ${dados.custos_variaveis || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">💳 Dívidas / Parcelamentos:</td>
              <td class="value">${dados.dividas_parcelamentos || 'Nenhuma'}</td>
            </tr>
            <tr>
              <td class="label">📧 E-mail do Cliente:</td>
              <td class="value"><a href="mailto:${dados.email}" style="color: #38bdf8; text-decoration: none;">${dados.email}</a></td>
            </tr>
            <tr>
              <td class="label">📱 WhatsApp do Cliente:</td>
              <td class="value"><a href="https://wa.me/55${dados.whatsapp.replace(/\D/g, '')}" style="color: #10b981; text-decoration: none;">${dados.whatsapp}</a></td>
            </tr>
            ${dados.pedido_id ? `
            <tr>
              <td class="label">🔑 Identificador:</td>
              <td class="value" style="font-family: monospace; font-size: 11px; color: #94a3b8;">${dados.pedido_id}</td>
            </tr>` : ''}
          </table>
        </div>
        <div class="footer">
          ⏳ Prazo de entrega do relatório: até 72 horas.<br>
          AnalisAI.me — Inteligência Financeira
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AnalisAI.me <onboarding@resend.dev>',
        to: [emailDestino],
        subject: `🚀 [Novo Diagnóstico] ${dados.nome_negocio}`,
        html: html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Resend Email] Erro no envio:', data);
      return { sucesso: false, erro: data.message || 'Erro ao enviar e-mail' };
    }

    return { sucesso: true, id: data.id };
  } catch (err: any) {
    console.error('[Resend Email] Falha de conexão:', err);
    return { sucesso: false, erro: err.message };
  }
}

export async function notificarAdminLeadDiagnostico(lead: NotificacaoLeadDiagnosticoParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const emailDestino = process.env.ADMIN_EMAIL || 'mdepaula1972@gmail.com';

  if (!apiKey) {
    console.warn('[Resend Email] RESEND_API_KEY não configurada nas variáveis de ambiente.');
    return { sucesso: false, erro: 'API Key do Resend ausente.' };
  }

  const isPJ = lead.tipo === 'PJ';
  const badgeColor = isPJ ? '#f59e0b' : '#38bdf8';
  const cleanPhone = lead.whatsapp.replace(/\D/g, '');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05)); padding: 24px; border-bottom: 1px solid #334155; text-align: center; }
        .badge { display: inline-block; background-color: ${badgeColor}; color: #020617; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
        .content { padding: 24px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .table td { padding: 10px 12px; border-bottom: 1px solid #1e293b; font-size: 14px; }
        .label { color: #94a3b8; font-weight: 600; width: 40%; }
        .value { color: #f8fafc; font-weight: 700; }
        .highlight { color: #10b981; }
        .cta-btn { display: inline-block; background-color: #10b981; color: #020617 !important; font-weight: 800; padding: 12px 24px; border-radius: 12px; text-decoration: none; margin-top: 16px; }
        .footer { background-color: #020617; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">🔥 Novo Lead — Diagnóstico Gratuito ${lead.tipo}</span>
          <h1 class="title">${lead.nome}</h1>
        </div>
        <div class="content">
          <p style="margin-top: 0; color: #cbd5e1; font-size: 14px;">
            Um novo lead acabou de completar o <strong>Diagnóstico Gratuito (${lead.tipo})</strong> no site AnalisAI.me.
          </p>
          <table class="table">
            <tr>
              <td class="label">👤 Nome do Lead:</td>
              <td class="value">${lead.nome}</td>
            </tr>
            <tr>
              <td class="label">${isPJ ? '🏢 Empresa:' : '💼 Ocupação:'}</td>
              <td class="value highlight">${lead.empresa_ou_ocupacao || 'Não informado'}</td>
            </tr>
            ${lead.setor ? `
            <tr>
              <td class="label">📂 Setor / Ramo:</td>
              <td class="value">${lead.setor}</td>
            </tr>` : ''}
            <tr>
              <td class="label">${isPJ ? '💰 Faturamento Médio:' : '💰 Renda Mensal:'}</td>
              <td class="value">${lead.faturamento_ou_renda || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">${isPJ ? '🏛️ Custos Fixos:' : '💳 Gastos / Despesas:'}</td>
              <td class="value">${lead.custos_ou_gastos || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">${isPJ ? '🎯 Principal Desafio:' : '🎯 Principal Objetivo:'}</td>
              <td class="value" style="color: #f59e0b;">${lead.desafio_ou_objetivo || 'Não informado'}</td>
            </tr>
            ${lead.score_ou_classificacao ? `
            <tr>
              <td class="label">📊 Resultado do Score:</td>
              <td class="value">${lead.score_ou_classificacao}</td>
            </tr>` : ''}
            <tr>
              <td class="label">📧 E-mail:</td>
              <td class="value"><a href="mailto:${lead.email}" style="color: #38bdf8; text-decoration: none;">${lead.email}</a></td>
            </tr>
            <tr>
              <td class="label">📱 WhatsApp:</td>
              <td class="value"><a href="https://wa.me/55${cleanPhone}" style="color: #10b981; text-decoration: none;">${lead.whatsapp}</a></td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 20px;">
            <a href="https://wa.me/55${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(lead.nome)}%2C%20vi%20que%20voc%C3%AA%20preencheu%20o%20Diagn%C3%B3stico%20Financeiro%20Gratuito%20na%20AnalisAI.me%20e%20gostaria%20de%20apresentar%20seu%20Raio-X!" class="cta-btn">
              💬 Iniciar Conversa no WhatsApp
            </a>
          </div>
        </div>
        <div class="footer">
          AnalisAI.me & Solucione — Gestão & Inteligência Financeira
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AnalisAI.me <onboarding@resend.dev>',
        to: [emailDestino],
        subject: `🔥 [Novo Lead ${lead.tipo}] ${lead.nome} — ${lead.empresa_ou_ocupacao || 'Diagnóstico'}`,
        html: html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Resend Lead Email] Erro no envio:', data);
      return { sucesso: false, erro: data.message || 'Erro ao enviar e-mail' };
    }

    return { sucesso: true, id: data.id };
  } catch (err: any) {
    console.error('[Resend Lead Email] Falha de conexão:', err);
    return { sucesso: false, erro: err.message };
  }
}

export interface EnviarCodigo2FAParams {
  emailDestino: string;
  nomeCliente: string;
  codigoOtp: string;
  novoTelefone: string;
}

export async function enviarCodigo2FATrocaNumero(params: EnviarCodigo2FAParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Resend Email] RESEND_API_KEY não configurada.');
    return { sucesso: false, erro: 'API Key do Resend ausente.' };
  }

  const cleanPhone = params.novoTelefone.replace(/\D/g, '');
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; max-width: 540px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(245,158,11,0.05)); padding: 24px; border-bottom: 1px solid #334155; text-align: center; }
        .badge { display: inline-block; background-color: #ef4444; color: #ffffff; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
        .content { padding: 24px; text-align: center; }
        .otp-box { background-color: #020617; border: 2px dashed #f59e0b; border-radius: 12px; padding: 20px; margin: 24px 0; }
        .otp-code { font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #f59e0b; margin: 0; }
        .warning-text { font-size: 13px; color: #94a3b8; line-height: 1.6; text-align: left; background-color: #1e293b; padding: 14px; border-radius: 8px; margin-top: 20px; }
        .footer { background-color: #020617; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">🔒 Segurança & LGPD</span>
          <h1 class="title">Verificação em 2 Etapas</h1>
        </div>
        <div class="content">
          <p style="margin-top: 0; color: #cbd5e1; font-size: 15px;">
            Olá, <strong>${params.nomeCliente}</strong>!
          </p>
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 0;">
            Recebemos uma solicitação para vincular sua conta do <strong>AnalisAí</strong> ao número de WhatsApp:
          </p>
          <p style="color: #38bdf8; font-weight: 700; font-size: 16px; margin-top: 4px;">
            +${cleanPhone}
          </p>

          <div class="otp-box">
            <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 6px;">Seu Código de Confirmação</span>
            <h2 class="otp-code">${params.codigoOtp}</h2>
            <span style="font-size: 12px; color: #64748b; margin-top: 6px; display: block;">Válido por 10 minutos</span>
          </div>

          <div class="warning-text">
            ⚠️ <strong>Atenção à Segurança dos seus Dados:</strong><br>
            • Digite este código diretamente no WhatsApp para autorizar a troca.<br>
            • Se você <strong>NÃO</strong> solicitou essa alteração, ignore este e-mail imediatamente. Nenhum acesso será concedido sem este código.<br>
            • Nunca compartilhe este código com terceiros ou ex-colaboradores.
          </div>
        </div>
        <div class="footer">
          AnalisAI.me — Sistema de Inteligência Financeira & Proteção de Dados
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AnalisAI Segurança <onboarding@resend.dev>',
        to: [params.emailDestino],
        subject: `🔒 [Código 2FA: ${params.codigoOtp}] Confirmação de Troca de WhatsApp — AnalisAí`,
        html: html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Resend 2FA Email] Erro no envio:', data);
      return { sucesso: false, erro: data.message || 'Erro ao enviar e-mail' };
    }

    return { sucesso: true, id: data.id };
  } catch (err: any) {
    console.error('[Resend 2FA Email] Falha de conexão:', err);
    return { sucesso: false, erro: err.message };
  }
}

export async function notificarTrocaNumeroConcluida(params: { emailDestino: string; nomeCliente: string; novoTelefone: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sucesso: false };

  const cleanPhone = params.novoTelefone.replace(/\D/g, '');
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; max-width: 540px; margin: 0 auto; overflow: hidden; }
        .header { background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05)); padding: 24px; border-bottom: 1px solid #334155; text-align: center; }
        .badge { display: inline-block; background-color: #10b981; color: #020617; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
        .content { padding: 24px; font-size: 14px; color: #cbd5e1; line-height: 1.6; }
        .footer { background-color: #020617; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">Auditoria de Segurança</span>
          <h1 class="title">WhatsApp Atualizado com Sucesso</h1>
        </div>
        <div class="content">
          <p>Olá, <strong>${params.nomeCliente}</strong>!</p>
          <p>Confirmamos que a sua conta do <strong>AnalisAí</strong> foi vinculada com sucesso ao número de WhatsApp <strong>+${cleanPhone}</strong> em ${new Date().toLocaleString('pt-BR')}.</p>
          <p>Se você reconhece essa alteração, não é necessário fazer nada.</p>
          <p style="color: #ef4444; font-weight: 600;">Caso não tenha sido você, entre em contato imediatamente com a equipe de suporte para revogar o acesso.</p>
        </div>
        <div class="footer">
          AnalisAI.me — Sistema de Inteligência Financeira
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AnalisAI Segurança <onboarding@resend.dev>',
        to: [params.emailDestino],
        subject: `✅ [Segurança] Seu WhatsApp do AnalisAí foi atualizado`,
        html: html,
      }),
    });
    return { sucesso: true };
  } catch (err: any) {
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Envia código de segurança 2FA para autorizar alteração de chave Pix
 */
export async function enviarCodigo2FAAlteracaoPix(params: {
  emailDestino: string;
  nomeCliente: string;
  codigoOtp: string;
  novaChavePix: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Resend 2FA Pix] RESEND_API_KEY ausente.');
    return { sucesso: false, erro: 'API Key não configurada' };
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; max-width: 540px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05)); padding: 24px; border-bottom: 1px solid #334155; text-align: center; }
        .badge { display: inline-block; background-color: #ef4444; color: #ffffff; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
        .content { padding: 24px; font-size: 14px; color: #cbd5e1; line-height: 1.6; }
        .otp-box { background-color: #020617; border: 2px dashed #f59e0b; border-radius: 12px; text-align: center; padding: 18px; margin: 20px 0; }
        .otp-code { font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #f59e0b; }
        .warning { background-color: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; font-size: 13px; color: #fca5a5; margin-top: 16px; }
        .footer { background-color: #020617; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">Proteção Financeira 2FA</span>
          <h1 class="title">Autorização de Chave Pix</h1>
        </div>
        <div class="content">
          <p>Olá, <strong>${params.nomeCliente}</strong>!</p>
          <p>Recebemos uma solicitação pelo WhatsApp para alterar a conta de recebimento de comissões do <strong>Programa Analisador</strong> da sua empresa para a seguinte chave Pix:</p>
          <p style="font-size: 16px; font-weight: 700; color: #38bdf8; text-align: center; background: #020617; padding: 10px; border-radius: 8px;">
            ${params.novaChavePix}
          </p>
          <p>Para confirmar que você é o titular desta solicitação, utilize o código de segurança abaixo:</p>
          <div class="otp-box">
            <div class="otp-code">${params.codigoOtp}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Válido por 10 minutos</div>
          </div>
          <div class="warning">
            ⚠️ <strong>Alerta de Segurança:</strong> Se você NÃO solicitou essa alteração, <strong>NÃO</strong> compartilhe este código com ninguém. Seus dados e comissões continuam seguros.
          </div>
        </div>
        <div class="footer">
          AnalisAI.me — Sistema de Inteligência Financeira e Contábil
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AnalisAI Segurança <onboarding@resend.dev>',
        to: [params.emailDestino],
        subject: `🔒 [Código 2FA: ${params.codigoOtp}] Autorização de Alteração de Chave Pix — AnalisAí`,
        html: html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Resend 2FA Pix Email] Erro no envio:', data);
      return { sucesso: false, erro: data.message || 'Erro ao enviar e-mail' };
    }

    return { sucesso: true, id: data.id };
  } catch (err: any) {
    console.error('[Resend 2FA Pix Email] Falha de conexão:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Notifica o titular por e-mail quando a chave Pix for alterada com sucesso
 */
export async function notificarAlteracaoPixConcluida(params: {
  emailDestino: string;
  nomeCliente: string;
  novaChavePix: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sucesso: false };

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; max-width: 540px; margin: 0 auto; overflow: hidden; }
        .header { background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05)); padding: 24px; border-bottom: 1px solid #334155; text-align: center; }
        .badge { display: inline-block; background-color: #10b981; color: #020617; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
        .content { padding: 24px; font-size: 14px; color: #cbd5e1; line-height: 1.6; }
        .footer { background-color: #020617; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">Auditoria de Segurança</span>
          <h1 class="title">Chave Pix Atualizada com Sucesso</h1>
        </div>
        <div class="content">
          <p>Olá, <strong>${params.nomeCliente}</strong>!</p>
          <p>Confirmamos que a chave Pix para repasse de comissões do <strong>Programa Analisador</strong> da sua empresa foi alterada com sucesso para <strong>${params.novaChavePix}</strong> em ${new Date().toLocaleString('pt-BR')}.</p>
          <p>Os futuros repasses de comissão serão efetuados para esta chave.</p>
          <p style="color: #ef4444; font-weight: 600;">Se você não realizou ou não autorizou essa operação, contate o suporte imediatamente para suspender os pagamentos.</p>
        </div>
        <div class="footer">
          AnalisAI.me — Sistema de Inteligência Financeira
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AnalisAI Segurança <onboarding@resend.dev>',
        to: [params.emailDestino],
        subject: `✅ [Segurança] Chave Pix do AnalisAí atualizada com sucesso`,
        html: html,
      }),
    });
    return { sucesso: true };
  } catch (err: any) {
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Envia código 2FA para o e-mail ATUAL do titular autorizar a troca de e-mail
 */
export async function enviarCodigo2FATrocaEmail(params: {
  emailAtual: string;
  nomeCliente: string;
  codigoOtp: string;
  novoEmail: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sucesso: false, erro: 'API Key ausente' };

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; max-width: 540px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05)); padding: 24px; border-bottom: 1px solid #334155; text-align: center; }
        .badge { display: inline-block; background-color: #ef4444; color: #ffffff; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
        .content { padding: 24px; font-size: 14px; color: #cbd5e1; line-height: 1.6; }
        .otp-box { background-color: #020617; border: 2px dashed #f59e0b; border-radius: 12px; text-align: center; padding: 18px; margin: 20px 0; }
        .otp-code { font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #f59e0b; }
        .warning { background-color: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; font-size: 13px; color: #fca5a5; margin-top: 16px; }
        .footer { background-color: #020617; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">Auditoria de Segurança 2FA</span>
          <h1 class="title">Autorização de Troca de E-mail</h1>
        </div>
        <div class="content">
          <p>Olá, <strong>${params.nomeCliente}</strong>!</p>
          <p>Recebemos uma solicitação pelo WhatsApp para alterar o e-mail oficial da sua conta do <strong>AnalisAí</strong> para o seguinte endereço:</p>
          <p style="font-size: 16px; font-weight: 700; color: #38bdf8; text-align: center; background: #020617; padding: 10px; border-radius: 8px;">
            ${params.novoEmail}
          </p>
          <p>Para autorizar essa transferência de titularidade de segurança, utilize o código de segurança abaixo:</p>
          <div class="otp-box">
            <div class="otp-code">${params.codigoOtp}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Válido por 10 minutos</div>
          </div>
          <div class="warning">
            🚨 <strong>Aviso Crítico de Segurança:</strong> Se você NÃO solicitou essa alteração, <strong>NÃO</strong> forneça este código a ninguém. Significa que alguém pode estar com acesso físico ao seu WhatsApp tentando alterar suas credenciais.
          </div>
        </div>
        <div class="footer">
          AnalisAI.me — Sistema de Inteligência Financeira e Contábil
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AnalisAI Segurança <onboarding@resend.dev>',
        to: [params.emailAtual],
        subject: `🔒 [Código 2FA: ${params.codigoOtp}] Autorização de Alteração de E-mail — AnalisAí`,
        html: html,
      }),
    });
    const data = await res.json();
    return { sucesso: res.ok, id: data.id };
  } catch (err: any) {
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Notifica ambos os e-mails (antigo e novo) quando a troca for concluída
 */
export async function notificarTrocaEmailConcluida(params: {
  emailAntigo: string;
  novoEmail: string;
  nomeCliente: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sucesso: false };

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; max-width: 540px; margin: 0 auto; overflow: hidden; }
        .header { background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05)); padding: 24px; border-bottom: 1px solid #334155; text-align: center; }
        .badge { display: inline-block; background-color: #10b981; color: #020617; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px; }
        .title { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
        .content { padding: 24px; font-size: 14px; color: #cbd5e1; line-height: 1.6; }
        .footer { background-color: #020617; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">Auditoria Concluída</span>
          <h1 class="title">E-mail de Segurança Atualizado</h1>
        </div>
        <div class="content">
          <p>Olá, <strong>${params.nomeCliente}</strong>!</p>
          <p>Confirmamos que o e-mail de segurança da sua conta do <strong>AnalisAí</strong> foi alterado para <strong>${params.novoEmail}</strong> em ${new Date().toLocaleString('pt-BR')}.</p>
          <p>Se você não realizou essa alteração, entre em contato imediatamente com o suporte da Solucione.</p>
        </div>
        <div class="footer">
          AnalisAI.me — Sistema de Inteligência Financeira
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AnalisAI Segurança <onboarding@resend.dev>',
        to: [params.emailAntigo, params.novoEmail],
        subject: `✅ [Segurança] E-mail do AnalisAí atualizado com sucesso`,
        html: html,
      }),
    });
    return { sucesso: true };
  } catch (err: any) {
    return { sucesso: false, erro: err.message };
  }
}

