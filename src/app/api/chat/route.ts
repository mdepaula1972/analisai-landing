import { NextRequest, NextResponse } from 'next/server';

/* ── Rate limit por IP (in-memory, reseta com cold start do servidor) ── */
const ipStore = new Map<string, { count: number; resetAt: number }>();
const IP_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;

function checkIpLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipStore.get(ip);
  if (!entry || now >= entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (entry.count >= IP_LIMIT) return false;
  entry.count++;
  return true;
}

/* ── System prompt — restringe estritamente ao tema financeiro ── */
const SYSTEM_PROMPT = `Você é o assistente financeiro do AnalisAI.me, especializado em finanças empresariais para PMEs brasileiras.

REGRAS ABSOLUTAS — nunca as quebre:
1. Responda APENAS perguntas sobre finanças empresariais: fluxo de caixa, DRE, contas a pagar/receber, conciliação bancária, capital de giro, inadimplência, ponto de equilíbrio, lucratividade, margem de contribuição, precificação, planejamento financeiro, custos fixos e variáveis.
2. Se a pergunta NÃO for sobre finanças empresariais, responda EXATAMENTE esta frase e nada mais: "Posso ajudar apenas com questões de finanças empresariais. Experimente perguntar sobre fluxo de caixa, DRE, capital de giro ou ponto de equilíbrio!"
3. Seja direto e conciso: no máximo 3 parágrafos curtos.
4. Use linguagem clara para empreendedores brasileiros. Evite jargões excessivos.
5. Ao final de cada resposta válida, adicione uma linha convidando o usuário a agendar uma demonstração completa do AnalisAI.me para análises mais aprofundadas.
6. Nunca invente dados, números ou prometa resultados específicos.
7. Nunca forneça código, receitas, conteúdo de entretenimento ou qualquer coisa fora do escopo financeiro empresarial.`;

export async function POST(request: NextRequest) {
  /* 1. Rate limit por IP */
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (!checkIpLimit(ip)) {
    return NextResponse.json(
      { error: 'rate_limit', message: 'Limite de uso por hora atingido. Tente novamente mais tarde.' },
      { status: 429 }
    );
  }

  /* 2. Parse e validação do body */
  let message: string;
  try {
    const body = await request.json();
    message = (body.message ?? '').toString().trim();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!message || message.length < 3) {
    return NextResponse.json({ error: 'message_too_short' }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json({ error: 'message_too_long' }, { status: 400 });
  }

  /* 3. Chave de API */
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'not_configured', message: 'Demo temporariamente indisponível.' },
      { status: 503 }
    );
  }

  /* 4. Chamada ao Gemini 1.5 Flash com timeout de 12s */
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: {
            maxOutputTokens: 420,
            temperature: 0.25,
            topP: 0.9,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
          ],
        }),
      }
    );

    clearTimeout(timeout);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('Gemini error:', geminiRes.status, errText);
      return NextResponse.json({ error: 'ai_error' }, { status: 502 });
    }

    const data = await geminiRes.json();
    const reply: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!reply) {
      return NextResponse.json(
        { error: 'empty_response', message: 'Não consegui gerar uma resposta. Tente reformular a pergunta.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'timeout', message: 'A IA demorou demais para responder. Tente novamente.' },
        { status: 504 }
      );
    }
    console.error('Chat route error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
