'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, ChevronDown,
  DollarSign, RefreshCw, TrendingUp, FileText, Receipt,
  PieChart, Zap, Shield, Users, Target, BarChart3,
  MessageCircle, Lock, Sparkles, AlertTriangle, ShieldCheck, Clock,
  Building2, Stethoscope, Briefcase, Star, Check, Calendar
} from 'lucide-react';

/* ── CONFIGURAÇÃO DO WHATSAPP ── */
const PHONE_NUMBER = '5514930855878';

const WA_DIAGNOSTICO_DIRETO = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Gostaria de agendar um Diagnóstico Financeiro Gratuito (30 a 45 min) para a minha empresa.')}`;
const WA_PLANO_ESSENCIAL = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Tenho interesse no Plano Essencial de BPO Financeiro e gostaria de agendar um Diagnóstico Gratuito.')}`;
const WA_PLANO_GESTAO = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Tenho interesse no Plano Gestão (Mais Contratado) e quero agendar o Diagnóstico Financeiro Gratuito.')}`;
const WA_PLANO_ESTRATEGICO = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Tenho interesse no Plano Estratégico e gostaria de agendar uma reunião de diagnóstico sob medida.')}`;
const WA_ANALISAI_BETA = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Gostaria de me candidatar para participar do Programa Beta do Plano Inteligência Financeira (AnalisAI.me).')}`;

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
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
        <p className="px-6 pb-6 text-slate-400 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function BpoLandingMain() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const [heroRef, heroInView] = useInView(0.05);
  const [semAcessoRef, semAcessoInView] = useInView();
  const [servicosRef, servicosInView] = useInView();
  const [planosRef, planosInView] = useInView();
  const [casosRef, casosInView] = useInView();
  const [emBreveRef, emBreveInView] = useInView();
  const [faqRef, faqInView] = useInView();

  const faqs = [
    {
      question: 'Vocês têm acesso ao saldo ou movimentação da minha conta bancária?',
      answer: 'Para a conciliação bancária, sim — trabalhamos com os extratos e saldos que você nos disponibiliza. O que não fazemos, em nenhuma circunstância, é movimentar sua conta: não realizamos pagamentos, transferências nem temos senha de acesso. Você aprova e executa 100% das movimentações. Essa separação é formalizada em cláusula contratual de confidencialidade e limitação de acesso.'
    },
    {
      question: 'Como funciona o Diagnóstico Financeiro Gratuito?',
      answer: 'É uma reunião técnica de 30 a 45 minutos onde nosso especialista analisa a rotina atual da sua empresa, mapeia gargalos operacionais e dimensiona a solução exata para a sua realidade, sem compromisso.'
    },
    {
      question: 'O BPO Financeiro substitui a minha contabilidade?',
      answer: 'Não. O BPO cuida da rotina diária (contas a pagar/receber, conciliação e DRE gerencial). A contabilidade trata de impostos, folha e obrigações fiscais. Nós trabalhamos em sintonia com seu contador atual.'
    },
    {
      question: 'Como faço para começar o atendimento?',
      answer: 'É imediato! Não há formulários burocráticos. Basta clicar no botão de WhatsApp para agendar o seu diagnóstico gratuito e iniciarmos o alinhamento da sua empresa.'
    },
    {
      question: 'E o AnalisAI.me (IA Preditiva)? Quando estará disponível?',
      answer: 'O AnalisAI.me é nosso laboratório de inteligência preditiva em constante evolução. Clientes de BPO Financeiro têm acesso prioritário ao Programa Beta conforme disponibilização gradual dos recursos.'
    },
  ];

  const casosDeUso = [
    {
      icon: <Building2 className="w-6 h-6 text-amber-400" />,
      title: 'Comércio & Distribuição',
      desc: 'Gestão de alto volume de boletos, conciliação diária de recebíveis, controle de fornecedores e fluxo de caixa contínuo.'
    },
    {
      icon: <Stethoscope className="w-6 h-6 text-amber-400" />,
      title: 'Clínicas & Serviços de Saúde',
      desc: 'Organização de repasses, controle de contas a pagar, conciliação de recebimentos e DRE gerencial mensal simplificado.'
    },
    {
      icon: <Briefcase className="w-6 h-6 text-amber-400" />,
      title: 'Prestadores de Serviços & Tech',
      desc: 'Previsibilidade de faturamento recorrente, acompanhamento de inadimplência, suporte na emissão de NFs e relatórios executivos.'
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 relative">

      {/* ── BOTÃO FLUTUANTE DE WHATSAPP ── */}
      <a
        href={WA_DIAGNOSTICO_DIRETO}
        target="_blank"
        rel="noopener noreferrer"
        id="btn-whatsapp-float"
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center gap-3 group transition-all duration-300 hover:scale-110 animate-bounce"
        aria-label="Agendar Diagnóstico no WhatsApp"
      >
        <MessageCircle className="w-7 h-7 fill-slate-950 stroke-none" />
        <span className="font-bold text-sm hidden sm:inline pr-1">Agendar Diagnóstico</span>
      </a>

      {/* ── NAVBAR ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 shadow-xl shadow-black/30' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="AnalisAI.me — Solucione Assessoria Virtual" width={480} height={132} className="h-14 sm:h-18 w-auto object-contain" priority />
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-xs xl:text-sm font-medium text-slate-300">
            <a href="#planos" className="hover:text-amber-400 transition-colors font-semibold text-amber-400">Planos</a>
            <a href="#seguranca" className="hover:text-amber-400 transition-colors">Segurança</a>
            <a href="#servicos" className="hover:text-amber-400 transition-colors">Serviços</a>
            <Link href="/parceiros" className="hover:text-amber-400 text-amber-400 font-semibold transition-colors flex items-center gap-1">
              🤝 Para Contadores
            </Link>
            <Link href="/contrato" className="hover:text-amber-400 transition-colors">Contrato</Link>
            <Link href="/privacidade" className="hover:text-emerald-400 transition-colors">Privacidade</Link>
            <Link href="/termos" className="hover:text-amber-400 transition-colors">Termos</Link>
            <a href="#faq" className="hover:text-amber-400 transition-colors">FAQ</a>
          </nav>

          <a
            href={WA_DIAGNOSTICO_DIRETO}
            target="_blank"
            rel="noopener noreferrer"
            id="nav-cta-whatsapp"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all hover:scale-[1.03] shadow-lg shadow-emerald-500/25 text-sm flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Agendar Diagnóstico Gratuito
          </a>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(245,158,11,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-grid-amber opacity-30 pointer-events-none" />
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl animate-float pointer-events-none" />

        <div ref={heroRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center transition-all duration-700 ${heroInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Badge BPO */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-8">
            <Zap className="w-4 h-4" />
            BPO Financeiro — Solucione Assessoria Virtual
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-5xl mx-auto leading-[1.06]">
            Seu financeiro sob controle,{' '}
            <span className="text-shimmer-amber">sem contratar ninguém</span>.
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-8 leading-relaxed">
            Terceirize contas a pagar, contas a receber, conciliação bancária e DRE gerencial com especialistas dedicados. Atendimento rápido e sem burocracia.
          </p>

          {/* DESTAQUE DE SEGURANÇA EM DESTAQUE NO HERO */}
          <div className="max-w-2xl mx-auto mb-10 bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex items-center justify-center gap-3 shadow-xl text-left">
            <ShieldCheck className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-white">Acesso Restrito, Zero Movimentação</p>
              <p className="text-xs text-slate-400">Leitura de extratos para conciliação · Zero pagamentos ou transferências · Protegido por contrato formal de confidencialidade.</p>
            </div>
          </div>

          {/* CTAs WHATSAPP DERRUBANDO BARREIRAS */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <a
              href={WA_DIAGNOSTICO_DIRETO}
              target="_blank"
              rel="noopener noreferrer"
              id="hero-cta-whatsapp-main"
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3 text-base hover:scale-[1.03]"
            >
              <Calendar className="w-5 h-5 stroke-[2.5]" />
              Agendar Diagnóstico Financeiro Gratuito
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>

          <p className="text-xs text-slate-500 mt-4 flex items-center justify-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Sessão de 30 a 45 minutos · Sem compromisso · Atendimento via WhatsApp
          </p>
        </div>
      </section>

      {/* ── SEÇÃO PLANOS (NOVA SEÇÃO COM DESTAQUE VISUAL CRESCENTE) ── */}
      <section id="planos" className="py-28 relative overflow-hidden bg-slate-900/40 border-y border-slate-800/80">
        <div ref={planosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${planosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Planos sob medida</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
              Escolha a estrutura ideal para a sua empresa
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">Preços transparentes e soluções escaláveis para cada momento do seu negócio.</p>
          </div>

          {/* Grid dos 3 Planos Principais */}
          <div className="grid md:grid-cols-3 gap-8 items-stretch mb-12">
            
            {/* Card 1: Plano Essencial */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between hover:border-amber-500/30 transition-all duration-300 text-left">
              <div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-3 py-1 rounded-full mb-4">
                  Para começar com organização
                </span>
                <h3 className="text-2xl font-extrabold text-white mb-2">Plano Essencial</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Ideal para empresas que precisam organizar sua rotina financeira com precisão.
                </p>

                <div className="border-t border-slate-800 pt-6 mb-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">O que inclui:</p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    {['Contas a pagar', 'Contas a receber', 'Emissão de notas', 'Emissão de boletos', 'Conciliação bancária', 'Fluxo de caixa', 'Relatórios mensais', 'Suporte operacional'].map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <div className="border-t border-slate-800 pt-6 mb-6">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">A partir de</p>
                  <p className="text-3xl font-black text-white">R$ 690<span className="text-xs font-normal text-slate-400">/mês</span></p>
                </div>

                <a
                  href={WA_PLANO_ESSENCIAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-3.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 group"
                >
                  Agendar Diagnóstico Gratuito
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>

            {/* Card 2: Plano Gestão (DESTAQUE MAIS CONTRATADO) */}
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/70 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl shadow-amber-500/10 text-left transform md:-translate-y-2">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-xs font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                ★ Mais Contratado
              </div>

              <div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full mb-4 mt-2">
                  Gestão &amp; Indicadores
                </span>
                <h3 className="text-2xl font-extrabold text-white mb-2">Plano Gestão</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Para empresas que exigem previsibilidade, DRE gerencial e acompanhamento estratégico.
                </p>

                <div className="border-t border-slate-800 pt-6 mb-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">Tudo do Essencial, mais:</p>
                  <ul className="space-y-2.5 text-xs text-slate-200">
                    {['Fluxo de caixa projetado', 'Indicadores gerenciais', 'DRE Gerencial', 'Reuniões periódicas', 'Organização documental', 'Integração com a contabilidade', 'Acompanhamento financeiro'].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <div className="border-t border-slate-800 pt-6 mb-6">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">A partir de</p>
                  <p className="text-4xl font-black text-amber-400">R$ 1.190<span className="text-xs font-normal text-slate-400">/mês</span></p>
                </div>

                <a
                  href={WA_PLANO_GESTAO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-4 px-4 rounded-xl transition-all shadow-lg shadow-amber-500/25 text-xs flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  Quero organizar minha empresa
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Card 3: Plano Estratégico */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between hover:border-amber-500/30 transition-all duration-300 text-left">
              <div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-3 py-1 rounded-full mb-4">
                  Suporte Decisório Avançado
                </span>
                <h3 className="text-2xl font-extrabold text-white mb-2">Plano Estratégico</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Para empresas consolidadas que necessitam de planejamento, simulações e orçamento empresarial.
                </p>

                <div className="border-t border-slate-800 pt-6 mb-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Tudo do Plano Gestão, mais:</p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    {['Planejamento financeiro', 'Orçamento empresarial', 'Simulações de cenários', 'Apoio à tomada de decisão', 'Indicadores personalizados', 'Atendimento prioritário'].map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <div className="border-t border-slate-800 pt-6 mb-6">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Investimento</p>
                  <p className="text-2xl font-extrabold text-white">Sob consulta</p>
                </div>

                <a
                  href={WA_PLANO_ESTRATEGICO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-3.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 group"
                >
                  Agendar Diagnóstico Gratuito
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>

          </div>

          {/* CARD DIFERENCIADO: PLANO INTELIGÊNCIA FINANCEIRA (PROGRAMA BETA) */}
          <div className="bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-emerald-500/40 rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-2xl text-left">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                    <Sparkles className="w-3.5 h-3.5" /> Programa Beta · Vagas Limitadas
                  </span>
                </div>

                <h3 className="text-2xl sm:text-4xl font-extrabold text-white">
                  Plano Inteligência Financeira
                </h3>

                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Nosso laboratório está desenvolvendo uma nova geração de gestão financeira baseada em inteligência artificial, indicadores inteligentes, simulações de cenários e apoio à tomada de decisão. Durante esta fase, o acesso será disponibilizado apenas para empresas selecionadas que desejam participar da evolução da plataforma. A participação é limitada e sujeita à disponibilidade.
                </p>

                <p className="text-[11px] text-slate-400 italic">
                  * Em desenvolvimento contínuo. Recursos disponibilizados gradualmente conforme evolução da plataforma.
                </p>
              </div>

              <div className="lg:col-span-4 flex flex-col justify-center">
                <a
                  href={WA_ANALISAI_BETA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-4 px-6 rounded-2xl transition-all shadow-xl shadow-emerald-500/25 text-xs sm:text-sm flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950 stroke-none" />
                  Quero participar do Programa Beta
                </a>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── DESTAQUE DE PRIVACIDADE E SEGURANÇA ── */}
      <section id="seguranca" className="py-20 bg-slate-900/60 border-b border-slate-800/80 relative overflow-hidden">
        <div ref={semAcessoRef} className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${semAcessoInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-amber-500/30 rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="grid md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-3 flex justify-center">
                <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-12 h-12" />
                </div>
              </div>

              <div className="md:col-span-9 space-y-4 text-left">
                <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                  Segurança &amp; Confidencialidade Contratual
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                  Acesso Restrito, Zero Movimentação
                </h2>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  Para realizar a conciliação bancária e o registro de contas a pagar, nossa equipe pode visualizar extratos e saldos fornecidos por você. <strong className="text-white">Porém, em nenhuma hipótese realizamos pagamentos, transferências ou qualquer movimentação em sua conta</strong> — toda efetivação financeira é feita exclusivamente por você ou por pessoa autorizada da sua empresa. Todo colaborador com acesso a essas informações está vinculado a cláusula de confidencialidade em contrato.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-slate-300">Você aprova e realiza 100% dos pagamentos finais</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-slate-300">Colaboradores protegidos por contrato formal de NDA</span>
                  </div>
                </div>

                {/* LINKS DOS DOCUMENTOS LEGAIS NA SEÇÃO DE SEGURANÇA */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap gap-3">
                  <Link href="/contrato" className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-semibold px-4 py-2 rounded-xl text-xs transition-colors">
                    <FileText className="w-4 h-4" /> Modelo de Contrato BPO (DOCX / Online)
                  </Link>
                  <Link href="/privacidade" className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition-colors">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Política de Privacidade
                  </Link>
                  <Link href="/termos" className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition-colors">
                    Termos de Uso
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS BPO ── */}
      <section id="servicos" className="py-28">
        <div ref={servicosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${servicosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">Serviços Oferecidos</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-5">
              O que o BPO Financeiro faz por você:
            </h2>
            <p className="text-slate-400 text-lg">Elimine a burocracia do dia a dia e tenha um departamento financeiro estruturado.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <DollarSign className="w-6 h-6" />, title: 'Contas a Pagar e Receber', desc: 'Organização de boletos, cobrança de inadimplentes e agendamento de contas para sua aprovação final.' },
              { icon: <RefreshCw className="w-6 h-6" />, title: 'Conciliação Bancária', desc: 'Conferência detalhada das entradas e saídas para garantir que nenhum centavo fique sem registro.' },
              { icon: <TrendingUp className="w-6 h-6" />, title: 'Fluxo de Caixa Projetado', desc: 'Visão clara de quanto dinheiro vai entrar e sair nos próximos 30 a 90 dias.' },
              { icon: <FileText className="w-6 h-6" />, title: 'DRE Gerencial Mensal', desc: 'Demonstração de resultado em formato simples e direto para saber exatamente se a empresa deu lucro.' },
              { icon: <Receipt className="w-6 h-6" />, title: 'Suporte Fiscal & Notas', desc: 'Organização de documentos fiscais e envio direto para a sua contabilidade sem correria.' },
              { icon: <PieChart className="w-6 h-6" />, title: 'Relatórios Executivos', desc: 'Resumo semanal dos principais indicadores entregue de forma prática no seu WhatsApp.' },
            ].map(({ icon, title, desc }, i) => (
              <div key={i} className="card-glow-amber bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-8 rounded-2xl transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:bg-amber-500/20 transition-colors">
                  {icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* CTA WHATSAPP INTERMEDIÁRIO */}
          <div className="mt-12 text-center">
            <a
              href={WA_DIAGNOSTICO_DIRETO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 py-4 rounded-2xl transition-all hover:scale-[1.02] shadow-xl shadow-amber-500/20 text-sm"
            >
              <Calendar className="w-4 h-4 stroke-[2.5]" />
              Agendar Diagnóstico Financeiro Gratuito
            </a>
          </div>
        </div>
      </section>

      {/* ── PERFIS ATENDIDOS / CASOS DE USO ── */}
      <section id="casos" className="py-24 bg-slate-900/30 border-y border-slate-800/60">
        <div ref={casosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${casosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">Soluções por Segmento</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Perfis de Negócios que Atendemos</h2>
            <p className="text-slate-400 text-sm mt-2">Processos financeiros desenhados para a realidade de cada setor empresarial.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {casosDeUso.map(({ icon, title, desc }, i) => (
              <div key={i} className="card-glow-amber bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
                  {icon}
                </div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed flex-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 bg-slate-900/30 border-t border-slate-800/60">
        <div ref={faqRef} className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${faqInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Dúvidas Frequentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => <FaqItem key={i} question={f.question} answer={f.answer} />)}
          </div>
        </div>
      </section>

      {/* ── SEÇÃO FINAL: CONTATO DIRETO NO WHATSAPP ── */}
      <section className="py-28 relative overflow-hidden bg-slate-900/60 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-8 sm:p-14 shadow-2xl relative overflow-hidden">

            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-emerald-400" />
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
              Agende seu Diagnóstico Financeiro Gratuito
            </h2>

            <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              Uma reunião consultiva de 30 a 45 minutos para mapear as necessidades reais da sua empresa e apresentar a estrutura ideal.
            </p>

            <a
              href={WA_DIAGNOSTICO_DIRETO}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-whatsapp-final"
              className="inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-10 py-5 rounded-2xl transition-all hover:scale-[1.03] shadow-2xl shadow-emerald-500/30 text-base"
            >
              <Calendar className="w-6 h-6 stroke-[2.5]" />
              Agendar Diagnóstico Gratuito no WhatsApp
              <ArrowRight className="w-5 h-5" />
            </a>

            <p className="text-xs text-slate-500 mt-4">
              Horário de atendimento: Segunda a Sexta, das 8h às 18h
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER CORPORATIVO ── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Image src="/logo.png" alt="AnalisAI.me — Solucione Assessoria Virtual" width={360} height={100} className="h-10 w-auto object-contain" />
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-slate-400 font-medium">
              <a href={WA_DIAGNOSTICO_DIRETO} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">Agendar Diagnóstico</a>
              <Link href="/parceiros" className="hover:text-amber-400 text-amber-400 font-semibold transition-colors">🤝 Para Contadores</Link>
              <Link href="/contrato" className="hover:text-amber-400 transition-colors">Modelo de Contrato</Link>
              <Link href="/privacidade" className="hover:text-emerald-400 transition-colors">Política de Privacidade</Link>
              <Link href="/termos" className="hover:text-amber-400 transition-colors">Termos de Uso</Link>
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
            <div>
              <p className="text-slate-300 font-semibold mb-1">Solucione Assessoria Virtual</p>
              <p className="text-slate-500">CNPJ: 57.740.336/0001-08 · Todos os direitos reservados.</p>
            </div>
            <p className="text-slate-600 max-w-md text-[11px] leading-relaxed">
              O BPO Financeiro é um serviço consultivo de gestão operacional. A visualização de extratos e saldos é restrita à conciliação e registro, sem qualquer poder de movimentação ou transferência bancária.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
