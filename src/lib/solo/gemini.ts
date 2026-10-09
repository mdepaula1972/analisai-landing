import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ExtractedDocumentData } from '@/types/solo';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

export function getGeminiClient() {
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
                  'Código de barras numérico legível (linha digitável bancária com 44, 47 ou 48 dígitos). NUNCA insira CNPJs ou CPFs aqui (coloque em pix_key se for Pix).',
                nullable: true,
              },
              pix_key: {
                type: SchemaType.STRING,
                description:
                  'Chave Pix para pagamento informada no documento (CNPJ, CPF, celular, e-mail, chave aleatória ou payload Pix Copia e Cola).',
                nullable: true,
              },
              pix_key_type: {
                type: SchemaType.STRING,
                enum: ['cnpj', 'cpf', 'email', 'telefone', 'aleatoria', 'copia_e_cola', 'outro'],
                description: 'Tipo da chave Pix identificada',
                nullable: true,
              },
              is_rent: {
                type: SchemaType.BOOLEAN,
                description:
                  'True se o documento for notificação, recibo ou cobrança de aluguel de imóvel, condomínio ou taxa predial locatícia.',
              },
              is_insurance: {
                type: SchemaType.BOOLEAN,
                description:
                  'True se o documento for apólice, carnê, fatura ou proposta de seguradora (ex: Tokio Marine, Porto Seguro, Bradesco Seguros, etc.).',
              },
              policy_number: {
                type: SchemaType.STRING,
                description: 'Número da apólice, proposta ou contrato se legível.',
                nullable: true,
              },
              payer_name: {
                type: SchemaType.STRING,
                description:
                  'Nome do pagador, sacado, tomador de serviços ou locatário impresso no documento se identificável.',
                nullable: true,
              },
              payer_tax_id: {
                type: SchemaType.STRING,
                description:
                  'CPF ou CNPJ do pagador/sacado/tomador/locatário impresso no documento se identificável (números ou formatado).',
                nullable: true,
              },
              payer_tax_type: {
                type: SchemaType.STRING,
                enum: ['cpf', 'cnpj'],
                description: 'Indica se o pagador/sacado é Pessoa Física (cpf) ou Pessoa Jurídica (cnpj)',
                nullable: true,
              },
              confidence_score: {
                type: SchemaType.NUMBER,
                description: 'Nível de certeza da extração dos dados (0.0 a 1.0)',
              },
              category_suggestion: {
                type: SchemaType.STRING,
                description:
                  'Sugestão de categoria contábil DRE (ex: aluguel, seguro, energia_eletrica, telecomunicacoes, agua_saneamento, fornecedores_mercadoria, servicos_terceiros, tributos, combustivel, alimentacao, outros)',
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
                description:
                  'OBRIGATÓRIO: Caso a fatura, nota fiscal, carnê de seguro ou contrato contenha mais de uma parcela ou cronograma de pagamentos, extraia CADA UMA das parcelas no array com número, vencimento (YYYY-MM-DD) e valor.',
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
Sua missão é ler documentos financeiros (fotos, PDFs, comprovantes, faturas, carnês e boletos bancários brasileiros).

DIRETRIZES DE EXTRAÇÃO:
1. Priorize com extrema precisão a identificação de:
   - Fornecedor / Favorecido (counterparty_name) e CNPJ/CPF do emissor (tax_id)
   - Valor Total (total_amount)
   - Data de Vencimento (due_date)
   - Código de barras bancário (barcode_or_pix) OU Chave Pix (pix_key e pix_key_type)
   - Sacado / Pagador / Tomador / Locatário (payer_name, payer_tax_id e payer_tax_type)
2. DISTINÇÃO CRÍTICA ENTRE CÓDIGO DE BARRAS E CHAVE PIX:
   - Linha digitável bancária SEMPRE possui 44, 47 ou 48 dígitos numéricos. Preencha em barcode_or_pix.
   - NUNCA coloque CNPJ (14 dígitos) ou CPF (11 dígitos) no campo barcode_or_pix! Se o documento trouxer "PIX (CNPJ) XX.XXX.XXX/XXXX-XX" ou chave Pix, coloque a chave em pix_key e marque pix_key_type = 'cnpj' (ou 'cpf', 'email', etc.), deixando barcode_or_pix = null.
3. IDENTIFICAÇÃO DO SACADO / PAGADOR / TOMADOR / LOCATÁRIO (PJ x PF):
   - Todo boleto bancário tem campo "Sacado / Pagador" com Nome e CPF/CNPJ.
   - Toda NFS-e/NF-e tem campo "Tomador de Serviços / Destinatário" com Nome e CPF/CNPJ.
   - Recibos e contratos de locação trazem o "Locatário" (ex: MAR BRASIL SERVIÇOS LOCAÇÕES LTDA CNPJ 02.233.923/0001-19).
   - Contas pessoais trazem o titular da conta com CPF de Pessoa Física (11 dígitos).
   - Extraia SEMPRE payer_name, payer_tax_id e payer_tax_type ('cpf' ou 'cnpj') quando visível.
4. ALUGUEL E LOCAÇÃO (is_rent):
   - Se for notificação de aluguel, locação de imóvel, condomínio ou taxa de administração predial (ex: O&M Administradora de Bens, imobiliárias, etc.), marque is_rent = true e category_suggestion = 'aluguel'.
   - Se o documento trouxer discriminação de aluguel, água, luz, condomínio, o total_amount deve ser o valor total líquido a pagar.
5. SEGUROS E CARNÊS DE PAGAMENTO (is_insurance & installments):
   - Se o documento for de uma seguradora (ex: Tokio Marine Seguradora, Porto Seguro, Azul, Allianz, etc.), marque is_insurance = true e category_suggestion = 'seguro'.
   - OBRIGATÓRIO: Se o documento contiver um carnê, histórico de parcelas ou tabela de pagamento parcelado (ex: 12 parcelas mensais), você DEVE extrair TODAS as parcelas dentro do array "installments" com installment_number, due_date (YYYY-MM-DD) e amount de cada parcela!
6. Se o documento NÃO for financeiro (ex: foto de objeto, pessoa, paisagem, meme, documento não financeiro ou ilegível), defina is_financial_doc = false.
7. Se a imagem estiver cortada, borrada ou dados ambíguos, indique confidence_score < 0.7.`,
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
 * Sanitiza o nome do favorecido/fornecedor removendo ruídos de IA e textos metalinguísticos
 */
export function cleanSupplierName(raw: any): string {
  if (!raw || typeof raw !== 'string') return 'Fornecedor';
  let cleaned = raw.trim();

  // Se o modelo inseriu delimitadores técnicos ("/" ou ";")
  if (cleaned.includes('/')) {
    cleaned = cleaned.split('/')[0].trim();
  }
  if (cleaned.includes(';')) {
    cleaned = cleaned.split(';')[0].trim();
  }

  // Remove termos em inglês típicos de alucinação de LLM
  cleaned = cleaned.replace(/\b(primary supplier|processed first|standard output|compatibility check|internal evaluation|pipeline|baseline|setup sequence|validation|payload|json format|result generation|system process|finish logic|output done)\b/gi, '').trim();

  // Limpa pontuações estranhas no início e no final
  cleaned = cleaned.replace(/^[-:,\s]+|[-:,\s]+$/g, '').trim();

  if (cleaned.length > 50) {
    cleaned = cleaned.slice(0, 50).trim();
  }

  return cleaned || 'Fornecedor';
}

/**
 * 2. Análise e Extração de Lançamentos Financeiros Conversacionais (Texto ou Áudio Transcrito)
 * Identifica se é Conta a Pagar (payable) ou Conta a Receber (receivable)
 * e extrai cada compromisso citado pelo usuário para a lista de lançamentos.
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
                description: 'True se a mensagem indicar intenção de registrar contas, despesas ou receitas.',
              },
              entries: {
                type: SchemaType.ARRAY,
                description: 'Lista com TODOS os compromissos financeiros citados na mensagem.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    supplier_or_customer: {
                      type: SchemaType.STRING,
                      description: 'Nome limpo e curto da empresa, favorecido ou compromisso em português (ex: "Contabilivre", "Vivo", "CPFL Piratininga", "Sabesp", "Pensão Alimentícia", "Empréstimo Irmão"). NUNCA use textos em inglês ou explicações técnicas.',
                    },
                    amount: {
                      type: SchemaType.NUMBER,
                      description: 'Valor monetário numérico em reais (ex: 170.0, 90.0, 85.0, 1200.0, 500.0)',
                      nullable: true,
                    },
                    due_date: {
                      type: SchemaType.STRING,
                      description: 'Data de vencimento no formato YYYY-MM-DD calculada a partir de hoje',
                      nullable: true,
                    },
                    entry_type: {
                      type: SchemaType.STRING,
                      enum: ['payable', 'receivable'],
                      description: 'payable para contas a pagar/despesas/obrigações, receivable para recebimentos',
                    },
                    category_suggestion: {
                      type: SchemaType.STRING,
                      description: 'Categoria DRE simples em português (ex: contabilidade, telecomunicacoes, energia, agua, pessoal)',
                      nullable: true,
                    },
                    is_provision: {
                      type: SchemaType.BOOLEAN,
                      description: 'True se for valor estimado, variável ou aproximado (ex: energia variável)',
                    },
                    is_recurring: {
                      type: SchemaType.BOOLEAN,
                      description: 'True se for conta recorrente mensal (todo mês, todo dia X)',
                    },
                    recurrence_day: {
                      type: SchemaType.INTEGER,
                      description: 'Dia do mês do vencimento (ex: 10, 21, 3)',
                      nullable: true,
                    },
                    barcode_or_pix: {
                      type: SchemaType.STRING,
                      description: 'Código de barras numérico (linha digitável com 44-48 dígitos ou números ditados) ou chave Pix citada por voz se houver.',
                      nullable: true,
                    },
                  },
                  required: ['supplier_or_customer', 'entry_type', 'is_provision'],
                },
              },
              needs_clarification: {
                type: SchemaType.BOOLEAN,
                description: 'True apenas se o usuário quis registrar uma conta mas não informou nenhum dado essencial e não for provisão.',
              },
              clarification_prompt: {
                type: SchemaType.STRING,
                description: 'Mensagem curta e acolhedora em português solicitando os dados faltantes.',
                nullable: true,
              },
            },
            required: ['is_financial_entry', 'entries', 'needs_clarification'],
          } as any),
        },
        systemInstruction: `Você é o parceiro de trincheira financeiro do AnalisAí Solo.
Data de referência de hoje: ${referenceDateStr}.
IDIOMA OBRIGATÓRIO: Português do Brasil.
PROIBIÇÃO RIGOROSA: NUNCA gere textos em inglês, comentários de código, justificativas de sistema ou metadados de compatibilidade nos campos de saída.

OBJETIVO:
O usuário enviou uma mensagem de texto ou transcrição de áudio listando seus compromissos financeiros.
Ele pode citar 1, 2, 3, 4, 5, 6 ou mais contas no mesmo áudio ou texto!
Você DEVE identificar e incluir CADA UMA das contas citadas como um item individual dentro da lista 'entries'.

REGRAS PARA CADA ITEM EM 'entries':
1. 'supplier_or_customer': Nome LIMPO, DIRETO e CURTO em português do favorecido ou compromisso.
   Exemplos: "Contabilivre", "Vivo", "CPFL Piratininga", "Sabesp", "Pensão Alimentícia", "Empréstimo Irmão".
   NUNCA adicione frases longas, explicações ou termos em inglês como "primary supplier" ou "standard output".
2. 'amount': Valor numérico em reais (ex: 170, 90, 85, 1200, 500). Se for aproximado ("uns 90 reais", "valor aproximado"), use o valor citado e marque is_provision = true.
3. 'due_date': Data no formato YYYY-MM-DD calculada a partir de ${referenceDateStr}:
   - Se disser "todo dia 10", "dia 10": se o dia 10 já passou ou é hoje em ${referenceDateStr}, use o dia 10 do mês seguinte; senão use o mês atual.
   - Se disser "todo dia 21", "dia 21": se dia 21 já passou em ${referenceDateStr}, use o dia 21 do mês seguinte; senão use o mês atual.
   - Se disser "todo dia 3", "dia 3": se dia 3 já passou em ${referenceDateStr}, use o dia 3 do mês seguinte; senão use o mês atual.
4. 'entry_type': 'payable' para contas a pagar/despesas, 'receivable' para receitas.
5. 'is_provision': true para valores aproximados ou contas de consumo variáveis; false para valores fixos definidos.
6. 'is_recurring': true para contas pagas mensalmente ("todo mês", "todo dia X").
7. 'recurrence_day': número do dia informado (ex: 10, 21, 3).
8. 'barcode_or_pix': Se o usuário ditar ou escrever um código de barras, linha digitável ou chave Pix (ex: "com código de barras 8467...", "chave pix CNPJ tal"), extraia no campo barcode_or_pix de cada conta correspondente apenas os dígitos ou chave limpa.`,
      });

      const result = await model.generateContent(`Mensagem do usuário: "${userText}"`);
      const parsed = JSON.parse(result.response.text());

      // Normaliza e higieniza cada entrada de 'entries'
      const normalizedEntries: any[] = [];
      if (Array.isArray(parsed.entries)) {
        for (const item of parsed.entries) {
          const cleanName = cleanSupplierName(item.supplier_or_customer);
          if (cleanName && cleanName !== 'Fornecedor' || item.amount || item.due_date) {
            normalizedEntries.push({
              supplier_or_customer: cleanName,
              amount: item.amount ? Number(item.amount) : null,
              due_date: item.due_date || null,
              barcode_or_pix: item.barcode_or_pix ? String(item.barcode_or_pix).trim() : null,
              entry_type: item.entry_type || 'payable',
              category_suggestion: item.category_suggestion || 'despesa_administrativa',
              is_provision: Boolean(item.is_provision),
              is_recurring: Boolean(item.is_recurring),
              recurrence_day: item.recurrence_day || null,
            });
          }
        }
      }

      parsed.entries = normalizedEntries;

      if (parsed.entries.length > 0) {
        parsed.is_financial_entry = true;
        parsed.needs_clarification = false;
        const first = parsed.entries[0];
        parsed.supplier_or_customer = first.supplier_or_customer;
        parsed.amount = first.amount;
        parsed.due_date = first.due_date;
        parsed.entry_type = first.entry_type;
        parsed.category_suggestion = first.category_suggestion;
        parsed.is_provision = first.is_provision;
      }

      return parsed;
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
  contextText: string = '',
  transcribeOnly: boolean = false
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
    {
      name: 'consult_tax_meter',
      description: 'Invocada quando o usuário pergunta sobre limite de faturamento anual, teto de MEI ou Simples Nacional, margem de segurança fiscal ou termômetro tributário (ex: "como está meu limite de MEI?", "quanto posso faturar no Simples?", "ver termômetro fiscal", "risco de desenquadramento").',
    },
  ];

  // Limpa o MIME type para o formato estrito aceito pelo Google (ex: 'audio/ogg')
  let cleanMime = mimeType ? mimeType.split(';')[0].trim().toLowerCase() : 'audio/ogg';
  if (cleanMime === 'audio/opus') cleanMime = 'audio/ogg';
  const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();

  // Lista de modelos oficiais com suporte nativo a áudio multimodal (Gemini 3 oficial)
  // gemini-3.5-flash-lite processa áudios em < 1.5s com altíssima precisão e estabilidade
  const modelsToTry = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.1-pro-preview',
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

  // Se a chamada requereu apenas a transcrição do áudio (ex: degustação trial ou parsing direto), retorna imediatamente
  if (transcribeOnly) {
    return {
      functionCalls: [],
      textResponse: transcribedText,
    };
  }

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

export interface SupplierRenameAction {
  current_name_query: string;
  new_name: string;
}

export interface AmountChangeAction {
  supplier_query: string;
  new_amount: number;
}

export interface DueDateChangeAction {
  supplier_query: string;
  new_due_date_raw: string;
}

export interface ConversationalCorrectionsResult {
  has_corrections: boolean;
  renames: SupplierRenameAction[];
  amount_changes: AmountChangeAction[];
  due_date_changes: DueDateChangeAction[];
}

/**
 * Interpreta pedidos em linguagem natural para corrigir ou editar dados de contas já cadastradas.
 * Identifica renomeações de fornecedores/favorecidos, alterações de valor e de vencimento.
 * Exemplo: "onde está Contalivre da contabilidade é Contabilivre, onde está Julia Facundo é Julia Faco Guion de Paula"
 */
export async function parseConversationalCorrections(
  userText: string
): Promise<ConversationalCorrectionsResult> {
  const genAI = getGeminiClient();
  const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ({
            type: SchemaType.OBJECT,
            properties: {
              has_corrections: {
                type: SchemaType.BOOLEAN,
                description: 'True se a mensagem solicita correção, alteração ou edição de nomes de fornecedores, valores ou datas de contas existentes.',
              },
              renames: {
                type: SchemaType.ARRAY,
                description: 'Lista de correções de nome de fornecedor/favorecido (ex: de X para Y, onde está X é Y, mudar nome de X para Y).',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    current_name_query: {
                      type: SchemaType.STRING,
                      description: 'Nome atual ou trecho citado para busca (ex: "Contalivre", "Julia Facundo", "Persi")',
                    },
                    new_name: {
                      type: SchemaType.STRING,
                      description: 'Novo nome correto desejado (ex: "Contabilivre", "Julia Faco Guion de Paula", "Perci")',
                    },
                  },
                  required: ['current_name_query', 'new_name'],
                },
              },
              amount_changes: {
                type: SchemaType.ARRAY,
                description: 'Lista de alterações de valor solicitadas.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    supplier_query: {
                      type: SchemaType.STRING,
                      description: 'Nome da conta ou fornecedor',
                    },
                    new_amount: {
                      type: SchemaType.NUMBER,
                      description: 'Novo valor numérico em reais',
                    },
                  },
                  required: ['supplier_query', 'new_amount'],
                },
              },
              due_date_changes: {
                type: SchemaType.ARRAY,
                description: 'Lista de alterações de data de vencimento solicitadas.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    supplier_query: {
                      type: SchemaType.STRING,
                      description: 'Nome da conta ou fornecedor',
                    },
                    new_due_date_raw: {
                      type: SchemaType.STRING,
                      description: 'Nova data informada (ex: "10", "15/10", "dia 20")',
                    },
                  },
                  required: ['supplier_query', 'new_due_date_raw'],
                },
              },
            },
            required: ['has_corrections', 'renames', 'amount_changes', 'due_date_changes'],
          } as any),
        },
        systemInstruction: `Você é o analisador de correções e edições financeiras do assistente AnalisAí.
Sua missão é extrair exatamente quais contas o usuário deseja editar ou corrigir.
Preste muita atenção em expressões brasileiras como:
- "onde está X é Y" / "onde tá X coloca Y" -> renomear X para Y.
- "Persi com S é Persi com C" -> current_name_query: "Persi", new_name: "Perci".
- "Contalivre da contabilidade é Contabilivre" -> current_name_query: "Contalivre", new_name: "Contabilivre".
- "mudar valor de X para R$ Y" -> amount_change.
- "mudar vencimento de X para dia Y" -> due_date_change.
Se a mensagem for apenas um novo lançamento ou bate-papo, retorne has_corrections: false com arrays vazios.`,
      });

      const res = await model.generateContent(`Mensagem do usuário: "${userText}"`);
      const txt = res.response.text();
      const parsed = JSON.parse(txt);

      return {
        has_corrections: Boolean(parsed.has_corrections),
        renames: Array.isArray(parsed.renames) ? parsed.renames : [],
        amount_changes: Array.isArray(parsed.amount_changes) ? parsed.amount_changes : [],
        due_date_changes: Array.isArray(parsed.due_date_changes) ? parsed.due_date_changes : [],
      };
    } catch (err) {
      console.warn(`[parseConversationalCorrections] Erro no modelo ${modelName}:`, err);
    }
  }

  return {
    has_corrections: false,
    renames: [],
    amount_changes: [],
    due_date_changes: [],
  };
}
