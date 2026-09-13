import { createServiceRoleClient } from '@/lib/supabase-server';
import { Plan, UsageCycle } from '@/types/solo';
import { differenceInDays, parseISO } from 'date-fns';

export interface CheckUsageResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  reason?: string;
  consumed_from_extra?: boolean;
  extra_credits_remaining?: number;
}

export async function checkAndIncrementQuota(
  clientId: string,
  metric: 'doc' | 'bot' | 'analysis',
  increment: number = 1
): Promise<CheckUsageResult> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc('check_and_increment_usage', {
    p_client_id: clientId,
    p_metric: metric,
    p_increment: increment,
  });

  if (error) {
    console.error('[Quota] Erro ao verificar cota:', error);
    return { allowed: false, current: 0, limit: 0, remaining: 0, reason: error.message };
  }

  return data as CheckUsageResult;
}

export async function getClientPlanAndCurrentCycle(clientId: string) {
  const supabase = createServiceRoleClient();

  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      billing_period,
      current_period_end,
      plans (*)
    `)
    .eq('client_id', clientId)
    .in('status', ['active', 'grace_period'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (subError || !sub) {
    return { plan: null, cycle: null, subscription: null };
  }

  const plan = sub.plans as unknown as Plan;

  const { data: cycle } = await supabase
    .from('usage_cycles')
    .select('*')
    .eq('client_id', clientId)
    .lte('cycle_start', new Date().toISOString().split('T')[0])
    .gte('cycle_end', new Date().toISOString().split('T')[0])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return {
    plan,
    cycle: cycle as UsageCycle | null,
    subscription: sub,
  };
}

export function formatConsumptionSummary(cycle: UsageCycle | null, plan: Plan | null): string {
  if (!plan || !cycle) {
    return 'Não foi possível identificar as informações do seu ciclo no momento.';
  }

  const daysRemaining = Math.max(0, differenceInDays(parseISO(cycle.cycle_end), new Date()));

  return `📊 *Resumo de Consumo do seu Plano (${plan.name})*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 *Documentos:* ${cycle.docs_processed_count} de ${plan.doc_limit}
💬 *Interações com Bot:* ${cycle.bot_interactions_count} de ${plan.bot_interaction_limit}
💡 *Análises de Caixa:* ${cycle.cash_flow_analyses_count} de ${plan.cash_flow_analysis_limit}

⏳ *Renovação do ciclo:* em ${daysRemaining} dia(s) (${cycle.cycle_end})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}
