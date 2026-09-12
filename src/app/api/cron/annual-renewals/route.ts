import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { INFINITE_PAY_PLANS } from '@/lib/solo/constants';
import { differenceInDays, parseISO } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();

  // Busca assinaturas anuais ativas ou em período de carência
  const { data: annualSubs } = await supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      current_period_end,
      plan_id,
      plans (code, name, annual_price_cents),
      clients (
        id,
        name,
        whatsapp_number
      )
    `)
    .eq('billing_period', 'annual')
    .in('status', ['active', 'grace_period']);

  if (!annualSubs || annualSubs.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: 'Nenhuma assinatura anual ativa.' });
  }

  let notifiedCount = 0;
  let blockedCount = 0;

  for (const sub of annualSubs) {
    const client = sub.clients as any;
    const plan = sub.plans as any;
    if (!client || !plan) continue;

    const endDate = parseISO(sub.current_period_end);
    const daysUntilEnd = differenceInDays(endDate, now);
    const annualPriceFormatted = (plan.annual_price_cents / 100).toFixed(2);

    // Identifica URL oficial de renovação anual do plano
    const planCode = plan.code as 'start' | 'solo' | 'solo_plus';
    const renewalUrl = INFINITE_PAY_PLANS.annual[planCode]?.checkoutUrl || `${INFINITE_PAY_PLANS.annual.solo.checkoutUrl}`;

    // D-30
    if (daysUntilEnd === 30) {
      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `📅 *Lembrete de Renovação Anual AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Olá, ${client.name.split(' ')[0]}! O seu plano anual *${plan.name}* vence em *30 dias*.
Para continuar com o seu **desconto especial de 20%** garantido em parcela única (R$ ${annualPriceFormatted}/ano), renove antecipadamente pelo link seguro:
👉 ${renewalUrl}`,
      });
      notifiedCount++;
    }

    // D-15
    if (daysUntilEnd === 15) {
      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `⏳ *Faltam 15 dias para o vencimento do seu plano anual!*
Mantenha sua gestão contábil automatizada e sem interrupções. Renove agora com 20% OFF:
👉 ${renewalUrl}`,
      });
      notifiedCount++;
    }

    // D-10
    if (daysUntilEnd === 10) {
      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `🔔 *Atenção:* Seu plano anual AnalisAí vence em apenas *10 dias*. Renove seu acesso garantindo a tarifa promocional:
👉 ${renewalUrl}`,
      });
      notifiedCount++;
    }

    // D-5
    if (daysUntilEnd === 5) {
      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `⚠️ *Urgente:* Restam apenas *5 dias* para o término do seu plano anual. Evite qualquer pausa no envio de comprovantes e relatórios:
👉 ${renewalUrl}`,
      });
      notifiedCount++;
    }

    // Entrou no período de vencimento até D+9: Ativa carência (grace_period)
    if (daysUntilEnd < 0 && daysUntilEnd >= -9 && sub.status === 'active') {
      await supabase
        .from('subscriptions')
        .update({ status: 'grace_period' })
        .eq('id', sub.id);

      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `⚠️ *Seu plano anual venceu.*
Seu bot continuará funcionando em período de carência por mais *${10 + daysUntilEnd} dias*.
Para regularizar sua anuidade e evitar o bloqueio, renove agora com 20% de desconto:
👉 ${renewalUrl}`,
      });
      notifiedCount++;
    }

    // D+10 em diante sem pagamento: Bloqueio imediato da ingestão do bot
    if (daysUntilEnd < -10 && sub.status !== 'expired') {
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', sub.id);

      await sendEvolutionText({
        phone: client.whatsapp_number,
        text: `🔒 *Assinatura Anual Expirada.*
O prazo de carência de 10 dias se esgotou e o recebimento de documentos foi suspenso.
Para reativar seu assistente financeiro imediatamente, conclua a renovação:
👉 ${renewalUrl}`,
      });
      blockedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    reminders_sent: notifiedCount,
    blocked_subscriptions: blockedCount,
  });
}
