'use client';

import React from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, Activity,
  BarChart2, ArrowUpRight, ArrowDownRight, Sparkles, AlertTriangle,
  LayoutDashboard, Bell, Settings, ChevronRight, Minus,
} from 'lucide-react';

// ── Dados do mockup ──────────────────────────────────────────────────────────

const METRICS = [
  { id: 1, label: 'Margem Bruta',       value: '55,7%',      trend: +2.1, icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'emerald' },
  { id: 2, label: 'Margem Operacional', value: '10,7%',      trend: +1.4, icon: <Activity className="w-3.5 h-3.5" />,   color: 'amber'   },
  { id: 3, label: 'EBITDA',             value: 'R$ 513k',    trend: +5.2, icon: <DollarSign className="w-3.5 h-3.5" />, color: 'amber'   },
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

// ── Sparkline SVG ────────────────────────────────────────────────────────────

function MiniChart() {
  const min = Math.min(...MARGIN), max = Math.max(...MARGIN);
  const range = max - min || 1;
  const W = 280, H = 52;

  const pts = MARGIN.map((v, i) => {
    const x = (i / (MARGIN.length - 1)) * W;
    const y = H - ((v - min) / range) * (H * 0.82) - H * 0.09;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[13, 26, 39].map(y => (
        <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#1e293b" strokeWidth="1" />
      ))}
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#mg)" />
      <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {MARGIN.map((v, i) => {
        const x = (i / (MARGIN.length - 1)) * W;
        const y = H - ((v - min) / range) * (H * 0.82) - H * 0.09;
        return <circle key={i} cx={x} cy={y} r="2.5" fill="#f59e0b" />;
      })}
    </svg>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function DashboardMockup() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-slate-700/60 shadow-[0_32px_80px_rgba(0,0,0,0.6)] bg-slate-950 select-none">

      {/* Barra do navegador */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="flex-1 mx-3">
          <div className="bg-slate-800/80 rounded-md px-3 py-1 flex items-center gap-2 max-w-xs mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="text-[10px] text-slate-400 font-mono truncate">painel.analisai.me/executivo</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-slate-600">
          <Bell className="w-3.5 h-3.5" />
          <Settings className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Conteúdo interno */}
      <div className="flex overflow-hidden" style={{ maxHeight: '420px' }}>

        {/* Sidebar */}
        <aside className="w-32 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
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
            {['Indicadores','DRE Gerencial','Fluxo de Caixa','Diagnóstico IA','Relatórios'].map((item, i) => (
              <div key={item} className={`px-2 py-1.5 rounded-lg text-[9px] font-semibold flex items-center justify-between transition-colors ${i === 0 ? 'bg-amber-500/15 text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}>
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

        {/* Área principal */}
        <main className="flex-1 overflow-hidden bg-slate-950 px-3.5 py-3 space-y-3">

          {/* Header interno */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-black text-white">Indicadores Financeiros Estratégicos</h3>
                <span className="text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wide">CFO Dashboard</span>
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5">Empresa Modelo · Jan–Jul/26 · DRE Gerencial</p>
            </div>
            <span className="text-[9px] bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg font-extrabold shrink-0">+ Relatório IA</span>
          </div>

          {/* Alerta */}
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <p className="text-[9px] text-amber-300 font-semibold">Alerta: FCL caiu 32% em Jul/26 vs Jun/26. Verifique custos do período.</p>
          </div>

          {/* Cards de métricas */}
          <div className="grid grid-cols-4 gap-2">
            {METRICS.map(m => (
              <div key={m.id} className={`rounded-xl border p-2.5 flex flex-col gap-1.5 ${m.color === 'amber' ? 'bg-slate-800 border-amber-500/40' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide leading-tight truncate pr-1">{m.label}</span>
                  <span className={`p-0.5 rounded ${m.color === 'amber' ? 'text-amber-400' : 'text-slate-500'}`}>{m.icon}</span>
                </div>
                <span className={`text-base font-black leading-none ${m.color === 'amber' ? 'text-amber-300' : 'text-white'}`}>{m.value}</span>
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full inline-flex items-center gap-0.5 self-start ${m.trend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {m.trend >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                  {Math.abs(m.trend).toFixed(1)}pp
                </span>
              </div>
            ))}
          </div>

          {/* Linha: gráfico + DRE */}
          <div className="grid grid-cols-2 gap-2.5">

            {/* Gráfico evolução */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
              <div className="flex items-center gap-1 mb-1.5">
                <BarChart2 className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Evolução Mensal — Margem Bruta</span>
              </div>
              <MiniChart />
              <div className="flex justify-between mt-1">
                {MONTHS.map(m => <span key={m} className="text-[7px] text-slate-600">{m}</span>)}
              </div>
            </div>

            {/* DRE sintética */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
              <div className="flex items-center gap-1 mb-2">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">DRE Sintética</span>
              </div>
              <div className="space-y-1">
                {DRE_ROWS.map(row => (
                  <div key={row.label} className={`flex items-center justify-between rounded px-1.5 py-1 ${row.highlight ? 'bg-emerald-500/10 border border-emerald-500/25' : ''}`}>
                    <div className="flex items-center gap-1 min-w-0">
                      {row.signal === '+' && <ArrowUpRight className="w-2.5 h-2.5 text-emerald-400 shrink-0" />}
                      {row.signal === '-' && <ArrowDownRight className="w-2.5 h-2.5 text-red-400 shrink-0" />}
                      {row.signal === '=' && <Minus className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                      <span className={`text-[9px] truncate ${row.highlight ? 'text-emerald-300 font-bold' : 'text-slate-400'}`}>{row.label}</span>
                    </div>
                    <span className={`text-[9px] font-bold tabular-nums shrink-0 ml-1 ${row.highlight ? 'text-emerald-300' : 'text-white'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* Callout flutuante — Margem EBITDA */}
      <div className="absolute top-[52px] right-[-16px] hidden xl:flex items-center gap-2 bg-amber-500 text-slate-950 rounded-xl px-3 py-2 shadow-xl shadow-amber-500/30 z-10 pointer-events-none">
        <TrendingUp className="w-4 h-4 shrink-0" />
        <div>
          <p className="text-[9px] font-black leading-none">Margem EBITDA</p>
          <p className="text-[11px] font-black leading-none mt-0.5">10,7% <span className="text-[9px]">↑ vs mês ant.</span></p>
        </div>
      </div>
    </div>
  );
}
