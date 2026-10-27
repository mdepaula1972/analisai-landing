import { SchemaType } from '@google/generative-ai';
import { getGeminiClient } from './gemini';
import { validateOperatorPermissions } from './team-guard';
import { ActiveFinancialSnapshot } from './active-context';

export interface UserConversationalContext {
  userId: string;
  userName: string;
  phone: string;
  isAdmin: boolean;
  userType: 'subscriber' | 'trial' | 'operator';
  plan: string;
  companyName?: string;
  hasOpenBills?: boolean;
  activeBillsSummary?: string;
  lastBillSummary?: string;
  snapshot?: ActiveFinancialSnapshot;
}

export type ConversationalIntentType =
  | 'SETTLE_ACCOUNT'
  | 'CLARIFICATION_NEEDED'
  | 'NEW_ENTRY'
  | 'POSTPONE_ACCOUNT'
  | 'CANCEL_ACCOUNT'
  | 'GENERAL_QUERY'
  | 'INVITE_GUEST'
  | 'TEAM_MANAGEMENT'
  | 'QUERY_BILLS'
  | 'GET_PAYMENT_CODE'
  | 'EDIT_BILL'
  | 'DELETE_BILL'
  | 'RECORD_FINANCIAL_ENTRY'
  | 'MARK_RECEIVABLE_AS_RECEIVED'
  | 'MARK_BILL_AS_PAID'
  | 'REQUEST_PDF_REPORT'
  | 'REQUEST_ACCOUNTING_CLOSING'
  | 'CASH_FLOW_ADVICE'
  | 'VIEW_PLANS_PRICING'
  | 'ADMIN_SIMULATION'
  | 'REQUEST_DASHBOARD_ACCESS'
  | 'ADJUST_BALANCE'
  | 'GENERAL_CONVERSATION';

export interface RoutedDecision {
  intent: ConversationalIntentType;
  confidence: number;
  is_applicable: boolean;
  inapplicable_message?: string;
  target_account_id?: string;
  target_type?: 'payable' | 'receivable';
  target_amount?: number;
  target_description?: string;
  reply_text?: string;
  invite_params?: {
    phone?: string;
    name?: string;
    target_role?: 'qa_test' | 'team_operator';
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
  mark_paid_params?: {
    supplier_or_customer?: string;
    amount?: number | null;
    is_income?: boolean;
    bill_id?: string;
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
  closing_params?: {
    period?: string;
    send_to_accountant?: boolean;
  };
  simulation_params?: {
    action: string;
    target_plan?: string;
  };
  balance_adjustment_params?: {
    reported_balance: number;
  };
  conversational_reply?: string;
}

/**
 * Converte strings numéricas em formato brasileiro ou internacional para number
 */
export function parseBalanceNumber(rawStr: string): number {
  let clean = rawStr.trim().replace(/^r\$\s*/i, '');
  if (clean.includes(',') && clean.includes('.')) {
    // 2.500,50 -> 2500.50
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    // 2500,50 -> 2500.50
    clean = clean.replace(',', '.');
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = clean.replace(/\./g, '');
    } else if (parts[1] && parts[1].length === 3) {
      // 2.500 -> 2500
      clean = parts[0] + parts[1];
    }
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
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
  const cleanUserText = userText.trim();

  // ── FAST PATH 1: Calibração ou Ajuste de Saldo de Caixa (Tarefa 5) ──
  // Mensagens como: "meu saldo hoje é X", "saldo atual 2500", "ajustar saldo para 4000", "calibrar saldo 1500"
  const balanceRegex = /^(?:(?:ol[aá]|oi|bom dia|boa tarde|boa noite)[\s,!.]*)?(?:(?:meu\s+)?saldo\s*(?:hoje|atual|em conta|banc[aá]rio)?\s*(?:[eé]|de|em|pra|para)?\s*(?:r\$)?\s*(-?[\d.,]+)|(?:ajustar|calibrar|atualizar|definir)\s+(?:(?:meu\s+)?saldo\s*(?:hoje|atual|em conta|banc[aá]rio)?\s*(?:[eé]|de|em|pra|para)?\s*(?:r\$)?\s*(-?[\d.,]+)))/i;
  const balanceMatch = cleanUserText.match(balanceRegex);
  if (balanceMatch) {
    const rawVal = balanceMatch[1] || balanceMatch[2];
    if (rawVal) {
      const parsedNum = parseBalanceNumber(rawVal);
      const isOperator = context.userType === 'operator';
      const permCheck = validateOperatorPermissions(isOperator ? 'operator' : 'admin', 'ADJUST_BALANCE');
      return {
        intent: 'ADJUST_BALANCE',
        confidence: 1.0,
        is_applicable: permCheck.allowed,
        inapplicable_message: permCheck.refusalMessage,
        balance_adjustment_params: {
          reported_balance: parsedNum,
        },
      };
    }
  }

  // ── FAST PATH 2: Resolução Semântica Determinística de Baixas e Liquidações com Snapshot Ativo ──
  // Frases como: "dar baixa na única conta atrasada a receber", "baixa na conta a receber atrasada"
  const isSettlementPhrasing = /(?:dar\s+baixa|baixar|liquidar|quitar|marcar\s+como\s+(?:pago|recebido)|j[aá]\s+(?:recebi|paguei)|t[aá]\s+pago)/i.test(cleanUserText);
  if (isSettlementPhrasing && context.snapshot) {
    const isOverdue = /(?:atrasad[ao]|vencid[ao]|em\s+atraso|passad[ao]|j[aá]\s+venceu)/i.test(cleanUserText);
    const isReceivable = /(?:receber|receb[ií]vel|receita|cliente|venda|honor[aá]rio)/i.test(cleanUserText);
    const isPayable = /(?:pagar|despesa|boleto|fornecedor|conta)/i.test(cleanUserText) && !isReceivable;

    if (isOverdue && isReceivable) {
      if (context.snapshot.overdueReceivables.length === 1) {
        const item = context.snapshot.overdueReceivables[0];
        return {
          intent: 'SETTLE_ACCOUNT',
          confidence: 1.0,
          is_applicable: true,
          target_account_id: item.id,
          target_type: 'receivable',
          target_description: item.description,
          target_amount: item.amount,
        };
      } else if (context.snapshot.overdueReceivables.length > 1) {
        const listStr = context.snapshot.overdueReceivables
          .map((r, i) => `${i + 1}️⃣ *${r.description}* (R$ ${r.amount.toFixed(2)} - Vencimento ${r.due_date})`)
          .join('\n');
        return {
          intent: 'CLARIFICATION_NEEDED',
          confidence: 0.95,
          is_applicable: true,
          reply_text: `Encontrei mais de uma conta a receber em atraso:\n\n${listStr}\n\nQual delas você deseja dar baixa? Envie o número ou o nome!`,
        };
      }
    }

    if (isOverdue && isPayable) {
      if (context.snapshot.overduePayables.length === 1) {
        const item = context.snapshot.overduePayables[0];
        return {
          intent: 'SETTLE_ACCOUNT',
          confidence: 1.0,
          is_applicable: true,
          target_account_id: item.id,
          target_type: 'payable',
          target_description: item.description,
          target_amount: item.amount,
        };
      } else if (context.snapshot.overduePayables.length > 1) {
        const listStr = context.snapshot.overduePayables
          .map((p, i) => `${i + 1}️⃣ *${p.description}* (R$ ${p.amount.toFixed(2)} - Vencimento ${p.due_date})`)
          .join('\n');
        return {
          intent: 'CLARIFICATION_NEEDED',
          confidence: 0.95,
          is_applicable: true,
          reply_text: `Encontrei mais de uma conta a pagar em atraso:\n\n${listStr}\n\nQual delas você pagou? Envie o número ou o nome!`,
        };
      }
    }
  }

  const genAI = getGeminiClient();
  const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];

  const snapshotPrompt = context.snapshot
    ? `\nSITUAÇÃO ATIVA DE CONTAS NO BANCO DE DADOS (CONSULTE ANTES DE DECIDIR):
- Contas a Receber Atrasadas (${context.snapshot.overdueReceivables.length}): ${JSON.stringify(context.snapshot.overdueReceivables)}
- Contas a Receber Vencendo Hoje (${context.snapshot.todayReceivables.length}): ${JSON.stringify(context.snapshot.todayReceivables)}
- Todas as Contas a Receber Abertas (${context.snapshot.allOpenReceivables.length}): ${JSON.stringify(context.snapshot.allOpenReceivables)}
- Contas a Pagar Atrasadas (${context.snapshot.overduePayables.length}): ${JSON.stringify(context.snapshot.overduePayables)}
- Contas a Pagar Vencendo Hoje (${context.snapshot.todayPayables.length}): ${JSON.stringify(context.snapshot.todayPayables)}
- Todas as Contas a Pagar Abertas (${context.snapshot.allOpenPayables.length}): ${JSON.stringify(context.snapshot.allOpenPayables)}`
    : '';

  const prompt = `MENSAGEM DO USUÁRIO: "${userText}"

DADOS DO USUÁRIO:
- Nome: ${context.userName}
- Telefone: ${context.phone}
- Tipo: ${context.userType}
- Admin: ${context.isAdmin ? 'SIM' : 'NÃO'}
- Plano: ${context.plan}
- Empresa: ${context.companyName || 'Não informada'}
- Possui contas cadastradas: ${context.hasOpenBills ? 'SIM' : 'NÃO'}
${snapshotPrompt}
${context.activeBillsSummary ? `\nRESUMO DE CONTAS:\n${context.activeBillsSummary}` : ''}
${context.lastBillSummary ? `\nÚLTIMA CONTA CADASTRADA RECENTEMENTE (MEMÓRIA IMEDIATA):\n${context.lastBillSummary}` : ''}`;

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
                  'SETTLE_ACCOUNT',
                  'CLARIFICATION_NEEDED',
                  'NEW_ENTRY',
                  'POSTPONE_ACCOUNT',
                  'CANCEL_ACCOUNT',
                  'GENERAL_QUERY',
                  'INVITE_GUEST',
                  'TEAM_MANAGEMENT',
                  'QUERY_BILLS',
                  'GET_PAYMENT_CODE',
                  'EDIT_BILL',
                  'DELETE_BILL',
                  'RECORD_FINANCIAL_ENTRY',
                  'MARK_RECEIVABLE_AS_RECEIVED',
                  'MARK_BILL_AS_PAID',
                  'REQUEST_PDF_REPORT',
                  'REQUEST_ACCOUNTING_CLOSING',
                  'CASH_FLOW_ADVICE',
                  'VIEW_PLANS_PRICING',
                  'ADMIN_SIMULATION',
                  'REQUEST_DASHBOARD_ACCESS',
                  'ADJUST_BALANCE',
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
              target_account_id: {
                type: SchemaType.STRING,
                description: 'ID da conta identificada nas listas para baixa/alteração/cancelamento',
                nullable: true,
              },
              target_type: {
                type: SchemaType.STRING,
                enum: ['payable', 'receivable'],
                description: 'Tipo da conta identificada (payable ou receivable)',
                nullable: true,
              },
              target_amount: {
                type: SchemaType.NUMBER,
                description: 'Valor numérico exato da conta identificada',
                nullable: true,
              },
              target_description: {
                type: SchemaType.STRING,
                description: 'Nome do fornecedor ou cliente da conta identificada',
                nullable: true,
              },
              reply_text: {
                type: SchemaType.STRING,
                description: 'Texto conversacional quando necessária clarificação ou resposta ao usuário',
                nullable: true,
              },
              invite_params: {
                type: SchemaType.OBJECT,
                properties: {
                  phone: { type: SchemaType.STRING, nullable: true },
                  name: { type: SchemaType.STRING, nullable: true },
                  target_role: {
                    type: SchemaType.STRING,
                    enum: ['qa_test', 'team_operator'],
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
              mark_paid_params: {
                type: SchemaType.OBJECT,
                properties: {
                  supplier_or_customer: { type: SchemaType.STRING, nullable: true },
                  amount: { type: SchemaType.NUMBER, nullable: true },
                  is_income: { type: SchemaType.BOOLEAN, nullable: true },
                  bill_id: { type: SchemaType.STRING, nullable: true },
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
              closing_params: {
                type: SchemaType.OBJECT,
                properties: {
                  period: {
                    type: SchemaType.STRING,
                    description: 'Mês e ano da competência no formato MM/AAAA (ex: 09/2026)',
                    nullable: true,
                  },
                  send_to_accountant: {
                    type: SchemaType.BOOLEAN,
                    description: 'True se o usuário pediu para enviar direto ao contador',
                    nullable: true,
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
              balance_adjustment_params: {
                type: SchemaType.OBJECT,
                properties: {
                  reported_balance: {
                    type: SchemaType.NUMBER,
                    description: 'Valor numérico do saldo informado para ajuste (ex: 2500, 4000.50)',
                  },
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
Sua missão é entender com perfeição o que o usuário quer fazer, a partir de áudios transcritos ou mensagens de texto em português brasileiro falado natural por pessoas simples, SEM EXIGIR NENHUM COMANDO FIXO OU '!'.

INSTRUÇÕES DE RESOLUÇÃO SEMÂNTICA DE CONTAS (CRÍTICO):
1. Quando o usuário quiser dar baixa, liquidar ou marcar como pago/recebido:
   - "dar baixa na única conta atrasada a receber", "recebi da mar brasil", "paguei a vivo", "tá pago o boleto de 98"
   - SEMPRE consulte a "SITUAÇÃO ATIVA DE CONTAS NO BANCO DE DADOS" fornecida acima!
   - Se houver correspondência inequívoca para um único registro (ex: existe apenas 1 conta atrasada a receber e ele pediu para baixar a única atrasada, ou citou o fornecedor/cliente de uma conta aberta), retorne:
     intent: "SETTLE_ACCOUNT",
     target_account_id: "<id da conta>",
     target_type: "payable" ou "receivable",
     target_description: "<descrição/nome da conta>",
     target_amount: <valor numérico da conta>.
   - Se houver mais de uma conta candidata e faltar clareza para desempate, retorne:
     intent: "CLARIFICATION_NEEDED",
     reply_text: "Encontrei as seguintes contas abertas: [liste-as com número e valor amigavelmente]. Qual delas você deseja baixar?"

2. Outras Categorias de Intenção:
- EDIT_BILL: Alterar valor, vencimento ou renomear fornecedores. Se disser "o nome é X" consulte a ÚLTIMA CONTA CADASTRADA.
- INVITE_GUEST: Convidar alguém para testar, enviar convite VIP.
- TEAM_MANAGEMENT: Gestão de operadores da empresa.
- QUERY_BILLS: Consultar contas agendadas (ex: "ver minhas contas", "o que tenho a pagar hoje?").
- GET_PAYMENT_CODE: Pedir linha digitável, código de barras ou Pix para pagar/antecipar.
- DELETE_BILL / CANCEL_ACCOUNT: Excluir ou cancelar uma conta.
- RECORD_FINANCIAL_ENTRY / NEW_ENTRY: Lançar despesa ou receita nova que ainda NÃO existe no banco.
- ADJUST_BALANCE: Calibrar ou atualizar o saldo bancário da conta corrente / caixa.
- REQUEST_PDF_REPORT: Solicitar relatório, Livro Caixa ou DRE em PDF.
- REQUEST_ACCOUNTING_CLOSING: Solicitar pacote de fechamento contábil.
- CASH_FLOW_ADVICE: Dúvidas financeiras e de caixa.
- VIEW_PLANS_PRICING: Consultar planos, valores, upgrade, assinar.
- ADMIN_SIMULATION: Exclusivo para administradores.
- REQUEST_DASHBOARD_ACCESS: Solicitar link do painel visual, gráficos, PWA.
- GENERAL_CONVERSATION: Saudações ou bate-papo informal.

REGRAS DE PERMISSÃO POR PAPEL:
- Se Tipo for 'operator': Permitido EXCLUSIVAMENTE para enviar lançamentos. Para outras ações, is_applicable = false.

Seja humanizado, acolhedor, tolerante com erros de digitação e variações fonéticas.`,
      });

      const res = await model.generateContent(prompt);
      const text = res.response.text();
      const parsed = JSON.parse(text);

      const intent = (parsed.intent || 'GENERAL_CONVERSATION') as ConversationalIntentType;
      let isApplicable = Boolean(parsed.is_applicable);
      let inapplicableMessage = parsed.inapplicable_message || undefined;

      // Interceptor de permissões rígido para operadores
      if (context.userType === 'operator') {
        const permCheck = validateOperatorPermissions('operator', intent);
        if (!permCheck.allowed) {
          isApplicable = false;
          inapplicableMessage = permCheck.refusalMessage;
        }
      }

      return {
        intent,
        confidence: Number(parsed.confidence) || 0.9,
        is_applicable: isApplicable,
        inapplicable_message: inapplicableMessage,
        target_account_id: parsed.target_account_id || undefined,
        target_type: parsed.target_type || undefined,
        target_amount: parsed.target_amount ? Number(parsed.target_amount) : undefined,
        target_description: parsed.target_description || undefined,
        reply_text: parsed.reply_text || undefined,
        invite_params: parsed.invite_params || undefined,
        team_params: parsed.team_params || undefined,
        bills_query_params: parsed.bills_query_params || undefined,
        payment_code_params: parsed.payment_code_params || undefined,
        edit_params: parsed.edit_params || undefined,
        delete_params: parsed.delete_params || undefined,
        mark_paid_params: parsed.mark_paid_params || undefined,
        financial_entries: parsed.financial_entries || undefined,
        balance_adjustment_params: parsed.balance_adjustment_params || undefined,
        report_params: parsed.report_params || undefined,
        closing_params: parsed.closing_params || undefined,
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
