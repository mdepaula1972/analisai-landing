import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { resolveCompetencePeriod } from '@/lib/solo/accountant-export';
import { auditPersonalExpenseLeak, calculateAvoidedInterest } from '@/lib/solo/cfo-strategy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/monthly-dre
 * Executa no dia 5 de cada mês às 09h00 BRT (12h00 UTC).
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
  const period = resolveCompetencePeriod(); // Resolve mês anterior automático

  // 2. Busca clientes ativos
  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name, company_name, whatsapp_number, status, service_tier')
    .eq('status', 'active');

  if (clientsErr || !clients) {
    console.error('[Monthly DRE Cron] Erro ao carregar clientes:', clientsErr);
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
      // 3. Apura totais consolidados de receitas e despesas em cash_ledger_entries
      const { data: entries } = await supabase
        .from('cash_ledger_entries')
        .select('amount, entry_type, dre_group')
        .eq('client_id', client.id)
        .gte('entry_date', period.startDate)
        .lte('entry_date', period.endDate);

      let receitaTotal = 0;
      let despesasOperacionais = 0;

      for (const e of entries || []) {
        const val = Number(e.amount) || 0;
        if (e.entry_type === 'income') {
          receitaTotal += val;
        } else {
          despesasOperacionais += val;
        }
      }

      const lucroLiquido = receitaTotal - despesasOperacionais;
      const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0;

      // 4. Aplica inteligência CFO: Auditoria PF x PJ e Juros Evitados
      const pfLeak = await auditPersonalExpenseLeak(client.id, period.competence);
      const roiInterest = await calculateAvoidedInterest(client.id, period.competence);

      // Formatações monetárias
      const recFmt = receitaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const despFmt = despesasOperacionais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const lucroFmt = (lucroLiquido >= 0 ? '+ ' : '') +
        lucroLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const margemFmt = `${margemLiquida.toFixed(1)}%`;

      const clientFirstName = (client.name || 'Empresário').split(' ')[0];

      // 5. Monta a mensagem executiva da DRE
      let msg = `📈 *Fechamento Mensal de Resultados | ${period.competence}*\n` +
        `Olá, ${clientFirstName}! Sua DRE Gerencial do mês anterior está pronta:\n\n` +
        `💵 *Receita Total Realizada:* ${recFmt}\n` +
        `📉 *Despesas Operacionais:* ${despFmt}\n` +
        `📊 *Lucro Líquido Real:* ${lucroFmt} (Margem: ${margemFmt})\n\n` +
        `🛡️ *Proteção de Pontualidade:* *${roiInterest.formattedAvoidedInterest}* economizados em juros e multas evitados neste mês.\n`;

      if (pfLeak.totalPfAmount > 0) {
        const pfFmt = pfLeak.totalPfAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        msg += `\n⚠️ *Alerta de Pró-labore:* Identificamos *${pfFmt}* em despesas com características pessoais pagas na conta PJ. Recomendamos unificar em uma retirada fixa mensal de pró-labore.\n`;
      }

      msg += `\n📄 O relatório oficial e a conciliação completa já foram disponibilizados e encaminhados para a sua contabilidade!`;

      // 6. Envia no WhatsApp
      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: msg,
      });

      // Registra ou atualiza em monthly_closings
      await supabase.from('monthly_closings').upsert(
        {
          client_id: client.id,
          competence_period: period.competence,
          total_inflow: receitaTotal,
          total_outflow: despesasOperacionais,
          net_result: lucroLiquido,
          sent_to_accountant_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,competence_period' }
      );

      results.push({
        clientId: client.id,
        companyName: client.company_name || client.name,
        sent: true,
      });
    } catch (err: any) {
      console.error(`[Monthly DRE Cron] Falha ao processar cliente ${client.id}:`, err);
      results.push({
        clientId: client.id,
        companyName: client.company_name || client.name,
        sent: false,
        error: err?.message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    competence: period.competence,
    totalClients: clients.length,
    sentCount: results.filter((r) => r.sent).length,
    results,
  });
}
