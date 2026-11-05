import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { getOrCreateAdminWebToken } from '@/lib/solo/admin-metrics';
import { getBrasiliaDate } from '@/lib/solo/bpo-audit';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { isMasterPhone } from '@/lib/solo/master-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function validateAdminAccess(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const searchParams = req.nextUrl.searchParams;
  const token = searchParams.get('token') || searchParams.get('key') || searchParams.get('phone') || req.headers.get('x-admin-token');
  const rawBearer = authHeader.replace(/^Bearer\s+/i, '');

  // Master Access Bypass para o telefone pessoal do Marcos (14-930855878)
  if (isMasterPhone(token) || isMasterPhone(rawBearer) || isMasterPhone(searchParams.get('phone'))) {
    return true;
  }

  if (cronSecret && (authHeader === `Bearer ${cronSecret}` || token === cronSecret)) {
    return true;
  }

  try {
    const adminToken = await getOrCreateAdminWebToken();
    if (token && token.trim() === adminToken.trim()) {
      return true;
    }
  } catch (err) {
    console.warn('[BPO Actions] Aviso ao verificar token administrativo:', err);
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const isAuthorized = await validateAdminAccess(req);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Não autorizado. Chave de acesso administrativo necessária.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const supabase = createServiceRoleClient();
    const todayStr = getBrasiliaDate(0);

    // ── 1. CONCLUIR AUDITORIA DO DIA ─────────────────────────────────
    if (action === 'completeDailyAudit') {
      const auditedBy = body.auditedBy || 'Marcos / Operador BPO';
      const notes = body.notes || 'Auditoria matinal aprovada e finalizada pelo gestor.';
      const nowIso = new Date().toISOString();

      // Atualiza na tabela daily_bpo_audits
      try {
        await supabase
          .from('daily_bpo_audits')
          .update({
            status: 'completed',
            completed_at: nowIso,
            audited_by: auditedBy,
            notes,
          })
          .eq('audit_date', todayStr);
      } catch (err) {
        console.warn('[BPO Actions] Aviso ao atualizar daily_bpo_audits:', err);
      }

      // Persiste no bot_config
      const { data: configRow } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', `daily_bpo_audit_${todayStr}`)
        .maybeSingle();

      const currentAudit = configRow?.value ? JSON.parse(configRow.value) : { audit_date: todayStr };
      const updatedAudit = {
        ...currentAudit,
        status: 'completed',
        completed_at: nowIso,
        audited_by: auditedBy,
        notes,
      };

      await supabase.from('bot_config').upsert({
        key: `daily_bpo_audit_${todayStr}`,
        value: JSON.stringify(updatedAudit),
        updated_at: nowIso,
      });

      return NextResponse.json({
        success: true,
        message: 'Auditoria do dia concluída com sucesso!',
        audit: updatedAudit,
      });
    }

    // ── 2. APROVAR & AGENDAR DOCUMENTO EM 1 CLIQUE ───────────────────
    if (action === 'approveDocument') {
      const { docId, approvalData } = body;
      if (!docId) {
        return NextResponse.json({ error: 'docId é obrigatório.' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();

      // Se approvalData for enviado, cria ou vincula conta a pagar/receber
      let createdBillId = null;
      if (approvalData && approvalData.clientId && approvalData.amount) {
        const { data: newBill } = await supabase
          .from('payables_receivables')
          .insert({
            client_id: approvalData.clientId,
            counterparty_name: approvalData.counterparty || approvalData.description || 'Fornecedor',
            type: approvalData.type || 'payable',
            amount: Number(approvalData.amount),
            original_due_date: approvalData.dueDate || todayStr,
            current_due_date: approvalData.dueDate || todayStr,
            status: 'open',
            barcode_or_pix: approvalData.barcodeOrPix || null,
            notes: `Homologado via Torre de Controle BPO em ${new Date().toLocaleString('pt-BR')}`,
          })
          .select('id')
          .single();

        createdBillId = newBill?.id;
      }

      // Atualiza em documents
      await supabase
        .from('documents')
        .update({
          status: 'processed',
          extracted_data: {
            ...(approvalData || {}),
            approved_at: nowIso,
            approved_by: 'bpo_operator',
          },
        })
        .eq('id', docId);

      // Atualiza em bot_action_confirmations se existir
      await supabase
        .from('bot_action_confirmations')
        .update({
          status: 'confirmed',
          extracted_payload: {
            ...(approvalData || {}),
            approved_at: nowIso,
            approved_by: 'bpo_operator',
          },
        })
        .eq('id', docId);

      // Incrementa documents_approved na auditoria do dia
      try {
        const { data: auditRow } = await supabase
          .from('daily_bpo_audits')
          .select('documents_approved, documents_pending_review')
          .eq('audit_date', todayStr)
          .maybeSingle();

        if (auditRow) {
          const newApproved = (auditRow.documents_approved || 0) + 1;
          const newPending = Math.max(0, (auditRow.documents_pending_review || 1) - 1);
          await supabase
            .from('daily_bpo_audits')
            .update({
              documents_approved: newApproved,
              documents_pending_review: newPending,
            })
            .eq('audit_date', todayStr);
        }
      } catch (auditErr) {
        console.warn('[BPO Actions] Aviso ao atualizar contadores na tabela daily_bpo_audits:', auditErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Documento aprovado e agendado com sucesso!',
        billId: createdBillId,
      });
    }

    // ── 3. AJUSTE FINO DE DADOS DO LANÇAMENTO (UPDATE BILL) ──────────
    if (action === 'updateBillData') {
      const { billId, amount, currentDueDate, counterpartyName, barcodeOrPix } = body;
      if (!billId) {
        return NextResponse.json({ error: 'billId é obrigatório.' }, { status: 400 });
      }

      const updatePayload: any = {};
      if (amount !== undefined) updatePayload.amount = Number(amount);
      if (currentDueDate) updatePayload.current_due_date = currentDueDate;
      if (counterpartyName) updatePayload.counterparty_name = counterpartyName;
      if (barcodeOrPix !== undefined) updatePayload.barcode_or_pix = barcodeOrPix;

      const { data: updatedBill, error: updErr } = await supabase
        .from('payables_receivables')
        .update(updatePayload)
        .eq('id', billId)
        .select()
        .single();

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Dados do lançamento corrigidos com sucesso!',
        bill: updatedBill,
      });
    }

    // ── 4. MARCAR DOCUMENTO COMO INCONSISTENTE & NOTIFICAR WHATSAPP ──
    if (action === 'markInconsistent') {
      const { docId, clientId, phone, reason, fileName } = body;
      if (!docId) {
        return NextResponse.json({ error: 'docId é obrigatório.' }, { status: 400 });
      }

      // Atualiza status do documento
      await supabase
        .from('documents')
        .update({
          status: 'error',
          extracted_data: {
            error_reason: reason || 'Documento ilegível ou dados divergentes.',
            marked_inconsistent_at: new Date().toISOString(),
          },
        })
        .eq('id', docId);

      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'rejected' })
        .eq('id', docId);

      // Notifica o cliente no WhatsApp de forma amigável pedindo novo envio
      let messageSent = false;
      if (phone) {
        try {
          const msg = `⚠️ *Aviso da Controladoria AnalisAí*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Identificamos uma inconsistência no envio do seu documento *${fileName || 'recente'}*:\n\n` +
            `📌 *Motivo:* ${reason || 'A imagem ficou ilegível ou o código de barras/Pix está cortado.'}\n\n` +
            `👉 *O que fazer:* Por favor, envie novamente uma foto nítida ou o arquivo PDF original aqui nesta conversa para fazermos o agendamento correto! 📊`;

          await sendEvolutionText({ phone, text: msg });
          messageSent = true;
        } catch (waErr) {
          console.warn('[BPO Actions] Falha ao notificar WhatsApp:', waErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Documento marcado como inconsistente e notificação registrada!',
        notifiedWhatsApp: messageSent,
      });
    }

    return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
  } catch (err: any) {
    console.error('[BPO Actions POST Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar ação BPO.' },
      { status: 500 }
    );
  }
}

