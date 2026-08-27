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
