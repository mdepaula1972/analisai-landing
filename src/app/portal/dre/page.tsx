'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePortal } from '../layout';
import { PlanGate } from '@/components/portal/PlanGate';
import { listarLancamentos, getMetadados, calcularDre } from '@/services/dre.service';
import { DEFAULT_DRE_ESTRUTURA, DreCalculatedResult } from '@/types/dre';
import {
  TrendingUp, TrendingDown, Loader2, BarChart3,
  Calendar, ChevronDown, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────

function formatBRL(v: number, compact = false) {
  if (compact && Math.abs(v) >= 1000) {
    return `R$ ${(v / 1000).toFixed(1)}k`.replace('.', ',');
  }
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function PercBadge({ perc }: { perc: number }) {
  const pos = perc >= 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pos ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
      {pos ? '+' : ''}{perc.toFixed(1)}%
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────

function DreKpiCard({ label, value, perc, isPositivo }: {
  label: string; value: number; perc?: number; isPositivo?: boolean;
}) {
  const valPos = isPositivo !== undefined ? (isPositivo ? value >= 0 : value <= 0) : value >= 0;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-xl font-extrabold ${valPos ? 'text-emerald-400' : 'text-rose-400'}`}>
        {formatBRL(value)}
      </p>
      {perc !== undefined && (
        <div className="mt-1">
          <PercBadge perc={perc} />
          <span className="text-[10px] text-slate-600 ml-1">da Rec. Líquida</span>
        </div>
      )}
    </div>
  );
}

// ── Tabela DRE ────────────────────────────────────────────────

function DreTable({ result }: { result: DreCalculatedResult }) {
  const [showAll, setShowAll] = useState(false);
  const periodos = result.periodos.slice(-6); // Últimos 6 meses

  const linhas = DEFAULT_DRE_ESTRUTURA.filter(item => {
    if (item.tipo === 'divisor') return true;
    if (item.tipo === 'card' || item.tipo === 'linha') return true;
    return false;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Demonstrativo de Resultado (DRE)
        </h3>
        <span className="text-xs text-slate-500">{result.lancamentosCount} lançamentos</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="bg-slate-950/50 border-b border-slate-800/60">
              <th className="text-left px-5 py-3 text-slate-500 font-semibold uppercase tracking-wider w-48">Conta DRE</th>
              {periodos.map(p => (
                <th key={p} className="text-right px-3 py-3 text-slate-500 font-semibold">{p}</th>
              ))}
              <th className="text-right px-5 py-3 text-slate-500 font-semibold uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((item, idx) => {
              if (item.tipo === 'divisor') {
                return (
                  <tr key={idx} className="bg-slate-950/30">
                    <td colSpan={periodos.length + 2} className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {item.titulo}
                    </td>
                  </tr>
                );
              }

              const isCard = item.tipo === 'card';
              const values = periodos.map(p => {
                if (item.var) {
                  // Linha calculada
                  return 0;
                }
                return result.mensal[item.titulo]?.[p] || 0;
              });
              const total = values.reduce((s, v) => s + v, 0);

              return (
                <tr key={idx} className={`border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors ${isCard ? 'bg-amber-500/5 font-bold' : ''}`}>
                  <td className={`px-5 py-3 ${isCard ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                    {item.titulo}
                  </td>
                  {values.map((v, vi) => (
                    <td key={vi} className={`px-3 py-3 text-right ${isCard ? (v >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-400'}`}>
                      {v !== 0 ? formatBRL(v, true) : '—'}
                    </td>
                  ))}
                  <td className={`px-5 py-3 text-right font-bold ${isCard ? (total >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}`}>
                    {total !== 0 ? formatBRL(total, true) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────

export default function DrePage() {
  const { tenant } = usePortal();
  const [result, setResult] = useState<DreCalculatedResult | null>(null);
  const [periodos, setPeriodos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodosSelecionados, setPeriodosSelecionados] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [lancamentos, meta] = await Promise.all([
        listarLancamentos(tenant.id, {
          periodos: periodosSelecionados.length ? periodosSelecionados : undefined,
        }),
        getMetadados(tenant.id),
      ]);

      setPeriodos(meta.periodos);
      const r = calcularDre(lancamentos, DEFAULT_DRE_ESTRUTURA);
      setResult(r);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, periodosSelecionados]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!tenant) return null;

  return (
    <PlanGate planoNecessario="gestao" planoAtual={tenant.plano} featureLabel="DRE Gerencial">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header + Filtro de Período */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-white">DRE Gerencial</h1>
            <p className="text-slate-400 text-sm">Demonstrativo de Resultado do Exercício · {tenant.nome_fantasia || tenant.razao_social}</p>
          </div>

          {/* Seletor de períodos */}
          <div className="flex flex-wrap gap-1.5">
            {periodos.slice(-6).map(p => (
              <button
                key={p}
                onClick={() => setPeriodosSelecionados(prev =>
                  prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                )}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                  periodosSelecionados.includes(p) || periodosSelecionados.length === 0
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : result && result.lancamentosCount === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Nenhum dado disponível</p>
            <p className="text-slate-500 text-sm">Aguarde a equipe Solucione lançar os dados deste período.</p>
          </div>
        ) : result ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <DreKpiCard label="Receita Bruta" value={result.kpis.receitaBruta} isPositivo />
              <DreKpiCard label="Margem Bruta" value={result.kpis.margemBruta} perc={result.kpis.margemBrutaPerc} isPositivo />
              <DreKpiCard label="EBITDA" value={result.kpis.ebitda} perc={result.kpis.ebitdaPerc} isPositivo />
              <DreKpiCard label="Resultado Líquido" value={result.kpis.resultadoLiquido} perc={result.kpis.resultadoPerc} isPositivo />
            </div>

            {/* Gráfico */}
            {result.periodos.length > 1 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">Evolução Mensal</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={result.periodos.slice(-6).map(p => ({
                      periodo: p,
                      receita: result.mensal['Receita Bruta de Vendas']?.[p] || 0,
                      resultado: result.kpis.resultadoLiquido / result.periodos.length,
                    }))}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="periodo" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(v: number) => [formatBRL(v), '']}
                    />
                    <Bar dataKey="receita" name="Receita" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabela DRE */}
            <DreTable result={result} />
          </>
        ) : null}
      </div>
    </PlanGate>
  );
}
