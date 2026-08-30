'use client';

import React from 'react';
import {
  TrendingUp,
  BarChart2,
  DollarSign,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  AlertTriangle,
  LayoutDashboard,
  Bell,
  Settings,
  ChevronRight,
  Minus,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number, prefix = 'R$') {
  return `${prefix} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

interface MetricCard {
  id: number;
  label: string;
  value: string;
  trend: number;
  benchmarkLabel?: string;
  highlight?: boolean;
  icon: React.ReactNode;
}

interface DRERow {
  label: string;
  total: number;
  media: number;
  signal: '+' | '-' | '=';
  highlight?: boolean;
}

// ── Dados simulados ──────────────────────────────────────────────────────────

const METRIC_CARDS: MetricCard[] = [
  {
    id: 1,
    label: 'Margem Bruta',
    value: pct(55.7),
    trend: +2.1,
    benchmarkLabel: 'Eficiência da atividade principal',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    id: 2,
    label: 'Margem Contribuição',
    value: pct(34.6),
    trend: -0.8,
    benchmarkLabel: 'Após despesas variáveis',
    icon: <BarChart2 className="w-3.5 h-3.5" />,
  },
  {
    id: 3,
    label: 'Margem Operacional',
    value: pct(10.7),
    trend: +1.4,
    benchmarkLabel: 'Após despesas operacionais',
    icon: <Activity className="w-3.5 h-3.5" />,
  },
  {
    id: 4,
    label: 'EBITDA Gerencial',
    value: fmt(513507),
    trend: +5.2,
    benchmarkLabel: 'Geração operacional de caixa',
    highlight: true,
    icon: <DollarSign className="w-3.5 h-3.5" />,
  },
  {
    id: 5,
    label: 'Margem EBITDA',
    value: pct(10.7),
    trend: +0.3,
    benchmarkLabel: 'EBITDA / Receita Bruta',
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  {
    id: 6,
    label: 'Índice Custos Op.',
    value: pct(44.3),
    trend: -1.2,
    benchmarkLabel: 'Custos / Receita Líquida',
    icon: <Wallet className="w-3.5 h-3.5" />,
  },
  {
    id: 7,
    label: 'Margem Pré-IR/CSLL',
    value: pct(20.9),
    trend: +0.7,
    benchmarkLabel: 'Após ajustes do exercício',
    icon: <BarChart2 className="w-3.5 h-3.5" />,
  },
  {
    id: 8,
    label: 'Margem Líquida',
    value: pct(14.9),
    trend: +1.1,
    benchmarkLabel: 'Lucro / Receita Bruta',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    id: 9,
    label: 'Despesas Operac.',
    value: pct(3.1),
    trend: -0.5,
    benchmarkLabel: 'Despesas / Receita Bruta',
    icon: <Activity className="w-3.5 h-3.5" />,
  },
  {
    id: 10,
    label: 'Despesas Rateadas',
    value: pct(39.1),
    trend: -2.3,
    highlight: true,
    benchmarkLabel: 'Despesas Gerais / Rateio',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
];

const CASH_FLOW_CARDS = [
  { label: 'Entradas Operacionais', value: fmt(5549609), sub: 'Vendas, Serviços + Recorrentes', up: true },
  { label: 'Total de Saídas', value: fmt(5454103), sub: 'Custos + Despesas + Impostos', up: false },
  { label: 'Fluxo de Caixa Livre (FCL)', value: fmt(1317262), sub: 'Margem FCL: 23,7%', up: true },
];

const DRE_ROWS: DRERow[] = [
  { label: '(+) Receita Operacional Bruta', total: 5549609, media: 792801, signal: '+' },
  { label: '(-) Total de Impostos', total: 1027978, signal: '-', media: 146854 },
  { label: '(-) Custos Operacionais', total: 2128653, signal: '-', media: 304092 },
  { label: '(-) Despesas Rateadas / Gerais', total: 1879469, signal: '-', media: 268495 },
  { label: '(=) Resultado (Lucro/Prejuízo)', total: 513506, media: 73358, signal: '=', highlight: true },
];

const MONTHS = ['Jan/26', 'Fev/26', 'Mar/26', 'Abr/26', 'Mai/26', 'Jun/26', 'Jul/26'];
const MARGIN_EVOLUTION = [59.5, 45.7, 41.5, 55.7, 49.7, 53.1, 56.2];

// ── Sub-componentes ──────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: number }) {
  const positive = trend >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
        positive
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-red-500/15 text-red-400'
      }`}
    >
      {positive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {Math.abs(trend).toFixed(1)} pp
    </span>
  );
}

function KpiCard({ card }: { card: MetricCard }) {
  return (
    <div
      className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 transition-all ${
        card.highlight
          ? 'bg-slate-900 border-amber-500/50 shadow-md shadow-amber-500/5'
          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate">
          {card.id}. {card.label}
        </span>
        <span className={`p-1 rounded-md shrink-0 ${card.highlight ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
          {card.icon}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <span className={`text-base sm:text-xl font-black tracking-tight leading-none ${card.highlight ? 'text-amber-300' : 'text-white'}`}>
          {card.value}
        </span>
        <TrendBadge trend={card.trend} />
      </div>
      {card.benchmarkLabel && (
        <p className="text-[8px] sm:text-[9px] text-slate-500 leading-tight truncate">{card.benchmarkLabel}</p>
      )}
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 64;
  const h = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h * 0.8) - h * 0.1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible opacity-70 shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${h} ${pts} ${w},${h}`}
        fill="url(#spark-grad-showcase)"
        opacity="0.25"
      />
      <defs>
        <linearGradient id="spark-grad-showcase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Componente Principal ─────────────────────────────────────────────────────

export default function DashboardShowcase() {
  return (
    <div className="w-full max-w-5xl mx-auto select-none" aria-label="Vitrine do Painel Executivo BPO">
      {/* Moldura do navegador */}
      <div className="rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-black/60 bg-slate-950">

        {/* Barra de título do mockup */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 mx-2 sm:mx-3 min-w-0">
            <div className="bg-slate-800/90 rounded-md px-3 py-1 flex items-center gap-2 max-w-xs mx-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[10px] text-slate-400 truncate font-mono">painel.analisai.me/executivo</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-500 shrink-0">
            <Bell className="w-3.5 h-3.5" />
            <Settings className="w-3.5 h-3.5 hidden sm:inline-block" />
          </div>
        </div>

        {/* Layout interno do app */}
        <div className="flex flex-col md:flex-row">

          {/* Sidebar (visível a partir de md) */}
          <aside className="hidden md:flex w-36 bg-slate-900 border-r border-slate-800 flex-col gap-0 shrink-0">
            <div className="px-3 py-3 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-white leading-none truncate">Painel</p>
                  <p className="text-[8px] text-slate-500 leading-none mt-0.5 truncate">Executivo BPO</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 py-2 px-2 space-y-0.5">
              {[
                { label: 'Indicadores', active: true },
                { label: 'DRE Gerencial', active: false },
                { label: 'Fluxo de Caixa', active: false },
                { label: 'Diagnóstico IA', active: false },
                { label: 'Relatórios', active: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-[9px] font-semibold transition-colors ${
                    item.active
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.active && <ChevronRight className="w-3 h-3 shrink-0" />}
                </div>
              ))}
            </nav>

            <div className="px-2 py-3 border-t border-slate-800">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                <p className="text-[8px] text-emerald-400 font-bold">🟢 Ao vivo</p>
                <p className="text-[8px] text-slate-500 mt-0.5">Atualizado hoje</p>
              </div>
            </div>
          </aside>

          {/* Conteúdo principal responsivo */}
          <main className="flex-1 bg-slate-950 p-3.5 sm:p-5 space-y-4 min-w-0">

            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xs sm:text-sm font-black text-white truncate">
                    Indicadores Estratégicos Financeiros
                  </h2>
                  <span className="text-[8px] sm:text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    CFO Dashboard
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">
                  Empresa Modelo · Período: Jan–Jul/26 (7 meses) · DRE Gerencial
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded-lg font-medium hidden sm:inline-block">
                  Exportar
                </span>
                <span className="text-[9px] bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg font-extrabold">
                  + Relatório IA
                </span>
              </div>
            </div>

            {/* Alerta de queda de margem */}
            <div className="flex items-start sm:items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              <p className="text-[9px] sm:text-[10px] text-amber-300 font-semibold leading-tight">
                <span className="font-black">Queda de Margem:</span> A margem do FCL caiu 32% em Jul/26 vs Jun/26. Verifique os custos operacionais deste período.
              </p>
            </div>

            {/* Seção: Indicadores de Performance (2 cols no mobile, 3 cols em sm, 5 cols em lg) */}
            <div>
              <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[.1em] flex items-center gap-1.5 mb-2">
                <Activity className="w-3 h-3 text-amber-400" /> Indicadores de Performance e Margens (DRE Gerencial)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {METRIC_CARDS.map((card) => (
                  <KpiCard key={card.id} card={card} />
                ))}
              </div>
            </div>

            {/* Seção: Evolução + DRE Sintética (empilhado no mobile, lado a lado em lg) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">

              {/* Evolução Mensal */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-amber-400" /> Evolução Mensal — Margem Bruta
                    </p>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      56,2% no último mês
                    </span>
                  </div>

                  {/* Gráfico SVG Responsivo */}
                  <div className="relative w-full my-2">
                    <svg viewBox="0 0 360 80" className="w-full h-20 sm:h-24 overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="showcase-area-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.30" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {[20, 40, 60].map((y) => (
                        <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                      ))}
                      <polygon
                        points={`0,80 ${MARGIN_EVOLUTION.map((v, i) => {
                          const x = (i / (MARGIN_EVOLUTION.length - 1)) * 360;
                          const y = 80 - ((v - 35) / 30) * 65;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(' ')} 360,80`}
                        fill="url(#showcase-area-grad)"
                      />
                      <polyline
                        points={MARGIN_EVOLUTION.map((v, i) => {
                          const x = (i / (MARGIN_EVOLUTION.length - 1)) * 360;
                          const y = 80 - ((v - 35) / 30) * 65;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {MARGIN_EVOLUTION.map((v, i) => {
                        const x = (i / (MARGIN_EVOLUTION.length - 1)) * 360;
                        const y = 80 - ((v - 35) / 30) * 65;
                        return (
                          <g key={i}>
                            <circle cx={x} cy={y} r="3.5" fill="#f59e0b" />
                            <circle cx={x} cy={y} r="1.5" fill="#020617" />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    {MONTHS.map((m) => (
                      <span key={m} className="text-[8px] sm:text-[9px] font-semibold text-slate-500">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Mini tabela dos últimos meses */}
                <div className="mt-3 border-t border-slate-800 pt-2 grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                  {MONTHS.slice(-5).map((m, i) => (
                    <div key={m} className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-1.5">
                      <p className="text-[8px] text-slate-500">{m}</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-white mt-0.5">
                        {pct(MARGIN_EVOLUTION[i + 2])}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* DRE Sintética */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[9px] sm:text-[10px] font-extrabold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <BarChart2 className="w-3 h-3 text-emerald-400" /> DRE Sintética — Consolidado
                    </p>
                    <span className="text-[8px] text-slate-500">Acumulado Jan–Jul/26</span>
                  </div>

                  <div className="mb-1.5 grid grid-cols-3 text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wide px-1.5">
                    <span className="col-span-1">Estrutura DRE</span>
                    <span className="text-right">Total Acum.</span>
                    <span className="text-right">Média Mensal</span>
                  </div>

                  <div className="space-y-1">
                    {DRE_ROWS.map((row) => (
                      <div
                        key={row.label}
                        className={`grid grid-cols-3 items-center rounded-lg px-2 py-1.5 text-[9px] sm:text-[10px] ${
                          row.highlight
                            ? 'bg-emerald-500/15 border border-emerald-500/30'
                            : 'bg-slate-950/40 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-1 col-span-1 min-w-0">
                          <span className="shrink-0">
                            {row.signal === '+' && <ArrowUpRight className="w-3 h-3 text-emerald-400" />}
                            {row.signal === '-' && <ArrowDownRight className="w-3 h-3 text-red-400" />}
                            {row.signal === '=' && <Minus className="w-3 h-3 text-amber-400" />}
                          </span>
                          <span className={`truncate font-semibold ${row.highlight ? 'text-emerald-300 font-extrabold' : 'text-slate-300'}`}>
                            {row.label}
                          </span>
                        </div>
                        <span className={`text-right font-bold tabular-nums ${row.highlight ? 'text-emerald-300' : 'text-white'}`}>
                          {fmt(row.total)}
                        </span>
                        <span className={`text-right tabular-nums ${row.highlight ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {fmt(row.media)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detalhe da margem final */}
                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold">Margem Líquida Consolidada</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-emerald-400">9,3%</span>
                    <TrendBadge trend={+1.1} />
                  </div>
                </div>
              </div>

            </div>

            {/* Seção: Fluxo de Caixa (empilhado no mobile, 3 cols em sm+) */}
            <div>
              <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[.1em] flex items-center gap-1.5 mb-2">
                <Wallet className="w-3 h-3 text-emerald-400" /> Fluxo de Caixa e Eficiência Operacional
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {CASH_FLOW_CARDS.map((c) => (
                  <div
                    key={c.label}
                    className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.up ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate">
                          {c.label}
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-black text-white leading-none">{c.value}</p>
                      <p className="text-[8px] sm:text-[9px] text-slate-500 mt-1 truncate">{c.sub}</p>
                    </div>
                    <MiniSparkline values={c.up ? [310, 340, 280, 390, 370, 410, 395] : [380, 360, 390, 340, 320, 350, 330]} />
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé do painel */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[8px] sm:text-[9px]">
              <span className="text-slate-500 text-center sm:text-left">
                Diagnóstico Analítico BPO · Dados simulados para demonstração
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Análise IA & Especialista Ativa
              </span>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
