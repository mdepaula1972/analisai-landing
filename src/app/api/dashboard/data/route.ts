import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { validateDashboardToken } from '@/lib/solo/dashboard-auth';
import { getTaxRevenueTracking } from '@/lib/solo/tax-meter';
import { getTrialBills } from '@/lib/solo/trial';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryToken = searchParams.get('token');
    
    // Suporte a cookie ou header Authorization
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('analisai_dash_token')?.value;
    const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const effectiveToken = queryToken || cookieToken || authHeader;

    if (!effectiveToken) {
      return NextResponse.json(
        { error: 'Acesso não autenticado. Solicite seu link seguro digitando "painel" no WhatsApp.' },
        { status: 401 }
      );
    }

    const auth = await validateDashboardToken(effectiveToken);
    if (!auth.valid) {
      return NextResponse.json(
        { error: 'Link de acesso expirado ou inválido. Solicite um novo link no WhatsApp enviando a palavra "painel".' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();
    const isOperator = auth.role === 'operator';
    const isTrial = auth.isTrial || !auth.clientId;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Calcula range da semana corrente
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayDate = new Date(today);
    mondayDate.setDate(today.getDate() + mondayOffset);
    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);
    const mondayStr = mondayDate.toISOString().split('T')[0];
    const sundayStr = sundayDate.toISOString().split('T')[0];

    // Range do mês corrente
    const firstDayMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDayObj = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const lastDayMonthStr = lastDayObj.toISOString().split('T')[0];

    // ── CENÁRIO 1: ASSINANTE / CLIENTE CADASTRADO ────────────────────────
    if (!isTrial && auth.clientId) {
      const clientId = auth.clientId;

      // 1. Contas a pagar e receber (Abertas, Vencidas e Pagas recentes)
      const { data: billsRaw } = await supabase
        .from('payables_receivables')
        .select('id, counterparty_name, amount, original_due_date, current_due_date, status, type, barcode_or_pix, is_provision, created_at')
        .eq('client_id', clientId)
        .order('current_due_date', { ascending: true })
        .limit(100);

      const bills = billsRaw || [];

      // 2. Lançamentos realizados no Livro Caixa
      const { data: ledgerRaw } = await supabase
        .from('cash_ledger_entries')
        .select('id, entry_date, description, amount, entry_type, dre_group, status')
        .eq('client_id', clientId)
        .gte('entry_date', firstDayMonthStr)
        .lte('entry_date', lastDayMonthStr)
        .order('entry_date', { ascending: true });

      const ledger = ledgerRaw || [];

      // Cálculos da semana e do mês
      const openPayables = bills.filter((b: any) => b.type === 'payable' && b.status === 'open');
      const openReceivables = bills.filter((b: any) => b.type === 'receivable' && b.status === 'open');

      const weekBills = bills.filter((b: any) => b.current_due_date >= mondayStr && b.current_due_date <= sundayStr);
      const totalWeekPayable = weekBills
        .filter((b: any) => b.type === 'payable' && b.status === 'open')
        .reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);

      const totalMonthPayable = openPayables
        .filter((b: any) => b.current_due_date >= firstDayMonthStr && b.current_due_date <= lastDayMonthStr)
        .reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);

      const totalMonthReceivable = openReceivables
        .filter((b: any) => b.current_due_date >= firstDayMonthStr && b.current_due_date <= lastDayMonthStr)
        .reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);

      const overdueBills = openPayables.filter((b: any) => b.current_due_date < todayStr);
      const totalOverdue = overdueBills.reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);

      // Total de saídas e entradas realizadas no mês (Livro Caixa)
      const realizedIncomeMonth = ledger
        .filter((l: any) => l.entry_type === 'income' && l.status === 'realizado')
        .reduce((sum: number, l: any) => sum + Math.abs(Number(l.amount || 0)), 0);

      const realizedExpenseMonth = ledger
        .filter((l: any) => l.entry_type === 'expense' && l.status === 'realizado')
        .reduce((sum: number, l: any) => sum + Math.abs(Number(l.amount || 0)), 0);

      // Gráficos por categoria DRE
      const categoryMap: Record<string, number> = {};
      ledger.forEach((l: any) => {
        if (l.entry_type === 'expense') {
          const group = l.dre_group || 'outros';
          categoryMap[group] = (categoryMap[group] || 0) + Math.abs(Number(l.amount || 0));
        }
      });
      // Também adiciona provisões do Contas a Pagar se não houver registros suficientes no ledger
      if (Object.keys(categoryMap).length === 0) {
        openPayables.forEach((b: any) => {
          const cat = 'Fornecedores';
          categoryMap[cat] = (categoryMap[cat] || 0) + Number(b.amount || 0);
        });
      }

      const categoriesChartData = Object.entries(categoryMap).map(([name, value]) => ({
        name: formatCategoryLabel(name),
        value: Math.round(value * 100) / 100,
      }));

      // Termômetro Fiscal
      let taxMeter = null;
      try {
        const tracking = await getTaxRevenueTracking({ clientId });
        taxMeter = {
          regime: tracking.taxRegimeName,
          annualLimit: tracking.annualLimit,
          currentRevenue: tracking.totalRevenueYear,
          percentage: tracking.percentageUsed,
          status:
            tracking.riskLevel === 'red'
              ? 'perigo'
              : tracking.riskLevel === 'yellow' || tracking.riskLevel === 'orange'
              ? 'atencao'
              : 'tranquilo',
          remainingSafetyMargin: tracking.remainingSafetyMargin,
          warningMessage: tracking.statusMessage,
        };
      } catch (err) {
        console.warn('[Dashboard API] Erro ao buscar tax meter:', err);
      }

      // Restrição de Sigilo para Membros de Equipe (Operador)
      if (isOperator) {
        return NextResponse.json({
          user: {
            name: auth.client?.name || 'Empresa',
            companyName: auth.client?.company_name || 'Empresa',
            role: 'operator',
            isTrial: false,
          },
          summary: {
            weekBillsCount: weekBills.length,
            openPayablesCount: openPayables.length,
            overdueCount: overdueBills.length,
            // Valores monetários sensíveis ofuscados para operadores
            isRestrictedView: true,
          },
          bills: weekBills.map((b: any) => ({
            id: b.id,
            counterparty_name: b.counterparty_name,
            amount: b.amount,
            current_due_date: b.current_due_date,
            status: b.status,
            type: b.type,
            barcode_or_pix: b.barcode_or_pix,
          })),
        });
      }

      // Resposta completa para o Titular (Admin)
      return NextResponse.json({
        user: {
          id: auth.clientId,
          name: auth.client?.name || 'Cliente',
          companyName: auth.client?.company_name || auth.client?.name || 'Sua Empresa',
          taxId: auth.client?.tax_id,
          taxType: auth.client?.tax_type,
          role: 'admin',
          isTrial: false,
        },
        summary: {
          totalWeekPayable: Math.round(totalWeekPayable * 100) / 100,
          totalMonthPayable: Math.round(totalMonthPayable * 100) / 100,
          totalMonthReceivable: Math.round(totalMonthReceivable * 100) / 100,
          totalOverdue: Math.round(totalOverdue * 100) / 100,
          realizedIncomeMonth: Math.round(realizedIncomeMonth * 100) / 100,
          realizedExpenseMonth: Math.round(realizedExpenseMonth * 100) / 100,
          netBalanceMonth: Math.round((realizedIncomeMonth - realizedExpenseMonth) * 100) / 100,
          overdueCount: overdueBills.length,
          weekBillsCount: weekBills.length,
          openPayablesCount: openPayables.length,
        },
        dates: {
          today: todayStr,
          monday: mondayStr,
          sunday: sundayStr,
          monthStart: firstDayMonthStr,
          monthEnd: lastDayMonthStr,
        },
        bills: bills.map((b: any) => ({
          id: b.id,
          counterparty_name: b.counterparty_name,
          amount: Number(b.amount),
          current_due_date: b.current_due_date,
          status: b.status,
          type: b.type,
          barcode_or_pix: b.barcode_or_pix,
          is_provision: Boolean(b.is_provision),
        })),
        categoriesChart: categoriesChartData,
        taxMeter,
      });
    }

    // ── CENÁRIO 2: DEGUSTAÇÃO GRATUITA (TRIAL LEAD) ─────────────────────
    const trialBills = await getTrialBills(auth.phoneNumber || '');
    const validTrialBills = trialBills.map((b: any) => ({
      id: b.id,
      counterparty_name: b.supplier_name || 'Fornecedor',
      amount: Number(b.amount || 0),
      current_due_date: b.due_date,
      status: b.is_paid ? 'paid' : (b.due_date < todayStr ? 'overdue' : 'open'),
      type: b.entry_type || 'payable',
      barcode_or_pix: b.barcode_or_pix,
      is_provision: Boolean(b.is_provision),
    }));

    const totalPayable = validTrialBills
      .filter((b: any) => b.type === 'payable' && b.status !== 'paid')
      .reduce((s: number, b: any) => s + b.amount, 0);

    const totalReceivable = validTrialBills
      .filter((b: any) => b.type === 'receivable' && b.status !== 'paid')
      .reduce((s: number, b: any) => s + b.amount, 0);

    const categoriesChart = validTrialBills
      .filter((b: any) => b.type === 'payable')
      .map((b: any) => ({
        name: b.counterparty_name,
        value: b.amount,
      }));

    return NextResponse.json({
      user: {
        name: 'Degustação AnalisAí',
        companyName: 'Minha Empresa (Degustação)',
        role: 'admin',
        isTrial: true,
      },
      summary: {
        totalWeekPayable: Math.round(totalPayable * 100) / 100,
        totalMonthPayable: Math.round(totalPayable * 100) / 100,
        totalMonthReceivable: Math.round(totalReceivable * 100) / 100,
        totalOverdue: 0,
        realizedIncomeMonth: 0,
        realizedExpenseMonth: 0,
        netBalanceMonth: Math.round((totalReceivable - totalPayable) * 100) / 100,
        overdueCount: 0,
        weekBillsCount: validTrialBills.length,
        openPayablesCount: validTrialBills.length,
      },
      dates: {
        today: todayStr,
        monday: mondayStr,
        sunday: sundayStr,
      },
      bills: validTrialBills,
      categoriesChart,
      taxMeter: null,
    });
  } catch (error: any) {
    console.error('[Dashboard Data Error]:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar dados do painel financeiro.' },
      { status: 500 }
    );
  }
}

function formatCategoryLabel(raw: string): string {
  const map: Record<string, string> = {
    despesa_administrativa: 'Administrativo',
    receita_operacional: 'Receitas',
    fornecedores: 'Fornecedores',
    fornecedor: 'Fornecedores',
    energia: 'Energia Elétrica',
    agua_saneamento: 'Água e Esgoto',
    telecomunicacoes: 'Internet e Telefone',
    pessoal: 'Equipe / Folha',
    impostos: 'Impostos e DAS',
    aluguel: 'Aluguel / Imóvel',
    outros: 'Outros',
  };
  return map[raw.toLowerCase()] || raw.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
