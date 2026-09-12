import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { addDays, subDays } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().split('T')[0];

  // 1. Busca ciclos que encerraram até ontem e precisam de renovação
  const { data: expiredCycles } = await supabase
    .from('usage_cycles')
    .select(`
      id,
      client_id,
      subscription_id,
      cycle_end,
      subscriptions (
        id,
        status,
        plan_id,
        plans (code, name)
      ),
      clients (
        id,
        name,
        whatsapp_number
      )
    `)
    .lt('cycle_end', today);

  let resetCount = 0;
  let upsellCount = 0;

  if (expiredCycles && expiredCycles.length > 0) {
    for (const expired of expiredCycles) {
      const client = expired.clients as any;
      const sub = expired.subscriptions as any;
      if (!client || !sub || sub.status !== 'active') continue;

      // Cria novo ciclo de 30 dias com contadores zerados
      const nextCycleStart = today;
      const nextCycleEnd = addDays(new Date(), 30).toISOString().split('T')[0];

      await supabase.from('usage_cycles').insert({
        client_id: client.id,
        subscription_id: sub.id,
        cycle_start: nextCycleStart,
        cycle_end: nextCycleEnd,
      });

      resetCount++;

      // Avalia Programa de Indicação no fechamento do ciclo
      await supabase.rpc('evaluate_referral_exemption', { p_client_id: client.id });

      // Avalia Gatilho de Upsell Proativo (2 ciclos consecutivos no limite)
      const sixtyDaysAgo = subDays(new Date(), 65).toISOString().split('T')[0];
      const { data: pastCycles } = await supabase
        .from('usage_cycles')
        .select('hit_doc_limit, hit_bot_limit, hit_analysis_limit, upsell_declined_at')
        .eq('client_id', client.id)
        .gte('cycle_end', sixtyDaysAgo);

      const overflowCycles = (pastCycles || []).filter(
        (c) => c.hit_doc_limit || c.hit_bot_limit || c.hit_analysis_limit
      );

      const recentDeclined = (pastCycles || []).some(
        (c) => c.upsell_declined_at && new Date(c.upsell_declined_at) > subDays(new Date(), 45)
      );

      // Se atingiu o limite em 2 ciclos e não recusou recentemente
      if (overflowCycles.length >= 2 && !recentDeclined && sub.plans?.code !== 'solo_plus') {
        const nextPlanName = sub.plans?.code === 'start' ? 'AnalisAí Solo' : 'AnalisAí Solo Plus';

        await sendEvolutionText({
          phone: client.whatsapp_number,
          text: `📈 *Seu negócio está crescendo, ${client.name.split(' ')[0]}!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Notamos que nos últimos 2 meses você atingiu o limite de uso do seu plano atual (${sub.plans?.name}).

Para que seus lançamentos automáticos e análises financeiras não sejam pausados, recomendamos o upgrade para o *${nextPlanName}* (com mais que o dobro de capacidade)!

Deseja migrar com facilidade? Acesse:
👉 https://analisai.me#upgrade`,
        });

        // Marca que o upsell foi sugerido
        await supabase
          .from('usage_cycles')
          .update({ upsell_status: 'suggested', upsell_suggested_at: new Date().toISOString() })
          .eq('id', expired.id);

        upsellCount++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    cycles_reset: resetCount,
    upsell_dispatched: upsellCount,
  });
}
