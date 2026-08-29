'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, ArrowRight, Clock, Shield, Zap, ChevronDown } from 'lucide-react';
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
            <a href="#planos" className="whitespace-nowrap text-amber-300 hover:text-amber-200 transition-colors">Planos</a>
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
      <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-44 sm:pb-24 lg:pb-28">

        {/* Fundos decorativos */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_-5%,rgba(245,158,11,0.16),transparent),radial-gradient(circle_at_85%_35%,rgba(16,185,129,0.09),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 bg-grid-amber opacity-20" />
        <div className="pointer-events-none absolute -left-48 top-1/3 h-96 w-96 rounded-full bg-amber-500/8 blur-3xl animate-float" />
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-500/6 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">

            {/* Coluna de texto */}
            <div className="max-w-2xl">
              {/* Badge de urgência */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[.14em] text-amber-300">
                <Zap className="h-3.5 w-3.5 shrink-0" />
                BPO Financeiro · Apenas 5 vagas/mês
              </div>

              {/* Headline */}
              <h1 className="text-4xl font-black leading-[.96] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.6rem] xl:text-[4rem]">
                Você sabe quanto{' '}
                <span className="text-shimmer-amber">sobra no final</span>{' '}
                do mês?
              </h1>

              {/* Subheadline */}
              <p className="mt-6 text-lg leading-8 text-slate-300 sm:text-xl max-w-xl">
                A Solucione cuida de toda a rotina financeira da sua empresa — contas, conciliação e relatórios gerenciais — para você ter <strong className="text-white font-bold">clareza de caixa</strong> e tempo para crescer.
              </p>

              {/* Bullet points de valor */}
              <ul className="mt-6 space-y-2.5">
                {[
                  { icon: '✓', text: 'DRE Gerencial mensal com análise de margens' },
                  { icon: '✓', text: 'Fluxo de caixa atualizado sem você tocar em nada' },
                  { icon: '✓', text: 'Dashboard executivo com alertas automáticos' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="mt-0.5 shrink-0 text-emerald-400 font-black">{item.icon}</span>
                    {item.text}
                  </li>
                ))}
              </ul>

              {/* CTAs */}
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
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
                  href="#entregamos"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 font-bold text-slate-200 transition hover:border-amber-300/50 hover:text-amber-200"
                >
                  Ver como funciona
                  <ChevronDown className="h-4 w-4" />
                </a>
              </div>

              {/* Garantias */}
              <div className="mt-5 flex flex-wrap gap-4">
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

            {/* Coluna do mockup */}
            <div className="relative">
              {/* Callout: Margem EBITDA */}
              <div className="absolute -top-4 -right-2 sm:right-0 z-20 hidden sm:flex items-center gap-2 bg-amber-500 text-slate-950 rounded-xl px-3 py-2 shadow-xl shadow-amber-500/30 pointer-events-none">
                <span className="text-base font-black leading-none">📈</span>
                <div>
                  <p className="text-[9px] font-bold leading-none uppercase tracking-wide">Margem EBITDA</p>
                  <p className="text-sm font-black leading-none mt-0.5">10,7% <span className="text-[10px] font-bold">↑ jul/26</span></p>
                </div>
              </div>

              {/* Callout: Previsão de Caixa */}
              <div className="absolute -bottom-4 -left-2 sm:left-0 z-20 hidden sm:flex items-center gap-2 bg-emerald-500 text-slate-950 rounded-xl px-3 py-2 shadow-xl shadow-emerald-500/30 pointer-events-none">
                <span className="text-base font-black leading-none">💰</span>
                <div>
                  <p className="text-[9px] font-bold leading-none uppercase tracking-wide">FCL — Fluxo Livre</p>
                  <p className="text-sm font-black leading-none mt-0.5">R$ 1,3M <span className="text-[10px] font-bold">acumulado</span></p>
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
