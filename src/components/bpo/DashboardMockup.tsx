'use client';

import React from 'react';
import {
  TrendingUp, Activity, DollarSign, Wallet,
  BarChart2, ArrowUpRight, ArrowDownRight, Sparkles, AlertTriangle,
  LayoutDashboard, Bell, Settings, ChevronRight, Minus,
} from 'lucide-react';

// ── Dados do mockup ──────────────────────────────────────────────────────────

const METRICS = [
  { id: 1, label: 'Margem Bruta',         value: '55,7%',   trend: +2.1, icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'emerald' },
  { id: 2, label: 'Margem Operacional',   value: '10,7%',   trend: +1.4, icon: <Activity className="w-3.5 h-3.5" />,   color: 'amber'   },
  { id: 3, label: 'EBITDA Gerencial',     value: 'R$ 513k', trend: +5.2, icon: <DollarSign className="w-3.5 h-3.5" />, color: 'amber'   },
  { id: 4, label: 'Fluxo de Caixa Livre', value: 'R$ 1,3M', trend: -0.8, icon: <Wallet className="w-3.5 h-3.5" />,     color: 'red'     },
];

const DRE_ROWS = [
  { label: '(+) Receita Bruta',        value: 'R$ 5.549k', signal: '+' as const },
  { label: '(-) Impostos',             value: 'R$ 1.028k', signal: '-' as const },
  { label: '(-) Custos Operac.',       value: 'R$ 2.129k', signal: '-' as const },
  { label: '(-) Despesas Rateadas',    value: 'R$ 1.879k', signal: '-' as const },
  { label: '(=) Resultado Líquido',    value: 'R$ 514k',   signal: '=' as const, highlight: true },
];

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'];
const MARGIN  = [59.5, 45.7, 41.5, 55.7, 49.7, 53.1, 56.2];

// ── Sparkline SVG Responsivo ──────────────────────────────────────────────────

function MiniChart() {
  const min = Math.min(...MARGIN), max = Math.max(...MARGIN);
  const range = max - min || 1;
  const W = 360, H = 70;

  const pts = MARGIN.map((v, i) => {
    const x = (i / (MARGIN.length - 1)) * W;
    const y = H - ((v - min) / range) * (H * 0.78) - H * 0.11;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="w-full relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 sm:h-20 overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mockup-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {[18, 36, 54].map((y) => (
          <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#mockup-grad)" />
        <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {MARGIN.map((v, i) => {
          const x = (i / (MARGIN.length - 1)) * W;
          const y = H - ((v - min) / range) * (H * 0.78) - H * 0.11;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3.5" fill="#f59e0b" />
              <circle cx={x} cy={y} r="1.5" fill="#020617" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function DashboardMockup() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-slate-700/60 shadow-[0_24px_70px_rgba(0,0,0,0.6)] bg-slate-950 select-none">

      {/* Barra do navegador */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="flex-1 mx-2 sm:mx-3 min-w-0">
          <div className="bg-slate-800/80 rounded-md px-2.5 py-1 flex items-center gap-2 max-w-xs mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[10px] text-slate-400 font-mono truncate">painel.analisai.me/executivo</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-600 shrink-0">
          <Bell className="w-3.5 h-3.5" />
          <Settings className="w-3.5 h-3.5 hidden sm:inline-block" />
        </div>
      </div>

      {/* Conteúdo interno responsivo */}
      <div className="flex flex-col md:flex-row">

        {/* Sidebar (oculta em telas muito pequenas, visível a partir de md) */}
        <aside className="hidden md:flex w-36 bg-slate-900 border-r border-slate-800 flex-col shrink-0">
          <div className="px-3 py-3 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-white leading-none truncate">Painel</p>
                <p className="text-[8px] text-slate-500 leading-none mt-0.5 truncate">Executivo BPO</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 py-2 px-1.5 space-y-0.5">
            {['Indicadores', 'DRE Gerencial', 'Fluxo de Caixa', 'Diagnóstico IA', 'Relatórios'].map((item, i) => (
              <div
                key={item}
                className={`px-2 py-1.5 rounded-lg text-[9px] font-semibold flex items-center justify-between transition-colors ${
                  i === 0 ? 'bg-amber-500/15 text-amber-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="truncate">{item}</span>
                {i === 0 && <ChevronRight className="w-2.5 h-2.5 shrink-0" />}
              </div>
            ))}
          </nav>
          <div className="px-2 py-2.5 border-t border-slate-800">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-1.5 text-center">
              <p className="text-[8px] text-emerald-400 font-bold">🟢 Ao vivo</p>
            </div>
          </div>
        </aside>

        {/* Área principal fluida */}
        <main className="flex-1 bg-slate-950 p-3 sm:p-4 space-y-3 min-w-0">

          {/* Header interno */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-white truncate">Indicadores Financeiros</h3>
                <span className="text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  CFO Dashboard
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">
                Empresa Modelo · Jan–Jul/26 · DRE Gerencial
              </p>
            </div>
            <span className="text-[9px] bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg font-extrabold shrink-0">
              + Relatório IA
            </span>
          </div>

          {/* Alerta de margem */}
          <div className="flex items-start sm:items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-[9px] sm:text-[10px] text-amber-300 font-semibold leading-tight">
              <span className="font-bold">Alerta:</span> FCL caiu 32% em Jul/26 vs Jun/26. Verifique custos operacionais do período.
            </p>
          </div>

          {/* Cards de métricas (2 colunas no mobile, 4 colunas em telas maiores) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {METRICS.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border p-2.5 flex flex-col justify-between gap-1.5 ${
                  m.color === 'amber'
                    ? 'bg-slate-900/90 border-amber-500/40 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate">
                    {m.label}
                  </span>
                  <span className={`p-0.5 rounded shrink-0 ${m.color === 'amber' ? 'text-amber-400' : 'text-slate-500'}`}>
                    {m.icon}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className={`text-base sm:text-lg font-black leading-none ${m.color === 'amber' ? 'text-amber-300' : 'text-white'}`}>
                    {m.value}
                  </span>
                  <span
                    className={`text-[8px] font-bold px-1 py-0.5 rounded-full inline-flex items-center gap-0.5 shrink-0 ${
                      m.trend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {m.trend >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                    {Math.abs(m.trend).toFixed(1)}pp
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Linha: Gráfico + DRE Sintética (empilhado no mobile, lado a lado em sm+) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

            {/* Gráfico evolução */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-300 uppercase tracking-wide">
                    Evolução — Margem Bruta
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  56,2% atual
                </span>
              </div>
              <MiniChart />
              <div className="flex justify-between mt-2 pt-1 border-t border-slate-800/80">
                {MONTHS.map((m) => (
                  <span key={m} className="text-[8px] sm:text-[9px] font-semibold text-slate-500">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* DRE Sintética */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-300 uppercase tracking-wide">
                    DRE Sintética (Jul/26)
                  </span>
                </div>
                <span className="text-[8px] text-slate-500">Consolidado</span>
              </div>
              <div className="space-y-1.5">
                {DRE_ROWS.map((row) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between rounded-lg px-2 py-1 text-[9px] sm:text-[10px] ${
                      row.highlight ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-slate-950/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {row.signal === '+' && <ArrowUpRight className="w-3 h-3 text-emerald-400 shrink-0" />}
                      {row.signal === '-' && <ArrowDownRight className="w-3 h-3 text-red-400 shrink-0" />}
                      {row.signal === '=' && <Minus className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className={`truncate font-semibold ${row.highlight ? 'text-emerald-300 font-bold' : 'text-slate-300'}`}>
                        {row.label}
                      </span>
                    </div>
                    <span className={`font-bold tabular-nums shrink-0 ml-2 ${row.highlight ? 'text-emerald-300' : 'text-white'}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </main>
      </div>

    </div>
  );
}
