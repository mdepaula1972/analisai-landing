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
  Copy, Check, QrCode, CreditCard, Send,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/* ── CONFIGURAÇÃO ── */
const VERSION = 'v3.5 · 23/08/2026 - 13:45';
const CHECKOUT_INFINITEPAY = 'https://checkout.infinitepay.io/solucione-0s1/IEyW4Ufczq';
const CHAVE_PIX_CNPJ = '57.740.336/0001-08';
const RAZAO_SOCIAL = 'Consultoria MA de Paula LTDA';
const NOME_FANTASIA = 'Solucione Assessoria Virtual (AnalisAI.me)';

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

export default function DiagnosticoPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'cartao'>('pix');

  // Formulário Pix
  const [pixNome, setPixNome] = useState('');
  const [pixEmail, setPixEmail] = useState('');
  const [pixWhatsapp, setPixWhatsapp] = useState('');
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState('');

  // Cartão Stripe
  const [stripeLoading, setStripeLoading] = useState(false);

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

  function handleCopiarPix() {
    navigator.clipboard.writeText(CHAVE_PIX_CNPJ.replace(/[^\d]/g, '') || CHAVE_PIX_CNPJ);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function handleConfirmarPix(e: React.FormEvent) {
    e.preventDefault();
    if (!pixNome.trim() || !pixEmail.trim() || !pixWhatsapp.trim()) {
      setPixError('Por favor, preencha todos os campos.');
      return;
    }

    setPixLoading(true);
    setPixError('');

    try {
      const res = await fetch('/api/diagnostico/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: pixNome,
          email: pixEmail,
          whatsapp: pixWhatsapp,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const queryParams = new URLSearchParams({
          pedido_id: data.pedido_id || '',
          nome: pixNome,
          email: pixEmail,
          whatsapp: pixWhatsapp,
        });
        router.push(`/diagnostico/sucesso?${queryParams.toString()}`);
      } else {
        setPixError(data.error || 'Erro ao registrar pedido.');
        setPixLoading(false);
      }
    } catch {
      setPixError('Erro de conexão. Tente novamente.');
      setPixLoading(false);
    }
  }

  async function handleStripeCheckout() {
    if (stripeLoading) return;
    setStripeLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Erro ao iniciar pagamento no Stripe. Tente novamente.');
        setStripeLoading(false);
      }
    } catch {
      alert('Erro de conexão. Tente novamente.');
      setStripeLoading(false);
    }
  }

  function scrollToPagamento() {
    const el = document.getElementById('secao-pagamento');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

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
      titulo: 'Você fala (ou digita)',
      desc: 'Sem formulários chatos. Você só responde 4 perguntas rápidas por voz para a nossa IA sobre seu negócio.',
    },
    {
      num: '2',
      icon: <BarChart3 className="w-8 h-8 text-amber-400" />,
      titulo: 'A gente analisa',
      desc: 'Rodamos seus dados no nosso motor de inteligência financeira e simulamos cenários reais para o seu negócio.',
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
      question: 'Como funcionam as 3 reanálises nos 30, 60 e 90 dias?',
      answer: 'Você recebe o Diagnóstico Inicial no ato e ganha acesso a 3 reavaliações programadas aos 30, 60 e 90 dias da contratação. Em cada janela de tempo, você refaz a conversa por voz para a IA recalcular sua DRE e verificar se suas ações deram resultado real. Caso o negócio não evolua, a IA recomenda a consultoria dedicada. O ciclo tem validade de 90 dias.',
    },
    {
      question: 'Preciso ter contador ou sistema de gestão?',
      answer: 'Não. Só precisa saber (ou conseguir estimar) seu faturamento e principais custos dos últimos meses.',
    },
    {
      question: 'É uma consultoria com reunião?',
      answer: 'Não. Todo o processo é ágil por voz com Inteligência Artificial — você passa os dados e recebe o relatório em PDF no ato. Caso queira suporte humano ou BPO, pode acionar nossa equipe pelo WhatsApp.',
    },
    {
      question: 'Meus dados ficam seguros?',
      answer: (
        <>
          Sim. Seus dados são protegidos pela LGPD, usados exclusivamente para gerar o seu diagnóstico e não são compartilhados com terceiros.{' '}
          <Link href="/privacidade" className="text-amber-400 hover:underline">
            Ver política de privacidade
          </Link>
          .
        </>
      ),
    },
    {
      question: 'Isso é o mesmo que o serviço de BPO Financeiro?',
      answer: 'O diagnóstico é o raio-x inicial com acompanhamento de 90 dias. Se você quiser que nossa equipe assuma todo o seu contas a pagar, receber e conciliação no dia a dia, você pode contratar nosso BPO Financeiro mensal.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 relative">

      {/* ── BADGE DE VERSÃO FIXO ── */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-500/40 bg-slate-950/95 backdrop-blur-md text-amber-400 text-[11px] font-bold font-mono shadow-2xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Diagnóstico {VERSION}
      </div>

      {/* ── NAVBAR COM LOGO EM DESTAQUE ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl shadow-black/40' : 'bg-slate-950/60 backdrop-blur-sm'}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-24 flex items-center justify-between">

          {/* Logo Principal com Presença Forte */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 group-hover:border-amber-500/50 shadow-xl shadow-black/30 transition-all">
              <Image
                src="/logo.png"
                alt="AnalisAI.me — Inteligência Financeira"
                width={220}
                height={60}
                className="h-11 sm:h-13 w-auto object-contain"
                priority
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-black tracking-wide text-white">AnalisAI.me</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                Diagnóstico Financeiro
              </span>
            </div>
          </Link>

          <button
            onClick={scrollToPagamento}
            id="nav-cta-diagnostico"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl transition-all hover:scale-[1.03] shadow-xl shadow-amber-500/25 text-sm sm:text-base flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            Quero por R$ 197
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 1 — HERÓI */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section className="relative pt-36 pb-28 overflow-hidden" aria-label="Apresentação">
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
            Você sabe para onde está indo o{' '}
            <span className="text-shimmer-amber">dinheiro do seu negócio?</span>
            <br />
            <span className="text-slate-300 font-bold text-2xl sm:text-3xl lg:text-4xl mt-2 block">
              Você vende. Recebe. Paga. Mas quanto realmente sobra?
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Descubra em 5 minutos por voz com nossa IA e receba no ato seu <strong className="text-white">Relatório Executivo Oficial com DRE Gerencial Sintética</strong> + <span className="text-amber-400 font-bold">Ciclo de 3 Reanálises (30, 60 e 90 dias)</span> para acompanhar se o seu lucro aumentou.
          </p>

          {/* CTA principal */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={scrollToPagamento}
              id="hero-cta"
              className="inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-8 py-5 rounded-2xl shadow-2xl shadow-amber-500/30 transition-all duration-200 hover:scale-[1.04] hover:shadow-amber-500/50 text-base sm:text-lg group cursor-pointer"
            >
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              Descobrir meu Lucro Real — R$ 197
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <p className="text-slate-400 text-sm max-w-md">
              Feito para MEIs e pequenas empresas que precisam de <span className="text-slate-300 font-medium">clareza financeira rápida</span> sem reuniões e sem planilhas complexas.
            </p>
          </div>

          {/* Mini trust bar */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-slate-400 text-xs font-medium">
            {[
              { icon: <Clock className="w-4 h-4 text-emerald-400" />, label: 'Emissão Imediata no Ato' },
              { icon: <Shield className="w-4 h-4 text-emerald-400" />, label: '3 Reanálises (30, 60 e 90 dias)' },
              { icon: <Lock className="w-4 h-4 text-emerald-400" />, label: 'Sem acesso à sua conta bancária' },
              { icon: <BarChart3 className="w-4 h-4 text-amber-400" />, label: 'DRE Gerencial Completa' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-full">
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
              Zero fricção humana
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3">
              Como funciona
            </h2>
            <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
              Sem call. Sem agenda. Sem enrolação.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 relative">
            <div className="hidden sm:block absolute top-16 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-gradient-to-r from-amber-500/40 via-amber-500/20 to-amber-500/40 pointer-events-none" />

            {passos.map((p, i) => (
              <div
                key={i}
                className="relative flex flex-col items-center text-center p-8 rounded-3xl border border-slate-800 bg-slate-900/60 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all duration-300 card-glow-amber group"
              >
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

          <div className="relative rounded-3xl border border-amber-500/25 bg-slate-900/80 overflow-hidden shadow-2xl shadow-amber-500/10">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800/80 bg-amber-500/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-slate-500 text-xs font-mono">diagnostico-financeiro.pdf</span>
              <FileText className="w-4 h-4 text-amber-400 ml-auto" />
            </div>

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
      {/* SEÇÃO 6 — PREÇO E CAIXA DE PAGAMENTO PIX / CARTÃO */}
      {/* ══════════════════════════════════════════════════════════ */}
      <section id="secao-pagamento" className="py-20 relative scroll-mt-24" aria-label="Preço e pagamento">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(245,158,11,0.08),transparent)] pointer-events-none" />

        <div
          ref={precoRef}
          className={`max-w-2xl mx-auto px-4 sm:px-6 relative z-10 transition-all duration-700 ${precoInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="rounded-3xl border border-amber-500/30 bg-slate-900/90 overflow-hidden shadow-2xl shadow-amber-500/10">

            {/* Cabeçalho do Preço */}
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 border-b border-amber-500/20 px-8 py-8 text-center">
              <p className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-widest mb-2">Diagnóstico Financeiro Completo</p>
              <div className="flex items-baseline justify-center gap-2 mb-1">
                <span className="text-slate-400 text-lg font-bold">R$</span>
                <span className="text-6xl font-extrabold text-white tracking-tight">197</span>
              </div>
              <p className="text-amber-400 text-sm font-semibold">Pagamento único · Sem assinatura ou mensalidade</p>
            </div>

            {/* Botão de Destaque InfinitePay Exclusivo */}
            <div className="p-6 sm:p-8 space-y-6">
              
              <div className="space-y-3.5 text-left">
                {[
                  { icon: <Zap className="w-5 h-5 text-emerald-400" />, title: 'Liberação Imediata no Ato', desc: 'Acesso instantâneo à Sala de Voz logo após a confirmação.' },
                  { icon: <CreditCard className="w-5 h-5 text-amber-400" />, title: 'PIX Instantâneo ou Cartão em até 12x', desc: 'Processamento 100% seguro com criptografia bancária.' },
                  { icon: <FileText className="w-5 h-5 text-emerald-400" />, title: 'Relatório Executivo Completo em PDF', desc: 'Emissão imediata por IA com DRE Gerencial, Score e Plano de Ação.' },
                  { icon: <Shield className="w-5 h-5 text-emerald-400" />, title: 'Ciclo de Acompanhamento de 90 Dias', desc: 'Inclui 3 reanálises completas (aos 30, 60 e 90 dias) com aviso de prazo para checar seu lucro.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href={CHECKOUT_INFINITEPAY}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 hover:from-emerald-400 hover:to-emerald-200 text-slate-950 font-black px-8 py-5 rounded-2xl shadow-2xl shadow-emerald-500/30 transition-all duration-200 hover:scale-[1.02] text-base sm:text-lg group cursor-pointer text-center"
              >
                <Zap className="w-5 h-5 fill-current shrink-0" />
                Pagar com InfinitePay (PIX & Cartão) — R$ 197
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform shrink-0" />
              </a>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ambiente Seguro InfinitePay · Seus dados protegidos pela LGPD</span>
              </div>

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
