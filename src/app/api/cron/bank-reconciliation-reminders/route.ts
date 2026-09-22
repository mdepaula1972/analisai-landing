import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { formatDueDateDetails } from '@/lib/solo/date-utils';
import { getUpcomingBillsSummary } from '@/lib/solo/cash-flow-advisor';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron Job Proativo:
 * 1. Segundas-feiras (08h30/10h00 BRT): Radar Financeiro da Semana + Conciliação Semanal (Pro/Super)
 * 2. Virada do Mês (Dia 1º às 09h00/10h00 BRT): Fechamento Executivo do Mês Anterior + Conciliação Mensal (Solo/Plus)
 *
 * Agrupamento Estrito: 1 única mensagem consolidada por destinatário por execução.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const urlKey = req.nextUrl.searchParams.get('key');
    if (urlKey !== cronSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();

  // Fuso oficial de Brasília
  const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dayOfMonth = nowBRT.getDate();
  const dayOfWeek = nowBRT.getDay(); // 0 = Domingo, 1 = Segunda-feira
  const isMonday = dayOfWeek === 1;
  const isFirstDayOfMonth = dayOfMonth === 1;

  console.log(`[Bank Reconciliation & Weekly Radar Cron] Dia do mês: ${dayOfMonth}, Dia da semana: ${dayOfWeek}, isMonday: ${isMonday}, isFirstDay: ${isFirstDayOfMonth}`);

  let sentClientsCount = 0;
  let sentLeadsCount = 0;

  try {
    // ── 1. Processamento para Clientes Ativos ──────────────────────────────
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select(`
        id,
        client_id,
        plan_id,
        status,
        clients:client_id (
          id,
          name,
          whatsapp_number,
          status
        ),
        plans:plan_id (
          id,
          code,
          name,
          features_config
        )
      `)
      .eq('status', 'active');

    if (activeSubs && activeSubs.length > 0) {
      for (const sub of activeSubs) {
        const client = (sub as any).clients;
        const plan = (sub as any).plans;

        if (!client || client.status !== 'active' || !client.whatsapp_number) {
          continue;
        }

        const planCode = plan?.code;
        const firstName = client.name ? client.name.split(' ')[0] : 'Empresário(a)';

        // CENÁRIO A: Virada do Mês (Dia 1º) — Fechamento Consolidado + Conciliação
        if (isFirstDayOfMonth) {
          const prevMonthDate = subMonths(nowBRT, 1);
          const prevMonthStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd');
          const prevMonthEnd = format(endOfMonth(prevMonthDate), 'yyyy-MM-dd');
          const prevMonthName = prevMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

          // Busca movimentações do mês anterior
          const { data: entries } = await supabase
            .from('cash_ledger_entries')
            .select('amount, entry_type')
            .eq('client_id', client.id)
            .gte('entry_date', prevMonthStart)
            .lte('entry_date', prevMonthEnd);

          let totalIncome = 0;
          let totalExpense = 0;

          if (entries) {
            for (const e of entries) {
              const amt = Number(e.amount) || 0;
              if (e.entry_type === 'income' || amt > 0) {
                totalIncome += Math.abs(amt);
              } else {
                totalExpense += Math.abs(amt);
              }
            }
          }

          const netResult = totalIncome - totalExpense;
          const incomeFmt = totalIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const expenseFmt = totalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const netFmt = netResult.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const resultTag = netResult >= 0 ? '🟢 Sobra Operacional' : '🔴 Déficit Operacional';

          const message = `📊 *Fechamento Consolidado — ${prevMonthName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Olá, *${firstName}*! Parabéns pela disciplina financeira no último mês. Aqui está o fechamento do seu caixa:

• *Total Recebido:* ${incomeFmt}
• *Total Pago/Despesas:* ${expenseFmt}
• *Resultado Líquido:* *${netFmt}* (${resultTag})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 *Conciliação Mensal Inclusa no seu Plano:*
Para deixar seu Livro Caixa 100% auditado e sem nenhuma ponta solta:
1️⃣ Exporte o extrato bancário do mês em formato **PDF ou OFX** no seu banco;
2️⃣ Envie o arquivo aqui nesta conversa do WhatsApp!

🤖 O AnalisAí cruza automaticamente cada tarifa, débito e transferência para garantir segurança fiscal absoluta!`;

          await sendEvolutionText({
            phone: client.whatsapp_number,
            text: message,
          });
          sentClientsCount++;
          continue;
        }

        // CENÁRIO B: Segunda-feira de Manhã (Radar Semanal)
        if (isMonday) {
          const todayIso = format(nowBRT, 'yyyy-MM-dd');
          const next7Iso = format(new Date(nowBRT.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

          // Busca contas da semana
          const { data: weeklyBills } = await supabase
            .from('payables_receivables')
            .select('*')
            .eq('client_id', client.id)
            .eq('type', 'payable')
            .eq('status', 'open')
            .gte('current_due_date', todayIso)
            .lte('current_due_date', next7Iso)
            .order('current_due_date', { ascending: true });

          const totalWeek = (weeklyBills || []).reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);
          const totalWeekFmt = totalWeek.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          let message = `☀️ *Bom dia, ${firstName}! Radar da Semana — AnalisAí*\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

          if (weeklyBills && weeklyBills.length > 0) {
            message += `Você tem *${weeklyBills.length} obrigação(ões)* agendada(s) para os próximos 7 dias:\n\n`;
            message += weeklyBills
              .map((b: any) => {
                const provTag = b.is_provision ? ' 📝 _[Provisão]_' : '';
                const barcodeTag = b.barcode_or_pix ? ' ↳ \`código pronto\`' : '';
                const amtFmt = Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                return `• *${formatDueDateDetails(b.current_due_date)}:* ${b.counterparty_name} — ${amtFmt}${provTag}${barcodeTag}`;
              })
              .join('\n');
            message += `\n\n💰 *Total previsto na semana:* *${totalWeekFmt}*\n`;
          } else {
            message += `Tudo tranquilo! Você não possui nenhuma conta a pagar agendada para os próximos 7 dias! 🎉\n`;
          }

          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

          if (planCode === 'pro' || planCode === 'super') {
            const maxAccounts = planCode === 'super' ? 'até 4 contas' : 'até 2 contas';
            message += `🏦 *Conciliação Semanal:* Envie seu extrato PDF/OFX da semana para conferência e blindagem de caixa (${maxAccounts}).\n\n`;
          }

          message += `💡 _Deseja antecipar ou adiar alguma conta? Mande um áudio ou digite o nome do fornecedor e a nova data!_`;

          await sendEvolutionText({
            phone: client.whatsapp_number,
            text: message,
          });
          sentClientsCount++;
        }
      }
    }

    // ── 2. Radar Semanal para Leads em Degustação (Segunda-feira) ──────────
    if (isMonday) {
      const { data: trialLeads } = await supabase
        .from('trial_leads')
        .select('id, whatsapp_number, bills_list')
        .eq('converted_to_client', false);

      if (trialLeads && trialLeads.length > 0) {
        const todayIso = format(nowBRT, 'yyyy-MM-dd');
        const next7Iso = format(new Date(nowBRT.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

        for (const lead of trialLeads) {
          const bills: any[] = Array.isArray(lead.bills_list) ? lead.bills_list : [];
          const weekBills = bills.filter((b) => b.due_date >= todayIso && b.due_date <= next7Iso);

          if (weekBills.length > 0) {
            const totalWeek = weekBills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
            const totalFmt = totalWeek.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            let msg = `☀️ *Bom dia! Seu Radar da Semana — AnalisAí*\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `Aqui estão seus compromissos agendados para os próximos 7 dias na sua degustação VIP:\n\n`;

            msg += weekBills
              .map((b) => {
                const amtFmt = Number(b.amount) > 0
                  ? Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : '_(Valor a confirmar - Provisão)_';
                return `• *${b.due_date}*: ${b.supplier_name || 'Conta'} — ${amtFmt}`;
              })
              .join('\n');

            msg += `\n\n💰 *Total da semana:* *${totalFmt}*\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `⏰ Vou te avisar na véspera de cada vencimento com o código pronto para cópia!\n\n`;
            msg += `👉 Ative o plano Solo para ter gestão completa de caixa por R$ 87,99/mês:\n`;
            msg += `https://analisai.me#planos`;

            await sendEvolutionText({
              phone: lead.whatsapp_number,
              text: msg,
            });
            sentLeadsCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sentClientsCount,
      sentLeadsCount,
      isMonday,
      isFirstDayOfMonth,
    });
  } catch (err: any) {
    console.error('[Bank Reconciliation & Weekly Radar Cron Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
