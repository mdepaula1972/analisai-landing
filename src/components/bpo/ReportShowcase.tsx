'use client';

import React from 'react';
import {
  FileText, ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, CheckCircle2, BarChart2, TrendingUp,
} from 'lucide-react';

// ── Dados simulados (PME realista · média R$ 202k/mês) ────────────────────────

const DRE_ROWS = [
  { label: '(+) Receita Operacional Bruta',  value: 1_414_000, signal: '+' as const },
  { label: '(-) Total de Impostos',          value: 176_750,   signal: '-' as const },
  { label: '(-) Custos Operacionais',        value: 544_390,   signal: '-' as const },
  { label: '(-) Despesas Rateadas / Gerais', value: 501_970,   signal: '-' as const },
  { label: '(=) Resultado (Lucro/Prejuízo)', value: 190_890,   signal: '=' as const, highlight: true },
];

function fmt(n: number) {
  return `R$ ${Math.round(n / 1000).toLocaleString('pt-BR')}k`;
}

// Waterfall: Receita → Impostos → Custos → Despesas → Resultado
const WATERFALL = [
  { label: 'Receita',   value: 1414, color: '#10b981', type: 'bar' },
  { label: 'Impostos',  value: 177,  color: '#ef4444', type: 'sub' },
  { label: 'Custos',    value: 544,  color: '#ef4444', type: 'sub' },
  { label: 'Despesas',  value: 502,  color: '#f97316', type: 'sub' },
  { label: 'FCL',       value: 191,  color: '#f59e0b', type: 'result' },
];

const MAX_VAL = 1414;

const RECOMENDACOES = [
  {
    icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
    titulo: 'Margem Bruta estável acima de 55%',
    texto: 'A eficiência operacional principal fechou em 56,0%. Foco agora deve ser na redução de despesas gerais, que respondem por 35,5% do faturamento.',
  },
  {
    icon: <BarChart2 className="w-4 h-4 text-emerald-400" />,
    titulo: 'FCL com queda de 28% em jul/26',
    texto: 'O Fluxo de Caixa Livre mensal recuou de R$ 31k para R$ 22k no período. Identificamos gasto pontual em "Manutenção e Equipamentos" (R$ 11,4k) como principal driver.',
  },
  {
    icon: <Sparkles className="w-4 h-4 text-blue-400" />,
    titulo: 'Oportunidade: Renegociar custos fixos recorrentes',
    texto: 'Contratos recorrentes de software, telefonia e insumos somam R$ 48k no período. Consolidação de fornecedores pode gerar economia estimada de R$ 5,7k nos próximos meses.',
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function ReportShowcase() {
  return (
    <section id="entregamos" className="relative py-20 sm:py-28 overflow-hidden bg-slate-900/30 border-y border-slate-800/60">

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(245,158,11,0.06),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Título da seção */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-emerald-300 mb-5">
            <FileText className="h-3.5 w-3.5" /> O que entregamos todo mês
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
            Relatório Executivo Gerencial{' '}
            <span className="text-shimmer-amber">entregue até o 5º dia útil</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Sem planilhas confusas. Além da conciliação bancária diária, você recebe até o 5º dia útil um relatório completo com DRE, análise de margens, fluxo de caixa e recomendações práticas — em PDF, no painel digital e com pacote fiscal pronto para a contabilidade.
          </p>
        </div>

        {/* Layout de preview do relatório */}
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-8 items-start">

          {/* Coluna esquerda: DRE sintética + Waterfall */}
          <div className="space-y-4">

            {/* Card: DRE Sintética */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-black text-white">DRE Sintética — Consolidado</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Painel Executivo · Empresa Modelo (R$ 202k/mês) · Jan–Jul/26</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">Gerado por IA</span>
                  <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">Revisado por Especialista</span>
                </div>
              </div>

              {/* Cabeçalho tabela */}
              <div className="grid grid-cols-3 text-[9px] font-bold text-slate-500 uppercase tracking-wide px-2 mb-1">
                <span className="col-span-1">Estrutura DRE</span>
                <span className="text-right">Total Acum.</span>
                <span className="text-right">Média/Mês</span>
              </div>

              <div className="space-y-0.5">
                {DRE_ROWS.map((row) => {
                  const media = Math.round(row.value / 7);
                  return (
                    <div
                      key={row.label}
                      className={`grid grid-cols-3 items-center rounded-lg px-2 py-2 text-[10px] ${
                        row.highlight
                          ? 'bg-emerald-500/10 border border-emerald-500/25'
                          : 'hover:bg-slate-800/60 transition-colors'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 col-span-1 min-w-0">
                        {row.signal === '+' && <ArrowUpRight className="w-3 h-3 text-emerald-400 shrink-0" />}
                        {row.signal === '-' && <ArrowDownRight className="w-3 h-3 text-red-400 shrink-0" />}
                        {row.signal === '=' && <Minus className="w-3 h-3 text-amber-400 shrink-0" />}
                        <span className={`truncate font-semibold ${row.highlight ? 'text-emerald-300 font-extrabold' : 'text-slate-300'}`}>
                          {row.label}
                        </span>
                      </div>
                      <span className={`text-right font-bold tabular-nums ${row.highlight ? 'text-emerald-300' : 'text-white'}`}>
                        {fmt(row.value)}
                      </span>
                      <span className={`text-right tabular-nums ${row.highlight ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                        {fmt(media)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Margem final */}
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-semibold">Margem Líquida Consolidada</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-emerald-400">13,5%</span>
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                    <ArrowUpRight className="w-2.5 h-2.5" /> +1,1pp
                  </span>
                </div>
              </div>
            </div>

            {/* Card: Waterfall de FCL */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-1.5 mb-4">
                <BarChart2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white">Composição do FCL — Waterfall</h3>
              </div>

              <div className="space-y-2">
                {WATERFALL.map((item) => {
                  const pct = (item.value / MAX_VAL) * 100;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 w-14 shrink-0 text-right">{item.label}</span>
                      <div className="flex-1 bg-slate-800 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: item.color, opacity: item.type === 'sub' ? 0.75 : 1 }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-white w-16 shrink-0 tabular-nums text-right">
                        R$ {item.value.toLocaleString('pt-BR')}k
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-[9px] text-slate-500">
                FCL = Receita Bruta − Impostos − Custos − Despesas Rateadas
              </p>
            </div>
          </div>

          {/* Coluna direita: Parecer Executivo */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-slate-900 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black text-white">Parecer Executivo Analítico</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-5">
              Inteligência Analítica BPO · Empresa Modelo · Período: Jan–Jul/26 · Entregue até o 5º dia útil
            </p>

            <div className="space-y-4">
              {RECOMENDACOES.map((rec, i) => (
                <div key={i} className="flex gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    {rec.icon}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-white mb-1">{rec.titulo}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{rec.texto}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé do parecer */}
            <div className="mt-5 pt-4 border-t border-slate-800">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Este parecer é elaborado mensalmente pela equipe de BPO Financeiro e revisado por controladoria sênior antes da entrega até o 5º dia útil.
                </p>
              </div>
            </div>

            {/* Entregas incluídas */}
            <div className="mt-5 rounded-xl bg-slate-800/60 p-4">
              <p className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wide mb-3">Entregáveis incluídos</p>
              <ul className="space-y-1.5">
                {[
                  'Conciliação bancária diária de todas as contas',
                  'DRE Gerencial Sintética e Analítica (até o 5º dia útil)',
                  'Gráficos de Evolução de Margens',
                  'Análise de Fluxo de Caixa Livre (FCL)',
                  'Pacote Fiscal em .ZIP + CSV estruturado para contabilidade',
                  'Parecer com recomendações práticas + Painel Executivo Digital',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
