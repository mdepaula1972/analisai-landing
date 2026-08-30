'use client';

import React from 'react';
import {
  FileText, ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, CheckCircle2, BarChart2, TrendingUp,
} from 'lucide-react';

// ── Dados simulados ───────────────────────────────────────────────────────────

const DRE_ROWS = [
  { label: '(+) Receita Operacional Bruta',  value: 5_549_609, signal: '+' as const },
  { label: '(-) Total de Impostos',          value: 1_027_978, signal: '-' as const },
  { label: '(-) Custos Operacionais',        value: 2_128_653, signal: '-' as const },
  { label: '(-) Despesas Rateadas / Gerais', value: 1_879_469, signal: '-' as const },
  { label: '(=) Resultado (Lucro/Prejuízo)', value: 513_506,   signal: '=' as const, highlight: true },
];

function fmt(n: number) {
  return `R$ ${(n / 1000).toFixed(0)}k`;
}

// Waterfall: Receita → Impostos → Custos → Despesas → Resultado
const WATERFALL = [
  { label: 'Receita',   value: 5549, color: '#10b981', type: 'bar' },
  { label: 'Impostos',  value: 1028, color: '#ef4444', type: 'sub' },
  { label: 'Custos',    value: 2129, color: '#ef4444', type: 'sub' },
  { label: 'Despesas',  value: 1879, color: '#f97316', type: 'sub' },
  { label: 'FCL',       value: 513,  color: '#f59e0b', type: 'result' },
];

const MAX_VAL = 5549;

const RECOMENDACOES = [
  {
    icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
    titulo: 'Margem Bruta estável acima de 50%',
    texto: 'A eficiência operacional principal está saudável. Foco agora deve ser na redução de despesas rateadas, que respondem por 34% das saídas totais.',
  },
  {
    icon: <BarChart2 className="w-4 h-4 text-emerald-400" />,
    titulo: 'FCL com queda de 32% em jul/26',
    texto: 'O Fluxo de Caixa Livre caiu de R$92k para R$63k no período. Identificamos aumento atípico em "Manutenção Corretiva" (R$215k) como principal driver.',
  },
  {
    icon: <Sparkles className="w-4 h-4 text-blue-400" />,
    titulo: 'Oportunidade: Renegociar custos fixos recorrentes',
    texto: 'Despesas com benefícios e alimentação somam R$380k no período. Consolidação de fornecedores pode gerar economia estimada de 12% ao mês.',
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
            <span className="text-shimmer-amber">pronto no dia 10</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Sem planilhas confusas. Seu gestor recebe um relatório completo com DRE, análise de margens, fluxo de caixa e recomendações práticas — em PDF e no painel digital.
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
                  <p className="text-[10px] text-slate-500 mt-0.5">Painel Executivo · Empresa Modelo · Jan–Jul/26</p>
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
                  <span className="text-sm font-black text-emerald-400">9,3%</span>
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
                      <span className="text-[10px] font-bold text-white w-12 shrink-0 tabular-nums">R$ {item.value}k</span>
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
              Inteligência Analítica BPO · Empresa Modelo · Período: Jan–Jul/26 · Elaborado em 29/08/2026
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
                  Este parecer é elaborado mensalmente pela equipe de BPO Financeiro e revisado por analista sênior antes da entrega ao cliente.
                </p>
              </div>
            </div>

            {/* Entregas incluídas */}
            <div className="mt-5 rounded-xl bg-slate-800/60 p-4">
              <p className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wide mb-3">📦 Entregáveis incluídos</p>
              <ul className="space-y-1.5">
                {[
                  'DRE Gerencial Sintética e Analítica',
                  'Gráficos de Evolução de Margens',
                  'Análise de Fluxo de Caixa Livre (FCL)',
                  'Comparativo vs. mês anterior',
                  'Parecer com recomendações práticas',
                  'Acesso ao Painel Executivo Digital',
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
