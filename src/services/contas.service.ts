import { supabase } from '@/lib/supabase';
import type {
  ContaPagar, ContaReceber, ContasKpiData, ContasFiltros,
  CreateContaPagarDTO, CreateContaReceberDTO, StatusConta
} from '@/types/contas';

// ── CONTAS A PAGAR ────────────────────────────────────────────

export async function listarContasPagar(
  tenantId: string,
  filtros?: ContasFiltros
): Promise<ContaPagar[]> {
  let query = supabase
    .from('contas_pagar')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data_vencimento', { ascending: true });

  if (filtros?.status?.length) {
    query = query.in('status', filtros.status);
  }
  if (filtros?.dataInicio) {
    query = query.gte('data_vencimento', filtros.dataInicio);
  }
  if (filtros?.dataFim) {
    query = query.lte('data_vencimento', filtros.dataFim);
  }
  if (filtros?.categoria) {
    query = query.eq('categoria', filtros.categoria);
  }
  if (filtros?.busca) {
    query = query.or(`descricao.ilike.%${filtros.busca}%,fornecedor.ilike.%${filtros.busca}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ContaPagar[];
}

export async function criarContaPagar(dto: CreateContaPagarDTO): Promise<ContaPagar> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .insert(dto)
    .select()
    .single();
  if (error) throw error;
  return data as ContaPagar;
}

export async function atualizarContaPagar(
  id: string,
  updates: Partial<ContaPagar>
): Promise<ContaPagar> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ContaPagar;
}

export async function marcarComoPago(id: string): Promise<void> {
  const { error } = await supabase
    .from('contas_pagar')
    .update({
      status: 'pago' as StatusConta,
      data_pagamento: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function excluirContaPagar(id: string): Promise<void> {
  const { error } = await supabase.from('contas_pagar').delete().eq('id', id);
  if (error) throw error;
}

// ── CONTAS A RECEBER ──────────────────────────────────────────

export async function listarContasReceber(
  tenantId: string,
  filtros?: ContasFiltros
): Promise<ContaReceber[]> {
  let query = supabase
    .from('contas_receber')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data_vencimento', { ascending: true });

  if (filtros?.status?.length) {
    query = query.in('status', filtros.status);
  }
  if (filtros?.dataInicio) {
    query = query.gte('data_vencimento', filtros.dataInicio);
  }
  if (filtros?.dataFim) {
    query = query.lte('data_vencimento', filtros.dataFim);
  }
  if (filtros?.busca) {
    query = query.or(`descricao.ilike.%${filtros.busca}%,cliente_nome.ilike.%${filtros.busca}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ContaReceber[];
}

export async function criarContaReceber(dto: CreateContaReceberDTO): Promise<ContaReceber> {
  const { data, error } = await supabase
    .from('contas_receber')
    .insert(dto)
    .select()
    .single();
  if (error) throw error;
  return data as ContaReceber;
}

export async function marcarComoRecebido(id: string): Promise<void> {
  const { error } = await supabase
    .from('contas_receber')
    .update({
      status: 'recebido' as StatusConta,
      data_recebimento: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function excluirContaReceber(id: string): Promise<void> {
  const { error } = await supabase.from('contas_receber').delete().eq('id', id);
  if (error) throw error;
}

// ── KPIs ──────────────────────────────────────────────────────

export async function getContasKpis(tenantId: string): Promise<{
  pagar: ContasKpiData;
  receber: ContasKpiData;
}> {
  const hoje = new Date().toISOString().split('T')[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];

  const [{ data: cp }, { data: cr }] = await Promise.all([
    supabase.from('contas_pagar').select('valor, status, data_vencimento, data_pagamento').eq('tenant_id', tenantId),
    supabase.from('contas_receber').select('valor, status, data_vencimento, data_recebimento').eq('tenant_id', tenantId),
  ]);

  const calcKpi = (rows: any[], pagoField: string, pagoDateField: string): ContasKpiData => {
    const aberto = rows?.filter(r => r.status === 'aberto') || [];
    const atrasado = rows?.filter(r => r.status === 'atrasado' || (r.status === 'aberto' && r.data_vencimento < hoje)) || [];
    const pagoMes = rows?.filter(r => r.status === pagoField && r[pagoDateField] >= inicioMes) || [];

    return {
      totalAberto: aberto.reduce((s, r) => s + Number(r.valor), 0),
      totalAtrasado: atrasado.reduce((s, r) => s + Number(r.valor), 0),
      totalPagoMes: pagoMes.reduce((s, r) => s + Number(r.valor), 0),
      quantidadeAberto: aberto.length,
      quantidadeAtrasado: atrasado.length,
    };
  };

  return {
    pagar: calcKpi(cp || [], 'pago', 'data_pagamento'),
    receber: calcKpi(cr || [], 'recebido', 'data_recebimento'),
  };
}
