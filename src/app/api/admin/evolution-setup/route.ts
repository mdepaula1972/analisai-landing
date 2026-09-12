import { NextRequest, NextResponse } from 'next/server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'analisai';

/**
 * Endpoint de Diagnóstico e Configuração da Evolution API
 * Acesse via GET para ver o status ou POST para configurar o webhook automaticamente.
 */
export async function GET(req: NextRequest) {
  const result: Record<string, unknown> = {
    configured_env: {
      EVOLUTION_API_URL,
      EVOLUTION_INSTANCE,
      HAS_API_KEY: !!EVOLUTION_API_KEY,
      HAS_GEMINI_KEY: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
    },
  };

  try {
    // 1. Testa status da instância na Evolution API
    const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`, {
      headers: { apikey: EVOLUTION_API_KEY },
    });

    if (stateRes.ok) {
      result.connection_state = await stateRes.json();
    } else {
      result.connection_state_error = `HTTP ${stateRes.status}: ${await stateRes.text()}`;
    }

    // 2. Busca configuração atual do Webhook na Evolution
    const webhookRes = await fetch(`${EVOLUTION_API_URL}/webhook/find/${EVOLUTION_INSTANCE}`, {
      headers: { apikey: EVOLUTION_API_KEY },
    });

    if (webhookRes.ok) {
      result.current_webhook = await webhookRes.json();
    } else {
      result.current_webhook_error = `HTTP ${webhookRes.status}: ${await webhookRes.text()}`;
    }
  } catch (err: unknown) {
    result.fetch_error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(result);
}

/**
 * POST: Configura o Webhook da Evolution API automaticamente
 * Body: { "webhookUrl": "https://analisai.me/api/webhooks/evolution" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const webhookUrl = body.webhookUrl || 'https://analisai.me/api/webhooks/evolution';

    // Configura o Webhook na Evolution API para enviar mensagens para o AnalisAí
    const setWebhookRes = await fetch(`${EVOLUTION_API_URL}/webhook/set/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false, // Envia todos os eventos ou filtra por eventos
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
      }),
    });

    const data = await setWebhookRes.json();

    // Dispara mensagem de teste para o Marcos
    const testMsg = await sendEvolutionText({
      phone: '551331500987',
      text: `🚀 *Evolution API Conectada com Sucesso ao AnalisAí!*
Webhook configurado para: \`${webhookUrl}\`
Envie *!ajuda* para ver todos os comandos de teste do modo administrador.`,
    });

    return NextResponse.json({
      success: setWebhookRes.ok,
      webhook_response: data,
      test_message_sent: testMsg,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
