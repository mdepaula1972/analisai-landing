import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { getOrCreateAdminWebToken } from '@/lib/solo/admin-metrics';
import type { DailyBpoAudit } from '@/types/bpo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token') || searchParams.get('key') || req.headers.get('x-admin-token');
    const adminToken = await getOrCreateAdminWebToken();
    const cronSecret = process.env.CRON_SECRET;

    if (!token || (token.trim() !== adminToken.trim() && token !== cronSecret)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const audits: DailyBpoAudit[] = [];

    // 1. Tenta buscar da tabela daily_bpo_audits
    try {
      const { data, error } = await supabase
        .from('daily_bpo_audits')
        .select('*')
        .order('audit_date', { ascending: false })
        .limit(30);

      if (!error && data && data.length > 0) {
        audits.push(...data);
      }
    } catch {
      // Tabela pode não estar criada ainda
    }

    // 2. Se a tabela não tiver dados ou falhar, busca snapshots em bot_config
    if (audits.length === 0) {
      const { data: configRows } = await supabase
        .from('bot_config')
        .select('key, value, updated_at')
        .like('key', 'daily_bpo_audit_%')
        .order('updated_at', { ascending: false })
        .limit(30);

      for (const row of configRows || []) {
        try {
          const parsed = JSON.parse(row.value);
          if (parsed && parsed.audit_date) {
            audits.push(parsed);
          }
        } catch {}
      }
    }

    return NextResponse.json({ success: true, audits });
  } catch (err: any) {
    console.error('[BPO Audit History Error]:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao carregar histórico.' }, { status: 500 });
  }
}
