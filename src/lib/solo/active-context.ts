/**
 * Utilitário de Contexto Financeiro Ativo (AnalisAí)
 * Carrega dinamicamente o snapshot de contas abertas, atrasadas e vencendo hoje
 * tanto para clientes assinantes (payables_receivables) quanto para leads na degustação (trial_leads.bills_list).
 */

export interface ActiveFinancialAccountItem {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  client_name?: string;
  supplier?: string;
  type: 'payable' | 'receivable';
  is_overdue?: boolean;
  is_today?: boolean;
}

export interface ActiveFinancialSnapshot {
  overdueReceivables: Array<{ id: string; description: string; amount: number; due_date: string; client_name?: string }>;
  todayReceivables: Array<{ id: string; description: string; amount: number; due_date: string; client_name?: string }>;
  allOpenReceivables: Array<{ id: string; description: string; amount: number; due_date: string; client_name?: string }>;
  overduePayables: Array<{ id: string; description: string; amount: number; due_date: string; supplier?: string }>;
  todayPayables: Array<{ id: string; description: string; amount: number; due_date: string; supplier?: string }>;
  allOpenPayables: Array<{ id: string; description: string; amount: number; due_date: string; supplier?: string }>;
  totalOverdueAmount: number;
  totalPendingAmount: number;
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
  const todayStr = new Date().toISOString().split('T')[0];

  const emptySnapshot: ActiveFinancialSnapshot = {
    overdueReceivables: [],
    todayReceivables: [],
    allOpenReceivables: [],
    overduePayables: [],
    todayPayables: [],
    allOpenPayables: [],
    totalOverdueAmount: 0,
    totalPendingAmount: 0,
  };

  // 1. Cenário de Cliente Assinante
  if (clientId) {
    const { data: receivables } = await supabase
      .from('payables_receivables')
      .select('id, counterparty_name, description, amount, current_due_date, type, status')
      .eq('client_id', clientId)
      .eq('type', 'receivable')
      .in('status', ['pending', 'open', 'overdue', 'postponed'])
      .order('current_due_date', { ascending: true })
      .limit(30);

    const { data: payables } = await supabase
      .from('payables_receivables')
      .select('id, counterparty_name, description, amount, current_due_date, type, status')
      .eq('client_id', clientId)
      .eq('type', 'payable')
      .in('status', ['pending', 'open', 'overdue', 'postponed'])
      .order('current_due_date', { ascending: true })
      .limit(30);

    const recList = (receivables || []).map((r: any) => ({
      id: r.id,
      description: r.counterparty_name || r.description || 'Cliente',
      amount: Number(r.amount || 0),
      due_date: r.current_due_date || todayStr,
      client_name: r.counterparty_name || r.description || 'Cliente',
    }));

    const payList = (payables || []).map((p: any) => ({
      id: p.id,
      description: p.counterparty_name || p.description || 'Fornecedor',
      amount: Number(p.amount || 0),
      due_date: p.current_due_date || todayStr,
      supplier: p.counterparty_name || p.description || 'Fornecedor',
    }));

    const overdueReceivables = recList.filter((r: any) => r.due_date < todayStr);
    const todayReceivables = recList.filter((r: any) => r.due_date === todayStr);
    const overduePayables = payList.filter((p: any) => p.due_date < todayStr);
    const todayPayables = payList.filter((p: any) => p.due_date === todayStr);

    const totalOverdue = [...overdueReceivables, ...overduePayables].reduce((acc, i) => acc + i.amount, 0);
    const totalPending = [...recList, ...payList].reduce((acc, i) => acc + i.amount, 0);

    return {
      overdueReceivables,
      todayReceivables,
      allOpenReceivables: recList,
      overduePayables,
      todayPayables,
      allOpenPayables: payList,
      totalOverdueAmount: totalOverdue,
      totalPendingAmount: totalPending,
    };
  }

  // 2. Cenário de Lead na Degustação Gratuita (trial_leads)
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    let altPhone = cleanPhone;
    if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
      altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
      altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
    }

    const { data: lead } = await supabase
      .from('trial_leads')
      .select('id, bills_list')
      .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
      .maybeSingle();

    if (lead && Array.isArray(lead.bills_list)) {
      const openBills = lead.bills_list
        .map((b: any, index: number) => ({
          id: b.id || `trial_${index}`,
          description: b.supplier_name || b.counterparty_name || (b.entry_type === 'receivable' ? 'Cliente' : 'Fornecedor'),
          amount: Number(b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount || 0),
          due_date: b.due_date || b.current_due_date || todayStr,
          entry_type: (b.entry_type || 'payable') as 'payable' | 'receivable',
          is_paid: Boolean(b.is_paid || b.status === 'paid'),
          status: b.status || (b.is_paid ? 'paid' : 'open'),
        }))
        .filter((b: any) => !b.is_paid && b.status !== 'paid' && b.status !== 'canceled');

      const recList = openBills
        .filter((b: any) => b.entry_type === 'receivable')
        .map((b: any) => ({
          id: b.id,
          description: b.description,
          amount: b.amount,
          due_date: b.due_date,
          client_name: b.description,
        }));

      const payList = openBills
        .filter((b: any) => b.entry_type === 'payable')
        .map((b: any) => ({
          id: b.id,
          description: b.description,
          amount: b.amount,
          due_date: b.due_date,
          supplier: b.description,
        }));

      const overdueReceivables = recList.filter((r: any) => r.due_date < todayStr);
      const todayReceivables = recList.filter((r: any) => r.due_date === todayStr);
      const overduePayables = payList.filter((p: any) => p.due_date < todayStr);
      const todayPayables = payList.filter((p: any) => p.due_date === todayStr);

      const totalOverdue = [...overdueReceivables, ...overduePayables].reduce((acc, i) => acc + i.amount, 0);
      const totalPending = [...recList, ...payList].reduce((acc, i) => acc + i.amount, 0);

      return {
        overdueReceivables,
        todayReceivables,
        allOpenReceivables: recList,
        overduePayables,
        todayPayables,
        allOpenPayables: payList,
        totalOverdueAmount: totalOverdue,
        totalPendingAmount: totalPending,
      };
    }
  }

  return emptySnapshot;
}
