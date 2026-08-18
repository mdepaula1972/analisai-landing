// ── Contas a Pagar ────────────────────────────────────────────

export type StatusConta = 'aberto' | 'pago' | 'recebido' | 'atrasado' | 'cancelado';

export interface ContaPagar {
  id: string;
  tenant_id: string;
  descricao: string;
  fornecedor?: string;
  valor: number;
  data_vencimento: string;   // ISO date: '2026-08-20'
  data_pagamento?: string;
  status: StatusConta;
  categoria?: string;
  observacoes?: string;
  upload_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ContaReceber {
  id: string;
  tenant_id: string;
  descricao: string;
  cliente_nome?: string;
  valor: number;
  data_vencimento: string;
  data_recebimento?: string;
  status: StatusConta;
  categoria?: string;
  observacoes?: string;
  upload_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ── DTOs para criação/edição ──────────────────────────────────

export interface CreateContaPagarDTO {
  tenant_id: string;
  descricao: string;
  fornecedor?: string;
  valor: number;
  data_vencimento: string;
  categoria?: string;
  observacoes?: string;
}

export interface CreateContaReceberDTO {
  tenant_id: string;
  descricao: string;
  cliente_nome?: string;
  valor: number;
  data_vencimento: string;
  categoria?: string;
  observacoes?: string;
}

// ── KPIs de Contas ────────────────────────────────────────────

export interface ContasKpiData {
  totalAberto: number;
  totalAtrasado: number;
  totalPagoMes: number;
  quantidadeAberto: number;
  quantidadeAtrasado: number;
}

// ── Filtros ───────────────────────────────────────────────────

export interface ContasFiltros {
  status?: StatusConta[];
  dataInicio?: string;
  dataFim?: string;
  categoria?: string;
  busca?: string;
}

// ── Categorias padrão BPO ─────────────────────────────────────

export const CATEGORIAS_PAGAR = [
  'Aluguel / Imóvel',
  'Folha de Pagamento',
  'Fornecedores',
  'Impostos / Taxas',
  'Serviços / Software',
  'Energia / Utilities',
  'Empréstimos / Financiamentos',
  'Marketing / Publicidade',
  'Outros',
];

export const CATEGORIAS_RECEBER = [
  'Vendas de Produtos',
  'Prestação de Serviços',
  'Aluguéis Recebidos',
  'Comissões',
  'Reembolsos',
  'Outros',
];
