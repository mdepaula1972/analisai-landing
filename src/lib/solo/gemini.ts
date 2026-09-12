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

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [
      {
        functionDeclarations: [
          {
            name: 'propose_due_date_change',
            description: 'Invocada quando o cliente pede para alterar, adiar ou prorrogar o vencimento de uma conta a pagar cadastrada.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                supplier_name: {
                  type: SchemaType.STRING,
                  description: 'Nome do fornecedor ou palavra-chave identificadora (ex: Copel, Vivo, Aluguel)',
                },
                target_date: {
                  type: SchemaType.STRING,
                  description: 'Nova data solicitada no formato YYYY-MM-DD ou data descrita',
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
        ],
      },
    ],
    systemInstruction: `Você é o assistente financeiro do AnalisAí Solo.
Você compreende áudios em português brasileiro com perfeição, sotaques e ruídos de fundo.
Ao ouvir as instruções do cliente, você deve identificar a intenção financeira e acionar a função técnica correta.
Se o áudio não for uma solicitação de ação específica, responda educadamente em texto objetivo orientando o usuário.
Data e contexto atual: ${new Date().toISOString().split('T')[0]}. ${contextText}`,
  });

  const result = await model.generateContent([
    {
      inlineData: {
        data: audioBase64,
        mimeType,
      },
    },
    {
      text: 'Interprete este comando de voz e determine a ação a ser executada.',
    },
  ]);

  const functionCalls = result.response.functionCalls();
  const textResponse = result.response.text();

  return {
    functionCalls: functionCalls || [],
    textResponse: textResponse || '',
  };
}
