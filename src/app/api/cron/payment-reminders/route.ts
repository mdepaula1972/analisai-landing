import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { formatDueDateDetails } from '@/lib/solo/date-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Validação de segurança para Vercel Cron
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const urlKey = req.nextUrl.searchParams.get('key');
    if (urlKey !== cronSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();

  // Garante a data atual no fuso oficial de Brasília (UTC-3)
  const brDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [day, month, year] = brDateFormatter.format(new Date()).split('/');
  const today = `${year}-${month}-${day}`;

  // Data de 3 dias atrás para auditoria de baixas pendentes
  const threeDaysAgoDate = new Date();
  threeDaysAgoDate.setDate(threeDaysAgoDate.getDate() - 3);
  const [d3, m3, y3] = brDateFormatter.format(threeDaysAgoDate).split('/');
  const threeDaysAgo = `${y3}-${m3}-${d3}`;

  // 1. Busca contas vencendo HOJE de clientes ativos (Pagar e Receber)
  const { data: todayBills, error: todayError } = await supabase
    .from('payables_receivables')
    .select(`
      id,
      counterparty_name,
      amount,
      type,
      current_due_date,
      barcode_or_pix,
      last_reminder_sent_at,
      clients (
        id,
        name,
        whatsapp_number,
        status,
        company_name,
        tax_id
      )
    `)
    .eq('current_due_date', today)
    .in('status', ['open', 'postponed']);

  if (todayError) {
    console.error('[Cron Reminders] Erro ao buscar contas de hoje:', todayError);
  }

  // 2. Busca contas vencidas recentemente (1 a 3 dias atrás) que continuam sem baixa
  const { data: overduePendingBills, error: overdueError } = await supabase
    .from('payables_receivables')
    .select(`
      id,
      counterparty_name,
      amount,
      type,
      current_due_date,
      last_reminder_sent_at,
      clients (
        id,
        name,
        whatsapp_number,
        status,
        company_name,
        tax_id
      )
    `)
    .gte('current_due_date', threeDaysAgo)
    .lt('current_due_date', today)
    .eq('status', 'open');

  if (overdueError) {
    console.error('[Cron Reminders] Erro ao buscar contas vencidas sem baixa:', overdueError);
  }

  // Agrupamento por cliente
  interface ClientAgenda {
    client: any;
    todayPayables: any[];
    todayReceivables: any[];
    overdueAudits: any[];
  }

  const agendaByClient: Record<string, ClientAgenda> = {};

  // Processa itens de hoje
  for (const bill of todayBills || []) {
    const client = bill.clients as any;
    if (!client || client.status !== 'active' || !client.whatsapp_number) continue;

    // Idempotência para lembrete de hoje
    if (bill.last_reminder_sent_at) {
      const [sentD, sentM, sentY] = brDateFormatter.format(new Date(bill.last_reminder_sent_at)).split('/');
      const sentDateStr = `${sentY}-${sentM}-${sentD}`;
      if (sentDateStr === today) continue;
    }

    if (!agendaByClient[client.id]) {
      agendaByClient[client.id] = { client, todayPayables: [], todayReceivables: [], overdueAudits: [] };
    }

    if (bill.type === 'receivable') {
      agendaByClient[client.id].todayReceivables.push(bill);
    } else {
      agendaByClient[client.id].todayPayables.push(bill);
    }
  }

  // Processa auditoria de contas vencidas sem baixa
  for (const bill of overduePendingBills || []) {
    const client = bill.clients as any;
    if (!client || client.status !== 'active' || !client.whatsapp_number) continue;

    // Não reenvia auditoria se já foi auditada hoje
    if (bill.last_reminder_sent_at) {
      const [sentD, sentM, sentY] = brDateFormatter.format(new Date(bill.last_reminder_sent_at)).split('/');
      const sentDateStr = `${sentY}-${sentM}-${sentD}`;
      if (sentDateStr === today) continue;
    }

    if (!agendaByClient[client.id]) {
      agendaByClient[client.id] = { client, todayPayables: [], todayReceivables: [], overdueAudits: [] };
    }

    agendaByClient[client.id].overdueAudits.push(bill);
  }

  let sentCount = 0;
  let processedBillsCount = 0;

  for (const entry of Object.values(agendaByClient)) {
    const { client, todayPayables, todayReceivables, overdueAudits } = entry;
    if (todayPayables.length === 0 && todayReceivables.length === 0 && overdueAudits.length === 0) {
      continue;
    }

    const firstName = client.name ? client.name.split(' ')[0] : 'Empresário(a)';
    let msg = `☀️ *Bom dia, ${firstName}! Lembrete do AnalisAí*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Bloco 1: Contas a Pagar Hoje
    if (todayPayables.length > 0) {
      const totalPay = todayPayables.reduce((acc, b) => acc + Number(b.amount || 0), 0);
      msg += `🔴 *CONTAS A PAGAR HOJE (${todayPayables.length}):*\n`;
      for (const b of todayPayables) {
        const amtFmt = Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        msg += `• *${b.counterparty_name}*: ${amtFmt}\n`;
        if (b.barcode_or_pix) {
          msg += `  ↳ Linha/PIX: \`${b.barcode_or_pix}\`\n`;
        }
      }
      msg += `💰 *Subtotal a Pagar:* ${totalPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n`;
    }

    // Bloco 2: Receitas Previstas para Hoje
    if (todayReceivables.length > 0) {
      const totalRec = todayReceivables.reduce((acc, b) => acc + Number(b.amount || 0), 0);
      msg += `🟢 *RECEBÍVEIS PREVISTOS PARA HOJE (${todayReceivables.length}):*\n`;
      for (const b of todayReceivables) {
        const amtFmt = Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        msg += `• *${b.counterparty_name}*: ${amtFmt} (Receita Agendada)\n`;
      }
      msg += `💵 *Subtotal a Receber:* ${totalRec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n`;
    }

    // Bloco 3: Auditoria Proativa de Contas Vencidas sem Baixa
    if (overdueAudits.length > 0) {
      msg += `🔍 *Auditoria de Baixa — Contas Vencidas sem Confirmação:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Constatamos que a(s) seguinte(s) conta(s) venceram recentemente e ainda constam em aberto:
`;
      for (const b of overdueAudits.slice(0, 5)) {
        const amtFmt = Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dueFmt = formatDueDateDetails(b.current_due_date);
        const tag = b.type === 'receivable' ? 'Receita' : 'Despesa';
        msg += `• *${b.counterparty_name}* (${amtFmt} - Venceu ${dueFmt}) [${tag}]\n`;
      }

      msg += `
❓ *O pagamento ou recebimento já aconteceu?*
Você pode:
1️⃣ Enviar seu *Extrato Bancário* (foto ou PDF) para conciliação automática com o banco;
2️⃣ Dizer por texto/áudio se já foi *Paga* ou *Recebida*;
3️⃣ Ou me avisar se deseja considerar como:
   • *Atrasada* (continuar cobrando)
   • *Postergada* (informe: *"Adiar [conta] para dia [dia]"*)
   • *Cancelada* (informe: *"Cancelar conta [conta]"*)
`;
    } else {
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Dica: Você pode me mandar o seu extrato bancário a qualquer momento para fazer a conciliação automática!_`;
    }

    await sendEvolutionText({
      phone: client.whatsapp_number,
      text: msg,
    });

    // Atualiza last_reminder_sent_at em todas as contas notificadas
    const allNotifiedIds = [
      ...todayPayables.map((b) => b.id),
      ...todayReceivables.map((b) => b.id),
      ...overdueAudits.map((b) => b.id),
    ];

    if (allNotifiedIds.length > 0) {
      await supabase
        .from('payables_receivables')
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .in('id', allNotifiedIds);
    }

    sentCount++;
    processedBillsCount += allNotifiedIds.length;
  }

  return NextResponse.json({
    success: true,
    today_br: today,
    notified_clients: sentCount,
    processed_bills: processedBillsCount,
  });
}
