import { NextRequest, NextResponse } from 'next/server';
import { collectAdminMetrics, getOrCreateAdminWebToken } from '@/lib/solo/admin-metrics';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token') || req.headers.get('x-admin-token');

    const expectedToken = await getOrCreateAdminWebToken();

    // Validação de token de segurança
    if (!token || token.trim() !== expectedToken.trim()) {
      return NextResponse.json(
        { error: 'Não autorizado. Token de administrador inválido ou ausente.' },
        { status: 401 }
      );
    }

    const metrics = await collectAdminMetrics();
    return NextResponse.json({ success: true, metrics });
  } catch (err: any) {
    console.error('[Admin Metrics API Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao coletar métricas administrativas.' },
      { status: 500 }
    );
  }
}
