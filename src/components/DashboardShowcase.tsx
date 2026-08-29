'use client';

import {
  TrendingUp,
  TrendingDown,
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
  trend: number; // positivo = melhora, negativo = piora
  benchmarkLabel?: string;
  highlight?: boolean;
  icon: React.ReactNode;
  type: 'percent' | 'currency';
}

interface DRERow {
  label: string;
  total: number;
  media: number;
  signal: '+' | '-' | '=';
  highlight?: boolean;
}

// ── Dados fictícios (sem nomes reais) ────────────────────────────────────────

const METRIC_CARDS: MetricCard[] = [
  {
    id: 1,
    label: 'Margem Bruta',
    value: pct(55.7),
    trend: +2.1,
    benchmarkLabel: 'Eficiência da atividade principal',
    icon: <TrendingUp className="w-4 h-4" />,
    type: 'percent',
  },
  {
    id: 2,
    label: 'Margem de Contribuição',
    value: pct(34.6),
    trend: -0.8,
    benchmarkLabel: 'Após despesas variáveis',
    icon: <BarChart2 className="w-4 h-4" />,
    type: 'percent',
  },
  {
    id: 3,
    label: 'Margem Operacional',
    value: pct(10.7),
    trend: +1.4,
    benchmarkLabel: 'Após despesas operacionais',
    icon: <Activity className="w-4 h-4" />,
    type: 'percent',
  },
  {
    id: 4,
    label: 'EBITDA',
    value: fmt(513507),
    trend: +5.2,
    benchmarkLabel: 'Geração operacional de caixa',
    highlight: true,
    icon: <DollarSign className="w-4 h-4" />,
    type: 'currency',
  },
  {
    id: 5,
    label: 'Margem EBITDA',
    value: pct(10.7),
    trend: +0.3,
    benchmarkLabel: 'EBITDA / Receita Bruta',
    icon: <Sparkles className="w-4 h-4" />,
    type: 'percent',
  },
  {
    id: 6,
    label: 'Índice de Custos Operacionais',
    value: pct(44.3),
    trend: -1.2,
    benchmarkLabel: 'Custos / Receita Líquida',
    icon: <Wallet className="w-4 h-4" />,
    type: 'percent',
  },
  {
    id: 7,
    label: 'Margem Antes do IR/CSLL',
    value: pct(20.9),
    trend: +0.7,
    benchmarkLabel: 'Após ajustes não recorrentes',
    icon: <BarChart2 className="w-4 h-4" />,
    type: 'percent',
  },
  {
    id: 8,
    label: 'Margem Líquida',
    value: pct(14.9),
    trend: +1.1,
    benchmarkLabel: 'Lucro / Receita Bruta',
    icon: <TrendingUp className="w-4 h-4" />,
    type: 'percent',
  },
  {
    id: 9,
    label: 'Ind. Despesas Operacionais',
    value: pct(3.1),
    trend: -0.5,
    benchmarkLabel: 'Despesas / Receita Bruta',
    icon: <Activity className="w-4 h-4" />,
    type: 'percent',
  },
  {
    id: 10,
    label: 'Índice de Despesas Rateadas',
    value: pct(39.1),
    trend: -2.3,
    highlight: true,
    benchmarkLabel: 'Despesas Simuladas / Gastos Ligados',
    icon: <AlertTriangle className="w-4 h-4" />,
    type: 'percent',
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
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
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
      className={`relative rounded-xl border p-3.5 flex flex-col gap-2 transition-all group ${
        card.highlight
          ? 'bg-slate-800 border-amber-500/40 shadow-lg shadow-amber-500/5'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[.08em] leading-none">
          {card.id}. {card.label}
        </span>
        <span className={`p-1 rounded-md ${card.highlight ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
          {card.icon}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className={`text-2xl font-black tracking-tight leading-none ${card.highlight ? 'text-amber-300' : 'text-white'}`}>
          {card.value}
        </span>
        <TrendBadge trend={card.trend} />
      </div>
      {card.benchmarkLabel && (
        <p className="text-[9px] text-slate-600 leading-tight truncate">{card.benchmarkLabel}</p>
      )}
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 56;
  const h = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h * 0.8) - h * 0.1;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible opacity-60">
      <polyline
        points={pts}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${h} ${pts} ${w},${h}`}
        fill="url(#spark-grad)"
        opacity="0.2"
      />
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
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
      {/* Moldura do navegador / app window */}
      <div className="rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-black/50 bg-slate-950">

        {/* Barra de título do mockup */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-amber-500/70" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 mx-3">
            <div className="bg-slate-800 rounded-md px-3 py-1 flex items-center gap-2 max-w-xs mx-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-slate-400 truncate font-mono">painel.analisai.me/executivo</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-slate-500">
            <Bell className="w-3.5 h-3.5" />
            <Settings className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Layout interno do app */}
        <div className="flex h-[520px] overflow-hidden">

          {/* Sidebar */}
          <aside className="w-36 bg-slate-900 border-r border-slate-800 flex flex-col gap-0 shrink-0">
            <div className="px-3 py-3 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-white leading-none">Painel</p>
                  <p className="text-[8px] text-slate-500 leading-none mt-0.5">Executivo BPO</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {[
                { label: 'Indicadores', active: true },
                { label: 'DRE Gerencial', active: false },
                { label: 'Fluxo de Caixa', active: false },
                { label: 'Diagnóstico IA', active: false },
                { label: 'Relatórios', active: false },
                { label: 'Simulador', active: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer text-[9px] font-semibold transition-colors ${
                    item.active
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                  {item.active && <ChevronRight className="w-3 h-3" />}
                </div>
              ))}
            </nav>

            <div className="px-2 py-3 border-t border-slate-800">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                <p className="text-[8px] text-emerald-400 font-bold">🟢 Ao vivo</p>
                <p className="text-[8px] text-slate-500 mt-0.5">Atualizado agora</p>
              </div>
            </div>
          </aside>

          {/* Conteúdo principal */}
          <main className="flex-1 overflow-y-auto bg-slate-950 px-4 py-3 space-y-4">

            {/* Cabeçalho */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white">Indicadores Estratégicos Financeiros</h2>
                  <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    CFO Dashboard
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  Empresa: Todas · Período: Jan–Jul/26 (7 meses) · DRE Gerencial
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded-lg font-medium">
                  Exportar
                </span>
                <span className="text-[9px] bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg font-extrabold">
                  + Relatório IA
                </span>
              </div>
            </div>

            {/* Alerta de queda de margem */}
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-300 font-semibold">
                <span className="font-black">Queda de Margem:</span> A margem do FCL caiu 32% em Jul/26 comparado a Jun/26. Verifique os custos deste período.
              </p>
            </div>

            {/* Seção: Indicadores de Performance */}
            <div>
              <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[.1em] flex items-center gap-1.5 mb-2">
                <Activity className="w-3 h-3" /> Indicadores de Performance e Margens (DRE Gerencial)
              </p>
              <div className="grid grid-cols-5 gap-2">
                {METRIC_CARDS.slice(0, 5).map((card) => (
                  <KpiCard key={card.id} card={card} />
                ))}
              </div>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {METRIC_CARDS.slice(5, 10).map((card) => (
                  <KpiCard key={card.id} card={card} />
                ))}
              </div>
            </div>

            {/* Seção: Evolução + DRE Sintética lado a lado */}
            <div className="grid grid-cols-2 gap-3">

              {/* Evolução Mensal */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[.08em] flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 text-amber-400" /> Evolução Mensal — Margem Bruta
                </p>
                <div className="relative h-20 mt-2">
                  <svg viewBox="0 0 280 60" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Linha de grade */}
                    {[15, 30, 45].map((y) => (
                      <line key={y} x1="0" y1={y} x2="280" y2={y} stroke="#1e293b" strokeWidth="1" />
                    ))}
                    {/* Area fill */}
                    <polygon
                      points={`0,60 ${MARGIN_EVOLUTION.map((v, i) => {
                        const x = (i / (MARGIN_EVOLUTION.length - 1)) * 280;
                        const y = 60 - ((v - 35) / 30) * 50;
                        return `${x},${y}`;
                      }).join(' ')} 280,60`}
                      fill="url(#area-grad)"
                    />
                    {/* Linha */}
                    <polyline
                      points={MARGIN_EVOLUTION.map((v, i) => {
                        const x = (i / (MARGIN_EVOLUTION.length - 1)) * 280;
                        const y = 60 - ((v - 35) / 30) * 50;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Pontos */}
                    {MARGIN_EVOLUTION.map((v, i) => {
                      const x = (i / (MARGIN_EVOLUTION.length - 1)) * 280;
                      const y = 60 - ((v - 35) / 30) * 50;
                      return <circle key={i} cx={x} cy={y} r="2.5" fill="#f59e0b" />;
                    })}
                  </svg>
                </div>
                <div className="flex justify-between mt-1">
                  {MONTHS.map((m) => (
                    <span key={m} className="text-[8px] text-slate-600">{m}</span>
                  ))}
                </div>
                {/* Mini tabela lateral */}
                <div className="mt-2 border-t border-slate-800 pt-2 space-y-1">
                  {MONTHS.slice(-5).map((m, i) => (
                    <div key={m} className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500">{m}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-white">{pct(MARGIN_EVOLUTION[i + 2])}</span>
                        {i > 0 && (
                          MARGIN_EVOLUTION[i + 2] > MARGIN_EVOLUTION[i + 1]
                            ? <ArrowUpRight className="w-2.5 h-2.5 text-emerald-400" />
                            : <ArrowDownRight className="w-2.5 h-2.5 text-red-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* DRE Sintética */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[.08em] flex items-center gap-1.5 mb-2">
                  <BarChart2 className="w-3 h-3 text-emerald-400" /> DRE Sintética — Consolidado
                </p>
                <div className="mb-1.5 grid grid-cols-3 text-[8px] font-bold text-slate-500 uppercase tracking-wide px-1">
                  <span className="col-span-1">Estrutura DRE</span>
                  <span className="text-right">Total Acum.</span>
                  <span className="text-right">Média Mensal</span>
                </div>
                <div className="space-y-0.5">
                  {DRE_ROWS.map((row) => (
                    <div
                      key={row.label}
                      className={`grid grid-cols-3 items-center rounded-lg px-2 py-1.5 text-[9px] ${
                        row.highlight
                          ? 'bg-emerald-500/10 border border-emerald-500/30'
                          : 'hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-1 col-span-1 min-w-0">
                        <span className={`shrink-0 ${
                          row.signal === '+'
                            ? 'text-emerald-400'
                            : row.signal === '-'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }`}>
                          {row.signal === '+' && <ArrowUpRight className="w-3 h-3" />}
                          {row.signal === '-' && <ArrowDownRight className="w-3 h-3" />}
                          {row.signal === '=' && <Minus className="w-3 h-3" />}
                        </span>
                        <span className={`font-semibold truncate ${row.highlight ? 'text-emerald-300 font-extrabold' : 'text-slate-300'}`}>
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

                {/* Detalhe da margem final */}
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 font-semibold">Margem Líquida Consolidada</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-emerald-400">9,3%</span>
                    <TrendBadge trend={+1.1} />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção: Fluxo de Caixa */}
            <div>
              <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[.1em] flex items-center gap-1.5 mb-2">
                <Wallet className="w-3 h-3" /> Fluxo de Caixa e Eficiência Operacional
              </p>
              <div className="grid grid-cols-3 gap-2">
                {CASH_FLOW_CARDS.map((c) => (
                  <div
                    key={c.label}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.up ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate">{c.label}</span>
                      </div>
                      <p className="text-sm font-black text-white leading-none">{c.value}</p>
                      <p className="text-[8px] text-slate-600 mt-1 truncate">{c.sub}</p>
                    </div>
                    <MiniSparkline values={c.up ? [310, 340, 280, 390, 370, 410, 395] : [380, 360, 390, 340, 320, 350, 330]} />
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé do painel */}
            <div className="flex items-center justify-between pt-1 pb-1 border-t border-slate-800/60">
              <span className="text-[8px] text-slate-600 font-medium">
                Diagnóstico Analítico BPO · Dados simulados para demonstração
              </span>
              <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Análise IA Ativa
              </span>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
