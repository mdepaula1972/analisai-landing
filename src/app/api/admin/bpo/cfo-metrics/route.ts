import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateAdminWebToken } from '@/lib/solo/admin-metrics';
import {
  auditPersonalExpenseLeak,
  calculateAvoidedInterest,
  predictCashTightness,
} from '@/lib/solo/cfo-strategy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const clientId = searchParams.get('client_id');
    const token = searchParams.get('token') || searchParams.get('key') || req.headers.get('x-admin-token');

    const adminToken = await getOrCreateAdminWebToken();
    const cronSecret = process.env.CRON_SECRET;

    if (!token || (token.trim() !== adminToken.trim() && token !== cronSecret)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!clientId) {
      return NextResponse.json({ error: 'client_id é obrigatório' }, { status: 400 });
    }

    // Coleta as 3 análises CFO
    const [pfLeak, avoidedInterest, cashTightness] = await Promise.all([
      auditPersonalExpenseLeak(clientId),
      calculateAvoidedInterest(clientId),
      predictCashTightness(clientId),
    ]);

    return NextResponse.json({
      success: true,
      clientId,
      pfLeak,
      avoidedInterest,
      cashTightness,
    });
  } catch (err: any) {
    console.error('[CFO Metrics API Error]:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao calcular métricas CFO.' }, { status: 500 });
  }
}
