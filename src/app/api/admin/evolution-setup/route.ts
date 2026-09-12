import { NextRequest, NextResponse } from 'next/server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'analisai_solo';

/**
 * Endpoint de Diagnóstico e Painel Visual da Evolution API
 */
export async function GET(req: NextRequest) {
  const acceptsHtml = req.headers.get('accept')?.includes('text/html');

  let connectionState = 'unknown';
  let qrBase64 = '';
  let webhookInfo: Record<string, unknown> | null = null;
  let fetchError = '';

  try {
    // 1. Estado de conexão
    const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`, {
      headers: { apikey: EVOLUTION_API_KEY },
      cache: 'no-store',
    });
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      connectionState = stateData?.instance?.state || stateData?.state || 'unknown';
    }

    // 2. Se não estiver conectado, busca o QR Code
    if (connectionState !== 'open') {
      const qrRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE}`, {
        headers: { apikey: EVOLUTION_API_KEY },
        cache: 'no-store',
      });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        qrBase64 = qrData.base64 || qrData.qrcode?.base64 || '';
      }
    }

    // 3. Status do Webhook
    const webhookRes = await fetch(`${EVOLUTION_API_URL}/webhook/find/${EVOLUTION_INSTANCE}`, {
      headers: { apikey: EVOLUTION_API_KEY },
      cache: 'no-store',
    });
    if (webhookRes.ok) {
      webhookInfo = await webhookRes.json();
    }
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  // Se não for navegador, retorna JSON
  if (!acceptsHtml) {
    return NextResponse.json({
      configured_env: {
        EVOLUTION_API_URL,
        EVOLUTION_INSTANCE,
        HAS_API_KEY: !!EVOLUTION_API_KEY,
      },
      connectionState,
      has_qr: !!qrBase64,
      webhookInfo,
      fetchError: fetchError || null,
    });
  }

  // Renderiza Painel HTML com QR Code interativo
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setup Evolution API | AnalisAí</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card: #131b2e;
      --card-border: #1e293b;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --emerald: #10b981;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 24px; }
    .container { max-width: 540px; width: 100%; background: var(--card); border: 1px solid var(--card-border); border-radius: 20px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .header { text-align: center; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; text-transform: uppercase; }
    .badge-open { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-connecting { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-error { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .card-content { display: flex; flex-direction: column; align-items: center; gap: 20px; margin: 20px 0; }
    .qr-box { background: #fff; padding: 16px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .qr-img { width: 260px; height: 260px; display: block; border-radius: 8px; }
    .info-list { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; font-size: 13px; }
    .info-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .info-item:last-child { border-bottom: none; }
    .info-label { color: var(--text-muted); }
    .info-val { font-family: monospace; font-weight: 600; word-break: break-all; }
    .btn { width: 100%; padding: 12px 18px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; border: none; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary { background: #1e293b; color: #cbd5e1; margin-top: 10px; }
    .btn-secondary:hover { background: #334155; }
    .status-msg { margin-top: 12px; font-size: 13px; text-align: center; color: var(--emerald); min-height: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Painel WhatsApp Evolution</h1>
      <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 12px;">Instância: <strong>${EVOLUTION_INSTANCE}</strong></p>
      <div class="badge ${connectionState === 'open' ? 'badge-open' : (connectionState === 'connecting' ? 'badge-connecting' : 'badge-error')}">
        ● ${connectionState === 'open' ? 'Conectado e Operando' : (connectionState === 'connecting' ? 'Aguardando Leitura do QR Code' : 'Desconectado')}
      </div>
    </div>

    <div class="card-content">
      ${connectionState === 'open' ? `
        <div style="text-align: center; padding: 30px 10px;">
          <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
          <h2 style="font-size: 20px; font-weight: 700; color: #34d399;">WhatsApp Conectado!</h2>
          <p style="color: var(--text-muted); font-size: 14px; margin-top: 6px;">O AnalisAí já está recebendo e processando mensagens automaticamente via IA.</p>
        </div>
      ` : qrBase64 ? `
        <div class="qr-box">
          <img src="${qrBase64}" alt="QR Code WhatsApp" class="qr-img" />
        </div>
        <p style="text-align: center; font-size: 13px; color: var(--text-muted);">
          Abra o WhatsApp > <strong>Aparelhos Conectados</strong> > <strong>Conectar um aparelho</strong> e aponte para a imagem acima.
        </p>
      ` : `
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">
          Nenhum QR Code gerado no momento. Clique abaixo para atualizar.
        </div>
      `}

      <div class="info-list">
        <div class="info-item">
          <span class="info-label">URL da API</span>
          <span class="info-val">${EVOLUTION_API_URL}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Webhook Ativo</span>
          <span class="info-val" style="color: #34d399;">${webhookInfo ? 'Sim (Configurado)' : 'Não configurado'}</span>
        </div>
        ${webhookInfo ? `
        <div class="info-item">
          <span class="info-label">URL Webhook</span>
          <span class="info-val">${(webhookInfo as { url?: string }).url || '-'}</span>
        </div>
        ` : ''}
      </div>

      <div style="width: 100%;">
        <button class="btn btn-primary" onclick="window.location.reload()">
          🔄 Atualizar QR Code / Status
        </button>
        <button class="btn btn-secondary" onclick="configureWebhook()">
          ⚡ Reconfigurar Webhook Automaticamente
        </button>
        <button class="btn btn-secondary" style="margin-top: 10px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);" onclick="sendTestMsg()">
          ✉️ Enviar Mensagem de Boas-Vindas de Teste
        </button>
        <div id="status" class="status-msg"></div>
      </div>
    </div>
  </div>

  <script>
    async function configureWebhook() {
      const el = document.getElementById('status');
      el.style.color = '#38bdf8';
      el.innerText = 'Configurando webhook...';
      try {
        const res = await fetch('/api/admin/evolution-setup', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          el.style.color = '#34d399';
          el.innerText = 'Webhook reconfigurado com sucesso!';
          setTimeout(() => window.location.reload(), 1500);
        } else {
          el.style.color = '#f87171';
          el.innerText = 'Erro: ' + (data.error || JSON.stringify(data.webhook_response));
        }
      } catch (e) {
        el.style.color = '#f87171';
        el.innerText = 'Erro na requisição: ' + e.message;
      }
    }

    async function sendTestMsg() {
      const el = document.getElementById('status');
      el.style.color = '#38bdf8';
      el.innerText = 'Disparando mensagem de teste...';
      try {
        const res = await fetch('/api/admin/evolution-setup?action=test_send', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          el.style.color = '#34d399';
          el.innerText = 'Mensagem enviada com sucesso!';
        } else {
          el.style.color = '#f87171';
          el.innerText = 'Erro no envio: ' + (data.error || 'Instância precisa estar conectada');
        }
      } catch (e) {
        el.style.color = '#f87171';
        el.innerText = 'Erro: ' + e.message;
      }
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

/**
 * POST: Configura o Webhook da Evolution API automaticamente ou dispara teste
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Disparo de teste
    if (action === 'test_send') {
      const testMsg = await sendEvolutionText({
        phone: '551331500987',
        text: `🚀 *Evolution API Conectada com Sucesso ao AnalisAí!*
Envie *!ajuda* para ver todos os comandos de teste do modo administrador.`,
      });

      return NextResponse.json(testMsg);
    }

    const body = await req.json().catch(() => ({}));
    const webhookUrl = body.webhookUrl || 'https://analisai.me/api/webhooks/evolution';

    // Configura o Webhook no formato compatível com Evolution API v2
    const setWebhookRes = await fetch(`${EVOLUTION_API_URL}/webhook/set/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
        },
      }),
    });

    const data = await setWebhookRes.json();

    return NextResponse.json({
      success: setWebhookRes.ok,
      webhook_response: data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
