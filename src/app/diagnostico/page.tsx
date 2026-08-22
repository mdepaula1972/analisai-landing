'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, ChevronDown,
  FileText, Zap, Shield, Clock, Star,
  AlertTriangle, TrendingDown, HelpCircle,
  ClipboardList, BarChart3, Mail, Lock,
  ChevronRight, Sparkles, Users, DollarSign,
} from 'lucide-react';

/* ── CONFIGURAÇÃO ── */
const VERSION = 'v1.0 · 22/08/2026';

// Substitua pela URL real do link de pagamento Asaas quando disponível
const LINK_PAGAMENTO = 'https://wa.me/5514930855878?text=' + encodeURIComponent('Olá! Quero contratar o Diagnóstico Financeiro por R$ 197. Como prossigo?');

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function FaqItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-2xl transition-all duration-300 overflow-hidden ${open ? 'border-amber-500/40 bg-slate-900/80' : 'border-slate-800 bg-slate-900/40'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left gap-4 group"
        aria-expanded={open}
      >
        <span className={`font-semibold text-sm sm:text-base transition-colors ${open ? 'text-amber-400' : 'text-slate-200 group-hover:text-white'}`}>
          {question}
        </span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180 text-amber-400' : ''}`} />
      </button>
      <div className={`transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-6 pb-6 text-slate-400 text-sm leading-relaxed">{answer}</div>
      </div>
    </div>
  );
}

function CtaButton({ id, className }: { id: string; className?: string }) {
  return (
    <a
      href={LINK_PAGAMENTO}
      target="_blank"
      rel="noopener noreferrer"
      id={id}
      className={`inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-8 py-5 rounded-2xl shadow-2xl shadow-amber-500/30 transition-all duration-200 hover:scale-[1.04] hover:shadow-amber-500/50 text-base sm:text-lg group ${className ?? ''}`}
    >
      <Sparkles className="w-5 h-5 flex-shrink-0" />
      Quero meu diagnóstico — R$ 197
      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
    </a>
  );
}

export default function DiagnosticoPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const [heroRef, heroInView] = useInView(0.05);
  const [problemaRef, problemaInView] = useInView();
  const [comoRef, comoInView] = useInView();
  const [relatorioRef, relatorioInView] = useInView();
  const [autorRef, autorInView] = useInView();
  const [precoRef, precoInView] = useInView();
  const [faqRef, faqInView] = useInView();

  const problemas = [
    {
      icon: <TrendingDown className="w-6 h-6 text-red-400" />,
      text: 'Fatura bem, mas o dinheiro nunca sobra',
    },
    {
      icon: <HelpCircle className="w-6 h-6 text-orange-400" />,
      text: 'Não sabe se o problema é custo, preço ou volume',
    },
    {
      icon: <Users className="w-6 h-6 text-slate-400" />,
      text: 'Contratar um financeiro fixo não faz sentido pro tamanho do seu negócio ainda',
    },
    {
      icon: <FileText className="w-6 h-6 text-slate-400" />,
      text: 'Contador cuida da obrigação fiscal, não da estratégia do seu caixa',
    },
  ];

  const passos = [
    {
      num: '1',
      icon: <ClipboardList className="w-8 h-8 text-amber-400" />,
      titulo: 'Você preenche',
      desc: 'Um formulário simples — sem jargão contábil — com os números do seu negócio: faturamento, custos, despesas fixas dos últimos meses.',
    },
    {
      num: '2',
      icon: <BarChart3 className="w-8 h-8 text-amber-400" />,
      titulo: 'A gente analisa',
      desc: 'Rodamos seus dados no nosso motor de análise financeira e simulamos cenários reais para o seu negócio.',
    },
    {
      num: '3',
      icon: <Mail className="w-8 h-8 text-amber-400" />,
      titulo: 'Você recebe',
      desc: 'Um relatório em PDF, em linguagem simples, com o diagnóstico e recomendações práticas — direto no seu e-mail ou WhatsApp.',
    },
  ];

  const itensRelatorio = [
    { icon: <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />, texto: 'DRE organizado a partir dos seus dados' },
    { icon: <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />, texto: 'Diagnóstico em linguagem simples — onde o dinheiro está vazando' },
    { icon: <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />, texto: '2 a 3 cenários simulados (ex: "e se eu cortar este custo", "e se eu contratar mais uma pessoa")' },
    { icon: <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />, texto: 'Comparação com o padrão esperado para o seu setor' },
    { icon: <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />, texto: 'Recomendação de próximo passo concreto' },
    { icon: <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />, texto: 'PDF pronto para mostrar a sócio, contador ou banco' },
  ];

  const faqs = [
    {
      question: 'Preciso ter contador ou sistema de gestão?',
      answer: 'Não. Só precisa saber (ou conseguir estimar) seu faturamento e principais custos dos últimos meses.',
    },
    {
      question: 'É uma consultoria com reunião?',
      answer: 'Não. Todo o processo é assíncrono — formulário, pagamento, entrega. Se tiver dúvida sobre o relatório, pode perguntar por mensagem.',
    },
    {
      question: 'Meus dados ficam seguros?',
      answer: (
        <>
          Sim. Seus dados são usados exclusivamente para gerar o seu diagnóstico e não são compartilhados com terceiros.{' '}
          <Link href="/privacidade" className="text-amber-400 hover:underline">
            Ver política de privacidade
          </Link>
          .
        </>
      ),
    },
    {
      question: 'Isso é o mesmo que o AnalisAí?',
      answer: 'É a porta de entrada. O diagnóstico é uma foto única do seu momento financeiro. O AnalisAí é o acompanhamento contínuo, mês a mês.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 relative">

      {/* ── BADGE DE VERSÃO (debug/confirmação de deploy) ── */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/40 bg-slate-950/90 backdrop-blur-sm text-amber-400 text-[10px] font-bold font-mono shadow-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Diagnóstico Financeiro {VERSION}
      </div>

      {/* ── NAVBAR ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 shadow-xl shadow-black/30' : 'bg-transparent'}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-start justify-center gap-0.5">
            <Image
              src="/logo.png"
              alt="AnalisAI.me — Inteligência Financeira"
              width={200}
              height={55}
              className="h-10 w-auto object-contain"
              priority
            />
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400/80">
              Diagnóstico Financeiro
            </span>
          </Link>

          <a
            href={LINK_PAGAMENTO}
            target="_blank"
            rel="noopener noreferrer"
            id="nav-cta-diagnostico"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-[1.03] shadow-lg shadow-amber-500/25 text-sm flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Quero por R$ 197
          </a>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 1 — HERÓI */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="relative pt-36 pb-28 overflow-hidden" aria-label="Apresentação">
        {/* Backgrounds decorativos */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(245,158,11,0.18),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-grid-amber opacity-20 pointer-events-none" />
        <div className="absolute top-1/3 -left-48 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute top-1/4 -right-48 w-80 h-80 bg-amber-600/6 rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: '3s' }} />

        <div
          ref={heroRef}
          className={`max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center transition-all duration-700 ${heroInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-8">
            <Zap className="w-3.5 h-3.5" />
            100% Virtual · Sem Reunião · Sem Assinatura
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.08]">
            Descubra onde seu dinheiro está{' '}
            <span className="text-shimmer-amber">vazando.</span>
            <br />
            <span className="text-slate-300 font-bold text-3xl sm:text-4xl lg:text-5xl">
              Sem reunião, sem compromisso mensal.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Um diagnóstico financeiro completo do seu negócio, feito por quem entende de gestão financeira há{' '}
            <span className="text-white font-semibold">40 anos</span>. Você preenche um formulário, a gente analisa, você recebe um relatório claro em até{' '}
            <span className="text-amber-400 font-semibold">72h</span>.
          </p>

          {/* CTA principal */}
          <div className="flex flex-col items-center gap-4">
            <CtaButton id="hero-cta" />

            <p className="text-slate-400 text-sm max-w-md">
              Feito para donos de pequenos negócios do{' '}
              <span className="text-slate-300 font-medium">Simples Nacional</span> que não têm — e não precisam ter — um financeiro em tempo integral.
            </p>
          </div>

          {/* Mini trust bar */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-slate-500 text-xs font-medium">
            {[
              { icon: <Clock className="w-4 h-4 text-amber-400" />, label: 'Entrega em até 72h' },
              { icon: <Shield className="w-4 h-4 text-emerald-400" />, label: 'Dados protegidos por contrato' },
              { icon: <Lock className="w-4 h-4 text-emerald-400" />, label: 'Sem acesso à sua conta bancária' },
              { icon: <Star className="w-4 h-4 text-amber-400" />, label: '40 anos de experiência' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 2 — O PROBLEMA */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="py-20 relative" aria-label="O problema">
        <div className="absolute inset-0 bg-slate-900/40 pointer-events-none" />

        <div
          ref={problemaRef}
          className={`max-w-3xl mx-auto px-4 sm:px-6 relative z-10 transition-all duration-700 ${problemaInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
              <AlertTriangle className="w-3.5 h-3.5" />
              Reconhece isso?
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              Você sabe que algo não está certo nas contas,{' '}
              <span className="text-slate-400">mas não sabe exatamente o quê.</span>
            </h2>
          </div>

          <div className="grid gap-4">
            {problemas.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-colors duration-200"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="p-2.5 rounded-xl bg-slate-800/80 flex-shrink-0">
                  {p.icon}
                </div>
                <p className="text-slate-200 font-medium leading-relaxed text-sm sm:text-base">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 3 — COMO FUNCIONA */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="py-20" aria-label="Como funciona">
        <div
          ref={comoRef}
          className={`max-w-5xl mx-auto px-4 sm:px-6 transition-all duration-700 ${comoInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Zap className="w-3.5 h-3.5" />
              Zero fricção
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3">
              Como funciona
            </h2>
            <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
              Sem call. Sem agenda. Sem enrolação.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 relative">
            {/* Linha conectora desktop */}
            <div className="hidden sm:block absolute top-16 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-gradient-to-r from-amber-500/40 via-amber-500/20 to-amber-500/40 pointer-events-none" />

            {passos.map((p, i) => (
              <div
                key={i}
                className="relative flex flex-col items-center text-center p-8 rounded-3xl border border-slate-800 bg-slate-900/60 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all duration-300 card-glow-amber group"
              >
                {/* Número */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-extrabold text-sm flex items-center justify-center shadow-lg shadow-amber-500/40">
                  {p.num}
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-5 mt-2 group-hover:bg-amber-500/15 transition-colors">
                  {p.icon}
                </div>
                <h3 className="text-white font-extrabold text-lg mb-3">{p.titulo}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Destaque "sem call" */}
          <div className="mt-10 text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-3 sm:gap-6 px-6 py-4 rounded-2xl border border-slate-800 bg-slate-900/40">
              {['Sem call', 'Sem agenda', 'Sem enrolação'].map((tag, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {tag}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 4 — O QUE VEM NO RELATÓRIO */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="py-20 relative" aria-label="O que vem no relatório">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(245,158,11,0.06),transparent)] pointer-events-none" />

        <div
          ref={relatorioRef}
          className={`max-w-3xl mx-auto px-4 sm:px-6 relative z-10 transition-all duration-700 ${relatorioInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
              <FileText className="w-3.5 h-3.5" />
              Seu relatório inclui
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
              O que vem no relatório
            </h2>
          </div>

          {/* Card do relatório */}
          <div className="relative rounded-3xl border border-amber-500/25 bg-slate-900/80 overflow-hidden shadow-2xl shadow-amber-500/10">
            {/* Header do card */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800/80 bg-amber-500/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-slate-500 text-xs font-mono">diagnostico-financeiro.pdf</span>
              <FileText className="w-4 h-4 text-amber-400 ml-auto" />
            </div>

            {/* Itens */}
            <div className="p-6 sm:p-8 space-y-4">
              {itensRelatorio.map((item, i) => (
                <div key={i} className="flex items-start gap-3 group">
                  {item.icon}
                  <p className="text-slate-200 text-sm sm:text-base leading-relaxed group-hover:text-white transition-colors">
                    {item.texto}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer do card */}
            <div className="px-6 sm:px-8 py-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <p className="text-slate-400 text-xs font-medium">
                PDF pronto para mostrar a sócio, contador ou banco
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 5 — PROVA DE AUTORIDADE */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="py-20 relative" aria-label="Nossa autoridade">
        <div className="absolute inset-0 bg-slate-900/50 pointer-events-none" />

        <div
          ref={autorRef}
          className={`max-w-4xl mx-auto px-4 sm:px-6 relative z-10 transition-all duration-700 ${autorInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Bloco de autoridade */}
          <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-slate-900 to-slate-900/60 p-8 sm:p-12 text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-6">
              <Star className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
              <span className="text-shimmer-amber">40 anos</span> de experiência
            </p>
            <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Gestão financeira, contábil e administrativa aplicados ao seu negócio — sem o custo de contratar isso em tempo integral.
            </p>
          </div>

          {/* Espaço reservado para depoimentos */}
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
            <p className="text-slate-500 text-sm font-medium">
              🗣️ Espaço reservado para depoimentos de clientes-piloto
            </p>
            <p className="text-slate-600 text-xs mt-1">
              Prova social pesa mais que anos de experiência sozinha — isso entra aqui quando disponível.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 6 — PREÇO E GARANTIA */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="py-20 relative" aria-label="Preço e garantia">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(245,158,11,0.08),transparent)] pointer-events-none" />

        <div
          ref={precoRef}
          className={`max-w-2xl mx-auto px-4 sm:px-6 relative z-10 transition-all duration-700 ${precoInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="rounded-3xl border border-amber-500/30 bg-slate-900/90 overflow-hidden shadow-2xl shadow-amber-500/10 animate-pulse-glow-amber">
            {/* Header preço */}
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 border-b border-amber-500/20 px-8 py-8 text-center">
              <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-2">Diagnóstico Financeiro</p>
              <div className="flex items-baseline justify-center gap-2 mb-1">
                <span className="text-slate-500 text-lg font-medium">R$</span>
                <span className="text-6xl font-extrabold text-white tracking-tight">197</span>
              </div>
              <p className="text-amber-400 text-sm font-semibold">Pagamento único · Sem assinatura</p>
            </div>

            {/* Detalhes */}
            <div className="px-8 py-8 space-y-4">
              {[
                { icon: <Clock className="w-5 h-5 text-amber-400" />, text: 'Entrega garantida em até 72h após pagamento e formulário' },
                { icon: <Shield className="w-5 h-5 text-emerald-400" />, text: 'Pagamento antecipado via link seguro (Asaas)' },
                { icon: <Lock className="w-5 h-5 text-emerald-400" />, text: 'Sem acesso à sua conta bancária — nunca' },
                { icon: <FileText className="w-5 h-5 text-amber-400" />, text: 'Relatório PDF em linguagem simples, pronto para usar' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-slate-800/80 flex-shrink-0">{item.icon}</div>
                  <p className="text-slate-300 text-sm">{item.text}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-8 pb-8 text-center">
              <CtaButton id="preco-cta" className="w-full justify-center" />
            </div>
          </div>

          {/* Nota sobre o AnalisAí */}
          <div className="mt-8 p-5 rounded-2xl border border-slate-800 bg-slate-900/40 text-center">
            <p className="text-slate-400 text-sm leading-relaxed">
              Se depois você quiser acompanhamento contínuo do seu financeiro, existe o{' '}
              <Link href="/" className="text-amber-400 font-semibold hover:underline">
                AnalisAí
              </Link>{' '}
              — nosso serviço mensal de gestão financeira terceirizada.{' '}
              <span className="text-slate-300 font-medium">
                Mas isso é decisão sua, depois de ver o diagnóstico, não uma condição pra comprar agora.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 7 — FAQ */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="py-20" id="faq" aria-label="Perguntas frequentes">
        <div
          ref={faqRef}
          className={`max-w-2xl mx-auto px-4 sm:px-6 transition-all duration-700 ${faqInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
              <HelpCircle className="w-3.5 h-3.5" />
              Perguntas frequentes
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Dúvidas comuns
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FaqItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* AVISO LGPD + RODAPÉ */}
      {/* ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-800/60 bg-slate-950/80">
        {/* Aviso LGPD */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-start gap-4 p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
            <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-300 text-sm leading-relaxed">
                <span className="font-semibold text-white">Nota sobre privacidade:</span> Os dados informados são usados apenas para gerar sua análise e não ficam vinculados a movimentação bancária real — não pedimos e não acessamos suas contas.{' '}
                <Link href="/privacidade" className="text-emerald-400 hover:underline font-medium">
                  Ver política de privacidade completa
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé principal */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 border-t border-slate-800/40">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="AnalisAI.me" width={100} height={28} className="h-6 w-auto opacity-60" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/" className="hover:text-slate-300 transition-colors flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> BPO Financeiro
              </Link>
              <Link href="/privacidade" className="hover:text-slate-300 transition-colors flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> Privacidade
              </Link>
              <Link href="/termos" className="hover:text-slate-300 transition-colors flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> Termos
              </Link>
            </div>
            <p>© {new Date().getFullYear()} AnalisAI.me</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
