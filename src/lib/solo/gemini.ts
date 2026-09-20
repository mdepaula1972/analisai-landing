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
  const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
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
                description: 'Data de vencimento no formato YYYY-MM-DD se identificável',
                nullable: true,
              },
              issue_date: {
                type: SchemaType.STRING,
                description: 'Data de emissão no formato YYYY-MM-DD se identificável',
                nullable: true,
              },
              barcode_or_pix: {
                type: SchemaType.STRING,
                description:
                  'Código de barras numérico legível (linha digitável de 47 ou 48 dígitos) ou chave Pix / payload Pix copia e cola presente no documento.',
                nullable: true,
              },
              confidence_score: {
                type: SchemaType.NUMBER,
                description: 'Nível de certeza da extração dos dados (0.0 a 1.0)',
              },
              category_suggestion: {
                type: SchemaType.STRING,
                description:
                  'Sugestão de categoria contábil DRE (ex: energia_eletrica, telecomunicacoes, agua_saneamento, fornecedores_mercadoria, servicos_terceiros, tributos, aluguel, combustivel, alimentacao, outros)',
                nullable: true,
              },
              critical_notes: {
                type: SchemaType.STRING,
                description:
                  'Observações relevantes para o gestor: juros diários expressivos por atraso, risco de protesto em cartório, corte iminente de serviço essencial ou desconto por pagamento pontual.',
                nullable: true,
              },
              installments: {
                type: SchemaType.ARRAY,
                description: 'Caso a nota/fatura contenha mais de uma parcela ou duplicata',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    installment_number: { type: SchemaType.NUMBER },
                    due_date: { type: SchemaType.STRING },
                    amount: { type: SchemaType.NUMBER },
                  },
                },
                nullable: true,
              },
              analysis_advice: {
                type: SchemaType.STRING,
                description:
                  'Conselho estratégico do AnalisAí: tom humano, parceiro e experiente (parceiro de trincheira). Ex: "Sabesp com corte iminente se passar de 15 dias de atraso. Priorize quitar hoje."',
                nullable: true,
              },
            },
            required: [
              'is_financial_doc',
              'doc_type',
              'counterparty_name',
              'total_amount',
              'confidence_score',
            ],
          } as any),
        },
        systemInstruction: `Você é o AnalisAí Solo, um assistente contábil e financeiro de inteligência artificial de elite.
Sua missão é ler documentos financeiros (fotos, PDFs, comprovantes, faturas e boletos bancários brasileiros).

DIRETRIZES DE EXTRAÇÃO:
1. Priorize com extrema precisão a identificação de:
   - Fornecedor / Favorecido (counterparty_name)
   - Valor Total (total_amount)
   - Data de Vencimento (due_date)
   - Código de barras ou Pix Copia e Cola (barcode_or_pix)
2. Se o documento NÃO for financeiro (ex: foto de cachorro, paisagem, contrato longo sem valor de fatura, documento ilegível), defina is_financial_doc = false.
3. Tom parceiro de trincheira: Sempre que identificar encargos pesados (multa > 2% ou juros altos), alerte em critical_notes e analysis_advice de forma rápida e prática.
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
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Extract Doc] Falha com ${modelName}, tentando próximo modelo:`, err);
    }
  }

  throw lastError || new Error('Falha ao analisar documento com Gemini.');
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
  const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
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
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Parse Entry] Falha com ${modelName}, tentando próximo:`, err);
    }
  }

  throw lastError || new Error('Falha ao interpretar mensagem financeira com Gemini.');
}
export async function processVoiceCommandWithGemini(
  audioBase64: string,
  mimeType: string = 'audio/ogg; codecs=opus',
  contextText: string = ''
) {
  const genAI = getGeminiClient();

  const functionDeclarations = [
    {
      name: 'list_bills',
      description: 'Invocada quando o cliente quer consultar, listar ou ver suas contas a pagar cadastradas, contas a vencer ou contas vencidas.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          filter: {
            type: SchemaType.STRING,
            description: '"all" para todas as contas em aberto, "overdue" para apenas vencidas, ou "upcoming" para a vencer.',
          },
        },
      },
    },
    {
      name: 'propose_amount_change',
      description: 'Invocada quando o cliente pede para alterar, mudar ou atualizar o VALOR monetário (em R$) de uma conta a pagar cadastrada. (Ex: "mudar valor da Sabesp para 85,00" ou "Sabesp alterar para 85 reais")',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          supplier_name: {
            type: SchemaType.STRING,
            description: 'Nome do fornecedor ou identificador da conta (ex: Sabesp, Copel, Vivo, etc.)',
          },
          new_amount: {
            type: SchemaType.NUMBER,
            description: 'Novo valor numérico em reais (ex: 85.00 ou 85.45)',
          },
        },
        required: ['supplier_name', 'new_amount'],
      },
    },
    {
      name: 'propose_due_date_change',
      description: 'Invocada quando o cliente pede para alterar, adiar ou prorrogar a DATA DE VENCIMENTO de uma conta a pagar cadastrada. NÃO usar quando o pedido for para mudar o VALOR monetário.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          supplier_name: {
            type: SchemaType.STRING,
            description: 'Nome do fornecedor ou palavra-chave identificadora (ex: Copel, Vivo, Sabesp, Aluguel)',
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

  // Limpa o MIME type para o formato estrito aceito pelo Google (ex: 'audio/ogg')
  let cleanMime = mimeType ? mimeType.split(';')[0].trim().toLowerCase() : 'audio/ogg';
  if (cleanMime === 'audio/opus') cleanMime = 'audio/ogg';
  const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();

  // Lista de modelos oficiais com suporte nativo a áudio multimodal (Gemini 3 oficial)
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
        break;
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

  // 1. Consulta / Listagem de Contas a Pagar por Voz
  if (
    lower.includes('contas cadastradas') ||
    lower.includes('contas a vencer') ||
    lower.includes('contas vencidas') ||
    lower.includes('mostrar contas') ||
    lower.includes('mostre as contas') ||
    lower.includes('mostrar as contas') ||
    lower.includes('mostre-me todas as contas') ||
    lower.includes('listar contas') ||
    lower.includes('quais contas') ||
    lower.includes('todas as contas') ||
    (lower.includes('contas') && (lower.includes('vencer') || lower.includes('vencida')))
  ) {
    let filter = 'all';
    if (lower.includes('vencida') && !lower.includes('a vencer')) filter = 'overdue';
    else if (lower.includes('a vencer') && !lower.includes('vencida')) filter = 'upcoming';

    functionCalls.push({
      name: 'list_bills',
      args: { filter },
    });

    return {
      functionCalls,
      textResponse: transcribedText,
    };
  }

  // 2. Alteração de VALOR de Conta por Voz (ex: "mudar valor da Sabesp para 85,00" ou "alterar valor Sabesp para 85")
  const amountMatch =
    lower.match(/(?:mudar|alterar|corrigir|trocar)\s+(?:o\s+)?valor\s+(?:d[ao]\s+)?([a-z0-9\s]+?)\s+(?:de\s+[\d.,]+\s+)?para\s+([0-9.,]+)/i) ||
    lower.match(/([a-z0-9\s]+?)[,;\s]+(?:mudar|alterar|corrigir)\s+valor\s+(?:de\s+[\d.,]+\s+)?para\s+([0-9.,]+)/i) ||
    lower.match(/(?:mudar|alterar)\s+([a-z0-9\s]+?)\s+para\s+([0-9.,]+)\s+reais/i);

  if (amountMatch) {
    const rawSupplier = amountMatch[1].replace(/^(conta\s+d[ao]|fornecedor\s+d[ao]|conta)\s+/i, '').trim();
    const rawValStr = amountMatch[2].replace(/\./g, '').replace(',', '.');
    const parsedVal = parseFloat(rawValStr);
    if (!isNaN(parsedVal) && parsedVal > 0 && rawSupplier.length >= 2) {
      functionCalls.push({
        name: 'propose_amount_change',
        args: {
          supplier_name: rawSupplier,
          new_amount: parsedVal,
        },
      });

      return {
        functionCalls,
        textResponse: transcribedText,
      };
    }
  }

  // 3. Alteração de DATA DE VENCIMENTO por Voz (ex: "mudar vencimento da Copel para dia 25")
  if (
    (lower.includes('vencimento') || lower.includes('adiar') || lower.includes('postergar') || lower.includes('prorrogar') || lower.includes('passar')) &&
    !lower.includes('valor')
  ) {
    const supplierMatch = lower.match(/(?:conta|fornecedor|do|da)\s+([a-z0-9\s]+?)\s+(?:para|pro|dia)/i);
    let sup = supplierMatch ? supplierMatch[1].trim() : '';
    const matchDay = lower.match(/(?:dia|para)\s*(\d{1,2})/);
    let tDate = matchDay ? `2026-09-${matchDay[1].padStart(2, '0')}` : '2026-09-25';

    if (sup.length >= 2) {
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
  }

  // 4. Consultor de Caixa por Voz
  if (
    lower.includes('atrasar') ||
    lower.includes('postergar') ||
    lower.includes('sem dinheiro') ||
    lower.includes('qual conta') ||
    lower.includes('aperto')
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

  // 5. Pedido de PDF / Livro Caixa por Voz
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

  // 6. Gemini 3.6 Flash com Function Calling para extração precisa
  try {
    const textModel = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      tools: [{ functionDeclarations: functionDeclarations as any }],
      systemInstruction: `Você é o assistente financeiro do AnalisAí Solo.
Classifique o comando do usuário e acione a ferramenta correta.
Se o usuário pedir para listar contas, acione list_bills.
Se pedir para mudar o valor em dinheiro, acione propose_amount_change com supplier_name e new_amount.
Se pedir para adiar ou prorrogar a data, acione propose_due_date_change com supplier_name e target_date.
Data de referência: 2026-09-19.`,
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
