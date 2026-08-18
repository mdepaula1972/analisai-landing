// ── DRE Types (adaptado do Dashboard) ─────────────────────────

export interface DreFilters {
  periodos: string[];
  tipos?: string[];
  departamentos?: string[];
  contasDre?: string[];
}

export interface DreLancamento {
  id: string;
  tenant_id: string;
  periodo: string;         // 'Jan/26'
  conta_dre: string;       // 'Receita Operacional'
  departamento: string;
  projeto?: string;
  valor: number;
  tipo: 'receita' | 'custo' | 'despesa' | 'investimento';
  descricao?: string;
  status: 'rascunho' | 'revisao' | 'publicado';
  upload_id?: string;
  created_at: string;
}

export interface DreKpis {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custos: number;
  margemBruta: number;
  despesasOperacionais: number;
  ebitda: number;
  investimentos: number;
  resultadoLiquido: number;
  // Percentuais
  margemBrutaPerc: number;
  ebitdaPerc: number;
  resultadoPerc: number;
}

export interface DreMensal {
  [contaDre: string]: {
    [periodo: string]: number;
  };
}

export interface DreCalculatedResult {
  kpis: DreKpis;
  mensal: DreMensal;
  periodos: string[];      // períodos disponíveis ordenados
  lancamentosCount: number;
}

// Estrutura do DRE para renderização
export interface DreStructureItem {
  titulo: string;
  tipo: 'linha' | 'card' | 'divisor' | 'linha_calc';
  contas?: string[];    // contas_dre que somam nessa linha
  formula?: string;     // expressão para linhas calculadas
  var?: string;         // variável (nome da propriedade em DreKpis)
  isPositivo?: boolean; // para coloração (true = verde quando positivo)
}

// Estrutura padrão DRE para BPO
export const DEFAULT_DRE_ESTRUTURA: DreStructureItem[] = [
  { titulo: 'RECEITAS', tipo: 'divisor' },
  { titulo: 'Receita Bruta de Vendas', tipo: 'linha', contas: ['Receita Operacional', 'Receita de Serviços', 'Receita Bruta'] },
  { titulo: 'Deduções e Impostos s/ Vendas', tipo: 'linha', contas: ['Impostos', 'Deduções', 'Devolucoes'] },
  { titulo: 'Receita Líquida', tipo: 'card', var: 'receitaLiquida', isPositivo: true },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'CUSTOS', tipo: 'divisor' },
  { titulo: 'Custos de Produção / CPV', tipo: 'linha', contas: ['Custos', 'CPV', 'CMV', 'Custo de Produtos'] },
  { titulo: 'Margem Bruta', tipo: 'card', var: 'margemBruta', isPositivo: true },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'DESPESAS OPERACIONAIS', tipo: 'divisor' },
  { titulo: 'Despesas com Pessoal', tipo: 'linha', contas: ['Pessoal', 'Folha', 'Salários', 'Encargos'] },
  { titulo: 'Despesas Administrativas', tipo: 'linha', contas: ['Administrativo', 'Aluguel', 'Escritório'] },
  { titulo: 'Despesas Comerciais / Marketing', tipo: 'linha', contas: ['Comercial', 'Marketing', 'Publicidade'] },
  { titulo: 'Despesas Financeiras', tipo: 'linha', contas: ['Financeiro', 'Juros', 'Tarifas Bancárias'] },
  { titulo: 'Outras Despesas', tipo: 'linha', contas: ['Outras Despesas'] },
  { titulo: 'EBITDA', tipo: 'card', var: 'ebitda', isPositivo: true },
  { titulo: '', tipo: 'divisor' },
  { titulo: 'INVESTIMENTOS / D&A', tipo: 'divisor' },
  { titulo: 'Investimentos e Depreciação', tipo: 'linha', contas: ['Investimentos', 'Depreciação', 'Amortização'] },
  { titulo: 'RESULTADO LÍQUIDO', tipo: 'card', var: 'resultadoLiquido', isPositivo: true },
];

// Upload com extração IA
export interface UploadRecord {
  id: string;
  tenant_id: string;
  tipo: 'imagem' | 'audio' | 'pdf' | 'planilha';
  storage_path: string;
  nome_original?: string;
  status: 'processando' | 'revisao' | 'concluido' | 'erro';
  ia_extracao?: IaExtracaoResult;
  erro_msg?: string;
  created_at: string;
}

export interface IaExtracaoResult {
  descricao?: string;
  valor?: number;
  data?: string;
  fornecedor_ou_cliente?: string;
  tipo?: 'pagar' | 'receber' | 'dre';
  conta_dre?: string;
  categoria?: string;
  periodo?: string;
  observacoes?: string;
  confianca?: number;
}
