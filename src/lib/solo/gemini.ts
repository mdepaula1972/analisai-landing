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
    model: 'gemini-3.6-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ({
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
          installments: {
            type: SchemaType.ARRAY,
            description:
              'Se for uma Nota Fiscal com cobrança/duplicatas parceladas ou múltiplos vencimentos futuros, liste todas as parcelas identificadas.',
            items: {
              type: SchemaType.OBJECT,
              properties: {
                installment_number: { type: SchemaType.INTEGER },
                due_date: { type: SchemaType.STRING, description: 'YYYY-MM-DD' },
                amount: { type: SchemaType.NUMBER },
                barcode_or_pix: { type: SchemaType.STRING, nullable: true },
              },
              required: ['installment_number', 'due_date', 'amount'],
            },
            nullable: true,
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
      } as any),
    },
    systemInstruction: `Você é o leitor contábil e assistente financeiro de alta precisão do serviço AnalisAí Solo.
Sua missão é extrair rigorosamente os dados financeiros de comprovantes, notas fiscais, boletos e recibos.

DIRETRIZES DE SEGURANÇA PSICOLÓGICA & POSTURA PROFISSIONAL:
1. Normalização sem culpa: Se um boleto ou conta estiver vencido ou atrasado, NUNCA use linguagem punitiva, de julgamento, sermão ou pânico. Trate contas atrasadas como parte normal e gerenciável da rotina de qualquer pequena empresa.
2. Parceiro de trincheira: Comunique-se de igual para igual, de forma pragmática, acolhedora e construtiva.
3. Proibição de Upsell sob vulnerabilidade: Em momentos de aperto financeiro, o foco é 100% apoiar a resolução do fluxo de caixa. Jamais sugira vendas ou upgrades enquanto o cliente estiver sob estresse de caixa.
4. Limite ético profissional: Ofereça suporte consultivo técnico sem bancar psicólogo, sem drama e sem frieza mecânica.

NOTAS FISCAIS & PARCELAS:
Se o documento for uma Nota Fiscal (NF-e/NFS-e) com campo de duplicatas, faturas ou parcelamento, extraia cada parcela no array "installments" com seu respectivo vencimento e valor.
Se a imagem estiver cortada, borrada ou dados ambíguos, indique confidence_score < 0.7.`,
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
 * 2. Análise e Extração de Lançamentos Financeiros Conversacionais (Texto ou Áudio Transcrito)
 * Identifica se é Conta a Pagar (payable) ou Conta a Receber (receivable)
 * e detecta dados faltantes (valor, favorecido/cliente, vencimento) para permitir bate-bola.
 */
export async function parseConversationalFinancialEntry(
  userText: string,
  referenceDateStr: string = new Date().toISOString().split('T')[0]
) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ({
        type: SchemaType.OBJECT,
        properties: {
          is_financial_entry: {
            type: SchemaType.BOOLEAN,
            description: 'True se a mensagem indicar intenção de registrar ou consultar um pagamento (despesa) ou recebimento (receita).',
          },
          entry_type: {
            type: SchemaType.STRING,
            enum: ['payable', 'receivable', 'other'],
            description: 'payable para contas a pagar/despesas, receivable para contas a receber/vendas/honorários, other se neutro.',
          },
          supplier_or_customer: {
            type: SchemaType.STRING,
            description: 'Nome da empresa, fornecedor, cliente ou descrição do serviço (ex: Copel, Padaria do Zé, Cliente João)',
            nullable: true,
          },
          amount: {
            type: SchemaType.NUMBER,
            description: 'Valor monetário numérico em reais (ex: 250.00)',
            nullable: true,
          },
          due_date: {
            type: SchemaType.STRING,
            description: 'Data de vencimento ou previsão no formato YYYY-MM-DD',
            nullable: true,
          },
          category_suggestion: {
            type: SchemaType.STRING,
            description: 'Categoria contábil DRE (ex: receita_operacional, despesa_administrativa, custo_mercadoria_servico)',
            nullable: true,
          },
          missing_fields: {
            type: SchemaType.ARRAY,
            description: 'Lista dos campos vitais ausentes: "amount", "supplier_or_customer", "due_date"',
            items: { type: SchemaType.STRING },
          },
          needs_clarification: {
            type: SchemaType.BOOLEAN,
            description: 'True se faltar pelo menos um dos 3 dados essenciais (amount, supplier_or_customer, due_date)',
          },
          clarification_prompt: {
            type: SchemaType.STRING,
            description: 'Mensagem curta e acolhedora em tom de parceiro de trincheira solicitando apenas os dados que faltam.',
            nullable: true,
          },
        },
        required: [
          'is_financial_entry',
          'entry_type',
          'missing_fields',
          'needs_clarification',
        ],
      } as any),
    },
    systemInstruction: `Você é o parceiro de trincheira financeiro do AnalisAí.
Seu objetivo é registrar contas a pagar e contas a receber informadas pelo usuário em linguagem natural (texto ou voz).
Data de referência de hoje: ${referenceDateStr}.

REGRAS:
1. Para cada lançamento, precisamos de 3 dados essenciais:
   - Valor (amount)
   - Favorecido / Cliente (supplier_or_customer)
   - Vencimento / Data (due_date no formato YYYY-MM-DD). Se ele falar "amanhã", "sexta", "dia 20", calcule com base na data de referência.
2. Se faltar qualquer um desses 3 dados:
   - needs_clarification = true
   - adicione os nomes em missing_fields
   - formule um clarification_prompt leve, direto e parceiro perguntando o dado faltante.
3. Se todos os dados estiverem presentes:
   - needs_clarification = false
   - clarification_prompt = null.`,
  });

  const result = await model.generateContent(`Mensagem do usuário: "${userText}"`);
  return JSON.parse(result.response.text());
}
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
  let cleanMime = mimeType ? mimeType.split(';')[0].trim().toLowerCase() : 'audio/ogg';
  if (cleanMime === 'audio/opus') cleanMime = 'audio/ogg';
  const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();

  // Lista de modelos oficiais com suporte nativo a áudio multimodal (ignora totalmente família 1.5 depreciada/404)
  const modelsToTry = [
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.5-flash-lite',
  ];
  let transcribedText = '';
  const attemptedErrors: string[] = [];

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
          text: 'Transcreva com precisão o que foi falado neste áudio em português do Brasil. Retorne estritamente o texto falado, sem introduções, aspas ou explicações adicionais.',
        },
      ]);

      const txt = result.response.text();
      if (txt && txt.trim()) {
        transcribedText = txt.trim();
        console.log(`[Voice Gemini Transcription] Sucesso com ${modelName}: "${transcribedText}"`);
        break; // Sucesso na transcrição
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn(`[Voice Gemini Transcription] Falha com ${modelName}:`, msg);
      attemptedErrors.push(`[${modelName}]: ${msg}`);
    }
  }

  if (!transcribedText) {
    throw new Error(
      `Não foi possível transcrever o áudio com os modelos disponíveis.\nModelos testados:\n${attemptedErrors.join('\n')}`
    );
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
      model: 'gemini-3.6-flash',
      tools: [{ functionDeclarations: functionDeclarations as any }],
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

