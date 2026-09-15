import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Validação de segurança para Vercel Cron
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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

  // Busca contas a pagar vencendo hoje de clientes ativos
  const { data: bills, error } = await supabase
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
        status
      )
    `)
    .eq('current_due_date', today)
    .eq('status', 'open');

  if (error) {
    console.error('[Cron Reminders] Erro ao buscar contas de hoje:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!bills || bills.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: 'Nenhuma conta vencendo hoje.' });
  }

  // Agrupa contas por cliente, filtrando apenas aquelas que AINDA NÃO receberam lembrete hoje
  const billsByClient: Record<string, { client: any; items: typeof bills }> = {};

  for (const bill of bills) {
    const client = bill.clients as any;
    if (!client || client.status !== 'active') continue;

    // Idempotência: Se já foi enviado um lembrete hoje para esta conta, não repete
    if (bill.last_reminder_sent_at) {
      const [sentD, sentM, sentY] = brDateFormatter.format(new Date(bill.last_reminder_sent_at)).split('/');
      const sentDateStr = `${sentY}-${sentM}-${sentD}`;
      if (sentDateStr === today) {
        continue;
      }
    }

    if (!billsByClient[client.id]) {
      billsByClient[client.id] = {
        client,
        items: [],
      };
    }
    billsByClient[client.id].items.push(bill);
  }

  let sentCount = 0;
  let processedBillsCount = 0;

  for (const entry of Object.values(billsByClient)) {
    const { client, items } = entry;
    if (items.length === 0) continue;

    const totalAmount = items.reduce((acc, item) => acc + Number(item.amount), 0);

    const itemsText = items
      .map(
        (item) =>
          `• *${item.counterparty_name}*: R$ ${Number(item.amount).toFixed(2)}${
            item.barcode_or_pix ? `\n  ↳ Linha/PIX: \`${item.barcode_or_pix}\`` : ''
          }`
      )
      .join('\n');

    const message = `☀️ *Bom dia, ${client.name.split(' ')[0]}! Lembrete do AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você tem *${items.length} conta(s)* com vencimento agendado para *hoje*:

${itemsText}

💰 *Total do dia:* R$ ${totalAmount.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Se precisar adiar alguma conta por aperto de caixa, você pode me enviar um áudio dizendo qual conta e a nova data!_`;

    await sendEvolutionText({
      phone: client.whatsapp_number,
      text: message,
    });

    // Carimba last_reminder_sent_at para impedir reenvio no mesmo dia
    const billIds = items.map((b) => b.id);
    await supabase
      .from('payables_receivables')
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .in('id', billIds);

    sentCount++;
    processedBillsCount += items.length;
  }

  return NextResponse.json({
    success: true,
    today_br: today,
    notified_clients: sentCount,
    processed_bills: processedBillsCount,
  });
}
