'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, ArrowLeft, CheckCircle2, ChevronDown, Star,
  DollarSign, RefreshCw, TrendingUp, FileText, Receipt,
  PieChart, Zap, Target, BarChart3, Users,
} from 'lucide-react';

function useInView(threshold = 0.12) {
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

export default function BpoPage() {
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', company: '', phone: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(true); };

  const [heroRef, heroInView] = useInView(0.05);
  const [doresRef, doresInView] = useInView();
  const [servicosRef, servicosInView] = useInView();
  const [diferenciaisRef, diferenciaisInView] = useInView();
  const [numerosRef, numerosInView] = useInView();
  const [depoimentosRef, depoimentosInView] = useInView();
  const [faqRef, faqInView] = useInView();

  const faqs = [
    { question: 'BPO Financeiro substitui meu contador?', answer: 'Não. O BPO Financeiro cuida da operação financeira do dia a dia (fluxo de caixa, contas a pagar/receber, conciliação). Já o contador trata das obrigações fiscais, tributárias e legais. As duas soluções se complementam e trabalhamos em conjunto com seu contador atual.' },
    { question: 'Como funciona a onboarding?', answer: 'Após a contratação, fazemos um diagnóstico financeiro completo da sua empresa em até 5 dias úteis. Em seguida, configuramos os processos, ferramentas e rotinas. Em geral, a operação plena começa entre 10 e 15 dias após a assinatura.' },
    { question: 'Preciso mudar meu sistema de gestão?', answer: 'Não necessariamente. Trabalhamos com os principais ERPs e sistemas do mercado (Omie, Conta Azul, TOTVS, planilhas, entre outros). Na onboarding avaliamos sua estrutura atual e adaptamos os processos.' },
    { question: 'Meus dados financeiros ficam seguros?', answer: 'Sim. Operamos com contratos de confidencialidade (NDA), acesso restrito por perfil e todas as informações são criptografadas. Seguimos as diretrizes da LGPD e adotamos as melhores práticas de segurança da informação.' },
    { question: 'Qual é o valor do serviço?', answer: 'A precificação é personalizada com base no volume de transações, complexidade da operação e serviços contratados. Solicite uma demonstração gratuita e apresentaremos uma proposta sem compromisso.' },
  ];

  const testimonials = [
    { name: 'Carlos Mendes', role: 'CEO · Distribuidora Meridian', stars: 5, text: 'Antes do BPO, eu gastava horas toda semana tentando entender o financeiro. Hoje recebo o DRE no início do mês e foco só em vender. Foi transformador.' },
    { name: 'Ana Paula Ramos', role: 'Diretora · Clínica Vitallis', stars: 5, text: 'Reduzimos nossa inadimplência em 38% nos primeiros 3 meses. A gestão de cobranças que eles implementaram foi o que faltava há anos na nossa operação.' },
    { name: 'Felipe Souza', role: 'Sócio · Construtora FSB', stars: 5, text: 'O diferencial é ter um relatório executivo toda semana. Finalmente consegui negociar capital de giro com o banco apresentando números sólidos e organizados.' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">

      {/* ── NAVBAR ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 shadow-xl shadow-black/20' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" id="bpo-back-home" className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Início
            </Link>
            <span className="text-slate-700">|</span>
            <Image src="/logo.png" alt="AnalisAI.me" width={140} height={38} className="h-9 w-auto object-contain" priority />
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            {[['#servicos','Serviços'],['#diferenciais','Diferenciais'],['#numeros','Mercado'],['#faq','FAQ']].map(([h,l])=>(
              <a key={h} href={h} className="relative group py-1">
                <span className="hover:text-amber-400 transition-colors">{l}</span>
                <span className="absolute bottom-0 left-0 w-0 h-px bg-amber-400 transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>
          <a href="#contato" id="bpo-nav-cta" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition-all hover:scale-[1.03] shadow-lg shadow-amber-500/25 text-sm animate-pulse-glow-amber">
            Falar com Especialista
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative pt-40 pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(245,158,11,0.14),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-grid-amber opacity-30 pointer-events-none" />
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-amber-500/8 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl animate-float delay-300 pointer-events-none" />

        <div ref={heroRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center transition-all duration-700 ${heroInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-8">
            <Zap className="w-3.5 h-3.5" />
            BPO Financeiro — Terceirização Especializada
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-5xl mx-auto leading-[1.06]">
            Seu departamento financeiro,{' '}
            <span className="text-shimmer-amber">sem contratar ninguém</span>.
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Terceirize a gestão financeira completa da sua empresa — contas a pagar, DRE, fluxo de caixa e relatórios executivos — com a precisão de especialistas e tecnologia de ponta.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <a href="#contato" id="hero-bpo-cta" className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 py-4 rounded-xl transition-all shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 group hover:scale-[1.03]">
              Quero uma Proposta
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#servicos" className="w-full sm:w-auto bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-semibold px-8 py-4 rounded-xl border border-slate-700 hover:border-slate-600 transition-all text-center">
              Ver os Serviços
            </a>
          </div>

          {/* Mini-métricas */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-slate-800/80 pt-10 max-w-4xl mx-auto text-left">
            {[
              { v: '-60%', l: 'de custo vs equipe interna', c: 'text-amber-400' },
              { v: '48h',  l: 'para os primeiros insights', c: 'text-white' },
              { v: '100%', l: 'LGPD compliant', c: 'text-amber-400' },
              { v: 'Zero', l: 'retrabalho com seu contador', c: 'text-white' },
            ].map(({ v, l, c }, i) => (
              <div key={i}>
                <p className={`text-3xl font-extrabold ${c} mb-1`}>{v}</p>
                <p className="text-xs text-slate-400 leading-snug">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DORES ── */}
      <section className="py-20 bg-slate-900/30 border-y border-slate-800/60 relative overflow-hidden">
        <div ref={doresRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${doresInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Você se identifica com alguma dessas situações?</h2>
            <p className="text-slate-400">Essas são as principais dores que o BPO Financeiro resolve.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '😰', title: 'Decisões no escuro', desc: 'Não sabe exatamente quanto dinheiro vai entrar ou sair no próximo mês. As decisões são feitas com base em intuição, não em dados.' },
              { icon: '⏰', title: 'Tempo perdido com burocracia', desc: 'Você ou sua equipe gastam horas semanais com boletos, cobranças, conciliação bancária e planilhas em vez de focar no que gera receita.' },
              { icon: '💸', title: 'Erros que custam caro', desc: 'Pagamentos em duplicidade, notas fiscais incorretas, conciliações desatualizadas — erros operacionais que geram prejuízo e desgaste.' },
            ].map(({ icon, title, desc }, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-8 transition-all duration-300 group">
                <div className="text-4xl mb-5">{icon}</div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS ── */}
      <section id="servicos" className="py-28">
        <div ref={servicosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${servicosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">O Que Fazemos</span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Operação financeira <span className="text-shimmer-amber">completa e sem falhas</span>
            </h2>
            <p className="text-slate-400 text-lg">Assumimos a gestão financeira do dia a dia para que você foque no crescimento do negócio.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <DollarSign className="w-6 h-6" />, title: 'Contas a Pagar e Receber', desc: 'Gestão completa de boletos, cobranças, agendamento de pagamentos e acompanhamento de recebimentos. Zero atraso, zero duplicidade.' },
              { icon: <RefreshCw   className="w-6 h-6" />, title: 'Conciliação Bancária', desc: 'Conferência diária dos extratos bancários com o controle interno, garantindo que toda movimentação esteja registrada corretamente.' },
              { icon: <TrendingUp  className="w-6 h-6" />, title: 'Fluxo de Caixa Projetado', desc: 'Acompanhamento e projeção das entradas e saídas, com visão de 30, 60 e 90 dias para antecipar decisões com segurança.' },
              { icon: <FileText   className="w-6 h-6" />, title: 'DRE Mensal Gerencial', desc: 'Relatório de Resultado do Exercício em linguagem clara, com análise de margens, custos e lucratividade por centro de custo.' },
              { icon: <Receipt    className="w-6 h-6" />, title: 'Notas Fiscais e Documentação', desc: 'Emissão, organização e envio de documentos fiscais. Suporte completo na alimentação das informações para sua contabilidade.' },
              { icon: <PieChart   className="w-6 h-6" />, title: 'Relatórios Executivos', desc: 'Dashboards e relatórios gerenciais prontos para reuniões de conselho, decisões de investimento e apresentações para investidores.' },
            ].map(({ icon, title, desc }, i) => (
              <div key={i} className="card-glow-amber bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-8 rounded-2xl transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-amber-500/0 group-hover:from-amber-500/5 transition-all duration-500 rounded-2xl pointer-events-none" />
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:bg-amber-500/20 transition-colors">
                  {icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIFERENCIAIS ── */}
      <section id="diferenciais" className="py-28 bg-slate-900/40 border-y border-slate-800/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_80%_50%,rgba(245,158,11,0.06),transparent)] pointer-events-none" />
        <div ref={diferenciaisRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${diferenciaisInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">Nosso Diferencial</span>
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                BPO humano +<br /><span className="text-shimmer-amber">IA preditiva</span> integrada.
              </h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                Somos o único serviço de BPO Financeiro com o AnalisAI.me integrado: além de executar seu financeiro, antecipamos cenários futuros com inteligência artificial.
              </p>
              <ul className="space-y-4">
                {[
                  'Especialistas dedicados à sua empresa, não uma fila de atendimento',
                  'Relatórios prontos toda semana — sem esperar o final do mês',
                  'IA preditiva que projeta seu fluxo de caixa com 40% mais precisão',
                  'Integração direta com seu contador sem retrabalho',
                  'Resposta em até 4 horas em dias úteis para qualquer demanda',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual card */}
            <div className="relative">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4 animate-float">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Relatório Semanal</p>
                    <p className="text-slate-500 text-xs">Atualizado toda segunda-feira</p>
                  </div>
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-amber-400 text-xs font-semibold">Ao Vivo</span>
                  </span>
                </div>
                {[
                  { label: 'Contas a Pagar (semana)', value: 'R$ 47.230', color: 'text-red-400' },
                  { label: 'Contas a Receber (semana)', value: 'R$ 83.750', color: 'text-amber-400' },
                  { label: 'Saldo Projetado (30 dias)', value: 'R$ 128.400', color: 'text-emerald-400' },
                  { label: 'Inadimplência do Mês', value: '3,2%', color: 'text-white' },
                ].map(({ label, value, color }, i) => (
                  <div key={i} className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 bg-amber-500/5 rounded-3xl blur-2xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* ── NÚMEROS ── */}
      <section id="numeros" className="py-28">
        <div ref={numerosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${numerosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">O Mercado</span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
              O BPO Financeiro não é tendência —<br /><span className="text-shimmer-amber">é necessidade</span>.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <DollarSign className="w-6 h-6"/>, stat: 'R$ 26,8bi', desc: 'movimentados pelo setor em 2024', color: 'text-amber-400 border-amber-500/20 bg-amber-500/10' },
              { icon: <TrendingUp className="w-6 h-6"/>, stat: '+11,7%', desc: 'de crescimento anual projetado até 2033', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' },
              { icon: <Users      className="w-6 h-6"/>, stat: '68%',     desc: 'das PMEs ainda usam processos manuais', color: 'text-amber-400 border-amber-500/20 bg-amber-500/10' },
              { icon: <Target     className="w-6 h-6"/>, stat: '-60%',    desc: 'de custo em relação a equipe financeira interna', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' },
            ].map(({ icon, stat, desc, color }, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center hover:border-amber-500/30 transition-colors">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-4 ${color}`}>{icon}</div>
                <p className="text-3xl font-extrabold text-white mb-2">{stat}</p>
                <p className="text-slate-400 text-xs leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section className="py-24 bg-slate-900/40 border-y border-slate-800/60">
        <div ref={depoimentosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${depoimentosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">Resultados Reais</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Empresas que já transformaram seu financeiro</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, stars, text }, i) => (
              <div key={i} className="card-glow-amber bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300">
                <div className="flex gap-0.5">
                  {Array.from({ length: stars }).map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">&ldquo;{text}&rdquo;</p>
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-white font-semibold text-sm">{name}</p>
                  <p className="text-slate-500 text-xs">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28">
        <div ref={faqRef} className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${faqInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Dúvidas frequentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => <FaqItem key={i} question={f.question} answer={f.answer} />)}
          </div>
        </div>
      </section>

      {/* ── FORMULÁRIO ── */}
      <section id="contato" className="py-28 relative overflow-hidden bg-slate-900/40 border-t border-slate-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(245,158,11,0.08),transparent)] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-500/30 rounded-3xl p-8 sm:p-14 shadow-2xl shadow-black/40 transition-colors duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">Sem Compromisso</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Fale com um Especialista</h2>
              <p className="text-slate-400 text-sm">Preencha os dados e entraremos em contato em até 1 dia útil para apresentar uma proposta personalizada.</p>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4 animate-fadeInUp">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Mensagem Recebida!</h3>
                <p className="text-slate-400 text-sm text-center max-w-sm">Um especialista entrará em contato em até 1 dia útil.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} id="bpo-contact-form" className="space-y-4 max-w-md mx-auto">
                {[
                  { id: 'bpo-name',    label: 'Nome Completo',       type: 'text',  ph: 'Seu nome completo',              key: 'name' },
                  { id: 'bpo-email',   label: 'E-mail Corporativo',  type: 'email', ph: 'nome@empresa.com.br',            key: 'email' },
                  { id: 'bpo-company', label: 'Empresa / Segmento',  type: 'text',  ph: 'Empresa XYZ · Distribuição',     key: 'company' },
                  { id: 'bpo-phone',   label: 'WhatsApp (opcional)', type: 'tel',   ph: '(11) 9 9999-9999',               key: 'phone' },
                ].map(({ id, label, type, ph, key }) => (
                  <div key={id}>
                    <label htmlFor={id} className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">{label}</label>
                    <input
                      id={id} type={type} placeholder={ph}
                      required={key !== 'phone'}
                      value={formData[key as keyof typeof formData]}
                      onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none transition-colors text-sm"
                    />
                  </div>
                ))}
                <button id="bpo-submit" type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-4 rounded-xl transition-all shadow-xl shadow-amber-500/25 text-sm mt-2 flex items-center justify-center gap-2 group hover:scale-[1.01]">
                  Solicitar Proposta Gratuita
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-center text-xs text-slate-500 pt-1">
                  Ao enviar, você concorda com nossa{' '}
                  <a href="#" className="text-slate-400 hover:text-amber-400 underline transition-colors">Política de Privacidade</a>.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="AnalisAI.me" width={130} height={36} className="h-8 w-auto object-contain" />
            <span className="text-slate-700 text-xs">|</span>
            <span className="text-slate-500 text-xs">BPO Financeiro</span>
          </div>
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} AnalisAI.me. Todos os direitos reservados.</p>
          <div className="flex gap-5 text-xs text-slate-500">
            <Link href="/" className="hover:text-amber-400 transition-colors">← Início</Link>
            <Link href="/analisai" className="hover:text-amber-400 transition-colors">AnalisAI.me</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
