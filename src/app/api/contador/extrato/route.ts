import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const clientId = searchParams.get('client_id');
    const period = searchParams.get('period'); // YYYY-MM

    if (!clientId) {
      return NextResponse.json({ error: 'client_id é obrigatório.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Busca cliente
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, company_name, tax_id')
      .eq('id', clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Cliente não localizado.' }, { status: 404 });
    }

    // Filtro de data
    let query = supabase
      .from('cash_ledger_entries')
      .select('id, entry_date, description, amount, entry_type, dre_group, status')
      .eq('client_id', clientId)
      .order('entry_date', { ascending: false });

    if (period && period.includes('-')) {
      const [year, month] = period.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const start = `${period}-01`;
      const end = `${period}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('entry_date', start).lte('entry_date', end);
    }

    const { data: entries, error } = await query.limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      client,
      entries: entries || [],
    });
  } catch (err: any) {
    console.error('[Contador Extrato Error]:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao carregar extrato.' }, { status: 500 });
  }
}
