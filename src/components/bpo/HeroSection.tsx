'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Shield, Zap, ChevronDown,
  Sparkles, MessageCircle, FileText, Check,
  Building2, Smartphone, Settings, ShieldCheck,
  TrendingUp, BarChart3, Lock
} from 'lucide-react';
import DashboardMockup from './DashboardMockup';

interface HeroSectionProps {
  scrolled: boolean;
}

export const WA_DIAGNOSTICO =
  'https://wa.me/5513920099874?text=Ol%C3%A1%2C%20gostaria%20de%20um%20diagn%C3%B3stico%20financeiro%20para%20minha%20empresa';

export default function HeroSection({ scrolled }: HeroSectionProps) {
  return (
    <>
      {/* ── NAVBAR ── */}
      <header className={`fixed inset-x-0 top-0 z-50 px-2 pt-2 sm:px-4 lg:px-6 transition-all duration-300 ${scrolled ? 'pt-1.5 sm:pt-2' : ''}`}>
        <div className={`mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3 rounded-2xl border px-3 py-2 sm:px-4 lg:px-5 transition-all duration-300 ${scrolled ? 'border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-2xl' : 'border-white/10 bg-slate-950/80 shadow-xl backdrop-blur-xl'}`}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="AnalisAI.me — início">
            <Image src="/logo-horizontal.jpg" alt="AnalisAI.me" width={480} height={132} className="h-8 sm:h-10 lg:h-11 w-auto object-contain" priority />
            <span className="hidden xl:inline-flex whitespace-nowrap rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
              Controladoria & BPO
            </span>
          </Link>

          {/* Nav principal */}
          <nav className="hidden items-center gap-4 lg:gap-5 text-xs font-semibold text-slate-300 lg:flex" aria-label="Navegação principal">
            <a href="#como-funciona" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Como Funciona</a>
            <a href="#pilares" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Pilares BPO</a>
            <a href="#contadores" className="whitespace-nowrap hover:text-emerald-300 transition-colors text-amber-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Para Contadores
            </a>
            <a href="#comparativo" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Diferenciais</a>
            <a href="#proposta" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Diagnóstico</a>
            <a href="#faq" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Dúvidas</a>
          </nav>

          {/* Portais & CTA */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Acesso Cliente */}
            <Link
              href="/portal"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:border-emerald-500/40 transition-colors"
              title="Acessar Área do Cliente"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Área do Cliente</span>
              <span className="md:hidden">Cliente</span>
            </Link>

            {/* Portal do Contador */}
            <Link
              href="/contador"
              className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-bold text-amber-300/90 hover:text-amber-200 hover:border-amber-500/40 transition-colors"
              title="Acessar Portal do Escritório Contábil"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Contador</span>
            </Link>

            {/* Torre BPO */}
            <Link
              href="/admin/bpo"
              className="hidden xl:inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
              title="Acessar Torre de Controle Operacional"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Gestor</span>
            </Link>

            {/* CTA Diagnóstico */}
            <a
              href={WA_DIAGNOSTICO}
              target="_blank"
              rel="noopener noreferrer"
              id="nav-cta-hero"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5 hover:bg-emerald-300 sm:px-3.5 sm:py-2"
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0 fill-slate-950 stroke-none" />
              <span>Diagnóstico</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-28">

        {/* Fundos decorativos */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_-5%,rgba(16,185,129,0.18),transparent),radial-gradient(circle_at_85%_35%,rgba(245,158,11,0.12),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 bg-grid-amber opacity-20" />
        <div className="pointer-events-none absolute -left-48 top-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl animate-float" />
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.08fr] gap-10 lg:gap-14 items-center">

            {/* Coluna de texto */}
            <div className="max-w-2xl">
              {/* Badges de destaque */}
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  Controladoria Financeira Terceirizada
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-300">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  Parceria Oficial com Escritórios Contábeis
                </span>
              </div>

              {/* Headline Oficial Reestruturada */}
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3.1rem] font-black leading-[1.1] tracking-[-0.03em] text-white">
                Controladoria Financeira Terceirizada e{' '}
                <span className="text-shimmer-emerald block mt-1">BPO Inteligente</span>
              </h1>

              {/* Subheadline Oficial Reestruturada */}
              <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-300 max-w-xl">
                Elimine o trabalho operacional de contas a pagar, receber e conciliação bancária direto pelo WhatsApp. Sua empresa organizada e sua contabilidade abastecida até o 5º dia útil.
              </p>

              {/* Botões de Ação Primária (CTAs Conforme Ordem de Engenharia) */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Botão 1: Solicitar Diagnóstico */}
                <a
                  href={WA_DIAGNOSTICO}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="hero-cta-diagnostico"
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-400 px-7 py-4 text-base font-black text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:-translate-y-1 hover:bg-emerald-300 sm:w-auto w-full"
                >
                  <MessageCircle className="h-5 w-5 fill-slate-950 stroke-none" />
                  Solicitar Diagnóstico Financeiro
                  <ArrowRight className="h-5 w-5" />
                </a>

                {/* Botão 2: Sou Escritório Contábil */}
                <a
                  href="#contadores"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-6 py-4 font-bold text-amber-200 transition hover:bg-amber-500/20 hover:border-amber-400"
                >
                  <Building2 className="h-5 w-5 text-amber-400" />
                  Sou Escritório Contábil
                </a>
              </div>

              {/* ── SELOS DE CONFIANÇA BPO & SEGURANÇA ── */}
              <div className="mt-8 pt-5 border-t border-slate-800/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 hover:border-emerald-500/30 transition-colors shadow-sm">
                    <span className="text-lg shrink-0 select-none">🛡️</span>
                    <div className="text-xs">
                      <strong className="text-white font-bold block">Protocolo Zero Banking Access</strong>
                      <span className="text-slate-400 text-[11px] leading-snug">Nunca pedimos senhas, tokens ou acesso ao seu internet banking.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 hover:border-emerald-500/30 transition-colors shadow-sm">
                    <span className="text-lg shrink-0 select-none">📦</span>
                    <div className="text-xs">
                      <strong className="text-white font-bold block">Pacote Fiscal até o 5º Dia Útil</strong>
                      <span className="text-slate-400 text-[11px] leading-snug">ZIP pronto com Livro Caixa, DRE, CSV contábil e comprovantes.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 hover:border-amber-500/30 transition-colors shadow-sm">
                    <span className="text-lg shrink-0 select-none">📊</span>
                    <div className="text-xs">
                      <strong className="text-white font-bold block">Radar Semanal & DRE Analítica</strong>
                      <span className="text-slate-400 text-[11px] leading-snug">Projeção de saldo livre toda segunda-feira e fechamento mensal claro.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 hover:border-amber-500/30 transition-colors shadow-sm">
                    <span className="text-lg shrink-0 select-none">👥</span>
                    <div className="text-xs">
                      <strong className="text-white font-bold block">Modelo Híbrido Pessoal & IA</strong>
                      <span className="text-slate-400 text-[11px] leading-snug">A agilidade da IA no WhatsApp com conferência de controladoria humana.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Diagnóstico inicial sem compromisso
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    Total soberania e segurança jurídica
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-amber-400" />
                    Contabilidade abastecida pontualmente
                  </span>
                </div>
              </div>
            </div>

            {/* Coluna do mockup com callouts de BPO */}
            <div className="relative">
              {/* Callout: WhatsApp Operacional */}
              <div className="absolute -top-3 -right-2 sm:right-2 z-20 hidden sm:flex items-center gap-2 bg-emerald-500 text-slate-950 rounded-xl px-3.5 py-2 shadow-xl shadow-emerald-500/30 pointer-events-none animate-pulse">
                <MessageCircle className="w-4 h-4 font-black shrink-0 fill-slate-950 stroke-none" />
                <div>
                  <p className="text-[9px] font-bold leading-none uppercase tracking-wide">WhatsApp Oficial</p>
                  <p className="text-xs sm:text-sm font-black leading-none mt-0.5">Contas e Comprovantes em Segundos</p>
                </div>
              </div>

              {/* Callout: Pacote Fiscal */}
              <div className="absolute -bottom-3 -left-2 sm:left-2 z-20 hidden sm:flex items-center gap-2 bg-amber-400 text-slate-950 rounded-xl px-3.5 py-2 shadow-xl shadow-amber-500/30 pointer-events-none">
                <FileText className="w-4 h-4 font-black shrink-0" />
                <div>
                  <p className="text-[9px] font-bold leading-none uppercase tracking-wide">Para seu Contador</p>
                  <p className="text-xs sm:text-sm font-black leading-none mt-0.5">Pacote Fiscal em .ZIP até o 5º Dia Útil</p>
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
