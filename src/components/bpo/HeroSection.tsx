'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar, ArrowRight, Clock, Shield, Zap, ChevronDown,
  TrendingDown, PiggyBank, Sparkles, CheckCircle2
} from 'lucide-react';
import DashboardMockup from './DashboardMockup';

interface HeroSectionProps {
  waUrl: string;
  scrolled: boolean;
}

export default function HeroSection({ waUrl, scrolled }: HeroSectionProps) {
  return (
    <>
      {/* ── NAVBAR ── */}
      <header className={`fixed inset-x-0 top-0 z-50 px-2 pt-2 sm:px-4 lg:px-6 transition-all duration-300 ${scrolled ? 'pt-1.5 sm:pt-2' : ''}`}>
        <div className={`mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3 rounded-2xl border px-3 py-2 sm:px-4 lg:px-5 transition-all duration-300 ${scrolled ? 'border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-2xl' : 'border-white/10 bg-slate-950/80 shadow-xl backdrop-blur-xl'}`}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="AnalisAI.me — início">
            <Image src="/logo-horizontal.jpg" alt="AnalisAI.me" width={480} height={132} className="h-8 sm:h-10 lg:h-11 w-auto object-contain" priority />
            <span className="hidden 2xl:inline-flex whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-amber-300">BPO Financeiro</span>
          </Link>

          {/* Nav principal */}
          <nav className="hidden items-center gap-3 xl:gap-4 text-xs font-semibold text-slate-300 lg:flex" aria-label="Navegação principal">
            <a href="#planos" className="whitespace-nowrap text-amber-300 hover:text-amber-200 transition-colors">Planos (a partir de R$ 397)</a>
            <a href="#comparativo" className="whitespace-nowrap hover:text-amber-300 transition-colors">Economia vs CLT</a>
            <a href="#entregamos" className="whitespace-nowrap hover:text-amber-300 transition-colors">Como Funciona</a>
            <a href="#setores" className="whitespace-nowrap hover:text-amber-300 transition-colors">Setores</a>
            <a href="#faq" className="whitespace-nowrap hover:text-amber-300 transition-colors">FAQ</a>
            <Link href="/parceiros" className="whitespace-nowrap hover:text-amber-300 transition-colors">Parceiros Contábeis</Link>
            {/* Links secundários sutis — diagnósticos */}
            <div className="flex items-center gap-1 border-l border-slate-700 pl-3 ml-1">
              <Link href="/diagnostico-pj" className="whitespace-nowrap text-slate-400 hover:text-emerald-400 transition-colors text-[11px]">Diagnóstico PJ</Link>
              <span className="text-slate-700">·</span>
              <Link href="/diagnostico-pf" className="whitespace-nowrap text-slate-400 hover:text-emerald-400 transition-colors text-[11px]">Diagnóstico PF</Link>
            </div>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link href="/diagnostico-pj" className="hidden sm:inline-flex rounded-xl border border-emerald-400/30 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/10 transition-colors lg:hidden">Diagnóstico PJ</Link>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="nav-cta-hero"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-extrabold text-slate-950 shadow-lg shadow-emerald-400/20 transition hover:-translate-y-0.5 hover:bg-emerald-300 xl:px-4 xl:py-2.5 xl:text-sm"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline whitespace-nowrap">Agendar Diagnóstico</span>
              <span className="inline xl:hidden">WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-28">

        {/* Fundos decorativos */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_-5%,rgba(245,158,11,0.16),transparent),radial-gradient(circle_at_85%_35%,rgba(16,185,129,0.09),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 bg-grid-amber opacity-20" />
        <div className="pointer-events-none absolute -left-48 top-1/3 h-96 w-96 rounded-full bg-amber-500/8 blur-3xl animate-float" />
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-500/6 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.08fr] gap-10 lg:gap-14 items-center">

            {/* Coluna de texto */}
            <div className="max-w-2xl">
              {/* Badge de urgência e valor */}
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  BPO Financeiro Especializado
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                  Até R$ 43.200 de economia/ano vs CLT
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl font-black leading-[.98] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.5rem] xl:text-[3.9rem]">
                Seu financeiro no piloto automático por{' '}
                <span className="text-shimmer-amber">menos de 1/3 do custo</span> de um funcionário.
              </h1>

              {/* Subheadline */}
              <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-300 max-w-xl">
                A Solucione cuida de toda a rotina — contas a pagar/receber, conciliação diária, DRE e relatórios — com planos a partir de <strong className="text-white font-black">R$ 397/mês</strong>. Sem encargos, sem faltas e com a segurança de um contrato PJ.
              </p>

              {/* Card Destaque: Potencial de Economia Imediata */}
              <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-slate-900/90 to-slate-900/90 p-4 sm:p-5 backdrop-blur-md shadow-xl shadow-emerald-500/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <PiggyBank className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-white">
                          Pensando em contratar para o financeiro?
                        </span>
                        <span className="text-[10px] font-extrabold bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Economia Real
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-snug">
                        CLT Médio: <span className="line-through text-red-400 font-semibold">R$ 5.000/mês</span> → BPO Solucione: <strong className="text-emerald-300 font-bold">R$ 397 a R$ 1.397/mês</strong>.
                        Economia média de <strong className="text-emerald-400 font-black">R$ 43.236 no primeiro ano</strong>.
                      </p>
                    </div>
                  </div>
                  <a
                    href="#comparativo"
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/10 px-3 py-2 rounded-xl shrink-0 transition-colors whitespace-nowrap self-start sm:self-center"
                  >
                    Ver comparativo <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Bullet points de valor */}
              <ul className="mt-5 space-y-2">
                {[
                  { icon: '✓', text: 'Planos inclusivos para MEIs, autônomos e PMEs em expansão' },
                  { icon: '✓', text: 'DRE Gerencial e fluxo de caixa sem você perder horas no operacional' },
                  { icon: '✓', text: 'Dashboard executivo digital em tempo real com parecer mensal' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                    <span className="mt-0.5 shrink-0 text-emerald-400 font-black">{item.icon}</span>
                    {item.text}
                  </li>
                ))}
              </ul>

              {/* CTAs */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="hero-cta-primary"
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-400 px-7 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:-translate-y-1 hover:bg-emerald-300 sm:w-auto w-full"
                >
                  <Calendar className="h-5 w-5" />
                  Agendar Diagnóstico Gratuito
                  <ArrowRight className="h-5 w-5" />
                </a>
                <a
                  href="#planos"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 font-bold text-slate-200 transition hover:border-amber-300/50 hover:text-amber-200"
                >
                  Ver planos e preços
                  <ChevronDown className="h-4 w-4" />
                </a>
              </div>

              {/* Garantias */}
              <div className="mt-4 flex flex-wrap gap-4">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Diagnóstico em 30–45 min
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                  Sem compromisso inicial
                </span>
              </div>
            </div>

            {/* Coluna do mockup com callouts de economia */}
            <div className="relative">
              {/* Callout: Economia anual */}
              <div className="absolute -top-3 -right-2 sm:right-2 z-20 hidden sm:flex items-center gap-2 bg-emerald-500 text-slate-950 rounded-xl px-3.5 py-2 shadow-xl shadow-emerald-500/30 pointer-events-none animate-pulse">
                <TrendingDown className="w-4 h-4 font-black shrink-0" />
                <div>
                  <p className="text-[9px] font-bold leading-none uppercase tracking-wide">Economia vs CLT</p>
                  <p className="text-xs sm:text-sm font-black leading-none mt-0.5">R$ 43.236 / ano</p>
                </div>
              </div>

              {/* Callout: Entrada Acessível */}
              <div className="absolute -bottom-3 -left-2 sm:left-2 z-20 hidden sm:flex items-center gap-2 bg-amber-500 text-slate-950 rounded-xl px-3.5 py-2 shadow-xl shadow-amber-500/30 pointer-events-none">
                <Sparkles className="w-4 h-4 font-black shrink-0" />
                <div>
                  <p className="text-[9px] font-bold leading-none uppercase tracking-wide">Planos Inclusivos</p>
                  <p className="text-xs sm:text-sm font-black leading-none mt-0.5">A partir de R$ 397/mês</p>
                </div>
              </div>

              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
