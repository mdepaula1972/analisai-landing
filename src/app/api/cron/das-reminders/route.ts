import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron diário de Gestão do DAS-MEI
 * 1. Provisionamento preventivo no início de cada mês para todo cliente MEI ativo.
 * 2. Lembretes preventivos no WhatsApp nos dias 18, 19 e 20 do mês para evitar multas/juros.
 */
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

  // Data atual no fuso horário oficial de Brasília (America/Sao_Paulo)
  const brDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [dayStr, monthStr, yearStr] = brDateFormatter.format(new Date()).split('/');
  const currentDay = parseInt(dayStr, 10);
  const competence = `${monthStr}/${yearStr}`;
  const dueDate = `${yearStr}-${monthStr}-20`;
  const todayDateStr = `${yearStr}-${monthStr}-${dayStr}`;

  // 1. Busca todos os clientes ativos com regime tributário MEI
  const { data: meiClients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, company_name, whatsapp_number, tax_regime, status')
    .eq('status', 'active')
    .or('tax_regime.eq.mei,tax_regime.is.null');

  if (clientsError) {
    console.error('[DAS Reminders Cron] Erro ao buscar clientes MEI:', clientsError);
    return NextResponse.json({ error: 'database_error', details: clientsError.message }, { status: 500 });
  }

  let provisionedCount = 0;
  let remindersSentCount = 0;

  for (const client of meiClients || []) {
    if (!client.whatsapp_number) continue;

    // ── ETAPA 1: PROVISIONAMENTO PREVENTIVO NO INÍCIO DO MÊS ──────────────
    // Executa preferencialmente nos primeiros 5 dias do mês (1º dia útil em diante)
    // ou se ainda não houver lançamento de DAS para o mês corrente
    if (currentDay <= 10) {
      const { data: existingDas } = await supabase
        .from('payables_receivables')
        .select('id')
        .eq('client_id', client.id)
        .or(`tax_competence.eq.${competence},and(counterparty_name.ilike.%DAS-MEI%,current_due_date.gte.${yearStr}-${monthStr}-01,current_due_date.lte.${yearStr}-${monthStr}-31)`)
        .limit(1)
        .maybeSingle();

      if (!existingDas) {
        const { error: insertError } = await supabase.from('payables_receivables').insert({
          client_id: client.id,
          counterparty_name: 'Receita Federal (DAS-MEI)',
          type: 'payable',
          amount: 75.0, // Valor referencial padrão do DAS-MEI
          original_due_date: dueDate,
          current_due_date: dueDate,
          status: 'open',
          is_provision: true,
          is_government_tax: true,
          tax_competence: competence,
          criticality_score: 5,
          notes: 'Guia DAS-MEI mensal provisionada automaticamente pelo AnalisAí',
        });

        if (!insertError) {
          provisionedCount++;
          console.log(`[DAS Provisioning] DAS provisionado para ${client.name} (${client.id}) - Competência ${competence}`);
        } else {
          console.error(`[DAS Provisioning] Falha ao provisionar DAS para ${client.id}:`, insertError);
        }
      }
    }

    // ── ETAPA 2: ALERTAS PREVENTIVOS (DIAS 18, 19 E 20 DO MÊS) ─────────────
    if (currentDay === 18 || currentDay === 19 || currentDay === 20) {
      // Localiza a conta do DAS do mês corrente em aberto
      const { data: openDasBills } = await supabase
        .from('payables_receivables')
        .select('id, amount, current_due_date, last_reminder_sent_at')
        .eq('client_id', client.id)
        .in('status', ['open', 'postponed'])
        .or(`tax_competence.eq.${competence},counterparty_name.ilike.%DAS-MEI%`)
        .order('current_due_date', { ascending: true })
        .limit(1);

      const dasBill = openDasBills && openDasBills.length > 0 ? openDasBills[0] : null;

      if (dasBill) {
        // Idempotência: verificar se já enviamos lembrete hoje
        let alreadySentToday = false;
        if (dasBill.last_reminder_sent_at) {
          const [lastD, lastM, lastY] = brDateFormatter
            .format(new Date(dasBill.last_reminder_sent_at))
            .split('/');
          if (`${lastY}-${lastM}-${lastD}` === todayDateStr) {
            alreadySentToday = true;
          }
        }

        if (!alreadySentToday) {
          const reminderMessage =
            '⚠️ *Lembrete de Tributo - DAS-MEI*\n\n' +
            'Seu DAS com competência deste mês vence no dia 20.\n\n' +
            'Evite juros e perda de benefícios previdenciários. Já realizou o pagamento?';

          try {
            await sendEvolutionText({
              phone: client.whatsapp_number,
              text: reminderMessage,
            });

            await supabase
              .from('payables_receivables')
              .update({ last_reminder_sent_at: new Date().toISOString() })
              .eq('id', dasBill.id);

            remindersSentCount++;
            console.log(`[DAS Reminder] Alerta enviado para ${client.name} (${client.whatsapp_number})`);
          } catch (sendErr) {
            console.error(`[DAS Reminder] Erro ao enviar WhatsApp para ${client.whatsapp_number}:`, sendErr);
          }
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    currentDate: todayDateStr,
    currentDay,
    competence,
    dueDate,
    clientsEvaluated: meiClients?.length || 0,
    provisionedCount,
    remindersSentCount,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
