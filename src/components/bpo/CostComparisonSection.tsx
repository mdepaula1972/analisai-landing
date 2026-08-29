'use client';

import React from 'react';
import {
  X, Check, TrendingDown, ShieldCheck, Calendar,
  ArrowRight, Sparkles, AlertTriangle, Clock,
} from 'lucide-react';
import { WHATSAPP } from '@/lib/contact';

// ── Dados comparativos ───────────────────────────────────────────────────────

const LINHAS = [
  {
    criterio: 'Custo Mensal',
    icone: <TrendingDown className="w-4 h-4" />,
    clt: {
      valor: 'R$ 3.500 a R$ 6.000+',
      detalhe: 'Salário + FGTS + INSS + Férias + 13º + Benefícios',
      negativo: true,
    },
    bpo: {
      valor: 'A partir de R$ 990/mês',
      detalhe: 'Previsível, fixo e sem encargos ou surpresas',
      positivo: true,
    },
  },
  {
    criterio: 'Continuidade & Disponibilidade',
    icone: <Clock className="w-4 h-4" />,
    clt: {
      valor: 'Vulnerável',
      detalhe: 'Férias, atestados, faltas e pedidos de demissão paralisam o financeiro',
      negativo: true,
    },
    bpo: {
      valor: 'Operação 365 dias/ano',
      detalhe: 'Equipe dedicada garante continuidade sem interrupções',
      positivo: true,
    },
  },
  {
    criterio: 'Tecnologia & Entregas',
    icone: <Sparkles className="w-4 h-4" />,
    clt: {
      valor: 'Planilhas manuais',
      detalhe: 'Lançamentos sujeitos a erros, sem visão gerencial estruturada',
      negativo: true,
    },
    bpo: {
      valor: 'DRE + Dashboard em tempo real',
      detalhe: 'Conciliação diária, relatórios gerenciais e painel executivo digital',
      positivo: true,
    },
  },
  {
    criterio: 'Risco & Confidencialidade',
    icone: <ShieldCheck className="w-4 h-4" />,
    clt: {
      valor: 'Alto risco trabalhista',
      detalhe: 'Passivo trabalhista latente e exposição de salários, pró-labore e margens',
      negativo: true,
    },
    bpo: {
      valor: 'Contrato PJ + NDA rigoroso',
      detalhe: 'Cláusula de sigilo, LGPD e flexibilidade de encerramento sem multa',
      positivo: true,
    },
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function CostComparisonSection() {
  return (
    <section
      id="comparativo"
      className="relative py-20 sm:py-28 overflow-hidden border-y border-slate-800/60 bg-slate-900/30"
    >
      {/* Fundos decorativos */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(245,158,11,0.07),transparent)]" />
      <div className="pointer-events-none absolute top-0 left-1/4 w-96 h-96 rounded-full bg-red-500/3 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-red-300 mb-6">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            O custo oculto da contratação CLT
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.05] tracking-tight mb-5">
            Contratar um funcionário para o financeiro{' '}
            <span className="text-red-400">custa caro</span>, dá dor de cabeça{' '}
            e deixa sua empresa{' '}
            <span className="text-red-400">refém</span>.
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Tenha a rotina de contas, conciliação diária e a visão analítica de um CFO por{' '}
            <strong className="text-white">menos da metade do custo de uma contratação CLT</strong>{' '}
            — sem encargos, faltas ou passivo trabalhista.
          </p>
        </div>

        {/* ── DESKTOP: Tabela comparativa ── */}
        <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-800 shadow-2xl shadow-black/40">

          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-[2fr_1.5fr_1.5fr] bg-slate-900 border-b border-slate-800">
            <div className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              Critério de Comparação
            </div>
            <div className="px-6 py-4 border-l border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-200">Funcionário CLT</p>
                  <p className="text-[10px] text-slate-500">Modelo tradicional</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-l border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-emerald-300">BPO Especializado</p>
                  <p className="text-[10px] text-emerald-500/70">Mais eficiente</p>
                </div>
                <span className="ml-auto text-[9px] font-extrabold bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                  Recomendado
                </span>
              </div>
            </div>
          </div>

          {/* Linhas */}
          {LINHAS.map((linha, i) => (
            <div
              key={linha.criterio}
              className={`grid grid-cols-[2fr_1.5fr_1.5fr] transition-colors ${
                i % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/60'
              } border-b border-slate-800/60 last:border-0`}
            >
              {/* Critério */}
              <div className="px-6 py-5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">
                  {linha.icone}
                </div>
                <span className="text-sm font-bold text-slate-200">{linha.criterio}</span>
              </div>

              {/* CLT */}
              <div className="px-6 py-5 border-l border-slate-800/60">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-300 mb-1">{linha.clt.valor}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{linha.clt.detalhe}</p>
                  </div>
                </div>
              </div>

              {/* BPO */}
              <div className="px-6 py-5 border-l border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-300 mb-1">{linha.bpo.valor}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{linha.bpo.detalhe}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── MOBILE: Cards empilhados ── */}
        <div className="lg:hidden space-y-4">
          {LINHAS.map((linha) => (
            <div key={linha.criterio} className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900">

              {/* Critério */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                  {linha.icone}
                </div>
                <span className="text-sm font-extrabold text-white">{linha.criterio}</span>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-800">
                {/* CLT */}
                <div className="px-4 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                      <X className="w-2.5 h-2.5 text-red-400" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">CLT</span>
                  </div>
                  <p className="text-xs font-bold text-red-300 mb-1.5">{linha.clt.valor}</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{linha.clt.detalhe}</p>
                </div>

                {/* BPO */}
                <div className="px-4 py-4 bg-emerald-500/5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">BPO</span>
                  </div>
                  <p className="text-xs font-bold text-emerald-300 mb-1.5">{linha.bpo.valor}</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{linha.bpo.detalhe}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bloco de poupança estimada */}
        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <TrendingDown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Economia potencial no primeiro ano</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparando custo CLT médio (R$ 5.000/mês) vs. Plano Gestão BPO (R$ 1.890/mês)
              </p>
            </div>
          </div>
          <div className="text-center shrink-0">
            <p className="text-3xl font-black text-amber-300">R$ 37.320</p>
            <p className="text-xs text-amber-400/70 font-semibold">de economia estimada/ano</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <a
            href={WHATSAPP.planoGestao}
            target="_blank"
            rel="noopener noreferrer"
            id="comparativo-cta-whatsapp"
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-8 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:-translate-y-1 hover:bg-emerald-300 w-full sm:w-auto"
          >
            <ShieldCheck className="h-5 w-5 shrink-0" />
            Reduzir Custos e Blindar meu Financeiro
            <ArrowRight className="h-5 w-5 shrink-0" />
          </a>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Diagnóstico gratuito de 30–45 min
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Sem compromisso de contratação
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Proposta personalizada para sua empresa
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
