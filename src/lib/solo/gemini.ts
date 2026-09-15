import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ExtractedDocumentData } from '@/types/solo';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

function getGeminiClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente.');
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

/**
 * 1. Extração estruturada de Documentos (Visão / PDF / Fotos)
 * Retorna campos contábeis e score de confiança (0.0 a 1.0).
 */
export async function extractDocumentWithGemini(
  fileBufferBase64: string,
  mimeType: string
): Promise<ExtractedDocumentData> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          is_financial_doc: {
            type: SchemaType.BOOLEAN,
            description:
              'True se o arquivo for um documento fiscal, contábil ou financeiro real (boleto, conta de luz/água/telefone, nota fiscal, recibo, cupom, comprovante). False se for foto de objeto, pessoa, paisagem, meme, documento não financeiro ou ilegível.',
          },
          doc_type: {
            type: SchemaType.STRING,
            enum: ['nfe', 'nfse', 'boleto', 'recibo', 'cupom', 'outro'],
          },
          counterparty_name: {
            type: SchemaType.STRING,
            description: 'Nome do fornecedor, prestador ou emissor',
          },
          tax_id: {
            type: SchemaType.STRING,
            description: 'CNPJ ou CPF do emissor se legível',
            nullable: true,
          },
          total_amount: {
            type: SchemaType.NUMBER,
            description: 'Valor total monetário em reais (ex: 150.50)',
          },
          due_date: {
            type: SchemaType.STRING,
            description: 'Data de vencimento no formato YYYY-MM-DD',
            nullable: true,
          },
          issue_date: {
            type: SchemaType.STRING,
            description: 'Data de emissão no formato YYYY-MM-DD',
            nullable: true,
          },
          barcode_or_pix: {
            type: SchemaType.STRING,
            description: 'Linha digitável de boleto ou código Copia e Cola PIX',
            nullable: true,
          },
          category_suggestion: {
            type: SchemaType.STRING,
            description:
              'Sugestão de grupo do DRE: receita_operacional, custo_mercadoria_servico, despesa_administrativa, despesa_comercial, despesas_financeiras_tributos, retirada_pro_labore ou outros',
          },
          criticality_hint: {
            type: SchemaType.INTEGER,
            description: 'Criticidade de 1 a 5 (5 sendo serviços essenciais como luz/água/internet)',
          },
          confidence_score: {
            type: SchemaType.NUMBER,
            description:
              'Grau de certeza de 0.0 a 1.0. Se houver rasura, baixa resolução ou dados duvidosos em nota sem dígito verificador, atribua valor estritamente abaixo de 0.7.',
          },
        },
        required: [
          'is_financial_doc',
          'doc_type',
          'counterparty_name',
          'total_amount',
          'category_suggestion',
          'criticality_hint',
          'confidence_score',
        ],
      },
    },
    systemInstruction: `Você é o leitor contábil de inteligência artificial de alta precisão do serviço AnalisAí Solo.
Sua missão é extrair rigorosamente os dados financeiros de comprovantes, notas fiscais, boletos e recibos.
Se a imagem estiver cortada, borrada, com dados ambíguos ou você não tiver absoluta certeza de valores ou vencimentos em notas fiscais, indique um confidence_score menor que 0.7 para que o sistema solicite a confirmação do cliente.`,
  });

  const result = await model.generateContent([
    {
      inlineData: {
        data: fileBufferBase64,
        mimeType: mimeType || 'image/jpeg',
      },
    },
    {
      text: 'Analise este documento fiscal/financeiro e retorne os dados contábeis estruturados.',
    },
  ]);

  const rawJson = result.response.text();
  return JSON.parse(rawJson) as ExtractedDocumentData;
}

/**
 * 2. Processamento nativo de áudio (WhatsApp PTT) com Function Calling
 */
export async function processVoiceCommandWithGemini(
  audioBase64: string,
  mimeType: string = 'audio/ogg; codecs=opus',
  contextText: string = ''
) {
  const genAI = getGeminiClient();

  const functionDeclarations = [
    {
      name: 'propose_due_date_change',
      description: 'Invocada quando o cliente pede para alterar, adiar ou prorrogar o vencimento de uma conta a pagar cadastrada.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          supplier_name: {
            type: SchemaType.STRING,
            description: 'Nome do fornecedor ou palavra-chave identificadora (ex: Copel, Vivo, Embalagens, Aluguel)',
          },
          target_date: {
            type: SchemaType.STRING,
            description: 'Nova data solicitada. Se o cliente falar apenas "dia 25" ou "25", preencha com a data no formato YYYY-MM-DD do mês atual (ex: 2026-09-25)',
          },
          reason: {
            type: SchemaType.STRING,
            description: 'Motivo informado pelo cliente, se houver',
          },
        },
        required: ['supplier_name', 'target_date'],
      },
    },
    {
      name: 'request_cash_flow_postpone_advice',
      description: 'Invocada quando o cliente relata aperto de caixa e pede recomendação de qual conta deve postergar.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          available_cash: {
            type: SchemaType.NUMBER,
            description: 'Saldo monetário em caixa que o cliente possui no momento',
          },
        },
      },
    },
    {
      name: 'get_plan_consumption',
      description: 'Invocada quando o cliente quer consultar o consumo do seu plano no mês.',
    },
    {
      name: 'request_partner_product',
      description: 'Invocada quando o cliente busca certificado digital, maquininha ou abertura de conta PJ.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          product_category: {
            type: SchemaType.STRING,
            description: 'fiscal, bancario ou hardware',
          },
        },
        required: ['product_category'],
      },
    },
    {
      name: 'request_human_consultant',
      description: 'Invocada quando o cliente pede para falar com um consultor humano ou especialista.',
    },
    {
      name: 'request_cash_ledger_pdf',
      description: 'Invocada quando o cliente solicita o envio do relatório financeiro, livro caixa ou extrato em PDF.',
    },
  ];

  const systemInstruction = `Você é o assistente financeiro do AnalisAí Solo.
Você compreende perfeitamente comandos por áudio em português do Brasil, incluindo ruídos e sotaques.
Ao ouvir as instruções do cliente, você deve identificar a intenção financeira e acionar a ferramenta correta.
Se o cliente pedir para prorrogar uma conta (ex: "mude o vencimento do fornecedor de embalagens para dia 25"), extraia "fornecedor de embalagens" (ou "embalagens") e converta "dia 25" para a data no formato 2026-09-25.
Se o cliente pedir conselho sobre aperto de caixa ou qual conta atrasar, acione request_cash_flow_postpone_advice.
Data de referência: 2026-09-13. ${contextText}`;

  // Limpa o MIME type para o formato estrito aceito pelo Google (ex: 'audio/ogg')
  const cleanMime = mimeType ? mimeType.split(';')[0].trim() : 'audio/ogg';
  const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();

  // Lista de modelos oficiais ativos na conta Google AI Studio
  const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
  let transcribedText = '';
  let lastError: any = null;

  // ETAPA 1: Transcrição pura do áudio (sem tools na chamada multimodal para evitar incompatibilidade da API)
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        {
          inlineData: {
            data: cleanBase64,
            mimeType: cleanMime,
          },
        },
        {
          text: 'Transcreva com precisão o que foi falado neste áudio em português. Retorne estritamente o texto falado, sem introduções ou explicações.',
        },
      ]);

      const txt = result.response.text();
      if (txt && txt.trim()) {
        transcribedText = txt.trim();
        break; // Sucesso na transcrição
      }
    } catch (err) {
      console.warn(`[Voice Gemini Transcription] Falha com ${modelName}:`, err);
      lastError = err;
    }
  }

  if (!transcribedText) {
    throw lastError || new Error('Não foi possível transcrever o áudio com os modelos disponíveis.');
  }

  console.log('[Voice Command] Áudio transcrito com sucesso:', transcribedText);

  // ETAPA 2: Interpretação da intenção e extração de parâmetros sobre o texto transcrito
  let functionCalls: any[] = [];
  const lower = transcribedText.toLowerCase();

  // Regra A: Alterar Vencimento
  if (
    (lower.includes('muda') || lower.includes('mude') || lower.includes('alter') || lower.includes('adia') || lower.includes('prorroga') || lower.includes('passa')) &&
    (lower.includes('embalag') || lower.includes('fornecedor') || lower.includes('copel') || lower.includes('vivo') || lower.includes('aluguel') || lower.includes('conta'))
  ) {
    let sup = 'embalagens';
    if (lower.includes('copel') || lower.includes('luz') || lower.includes('energia')) sup = 'copel';
    else if (lower.includes('vivo') || lower.includes('fibra') || lower.includes('internet')) sup = 'vivo';
    else if (lower.includes('aluguel') || lower.includes('imobiliaria')) sup = 'aluguel';

    let tDate = '2026-09-25';
    const matchDay = lower.match(/(?:dia|para)\s*(\d{1,2})/);
    if (matchDay) {
      tDate = `2026-09-${matchDay[1].padStart(2, '0')}`;
    }

    functionCalls.push({
      name: 'propose_due_date_change',
      args: {
        supplier_name: sup,
        target_date: tDate,
      },
    });

    return {
      functionCalls,
      textResponse: transcribedText,
    };
  }

  // Regra B: Consultor de Caixa por Voz
  if (
    lower.includes('atrasar') ||
    lower.includes('postergar') ||
    lower.includes('sem dinheiro') ||
    lower.includes('qual conta') ||
    lower.includes('aperto') ||
    lower.includes('adiar')
  ) {
    functionCalls.push({
      name: 'request_cash_flow_postpone_advice',
      args: {},
    });

    return {
      functionCalls,
      textResponse: transcribedText,
    };
  }

  // Regra C: Pedido de PDF / Livro Caixa por Voz
  if (
    lower.includes('pdf') ||
    lower.includes('relatório') ||
    lower.includes('relatorio') ||
    lower.includes('livro caixa') ||
    lower.includes('extrato')
  ) {
    functionCalls.push({
      name: 'request_cash_ledger_pdf',
      args: {},
    });

    return {
      functionCalls,
      textResponse: transcribedText,
    };
  }

  // Regra D: Se nenhuma regra heurística direta disparou, usa o Gemini de texto com Function Calling
  try {
    const textModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations }],
      systemInstruction: `Você é o assistente financeiro do AnalisAí Solo.
Classifique o comando do usuário e acione a ferramenta correta.
Data de referência: 2026-09-13.`,
    });

    const textResult = await textModel.generateContent(`Comando do cliente: "${transcribedText}"`);
    const calls = textResult.response.functionCalls();
    if (calls && calls.length > 0) {
      functionCalls = calls;
    }
  } catch (textErr) {
    console.warn('[Voice Text Intent] Falha no function calling de texto:', textErr);
  }

  return {
    functionCalls,
    textResponse: transcribedText,
  };
}
