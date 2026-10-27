import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { formatDueDateDetails } from '@/lib/solo/date-utils';
import { recordTrialUsage } from '@/lib/solo/trial';
import { parseConversationalCorrections, parseInvoicePaymentResolution } from '@/lib/solo/gemini';
import { addMinutes } from 'date-fns';

export interface PendingConfirmationPayload {
  amount: number;
  counterparty_name: string;
  description?: string;
  due_date?: string; // YYYY-MM-DD
  entry_date?: string; // YYYY-MM-DD
  issue_date?: string | null;
  entry_type: 'payable' | 'receivable' | 'income' | 'expense';
  category_name?: string;
  dre_group?: string;
  entity_scope?: 'PJ' | 'PF';
  barcode_or_pix?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  document_id?: string | null;
  bill_id?: string | null;
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
  actionType?: 'CASH_ENTRY' | 'PAYABLE_BILL' | 'RECEIVABLE_BILL' | 'INVOICE_CONSULTATIVE_PROMPT';
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
  const { data: record, error } = await supabase
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
    console.error('[createPendingConfirmation] Erro ao gravar pendência:', error);
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
  if (!rawText || !rawText.trim()) {
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

  // Apenas processa se a ação for de lançamento financeiro, conferência D+1 ou provocação consultiva de NF
  const isFinancialConfirmation = [
    'CASH_ENTRY',
    'PAYABLE_BILL',
    'RECEIVABLE_BILL',
    'confirm_low_confidence_doc',
    'INVOICE_CONSULTATIVE_PROMPT',
    'D1_SETTLEMENT_CHECK',
  ].includes(pendingAction.action_type);

  if (!isFinancialConfirmation) {
    // Deixa outras ações (como 2FA de e-mail, reset geral) para seus respectivos manipuladores existentes
    return { handled: false };
  }

  const currentPayload: PendingConfirmationPayload =
    pendingAction.extracted_payload || pendingAction.proposed_payload || {};

  const cleanText = rawText.trim().toLowerCase();

  // ── AÇÃO ESPECIAL: CONFERÊNCIA INTERATIVA D+1 (LIQUIDAÇÃO / POSTERGAÇÃO) ──
  if (pendingAction.action_type === 'D1_SETTLEMENT_CHECK') {
    const billId = currentPayload.bill_id;
    const billAmount = Math.abs(Number(currentPayload.amount || 0));
    const counterparty = currentPayload.counterparty_name || 'Agendamento';
    const rawType = (currentPayload as Record<string, unknown>).type;
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

      if (client?.id) {
        await supabase.from('cash_ledger_entries').insert({
          client_id: client.id,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Pagamento ${counterparty} (Liquidado D+1)`,
          amount: isInc ? billAmount : -billAmount,
          entry_type: isInc ? 'income' : 'expense',
          dre_group: 'despesa_operacional',
          status: 'realizado',
          origin_profile: ((currentPayload as Record<string, unknown>).origin_profile as string) || 'PJ',
          entry_nature: 'OPERATIONAL',
        });
      }

      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'CONFIRMED' })
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
          await supabase
            .from('clients')
            .update({ last_balance_prompt_at: now.toISOString() })
            .eq('id', client.id);
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
  if (pendingAction.status === 'AWAITING_INVOICE_DETAILS') {
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
          status: 'AWAITING_INVOICE_DETAILS',
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

    // Atualiza status para PENDING para que o usuário possa confirmar com [1]
    await supabase
      .from('bot_action_confirmations')
      .update({
        status: 'PENDING',
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
    /^(1\b|1️⃣|sim\b|s\b|confirmo\b|confirmar\b|salvar\b|pode salvar\b|correto\b|ok\b|positivo\b|com certeza\b|aprovar\b)/i.test(
      cleanText
    ) && cleanText.length <= 40;

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
        if (currentPayload.upcoming_installments && currentPayload.upcoming_installments.length > 0) {
          const totInst = currentPayload.installments_count || ((currentPayload.past_installments?.length || 0) + currentPayload.upcoming_installments.length);
          for (const upcoming of currentPayload.upcoming_installments) {
            await supabase.from('payables_receivables').insert({
              client_id: client.id,
              document_id: currentPayload.document_id || null,
              counterparty_name: `${currentPayload.counterparty_name || 'Fornecedor'} (Parc. ${upcoming.installment_number}/${totInst})`,
              type: isInc ? 'receivable' : 'payable',
              amount: Math.abs(Number(upcoming.amount)),
              original_due_date: upcoming.due_date,
              current_due_date: upcoming.due_date,
              status: 'open',
              barcode_or_pix: upcoming.barcode_or_pix || null,
              is_provision: true,
            });
          }
        } else {
          // Fallback para parcelamento padrão do resolveInstallmentsList
          const resolvedInstallments = resolveInstallmentsList(currentPayload);
          if (resolvedInstallments.length > 0) {
            for (const inst of resolvedInstallments) {
              await supabase.from('payables_receivables').insert({
                client_id: client.id,
                document_id: currentPayload.document_id || null,
                counterparty_name: `${currentPayload.counterparty_name || 'Fornecedor'} (Parc. ${inst.installment_number}/${resolvedInstallments.length})`,
                type: isInc ? 'receivable' : 'payable',
                amount: Math.abs(Number(inst.amount)),
                original_due_date: inst.due_date,
                current_due_date: inst.due_date,
                status: 'open',
                barcode_or_pix: inst.barcode_or_pix || null,
                is_provision: true,
              });
            }
          } else {
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
              status: 'open',
              barcode_or_pix: currentPayload.barcode_or_pix || null,
              is_provision: Boolean(currentPayload.is_provision),
            });
          }
        }
      }
    } else {
      // Trial Lead (Degustação gratuita)
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
        await supabase
          .from('clients')
          .update({ last_balance_prompt_at: nowBalanceCheck.toISOString() })
          .eq('id', client.id);
      }
    } else {
      const { data: lead } = await supabase
        .from('trial_leads')
        .select('last_balance_prompt_at')
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
        .limit(1)
        .maybeSingle();

      const lastPromptAt = lead?.last_balance_prompt_at ? new Date(lead.last_balance_prompt_at) : null;
      if (!lastPromptAt || nowBalanceCheck.getTime() - lastPromptAt.getTime() >= 24 * 60 * 60 * 1000) {
        shouldAskDailyBalance = true;
        await supabase
          .from('trial_leads')
          .update({ last_balance_prompt_at: nowBalanceCheck.toISOString() })
          .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`);
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

    if (currentPayload.barcode_or_pix) {
      await sendEvolutionText({
        phone,
        text: `📋 *Código de Pagamento / Linha Digitável:*\n\`${currentPayload.barcode_or_pix}\``,
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
