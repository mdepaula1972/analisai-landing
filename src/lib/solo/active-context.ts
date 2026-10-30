/**
 * Utilitário de Contexto Financeiro Ativo (AnalisAí)
 * Carrega dinamicamente o snapshot de contas abertas, atrasadas e vencendo hoje
 * tanto para clientes assinantes (payables_receivables e cash_ledger_entries pendentes)
 * quanto para leads na degustação (trial_leads.bills_list).
 */

export interface ActiveFinancialAccountItem {
  id: string;
  code?: string;
  formatted_code?: string;
  description: string;
  amount: number;
  due_date: string;
  formatted_date: string;
  day_of_month: number | null;
  status: string;
  client_name?: string;
  supplier?: string;
  type: 'payable' | 'receivable';
  is_overdue: boolean;
  is_today: boolean;
  is_recurring?: boolean;
  source?: 'payables_receivables' | 'cash_ledger' | 'trial_leads';
}

export interface ActiveFinancialSnapshot {
  overdueReceivables: ActiveFinancialAccountItem[];
  todayReceivables: ActiveFinancialAccountItem[];
  allOpenReceivables: ActiveFinancialAccountItem[];
  overduePayables: ActiveFinancialAccountItem[];
  todayPayables: ActiveFinancialAccountItem[];
  allOpenPayables: ActiveFinancialAccountItem[];
  totalOverdueAmount: number;
  totalPendingAmount: number;
}

/**
 * Normaliza uma data arbitrária (YYYY-MM-DD ou DD/MM/YYYY) e extrai o dia do mês isolado
 * para facilitar o match determinístico e da LLM (ex: day_of_month: 25).
 */
export function parseSnapshotDateDetails(
  rawDate: string | null | undefined,
  fallbackTodayYMD: string,
  recurrenceDay?: number | null
): {
  dueDateYMD: string;
  formattedDate: string;
  dayOfMonth: number | null;
} {
  let clean = (rawDate || '').trim();
  if (clean.includes('T')) {
    clean = clean.split('T')[0];
  }

  let ymd = fallbackTodayYMD;
  let dayOfMonth: number | null =
    recurrenceDay && !isNaN(Number(recurrenceDay)) ? Number(recurrenceDay) : null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    ymd = clean;
    const parts = clean.split('-');
    const parsedDay = parseInt(parts[2], 10);
    if (!isNaN(parsedDay)) dayOfMonth = parsedDay;
  } else if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(clean)) {
    const parts = clean.split('/');
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let y = parts[2] ? parseInt(parts[2], 10) : parseInt(fallbackTodayYMD.split('-')[0], 10);
    if (y < 100) y += 2000;
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dayOfMonth = d;
    }
  } else if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31) {
    const [curY, curM] = fallbackTodayYMD.split('-');
    ymd = `${curY}-${curM}-${String(dayOfMonth).padStart(2, '0')}`;
  }

  const [yStr, mStr, dStr] = ymd.split('-');
  const formattedDate = dStr && mStr && yStr ? `${dStr}/${mStr}/${yStr}` : ymd;
  if (dayOfMonth === null && dStr) {
    const parsed = parseInt(dStr, 10);
    if (!isNaN(parsed)) dayOfMonth = parsed;
  }

  return {
    dueDateYMD: ymd,
    formattedDate,
    dayOfMonth,
  };
}

/**
 * Busca as contas ativas e pendências do cliente ou lead no Supabase.
 * Previne alucinações da IA injetando a verdade financeira em tempo real antes de qualquer decisão do Gemini.
 */
export async function getClientActiveFinancialSnapshot(
  supabase: any,
  clientId: string | null | undefined,
  phone?: string
): Promise<ActiveFinancialSnapshot> {
  // Obtém a data de hoje no fuso de Brasília (America/Sao_Paulo) no formato YYYY-MM-DD
  const brDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = brDateFormatter.format(new Date());
  const currentDayOfMonth = parseInt(todayStr.split('-')[2], 10);

  const cleanPhone = (phone || '').replace(/\D/g, '');
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  let resolvedClientId = clientId || null;
  if (!resolvedClientId && cleanPhone) {
    try {
      const { data: foundClient } = await supabase
        .from('clients')
        .select('id')
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
        .limit(1)
        .maybeSingle();
      if (foundClient?.id) {
        resolvedClientId = foundClient.id;
      }
    } catch {
      // Fallback silencioso
    }
  }

  const allReceivables: ActiveFinancialAccountItem[] = [];
  const allPayables: ActiveFinancialAccountItem[] = [];

  const addAccountIfUnique = (item: ActiveFinancialAccountItem) => {
    const targetList = item.type === 'receivable' ? allReceivables : allPayables;
    const normDesc = item.description.toLowerCase().trim();
    const alreadyExists = targetList.some((existing) => {
      if (existing.id === item.id) return true;
      const existDesc = existing.description.toLowerCase().trim();
      const sameName =
        existDesc.length >= 3 &&
        normDesc.length >= 3 &&
        (existDesc === normDesc || existDesc.includes(normDesc) || normDesc.includes(existDesc));
      const sameAmount = Math.abs(existing.amount - item.amount) < 0.05;
      const sameDay =
        existing.due_date === item.due_date ||
        (existing.day_of_month !== null && existing.day_of_month === item.day_of_month);
      return sameName && sameAmount && sameDay;
    });

    if (!alreadyExists) {
      targetList.push(item);
    }
  };

  // 1. Busca em payables_receivables (status IN ('pending', 'open', 'overdue', 'postponed', 'atrasado'))
  if (resolvedClientId) {
    try {
      const { data: prRows } = await supabase
        .from('payables_receivables')
        .select('*')
        .eq('client_id', resolvedClientId)
        .in('status', ['pending', 'open', 'overdue', 'postponed', 'atrasado'])
        .order('current_due_date', { ascending: true })
        .limit(60);

      for (const r of prRows || []) {
        const rawDue = r.current_due_date || r.original_due_date || r.due_date || todayStr;
        const { dueDateYMD, formattedDate, dayOfMonth } = parseSnapshotDateDetails(
          rawDue,
          todayStr,
          r.recurrence_day
        );
        const type: 'payable' | 'receivable' = r.type === 'receivable' ? 'receivable' : 'payable';
        const desc = (
          r.counterparty_name ||
          r.description ||
          r.notes ||
          (type === 'receivable' ? 'Cliente' : 'Fornecedor')
        ).trim();
        const statusStr = String(r.status || 'open').toLowerCase();
        const isRecurring = Boolean(r.is_recurring);
        const isOverdue =
          dueDateYMD < todayStr ||
          statusStr === 'overdue' ||
          statusStr === 'atrasado' ||
          (isRecurring && dayOfMonth !== null && dayOfMonth < currentDayOfMonth);
        const isToday = dueDateYMD === todayStr || (isRecurring && dayOfMonth === currentDayOfMonth);

        const notesMatch = String(r.notes || '').match(/\[#?(\d{1,4})\]/);
        const explicitCode = notesMatch ? String(parseInt(notesMatch[1], 10)).padStart(3, '0') : undefined;

        addAccountIfUnique({
          id: r.id,
          code: explicitCode,
          description: desc,
          amount: Number(r.amount || 0),
          due_date: dueDateYMD,
          formatted_date: formattedDate,
          day_of_month: dayOfMonth,
          status: isOverdue && statusStr === 'open' ? 'overdue' : statusStr,
          type,
          is_overdue: isOverdue,
          is_today: isToday,
          is_recurring: isRecurring,
          client_name: type === 'receivable' ? desc : undefined,
          supplier: type === 'payable' ? desc : undefined,
          source: 'payables_receivables',
        });
      }
    } catch (prErr) {
      console.warn('[getClientActiveFinancialSnapshot] Erro ao consultar payables_receivables:', prErr);
    }

    // 1.1 Busca lançamentos pendentes/previstos no Livro Caixa (cash_ledger_entries) vinculados ao cliente
    try {
      const { data: ledgerRows } = await supabase
        .from('cash_ledger_entries')
        .select('*')
        .eq('client_id', resolvedClientId)
        .in('status', ['previsto', 'pending', 'open', 'overdue', 'postponed'])
        .order('entry_date', { ascending: true })
        .limit(50);

      for (const l of ledgerRows || []) {
        const rawDue = l.entry_date || todayStr;
        const { dueDateYMD, formattedDate, dayOfMonth } = parseSnapshotDateDetails(rawDue, todayStr);
        const isInc =
          l.entry_type === 'income' ||
          l.entry_type === 'INFLOW' ||
          l.entry_type === 'receivable' ||
          Number(l.amount) > 0;
        const type: 'payable' | 'receivable' = isInc ? 'receivable' : 'payable';
        const desc = String(l.description || (isInc ? 'Cliente' : 'Fornecedor'))
          .replace(/^(RECEITA|DESPESA)\s*-\s*/i, '')
          .trim();
        const statusStr = String(l.status || 'pending').toLowerCase();
        const isOverdue = dueDateYMD < todayStr || statusStr === 'overdue';
        const isToday = dueDateYMD === todayStr;

        addAccountIfUnique({
          id: `ledger_${l.id}`,
          description: desc,
          amount: Math.abs(Number(l.amount || 0)),
          due_date: dueDateYMD,
          formatted_date: formattedDate,
          day_of_month: dayOfMonth,
          status: isOverdue ? 'overdue' : statusStr,
          type,
          is_overdue: isOverdue,
          is_today: isToday,
          client_name: type === 'receivable' ? desc : undefined,
          supplier: type === 'payable' ? desc : undefined,
          source: 'cash_ledger',
        });
      }
    } catch (ledgerErr) {
      console.warn('[getClientActiveFinancialSnapshot] Erro ao consultar cash_ledger_entries:', ledgerErr);
    }
  }

  // 2. Busca e mescla SEMPRE de trial_leads (mesmo que tenha clientId, pois leads em teste/transição ou admin têm bills_list aqui)
  if (cleanPhone) {
    try {
      const { data: lead } = await supabase
        .from('trial_leads')
        .select('id, bills_list, supplier_name, amount, due_date, category, doc_data')
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
        .maybeSingle();

      if (lead && Array.isArray(lead.bills_list) && lead.bills_list.length > 0) {
        lead.bills_list.forEach((b: any, index: number) => {
          const statusStr = String(b.status || (b.is_paid ? 'paid' : 'open')).toLowerCase();
          const isPaidOrCanceled =
            Boolean(b.is_paid) ||
            Boolean(b.reconciled_at && statusStr === 'paid') ||
            ['paid', 'canceled', 'cancelled', 'liquidado', 'realizado'].includes(statusStr);

          if (isPaidOrCanceled) return;

          const type: 'payable' | 'receivable' =
            b.entry_type === 'receivable' || b.type === 'receivable' ? 'receivable' : 'payable';
          const desc = (
            b.supplier_name ||
            b.counterparty_name ||
            b.description ||
            (type === 'receivable' ? 'Cliente' : 'Fornecedor')
          ).trim();
          const rawAmount = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount || 0;
          const rawDue = b.due_date || b.current_due_date || todayStr;
          const { dueDateYMD, formattedDate, dayOfMonth } = parseSnapshotDateDetails(
            rawDue,
            todayStr,
            b.recurrence_day
          );
          const isRecurring = Boolean(b.is_recurring || b.recurrence_day);
          const isOverdue =
            dueDateYMD < todayStr ||
            statusStr === 'overdue' ||
            statusStr === 'atrasado' ||
            statusStr === 'pending_past_confirmation' ||
            Boolean(b.is_past) ||
            (isRecurring && dayOfMonth !== null && dayOfMonth < currentDayOfMonth);
          const isToday = dueDateYMD === todayStr || (isRecurring && dayOfMonth === currentDayOfMonth);

          addAccountIfUnique({
            id: b.id || `trial_${index}`,
            code: b.code || String(index + 1).padStart(3, '0'),
            description: desc,
            amount: Number(rawAmount || 0),
            due_date: dueDateYMD,
            formatted_date: formattedDate,
            day_of_month: dayOfMonth,
            status: isOverdue && statusStr === 'open' ? 'overdue' : statusStr,
            type,
            is_overdue: isOverdue,
            is_today: isToday,
            is_recurring: isRecurring,
            client_name: type === 'receivable' ? desc : undefined,
            supplier: type === 'payable' ? desc : undefined,
            source: 'trial_leads',
          });
        });
      } else if (lead && (lead.amount || lead.doc_data?.total_amount)) {
        const rawAmt = lead.amount !== undefined && lead.amount !== null ? lead.amount : lead.doc_data?.total_amount;
        const desc = (lead.supplier_name || lead.doc_data?.counterparty_name || 'Fornecedor').trim();
        const rawDue = lead.due_date || lead.doc_data?.due_date || todayStr;
        const { dueDateYMD, formattedDate, dayOfMonth } = parseSnapshotDateDetails(rawDue, todayStr);
        const isOverdue = dueDateYMD < todayStr;
        const isToday = dueDateYMD === todayStr;

        addAccountIfUnique({
          id: 'trial_0',
          description: desc,
          amount: Number(rawAmt || 0),
          due_date: dueDateYMD,
          formatted_date: formattedDate,
          day_of_month: dayOfMonth,
          status: isOverdue ? 'overdue' : 'open',
          type: 'payable',
          is_overdue: isOverdue,
          is_today: isToday,
          supplier: desc,
          source: 'trial_leads',
        });
      }
    } catch (leadErr) {
      console.warn('[getClientActiveFinancialSnapshot] Erro ao consultar trial_leads:', leadErr);
    }
  }

  // Ordena cronologicamente por due_date ASC
  const sortByDueDateAsc = (a: ActiveFinancialAccountItem, b: ActiveFinancialAccountItem) => {
    const timeA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    const timeB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;
    return (b.amount || 0) - (a.amount || 0);
  };

  allPayables.sort(sortByDueDateAsc);
  allReceivables.sort(sortByDueDateAsc);

  // Atribuição determinística e sequencial de código simplificado (#01, #02, ...)
  let runningCode = 1;
  const assignCodeIfMissing = (item: ActiveFinancialAccountItem) => {
    item.code = String(runningCode++).padStart(2, '0');
    item.formatted_code = `*[#${item.code}]*`;
  };

  allPayables.forEach(assignCodeIfMissing);
  allReceivables.forEach(assignCodeIfMissing);

  const overdueReceivables = allReceivables.filter((r) => r.is_overdue);
  const todayReceivables = allReceivables.filter((r) => r.is_today);
  const overduePayables = allPayables.filter((p) => p.is_overdue);
  const todayPayables = allPayables.filter((p) => p.is_today);

  const totalOverdue = [...overdueReceivables, ...overduePayables].reduce((acc, i) => acc + i.amount, 0);
  const totalPending = [...allReceivables, ...allPayables].reduce((acc, i) => acc + i.amount, 0);

  return {
    overdueReceivables,
    todayReceivables,
    allOpenReceivables: allReceivables,
    overduePayables,
    todayPayables,
    allOpenPayables: allPayables,
    totalOverdueAmount: totalOverdue,
    totalPendingAmount: totalPending,
  };
}
