import { NextRequest, NextResponse } from 'next/server';
import { processTrialReminders } from '@/lib/solo/trial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Se CRON_SECRET estiver configurado, valida a autorização
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const urlKey = req.nextUrl.searchParams.get('key');
      if (urlKey !== cronSecret) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    console.log('[Cron Trial Reminders] Iniciando processamento da agenda diária às 10h...');
    const result = await processTrialReminders();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      dispatched: result,
    });
  } catch (error: any) {
    console.error('[Cron Trial Reminders] Erro no processamento:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
