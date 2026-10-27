'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Shield, Zap, ChevronDown,
  Sparkles, MessageCircle, FileText, Check
} from 'lucide-react';
import DashboardMockup from './DashboardMockup';
import { WHATSAPP } from '@/lib/contact';

interface HeroSectionProps {
  waUrl: string;
  scrolled: boolean;
}

export default function HeroSection({ waUrl, scrolled }: HeroSectionProps) {
  const soloUrl = WHATSAPP.soloTeste || waUrl;

  return (
    <>
      {/* ── NAVBAR ── */}
      <header className={`fixed inset-x-0 top-0 z-50 px-2 pt-2 sm:px-4 lg:px-6 transition-all duration-300 ${scrolled ? 'pt-1.5 sm:pt-2' : ''}`}>
        <div className={`mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3 rounded-2xl border px-3 py-2 sm:px-4 lg:px-5 transition-all duration-300 ${scrolled ? 'border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-2xl' : 'border-white/10 bg-slate-950/80 shadow-xl backdrop-blur-xl'}`}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="AnalisAI.me — início">
            <Image src="/logo-horizontal.jpg" alt="AnalisAI.me" width={480} height={132} className="h-8 sm:h-10 lg:h-11 w-auto object-contain" priority />
            <span className="hidden 2xl:inline-flex whitespace-nowrap rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-emerald-300">IA no WhatsApp</span>
          </Link>

          {/* Nav principal */}
          <nav className="hidden items-center gap-4 xl:gap-6 text-xs font-semibold text-slate-300 lg:flex" aria-label="Navegação principal">
            <a href="#como-funciona" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Como Funciona</a>
            <a href="#comparativo" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Por que o AnalisAí?</a>
            <a href="#entregamos" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Relatório em PDF</a>
            <a href="#planos" className="whitespace-nowrap text-amber-300 hover:text-amber-200 transition-colors">Planos (a partir de R$ 39,90)</a>
            <a href="#faq" className="whitespace-nowrap hover:text-emerald-300 transition-colors">Dúvidas Frequentes</a>
            <Link href="/parceiros" className="whitespace-nowrap hover:text-emerald-300 transition-colors text-slate-400 text-[11px]">Parceiros Contábeis</Link>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#planos"
              className="hidden sm:inline-flex rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              Planos & Preços
            </a>
            <a
              href={soloUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="nav-cta-hero"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-black text-slate-950 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5 hover:bg-emerald-300 xl:px-4 xl:py-2.5 xl:text-sm"
            >
              <MessageCircle className="h-4 w-4 shrink-0 fill-slate-950 stroke-none" />
              <span>Testar no WhatsApp</span>
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
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  IA Nativa no WhatsApp
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-300">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  Planos a partir de R$ 39,90/mês
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3.1rem] font-black leading-[1.08] tracking-[-0.03em] text-white">
                Organize o caixa da sua empresa pelo WhatsApp com Inteligência Artificial.{' '}
                <span className="text-shimmer-emerald block mt-1.5 sm:inline">Zero senhas de banco. Zero risco.</span>
              </h1>

              {/* Subheadline */}
              <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-300 max-w-xl">
                Você não precisa conectar suas contas bancárias nem arriscar seu dinheiro. Envie fotos de notas, boletos ou áudios: o <strong className="text-white">AnalisAí</strong> audita seus gastos, protege seu teto fiscal e deixa tudo pronto para o seu contador.
              </p>

              {/* Card Destaque: Como funciona na prática (3 Passos) */}
              <div id="como-funciona" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 backdrop-blur-md shadow-xl">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Como funciona em 3 passos simples:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Passo 1</span>
                    <strong className="text-white block mb-0.5">📸 Envie o Boleto</strong>
                    <span className="text-slate-400 text-[11px] leading-snug">Foto, PDF ou áudio de despesa no WhatsApp.</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Passo 2</span>
                    <strong className="text-emerald-300 block mb-0.5">🤖 IA Organiza</strong>
                    <span className="text-slate-400 text-[11px] leading-snug">Lê valor, vencimento e credor em segundos.</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Passo 3</span>
                    <strong className="text-amber-300 block mb-0.5">📄 Relatório em PDF</strong>
                    <span className="text-slate-400 text-[11px] leading-snug">Livro Caixa com contas atrasadas e a vencer.</span>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={soloUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="hero-cta-primary"
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-400 px-7 py-4 text-base font-black text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:-translate-y-1 hover:bg-emerald-300 sm:w-auto w-full"
                >
                  <MessageCircle className="h-5 w-5 fill-slate-950 stroke-none" />
                  Testar Grátis no WhatsApp
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

              {/* ── SELOS DE CONFIANÇA (BADGES VISÍVEIS LOGO ABAIXO DO BOTÃO DE TESTE) ── */}
              <div className="mt-7 pt-4 border-t border-slate-800/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 hover:border-emerald-500/30 transition-colors shadow-sm">
                    <span className="text-lg shrink-0 select-none">🛡️</span>
                    <div className="text-xs">
                      <strong className="text-white font-bold block">100% Seguro</strong>
                      <span className="text-slate-400 text-[11px] leading-snug">Não pedimos senhas, tokens nem acessos bancários.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 hover:border-emerald-500/30 transition-colors shadow-sm">
                    <span className="text-lg shrink-0 select-none">🚫</span>
                    <div className="text-xs">
                      <strong className="text-white font-bold block">Sem Transações</strong>
                      <span className="text-slate-400 text-[11px] leading-snug">Não movimentamos seu dinheiro. Você mantém o controle no seu banco.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 hover:border-amber-500/30 transition-colors shadow-sm">
                    <span className="text-lg shrink-0 select-none">👩‍💼</span>
                    <div className="text-xs">
                      <strong className="text-white font-bold block">Seguro para sua Equipe</strong>
                      <span className="text-slate-400 text-[11px] leading-snug">Sua secretária ou ajudante pode lançar contas sem nunca ver seus saldos ou lucros.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 hover:border-amber-500/30 transition-colors shadow-sm">
                    <span className="text-lg shrink-0 select-none">📑</span>
                    <div className="text-xs">
                      <strong className="text-white font-bold block">Pronto pro Contador</strong>
                      <span className="text-slate-400 text-[11px] leading-snug">Fechamento mensal em CSV e notas fiscais organizadas em um clique.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Degustação gratuita imediata
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    Sem cartão de crédito
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-amber-400" />
                    Relatório oficial com seu CNPJ
                  </span>
                </div>
              </div>
            </div>

            {/* Coluna do mockup com callouts de economia */}
            <div className="relative">
              {/* Callout: WhatsApp em Tempo Real */}
              <div className="absolute -top-3 -right-2 sm:right-2 z-20 hidden sm:flex items-center gap-2 bg-emerald-500 text-slate-950 rounded-xl px-3.5 py-2 shadow-xl shadow-emerald-500/30 pointer-events-none animate-pulse">
                <MessageCircle className="w-4 h-4 font-black shrink-0 fill-slate-950 stroke-none" />
                <div>
                  <p className="text-[9px] font-bold leading-none uppercase tracking-wide">WhatsApp Oficial</p>
                  <p className="text-xs sm:text-sm font-black leading-none mt-0.5">Boleto Lido em 2 seg</p>
                </div>
              </div>

              {/* Callout: PDF Executivo */}
              <div className="absolute -bottom-3 -left-2 sm:left-2 z-20 hidden sm:flex items-center gap-2 bg-amber-400 text-slate-950 rounded-xl px-3.5 py-2 shadow-xl shadow-amber-500/30 pointer-events-none">
                <FileText className="w-4 h-4 font-black shrink-0" />
                <div>
                  <p className="text-[9px] font-bold leading-none uppercase tracking-wide">Relatório com CNPJ</p>
                  <p className="text-xs sm:text-sm font-black leading-none mt-0.5">PDF Executivo no Zap</p>
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
