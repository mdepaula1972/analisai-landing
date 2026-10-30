import { SchemaType } from '@google/generative-ai';
import { getGeminiClient } from './gemini';
import { validateOperatorPermissions } from './team-guard';
import { ActiveFinancialAccountItem, ActiveFinancialSnapshot } from './active-context';

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
  | 'UNDO_LAST_ACTION'
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
  candidate_accounts?: ActiveFinancialAccountItem[];
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
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = clean.replace(/\./g, '');
    } else if (parts[1] && parts[1].length === 3) {
      clean = parts[0] + parts[1];
    }
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function normalizeForMatch(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Detecta se a mensagem é um pedido de estorno / desfazer a última ação ou baixa.
 */
export function isUndoLastActionMessage(text: string): boolean {
  const clean = text.trim();
  return (
    /^(?:!|\/)?(?:desfazer|desfaz|desfazer\s+(?:a\s+)?(?:baixa|pagamento|recebimento|[uú]ltim[ao]\s+a[çc][aã]o)|estornar(?:\s+baixa)?|errei\s+o\s+pagamento|errei\s+a\s+baixa|n[aã]o\s+paguei\s+ainda|ainda\s+n[aã]o\s+paguei|n[aã]o\s+recebi\s+ainda|reabrir\s+(?:a\s+)?conta|voltar\s+(?:a\s+)?conta\s+para\s+pendente)[!?.]*$/i.test(
      clean
    ) ||
    /\b(?:desfazer\s+baixa|errei\s+o\s+pagamento|n[aã]o\s+paguei\s+ainda|reabrir\s+(?:a\s+)?conta)\b/i.test(clean)
  );
}

/**
 * Detecta se a mensagem possui verbos de baixa / liquidação de contas.
 * Exclui pedidos de download de arquivo (ex: "baixar relatório", "baixar pdf") e comandos de estorno/desfazer.
 */
export function isSettlementVerbMessage(text: string): boolean {
  const clean = text.trim();
  if (isUndoLastActionMessage(clean)) {
    return false;
  }
  if (/\b(?:n[aã]o\s+paguei|ainda\s+n[aã]o\s+paguei|n[aã]o\s+recebi|desfazer|reabrir)\b/i.test(clean)) {
    return false;
  }
  if (
    /\b(?:baixar|baixa)\s+(?:o\s+|meu\s+|um\s+)?(?:relat[oó]rio|pdf|extrato|livro\s+caixa|app|aplicativo|comprovante|fechamento|arquivo)\b/i.test(
      clean
    )
  ) {
    return false;
  }

  return /\b(?:baixar|dar\s+baixa|baixa\s+n[ao]|baixa\s+d[eao]|baixei|liquidar|liquidei|liquidado|quitar|quitei|quitado|paguei|j[aá]\s+paguei|t[aá]\s+pago|est[aá]\s+pago|marcar\s+como\s+(?:pago|paga|recebido|recebida)|recebi|j[aá]\s+recebi|recebido|recebida)\b/i.test(
    clean
  );
}

/**
 * Extrai pistas de dia do mês (ex: "dia 25", "do dia 25", "25/10") e valor monetário da frase de baixa.
 */
function extractSettlementClues(text: string): {
  dayOfMonth: number | null;
  month: number | null;
  amountHint: number | null;
  isOverdue: boolean;
  isTodayDue: boolean;
  isReceivableHint: boolean;
  isPayableHint: boolean;
  nameTokens: string[];
} {
  const clean = text.trim();
  let dayOfMonth: number | null = null;
  let month: number | null = null;

  // 1. Data no formato DD/MM ou DD/MM/YYYY
  const slashDateMatch = clean.match(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/);
  if (slashDateMatch) {
    const d = parseInt(slashDateMatch[1], 10);
    const m = parseInt(slashDateMatch[2], 10);
    if (d >= 1 && d <= 31) dayOfMonth = d;
    if (m >= 1 && m <= 12) month = m;
  }

  // 2. "dia 25", "do dia 25", "no dia 25", "vencimento 25", "vencida em 25"
  if (dayOfMonth === null) {
    const dayMatch = clean.match(
      /(?:dia|vencimento|vencid[ao]\s+(?:em|dia)|venceu\s+(?:em|dia)|do\s+dia|de\s+dia)\s*(\d{1,2})\b/i
    );
    if (dayMatch) {
      const d = parseInt(dayMatch[1], 10);
      if (d >= 1 && d <= 31) dayOfMonth = d;
    }
  }

  // 3. Valor monetário explícito (removendo antes trechos de data para não confundir "dia 25" com R$ 25)
  const textWithoutDates = clean
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/(?:dia|vencimento|vencid[ao]\s+em|venceu\s+em)\s*\d{1,2}\b/gi, ' ');

  let amountHint: number | null = null;
  const explicitMoneyMatch = textWithoutDates.match(
    /(?:r\$\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*reais|(?:valor|boleto|conta)\s+de\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?))/i
  );
  if (explicitMoneyMatch) {
    const rawNum = explicitMoneyMatch[1] || explicitMoneyMatch[2] || explicitMoneyMatch[3];
    if (rawNum) {
      const parsed = parseBalanceNumber(rawNum);
      if (parsed > 0) amountHint = parsed;
    }
  }

  const isOverdue = /\b(?:atrasad[ao]s?|vencid[ao]s?|em\s+atraso|passad[ao]s?|j[aá]\s+venceu)\b/i.test(clean);
  const isTodayDue = /\b(?:conta\s+de\s+hoje|venc(?:e|endo|imento)\s+hoje|de\s+hoje)\b/i.test(clean);

  // Nota: "conta" é neutro (serve tanto para conta a receber quanto conta a pagar!)
  const isReceivableHint =
    /\b(?:a\s+receber|receber|receb[ií]vel|receb[ií]veis|receita|cliente|venda|honor[aá]rio|recebi|recebido|recebida|recebimento|pagou)\b/i.test(
      clean
    );
  const isPayableHint =
    /\b(?:a\s+pagar|paguei|t[aá]\s+pago|est[aá]\s+pago|despesa|boleto|fornecedor|fatura)\b/i.test(clean) &&
    !isReceivableHint;

  // Extrai tokens de nome de cliente/fornecedor (se houver)
  const stopWords = new Set([
    'baixar',
    'dar',
    'baixa',
    'baixei',
    'liquidar',
    'liquidei',
    'liquidado',
    'quitar',
    'quitei',
    'quitado',
    'paguei',
    'pago',
    'paga',
    'recebi',
    'recebido',
    'recebida',
    'recebimento',
    'receber',
    'pagar',
    'conta',
    'contas',
    'boleto',
    'boletos',
    'fatura',
    'faturas',
    'lancamento',
    'parcela',
    'parcelas',
    'atrasada',
    'atrasado',
    'atrasadas',
    'atrasados',
    'atraso',
    'vencida',
    'vencido',
    'vencidas',
    'vencidos',
    'venceu',
    'vencimento',
    'unica',
    'unico',
    'recorrente',
    'mensal',
    'aberta',
    'aberto',
    'pendente',
    'cliente',
    'fornecedor',
    'despesa',
    'receita',
    'valor',
    'reais',
    'hoje',
    'ontem',
    'dia',
    'mes',
    'ano',
    'que',
    'estava',
    'esta',
    'foi',
    'como',
    'marcar',
    'ja',
    'ta',
    'meu',
    'minha',
    'meus',
    'minhas',
    'do',
    'da',
    'dos',
    'das',
    'de',
    'no',
    'na',
    'nos',
    'nas',
    'em',
    'para',
    'pro',
    'pra',
    'por',
    'com',
    'um',
    'uma',
    'uns',
    'umas',
    'o',
    'a',
    'os',
    'as',
    'e',
    'ou',
    'favor',
    'quero',
    'preciso',
    'pode',
    'ultimo',
    'ultima',
    'recente',
  ]);

  const normalizedWords = normalizeForMatch(textWithoutDates)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !stopWords.has(w));

  return {
    dayOfMonth,
    month,
    amountHint,
    isOverdue,
    isTodayDue,
    isReceivableHint,
    isPayableHint,
    nameTokens: normalizedWords,
  };
}

/**
 * Resolve de forma determinística o comando de baixa/liquidação contra o snapshot ativo.
 * Retorna uma RoutedDecision imediata se encontrar 1 conta, >1 contas, ou 0 contas (quando não requer desempate semântico difuso).
 */
export function resolveSettlementFromSnapshot(
  userText: string,
  snapshot: ActiveFinancialSnapshot
): RoutedDecision | null {
  const clues = extractSettlementClues(userText);
  const allOpen: ActiveFinancialAccountItem[] = [
    ...snapshot.allOpenReceivables,
    ...snapshot.allOpenPayables,
  ];

  // Se não há absolutamente nenhuma conta aberta no snapshot:
  if (allOpen.length === 0) {
    return {
      intent: 'SETTLE_ACCOUNT',
      confidence: 1.0,
      is_applicable: true,
      reply_text:
        'Não localizei nenhuma conta aberta com esses critérios no momento. Deseja que eu liste todas as suas contas abertas?',
    };
  }

  // 1. Filtra por tipo (receivable vs payable) APENAS se o usuário deu pista explícita de tipo
  let candidates: ActiveFinancialAccountItem[] = allOpen;
  if (clues.isReceivableHint && !clues.isPayableHint) {
    candidates = snapshot.allOpenReceivables;
  } else if (clues.isPayableHint && !clues.isReceivableHint) {
    candidates = snapshot.allOpenPayables;
  }

  // 2. Filtra por dia do mês (ex: "dia 25") e/ou status de atraso ("atrasada")
  if (clues.dayOfMonth !== null) {
    const byDayAndOverdue = clues.isOverdue
      ? candidates.filter((c) => c.day_of_month === clues.dayOfMonth && c.is_overdue)
      : [];

    if (byDayAndOverdue.length > 0) {
      candidates = byDayAndOverdue;
    } else {
      // Fallback para day_of_month mesmo que a data recorrente esteja projetada
      candidates = candidates.filter((c) => c.day_of_month === clues.dayOfMonth);
      // Se não achou no subconjunto tipado (ex: usuário disse "paguei" para uma conta ou vice-versa), tenta no pool geral pelo dia
      if (candidates.length === 0) {
        const allByDay = allOpen.filter(
          (c) => c.day_of_month === clues.dayOfMonth && (!clues.isOverdue || c.is_overdue)
        );
        if (allByDay.length > 0) {
          candidates = allByDay;
        } else {
          candidates = allOpen.filter((c) => c.day_of_month === clues.dayOfMonth);
        }
      }
    }
  } else if (clues.isOverdue) {
    const overdueSubset = candidates.filter((c) => c.is_overdue);
    if (overdueSubset.length > 0) {
      candidates = overdueSubset;
    } else {
      // Se não havia no tipo restrito, verifica em todas as atrasadas do snapshot
      candidates = allOpen.filter((c) => c.is_overdue);
    }
  } else if (clues.isTodayDue) {
    candidates = candidates.filter((c) => c.is_today);
  }

  // 3. Filtra por valor monetário se informado
  if (clues.amountHint !== null && candidates.length > 0) {
    const byAmount = candidates.filter((c) => Math.abs(c.amount - clues.amountHint!) < 1.0);
    if (byAmount.length > 0 || clues.nameTokens.length === 0) {
      candidates = byAmount;
    }
  }

  // 4. Filtra por tokens de nome do favorecido/cliente se informados
  if (clues.nameTokens.length > 0 && candidates.length > 0) {
    const byName = candidates.filter((c) => {
      const normDesc = normalizeForMatch(c.description);
      return clues.nameTokens.some((tok) => normDesc.includes(tok) || tok.includes(normDesc));
    });

    if (byName.length > 0) {
      candidates = byName;
    } else if (clues.dayOfMonth === null && !clues.isOverdue && clues.amountHint === null) {
      // O usuário citou um nome que não bateu literalmente (ex: "conta de luz" -> "CPFL").
      // Deixa o Gemini tentar o match semântico sobre o snapshot!
      return null;
    } else {
      candidates = [];
    }
  }

  // 5. Decisão baseada na quantidade de contas candidatas encontradas
  if (candidates.length === 1) {
    const match = candidates[0];
    return {
      intent: 'SETTLE_ACCOUNT',
      confidence: 1.0,
      is_applicable: true,
      target_account_id: match.id,
      target_type: match.type,
      target_description: match.description,
      target_amount: match.amount,
    };
  }

  if (candidates.length > 1) {
    const listStr = candidates
      .map(
        (c, idx) =>
          `*[${idx + 1}]* *${c.description}* — R$ ${c.amount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} (Venc: ${c.formatted_date || c.due_date})`
      )
      .join('\n');

    return {
      intent: 'CLARIFICATION_NEEDED',
      confidence: 0.98,
      is_applicable: true,
      candidate_accounts: candidates,
      reply_text: `Encontrei mais de uma conta em aberto com esses critérios:\n\n${listStr}\n\nQual delas você deseja dar baixa? Responda com o número *[1]*, *[2]* ou o nome da conta!`,
    };
  }

  // candidates.length === 0:
  return {
    intent: 'SETTLE_ACCOUNT',
    confidence: 1.0,
    is_applicable: true,
    reply_text:
      'Não localizei nenhuma conta aberta com esses critérios no momento. Deseja que eu liste todas as suas contas abertas?',
  };
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

  // ── FAST PATH 0: Comando de Estorno / Desfazer Baixa Recente (UNDO_LAST_ACTION) ──
  // Gatilhos: "desfazer", "desfazer baixa", "errei o pagamento", "não paguei ainda", "reabrir conta"
  if (isUndoLastActionMessage(cleanUserText)) {
    const isOperator = context.userType === 'operator';
    const permCheck = validateOperatorPermissions(isOperator ? 'operator' : 'admin', 'UNDO_LAST_ACTION');
    return {
      intent: 'UNDO_LAST_ACTION',
      confidence: 1.0,
      is_applicable: permCheck.allowed,
      inapplicable_message: permCheck.refusalMessage,
    };
  }

  // ── FAST PATH 1: Calibração ou Ajuste de Saldo de Caixa (Tarefa 5) ──
  // Mensagens como: "meu saldo hoje é X", "saldo atual 2500", "ajustar saldo para 4000", "calibrar saldo 1500"
  const balanceRegex =
    /^(?:(?:ol[aá]|oi|bom dia|boa tarde|boa noite)[\s,!.]*)?(?:(?:meu\s+)?saldo\s*(?:hoje|atual|em conta|banc[aá]rio)?\s*(?:[eé]|de|em|pra|para)?\s*(?:r\$)?\s*(-?[\d.,]+)|(?:ajustar|calibrar|atualizar|definir)\s+(?:(?:meu\s+)?saldo\s*(?:hoje|atual|em conta|banc[aá]rio)?\s*(?:[eé]|de|em|pra|para)?\s*(?:r\$)?\s*(-?[\d.,]+)))/i;
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

  // ── FAST PATH 2: Prioridade Absoluta para Verbos de Liquidação com Snapshot Ativo ──
  // Se a mensagem contiver termos como: "baixar", "dar baixa", "liquidar", "paguei", "quitei", "recebi", "recebido":
  // A intenção primária DEVE ser classificada como SETTLE_ACCOUNT (ou CLARIFICATION_NEEDED se >1), NUNCA como NEW_ENTRY.
  const hasSettlementVerb = isSettlementVerbMessage(cleanUserText);
  if (hasSettlementVerb && context.snapshot) {
    const resolved = resolveSettlementFromSnapshot(cleanUserText, context.snapshot);
    if (resolved) {
      if (context.userType === 'operator') {
        const permCheck = validateOperatorPermissions('operator', resolved.intent);
        if (!permCheck.allowed) {
          resolved.is_applicable = false;
          resolved.inapplicable_message = permCheck.refusalMessage;
        }
      }
      return resolved;
    }
  }

  const genAI = getGeminiClient();
  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];

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
                  'UNDO_LAST_ACTION',
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

REGRA DE OURO PARA BAIXAS / LIQUIDAÇÕES:
Quando o usuário pedir para "baixar", "liquidar" ou disser que "recebeu/pagou":
1. Filtre as contas do snapshot usando as pistas fornecidas (ex: "dia 25", "atrasada", "a receber", "cliente X").
2. Se encontrar EXATAMENTE UMA conta que atenda aos critérios:
   - Retorne imediatamente:
     {
       "intent": "SETTLE_ACCOUNT",
       "target_account_id": "<ID_DA_CONTA>",
       "target_description": "<DESCRICAO>",
       "target_amount": <VALOR>,
       "target_type": "receivable" | "payable"
     }
   - NÃO pergunte valor nem favorecido.
3. Se encontrar ZERO contas:
   - Responda informando que não localizou nenhuma conta aberta com esses critérios e pergunte se ele deseja listar todas as contas abertas.
4. Se encontrar mais de uma conta candidata:
   - Retorne intent: "CLARIFICATION_NEEDED" listando as contas candidatas com números [1], [2] para o usuário escolher.

PROIBIÇÃO ABSOLUTA EM VERBOS DE LIQUIDAÇÃO:
- Se a mensagem contiver termos como "baixar", "dar baixa", "liquidar", "paguei", "quitei", "recebi", "recebido", a intenção primária DEVE ser classificada como "SETTLE_ACCOUNT" (preenchendo target_type = "payable" | "receivable") ou "CLARIFICATION_NEEDED" se houver múltiplas candidatas, NUNCA como "NEW_ENTRY".
- É estritamente PROIBIDO disparar perguntas de preenchimento de campos (ex: "qual o valor?", "quem é o cliente?") antes de verificar o snapshot de pendências.

Outras Categorias de Intenção:
- UNDO_LAST_ACTION: Desfazer ou estornar a última baixa realizada (ex: "desfazer", "desfazer baixa", "errei o pagamento", "não paguei ainda", "reabrir conta").
- EDIT_BILL: Alterar valor, vencimento ou renomear fornecedores. Se disser "o nome é X" consulte a ÚLTIMA CONTA CADASTRADA.
- INVITE_GUEST: Convidar alguém para testar, enviar convite VIP.
- TEAM_MANAGEMENT: Gestão de operadores da empresa.
- QUERY_BILLS: Consultar contas agendadas (ex: "ver minhas contas", "o que tenho a pagar hoje?").
- GET_PAYMENT_CODE: Pedir linha digitável, código de barras ou Pix para pagar/antecipar.
- DELETE_BILL / CANCEL_ACCOUNT: Excluir ou cancelar uma conta.
- NEW_ENTRY: Lançar despesa ou receita nova que ainda NÃO existe no banco (somente quando NÃO for comando de baixa/liquidação), preenchendo financial_entries.
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

      let rawIntent = String(parsed.intent || 'GENERAL_CONVERSATION');
      let targetType: 'payable' | 'receivable' | undefined = parsed.target_type || undefined;

      // Normaliza intenções legadas para o padrão canônico unificado
      if (rawIntent === 'MARK_RECEIVABLE_AS_RECEIVED') {
        rawIntent = 'SETTLE_ACCOUNT';
        targetType = 'receivable';
      } else if (rawIntent === 'MARK_BILL_AS_PAID') {
        rawIntent = 'SETTLE_ACCOUNT';
        targetType = 'payable';
      } else if (rawIntent === 'RECORD_FINANCIAL_ENTRY') {
        rawIntent = 'NEW_ENTRY';
      }

      let intent = rawIntent as ConversationalIntentType;
      let isApplicable = Boolean(parsed.is_applicable);
      let inapplicableMessage = parsed.inapplicable_message || undefined;
      let replyText = parsed.reply_text || parsed.conversational_reply || undefined;

      // Barreira final obrigatória: se a mensagem contém verbo de liquidação, NUNCA permitir desvio para NEW_ENTRY
      if (hasSettlementVerb) {
        if (intent !== 'SETTLE_ACCOUNT' && intent !== 'CLARIFICATION_NEEDED') {
          intent = 'SETTLE_ACCOUNT';
        }
        if (intent === 'SETTLE_ACCOUNT' && !parsed.target_account_id) {
          // Garante que nunca pergunte valor ou nome de cliente como se fosse novo cadastro
          const asksForNewEntryFields =
            replyText &&
            /(?:qual\s+(?:[eé]\s+)?o\s+valor|quem\s+[eé]\s+o\s+(?:cliente|fornecedor)|informe\s+o\s+valor)/i.test(
              replyText
            );
          if (!replyText || asksForNewEntryFields) {
            replyText =
              'Não localizei nenhuma conta aberta com esses critérios no momento. Deseja que eu liste todas as suas contas abertas?';
          }
        }
      }

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
        target_account_id: parsed.target_account_id || parsed.mark_paid_params?.bill_id || undefined,
        target_type:
          targetType ||
          (parsed.mark_paid_params?.is_income !== undefined
            ? parsed.mark_paid_params.is_income
              ? 'receivable'
              : 'payable'
            : undefined),
        target_amount: parsed.target_amount
          ? Number(parsed.target_amount)
          : parsed.mark_paid_params?.amount
          ? Number(parsed.mark_paid_params.amount)
          : undefined,
        target_description:
          parsed.target_description || parsed.mark_paid_params?.supplier_or_customer || undefined,
        reply_text: replyText,
        invite_params: parsed.invite_params || undefined,
        team_params: parsed.team_params || undefined,
        bills_query_params: parsed.bills_query_params || undefined,
        payment_code_params: parsed.payment_code_params || undefined,
        edit_params: parsed.edit_params || undefined,
        delete_params: parsed.delete_params || undefined,
        mark_paid_params: parsed.mark_paid_params || undefined,
        financial_entries: hasSettlementVerb ? undefined : parsed.financial_entries || undefined,
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

  // Fallback seguro se todos os modelos falharem em comando de baixa
  if (hasSettlementVerb) {
    return {
      intent: 'SETTLE_ACCOUNT',
      confidence: 0.9,
      is_applicable: true,
      reply_text:
        'Não localizei nenhuma conta aberta com esses critérios no momento. Deseja que eu liste todas as suas contas abertas?',
    };
  }

  return {
    intent: 'GENERAL_CONVERSATION',
    confidence: 0.5,
    is_applicable: true,
  };
}
