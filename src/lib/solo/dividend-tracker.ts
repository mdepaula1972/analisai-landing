import { createServiceRoleClient } from '@/lib/supabase-server';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface DividendTrackingStatus {
  totalDistributedMonth: number;
  thresholdLimit: number;
  percentageUsed: number;
  remainingSafetyMargin: number;
  isApproachingLimit: boolean;
  isOverLimit: boolean;
  progressBar: string;
  summaryMessage: string;
}

const DEFAULT_DIVIDEND_MONTHLY_LIMIT = 50000; // R$ 50.000,00 (Teto de fiscalização prioritária e e-Financeira)

/**
 * Calcula o montante acumulado de retiradas de lucro / pró-labore no mês corrente
 * e gera um termômetro diário de segurança contábil para o cliente.
 */
export async function getMonthlyDividendTracking(
  clientId: string,
  referenceDate: Date = new Date()
): Promise<DividendTrackingStatus> {
  const supabase = createServiceRoleClient();
  const monthStart = format(startOfMonth(referenceDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(referenceDate), 'yyyy-MM-dd');

  // Busca lançamentos no Livro Caixa marcados como pró-labore ou distribuição de lucros
  const { data: entries } = await supabase
    .from('cash_ledger_entries')
    .select('amount, description, dre_group')
    .eq('client_id', clientId)
    .gte('entry_date', monthStart)
    .lte('entry_date', monthEnd);

  let totalDistributed = 0;

  if (entries) {
    for (const e of entries) {
      const desc = (e.description || '').toLowerCase();
      const dre = (e.dre_group || '').toLowerCase();

      const isDividendOrOwnerDraw =
        dre === 'distribuicao_lucros' ||
        dre === 'retirada_pro_labore' ||
        dre === 'pro_labore' ||
        desc.includes('lucro') ||
        desc.includes('dividendo') ||
        desc.includes('pro-labore') ||
        desc.includes('pró-labore') ||
        desc.includes('retirada sócio') ||
        desc.includes('retirada socio');

      if (isDividendOrOwnerDraw) {
        // Amount no livro caixa costuma ser negativo para saídas
        totalDistributed += Math.abs(Number(e.amount) || 0);
      }
    }
  }

  const threshold = DEFAULT_DIVIDEND_MONTHLY_LIMIT;
  const percentage = Math.min(100, Math.round((totalDistributed / threshold) * 100));
  const remaining = Math.max(0, threshold - totalDistributed);
  const isApproaching = totalDistributed >= threshold * 0.7 && totalDistributed < threshold;
  const isOver = totalDistributed >= threshold;

  // Barra de progresso visual de 15 blocos
  const totalBlocks = 15;
  const filledBlocks = Math.round((percentage / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const progressBar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}] ${percentage}%`;

  const totalFmt = totalDistributed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const limitFmt = threshold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const remainingFmt = remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let summaryMessage = `📈 *Radar Diário de Distribuição de Lucros (Mês Atual):*\n`;
  summaryMessage += `• *Total Retirado:* ${totalFmt} de ${limitFmt}\n`;
  summaryMessage += `• *Margem de Segurança:* ${remainingFmt} restantes\n`;
  summaryMessage += `• *Termômetro Fiscal:* ${progressBar}\n`;

  if (isOver) {
    summaryMessage += `\n⚠️ *Atenção Fiscal:* As retiradas deste mês superaram ${limitFmt}. Movimentações acima dessa faixa entram em monitoramento prioritário da Receita Federal (e-Financeira). Valide com seu contador a existência de balanço contábil formal com apuração de lucros suficientes para garantir a isenção!`;
  } else if (isApproaching) {
    summaryMessage += `\n💡 *Alerta Preventivo:* Você já utilizou ${percentage}% da margem de segurança recomendada. Mantenha os comprovantes de lucro arquivados!`;
  } else {
    summaryMessage += `\n✅ *Status Seguro:* Suas retiradas estão confortavelmente dentro da faixa de isenção e segurança contábil.`;
  }

  return {
    totalDistributedMonth: totalDistributed,
    thresholdLimit: threshold,
    percentageUsed: percentage,
    remainingSafetyMargin: remaining,
    isApproachingLimit: isApproaching,
    isOverLimit: isOver,
    progressBar,
    summaryMessage,
  };
}
