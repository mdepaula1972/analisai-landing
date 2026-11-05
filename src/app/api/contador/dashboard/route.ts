import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { getOrCreateAdminWebToken } from '@/lib/solo/admin-metrics';
import { isMasterPhone } from '@/lib/solo/master-auth';
import type { AccountantOffice } from '@/types/bpo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AccountantDashboardResponse {
  office: AccountantOffice;
  metrics: {
    total_active_clients: number;
    closed_current_month: number;
    total_monthly_commission: number;
    commission_rate: number;
  };
  clients: Array<{
    id: string;
    company_name: string;
    trade_name?: string;
    cnpj_cpf: string;
    service_tier: string;
    monthly_fee: number;
    commission_amount: number;
    last_conciliation_at: string | null;
    status_fechamento: 'fechado' | 'em_andamento' | 'pendente_documentos';
    open_bills_count: number;
    unattached_docs_count: number;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const officeIdentifier =
      searchParams.get('office_id') ||
      searchParams.get('phone') ||
      searchParams.get('email') ||
      req.headers.get('x-office-id');

    const adminToken = searchParams.get('token') || searchParams.get('key');
    const systemAdminToken = await getOrCreateAdminWebToken();
    const isMaster =
      isMasterPhone(officeIdentifier) ||
      isMasterPhone(adminToken) ||
      isMasterPhone(searchParams.get('phone')) ||
      officeIdentifier === 'master-admin-office';

    const isAdmin = isMaster || (adminToken && (adminToken.trim() === systemAdminToken.trim() || adminToken === process.env.CRON_SECRET));

    const supabase = createServiceRoleClient();

    // ── 1. LOCALIZAÇÃO DO ESCRITÓRIO CONTÁBIL ─────────────────────────
    let office: AccountantOffice | null = null;

    if (isMaster) {
      office = {
        id: 'master-admin-office',
        name: 'Diretoria Geral BPO (Marcos)',
        contact_name: 'Marcos Antonio de Paula',
        email: 'contato@analisai.me',
        phone: '5514930855878',
        crc_number: 'ADMIN-MASTER',
        commission_rate: 100.0,
        pix_key: '14930855878',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // A) Busca na tabela accountant_offices
    try {
      let query = supabase.from('accountant_offices').select('*');
      if (officeIdentifier) {
        query = query.or(`id.eq.${officeIdentifier},phone.eq.${officeIdentifier},email.eq.${officeIdentifier}`);
      }
      const { data: offices } = await query.limit(1);
      if (offices && offices.length > 0) {
        office = offices[0] as AccountantOffice;
      }
    } catch {
      // Tabela pode não estar pronta
    }

    // B) Fallback para bot_config se não encontrou
    if (!office) {
      const { data: seedRow } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'bpo_seed_accountant_office')
        .maybeSingle();

      if (seedRow?.value) {
        try {
          office = JSON.parse(seedRow.value);
        } catch {}
      }
    }

    // Se ainda não tiver escritório e for admin, define o modelo padrão
    if (!office && (isAdmin || !officeIdentifier)) {
      office = {
        id: 'seed-office-modelo-01',
        name: 'Escritório Modelo Contabilidade',
        contact_name: 'Contador Parceiro Teste',
        email: 'contato@escritoriomodelo.com.br',
        phone: '5511988887777',
        crc_number: 'SP-123456/O',
        commission_rate: 10.0,
        pix_key: 'contato@escritoriomodelo.com.br',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    if (!office) {
      return NextResponse.json(
        { error: 'Escritório contábil não localizado. Verifique os dados de acesso.' },
        { status: 404 }
      );
    }

    // ── 2. BUSCA DE CLIENTES VINCULADOS AO ESCRITÓRIO ─────────────────
    // Busca por accountant_office_id, ou por nome/telefone do contador
    const { data: clientsData, error: clientsErr } = await supabase
      .from('clients')
      .select('id, name, company_name, tax_id, whatsapp_number, status, service_tier, monthly_fee, accountant_name, accountant_phone, created_at')
      .eq('status', 'active');

    if (clientsErr) {
      console.warn('[Contador Dashboard] Erro ao consultar clients:', clientsErr.message);
    }

    const allClients = clientsData || [];

    // Filtra clientes vinculados a este escritório ou, se for parceiro modelo/admin, todos da carteira
    const partnerClients = allClients.filter((c: any) => {
      if (isAdmin) return true;
      if (c.accountant_office_id === office!.id) return true;
      if (c.accountant_name && office!.name && c.accountant_name.toLowerCase().includes(office!.name.toLowerCase().slice(0, 8))) return true;
      if (c.accountant_phone && office!.phone && c.accountant_phone.replace(/\D/g, '') === office!.phone.replace(/\D/g, '')) return true;
      return false;
    });

    const clientIds = partnerClients.map((c) => c.id);

    // ── 3. DATA DA ÚLTIMA CONCILIAÇÃO & CONTAS A PAGAR/RECEBER ────────
    const { data: lastLedger } = await supabase
      .from('cash_ledger_entries')
      .select('client_id, entry_date, created_at')
      .in('client_id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])
      .order('entry_date', { ascending: false });

    const lastConciliationMap = new Map<string, string>();
    for (const entry of lastLedger || []) {
      if (!lastConciliationMap.has(entry.client_id)) {
        lastConciliationMap.set(entry.client_id, entry.entry_date);
      }
    }

    // Busca histórico de fechamentos mensais
    const { data: closings } = await supabase
      .from('monthly_closings')
      .select('client_id, competence_period, sent_to_accountant_at')
      .in('client_id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000']);

    const closingsMap = new Map<string, boolean>();
    for (const cl of closings || []) {
      closingsMap.set(cl.client_id, true);
    }

    // Busca documentos pendentes de conciliação
    const { data: pendingDocs } = await supabase
      .from('documents')
      .select('client_id, status')
      .in('client_id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])
      .neq('status', 'processed');

    const pendingDocsMap = new Map<string, number>();
    for (const d of pendingDocs || []) {
      const current = pendingDocsMap.get(d.client_id) || 0;
      pendingDocsMap.set(d.client_id, current + 1);
    }

    // ── 4. CÁLCULO DAS MÉTRICAS CONSOLIDADAS ──────────────────────────
    const commRate = Number(office.commission_rate) || 10.0;
    let totalCommission = 0;
    let closedCount = 0;

    const formattedClients = partnerClients.map((c: any) => {
      const fee = Number(c.monthly_fee) || 297.0; // Mensalidade base se não definida
      const clientComm = (fee * commRate) / 100;
      totalCommission += clientComm;

      const isClosed = closingsMap.get(c.id) || false;
      const unattachedCount = pendingDocsMap.get(c.id) || 0;

      if (isClosed) {
        closedCount++;
      }

      let statusFechamento: 'fechado' | 'em_andamento' | 'pendente_documentos' = 'em_andamento';
      if (isClosed) {
        statusFechamento = 'fechado';
      } else if (unattachedCount > 0) {
        statusFechamento = 'pendente_documentos';
      }

      // Formata CPF / CNPJ
      const cleanTax = (c.tax_id || '').replace(/\D/g, '');
      let formattedTax = c.tax_id || '—';
      if (cleanTax.length === 14) {
        formattedTax = cleanTax.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      } else if (cleanTax.length === 11) {
        formattedTax = cleanTax.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
      }

      return {
        id: c.id,
        company_name: c.company_name || c.name || 'Cliente BPO',
        trade_name: c.name,
        cnpj_cpf: formattedTax,
        service_tier: c.service_tier || 'bpo_gestao',
        monthly_fee: fee,
        commission_amount: clientComm,
        last_conciliation_at: lastConciliationMap.get(c.id) || null,
        status_fechamento: statusFechamento,
        open_bills_count: 0,
        unattached_docs_count: unattachedCount,
      };
    });

    const responseData: AccountantDashboardResponse = {
      office,
      metrics: {
        total_active_clients: partnerClients.length,
        closed_current_month: closedCount,
        total_monthly_commission: totalCommission,
        commission_rate: commRate,
      },
      clients: formattedClients,
    };

    return NextResponse.json({ success: true, ...responseData });
  } catch (err: any) {
    console.error('[Contador Dashboard Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar dados do escritório contábil.' },
      { status: 500 }
    );
  }
}

