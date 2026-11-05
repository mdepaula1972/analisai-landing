import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { predictCashTightness } from '@/lib/solo/cfo-strategy';
import { getBrasiliaDate } from '@/lib/solo/bpo-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Retorna as datas de início (Segunda-feira) e fim (Domingo) da semana corrente no fuso de Brasília
 */
function getCurrentWeekRange(): { mondayStr: string; sundayStr: string } {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateObj = new Date();
  const [day, month, year] = formatter.format(dateObj).split('/');
  const today = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));

  const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Segunda...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  return {
    mondayStr: formatIso(monday),
    sundayStr: formatIso(sunday),
  };
}

/**
 * GET /api/cron/weekly-cashflow
 * Executa toda segunda-feira às 08h30 BRT (11h30 UTC).
 */
export async function GET(req: NextRequest) {
  // 1. Validação de segurança para Vercel Cron
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const urlKey = req.nextUrl.searchParams.get('key');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && urlKey !== cronSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { mondayStr, sundayStr } = getCurrentWeekRange();

  // 2. Busca clientes ativos elegíveis (BPO Gestão, BPO CFO e cadastrados)
  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name, company_name, whatsapp_number, service_tier, status')
    .eq('status', 'active');

  if (clientsErr || !clients) {
    console.error('[Weekly Cashflow Cron] Erro ao carregar clientes:', clientsErr);
    return NextResponse.json({ error: 'database_error', details: clientsErr?.message }, { status: 500 });
  }

  const results: Array<{
    clientId: string;
    companyName: string;
    sent: boolean;
    error?: string;
  }> = [];

  for (const client of clients) {
    if (!client.whatsapp_number) continue;

    try {
      // 3. Contas a pagar e receber da semana corrente
      const { data: bills } = await supabase
        .from('payables_receivables')
        .select('counterparty_name, amount, type, current_due_date, status')
        .eq('client_id', client.id)
        .gte('current_due_date', mondayStr)
        .lte('current_due_date', sundayStr)
        .in('status', ['open', 'postponed']);

      let totalReceivablesWeek = 0;
      let totalPayablesWeek = 0;
      const payablesList: Array<{ counterparty: string; amount: number; dueDate: string }> = [];

      for (const b of bills || []) {
        const val = Number(b.amount) || 0;
        if (b.type === 'receivable') {
          totalReceivablesWeek += val;
        } else {
          totalPayablesWeek += val;
          payablesList.push({
            counterparty: b.counterparty_name,
            amount: val,
            dueDate: b.current_due_date,
          });
        }
      }

      // Ordena maiores pagamentos da semana
      payablesList.sort((a, b) => b.amount - a.amount);
      const topPayables = payablesList.slice(0, 3);

      const netWeekBalance = totalReceivablesWeek - totalPayablesWeek;

      // 4. Executa previsão preditiva de caixa (D+15)
      let tightnessAlertText = '';
      try {
        const prediction = await predictCashTightness(client.id);
        if (prediction.riskLevel === 'critical' && prediction.tightnessDate) {
          const [y, m, d] = prediction.tightnessDate.split('-');
          tightnessAlertText = `\n⚠️ *Alerta CFO:* Atenção com o caixa no dia ${d}/${m}, saldo projetado fica abaixo da margem de segurança. Segure compras discricionárias.\n`;
        }
      } catch (predErr) {
        console.warn(`[Weekly Cashflow] Falha ao calcular preditivo para ${client.id}:`, predErr);
      }

      // 5. Formatação da mensagem direta no WhatsApp
      const recFmt = totalReceivablesWeek.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const payFmt = totalPayablesWeek.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const netFmt = (netWeekBalance >= 0 ? '+ ' : '') +
        netWeekBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const clientFirstName = (client.name || 'Empresário').split(' ')[0];

      let msg = `📊 *Radar Semanal de Caixa | AnalisAí Controladoria*\n` +
        `Bom dia, ${clientFirstName}! Aqui está a previsão financeira da sua semana:\n\n` +
        `💰 *Previsão de Recebimentos:* ${recFmt}\n` +
        `💳 *Contas a Pagar na Semana:* ${payFmt}\n` +
        `📈 *Resultado Líquido Projetado:* ${netFmt}\n\n`;

      if (topPayables.length > 0) {
        msg += `🎯 *Principais Vencimentos da Semana:*\n`;
        topPayables.forEach((p, idx) => {
          const [y, m, d] = p.dueDate.split('-');
          const valStr = p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          msg += `${idx + 1}. *${p.counterparty}* — ${valStr} (${d}/${m})\n`;
        });
      } else {
        msg += `🎯 *Vencimentos:* Nenhuma conta pesada vencendo nesta semana.\n`;
      }

      if (tightnessAlertText) {
        msg += tightnessAlertText;
      }

      msg += `\nTenha uma excelente e lucrativa semana! 🚀`;

      // 6. Envia mensagem via WhatsApp
      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: msg,
      });

      results.push({
        clientId: client.id,
        companyName: client.company_name || client.name,
        sent: true,
      });
    } catch (sendErr: any) {
      console.error(`[Weekly Cashflow] Falha ao enviar para cliente ${client.id}:`, sendErr);
      results.push({
        clientId: client.id,
        companyName: client.company_name || client.name,
        sent: false,
        error: sendErr?.message || 'Erro no envio WhatsApp',
      });
    }
  }

  return NextResponse.json({
    success: true,
    weekRange: { mondayStr, sundayStr },
    totalClients: clients.length,
    sentCount: results.filter((r) => r.sent).length,
    results,
  });
}

