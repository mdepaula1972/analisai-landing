import { supabase } from '@/lib/supabase';
import type {
  DreLancamento, DreFilters, DreCalculatedResult, DreKpis, DreMensal,
  DreStructureItem, DEFAULT_DRE_ESTRUTURA
} from '@/types/dre';

// ── Leitura de Lançamentos ────────────────────────────────────

export async function listarLancamentos(
  tenantId: string,
  filtros?: DreFilters
): Promise<DreLancamento[]> {
  let query = supabase
    .from('dre_lancamentos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'publicado')
    .order('periodo', { ascending: true });

  if (filtros?.periodos?.length) {
    query = query.in('periodo', filtros.periodos);
  }
  if (filtros?.tipos?.length) {
    query = query.in('tipo', filtros.tipos);
  }
  if (filtros?.departamentos?.length) {
    query = query.in('departamento', filtros.departamentos);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DreLancamento[];
}

// ── Metadados (períodos, contas disponíveis) ──────────────────

export async function getMetadados(tenantId: string) {
  const { data, error } = await supabase
    .from('dre_lancamentos')
    .select('periodo, conta_dre, departamento, tipo')
    .eq('tenant_id', tenantId)
    .eq('status', 'publicado');

  if (error) throw error;

  const periodos = [...new Set((data || []).map(r => r.periodo))].sort();
  const contas = [...new Set((data || []).map(r => r.conta_dre))].sort();
  const departamentos = [...new Set((data || []).map(r => r.departamento))].sort();

  return { periodos, contas, departamentos };
}

// ── Motor de Cálculo DRE ──────────────────────────────────────

export function calcularDre(
  lancamentos: DreLancamento[],
  estrutura: DreStructureItem[]
): DreCalculatedResult {
  // 1. Agrupar valores: conta_dre → periodo → soma
  const porContaPeriodo: Record<string, Record<string, number>> = {};

  for (const l of lancamentos) {
    if (!porContaPeriodo[l.conta_dre]) porContaPeriodo[l.conta_dre] = {};
    const sinal = l.tipo === 'receita' ? 1 : -1;
    porContaPeriodo[l.conta_dre][l.periodo] =
      (porContaPeriodo[l.conta_dre][l.periodo] || 0) + l.valor * sinal;
  }

  // 2. Períodos disponíveis
  const periodos = [...new Set(lancamentos.map(l => l.periodo))].sort();

  // 3. Mensal: por estrutura, agrupa contas
  const mensal: DreMensal = {};

  for (const item of estrutura) {
    if (item.tipo === 'divisor' || !item.contas) continue;

    mensal[item.titulo] = {};
    for (const periodo of periodos) {
      let soma = 0;
      for (const conta of item.contas) {
        soma += porContaPeriodo[conta]?.[periodo] || 0;
      }
      mensal[item.titulo][periodo] = soma;
    }
  }

  // 4. KPIs agregados (soma de todos os períodos)
  const agg = (titulo: string) =>
    periodos.reduce((s, p) => s + (mensal[titulo]?.[p] || 0), 0);

  const receitaBruta = agg('Receita Bruta de Vendas') + agg('Receita de Serviços');
  const deducoes = Math.abs(agg('Deduções e Impostos s/ Vendas'));
  const receitaLiquida = receitaBruta - deducoes;
  const custos = Math.abs(agg('Custos de Produção / CPV'));
  const margemBruta = receitaLiquida - custos;

  // Soma todas as despesas operacionais
  const despesaItems = estrutura.filter(i =>
    i.titulo.toLowerCase().includes('despesa') && i.tipo === 'linha'
  );
  const despesasOperacionais = despesaItems.reduce((s, item) => s + Math.abs(agg(item.titulo)), 0);
  const ebitda = margemBruta - despesasOperacionais;
  const investimentos = Math.abs(agg('Investimentos e Depreciação'));
  const resultadoLiquido = ebitda - investimentos;

  const percOf = (v: number, base: number) => base !== 0 ? (v / base) * 100 : 0;

  const kpis: DreKpis = {
    receitaBruta,
    deducoes,
    receitaLiquida,
    custos,
    margemBruta,
    despesasOperacionais,
    ebitda,
    investimentos,
    resultadoLiquido,
    margemBrutaPerc: percOf(margemBruta, receitaLiquida),
    ebitdaPerc: percOf(ebitda, receitaLiquida),
    resultadoPerc: percOf(resultadoLiquido, receitaLiquida),
  };

  return { kpis, mensal, periodos, lancamentosCount: lancamentos.length };
}
