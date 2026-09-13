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
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
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
  ];

  const systemInstruction = `Você é o assistente financeiro do AnalisAí Solo.
Você compreende perfeitamente comandos por áudio em português do Brasil, incluindo ruídos e sotaques.
Ao ouvir as instruções do cliente, você deve identificar a intenção financeira e acionar a ferramenta correta.
Se o cliente pedir para prorrogar uma conta (ex: "mude o vencimento do fornecedor de embalagens para dia 25"), extraia "fornecedor de embalagens" (ou "embalagens") e converta "dia 25" para a data no formato 2026-09-25.
Se o cliente pedir conselho sobre aperto de caixa ou qual conta atrasar, acione request_cash_flow_postpone_advice.
Data de referência: 2026-09-13. ${contextText}`;

  // Tenta gemini-1.5-flash e em caso de falha tenta gemini-2.0-flash
  const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: [{ functionDeclarations }],
        systemInstruction,
      });

      const result = await model.generateContent([
        {
          inlineData: {
            data: audioBase64,
            mimeType,
          },
        },
        {
          text: 'Interprete este áudio e acione a função técnica correta com os parâmetros identificados.',
        },
      ]);

      const functionCalls = result.response.functionCalls();
      let textResponse = '';
      try {
        textResponse = result.response.text();
      } catch {
        textResponse = '';
      }

      return {
        functionCalls: functionCalls || [],
        textResponse: textResponse || '',
      };
    } catch (err) {
      console.warn(`[Voice Gemini] Tentativa com ${modelName} falhou:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('Falha ao processar áudio com os modelos disponíveis.');
}
