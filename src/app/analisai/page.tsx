'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  TrendingUp, ShieldCheck, Cpu, ArrowRight, ArrowLeft, Zap,
  Lock, BarChart3, CheckCircle2, Target, LineChart,
  AlertCircle, ChevronDown, Star, Send, RefreshCw, Sparkles,
  Users,
} from 'lucide-react';

const MAX_QUESTIONS = 5;
const STORAGE_KEY = 'analisai_demo_count';

function useInView(threshold = 0.12) {
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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-2xl transition-all duration-300 overflow-hidden ${open ? 'border-emerald-500/40 bg-slate-900/80' : 'border-slate-800 bg-slate-900/40'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left gap-4 group"
        aria-expanded={open}
      >
        <span className={`font-semibold text-sm sm:text-base transition-colors ${open ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'}`}>{question}</span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180 text-emerald-400' : ''}`} />
      </button>
      <div className={`transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-6 pb-6 text-slate-400 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

interface Message { role: 'user' | 'ai'; text: string; }

function AiDemo() {
  const [remaining, setRemaining] = useState(() => {
    if (typeof window === 'undefined') return MAX_QUESTIONS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { count, date } = JSON.parse(stored);
        const today = new Date().toDateString();
        if (date === today) return Math.max(0, MAX_QUESTIONS - count);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignora */ }
    return MAX_QUESTIONS;
  });

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveCount = (used: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: used, date: new Date().toDateString() }));
    } catch { /* ignora */ }
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading || remaining <= 0) return;

    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    const used = MAX_QUESTIONS - remaining + 1;
    setRemaining(r => r - 1);
    saveCount(used);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const msg = data.message ?? 'Ocorreu um erro. Tente novamente.';
        setMessages(prev => [...prev, { role: 'ai', text: msg }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Não consegui me conectar. Verifique sua internet e tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Como calcular meu ponto de equilíbrio?',
    'O que é DRE e como interpretar?',
    'Como melhorar meu fluxo de caixa?',
    'Qual a diferença entre lucro e caixa?',
    'Como reduzir a inadimplência da minha empresa?',
  ];

  const counterColor = remaining === 0 ? 'text-red-400' : remaining <= 2 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl shadow-black/40">
      <div className="bg-gradient-to-r from-emerald-900/30 to-slate-900 border-b border-slate-800 px-6 py-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Assistente Financeiro AnalisAI.me</p>
            <p className="text-slate-500 text-xs">Especialista em finanças empresariais</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-semibold">Online</span>
          <span className="text-slate-600 mx-2">|</span>
          <span className={`text-xs font-semibold ${counterColor}`}>
            {remaining > 0 ? `${remaining} pergunta${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}` : 'Limite da sessão atingido'}
          </span>
        </div>
      </div>

      <div className="h-80 overflow-y-auto px-6 py-5 space-y-4 scroll-smooth" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Cpu className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-300 font-semibold mb-1">Faça uma pergunta financeira</p>
              <p className="text-slate-500 text-xs max-w-xs">O assistente responde sobre fluxo de caixa, DRE, capital de giro, inadimplência e planejamento financeiro.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-emerald-600/20 border border-emerald-500/30 text-white rounded-br-sm'
                : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
            }`}>
              {msg.role === 'ai' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">AnalisAI</span>
                </div>
              )}
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-5 py-3.5 text-sm text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              Analisando sua pergunta...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 0 && remaining > 0 && (
        <div className="px-6 pb-3 flex flex-wrap gap-2">
          {suggestions.slice(0, 4).map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              disabled={loading}
              className="text-xs text-slate-400 border border-slate-700 hover:border-emerald-500/50 hover:text-emerald-400 rounded-full px-3 py-1.5 transition-all hover:bg-emerald-500/5 disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-slate-800 px-4 py-4">
        {remaining > 0 ? (
          <div className="flex gap-3">
            <input
              id="ai-demo-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="Ex: Como calcular meu capital de giro?"
              disabled={loading}
              maxLength={500}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none transition-colors text-sm disabled:opacity-50"
            />
            <button
              id="ai-demo-send"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold px-5 py-3 rounded-xl transition-all flex items-center gap-2 text-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-400 text-sm mb-4">
              Você usou todas as perguntas gratuitas desta sessão. Quer ver a plataforma completa?
            </p>
            <a
              href="#demo"
              id="ai-demo-upgrade-cta"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all text-sm"
            >
              Agendar Demonstração Completa
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}
        <p className="text-center text-[10px] text-slate-600 mt-2">
          Demo limitado · Apenas para perguntas sobre finanças empresariais
        </p>
      </div>
    </div>
  );
}

export default function AnalisaiPage() {
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', company: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(true); };

  const [demoRef, demoInView] = useInView();
  const [solucaoRef, solucaoInView] = useInView();
  const [recursosRef, recursosInView] = useInView();
  const [segurancaRef, segurancaInView] = useInView();
  const [statsRef, statsInView] = useInView();
  const [depoimentosRef, depoimentosInView] = useInView();
  const [faqRef, faqInView] = useInView();

  const faqs = [
    { question: 'O AnalisAI.me precisa de acesso à minha conta bancária?', answer: 'Não. O AnalisAI.me trabalha com dados inseridos manualmente ou exportados de planilhas/ERPs. Nunca solicitamos senhas ou integrações bancárias diretas. Seu sigilo financeiro é 100% preservado.' },
    { question: 'Quanto tempo leva para ver os primeiros resultados?', answer: 'Em média, empresas que utilizam nossa plataforma percebem os primeiros insights relevantes nas primeiras 48 horas após o onboarding. A curva de aprendizado do sistema é rápida e o suporte é contínuo.' },
    { question: 'Que tipo de empresa se beneficia do AnalisAI.me?', answer: 'Empresas de qualquer porte que precisam de controle financeiro mais robusto — de startups em crescimento a médias empresas com fluxo de caixa complexo. Atendemos B2B, varejo, serviços e indústria.' },
    { question: 'Os dados inseridos ficam seguros?', answer: 'Sim. Todos os dados são criptografados em trânsito (TLS 1.3) e em repouso (AES-256). Seguimos os requisitos da LGPD e nenhuma informação é vendida ou compartilhada com terceiros.' },
    { question: 'Existe um período de teste gratuito?', answer: 'Sim, oferecemos uma demonstração guiada gratuita com um especialista. Após a demo, empresas elegíveis podem ativar um piloto de 14 dias sem custo para validar os resultados na prática.' },
  ];

  const testimonials = [
    { name: 'Rafaela Torres', role: 'CFO · Construtora Avante', stars: 5, text: 'Antes tomávamos decisões de investimento no escuro. Com o AnalisAI.me, simulamos cenários em minutos e evitamos um descasamento de caixa que teria custado R$ 280 mil.' },
    { name: 'Bruno Almeida', role: 'CEO · LogTech Soluções', stars: 5, text: 'A precisão das projeções de fluxo de caixa superou qualquer planilha ou consultor que utilizamos antes. É como ter um CFO sênior disponível 24/7.' },
    { name: 'Mariana Souza', role: 'Diretora Financeira · MedGroup', stars: 5, text: 'O ponto mais crítico era segurança dos dados. O AnalisAI.me não pede acesso bancário — isso foi decisivo para nossa aprovação interna de compliance.' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">

      {/* ── NAVBAR ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl shadow-black/30' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" id="analisai-back-home" className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Início
            </Link>
            <span className="text-slate-700">|</span>
            <Image src="/logo.png" alt="AnalisAI.me" width={480} height={132} className="h-14 sm:h-16 w-auto object-contain" priority />
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            {[['#demo-ia','Demo IA'],['#solucao','Solução'],['#recursos','Recursos'],['#seguranca','Segurança'],['#faq','FAQ']].map(([h,l])=>(
              <a key={h} href={h} className="relative group py-1">
                <span className="hover:text-emerald-400 transition-colors">{l}</span>
                <span className="absolute bottom-0 left-0 w-0 h-px bg-emerald-400 transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>
          <a href="#demo" id="analisai-nav-cta" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition-all hover:scale-[1.03] shadow-lg shadow-emerald-500/25 text-sm animate-pulse-glow">
            Agendar Demo
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.18),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-teal-500/8 rounded-full blur-3xl animate-float delay-300 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 animate-fadeIn">
            <Zap className="w-3.5 h-3.5" />
            Inteligência Financeira de Alta Precisão
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-4xl mx-auto leading-[1.08] animate-fadeInUp">
            A inteligência que alavanca seu{' '}
            <span className="text-shimmer">resultado financeiro</span>.
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fadeInUp delay-200">
            Simulações financeiras avançadas e análise preditiva sem necessidade de integração direta com sua conta bancária. Decisões estratégicas com total segurança.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto animate-fadeInUp delay-300">
            <a href="#demo-ia" id="hero-analisai-demo" className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-4 rounded-xl transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 group hover:scale-[1.03]">
              Experimentar a IA
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </a>
            <a href="#solucao" className="w-full sm:w-auto bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-semibold px-8 py-4 rounded-xl border border-slate-700 hover:border-slate-600 transition-all text-center">
              Saiba Mais
            </a>
          </div>

          <div ref={statsRef} className={`mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-slate-800/80 pt-10 max-w-4xl mx-auto text-left transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {[
              { v: '100%',      l: 'Sem Acesso Bancário Direto',   c: 'text-white' },
              { v: '+40%',      l: 'Precisão de Fluxo de Caixa',   c: 'text-emerald-400' },
              { v: 'Zero',      l: 'Risco de Vazamento de Dados',  c: 'text-white' },
              { v: 'Real-Time', l: 'Simulação de Cenários',        c: 'text-emerald-400' },
            ].map(({ v, l, c }, i) => (
              <div key={i}>
                <p className={`text-3xl font-extrabold ${c} mb-1`}>{v}</p>
                <p className="text-xs text-slate-400 leading-snug">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO DE IA ── */}
      <section id="demo-ia" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)] pointer-events-none" />
        <div ref={demoRef} className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-700 ${demoInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">Experimente Agora</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Converse com a <span className="text-shimmer">IA Financeira</span>
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Faça até <strong className="text-white">5 perguntas gratuitas</strong> sobre finanças empresariais e veja o poder do AnalisAI.me em ação. Perguntas fora do tema financeiro não serão respondidas.
            </p>
          </div>
          <AiDemo />
        </div>
      </section>

      {/* ── SOLUÇÃO ── */}
      <section id="solucao" className="py-28 bg-slate-900/40 border-y border-slate-800/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(16,185,129,0.06),transparent)] pointer-events-none" />
        <div ref={solucaoRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${solucaoInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">Nossa Solução</span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Por que utilizar o <span className="text-emerald-400">AnalisAI.me</span> no seu negócio?
            </h2>
            <p className="text-slate-400 text-lg">Elimine os pontos cegos da sua gestão financeira com modelos preditivos que antecipam o futuro do seu caixa.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <TrendingUp className="w-6 h-6" />, title: 'Simulação de Cenários', desc: 'Projete o impacto de contratações, investimentos e variações de receita no seu fluxo de caixa antes mesmo de tomar a decisão.', badge: 'Planejamento' },
              { icon: <ShieldCheck className="w-6 h-6" />, title: 'Sigilo Absoluto', desc: 'Opere com total confidencialidade. Não solicitamos senhas de bancos ou integrações sensíveis. Seus dados continuam 100% sob seu controle.', badge: 'Segurança' },
              { icon: <Cpu className="w-6 h-6" />, title: 'Motor Preditivo IA', desc: 'Algoritmos treinados para identificar tendências de inadimplência, sazonalidade e gargalos operacionais no seu financeiro.', badge: 'Inteligência Artificial' },
            ].map(({ icon, title, desc, badge }, i) => (
              <div key={i} className="card-glow bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-8 rounded-2xl transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/0 group-hover:from-emerald-500/5 transition-all duration-500 rounded-2xl pointer-events-none" />
                <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full mb-5">{badge}</span>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:bg-emerald-500/20 transition-colors">{icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECURSOS ── */}
      <section id="recursos" className="py-28">
        <div ref={recursosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${recursosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">Recursos</span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Tudo que você precisa para <span className="text-emerald-400">decidir com confiança</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Dashboard em Tempo Real', desc: 'Visualize posição de caixa, contas a pagar/receber e indicadores-chave em um painel unificado e intuitivo.' },
              { icon: <Target className="w-5 h-5" />, title: 'Alertas Preditivos', desc: 'Receba notificações automáticas quando o sistema detectar risco de inadimplência ou descasamento de fluxo.' },
              { icon: <LineChart className="w-5 h-5" />, title: 'Projeção a 90/180 dias', desc: 'Modelos de machine learning projetam sua posição financeira futura com base em padrões históricos e variáveis de mercado.' },
              { icon: <Users className="w-5 h-5" />, title: 'Colaboração em Equipe', desc: 'Convide seu contador, CFO ou sócios para visualizar e co-criar análises financeiras com níveis de permissão granulares.' },
              { icon: <Lock className="w-5 h-5" />, title: 'Criptografia Ponta a Ponta', desc: 'Seus dados são protegidos com TLS 1.3 em trânsito e AES-256 em repouso. Conformidade total com a LGPD.' },
              { icon: <AlertCircle className="w-5 h-5" />, title: 'Relatórios Executivos', desc: 'Exporte PDFs gerenciais prontos para apresentações de conselho, reuniões com investidores ou auditorias internas.' },
            ].map(({ icon, title, desc }, i) => (
              <div key={i} className="flex gap-5 p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/30 hover:bg-slate-900 transition-all duration-300 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">{icon}</div>
                <div>
                  <h3 className="font-bold text-white mb-1">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEGURANÇA ── */}
      <section id="seguranca" className="py-28 bg-slate-900/40 border-y border-slate-800/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_80%_50%,rgba(16,185,129,0.07),transparent)] pointer-events-none" />
        <div ref={segurancaRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${segurancaInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">Segurança</span>
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                Dados protegidos.<br /><span className="text-emerald-400">Decisões livres.</span>
              </h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">Construímos o AnalisAI.me com segurança por design. Não precisamos — e nunca pediremos — acesso direto às suas contas bancárias.</p>
              <ul className="space-y-4">
                {['Zero acesso bancário direto — você controla seus dados', 'Criptografia AES-256 em repouso + TLS 1.3 em trânsito', 'Conformidade com LGPD e boas práticas de ISO 27001', 'Logs de auditoria completos de cada acesso', 'Backups automáticos diários com retenção de 90 dias'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4 animate-float">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"><Lock className="w-5 h-5 text-emerald-400" /></div>
                  <div><p className="text-white font-semibold text-sm">Camadas de Proteção</p><p className="text-slate-500 text-xs">Status: Ativo</p></div>
                  <span className="ml-auto flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-emerald-400 text-xs font-semibold">Protegido</span></span>
                </div>
                {[
                  { label: 'Criptografia AES-256', status: 'Ativo', pct: 100 },
                  { label: 'Autenticação 2FA',     status: 'Ativo', pct: 100 },
                  { label: 'Monitoramento 24/7',   status: 'Online', pct: 99.9 },
                  { label: 'Backup Automático',    status: 'Ativo', pct: 100 },
                ].map(({ label, status, pct }, i) => (
                  <div key={i} className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-300 font-medium">{label}</span>
                      <span className="text-xs text-emerald-400 font-semibold">{status}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 bg-emerald-500/5 rounded-3xl blur-2xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section className="py-28">
        <div ref={depoimentosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${depoimentosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">Depoimentos</span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">Empresas que já <span className="text-emerald-400">transformaram</span> seu financeiro</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, stars, text }, i) => (
              <div key={i} className="card-glow bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300">
                <div className="flex gap-0.5">{Array.from({ length: stars }).map((_, j) => <Star key={j} className="w-4 h-4 text-emerald-400 fill-emerald-400" />)}</div>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">&ldquo;{text}&rdquo;</p>
                <div className="border-t border-slate-800 pt-4"><p className="text-white font-semibold text-sm">{name}</p><p className="text-slate-500 text-xs">{role}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28 bg-slate-900/40 border-t border-slate-800/60">
        <div ref={faqRef} className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${faqInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">FAQ</span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">Perguntas <span className="text-emerald-400">frequentes</span></h2>
          </div>
          <div className="space-y-3">{faqs.map((f, i) => <FaqItem key={i} question={f.question} answer={f.answer} />)}</div>
        </div>
      </section>

      {/* ── FORM ── */}
      <section id="demo" className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(16,185,129,0.10),transparent)] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-emerald-500/30 rounded-3xl p-8 sm:p-14 shadow-2xl shadow-black/40 transition-colors duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">Demo Completa · Gratuita</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Solicite uma Demonstração</h2>
              <p className="text-slate-400 text-sm">Preencha os dados e um especialista apresentará o simulador completo — sem compromisso.</p>
            </div>
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4 animate-fadeInUp">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-400" /></div>
                <h3 className="text-xl font-bold text-white">Solicitação Enviada!</h3>
                <p className="text-slate-400 text-sm text-center max-w-sm">Nossa equipe entrará em contato em até 1 dia útil.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} id="analisai-demo-form" className="space-y-4 max-w-md mx-auto">
                {[
                  { id: 'ai-name',    label: 'Nome Completo',      type: 'text',  ph: 'Seu nome completo',         key: 'name' },
                  { id: 'ai-email',   label: 'E-mail Corporativo', type: 'email', ph: 'nome@empresa.com.br',       key: 'email' },
                  { id: 'ai-company', label: 'Empresa / Cargo',    type: 'text',  ph: 'Empresa XYZ · Diretor Fin.', key: 'company' },
                ].map(({ id, label, type, ph, key }) => (
                  <div key={id}>
                    <label htmlFor={id} className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">{label}</label>
                    <input id={id} type={type} required placeholder={ph}
                      value={formData[key as keyof typeof formData]}
                      onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none transition-colors text-sm"
                    />
                  </div>
                ))}
                <button id="analisai-submit" type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl transition-all shadow-xl shadow-emerald-500/25 text-sm mt-2 flex items-center justify-center gap-2 group hover:scale-[1.01]">
                  Solicitar Acesso Gratuito
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-center text-xs text-slate-500 pt-1">
                  Ao solicitar, você concorda com nossa{' '}
                  <a href="#" className="text-slate-400 hover:text-emerald-400 underline transition-colors">Política de Privacidade</a>.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Image src="/logo.png" alt="AnalisAI.me" width={130} height={36} className="h-8 w-auto object-contain" />
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} AnalisAI.me. Todos os direitos reservados.</p>
          <div className="flex gap-5 text-xs text-slate-500">
            <Link href="/" className="hover:text-emerald-400 transition-colors">← Início</Link>
            <Link href="/bpo" className="hover:text-emerald-400 transition-colors">BPO Financeiro</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
