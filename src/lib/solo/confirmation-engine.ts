import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { formatDueDateDetails } from '@/lib/solo/date-utils';
import { recordTrialUsage, updateTrialBill } from '@/lib/solo/trial';
import { parseConversationalCorrections, parseInvoicePaymentResolution } from '@/lib/solo/gemini';
import { isUndoLastActionMessage } from '@/lib/solo/conversational-router';
import { addMinutes } from 'date-fns';

export interface PendingConfirmationPayload {
  amount: number;
  counterparty_name: string;
  description?: string;
  due_date?: string | null; // YYYY-MM-DD
  entry_date?: string | null; // YYYY-MM-DD
  issue_date?: string | null;
  entry_type: 'payable' | 'receivable' | 'income' | 'expense' | 'other';
  category_name?: string;
  dre_group?: string;
  entity_scope?: 'PJ' | 'PF';
  barcode_or_pix?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  document_id?: string | null;
  bill_id?: string | null;
  target_account_id?: string | null;
  target_source?: 'payables_receivables' | 'trial_leads';
  is_provision?: boolean;
  installments_count?: number | null;
  is_installment?: boolean;
  payment_method?: string | null;
  payment_condition?: 'already_paid' | 'installments' | 'future_single';
  paid_installments_count?: number;
  remaining_installments_count?: number;
  paid_amount?: number;
  remaining_amount?: number;
  past_installments?: Array<{
    installment_number: number;
    amount: number;
    paid_date: string;
  }>;
  upcoming_installments?: Array<{
    installment_number: number;
    amount: number;
    due_date: string;
    barcode_or_pix?: string | null;
  }>;
  installments?: Array<{
    installment_number: number;
    amount: number;
    due_date: string;
    barcode_or_pix?: string | null;
  }>;
  origin?: 'texto' | 'áudio' | 'documento';
  isTrial?: boolean;
  rawText?: string;
}

/**
 * Resolve e gera a lista detalhada de parcelas com valores e datas mensais subsequentes
 */
export function resolveInstallmentsList(payload: PendingConfirmationPayload): Array<{
  installment_number: number;
  amount: number;
  due_date: string;
  barcode_or_pix?: string | null;
}> {
  const count = payload.installments_count || (payload.installments && payload.installments.length > 0 ? payload.installments.length : 1);
  if (count <= 1) return [];

  // Se já possui as parcelas completas com a mesma contagem
  if (payload.installments && payload.installments.length === count) {
    return payload.installments;
  }

  const baseDateStr = payload.due_date || payload.entry_date || new Date().toISOString().split('T')[0];
  const [bYear, bMonth, bDay] = baseDateStr.split('-').map(Number);
  const totalAmount = Math.abs(Number(payload.amount || 0));
  const installmentValue = Math.round((totalAmount / count) * 100) / 100;
  const totalRounded = installmentValue * count;
  const difference = Math.round((totalAmount - totalRounded) * 100) / 100;

  const result: Array<{
    installment_number: number;
    amount: number;
    due_date: string;
    barcode_or_pix?: string | null;
  }> = [];

  for (let i = 1; i <= count; i++) {
    // Adiciona (i - 1) meses a partir da data base da primeira parcela
    const targetMonth = bMonth - 1 + (i - 1);
    const dateObj = new Date(bYear, targetMonth, bDay || 1);
    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');
    const dueDate = `${yStr}-${mStr}-${dStr}`;

    const thisAmount = i === count ? Math.round((installmentValue + difference) * 100) / 100 : installmentValue;

    result.push({
      installment_number: i,
      amount: thisAmount,
      due_date: dueDate,
      barcode_or_pix: i === 1 ? payload.barcode_or_pix || null : null,
    });
  }

  return result;
}

/**
 * Mapeia categorias do sistema para nomes legíveis e amigáveis ao usuário
 */
export function formatCategoryName(rawCategory?: string): string {
  if (!rawCategory) return 'Geral';
  const cat = rawCategory.toLowerCase().trim();
  const map: Record<string, string> = {
    despesa_administrativa: 'Despesa Administrativa',
    receita_operacional: 'Receita Operacional',
    custo_mercadoria_servico: 'Custo de Mercadorias / Serviços',
    despesa_financeira: 'Despesa Financeira / Juros',
    impostos_tributos: 'Impostos e Tributos',
    investimento_equipamento: 'Investimentos',
    retirada_socios: 'Pró-Labore / Distribuição',
    alimentacao: 'Alimentação',
    transporte: 'Transporte / Combustível',
    aluguel: 'Aluguel / Condomínio',
    energia_agua_internet: 'Contas de Consumo (Luz/Água/Net)',
    fornecedor: 'Fornecedores',
    servico: 'Serviços Prestados',
    outros: 'Geral',
  };

  return map[cat] || rawCategory.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function formatPaymentMethodLabel(method?: string | null): string {
  if (!method) return 'Cartão / A Prazo';
  const map: Record<string, string> = {
    credit_card: 'Cartão de Crédito',
    pix: 'Pix',
    debit_card: 'Cartão de Débito',
    cash: 'Dinheiro',
    boleto: 'Boleto Bancário',
    transfer: 'Transferência / TED',
    other: 'A Prazo',
  };
  return map[method] || method;
}

/**
 * Formata a linha digitável ou chave Pix em bloco dedicado exclusivo para cópia em 1 toque no celular
 */
export function formatOneTouchPaymentCodeMessage(favorecido: string, rawCode: string): string {
  const trimmed = (rawCode || '').trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const isNumericBoletoLine =
    !trimmed.startsWith('000201') &&
    !/[a-zA-Z@]/.test(trimmed) &&
    digitsOnly.length >= 20;
  const linhaDigitavelPura = isNumericBoletoLine ? digitsOnly : trimmed;
  const cleanFav = (favorecido || 'Fornecedor').trim();

  return `📋 *Linha Digitável (${cleanFav}):*\n\n${linhaDigitavelPura}\n\n_(Toque e segure sobre os números acima para copiar e colar no app do seu banco)_`;
}

/**
 * Executa o estorno / desfazer da última baixa realizada nos últimos 15 minutos (UNDO_LAST_ACTION).
 */
export async function executeUndoLastSettlement(params: {
  client?: any;
  phone: string;
  cleanPhone: string;
}): Promise<{ success: boolean; message: string }> {
  const { client, phone, cleanPhone } = params;
  const supabase = createServiceRoleClient();

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const fifteenMinAgoIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  let query = supabase
    .from('bot_action_confirmations')
    .select('*')
    .in('status', ['confirmed', 'CONFIRMED'])
    .in('action_type', ['SETTLE_ACCOUNT', 'settle_account', 'D1_SETTLEMENT_CHECK'])
    .gte('created_at', fifteenMinAgoIso)
    .order('created_at', { ascending: false })
    .limit(1);

  if (client?.id) {
    query = query.or(`client_id.eq.${client.id},phone_number.eq.${cleanPhone},phone_number.eq.${altPhone}`);
  } else {
    query = query.or(`phone_number.eq.${cleanPhone},phone_number.eq.${altPhone}`);
  }

  const { data: confirmedRows } = await query;
  const lastAction = confirmedRows?.[0];

  if (!lastAction) {
    const noUndoMsg = `ℹ️ Não localizei nenhuma baixa confirmada nos últimos 15 minutos para desfazer.\n\n💡 Digite *contas* para consultar sua agenda financeira.`;
    await sendEvolutionText({ phone, text: noUndoMsg });
    return { success: false, message: noUndoMsg };
  }

  const payload = (lastAction.proposed_payload || lastAction.extracted_payload || {}) as Record<string, any>;
  const targetIdStr = String(
    payload.target_account_id || payload.billId || payload.bill_id || lastAction.target_entity_id || ''
  );
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetIdStr);
  const favorecido = String(payload.target_description || payload.counterparty_name || 'Fornecedor');
  const valorNum = Math.abs(Number(payload.target_amount ?? payload.amount ?? 0));
  const settledLedgerId = payload.settled_ledger_id ? String(payload.settled_ledger_id) : null;

  // 1. Volta a conta em payables_receivables para status = 'pending' e limpa paid_at = null
  if (isUuid) {
    const { error: prUpdateErr } = await supabase
      .from('payables_receivables')
      .update({
        status: 'pending',
        paid_at: null,
      } as any)
      .eq('id', targetIdStr);

    if (prUpdateErr) {
      const { error: prFallbackErr } = await supabase
        .from('payables_receivables')
        .update({ status: 'pending' })
        .eq('id', targetIdStr);

      if (prFallbackErr) {
        await supabase
          .from('payables_receivables')
          .update({ status: 'open' })
          .eq('id', targetIdStr);
      }
    }
  } else if (client?.id && favorecido) {
    const { data: paidBill } = await supabase
      .from('payables_receivables')
      .select('id')
      .eq('client_id', client.id)
      .eq('status', 'paid')
      .ilike('counterparty_name', `%${favorecido}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paidBill?.id) {
      const { error: prErr } = await supabase
        .from('payables_receivables')
        .update({ status: 'pending', paid_at: null } as any)
        .eq('id', paidBill.id);
      if (prErr) {
        await supabase
          .from('payables_receivables')
          .update({ status: 'pending' })
          .eq('id', paidBill.id);
      }
    }
  }

  // 1.b Também reabre em trial_leads.bills_list caso exista registro de degustação
  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, bills_list')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (lead && Array.isArray(lead.bills_list)) {
    const bills = [...lead.bills_list];
    let targetIdx = -1;

    if (targetIdStr) {
      targetIdx = bills.findIndex((b: any) => String(b.id || '') === targetIdStr);
    }

    if (targetIdx === -1 && targetIdStr.startsWith('trial_')) {
      const idxCand = parseInt(targetIdStr.replace('trial_', ''), 10);
      if (!isNaN(idxCand) && bills[idxCand]) {
        targetIdx = idxCand;
      }
    }

    if (targetIdx === -1 && favorecido) {
      const qDesc = favorecido.toLowerCase().trim();
      targetIdx = bills.findIndex((b: any) => {
        const bName = (b.supplier_name || b.counterparty_name || '').toLowerCase();
        return (b.is_paid || b.status === 'paid') && bName && (bName.includes(qDesc) || qDesc.includes(bName));
      });
    }

    if (targetIdx >= 0) {
      bills[targetIdx] = {
        ...bills[targetIdx],
        is_paid: false,
        status: 'pending',
        paid_at: null,
        reconciled_at: null,
      };
      await supabase
        .from('trial_leads')
        .update({ bills_list: bills })
        .eq('id', lead.id);
    }
  }

  // 2. Remove ou estorna o lançamento correspondente em cash_ledger_entries
  if (targetIdStr.startsWith('ledger_') && client?.id) {
    const ledgerId = targetIdStr.replace(/^ledger_/, '');
    await supabase
      .from('cash_ledger_entries')
      .update({ status: 'previsto' })
      .eq('id', ledgerId)
      .eq('client_id', client.id);
  } else if (settledLedgerId) {
    await supabase.from('cash_ledger_entries').delete().eq('id', settledLedgerId);
  } else if (client?.id) {
    const { data: recentLedger } = await supabase
      .from('cash_ledger_entries')
      .select('id, amount, description')
      .eq('client_id', client.id)
      .gte('created_at', fifteenMinAgoIso)
      .order('created_at', { ascending: false })
      .limit(5);

    const matchedLedger = (recentLedger || []).find((entry: any) => {
      const amtMatches = valorNum > 0 && Math.abs(Math.abs(Number(entry.amount || 0)) - valorNum) < 0.05;
      const descMatches =
        favorecido &&
        String(entry.description || '')
          .toLowerCase()
          .includes(favorecido.toLowerCase());
      return amtMatches || descMatches;
    });

    if (matchedLedger?.id) {
      await supabase.from('cash_ledger_entries').delete().eq('id', matchedLedger.id);
    }
  }

  // Marca a confirmação como revertida/cancelada para evitar duplo desfazer
  const { error: revErr } = await supabase
    .from('bot_action_confirmations')
    .update({ status: 'reverted' })
    .eq('id', lastAction.id);
  if (revErr) {
    await supabase
      .from('bot_action_confirmations')
      .update({ status: 'CANCELLED' })
      .eq('id', lastAction.id);
  }

  // 3. Responde no WhatsApp com o formato exato
  const valorFmt = valorNum.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const undoReply = `↩️ *Baixa desfeita com sucesso!*\n\nA conta de *R$ ${valorFmt}* (${favorecido}) voltou para o status de *Pendente* na sua agenda e o lançamento foi removido do Livro Caixa.`;

  await sendEvolutionText({
    phone,
    text: undoReply,
  });

  return { success: true, message: undoReply };
}

/**
 * 2.3. Layout do Card de Conferência (Template WhatsApp)
 */
export function formatConfirmationCard(payload: PendingConfirmationPayload): string {
  const isIncome = payload.entry_type === 'income' || payload.entry_type === 'receivable';
  const tipoLabel = isIncome ? 'Receita 🟢' : 'Despesa 🔴';
  const merchantName = payload.counterparty_name || payload.description || 'Lançamento Financeiro';
  const totalAmount = Math.abs(Number(payload.amount || 0));
  const amountFormatted = totalAmount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const rawDate = payload.due_date || payload.entry_date || new Date().toISOString().split('T')[0];
  const dueDateFormatted = formatDueDateDetails(rawDate);
  const categoryName = formatCategoryName(payload.category_name || payload.dre_group);

  // 1. Cenário de Compra Totalmente Quitada à Vista
  if (payload.payment_condition === 'already_paid') {
    const methodLabel = formatPaymentMethodLabel(payload.payment_method);
    const paidDateFmt = formatDueDateDetails(payload.due_date || payload.entry_date || payload.issue_date || rawDate);
    return `📋 *Espelho de Conferência (Compra Quitada)*

• *Tipo:* ${tipoLabel} (Liquidada no Caixa)
• *Favorecido:* ${merchantName}
• *Valor Total:* R$ ${amountFormatted} (${methodLabel})
• *Data do Pagamento:* ${paidDateFmt}
• *Categoria:* ${categoryName}

*[1]* ✅ Confirmar e Registrar no Caixa
*[2]* ✏️ Corrigir dados
*[3]* ❌ Cancelar lançamento

_(Aguardando sua confirmação para baixar no Livro Caixa)_`;
  }

  // 2. Cenário de Compra Parcelada com Histórico de Parcelas Pagas e a Vencer
  if (payload.paid_installments_count && payload.paid_installments_count > 0 && payload.remaining_installments_count) {
    const totalInsts = payload.installments_count || (payload.paid_installments_count + payload.remaining_installments_count);
    const methodLabel = formatPaymentMethodLabel(payload.payment_method);
    const instAmt = totalAmount / totalInsts;
    const instAmtFmt = instAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const paidAmtFmt = (payload.paid_amount || (instAmt * payload.paid_installments_count)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const remAmtFmt = (payload.remaining_amount || (instAmt * payload.remaining_installments_count)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const nextDueFormatted = formatDueDateDetails(payload.due_date || rawDate);

    let scheduleDetails = '';
    if (payload.upcoming_installments && payload.upcoming_installments.length > 0) {
      scheduleDetails = `\n\n📅 *Cronograma das Próximas Parcelas a Vencer:*\n` + payload.upcoming_installments.slice(0, 4).map(inst => `• ${inst.installment_number}ª Parcela: ${formatDueDateDetails(inst.due_date)} — R$ ${inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join('\n');
      if (payload.upcoming_installments.length > 4) {
        scheduleDetails += `\n• _... e mais ${payload.upcoming_installments.length - 4} parcelas subsequentes mensais_`;
      }
    }

    return `📋 *Espelho de Conferência (Nota Fiscal Parcelada)*

• *Tipo:* ${tipoLabel}
• *Favorecido:* ${merchantName}
• *Valor Total da NF:* R$ ${amountFormatted} (${totalInsts}x de R$ ${instAmtFmt} no ${methodLabel})
• *Histórico:* ${payload.paid_installments_count} parcela(s) já quitada(s) (R$ ${paidAmtFmt})
• *A Vencer:* ${payload.remaining_installments_count} parcela(s) a provisionar (Total R$ ${remAmtFmt})
• *Próximo Vencimento (${payload.paid_installments_count + 1}/${totalInsts}):* ${nextDueFormatted}
• *Categoria:* ${categoryName}${scheduleDetails}

*[1]* ✅ Confirmar e Salvar no Caixa
*[2]* ✏️ Corrigir dados
*[3]* ❌ Cancelar lançamento

_(Aguardando sua confirmação para provisionar as parcelas)_`;
  }

  const installmentsCount = payload.installments_count || (payload.installments && payload.installments.length > 1 ? payload.installments.length : 1);
  const isInstallment = installmentsCount > 1;

  if (isInstallment) {
    const installmentAmount = totalAmount / installmentsCount;
    const installmentAmountFormatted = installmentAmount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `📋 *Espelho de Conferência (Parcelamento)*

• *Tipo:* ${tipoLabel}
• *Favorecido:* ${merchantName}
• *Valor Total:* R$ ${amountFormatted} (em ${installmentsCount}x de R$ ${installmentAmountFormatted})
• *1º Vencimento:* ${dueDateFormatted}
• *Categoria:* ${categoryName}

*[1]* ✅ Confirmar e Gerar as ${installmentsCount} parcelas
*[2]* ✏️ Corrigir dados
*[3]* ❌ Cancelar lançamento

_(Aguardando sua confirmação para provisionar as parcelas)_`;
  }

  const originLabel = payload.entity_scope ? `${payload.entity_scope} - Identificada` : 'PJ - Identificada';

  return `📋 *Espelho de Conferência*

• *Tipo:* ${tipoLabel}
• *Favorecido / Descrição:* ${merchantName}
• *Valor:* R$ ${amountFormatted}
• *Vencimento / Data:* ${dueDateFormatted}
• *Categoria Prevista:* ${categoryName}
• *Origem:* ${originLabel}

Por favor, revise os dados antes de salvar:
*[1]* ✅ Confirmar e Salvar
*[2]* ✏️ Corrigir dados
*[3]* ❌ Cancelar lançamento

_(Aguardando sua confirmação para registrar no caixa)_`;
}

/**
 * Cria ou substitui uma confirmação pendente para o telefone informado
 */
export async function createPendingConfirmation(params: {
  clientId?: string | null;
  phoneNumber: string;
  actionType?:
    | 'CASH_ENTRY'
    | 'PAYABLE_BILL'
    | 'RECEIVABLE_BILL'
    | 'INVOICE_CONSULTATIVE_PROMPT'
    | 'ATTACH_BOLETO_TO_EXISTING_BILL'
    | 'EXACT_DUPLICATE_CONFIRMATION';
  payload: PendingConfirmationPayload;
  sendWhatsAppCard?: boolean;
  initialStatus?: 'PENDING' | 'AWAITING_INVOICE_DETAILS';
}): Promise<{ id: string; cardMessage: string }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = params.phoneNumber.replace(/\D/g, '');

  let determinedActionType = params.actionType;
  if (!determinedActionType) {
    if (params.payload.entry_type === 'receivable') {
      determinedActionType = 'RECEIVABLE_BILL';
    } else if (params.payload.entry_type === 'payable' || params.payload.due_date) {
      determinedActionType = 'PAYABLE_BILL';
    } else {
      determinedActionType = 'CASH_ENTRY';
    }
  }

  const expiresAt = addMinutes(new Date(), 30).toISOString();
  const initialStatus = params.initialStatus || 'PENDING';

  // Invalida pendências anteriores deste mesmo telefone para manter apenas a mais recente ativa
  await supabase
    .from('bot_action_confirmations')
    .update({ status: 'EXPIRED' })
    .eq('phone_number', cleanPhone)
    .in('status', ['PENDING', 'pending', 'AWAITING_CORRECTION', 'AWAITING_INVOICE_DETAILS']);

  // Insere tanto em extracted_payload quanto em proposed_payload (compatibilidade)
  let { data: record, error } = await supabase
    .from('bot_action_confirmations')
    .insert({
      client_id: params.clientId || null,
      phone_number: cleanPhone,
      action_type: determinedActionType,
      extracted_payload: params.payload,
      proposed_payload: params.payload,
      status: initialStatus,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) {
    // Fallback caso a constraint do banco exija status 'PENDING'
    const fallbackRes = await supabase
      .from('bot_action_confirmations')
      .insert({
        client_id: params.clientId || null,
        phone_number: cleanPhone,
        action_type: determinedActionType,
        extracted_payload: params.payload,
        proposed_payload: params.payload,
        status: 'PENDING',
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    record = fallbackRes.data;
    if (fallbackRes.error) {
      console.error('[createPendingConfirmation] Erro ao gravar pendência:', fallbackRes.error);
    }
  }

  const cardMessage = formatConfirmationCard(params.payload);

  if (params.sendWhatsAppCard !== false && initialStatus !== 'AWAITING_INVOICE_DETAILS') {
    await sendEvolutionText({
      phone: params.phoneNumber,
      text: cardMessage,
    });
  }

  return {
    id: record?.id || '',
    cardMessage,
  };
}

/**
 * 2.2 e 2.4. Máquina de Estados da Mensagem de Entrada (Webhook)
 * Verifica se o usuário possui pendência e processa confirmação, correção ou descarte.
 */
export async function handlePendingConfirmation(params: {
  phone: string;
  cleanPhone: string;
  altPhone: string;
  rawText: string;
  client: any;
  isOperator?: boolean;
  operatorName?: string;
  operatorRecord?: any;
}): Promise<{ handled: boolean; status?: string }> {
  const { phone, cleanPhone, altPhone, rawText, client } = params;
  if (!rawText || !rawText.trim() || isUndoLastActionMessage(rawText)) {
    return { handled: false };
  }

  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  // Busca confirmação ativa com status PENDING, AWAITING_CORRECTION, AWAITING_INVOICE_DETAILS ou AWAITING_POSTPONE_DATE
  let query = supabase
    .from('bot_action_confirmations')
    .select('*')
    .in('status', ['PENDING', 'pending', 'AWAITING_CORRECTION', 'AWAITING_INVOICE_DETAILS', 'AWAITING_POSTPONE_DATE'])
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  if (client?.id) {
    query = query.or(`client_id.eq.${client.id},phone_number.eq.${cleanPhone},phone_number.eq.${altPhone}`);
  } else {
    query = query.or(`phone_number.eq.${cleanPhone},phone_number.eq.${altPhone}`);
  }

  const { data: pendingList } = await query;
  const pendingAction = pendingList?.[0];

  if (!pendingAction) {
    return { handled: false };
  }

  // Apenas processa se a ação for de lançamento financeiro, conferência D+1, vínculo de boleto/duplicidade ou provocação consultiva de NF
  const isFinancialConfirmation = [
    'CASH_ENTRY',
    'PAYABLE_BILL',
    'RECEIVABLE_BILL',
    'confirm_low_confidence_doc',
    'INVOICE_CONSULTATIVE_PROMPT',
    'D1_SETTLEMENT_CHECK',
    'ATTACH_BOLETO_TO_EXISTING_BILL',
    'EXACT_DUPLICATE_CONFIRMATION',
  ].includes(pendingAction.action_type);

  if (!isFinancialConfirmation) {
    // Deixa outras ações (como 2FA de e-mail, reset geral) para seus respectivos manipuladores existentes
    return { handled: false };
  }

  const currentPayload: PendingConfirmationPayload =
    pendingAction.extracted_payload || pendingAction.proposed_payload || {};

  const cleanText = rawText.trim().toLowerCase();

  // ── AÇÃO ESPECIAL: VÍNCULO INTELIGENTE DE BOLETO À PARCELA DE NOTA FISCAL (ATTACH_BOLETO_TO_EXISTING_BILL) ──
  if (pendingAction.action_type === 'ATTACH_BOLETO_TO_EXISTING_BILL') {
    const targetAccountId = currentPayload.target_account_id || currentPayload.bill_id;
    const billAmount = Math.abs(Number(currentPayload.amount || 0));
    const counterparty = currentPayload.counterparty_name || 'Fornecedor';
    const dueFmt = currentPayload.due_date ? formatDueDateDetails(currentPayload.due_date) : 'Data agendada';
    const valFmt = billAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const isAttachOption1 =
      /^(1\b|1️⃣|sim\b|s\b|vincular\b|anexar\b|unificar\b|ok\b|confirmar\b)/i.test(cleanText) && cleanText.length <= 45;
    const isSeparateOption2 =
      /^(2\b|2️⃣|n[aã]o,?\s*lan[çc]ar|lan[çc]ar\b|nova\b|separad[oa]\b)/i.test(cleanText) && cleanText.length <= 45;
    const isCancelOption3 =
      /^(3\b|3️⃣|cancelar\b|cancela\b|descartar\b|descarta\b)/i.test(cleanText) && cleanText.length <= 45;

    if (isAttachOption1) {
      const realIssuerName =
        counterparty && !/^(emitente|fornecedor|agendamento)$/i.test(counterparty.trim())
          ? counterparty.trim()
          : undefined;

      if (currentPayload.target_source === 'trial_leads' || (!client?.id && targetAccountId)) {
        await updateTrialBill(cleanPhone, String(targetAccountId || counterparty), {
          barcode_or_pix: currentPayload.barcode_or_pix || null,
          is_provision: false,
          status: 'pending',
          ...(realIssuerName ? { supplier_name: realIssuerName } : {}),
        });
      } else if (client?.id && targetAccountId) {
        const updateData: Record<string, any> = {
          is_provision: false,
          status: 'pending',
        };
        if (realIssuerName) {
          updateData.counterparty_name = realIssuerName;
        }
        if (currentPayload.barcode_or_pix) {
          updateData.barcode_or_pix = currentPayload.barcode_or_pix;
        }
        if (currentPayload.document_id) {
          updateData.document_id = currentPayload.document_id;
        }
        await supabase
          .from('payables_receivables')
          .update(updateData)
          .eq('id', targetAccountId);
      }

      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'CONFIRMED' })
        .eq('id', pendingAction.id);

      const msg = `🔗 *Estimativa Convertida e Boleto Vinculado com Sucesso!*\n\nO boleto de *${valFmt}* (*${counterparty}*, vencimento em *${dueFmt}*) atualizou a parcela estimada da sua Nota Fiscal para agendamento definitivo sem duplicar o gasto no seu fluxo de caixa!`;

      await sendEvolutionText({
        phone,
        text: msg,
      });

      const codeToCopy = currentPayload.barcode_or_pix || currentPayload.pix_key;
      if (codeToCopy) {
        await sendEvolutionText({
          phone,
          text: formatOneTouchPaymentCodeMessage(counterparty, codeToCopy),
        });
      }

      return { handled: true, status: 'CONFIRMED' };
    }

    if (isCancelOption3) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'CANCELLED' })
        .eq('id', pendingAction.id);

      await sendEvolutionText({
        phone,
        text: '❌ *Operação cancelada.* O seu agendamento original permanece intacto sem alterações.',
      });

      return { handled: true, status: 'CANCELLED' };
    }

    if (!isSeparateOption2) {
      await sendEvolutionText({
        phone,
        text: `Por favor, escolha uma das opções para o boleto de *${valFmt}* (*${counterparty}*):\n\n*[1]* 🔗 Sim, atualizar agendamento existente\n*[2]* ➕ Não, lançar como despesa separada\n*[3]* ❌ Cancelar`,
      });
      return { handled: true, status: 'PENDING' };
    }
    // Se isSeparateOption2 for true, prossegue abaixo como confirmação de novo lançamento separado!
  }

  // ── AÇÃO ESPECIAL: CONFIRMAÇÃO DE POSSÍVEL DUPLICIDADE EXATA (EXACT_DUPLICATE_CONFIRMATION) ──
  if (pendingAction.action_type === 'EXACT_DUPLICATE_CONFIRMATION') {
    const billAmount = Math.abs(Number(currentPayload.amount || 0));
    const counterparty = currentPayload.counterparty_name || 'Fornecedor';
    const valFmt = billAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const isLaunchAnywayOption1 =
      /^(1\b|1️⃣|sim\b|s\b|lan[çc]ar\b|mesmo assim\b)/i.test(cleanText) && cleanText.length <= 45;
    const isCancelDuplicateOption2 =
      /^(2\b|2️⃣|3\b|3️⃣|n[aã]o\b|n\b|cancelar\b|cancela\b|descartar\b|j[aá] est[aá]\b)/i.test(cleanText) &&
      cleanText.length <= 45;

    if (isCancelDuplicateOption2) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'CANCELLED' })
        .eq('id', pendingAction.id);

      await sendEvolutionText({
        phone,
        text: `✅ *Lançamento duplicado descartado!*\n\nMantivemos apenas o agendamento original de *${counterparty}* (*${valFmt}*) ativo no seu fluxo de caixa.`,
      });

      return { handled: true, status: 'CANCELLED' };
    }

    if (!isLaunchAnywayOption1) {
      await sendEvolutionText({
        phone,
        text: `Por favor, escolha uma das opções para a conta de *${valFmt}* (*${counterparty}*):\n\n*[1]* ➕ Lançar mesmo assim (conta repetida/diferente)\n*[2]* ❌ Cancelar (já está cadastrada)`,
      });
      return { handled: true, status: 'PENDING' };
    }
    // Se isLaunchAnywayOption1 for true, prossegue abaixo para gravar o novo lançamento!
  }

  // ── AÇÃO ESPECIAL: CONFERÊNCIA INTERATIVA D+1 (LIQUIDAÇÃO / POSTERGAÇÃO) ──
  if (pendingAction.action_type === 'D1_SETTLEMENT_CHECK') {
    const billId = currentPayload.bill_id;
    const billAmount = Math.abs(Number(currentPayload.amount || 0));
    const counterparty = currentPayload.counterparty_name || 'Agendamento';
    const rawType = (currentPayload as unknown as Record<string, unknown>).type;
    const billType = currentPayload.entry_type === 'income' || rawType === 'receivable' ? 'receivable' : 'payable';
    const isInc = billType === 'receivable';

    // Sub-estado: Aguardando nova data de prorrogação
    if (pendingAction.status === 'AWAITING_POSTPONE_DATE') {
      const dateMatch = rawText.match(/(\d{1,2})(?:\/(\d{1,2}))?(?:\/(\d{2,4}))?/);
      let newDueDate: string | null = null;
      if (dateMatch) {
        const today = new Date();
        const d = parseInt(dateMatch[1], 10);
        const m = dateMatch[2] ? parseInt(dateMatch[2], 10) : today.getMonth() + 1;
        let y = dateMatch[3] ? parseInt(dateMatch[3], 10) : today.getFullYear();
        if (y < 100) y += 2000;
        newDueDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }

      if (newDueDate && billId) {
        await supabase
          .from('payables_receivables')
          .update({
            current_due_date: newDueDate,
            status: 'postponed',
          })
          .eq('id', billId);

        await supabase
          .from('bot_action_confirmations')
          .update({ status: 'CONFIRMED' })
          .eq('id', pendingAction.id);

        const [ny, nm, nd] = newDueDate.split('-');
        await sendEvolutionText({
          phone,
          text: `🗓️ *Vencimento Prorrogado!*\n\nO agendamento de *${counterparty}* foi prorrogado para o dia *${nd}/${nm}/${ny}* com sucesso. Você receberá o lembrete de liquidação na nova data.`,
        });

        return { handled: true, status: 'CONFIRMED' };
      } else {
        await sendEvolutionText({
          phone,
          text: `🗓️ Por favor, informe o dia do novo vencimento (ex: *15* ou *15/11*).`,
        });
        return { handled: true, status: 'AWAITING_POSTPONE_DATE' };
      }
    }

    // Estado PENDING: Opções [1] Pago, [2] Prorrogar, [3] Em atraso
    const isOption1 = /^(1\b|1️⃣|sim\b|s\b|pago\b|foi pago\b|liquidado\b|liquidei\b|ja paguei\b|já paguei\b|quitado\b)/i.test(cleanText);
    const isOption2 = /^(2\b|2️⃣|prorrogar\b|adiar\b|postergar\b|mudar data\b|nova data\b)/i.test(cleanText);
    const isOption3 = /^(3\b|3️⃣|atraso\b|em atraso\b|manter em atraso\b|deixar em atraso\b|n[aã]o paguei\b|n[aã]o\b|pendente\b)/i.test(cleanText);

    if (isOption1) {
      if (billId) {
        await supabase
          .from('payables_receivables')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('id', billId);
      }

      let settledLedgerId: string | null = null;
      if (client?.id) {
        const { data: insertedLedger } = await supabase
          .from('cash_ledger_entries')
          .insert({
            client_id: client.id,
            entry_date: new Date().toISOString().split('T')[0],
            description: `Pagamento ${counterparty} (Liquidado D+1)`,
            amount: isInc ? billAmount : -billAmount,
            entry_type: isInc ? 'income' : 'expense',
            dre_group: 'despesa_operacional',
            status: 'realizado',
            origin_profile: ((currentPayload as unknown as Record<string, unknown>).origin_profile as string) || 'PJ',
            entry_nature: 'OPERATIONAL',
          })
          .select('id')
          .maybeSingle();
        settledLedgerId = insertedLedger?.id || null;
      }

      await supabase
        .from('bot_action_confirmations')
        .update({
          status: 'CONFIRMED',
          proposed_payload: {
            ...currentPayload,
            target_account_id: billId,
            target_description: counterparty,
            target_amount: billAmount,
            target_type: billType,
            settled_ledger_id: settledLedgerId,
            confirmed_at: new Date().toISOString(),
          },
        })
        .eq('id', pendingAction.id);

      const valFmt = billAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      let reply = `✅ *Baixa Confirmada com Sucesso!*\n\nO pagamento de *${valFmt}* (${counterparty}) foi liquidado e baixado no seu Livro Caixa.`;

      // Gancho diário de saldo com cooldown de 24h
      const now = new Date();
      let shouldAskBalance = false;
      if (client?.id) {
        const lastPromptAt = client.last_balance_prompt_at ? new Date(client.last_balance_prompt_at) : null;
        if (!lastPromptAt || now.getTime() - lastPromptAt.getTime() >= 24 * 60 * 60 * 1000) {
          shouldAskBalance = true;
          try {
            await supabase
              .from('clients')
              .update({ last_balance_prompt_at: now.toISOString() })
              .eq('id', client.id);
          } catch {
            // Coluna opcional ainda não migrada
          }
        }
      }

      if (shouldAskBalance) {
        reply += `\n\n💡 _Teve alguma outra movimentação bancária não registrada hoje? Se quiser calibrar seu saldo, basta digitar: "meu saldo hoje é R$ X"._`;
      }

      await sendEvolutionText({
        phone,
        text: reply,
      });

      return { handled: true, status: 'CONFIRMED' };
    }

    if (isOption2) {
      const inlineDateMatch = rawText.match(/(\d{1,2})(?:\/(\d{1,2}))?(?:\/(\d{2,4}))?/);
      if (inlineDateMatch && cleanText.length > 3) {
        const today = new Date();
        const d = parseInt(inlineDateMatch[1], 10);
        const m = inlineDateMatch[2] ? parseInt(inlineDateMatch[2], 10) : today.getMonth() + 1;
        let y = inlineDateMatch[3] ? parseInt(inlineDateMatch[3], 10) : today.getFullYear();
        if (y < 100) y += 2000;
        const newDueDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        if (billId) {
          await supabase
            .from('payables_receivables')
            .update({
              current_due_date: newDueDate,
              status: 'postponed',
            })
            .eq('id', billId);
        }

        await supabase
          .from('bot_action_confirmations')
          .update({ status: 'CONFIRMED' })
          .eq('id', pendingAction.id);

        const [ny, nm, nd] = newDueDate.split('-');
        await sendEvolutionText({
          phone,
          text: `🗓️ *Vencimento Prorrogado!*\n\nO agendamento de *${counterparty}* foi prorrogado para o dia *${nd}/${nm}/${ny}* com sucesso.`,
        });

        return { handled: true, status: 'CONFIRMED' };
      }

      await supabase
        .from('bot_action_confirmations')
        .update({
          status: 'AWAITING_POSTPONE_DATE',
          expires_at: addMinutes(new Date(), 60).toISOString(),
        })
        .eq('id', pendingAction.id);

      await sendEvolutionText({
        phone,
        text: `🗓️ *Para qual nova data deseja prorrogar este agendamento?*\n\nBasta digitar o dia (ex: *15*, *20/11* ou *próxima segunda*).`,
      });

      return { handled: true, status: 'AWAITING_POSTPONE_DATE' };
    }

    if (isOption3) {
      if (billId) {
        await supabase
          .from('payables_receivables')
          .update({
            status: 'overdue',
          })
          .eq('id', billId);
      }

      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'CONFIRMED' })
        .eq('id', pendingAction.id);

      const valFmt = billAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      await sendEvolutionText({
        phone,
        text: `⚠️ *Anotado!*\n\nA conta de *${counterparty}* (${valFmt}) foi mantida como *em atraso* e seguirá com destaque no seu termômetro financeiro e relatórios até a sua quitação.`,
      });

      return { handled: true, status: 'CONFIRMED' };
    }

    await sendEvolutionText({
      phone,
      text: `Por favor, escolha uma das opções sobre o agendamento de *${counterparty}*:\n\n[1] Sim, foi pago\n[2] Não, quero prorrogar a data\n[3] Não, manter como em atraso`,
    });
    return { handled: true, status: 'PENDING' };
  }

  // ── ESTADO: AGUARDANDO DETALHES DE PAGAMENTO DA NOTA FISCAL (AWAITING_INVOICE_DETAILS) ──
  if (
    pendingAction.status === 'AWAITING_INVOICE_DETAILS' ||
    pendingAction.action_type === 'INVOICE_CONSULTATIVE_PROMPT'
  ) {
    // 1. Verifica se o usuário optou por cancelar
    if (
      /^(3\b|3️⃣|cancelar\b|cancela\b|descartar\b|descarta\b|n[aã]o\b|n\b|deixa\b|deixa pra l[aá]\b|apagar\b|excluir\b|errado\b)/i.test(
        cleanText
      ) && cleanText.length <= 40
    ) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'CANCELLED' })
        .eq('id', pendingAction.id);

      await sendEvolutionText({
        phone,
        text: '❌ Lançamento da Nota Fiscal descartado com sucesso.',
      });
      return { handled: true, status: 'CANCELLED' };
    }

    // 2. O usuário respondeu em linguagem natural (áudio transcrito ou texto)
    // Ex: "foi em 10x no cartão a começar em janeiro" ou "já paguei à vista no Pix hoje"
    const resolution = await parseInvoicePaymentResolution(rawText, {
      total_amount: currentPayload.amount,
      issue_date: currentPayload.issue_date,
      counterparty_name: currentPayload.counterparty_name,
      category_suggestion: currentPayload.category_name,
      known_payment_method: currentPayload.payment_method,
      known_total_installments: currentPayload.installments_count,
      known_payment_condition: currentPayload.payment_condition,
    });

    // Se o consultor preditivo identificou que ainda faltam dados essenciais (ex: dia do cartão ou se parcelas passadas já foram pagas):
    if (resolution.needs_clarification && resolution.clarification_question) {
      const partiallyUpdatedPayload: PendingConfirmationPayload = {
        ...currentPayload,
        payment_condition: resolution.payment_condition || currentPayload.payment_condition,
        payment_method: resolution.payment_method || currentPayload.payment_method,
        installments_count: resolution.total_installments > 1 ? resolution.total_installments : currentPayload.installments_count,
        is_installment: resolution.total_installments > 1 || currentPayload.is_installment,
        paid_installments_count: resolution.paid_installments_count,
        remaining_installments_count: resolution.remaining_installments_count,
      };

      await supabase
        .from('bot_action_confirmations')
        .update({
          status: 'PENDING',
          action_type: 'INVOICE_CONSULTATIVE_PROMPT',
          extracted_payload: partiallyUpdatedPayload,
          proposed_payload: partiallyUpdatedPayload,
          expires_at: addMinutes(new Date(), 30).toISOString(),
        })
        .eq('id', pendingAction.id);

      await sendEvolutionText({
        phone,
        text: resolution.clarification_question,
      });

      return { handled: true, status: 'AWAITING_INVOICE_DETAILS' };
    }

    const updatedPayload: PendingConfirmationPayload = {
      ...currentPayload,
      payment_condition: resolution.payment_condition,
      payment_method: resolution.payment_method,
      installments_count: resolution.total_installments,
      is_installment: resolution.total_installments > 1,
      paid_installments_count: resolution.paid_installments_count,
      remaining_installments_count: resolution.remaining_installments_count,
      paid_amount: resolution.paid_amount,
      remaining_amount: resolution.remaining_amount,
      past_installments: resolution.past_installments,
      upcoming_installments: resolution.upcoming_installments,
      due_date: resolution.first_upcoming_due_date || currentPayload.due_date,
      entry_date: resolution.first_upcoming_due_date || currentPayload.entry_date,
      category_name: resolution.category_override || currentPayload.category_name,
      dre_group: resolution.category_override || currentPayload.dre_group,
    };

    const resolvedActionType =
      updatedPayload.entry_type === 'receivable' || updatedPayload.entry_type === 'income'
        ? 'RECEIVABLE_BILL'
        : 'PAYABLE_BILL';

    // Atualiza status para PENDING e action_type para que o usuário possa confirmar com [1]
    await supabase
      .from('bot_action_confirmations')
      .update({
        status: 'PENDING',
        action_type: resolvedActionType,
        extracted_payload: updatedPayload,
        proposed_payload: updatedPayload,
        expires_at: addMinutes(new Date(), 30).toISOString(),
      })
      .eq('id', pendingAction.id);

    const confirmationCard = formatConfirmationCard(updatedPayload);
    await sendEvolutionText({
      phone,
      text: `💡 *Entendido! Tudo organizado:*\n${resolution.summary_explanation}\n\n${confirmationCard}`,
    });

    return { handled: true, status: 'INVOICE_DETAILS_RESOLVED' };
  }

  // ── ESTADO: AGUARDANDO DADOS DA CORREÇÃO (AWAITING_CORRECTION) ──
  if (pendingAction.status === 'AWAITING_CORRECTION') {
    // O usuário enviou os dados corrigidos (ex: "o valor é 85", "vencimento dia 25", "fornecedor é Posto Shell")
    const updatedPayload = { ...currentPayload };

    // 1. Tenta extração rápida com expressões regulares comuns
    const amountMatch = rawText.match(/(?:valor|r\$|reais)?\s*[:=]?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:reais)?/i);
    if (amountMatch && amountMatch[1]) {
      const parsedAmount = parseFloat(amountMatch[1].replace(',', '.'));
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        updatedPayload.amount = parsedAmount;
      }
    }

    const dateMatch = rawText.match(/(?:vencimento|vence|data|dia)\s*[:=]?\s*(\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?)/i);
    if (dateMatch && dateMatch[1]) {
      const parts = dateMatch[1].split('/');
      const today = new Date();
      const day = parseInt(parts[0], 10);
      const month = parts[1] ? parseInt(parts[1], 10) : today.getMonth() + 1;
      let year = parts[2] ? parseInt(parts[2], 10) : today.getFullYear();
      if (year < 100) year += 2000;

      const yyyy = year.toString();
      const mm = month.toString().padStart(2, '0');
      const dd = day.toString().padStart(2, '0');
      updatedPayload.due_date = `${yyyy}-${mm}-${dd}`;
      updatedPayload.entry_date = updatedPayload.due_date;
    }

    if (!amountMatch && !dateMatch) {
      try {
        const geminiCorrections = await parseConversationalCorrections(rawText);
        if (geminiCorrections.renames && geminiCorrections.renames.length > 0) {
          updatedPayload.counterparty_name = geminiCorrections.renames[0].new_name;
        }
        if (geminiCorrections.amount_changes && geminiCorrections.amount_changes.length > 0) {
          updatedPayload.amount = geminiCorrections.amount_changes[0].new_amount;
        }
        if (geminiCorrections.due_date_changes && geminiCorrections.due_date_changes.length > 0) {
          const rawDue = geminiCorrections.due_date_changes[0].new_due_date_raw;
          if (rawDue) {
            updatedPayload.due_date = rawDue;
            updatedPayload.entry_date = rawDue;
          }
        }
      } catch (err) {
        console.warn('[handlePendingConfirmation] Erro ao chamar Gemini corrections:', err);
        if (rawText.length >= 3 && rawText.length <= 60) {
          updatedPayload.counterparty_name = rawText.trim();
        }
      }
    }

    await supabase
      .from('bot_action_confirmations')
      .update({
        status: 'PENDING',
        extracted_payload: updatedPayload,
        proposed_payload: updatedPayload,
        expires_at: addMinutes(new Date(), 30).toISOString(),
      })
      .eq('id', pendingAction.id);

    const updatedCard = formatConfirmationCard(updatedPayload);
    await sendEvolutionText({
      phone,
      text: `✏️ *Dados atualizados com sucesso!*\n\n${updatedCard}`,
    });

    return { handled: true, status: 'UPDATED' };
  }

  // ── ESTADO: PENDENTE DE CONFIRMAÇÃO (PENDING) ──
  const isConfirm =
    pendingAction.action_type === 'ATTACH_BOLETO_TO_EXISTING_BILL' ||
    pendingAction.action_type === 'EXACT_DUPLICATE_CONFIRMATION' ||
    (/^(1\b|1️⃣|sim\b|s\b|confirmo\b|confirmar\b|salvar\b|pode salvar\b|correto\b|ok\b|positivo\b|com certeza\b|aprovar\b)/i.test(
      cleanText
    ) &&
      cleanText.length <= 40);

  const isEdit =
    /^(2\b|2️⃣|corrigir\b|alterar\b|mudar\b|editar\b|ajustar\b|trocar\b|modificar\b)/i.test(cleanText) &&
    cleanText.length <= 40;

  const isCancel =
    /^(3\b|3️⃣|cancelar\b|cancela\b|descartar\b|descarta\b|n[aã]o\b|n\b|deixa\b|deixa pra l[aá]\b|apagar\b|excluir\b|errado\b)/i.test(
      cleanText
    ) && cleanText.length <= 40;

  // 1. AÇÃO DE CONFIRMAÇÃO ([1])
  if (isConfirm) {
    await supabase
      .from('bot_action_confirmations')
      .update({ status: 'CONFIRMED' })
      .eq('id', pendingAction.id);

    const isInc = currentPayload.entry_type === 'income' || currentPayload.entry_type === 'receivable';
    const amountVal = Math.abs(Number(currentPayload.amount || 0));
    const entryDate =
      currentPayload.due_date ||
      currentPayload.entry_date ||
      new Date().toISOString().split('T')[0];
    const description =
      currentPayload.description ||
      `${isInc ? 'RECEITA' : 'DESPESA'} - ${currentPayload.counterparty_name || 'Diversos'}`;
    const dreGroup =
      currentPayload.dre_group ||
      currentPayload.category_name ||
      (isInc ? 'receita_operacional' : 'despesa_administrativa');

    if (client?.id) {
      if (currentPayload.payment_condition === 'already_paid') {
        // Grava como realizado no Livro Caixa (sem gerar conta a pagar futura)
        await supabase.from('cash_ledger_entries').insert({
          client_id: client.id,
          document_id: currentPayload.document_id || null,
          entry_date: entryDate,
          description: `${description} (${formatPaymentMethodLabel(currentPayload.payment_method)} - Quitado)`,
          amount: isInc ? amountVal : -amountVal,
          entry_type: isInc ? 'income' : 'expense',
          dre_group: dreGroup,
          status: 'realizado',
        });
      } else {
        // Se houver parcelas passadas já quitadas, grava no Livro Caixa como realizadas
        if (currentPayload.past_installments && currentPayload.past_installments.length > 0) {
          const totInst = currentPayload.installments_count || (currentPayload.past_installments.length + (currentPayload.upcoming_installments?.length || 0));
          for (const past of currentPayload.past_installments) {
            await supabase.from('cash_ledger_entries').insert({
              client_id: client.id,
              document_id: currentPayload.document_id || null,
              entry_date: past.paid_date,
              description: `${currentPayload.counterparty_name || 'Despesa'} (Parc. ${past.installment_number}/${totInst} - Paga)`,
              amount: isInc ? Math.abs(Number(past.amount)) : -Math.abs(Number(past.amount)),
              entry_type: isInc ? 'income' : 'expense',
              dre_group: dreGroup,
              status: 'realizado',
            });
          }
        }

        // Provisiona as parcelas futuras no Contas a Pagar (payables_receivables)
        const todayIsoStr = new Date().toISOString().split('T')[0];
        if (currentPayload.upcoming_installments && currentPayload.upcoming_installments.length > 0) {
          const totInst = currentPayload.installments_count || ((currentPayload.past_installments?.length || 0) + currentPayload.upcoming_installments.length);
          for (const upcoming of currentPayload.upcoming_installments) {
            const instStatus = upcoming.due_date && upcoming.due_date < todayIsoStr ? 'overdue' : 'open';
            await supabase.from('payables_receivables').insert({
              client_id: client.id,
              document_id: currentPayload.document_id || null,
              counterparty_name: `${currentPayload.counterparty_name || 'Fornecedor'} (Parc. ${upcoming.installment_number}/${totInst})`,
              type: isInc ? 'receivable' : 'payable',
              amount: Math.abs(Number(upcoming.amount)),
              original_due_date: upcoming.due_date,
              current_due_date: upcoming.due_date,
              status: instStatus,
              barcode_or_pix: upcoming.barcode_or_pix || null,
              is_provision: !upcoming.barcode_or_pix,
            });
          }
        } else {
          // Fallback para parcelamento padrão do resolveInstallmentsList
          const resolvedInstallments = resolveInstallmentsList(currentPayload);
          if (resolvedInstallments.length > 0) {
            for (const inst of resolvedInstallments) {
              const instStatus = inst.due_date && inst.due_date < todayIsoStr ? 'overdue' : 'open';
              await supabase.from('payables_receivables').insert({
                client_id: client.id,
                document_id: currentPayload.document_id || null,
                counterparty_name: `${currentPayload.counterparty_name || 'Fornecedor'} (Parc. ${inst.installment_number}/${resolvedInstallments.length})`,
                type: isInc ? 'receivable' : 'payable',
                amount: Math.abs(Number(inst.amount)),
                original_due_date: inst.due_date,
                current_due_date: inst.due_date,
                status: instStatus,
                barcode_or_pix: inst.barcode_or_pix || null,
                is_provision: !inst.barcode_or_pix,
              });
            }
          } else {
            const singleStatus = entryDate < todayIsoStr ? 'overdue' : 'open';
            await supabase.from('cash_ledger_entries').insert({
              client_id: client.id,
              document_id: currentPayload.document_id || null,
              entry_date: entryDate,
              description,
              amount: isInc ? amountVal : -amountVal,
              entry_type: isInc ? 'income' : 'expense',
              dre_group: dreGroup,
              status: currentPayload.is_provision ? 'previsto' : 'realizado',
            });
            await supabase.from('payables_receivables').insert({
              client_id: client.id,
              document_id: currentPayload.document_id || null,
              counterparty_name: currentPayload.counterparty_name || (isInc ? 'Cliente' : 'Fornecedor'),
              type: isInc ? 'receivable' : 'payable',
              amount: amountVal,
              original_due_date: entryDate,
              current_due_date: entryDate,
              status: singleStatus,
              barcode_or_pix: currentPayload.barcode_or_pix || null,
              is_provision: Boolean(currentPayload.is_provision),
            });
          }
        }
      }
    }

    // Sincroniza também em trial_leads.bills_list se for Lead em degustação (ou se já possuir registro em trial_leads)
    const { data: existingTrialLead } = await supabase
      .from('trial_leads')
      .select('id')
      .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
      .limit(1)
      .maybeSingle();

    if (!client?.id || existingTrialLead?.id) {
      if (currentPayload.payment_condition === 'already_paid') {
        await recordTrialUsage(cleanPhone, {
          supplier_name: currentPayload.counterparty_name || 'Fornecedor',
          counterparty_name: currentPayload.counterparty_name || 'Fornecedor',
          amount: amountVal,
          due_date: entryDate,
          entry_type: isInc ? 'receivable' : 'payable',
          category: dreGroup,
          barcode_or_pix: currentPayload.barcode_or_pix || null,
          document_type: `${currentPayload.description || 'Nota Fiscal'} (Quitada)`,
        });
      } else if (currentPayload.upcoming_installments && currentPayload.upcoming_installments.length > 0) {
        const totInst = currentPayload.installments_count || ((currentPayload.past_installments?.length || 0) + currentPayload.upcoming_installments.length);
        for (const upcoming of currentPayload.upcoming_installments) {
          await recordTrialUsage(cleanPhone, {
            supplier_name: `${currentPayload.counterparty_name || 'Fornecedor'} (Parc. ${upcoming.installment_number}/${totInst})`,
            counterparty_name: `${currentPayload.counterparty_name || 'Fornecedor'} (Parc. ${upcoming.installment_number}/${totInst})`,
            amount: Math.abs(Number(upcoming.amount)),
            due_date: upcoming.due_date,
            entry_type: isInc ? 'receivable' : 'payable',
            category: dreGroup,
            barcode_or_pix: upcoming.barcode_or_pix || null,
            is_provision: Boolean(currentPayload.is_provision && !upcoming.barcode_or_pix),
            document_type: currentPayload.description || 'Lançamento Parcelado',
          });
        }
      } else {
        const resolvedInstallments = resolveInstallmentsList(currentPayload);
        if (resolvedInstallments.length > 0) {
          for (const inst of resolvedInstallments) {
            await recordTrialUsage(cleanPhone, {
              supplier_name: `${currentPayload.counterparty_name || 'Fornecedor'} (Parc. ${inst.installment_number}/${resolvedInstallments.length})`,
              counterparty_name: `${currentPayload.counterparty_name || 'Fornecedor'} (Parc. ${inst.installment_number}/${resolvedInstallments.length})`,
              amount: Math.abs(Number(inst.amount)),
              due_date: inst.due_date,
              entry_type: isInc ? 'receivable' : 'payable',
              category: dreGroup,
              barcode_or_pix: inst.barcode_or_pix || null,
              is_provision: Boolean(currentPayload.is_provision && !inst.barcode_or_pix),
              document_type: currentPayload.description || 'Lançamento Parcelado',
            });
          }
        } else {
          await recordTrialUsage(cleanPhone, {
            supplier_name: currentPayload.counterparty_name || 'Fornecedor',
            counterparty_name: currentPayload.counterparty_name || 'Fornecedor',
            amount: amountVal,
            due_date: entryDate,
            entry_type: isInc ? 'receivable' : 'payable',
            category: dreGroup,
            barcode_or_pix: currentPayload.barcode_or_pix || null,
            pix_key: currentPayload.pix_key || null,
            pix_key_type: currentPayload.pix_key_type || null,
            is_provision: Boolean(currentPayload.is_provision && !currentPayload.barcode_or_pix),
            document_type: currentPayload.description || 'Lançamento',
          });
        }
      }
    }

    let successMsg = '✅ Lançamento gravado com sucesso no seu Livro Caixa!';
    if (currentPayload.payment_condition === 'already_paid') {
      successMsg = `✅ *Compra quitada à vista registrada e liquidada no seu Livro Caixa!*`;
    } else if (currentPayload.past_installments && currentPayload.past_installments.length > 0) {
      const pCount = currentPayload.past_installments.length;
      const uCount = currentPayload.upcoming_installments?.length || 0;
      successMsg = `✅ *Nota Fiscal integrada com sucesso!*\n• *${pCount} parcela(s) já quitada(s)* baixada(s) no Livro Caixa.\n• *${uCount} parcela(s) futura(s)* provisionada(s) no seu Contas a Pagar.`;
    } else if (currentPayload.upcoming_installments && currentPayload.upcoming_installments.length > 0) {
      successMsg = `✅ *Lançamento parcelado gravado com sucesso!* As ${currentPayload.upcoming_installments.length} parcelas foram provisionadas no seu Contas a Pagar.`;
    } else {
      const resolvedInsts = resolveInstallmentsList(currentPayload);
      if (resolvedInsts.length > 0) {
        successMsg = `✅ Lançamento parcelado gravado com sucesso! As ${resolvedInsts.length} parcelas foram provisionadas no seu Livro Caixa.`;
      }
    }

    // GANCHO DIÁRIO DE SALDO COM COOLDOWN DE 24H (TAREFA 4)
    let shouldAskDailyBalance = false;
    const nowBalanceCheck = new Date();
    if (client?.id) {
      const lastPromptAt = client.last_balance_prompt_at ? new Date(client.last_balance_prompt_at) : null;
      if (!lastPromptAt || nowBalanceCheck.getTime() - lastPromptAt.getTime() >= 24 * 60 * 60 * 1000) {
        shouldAskDailyBalance = true;
        try {
          await supabase
            .from('clients')
            .update({ last_balance_prompt_at: nowBalanceCheck.toISOString() })
            .eq('id', client.id);
        } catch {
          // Coluna opcional
        }
      }
    } else {
      const { data: lead } = await supabase
        .from('trial_leads')
        .select('id, doc_data')
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
        .limit(1)
        .maybeSingle();

      const existingDocData = (lead?.doc_data && typeof lead.doc_data === 'object') ? lead.doc_data : {};
      const leadPromptStr = existingDocData.last_balance_prompt_at;
      const lastPromptAt = leadPromptStr ? new Date(leadPromptStr) : null;
      if (!lastPromptAt || nowBalanceCheck.getTime() - lastPromptAt.getTime() >= 24 * 60 * 60 * 1000) {
        shouldAskDailyBalance = true;
        if (lead?.id) {
          await supabase
            .from('trial_leads')
            .update({
              doc_data: {
                ...existingDocData,
                last_balance_prompt_at: nowBalanceCheck.toISOString(),
              },
            })
            .eq('id', lead.id);

          try {
            await supabase
              .from('trial_leads')
              .update({ last_balance_prompt_at: nowBalanceCheck.toISOString() })
              .eq('id', lead.id);
          } catch {
            // Coluna opcional
          }
        }
      }
    }

    if (shouldAskDailyBalance) {
      successMsg += `\n\n💡 _Teve alguma outra movimentação bancária não registrada hoje? Se quiser calibrar seu saldo, basta digitar: "meu saldo hoje é R$ X"._`;
    }

    await sendEvolutionText({
      phone,
      text: successMsg,
    });

    if (params.isOperator && client?.whatsapp_number && client.whatsapp_number !== phone) {
      if (params.operatorRecord?.notify_owner_on_action !== false) {
        const valFmt = amountVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const favorecido = currentPayload.counterparty_name || currentPayload.description || 'Lançamento';
        const opName = params.operatorName || 'Operador(a)';
        await sendEvolutionText({
          phone: client.whatsapp_number,
          text: `🔔 *[Aviso Equipe]* A secretária/operador *${opName}* acabou de registrar uma nova conta:\n• *Valor:* ${valFmt}\n• *Favorecido:* ${favorecido}\n• *Data:* ${entryDate}\n\n_Lançamento auditado e integrado ao seu Livro Caixa._`,
        });
      }
    }

    const codeToCopy = currentPayload.barcode_or_pix || currentPayload.pix_key;
    if (codeToCopy) {
      const favLabel = currentPayload.counterparty_name || currentPayload.description || 'Fornecedor';
      await sendEvolutionText({
        phone,
        text: formatOneTouchPaymentCodeMessage(favLabel, codeToCopy),
      });
    }

    return { handled: true, status: 'CONFIRMED' };
  }

  // 2. AÇÃO DE CORREÇÃO ([2])
  if (isEdit) {
    await supabase
      .from('bot_action_confirmations')
      .update({
        status: 'AWAITING_CORRECTION',
        expires_at: addMinutes(new Date(), 30).toISOString(),
      })
      .eq('id', pendingAction.id);

    await sendEvolutionText({
      phone,
      text: `✏️ *Diga qual informação deseja alterar.*\n\nExemplo:\n• _"o valor é 80"_\n• _"vencimento dia 25"_\n• _"fornecedor é Posto Shell"_`,
    });

    return { handled: true, status: 'AWAITING_CORRECTION' };
  }

  // 3. AÇÃO DE CANCELAMENTO ([3])
  if (isCancel) {
    await supabase
      .from('bot_action_confirmations')
      .update({ status: 'CANCELLED' })
      .eq('id', pendingAction.id);

    await sendEvolutionText({
      phone,
      text: '❌ Lançamento descartado. Nada foi registrado no seu saldo.',
    });

    return { handled: true, status: 'CANCELLED' };
  }

  // 4. SUPORTE CONTÍNUO A LINGUAGEM NATURAL NO ESTADO PENDING
  // Se o usuário digitou uma frase com instruções de correção ou condições de parcelamento
  if (cleanText.length >= 4 && !isConfirm && !isEdit && !isCancel) {
    try {
      if (currentPayload.payment_condition || currentPayload.issue_date) {
        const resolution = await parseInvoicePaymentResolution(rawText, {
          total_amount: currentPayload.amount,
          issue_date: currentPayload.issue_date,
          counterparty_name: currentPayload.counterparty_name,
          category_suggestion: currentPayload.category_name,
        });

        if (resolution.is_understood) {
          const updatedPayload: PendingConfirmationPayload = {
            ...currentPayload,
            payment_condition: resolution.payment_condition,
            payment_method: resolution.payment_method,
            installments_count: resolution.total_installments,
            is_installment: resolution.total_installments > 1,
            paid_installments_count: resolution.paid_installments_count,
            remaining_installments_count: resolution.remaining_installments_count,
            paid_amount: resolution.paid_amount,
            remaining_amount: resolution.remaining_amount,
            past_installments: resolution.past_installments,
            upcoming_installments: resolution.upcoming_installments,
            due_date: resolution.first_upcoming_due_date || currentPayload.due_date,
            entry_date: resolution.first_upcoming_due_date || currentPayload.entry_date,
            category_name: resolution.category_override || currentPayload.category_name,
            dre_group: resolution.category_override || currentPayload.dre_group,
          };

          await supabase
            .from('bot_action_confirmations')
            .update({
              status: 'PENDING',
              extracted_payload: updatedPayload,
              proposed_payload: updatedPayload,
              expires_at: addMinutes(new Date(), 30).toISOString(),
            })
            .eq('id', pendingAction.id);

          const updatedCard = formatConfirmationCard(updatedPayload);
          await sendEvolutionText({
            phone,
            text: `✏️ *Atualizei as condições com base no que você me disse:*\n${resolution.summary_explanation}\n\n${updatedCard}`,
          });

          return { handled: true, status: 'UPDATED_NATURAL_LANGUAGE' };
        }
      }

      const geminiCorrections = await parseConversationalCorrections(rawText);
      if (geminiCorrections.has_corrections) {
        const updatedPayload = { ...currentPayload };
        if (geminiCorrections.renames?.[0]) updatedPayload.counterparty_name = geminiCorrections.renames[0].new_name;
        if (geminiCorrections.amount_changes?.[0]) updatedPayload.amount = geminiCorrections.amount_changes[0].new_amount;
        if (geminiCorrections.due_date_changes?.[0]) {
          const rawDue = geminiCorrections.due_date_changes[0].new_due_date_raw;
          if (rawDue) {
            updatedPayload.due_date = rawDue;
            updatedPayload.entry_date = rawDue;
          }
        }

        await supabase
          .from('bot_action_confirmations')
          .update({
            status: 'PENDING',
            extracted_payload: updatedPayload,
            proposed_payload: updatedPayload,
            expires_at: addMinutes(new Date(), 30).toISOString(),
          })
          .eq('id', pendingAction.id);

        const updatedCard = formatConfirmationCard(updatedPayload);
        await sendEvolutionText({
          phone,
          text: `✏️ *Dados ajustados!*\n\n${updatedCard}`,
        });

        return { handled: true, status: 'UPDATED_NATURAL_LANGUAGE' };
      }
    } catch (nlErr) {
      console.warn('[handlePendingConfirmation NL Warning]:', nlErr);
    }
  }

  // Se o usuário mandou qualquer outra mensagem não interpretável enquanto tem pendência ativa, relembramos
  const cardReminder = formatConfirmationCard(currentPayload);
  await sendEvolutionText({
    phone,
    text: `⚠️ *Você possui um lançamento pendente de confirmação!*\n\n${cardReminder}`,
  });

  return { handled: true, status: 'REMINDED' };
}

/**
 * 2.5. Opt-in Legal / Termos no WhatsApp (Primeira Mensagem)
 * Garante que todo novo usuário receba o aviso legal de responsabilidade e aceite termos.
 */
export async function checkAndApplyLegalOptIn(params: {
  phone: string;
  cleanPhone: string;
  client: any;
  isGreetingOnly?: boolean;
}): Promise<{ optInSent: boolean; shouldStopProcessing: boolean }> {
  const { phone, cleanPhone, client, isGreetingOnly } = params;
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { getWelcomeAndPfPjMessage } = await import('@/lib/solo/onboarding-flow');

  // Caso 1: Usuário é Cliente Cadastrado
  if (client?.id) {
    if (!client.terms_accepted_at || !client.profile_type) {
      await supabase
        .from('clients')
        .update({ terms_accepted_at: nowIso })
        .eq('id', client.id);

      if (!client.profile_type) {
        await sendEvolutionText({
          phone,
          text: getWelcomeAndPfPjMessage(),
        });
        return {
          optInSent: true,
          shouldStopProcessing: true,
        };
      }
    }
    return { optInSent: false, shouldStopProcessing: false };
  }

  // Caso 2: Usuário é Lead / Degustação Gratuita
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, terms_accepted_at, profile_type, onboarding_step')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (!lead || !lead.terms_accepted_at || !lead.profile_type) {
    if (lead?.id) {
      await supabase
        .from('trial_leads')
        .update({
          terms_accepted_at: nowIso,
          onboarding_step: lead.onboarding_step || 'awaiting_pf_or_pj',
        })
        .eq('id', lead.id);
    } else {
      await supabase.from('trial_leads').insert({
        whatsapp_number: cleanPhone,
        terms_accepted_at: nowIso,
        first_interaction_at: nowIso,
        onboarding_step: 'awaiting_pf_or_pj',
      });
    }

    await sendEvolutionText({
      phone,
      text: getWelcomeAndPfPjMessage(),
    });

    return {
      optInSent: true,
      shouldStopProcessing: true,
    };
  }

  return { optInSent: false, shouldStopProcessing: false };
}
