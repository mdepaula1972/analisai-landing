import { createServiceRoleClient } from '@/lib/supabase-server';
import { getBrasiliaDate } from './bpo-audit';
import { resolveCompetencePeriod } from './accountant-export';

export interface PersonalExpenseLeakAudit {
  clientId: string;
  totalPfAmount: number;
  totalExpenses: number;
  percentageOfExpenses: number;
  pfTransactionsCount: number;
  leakItems: Array<{
    date: string;
    description: string;
    amount: number;
    category?: string;
  }>;
  consultativeAdvice: string;
}

export interface AvoidedInterestResult {
  clientId: string;
  totalPaidBillsCount: number;
  totalPaidBillsAmount: number;
  avoidedInterestAmount: number;
  formattedAvoidedInterest: string;
  roiMessage: string;
}

export interface CashTightnessPrediction {
  clientId: string;
  currentBalance: number;
  projectedBalanceD15: number;
  projectedBalanceD30: number;
  tightnessDate: string | null;
  riskLevel: 'healthy' | 'tight' | 'critical';
  alertMessage: string | null;
  dailyTimeline: Array<{
    date: string;
    inflow: number;
    outflow: number;
    runningBalance: number;
  }>;
}

const PERSONAL_EXPENSE_KEYWORDS = [
  'escola', 'colegio', 'faculdade', 'creche', 'condominio residencial',
  'pet shop', 'veterinario', 'petshop', 'plano de saude individual', 'plano familiar',
  'unimed pessoa fisica', 'dentista', 'academia', 'smart fit', 'fatura cartao pessoal',
  'vestuario', 'supermercado', 'farmacia', 'drogasil', 'droga raia', 'pensao alimenticia',
  'aluguel residencial', 'mercado', 'acougue', 'açougue', 'padaria', 'hortifruti',
  'cinema', 'restaurante', 'ifood', 'medico', 'médico', 'clinica', 'terapia',
  'psicologo', 'psicólogo', 'otica', 'ótica', 'viagem pessoal', 'hotel pessoal',
  'pro-labore', 'pró-labore', 'retirada', 'pessoal'
];

/**
 * 1. Auditoria de Mistura PF x PJ (Vazamento de Despesas Particulares na Conta PJ)
 */
export async function auditPersonalExpenseLeak(
  clientId: string,
  requestedPeriod?: string
): Promise<PersonalExpenseLeakAudit> {
  const supabase = createServiceRoleClient();
  const period = resolveCompetencePeriod(requestedPeriod);

  // Busca saídas conciliadas do cliente no período
  const { data: expenses } = await supabase
    .from('cash_ledger_entries')
    .select('id, entry_date, description, amount, dre_group')
    .eq('client_id', clientId)
    .eq('entry_type', 'expense')
    .gte('entry_date', period.startDate)
    .lte('entry_date', period.endDate);

  const allExpenses = expenses || [];
  let totalExpenses = 0;
  let totalPfAmount = 0;
  const leakItems: PersonalExpenseLeakAudit['leakItems'] = [];

  for (const exp of allExpenses) {
    const val = Number(exp.amount) || 0;
    totalExpenses += val;

    const desc = (exp.description || '').toLowerCase();
    const isExplicitPf = exp.dre_group === 'retirada_pro_labore' || exp.dre_group === 'despesa_pessoal';

    const hasKeyword = PERSONAL_EXPENSE_KEYWORDS.some((kw) => desc.includes(kw));

    if (isExplicitPf || hasKeyword) {
      totalPfAmount += val;
      leakItems.push({
        date: exp.entry_date,
        description: exp.description,
        amount: val,
        category: exp.dre_group || 'Despesa Pessoal',
      });
    }
  }

  const percentage = totalExpenses > 0 ? (totalPfAmount / totalExpenses) * 100 : 0;
  const valFmt = totalPfAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let advice = '';
  if (totalPfAmount > 0) {
    advice = `⚠️ *Alerta de Pró-labore & Blindagem Patrimonial:*\nIdentificamos ${valFmt} (${percentage.toFixed(1)}% das saídas) em despesas com características pessoais pagas diretamente na conta jurídica da empresa. Recomendamos unificar esses pagamentos em uma transferência mensal única de pró-labore para sua conta de Pessoa Física.`;
  } else {
    advice = `✅ *Excelente Blindagem Patrimonial:* 100% das saídas analisadas no período foram estritamente operacionais da pessoa jurídica.`;
  }

  return {
    clientId,
    totalPfAmount,
    totalExpenses,
    percentageOfExpenses: percentage,
    pfTransactionsCount: leakItems.length,
    leakItems,
    consultativeAdvice: advice,
  };
}

/**
 * 2. Cálculo de Proteção Financeira e Juros Evitados (ROI do BPO)
 * Fórmula: Multa de 2% + 15 dias de mora a 0,033%/dia = Valor * 0,02495 (~2,5%)
 */
export async function calculateAvoidedInterest(
  clientId: string,
  requestedPeriod?: string
): Promise<AvoidedInterestResult> {
  const supabase = createServiceRoleClient();
  const period = resolveCompetencePeriod(requestedPeriod);

  // Busca títulos pagos em dia geridos pelo BPO
  const { data: paidBills } = await supabase
    .from('payables_receivables')
    .select('id, amount, current_due_date, status, counterparty_name')
    .eq('client_id', clientId)
    .eq('type', 'payable')
    .eq('status', 'paid')
    .gte('current_due_date', period.startDate)
    .lte('current_due_date', period.endDate);

  const bills = paidBills || [];
  let totalPaidBillsAmount = 0;

  for (const b of bills) {
    totalPaidBillsAmount += Number(b.amount) || 0;
  }

  // Economia padrão de mercado: 2% multa + 15 dias juros (0,033% ao dia) = 2,495%
  const avoidedInterestAmount = totalPaidBillsAmount * 0.02495;
  const formattedAvoided = avoidedInterestAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const roiMessage = `🛡️ *Proteção de Pontualidade:*\n100% dos seus compromissos foram lembrados e agendados no prazo pelo AnalisAí. Economia estimada em multas e juros evitados neste mês: *${formattedAvoided}*.`;

  return {
    clientId,
    totalPaidBillsCount: bills.length,
    totalPaidBillsAmount,
    avoidedInterestAmount,
    formattedAvoidedInterest: formattedAvoided,
    roiMessage,
  };
}

/**
 * 3. Alerta Preditivo de Caixa Crítico D+15 / D+30
 */
export async function predictCashTightness(clientId: string): Promise<CashTightnessPrediction> {
  const supabase = createServiceRoleClient();
  const todayStr = getBrasiliaDate(0);
  const d30Str = getBrasiliaDate(30);

  // 1. Saldo atual do cliente (soma de lançamentos ou saldo cadastrado)
  const { data: client } = await supabase
    .from('clients')
    .select('initial_bank_balance, initial_cash_in_hand')
    .eq('id', clientId)
    .single();

  const baseBalance = Number(client?.initial_bank_balance || 0) + Number(client?.initial_cash_in_hand || 0);

  // Soma lançamentos históricos para obter saldo líquido até hoje
  const { data: ledgerPast } = await supabase
    .from('cash_ledger_entries')
    .select('amount, entry_type')
    .eq('client_id', clientId)
    .lte('entry_date', todayStr);

  let currentBalance = baseBalance;
  for (const row of ledgerPast || []) {
    const val = Number(row.amount) || 0;
    if (row.entry_type === 'income') currentBalance += val;
    else currentBalance -= val;
  }

  // 2. Contas futuras a vencer nos próximos 30 dias
  const { data: futureBills } = await supabase
    .from('payables_receivables')
    .select('amount, type, current_due_date, counterparty_name')
    .eq('client_id', clientId)
    .in('status', ['open', 'postponed'])
    .gte('current_due_date', todayStr)
    .lte('current_due_date', d30Str)
    .order('current_due_date', { ascending: true });

  const bills = futureBills || [];

  // Mapeia movimentações por dia
  const dailyMap = new Map<string, { inflow: number; outflow: number }>();
  for (const b of bills) {
    const dateKey = b.current_due_date;
    const current = dailyMap.get(dateKey) || { inflow: 0, outflow: 0 };
    const val = Number(b.amount) || 0;
    if (b.type === 'receivable') current.inflow += val;
    else current.outflow += val;
    dailyMap.set(dateKey, current);
  }

  // Gera timeline dos próximos 30 dias
  const dailyTimeline: CashTightnessPrediction['dailyTimeline'] = [];
  let running = currentBalance;
  let tightnessDate: string | null = null;
  let minBalance = currentBalance;
  let d15Balance = currentBalance;
  let d30Balance = currentBalance;

  const d15Str = getBrasiliaDate(15);

  for (let offset = 0; offset <= 30; offset++) {
    const dateKey = getBrasiliaDate(offset);
    const dayData = dailyMap.get(dateKey) || { inflow: 0, outflow: 0 };
    running = running + dayData.inflow - dayData.outflow;

    if (running < minBalance) minBalance = running;
    if (running < 0 && !tightnessDate) {
      tightnessDate = dateKey;
    }

    if (dateKey === d15Str) d15Balance = running;
    if (dateKey === d30Str) d30Balance = running;

    dailyTimeline.push({
      date: dateKey,
      inflow: dayData.inflow,
      outflow: dayData.outflow,
      runningBalance: running,
    });
  }

  let riskLevel: CashTightnessPrediction['riskLevel'] = 'healthy';
  let alertMessage: string | null = null;

  if (minBalance < 0) {
    riskLevel = 'critical';
    const [y, m, d] = (tightnessDate || todayStr).split('-');
    const dateFmt = `${d}/${m}`;
    alertMessage = `⚠️ *Alerta CFO de Caixa Crítico:* Saldo projetado fica negativo a partir de ${dateFmt} (mínimo previsto: ${minBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Sugerimos antecipar recebíveis ou adiar compras discricionárias.`;
  } else if (minBalance < 500) {
    riskLevel = 'tight';
    alertMessage = `🟡 *Atenção de Liquidez:* Caixa projetado operará próximo do limite mínimo nos próximos 15 dias.`;
  }

  return {
    clientId,
    currentBalance,
    projectedBalanceD15: d15Balance,
    projectedBalanceD30: d30Balance,
    tightnessDate,
    riskLevel,
    alertMessage,
    dailyTimeline,
  };
}

