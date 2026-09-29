import { SchemaType } from '@google/generative-ai';
import { getGeminiClient } from './gemini';

export interface UserConversationalContext {
  userId: string;
  userName: string;
  phone: string;
  isAdmin: boolean;
  userType: 'subscriber' | 'trial' | 'operator';
  plan: string;
  companyName?: string;
  hasOpenBills?: boolean;
}

export type ConversationalIntentType =
  | 'INVITE_GUEST'
  | 'TEAM_MANAGEMENT'
  | 'QUERY_BILLS'
  | 'GET_PAYMENT_CODE'
  | 'EDIT_BILL'
  | 'DELETE_BILL'
  | 'RECORD_FINANCIAL_ENTRY'
  | 'REQUEST_PDF_REPORT'
  | 'CASH_FLOW_ADVICE'
  | 'VIEW_PLANS_PRICING'
  | 'ADMIN_SIMULATION'
  | 'GENERAL_CONVERSATION';

export interface RoutedDecision {
  intent: ConversationalIntentType;
  confidence: number;
  is_applicable: boolean;
  inapplicable_message?: string;
  invite_params?: {
    phone?: string;
    name?: string;
    target_role?: 'qa_test' | 'team_operator' | 'referral';
  };
  team_params?: {
    action?: 'list' | 'add' | 'remove' | 'silence' | 'unsilence';
    phone?: string;
    name?: string;
  };
  bills_query_params?: {
    period?: 'today' | 'tomorrow' | 'week' | 'month' | 'all';
  };
  payment_code_params?: {
    supplier_query?: string;
  };
  edit_params?: {
    renames?: Array<{ current_name_query: string; new_name: string }>;
    amount_changes?: Array<{ supplier_query: string; new_amount: number }>;
    due_date_changes?: Array<{ supplier_query: string; new_due_date_raw: string }>;
  };
  delete_params?: {
    supplier_query?: string;
  };
  financial_entries?: Array<{
    supplier_or_customer: string;
    amount?: number | null;
    due_date?: string | null;
    entry_type: 'payable' | 'receivable';
    category?: string | null;
    is_provision?: boolean;
  }>;
  report_params?: {
    report_type: 'cash_ledger' | 'dre' | 'xray';
  };
  simulation_params?: {
    action: string;
    target_plan?: string;
  };
  conversational_reply?: string;
}

/**
 * Cérebro Central de Compreensão e Roteamento de Linguagem Natural do AnalisAí.
 * Avalia o áudio/texto do usuário com base no perfil (Dono, Admin, MEI, Degustação, Operador)
 * e determina a ação semanticamente aplicável sem depender de comandos rígidos ou '!'.
 */
export async function routeConversationalIntent(
  userText: string,
  context: UserConversationalContext
): Promise<RoutedDecision> {
  const genAI = getGeminiClient();
  const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];

  const prompt = `MENSAGEM DO USUÁRIO: "${userText}"

DADOS DO USUÁRIO:
- Nome: ${context.userName}
- Telefone: ${context.phone}
- Tipo: ${context.userType}
- Admin: ${context.isAdmin ? 'SIM' : 'NÃO'}
- Plano: ${context.plan}
- Empresa: ${context.companyName || 'Não informada'}
- Possui contas cadastradas: ${context.hasOpenBills ? 'SIM' : 'NÃO'}`;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ({
            type: SchemaType.OBJECT,
            properties: {
              intent: {
                type: SchemaType.STRING,
                enum: [
                  'INVITE_GUEST',
                  'TEAM_MANAGEMENT',
                  'QUERY_BILLS',
                  'GET_PAYMENT_CODE',
                  'EDIT_BILL',
                  'DELETE_BILL',
                  'RECORD_FINANCIAL_ENTRY',
                  'REQUEST_PDF_REPORT',
                  'CASH_FLOW_ADVICE',
                  'VIEW_PLANS_PRICING',
                  'ADMIN_SIMULATION',
                  'GENERAL_CONVERSATION',
                ],
              },
              confidence: {
                type: SchemaType.NUMBER,
                description: 'Confiança de 0.0 a 1.0',
              },
              is_applicable: {
                type: SchemaType.BOOLEAN,
                description: 'True se a ação solicitada é permitida para o perfil deste usuário',
              },
              inapplicable_message: {
                type: SchemaType.STRING,
                description: 'Explicação amigável em caso de ação não permitida',
                nullable: true,
              },
              invite_params: {
                type: SchemaType.OBJECT,
                properties: {
                  phone: { type: SchemaType.STRING, nullable: true },
                  name: { type: SchemaType.STRING, nullable: true },
                  target_role: {
                    type: SchemaType.STRING,
                    enum: ['qa_test', 'team_operator', 'referral'],
                    nullable: true,
                  },
                },
                nullable: true,
              },
              team_params: {
                type: SchemaType.OBJECT,
                properties: {
                  action: {
                    type: SchemaType.STRING,
                    enum: ['list', 'add', 'remove', 'silence', 'unsilence'],
                    nullable: true,
                  },
                  phone: { type: SchemaType.STRING, nullable: true },
                  name: { type: SchemaType.STRING, nullable: true },
                },
                nullable: true,
              },
              bills_query_params: {
                type: SchemaType.OBJECT,
                properties: {
                  period: {
                    type: SchemaType.STRING,
                    enum: ['today', 'tomorrow', 'week', 'month', 'all'],
                    nullable: true,
                  },
                },
                nullable: true,
              },
              payment_code_params: {
                type: SchemaType.OBJECT,
                properties: {
                  supplier_query: { type: SchemaType.STRING, nullable: true },
                },
                nullable: true,
              },
              edit_params: {
                type: SchemaType.OBJECT,
                properties: {
                  renames: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        current_name_query: { type: SchemaType.STRING },
                        new_name: { type: SchemaType.STRING },
                      },
                      required: ['current_name_query', 'new_name'],
                    },
                    nullable: true,
                  },
                  amount_changes: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        supplier_query: { type: SchemaType.STRING },
                        new_amount: { type: SchemaType.NUMBER },
                      },
                      required: ['supplier_query', 'new_amount'],
                    },
                    nullable: true,
                  },
                  due_date_changes: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        supplier_query: { type: SchemaType.STRING },
                        new_due_date_raw: { type: SchemaType.STRING },
                      },
                      required: ['supplier_query', 'new_due_date_raw'],
                    },
                    nullable: true,
                  },
                },
                nullable: true,
              },
              delete_params: {
                type: SchemaType.OBJECT,
                properties: {
                  supplier_query: { type: SchemaType.STRING, nullable: true },
                },
                nullable: true,
              },
              financial_entries: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    supplier_or_customer: { type: SchemaType.STRING },
                    amount: { type: SchemaType.NUMBER, nullable: true },
                    due_date: { type: SchemaType.STRING, nullable: true },
                    entry_type: { type: SchemaType.STRING, enum: ['payable', 'receivable'] },
                    category: { type: SchemaType.STRING, nullable: true },
                    is_provision: { type: SchemaType.BOOLEAN, nullable: true },
                  },
                  required: ['supplier_or_customer', 'entry_type'],
                },
                nullable: true,
              },
              report_params: {
                type: SchemaType.OBJECT,
                properties: {
                  report_type: {
                    type: SchemaType.STRING,
                    enum: ['cash_ledger', 'dre', 'xray'],
                  },
                },
                nullable: true,
              },
              simulation_params: {
                type: SchemaType.OBJECT,
                properties: {
                  action: { type: SchemaType.STRING },
                  target_plan: { type: SchemaType.STRING, nullable: true },
                },
                nullable: true,
              },
              conversational_reply: {
                type: SchemaType.STRING,
                description: 'Resposta conversacional cordial, direta e acolhedora em português do Brasil quando couber resposta direta',
                nullable: true,
              },
            },
            required: ['intent', 'confidence', 'is_applicable'],
          } as any),
        },
        systemInstruction: `Você é o Cérebro Central de Compreensão e Roteamento de Linguagem Natural do AnalisAí, o assistente financeiro no WhatsApp.
Sua missão é entender com perfeição o que o usuário quer fazer, a partir de áudios transcritos ou mensagens de texto em português brasileiro falado natural, SEM EXIGIR NENHUM COMANDO FIXO OU '!'.

Categorias de Intenção:
- INVITE_GUEST: Convidar alguém para testar, enviar convite VIP, liberar acesso livre para amigo/parceiro (ex: "convidar o Luizão no zap 14 99894-7271", "manda um convite pro Luizão testar", "libera o zap do meu amigo").
  ↳ Extraia o telefone limpo ou formatado e o nome da pessoa.
  ↳ Se o usuário for Administrador, o target_role deve ser 'qa_test'. Se for cliente normal, 'referral'.
- TEAM_MANAGEMENT: Gestão de operadores da empresa (ex: "quem tá na minha equipe?", "adiciona o Luizão na minha equipe", "remover operador", "silencia os avisos da Maria").
- QUERY_BILLS: Consultar contas agendadas (ex: "ver minhas contas", "o que tenho que pagar essa semana?", "contas de hoje", "quais boletos vencem esse mês?", "minhas contas", "1", "um").
- GET_PAYMENT_CODE: Pedir linha digitável, código de barras ou Pix para pagar/antecipar (ex: "pagar sabesp", "código da vivo", "passa o pix do aluguel", "2", "dois").
- EDIT_BILL: Alterar valor, vencimento ou renomear fornecedores (ex: "mudar vencimento da sabesp pro dia 20", "mudar valor do aluguel pra 1600", "onde tá Contalivre é Contabilivre, Persi com S é com C", "corrija os fornecedores").
- DELETE_BILL: Excluir ou cancelar uma conta (ex: "excluir conta da Sabesp", "apagar boleto do fornecedor").
- RECORD_FINANCIAL_ENTRY: Lançar despesa ou receita nova (ex: "gastei 45 de gasolina", "recebi 800 do cliente Pedro", "anota pagar Vivo 120 dia 22", "aluguel 1500 dia 5").
- REQUEST_PDF_REPORT: Solicitar relatório, Livro Caixa ou DRE em PDF (ex: "me manda o relatório", "quero o livro caixa em PDF", "gerar PDF").
- CASH_FLOW_ADVICE: Dúvidas financeiras e de caixa (ex: "qual conta devo atrasar?", "meu caixa fecha positivo?", "o que fazer se faltar dinheiro?").
- VIEW_PLANS_PRICING: Consultar planos, valores, upgrade, assinar (ex: "quanto custa?", "quais os planos?", "como assinar?").
- ADMIN_SIMULATION: Exclusivo para administradores testando cenários (ex: "simular plano start", "resetar meus contadores", "gerar contas de teste", "estourar limite").
  ↳ Se o usuário NÃO for Admin, is_applicable = false, e explique educadamente.
- GENERAL_CONVERSATION: Saudações ("oi", "olá", "bom dia"), perguntas sobre como o AnalisAí funciona, ou bate-papo informal.

Seja preciso, tolerante com erros de digitação e variações fonéticas.`,
      });

      const res = await model.generateContent(prompt);
      const text = res.response.text();
      const parsed = JSON.parse(text);

      return {
        intent: parsed.intent || 'GENERAL_CONVERSATION',
        confidence: Number(parsed.confidence) || 0.9,
        is_applicable: Boolean(parsed.is_applicable),
        inapplicable_message: parsed.inapplicable_message || undefined,
        invite_params: parsed.invite_params || undefined,
        team_params: parsed.team_params || undefined,
        bills_query_params: parsed.bills_query_params || undefined,
        payment_code_params: parsed.payment_code_params || undefined,
        edit_params: parsed.edit_params || undefined,
        delete_params: parsed.delete_params || undefined,
        financial_entries: parsed.financial_entries || undefined,
        report_params: parsed.report_params || undefined,
        simulation_params: parsed.simulation_params || undefined,
        conversational_reply: parsed.conversational_reply || undefined,
      };
    } catch (err) {
      console.warn(`[routeConversationalIntent] Erro no modelo ${modelName}:`, err);
    }
  }

  return {
    intent: 'GENERAL_CONVERSATION',
    confidence: 0.5,
    is_applicable: true,
  };
}
