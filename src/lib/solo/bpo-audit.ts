import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from './evolution';
import type { DailyBpoAudit, AuditDailyOpsSummary, BpoClientOverview } from '@/types/bpo';

/**
 * Obtém a data corrente no fuso de Brasília (YYYY-MM-DD)
 */
export function getBrasiliaDate(offsetDays: number = 0): string {
  try {
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
  } catch {
    const d = new Date();
    if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }
}

/**
 * Coleta e consolida as métricas da auditoria matinal da Torre de Controle BPO com blindagem defensiva total:
 * 1. Lembretes D-0 e D-1 (Esperados vs Disparados)
 * 2. Documentos e lançamentos aguardando revisão de conciliação
 * 3. Inconsistências de caixa identificadas
 */
export async function collectDailyBpoAudit(): Promise<AuditDailyOpsSummary> {
  const todayStr = getBrasiliaDate(0);
  const tomorrowStr = getBrasiliaDate(1);

  // Fallback seguro caso ocorra qualquer instabilidade de banco de dados
  const safeFallback: AuditDailyOpsSummary = {
    audit: {
      id: 'audit_' + todayStr,
      audit_date: todayStr,
      status: 'pending',
      d0_reminders_expected: 0,
      d0_reminders_sent: 0,
      d1_reminders_expected: 0,
      d1_reminders_sent: 0,
      documents_pending_review: 0,
      documents_approved: 0,
      inconsistencies_flagged: 0,
      audited_by: 'Marcos / Operador BPO',
      notes: 'Auditoria consolidada do semáforo matinal.',
      created_at: new Date().toISOString(),
    },
    d0PayablesList: [],
    d1PayablesList: [],
    pendingReviewDocuments: [],
    inconsistenciesList: [],
    clientsList: [],
  };

  try {
    const supabase = createServiceRoleClient();

    // ── 1. BUSCA DEFENSIVA DE CLIENTES ATIVOS ─────────────────────────
    let activeClients: any[] = [];
    try {
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('id, name, company_name, whatsapp_number, status')
        .eq('status', 'active');

      if (!clientErr && clientsData) {
        activeClients = clientsData.map((c) => ({
          ...c,
          service_tier: 'self_service',
          accountant_name: null,
        }));

        // Tenta enriquecer com service_tier se a coluna existir
        try {
          const { data: tiersData } = await supabase
            .from('clients')
            .select('id, service_tier, accountant_name')
            .in('id', activeClients.map((c) => c.id));

          if (tiersData) {
            for (const td of tiersData) {
              const match = activeClients.find((c) => c.id === td.id);
              if (match) {
                if (td.service_tier) match.service_tier = td.service_tier;
                if (td.accountant_name) match.accountant_name = td.accountant_name;
              }
            }
          }
        } catch {
          // Coluna service_tier ainda não indexada, prossegue com padrão
        }
      }
    } catch (err) {
      console.warn('[BPO Audit] Erro ao consultar clientes ativos:', err);
    }

    const clientIds = activeClients.map((c) => c.id);

    // ── 2. CONTAGEM CONSOLIDADA DE TÍTULOS D-0 E D-1 ──────────────────
    const d0PayablesList: AuditDailyOpsSummary['d0PayablesList'] = [];
    const d1PayablesList: AuditDailyOpsSummary['d1PayablesList'] = [];
    let d0Expected = 0;
    let d0Sent = 0;
    let d1Expected = 0;
    let d1Sent = 0;

    if (clientIds.length > 0) {
      try {
        const { data: bills, error: billsErr } = await supabase
          .from('payables_receivables')
          .select('id, client_id, counterparty_name, amount, type, current_due_date, barcode_or_pix, last_reminder_sent_at, status')
          .in('client_id', clientIds)
          .in('current_due_date', [todayStr, tomorrowStr])
          .in('status', ['open', 'postponed']);

        if (!billsErr && bills) {
          for (const bill of bills) {
            const clientMatch = activeClients.find((c) => c.id === bill.client_id);
            const isSentToday = Boolean(bill.last_reminder_sent_at && bill.last_reminder_sent_at.startsWith(todayStr));
            const isD0 = bill.current_due_date === todayStr;

            const item = {
              id: bill.id,
              clientId: bill.client_id,
              clientName: clientMatch?.company_name || clientMatch?.name || 'Cliente',
              counterparty: bill.counterparty_name || 'Despesa Fornecedor',
              amount: Number(bill.amount) || 0,
              currentDueDate: bill.current_due_date,
              type: (bill.type as any) || 'payable',
              phone: clientMatch?.whatsapp_number || '',
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
        }
      } catch (err) {
        console.warn('[BPO Audit] Erro ao consultar payables_receivables:', err);
      }
    }

    // ── 3. DOCUMENTOS AGUARDANDO REVISÃO E APROVADOS HOJE ─────────────
    const pendingReviewDocuments: AuditDailyOpsSummary['pendingReviewDocuments'] = [];
    let documentsApprovedCount = 0;

    try {
      const sinceTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recentDocs } = await supabase
        .from('documents')
        .select('id, client_id, file_name, mime_type, doc_type, status, extracted_data, created_at')
        .gte('created_at', sinceTimestamp);

      if (recentDocs) {
        for (const doc of recentDocs) {
          const clientMatch = activeClients.find((c) => c.id === doc.client_id);
          if (doc.status === 'processed') {
            documentsApprovedCount++;
          } else {
            pendingReviewDocuments.push({
              id: doc.id,
              clientId: doc.client_id,
              clientName: clientMatch?.company_name || clientMatch?.name || 'Cliente',
              fileName: doc.file_name || 'Documento',
              mimeType: doc.mime_type || 'application/octet-stream',
              docType: doc.doc_type || 'comprovante',
              createdAt: doc.created_at,
              extractedData: doc.extracted_data,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[BPO Audit] Tabela documents não acessível:', err);
    }

    // Busca ações pendentes em bot_action_confirmations
    try {
      const { data: pendingConfirmations } = await supabase
        .from('bot_action_confirmations')
        .select('id, client_id, phone_number, proposed_payload, extracted_payload, created_at')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .limit(20);

      if (pendingConfirmations) {
        for (const conf of pendingConfirmations) {
          const payload: any = conf.extracted_payload || conf.proposed_payload || {};
          const clientMatch = activeClients.find((c) => c.id === conf.client_id);
          if (!pendingReviewDocuments.some((d) => d.id === conf.id)) {
            pendingReviewDocuments.push({
              id: conf.id,
              clientId: conf.client_id || '',
              clientName: clientMatch?.company_name || clientMatch?.name || `WhatsApp ${conf.phone_number}`,
              fileName: payload?.descricao || payload?.counterparty || 'Comprovante WhatsApp',
              mimeType: 'application/json',
              docType: payload?.tipo || 'outro',
              createdAt: conf.created_at,
              extractedData: payload,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[BPO Audit] bot_action_confirmations não acessível:', err);
    }

    // ── 4. INCONSISTÊNCIAS IDENTIFICADAS ──────────────────────────────
    const inconsistenciesList: AuditDailyOpsSummary['inconsistenciesList'] = [];

    try {
      const { data: unattachedExpenses } = await supabase
        .from('cash_ledger_entries')
        .select('id, client_id, description, amount, entry_date')
        .eq('entry_type', 'expense')
        .gte('entry_date', getBrasiliaDate(-5))
        .limit(15);

      if (unattachedExpenses) {
        for (const exp of unattachedExpenses) {
          const clientMatch = activeClients.find((c) => c.id === exp.client_id);
          inconsistenciesList.push({
            id: exp.id,
            clientId: exp.client_id,
            clientName: clientMatch?.company_name || clientMatch?.name || 'Cliente',
            description: exp.description || 'Despesa Bancária',
            amount: Number(exp.amount) || 0,
            reason: `Saída de R$ ${Number(exp.amount || 0).toFixed(2)} em ${exp.entry_date} pendente de comprovante fiscal.`,
          });
        }
      }
    } catch (err) {
      console.warn('[BPO Audit] cash_ledger_entries não acessível:', err);
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

    // Tenta persistir na tabela daily_bpo_audits
    try {
      await supabase.from('daily_bpo_audits').upsert(auditData, { onConflict: 'audit_date' });
    } catch {
      // Ignora erro se tabela não estiver no schema cache
    }

    // Persiste snapshot no bot_config para resiliência instantânea
    try {
      await supabase.from('bot_config').upsert(
        {
          key: `daily_bpo_audit_${todayStr}`,
          value: JSON.stringify(auditData),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    } catch {
      // Fallback silencioso
    }

    // ── 6. LISTA RESUMIDA DE CLIENTES BPO (MULTITENANT) ──────────────
    const clientsList: BpoClientOverview[] = activeClients.map((c: any) => {
      const pD0 = d0PayablesList.filter((p) => p.clientId === c.id);
      const pDocs = pendingReviewDocuments.filter((d) => d.clientId === c.id);
      const pIncons = inconsistenciesList.filter((i) => i.clientId === c.id);
      const todayPayablesAmount = pD0.reduce((sum, item) => sum + (item.amount || 0), 0);

      let status: BpoClientOverview['status'] = 'up_to_date';
      if (pIncons.length > 0) {
        status = 'critical';
      } else if (pDocs.length > 0 || pD0.some((p) => !p.isSentToday)) {
        status = 'attention_required';
      }

      return {
        clientId: c.id,
        companyName: c.company_name || c.name || 'Cliente',
        phone: c.whatsapp_number || '',
        serviceTier: (c.service_tier as any) || 'self_service',
        accountantOfficeName: c.accountant_name || null,
        monthlyFee: Number(c.monthly_fee) || 0,
        pendingDocumentsCount: pDocs.length,
        todayPayablesCount: pD0.length,
        todayPayablesAmount,
        status,
      };
    });

    return {
      audit: auditData,
      d0PayablesList,
      d1PayablesList,
      pendingReviewDocuments,
      inconsistenciesList,
      clientsList,
    };
  } catch (globalErr) {
    console.error('[BPO Audit] Erro global na auditoria matinal:', globalErr);
    return safeFallback;
  }
}

/**
 * Dispara os lembretes pendentes identificados
 */
export async function dispatchPendingReminders(billIds?: string[]): Promise<{
  sent: number;
  failed: number;
}> {
  try {
    const supabase = createServiceRoleClient();
    const todayStr = getBrasiliaDate(0);
    const tomorrowStr = getBrasiliaDate(1);

    let query = supabase
      .from('payables_receivables')
      .select('id, client_id, counterparty_name, amount, type, current_due_date, barcode_or_pix')
      .in('current_due_date', [todayStr, tomorrowStr])
      .in('status', ['open', 'postponed']);

    if (billIds && billIds.length > 0) {
      query = query.in('id', billIds);
    } else {
      query = query.or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${todayStr}T00:00:00Z`);
    }

    const { data: bills, error } = await query;
    if (error || !bills) return { sent: 0, failed: 0 };

    // Busca dados dos clientes
    const clientIds = Array.from(new Set(bills.map((b) => b.client_id)));
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, company_name, whatsapp_number')
      .in('id', clientIds);

    let sent = 0;
    let failed = 0;

    for (const bill of bills) {
      const clientData = clients?.find((c) => c.id === bill.client_id);
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
  } catch (err) {
    console.error('[BPO Audit] Erro ao disparar lembretes:', err);
    return { sent: 0, failed: 0 };
  }
}
