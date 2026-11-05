import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateAdminWebToken } from '@/lib/solo/admin-metrics';
import { collectDailyBpoAudit, dispatchPendingReminders } from '@/lib/solo/bpo-audit';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Validação de Acesso Administrativo para a Torre BPO
 */
async function validateAdminAccess(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const searchParams = req.nextUrl.searchParams;
  const token = searchParams.get('token') || searchParams.get('key') || req.headers.get('x-admin-token');

  // 1. Vercel Cron Secret
  if (cronSecret && (authHeader === `Bearer ${cronSecret}` || token === cronSecret)) {
    return true;
  }

  // 2. Admin Web Token do Marcos (localStorage / cabeçalho x-admin-token)
  try {
    const adminToken = await getOrCreateAdminWebToken();
    if (token && token.trim() === adminToken.trim()) {
      return true;
    }
  } catch (err) {
    console.warn('[Audit Daily Ops] Aviso na verificação de token:', err);
  }

  // 3. Supabase Auth Session
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: client } = await supabase
        .from('clients')
        .select('is_admin')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (client?.is_admin) {
        return true;
      }
    }
  } catch {
    // Falha silenciosa de auth
  }

  return false;
}

/**
 * GET /api/admin/audit-daily-ops
 * Retorna o resumo consolidado para alimentar o semáforo da Torre de Controle:
 * - d0_reminders_expected / d0_reminders_sent
 * - d1_reminders_expected / d1_reminders_sent
 * - documents_pending_review / documents_approved
 * - inconsistencies_flagged
 */
export async function GET(req: NextRequest) {
  try {
    const isAuthorized = await validateAdminAccess(req);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Não autorizado. Forneça o token ou chave administrativa válida.' },
        { status: 401 }
      );
    }

    const summary = await collectDailyBpoAudit();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (err: any) {
    console.error('[Audit Daily Ops GET Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar auditoria matinal.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/audit-daily-ops
 * Permite disparar lembretes pendentes ou carimbar conclusão de turno
 */
export async function POST(req: NextRequest) {
  try {
    const isAuthorized = await validateAdminAccess(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'dispatch_reminders') {
      const result = await dispatchPendingReminders(body.billIds);
      const updatedSummary = await collectDailyBpoAudit();
      return NextResponse.json({ success: true, result, summary: updatedSummary });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err: any) {
    console.error('[Audit Daily Ops POST Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao executar ação administrativa.' },
      { status: 500 }
    );
  }
}
