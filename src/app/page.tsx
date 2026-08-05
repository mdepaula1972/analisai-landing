'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BarChart3, Cpu, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 flex flex-col">

      {/* ── NAVBAR ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <Image src="/logo.png" alt="AnalisAI.me" width={160} height={44} className="h-10 w-auto object-contain" priority />
          <a href="mailto:contato@analisai.me" className="text-xs text-slate-400 hover:text-emerald-400 transition-colors hidden sm:block">
            contato@analisai.me
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4 pt-24 pb-20">

        {/* Backgrounds */}
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12),transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none animate-float" />
        <div className="absolute bottom-10 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none animate-float delay-300" />

        <div className={`relative z-10 text-center max-w-4xl mx-auto transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          {/* Logo grande */}
          <div className="flex justify-center mb-8">
            <div className="relative p-1">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 rounded-2xl blur-xl" />
              <Image
                src="/logo.png"
                alt="AnalisAI.me — Inteligência Financeira"
                width={360}
                height={100}
                className="relative h-20 w-auto object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>

          {/* Tagline */}
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4 animate-fadeIn">
            Plataforma de Inteligência Financeira
          </p>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight animate-fadeInUp">
            Decisões financeiras <br className="hidden sm:block" />
            <span className="text-shimmer">mais inteligentes</span>,{' '}
            <span className="text-shimmer-amber">mais seguras</span>.
          </h1>

          <p className="text-slate-400 text-lg max-w-xl mx-auto mb-14 leading-relaxed animate-fadeInUp delay-200">
            Escolha a solução ideal para o momento do seu negócio.
          </p>

          {/* Cards de serviços */}
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto animate-fadeInUp delay-300">

            {/* Card BPO */}
            <Link
              href="/bpo"
              id="card-bpo"
              className="group relative bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-8 text-left transition-all duration-300 card-glow-amber overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />

              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:bg-amber-500/20 transition-colors">
                <BarChart3 className="w-7 h-7" />
              </div>

              <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full mb-4">
                Disponível Agora
              </span>

              <h2 className="text-2xl font-extrabold text-white mb-2 group-hover:text-amber-300 transition-colors">
                BPO Financeiro
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Terceirize o financeiro da sua empresa com especialistas e tecnologia. Contas a pagar/receber, DRE, fluxo de caixa e muito mais.
              </p>

              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                Conhecer o serviço
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </Link>

            {/* Card AnalisAI */}
            <Link
              href="/analisai"
              id="card-analisai"
              className="group relative bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-8 text-left transition-all duration-300 card-glow overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />

              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:bg-emerald-500/20 transition-colors">
                <Cpu className="w-7 h-7" />
              </div>

              <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full mb-4">
                IA Preditiva — Beta
              </span>

              <h2 className="text-2xl font-extrabold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                AnalisAI.me
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Simulações financeiras com IA e análise preditiva de fluxo de caixa, sem integração bancária. Decisões estratégicas com total segurança.
              </p>

              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                Experimentar a IA
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </Link>

          </div>

          {/* Seta de escolha */}
          <p className="text-slate-600 text-xs mt-10 flex items-center justify-center gap-1">
            <ChevronRight className="w-3.5 h-3.5" />
            Selecione o serviço que melhor atende sua necessidade
          </p>
        </div>
      </main>

      {/* ── FOOTER MINIMALISTA ── */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-slate-600 text-xs">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© {new Date().getFullYear()} AnalisAI.me — Todos os direitos reservados.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-slate-400 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Termos de Uso</a>
            <a href="mailto:contato@analisai.me" className="hover:text-slate-400 transition-colors">Contato</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
