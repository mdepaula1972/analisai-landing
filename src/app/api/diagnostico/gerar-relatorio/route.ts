import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_RELATORIO_PROMPT = `
Você é o Comitê de Especialistas em Estruturação Financeira e Gestão Empresarial da AnalisAI.me.
Sua missão é gerar um RELATÓRIO EXECUTIVO DE DIAGNÓSTICO FINANCEIRO completo, denso, estratégico, técnico e ao mesmo tempo extremamente claro e acionável para o dono da empresa.

ESTRUTURA OBRIGATÓRIA DA ANÁLISE (Retorne em JSON estruturado):
{
  "titulo": "DIAGNÓSTICO FINANCEIRO EXECUTIVO & PLANO DE AÇÃO",
  "score_saude_financeira": 68, // Pontuação de 0 a 100 baseada na relação faturamento x custos x sobra
  "classificacao_saude": "Atenção Operacional / Saudável / Crítico",
  "resumo_executivo": "Texto formal e direto avaliando o momento atual da empresa",
  "indicadores_chave": {
    "margem_bruta_estimada": "XX%",
    "margem_liquida_estimada": "XX%",
    "ponto_equilibrio_mensal": "R$ XX.XXX,XX",
    "grau_comprometimento_fixos": "XX%"
  },
  "alertas_criticos": [
    "Alerta 1 com diagnóstico e risco (ex: mistura de contas PF/PJ)",
    "Alerta 2 com impacto no caixa"
  ],
  "pontos_fortes": [
    "Ponto positivo da operação"
  ],
  "plano_acao_estrategico": [
    {
      "prazo": "Imediato (0 a 30 dias)",
      "titulo": "Estancamento de Sangria e Separação de Contas",
      "acoes": ["Ação prática 1", "Ação prática 2"]
    },
    {
      "prazo": "Curto Prazo (30 a 60 dias)",
      "titulo": "Otimização de Custos e Ficha Técnica / Escalas",
      "acoes": ["Ação prática 1", "Ação prática 2"]
    },
    {
      "prazo": "Médio Prazo (60 a 90 dias)",
      "titulo": "Estruturação de Caixa e Metas de Lucratividade",
      "acoes": ["Ação prática 1", "Ação prática 2"]
    }
  ],
  "conclusao_consultor": "Parecer final assinado pela equipe de Inteligência e Consultoria AnalisAI.me"
}
`;

export async function POST(req: NextRequest) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
    }

    const { ficha, identificacao } = await req.json();

    const promptUsuario = `
Gere o relatório executivo completo para a empresa com os seguintes dados:
IDENTIFICAÇÃO: ${JSON.stringify(identificacao || {})}
DADOS FINANCEIROS COLETADOS: ${JSON.stringify(ficha || {})}
`;

    const MODELS_TO_TRY = [
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite'
    ];

    let geminiData: any = null;
    let lastErrorMessage = '';

    for (const modelName of MODELS_TO_TRY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: SYSTEM_RELATORIO_PROMPT }],
              },
              contents: [{
                role: 'user',
                parts: [{ text: promptUsuario }],
              }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.3,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          geminiData = await geminiRes.json();
          break;
        } else {
          const errJson = await geminiRes.json().catch(() => null);
          lastErrorMessage = errJson?.error?.message || `Erro ${geminiRes.status}`;
        }
      } catch (err: any) {
        lastErrorMessage = err.message;
      }
    }

    if (!geminiData) {
      return NextResponse.json(
        { error: `Erro ao gerar relatório: ${lastErrorMessage || 'Pico de tráfego. Tente novamente.'}` },
        { status: 503 }
      );
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    let relatorioParsed = null;

    try {
      relatorioParsed = JSON.parse(rawText || '{}');
    } catch {
      return NextResponse.json({ error: 'Erro ao interpretar formato do relatório.' }, { status: 500 });
    }

    return NextResponse.json({
      sucesso: true,
      relatorio: relatorioParsed,
      ficha,
      identificacao,
      gerado_em: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[api/diagnostico/gerar-relatorio] Erro:', error);
    return NextResponse.json({ error: 'Erro interno ao gerar relatório.' }, { status: 500 });
  }
}
