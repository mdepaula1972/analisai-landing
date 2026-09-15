import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron Job: Lembretes Proativos de Conciliação Bancária
 * Disparado pontualmente após as 10h pelo Vercel Crons
 *
 * Regras:
 * - Solo e Solo Plus (Mensal): Disparado no 1º dia útil de cada mês (1 conta bancária)
 * - Pro (Semanal): Disparado toda segunda-feira (até 2 contas bancárias)
 * - Super (Semanal/Contínua): Disparado toda segunda-feira (até 4 contas bancárias)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // Fuso oficial de Brasília
  const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dayOfMonth = nowBRT.getDate();
  const dayOfWeek = nowBRT.getDay(); // 0 = Domingo, 1 = Segunda-feira
  const isMonday = dayOfWeek === 1;
  const isFirstDayOfMonth = dayOfMonth === 1;

  console.log(`[Bank Reconciliation Cron] Dia do mês: ${dayOfMonth}, Dia da semana: ${dayOfWeek}, isMonday: ${isMonday}, isFirstDay: ${isFirstDayOfMonth}`);

  let sentCount = 0;

  try {
    // Busca assinaturas ativas com dados dos clientes e dos planos
    const { data: activeSubs, error } = await supabase
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

    if (error || !activeSubs) {
      console.error('[Bank Reconciliation Cron Error]:', error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    for (const sub of activeSubs) {
      const client = (sub as any).clients;
      const plan = (sub as any).plans;

      if (!client || client.status !== 'active' || !client.whatsapp_number) {
        continue;
      }

      const planCode = plan?.code;
      let shouldSendToday = false;
      let cadenceText = '';
      let maxAccountsText = '';

      if (planCode === 'super') {
        // Semanal toda segunda-feira
        shouldSendToday = isMonday;
        cadenceText = 'Semanal (Alta Escala)';
        maxAccountsText = 'até 4 contas bancárias';
      } else if (planCode === 'pro') {
        // Semanal toda segunda-feira
        shouldSendToday = isMonday;
        cadenceText = 'Semanal';
        maxAccountsText = 'até 2 contas bancárias';
      } else if (planCode === 'solo' || planCode === 'solo_plus') {
        // Mensal todo dia 1º
        shouldSendToday = isFirstDayOfMonth;
        cadenceText = 'Mensal';
        maxAccountsText = '1 conta bancária';
      }

      if (shouldSendToday) {
        const firstName = client.name ? client.name.split(' ')[0] : 'Empresário(a)';

        const message = `🏦 *Lembrete de Conciliação Bancária — ${plan?.name || 'AnalisAí'}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Olá, *${firstName}*! Hoje é dia de auditar a sua movimentação bancária com a conciliação *${cadenceText}* inclusa no seu plano (*${maxAccountsText}*).

📄 *Como realizar em menos de 1 minuto:*
1️⃣ Acesse o Internet Banking ou App do seu banco;
2️⃣ Exporte o extrato do período recente em formato **PDF ou OFX**;
3️⃣ Envie o arquivo aqui nesta conversa do WhatsApp!

🤖 Nosso robô fará o cruzamento automático de cada débito, tarifa e recebimento contra o seu Livro Caixa, apontando qualquer divergência ou cobrança indevida.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Dúvidas de como exportar no seu banco? Basta perguntar por aqui!`;

        await sendEvolutionText({
          phone: client.whatsapp_number,
          text: message,
        });

        sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      isMonday,
      isFirstDayOfMonth,
    });
  } catch (err: any) {
    console.error('[Bank Reconciliation Cron Catch Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
