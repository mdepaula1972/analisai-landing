'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, ChevronDown,
  DollarSign, RefreshCw, TrendingUp, FileText, Receipt,
  PieChart, Zap, Shield, Users, Target, BarChart3,
  MessageCircle, Lock, Sparkles, AlertTriangle, ShieldCheck, Clock,
  Building2, Stethoscope, Briefcase
} from 'lucide-react';

/* ── CONFIGURAÇÃO DO WHATSAPP ── */
const PHONE_NUMBER = '5514930855878';

const WA_BPO_HERO = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Gostaria de falar com um especialista sobre o BPO Financeiro do AnalisAI.me.')}`;
const WA_BPO_PROPOSTA = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Quero solicitar uma proposta de BPO Financeiro para a minha empresa.')}`;
const WA_ANALISAI_LISTA = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Tenho interesse no AnalisAI.me (IA Preditiva) e gostaria de entrar na lista de espera para testar em breve.')}`;

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
  const [casosRef, casosInView] = useInView();
  const [emBreveRef, emBreveInView] = useInView();
  const [faqRef, faqInView] = useInView();

  const faqs = [
    {
      question: 'Vocês têm acesso ao saldo ou movimentação da minha conta bancária?',
      answer: 'Para a conciliação bancária, sim — trabalhamos com os extratos e saldos que você nos disponibiliza. O que não fazemos, em nenhuma circunstância, é movimentar sua conta: não realizamos pagamentos, transferências nem temos senha de acesso. Você aprova e executa 100% das movimentações. Essa separação é formalizada em cláusula contratual de confidencialidade e limitação de acesso.'
    },
    {
      question: 'Como funciona a precificação do BPO Financeiro?',
      answer: 'A precificação é personalizada sob medida de acordo com o volume de transações e o porte da sua empresa, garantindo o melhor custo-benefício sem custos fixos desnecessários. Apresentamos a proposta ideal em poucos minutos diretamente pelo WhatsApp.'
    },
    {
      question: 'O BPO Financeiro substitui a minha contabilidade?',
      answer: 'Não. O BPO cuida da rotina diária (contas a pagar/receber, conciliação e DRE gerencial). A contabilidade trata de impostos, folha e obrigações fiscais. Nós trabalhamos em sintonia com seu contador atual.'
    },
    {
      question: 'Como faço para começar o atendimento?',
      answer: 'É imediato! Não há formulários burocráticos. Basta clicar no botão de WhatsApp, conversar com nosso especialista e em até 48 horas fazemos o alinhamento inicial da sua empresa.'
    },
    {
      question: 'E o AnalisAI.me (IA Preditiva)? Quando estará disponível?',
      answer: 'O AnalisAI.me é nossa plataforma própria de inteligência preditiva que está em fase final de desenvolvimento. Todos os clientes de BPO Financeiro terão acesso prioritário assim que for lançado!'
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
        href={WA_BPO_HERO}
        target="_blank"
        rel="noopener noreferrer"
        id="btn-whatsapp-float"
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center gap-3 group transition-all duration-300 hover:scale-110 animate-bounce"
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle className="w-7 h-7 fill-slate-950 stroke-none" />
        <span className="font-bold text-sm hidden sm:inline pr-1">Falar no WhatsApp</span>
      </a>

      {/* ── NAVBAR ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 shadow-xl shadow-black/30' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="AnalisAI.me — Solucione Assessoria Virtual" width={480} height={132} className="h-14 sm:h-18 w-auto object-contain" priority />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#seguranca" className="hover:text-amber-400 transition-colors">Segurança</a>
            <a href="#servicos" className="hover:text-amber-400 transition-colors">Serviços BPO</a>
            <a href="#casos" className="hover:text-amber-400 transition-colors">Perfis Atendidos</a>
            <a href="#em-breve" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> AnalisAI (Em Breve)
            </a>
            <a href="#faq" className="hover:text-amber-400 transition-colors">FAQ</a>
          </nav>

          <a
            href={WA_BPO_HERO}
            target="_blank"
            rel="noopener noreferrer"
            id="nav-cta-whatsapp"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all hover:scale-[1.03] shadow-lg shadow-emerald-500/25 text-sm flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950" />
            Falar no WhatsApp
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
              href={WA_BPO_HERO}
              target="_blank"
              rel="noopener noreferrer"
              id="hero-cta-whatsapp-main"
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3 text-base hover:scale-[1.03]"
            >
              <MessageCircle className="w-5 h-5 fill-slate-950 stroke-none" />
              Falar no WhatsApp Agora
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>

          <p className="text-xs text-slate-500 mt-4 flex items-center justify-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Sem formulários chatos · Resposta rápida em minutos
          </p>
        </div>
      </section>

      {/* ── DESTAQUE DE PRIVACIDADE E SEGURANÇA (REESCRITA PRECISA E HONESTA) ── */}
      <section id="seguranca" className="py-20 bg-slate-900/60 border-y border-slate-800/80 relative overflow-hidden">
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
                  Segurança & Confidencialidade Contratual
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
              href={WA_BPO_PROPOSTA}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 py-4 rounded-2xl transition-all hover:scale-[1.02] shadow-xl shadow-amber-500/20 text-sm"
            >
              <MessageCircle className="w-4 h-4 fill-slate-950" />
              Solicitar Proposta Sob Medida no WhatsApp
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

      {/* ── CATÁLOGO / MANIFESTO DE INTERESSE: ANALISAI.ME EM BREVE ── */}
      <section id="em-breve" className="py-24 bg-slate-900/50 border-b border-slate-800/80 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)] pointer-events-none" />

        <div ref={emBreveRef} className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-700 ${emBreveInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl">

            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
              <Sparkles className="w-4 h-4" />
              Em Breve · Catálogo de Inovação
            </span>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
              AnalisAI.me — Motor de IA Preditiva
            </h2>

            <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              Estamos finalizando nossa plataforma de simulação de cenários financeiros com inteligência artificial. Projeções de caixa com total privacidade e sem integração bancária.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10 text-left">
              {[
                { title: 'Simulação Preditiva', desc: 'Simule o impacto de contratações e compras antes de investir.' },
                { title: 'Detecção de Gargalos', desc: 'Alertas automáticos de risco de inadimplência.' },
                { title: 'Prioridade aos Clientes BPO', desc: 'Acesso antecipado garantido para nossos clientes de BPO.' },
              ].map(({ title, desc }, i) => (
                <div key={i} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">{title}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              ))}
            </div>

            <a
              href={WA_ANALISAI_LISTA}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-manifestar-interesse"
              className="inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-8 py-4 rounded-2xl transition-all hover:scale-[1.03] shadow-xl shadow-emerald-500/25 text-sm"
            >
              <MessageCircle className="w-5 h-5 fill-slate-950 stroke-none" />
              Manifestar Interesse na IA (Lista de Espera)
            </a>
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
              <MessageCircle className="w-8 h-8 text-emerald-400 fill-emerald-400" />
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
              Atendimento Direto no WhatsApp
            </h2>

            <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              Eliminamos formulários, cadastros longos e espera por e-mail. Converse diretamente com nosso especialista agora.
            </p>

            <a
              href={WA_BPO_HERO}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-whatsapp-final"
              className="inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-10 py-5 rounded-2xl transition-all hover:scale-[1.03] shadow-2xl shadow-emerald-500/30 text-base"
            >
              <MessageCircle className="w-6 h-6 fill-slate-950 stroke-none" />
              Iniciar Conversa no WhatsApp
              <ArrowRight className="w-5 h-5" />
            </a>

            <p className="text-xs text-slate-500 mt-4">
              Horário de atendimento: Segunda a Sexta, das 8h às 18h
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER CORPORATIVO (CDC & LEI DO E-COMMERCE COMPLIANT) ── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Image src="/logo.png" alt="AnalisAI.me — Solucione Assessoria Virtual" width={360} height={100} className="h-10 w-auto object-contain" />
            </div>
            <div className="flex gap-6 text-slate-400 font-medium">
              <a href={WA_BPO_HERO} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">Atendimento WhatsApp</a>
              <a href="#seguranca" className="hover:text-amber-400 transition-colors">Segurança & Sigilo</a>
              <a href="#casos" className="hover:text-amber-400 transition-colors">Perfis Atendidos</a>
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
