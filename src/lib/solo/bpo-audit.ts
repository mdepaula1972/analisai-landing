import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from './evolution';
import type { DailyBpoAudit, AuditDailyOpsSummary, BpoClientOverview } from '@/types/bpo';

/**
 * Obtém a data corrente no fuso de Brasília (YYYY-MM-DD)
 */
export function getBrasiliaDate(offsetDays: number = 0): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateObj = new Date();
  if (offsetDays !== 0) {
    dateObj.setDate(dateObj.getDate() + offsetDays);
  }
  const [day, month, year] = formatter.format(dateObj).split('/');
  return `${year}-${month}-${day}`;
}

/**
 * Coleta e consolida as métricas da auditoria matinal da Torre de Controle BPO:
 * 1. Lembretes D-0 e D-1 (Esperados vs Disparados)
 * 2. Documentos e lançamentos aguardando revisão de conciliação
 * 3. Inconsistências de caixa identificadas
 */
export async function collectDailyBpoAudit(): Promise<AuditDailyOpsSummary> {
  const supabase = createServiceRoleClient();
  const todayStr = getBrasiliaDate(0);
  const tomorrowStr = getBrasiliaDate(1);

  // ── 1. BUSCA DE CLIENTES ATIVOS ──────────────────────────────────
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, company_name, whatsapp_number, status, service_tier, accountant_name')
    .eq('status', 'active');

  const activeClients = clients || [];
  const clientIds = activeClients.map((c) => c.id);

  // ── 2. CONTAGEM CONSOLIDADA DE TÍTULOS D-0 (HOJE) E D-1 (AMANHÃ) ──
  const { data: bills } = await supabase
    .from('payables_receivables')
    .select(`
      id,
      client_id,
      counterparty_name,
      amount,
      type,
      current_due_date,
      barcode_or_pix,
      last_reminder_sent_at,
      status,
      clients (
        id,
        name,
        company_name,
        whatsapp_number
      )
    `)
    .in('client_id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])
    .in('current_due_date', [todayStr, tomorrowStr])
    .in('status', ['open', 'postponed']);

  const allDueBills = bills || [];

  const d0PayablesList: AuditDailyOpsSummary['d0PayablesList'] = [];
  const d1PayablesList: AuditDailyOpsSummary['d1PayablesList'] = [];

  let d0Expected = 0;
  let d0Sent = 0;
  let d1Expected = 0;
  let d1Sent = 0;

  for (const bill of allDueBills) {
    const clientData: any = Array.isArray(bill.clients) ? bill.clients[0] : bill.clients;
    const isSentToday = Boolean(bill.last_reminder_sent_at && bill.last_reminder_sent_at.startsWith(todayStr));
    const isD0 = bill.current_due_date === todayStr;

    const item = {
      id: bill.id,
      clientId: bill.client_id,
      clientName: clientData?.company_name || clientData?.name || 'Cliente',
      counterparty: bill.counterparty_name,
      amount: Number(bill.amount) || 0,
      currentDueDate: bill.current_due_date,
      type: bill.type as any,
      phone: clientData?.whatsapp_number || '',
      isSentToday,
    };

    if (isD0) {
      d0Expected++;
      if (isSentToday) d0Sent++;
      d0PayablesList.push(item);
    } else {
      d1Expected++;
      if (isSentToday) d1Sent++;
      d1PayablesList.push(item);
    }
  }

  // ── 3. DOCUMENTOS AGUARDANDO REVISÃO E APROVADOS HOJE ─────────────
  const pendingReviewDocuments: AuditDailyOpsSummary['pendingReviewDocuments'] = [];
  let documentsApprovedCount = 0;

  // Busca documentos no storage/documents
  const sinceTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentDocs } = await supabase
    .from('documents')
    .select('id, client_id, file_name, mime_type, doc_type, status, extracted_data, created_at, clients(name, company_name)')
    .gte('created_at', sinceTimestamp);

  for (const doc of recentDocs || []) {
    const clientData: any = Array.isArray(doc.clients) ? doc.clients[0] : doc.clients;
    if (doc.status === 'processed') {
      documentsApprovedCount++;
    } else {
      pendingReviewDocuments.push({
        id: doc.id,
        clientId: doc.client_id,
        clientName: clientData?.company_name || clientData?.name || 'Cliente',
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        docType: doc.doc_type,
        createdAt: doc.created_at,
        extractedData: doc.extracted_data,
      });
    }
  }

  // Busca ações pendentes em bot_action_confirmations
  const { data: pendingConfirmations } = await supabase
    .from('bot_action_confirmations')
    .select('id, client_id, phone_number, proposed_payload, extracted_payload, created_at, clients(name, company_name)')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .limit(20);

  for (const conf of pendingConfirmations || []) {
    const payload: any = conf.extracted_payload || conf.proposed_payload || {};
    const clientData: any = Array.isArray(conf.clients) ? conf.clients[0] : conf.clients;
    if (!pendingReviewDocuments.some((d) => d.id === conf.id)) {
      pendingReviewDocuments.push({
        id: conf.id,
        clientId: conf.client_id || '',
        clientName: clientData?.company_name || clientData?.name || `WhatsApp ${conf.phone_number}`,
        fileName: payload?.descricao || payload?.counterparty || 'Comprovante WhatsApp',
        mimeType: 'application/json',
        docType: payload?.tipo || 'outro',
        createdAt: conf.created_at,
        extractedData: payload,
      });
    }
  }

  // ── 4. INCONSISTÊNCIAS IDENTIFICADAS (SEM COMPROVANTE / CAIXA) ─────
  const inconsistenciesList: AuditDailyOpsSummary['inconsistenciesList'] = [];

  const { data: unattachedExpenses } = await supabase
    .from('cash_ledger_entries')
    .select('id, client_id, description, amount, entry_date, clients(name, company_name)')
    .eq('entry_type', 'expense')
    .is('document_id', null)
    .gte('entry_date', getBrasiliaDate(-5))
    .limit(15);

  for (const exp of unattachedExpenses || []) {
    const clientData: any = Array.isArray(exp.clients) ? exp.clients[0] : exp.clients;
    inconsistenciesList.push({
      id: exp.id,
      clientId: exp.client_id,
      clientName: clientData?.company_name || clientData?.name || 'Cliente',
      description: exp.description,
      amount: Number(exp.amount),
      reason: `Saída de R$ ${Number(exp.amount).toFixed(2)} em ${exp.entry_date} pendente de comprovante fiscal.`,
    });
  }

  // ── 5. OBJETO CONSOLIDADO DAILY_BPO_AUDIT ─────────────────────────
  const auditData: DailyBpoAudit = {
    id: 'audit_' + todayStr,
    audit_date: todayStr,
    status: (d0Expected === d0Sent && pendingReviewDocuments.length === 0) ? 'completed' : 'pending',
    d0_reminders_expected: d0Expected,
    d0_reminders_sent: d0Sent,
    d1_reminders_expected: d1Expected,
    d1_reminders_sent: d1Sent,
    documents_pending_review: pendingReviewDocuments.length,
    documents_approved: documentsApprovedCount,
    inconsistencies_flagged: inconsistenciesList.length,
    audited_by: 'Marcos / Operador BPO',
    notes: 'Auditoria consolidada do semáforo matinal.',
    created_at: new Date().toISOString(),
  };

  // Tenta persistir na tabela daily_bpo_audits se existir
  try {
    await supabase.from('daily_bpo_audits').upsert(auditData, { onConflict: 'audit_date' });
  } catch (err) {
    // Ignorado se tabela não estiver no schema cache
  }

  // Persiste snapshot no bot_config para resiliência instantânea
  await supabase.from('bot_config').upsert(
    {
      key: `daily_bpo_audit_${todayStr}`,
      value: JSON.stringify(auditData),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  return {
    audit: auditData,
    d0PayablesList,
    d1PayablesList,
    pendingReviewDocuments,
    inconsistenciesList,
  };
}

/**
 * Dispara os lembretes pendentes identificados
 */
export async function dispatchPendingReminders(billIds?: string[]): Promise<{
  sent: number;
  failed: number;
}> {
  const supabase = createServiceRoleClient();
  const todayStr = getBrasiliaDate(0);
  const tomorrowStr = getBrasiliaDate(1);

  let query = supabase
    .from('payables_receivables')
    .select(`
      id,
      client_id,
      counterparty_name,
      amount,
      type,
      current_due_date,
      barcode_or_pix,
      clients (
        name,
        company_name,
        whatsapp_number
      )
    `)
    .in('current_due_date', [todayStr, tomorrowStr])
    .in('status', ['open', 'postponed']);

  if (billIds && billIds.length > 0) {
    query = query.in('id', billIds);
  } else {
    query = query.or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${todayStr}T00:00:00Z`);
  }

  const { data: bills, error } = await query;
  if (error || !bills) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const bill of bills) {
    const clientData: any = Array.isArray(bill.clients) ? bill.clients[0] : bill.clients;
    const phone = clientData?.whatsapp_number;
    if (!phone) {
      failed++;
      continue;
    }

    const isToday = bill.current_due_date === todayStr;
    const tagVenc = isToday ? '🔴 VENCE HOJE' : '🟡 VENCE AMANHÃ';
    const amountFmt = Number(bill.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let msg = `🔔 *Torre de Controle AnalisAí — Lembrete de Pagamento*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Empresa: *${clientData?.company_name || clientData?.name}*\n`;
    msg += `${tagVenc}: *${bill.counterparty_name}*\n`;
    msg += `Valor: *${amountFmt}*\n\n`;

    if (bill.barcode_or_pix && bill.type === 'payable') {
      msg += `👇 *Copie o código ou chave Pix abaixo em 1 toque:*\n\n`;
      msg += `\`${bill.barcode_or_pix}\`\n\n`;
    }

    msg += `Assim que efetuar o pagamento, basta enviar o comprovante aqui para registrarmos a baixa no seu Livro Caixa! 📊`;

    try {
      await sendEvolutionText({ phone, text: msg });
      await supabase
        .from('payables_receivables')
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq('id', bill.id);
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}
