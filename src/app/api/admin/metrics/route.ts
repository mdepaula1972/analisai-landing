import { NextRequest, NextResponse } from 'next/server';
import { collectAdminMetrics, getOrCreateAdminWebToken } from '@/lib/solo/admin-metrics';
import { isMasterPhone } from '@/lib/solo/master-auth';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token') || searchParams.get('phone') || req.headers.get('x-admin-token');

    const expectedToken = await getOrCreateAdminWebToken();

    // Validação de token de segurança com bypass para o telefone master do Marcos
    const isAuthorized =
      isMasterPhone(token) ||
      isMasterPhone(searchParams.get('phone')) ||
      (token && token.trim() === expectedToken.trim());

    if (!isAuthorized) {
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
