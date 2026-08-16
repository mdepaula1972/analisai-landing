'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePortal } from '../layout';
import {
  listarContasPagar, listarContasReceber, getContasKpis,
  marcarComoPago, marcarComoRecebido, excluirContaPagar, excluirContaReceber,
} from '@/services/contas.service';
import type { ContaPagar, ContaReceber, StatusConta, ContasFiltros } from '@/types/contas';
import {
  Receipt, DollarSign, AlertTriangle, CheckCircle2,
  Filter, Search, Loader2, MoreVertical, Check, Trash2,
  ChevronDown, Plus, ArrowUpDown
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function isAtrasado(dataVenc: string, status: StatusConta) {
  return status === 'aberto' && new Date(dataVenc) < new Date(new Date().toDateString());
}

// ── Badge de Status ───────────────────────────────────────────

function StatusBadge({ status, dataVenc }: { status: StatusConta; dataVenc: string }) {
  const atrasado = isAtrasado(dataVenc, status);
  const s = atrasado ? 'atrasado' : status;

  const map: Record<string, string> = {
    aberto: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    pago: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    recebido: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    atrasado: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    cancelado: 'text-slate-500 bg-slate-800 border-slate-700',
  };
  const labels: Record<string, string> = {
    aberto: 'Em aberto', pago: 'Pago', recebido: 'Recebido',
    atrasado: 'Atrasado', cancelado: 'Cancelado',
  };

  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[s]}`}>
      {labels[s]}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, cor }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  cor: 'amber' | 'emerald' | 'rose' | 'slate';
}) {
  const c = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    slate: 'text-slate-400 bg-slate-800 border-slate-700',
  }[cor];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-3 ${c}`}>
        {icon}
      </div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-lg font-extrabold text-white">{value}</p>
      <p className="text-xs text-slate-600">{sub}</p>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────

export default function ContasPage() {
  const { tenant } = usePortal();
  const [aba, setAba] = useState<'pagar' | 'receber'>('pagar');
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusConta[]>([]);
  const [acaoId, setAcaoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const filtros: ContasFiltros = {
        busca: busca || undefined,
        status: filtroStatus.length ? filtroStatus : undefined,
      };
      const [cp, cr, k] = await Promise.all([
        listarContasPagar(tenant.id, filtros),
        listarContasReceber(tenant.id, filtros),
        getContasKpis(tenant.id),
      ]);
      setContasPagar(cp);
      setContasReceber(cr);
      setKpis(k);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, busca, filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  const handlePago = async (id: string) => {
    await marcarComoPago(id);
    carregar();
  };

  const handleRecebido = async (id: string) => {
    await marcarComoRecebido(id);
    carregar();
  };

  const handleExcluirPagar = async (id: string) => {
    if (!confirm('Excluir esta conta?')) return;
    await excluirContaPagar(id);
    carregar();
  };

  const handleExcluirReceber = async (id: string) => {
    if (!confirm('Excluir esta conta?')) return;
    await excluirContaReceber(id);
    carregar();
  };

  const lista = aba === 'pagar' ? contasPagar : contasReceber;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="A Pagar (aberto)" value={formatBRL(kpis.pagar.totalAberto)}
            sub={`${kpis.pagar.quantidadeAberto} contas`} icon={<Receipt className="w-4 h-4" />} cor="amber" />
          <KpiCard label="A Receber (aberto)" value={formatBRL(kpis.receber.totalAberto)}
            sub={`${kpis.receber.quantidadeAberto} contas`} icon={<DollarSign className="w-4 h-4" />} cor="emerald" />
          <KpiCard label="Atrasadas" value={formatBRL(kpis.pagar.totalAtrasado)}
            sub={`${kpis.pagar.quantidadeAtrasado} vencidas`} icon={<AlertTriangle className="w-4 h-4" />}
            cor={kpis.pagar.quantidadeAtrasado > 0 ? 'rose' : 'slate'} />
          <KpiCard label="Recebido este mês" value={formatBRL(kpis.receber.totalPagoMes)}
            sub="mês atual" icon={<CheckCircle2 className="w-4 h-4" />} cor="emerald" />
        </div>
      )}

      {/* Abas + Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="flex items-center gap-1 p-4 border-b border-slate-800/80 flex-wrap">
          {/* Abas */}
          <div className="flex bg-slate-950 rounded-xl p-1 gap-1 mr-4">
            {[
              { key: 'pagar', label: 'A Pagar', icon: Receipt },
              { key: 'receber', label: 'A Receber', icon: DollarSign },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setAba(key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  aba === key
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                  aba === key ? 'bg-slate-950/30' : 'bg-slate-800'
                }`}>
                  {key === 'pagar' ? contasPagar.length : contasReceber.length}
                </span>
              </button>
            ))}
          </div>

          {/* Busca */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl pl-9 pr-4 py-2 text-white placeholder:text-slate-600 text-xs focus:outline-none transition-colors"
            />
          </div>

          {/* Filtro status */}
          <div className="flex gap-1">
            {(['aberto', 'atrasado', 'pago', 'recebido'] as StatusConta[]).map(s => (
              <button
                key={s}
                onClick={() => setFiltroStatus(prev =>
                  prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                )}
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all ${
                  filtroStatus.includes(s)
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
            <Filter className="w-8 h-8" />
            <p className="text-sm">Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800/60">
                  <th className="text-left px-5 py-3 text-slate-500 font-semibold uppercase tracking-wider">Descrição</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">
                    {aba === 'pagar' ? 'Fornecedor' : 'Cliente'}
                  </th>
                  <th className="text-right px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Valor</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Vencimento</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lista.map((item: any) => {
                  const atrasado = isAtrasado(item.data_vencimento, item.status);
                  return (
                    <tr key={item.id} className={`hover:bg-slate-800/30 transition-colors ${atrasado ? 'bg-rose-950/10' : ''}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-white">{item.descricao}</p>
                        {item.categoria && <p className="text-slate-500 text-[10px]">{item.categoria}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {aba === 'pagar' ? (item.fornecedor || '—') : (item.cliente_nome || '—')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-white">
                        {formatBRL(Number(item.valor))}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-400">
                        {formatDate(item.data_vencimento)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={item.status} dataVenc={item.data_vencimento} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(item.status === 'aberto' || atrasado) && (
                            <button
                              onClick={() => aba === 'pagar' ? handlePago(item.id) : handleRecebido(item.id)}
                              className="w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-colors"
                              title={aba === 'pagar' ? 'Marcar como pago' : 'Marcar como recebido'}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => aba === 'pagar' ? handleExcluirPagar(item.id) : handleExcluirReceber(item.id)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {lista.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
            <span>{lista.length} registro{lista.length !== 1 ? 's' : ''}</span>
            <span className="text-slate-600 text-[10px]">
              Dados gerenciados pela Solucione Assessoria Virtual
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
