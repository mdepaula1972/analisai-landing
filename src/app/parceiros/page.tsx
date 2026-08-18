'use client';

import React, { useState, useEffect, useRef } from 'react';
import { WHATSAPP, CONTACT_EMAIL } from '@/lib/contact';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight,
  DollarSign, RefreshCw, TrendingUp, FileText, Receipt,
  PieChart, Zap, Shield, Users, Target, BarChart3,
  MessageCircle, Lock, Sparkles, ShieldCheck, Clock,
  Building2, Briefcase, Award, FileSpreadsheet, AlertTriangle,
  Scale, Layers, Handshake, UserCheck, Check, HelpCircle
} from 'lucide-react';

const WA_PARCEIRO_HERO = WHATSAPP.parceria;
const WA_PARCEIRO_REUNIAO = WHATSAPP.parceria;

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

export default function ParceirosPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const [heroRef, heroInView] = useInView(0.05);
  const [crescemosRef, crescemosInView] = useInView();
  const [doresRef, doresInView] = useInView();
  const [transicaoRef, transicaoInView] = useInView();
  const [comoFuncionaRef, comoFuncionaInView] = useInView();
  const [beneficiosRef, beneficiosInView] = useInView();
  const [porQueRef, porQueInView] = useInView();
  const [experienciaRef, experienciaInView] = useInView();
  const [oqueExecutamosRef, oqueExecutamosInView] = useInView();
  const [inovacaoRef, inovacaoInView] = useInView();
  const [compromissoRef, compromissoInView] = useInView();
  const [faqRef, faqInView] = useInView();

  const doresContador = [
    'Cliente envia notas fiscais atrasadas ou incompletas.',
    'Cliente pergunta diariamente quanto pode gastar ou retirar.',
    'Cliente mistura a conta pessoal com a conta da empresa (confusão patrimonial).',
    'Cliente pede informações financeiras que não fazem parte da contabilidade.',
    'Cliente esquece pagamentos importantes e sofre com multas e juros.',
    'Cliente culpa a contabilidade pela falta de organização financeira própria.',
  ];

  const comoFuncionaEtapas = [
    { num: '1', title: 'Identificação', desc: 'Você identifica um cliente com necessidade urgente de organização financeira.' },
    { num: '2', title: 'Apresentação', desc: 'Você nos apresenta ao cliente de forma simples e direta.' },
    { num: '3', title: 'Operação BPO', desc: 'Nossa equipe assume toda a operação financeira diária do seu cliente.' },
    { num: '4', title: 'Acompanhamento & Benefício', desc: 'Você acompanha a evolução e conta com modelo transparente de participação financeira.' },
  ];

  const beneficiosParceiro = [
    'Programa Fundador: somente 10 primeiros escritórios elegíveis',
    'Comissão escalonada acima do padrão, conforme volume e qualidade das indicações',
    'Condição vitalícia enquanto o contrato e os critérios de elegibilidade permanecerem ativos',
    'Modelo de repasse transparente, com o parceiro recebendo do próprio cliente e repassando a parcela acordada à Lizaimi',
    'Sem investimento inicial e sem mensalidade para entrar',
    'Atendimento prioritário e canal direto com a equipe',
    'Equipe BPO dedicada para a operação financeira do cliente',
    'Comunicação transparente e prestação de contas',
    'Integração respeitosa com a contabilidade, sem concorrência pelo cliente',
  ];

  const oqueExecutamos = [
    'Contas a pagar',
    'Contas a receber',
    'Emissão de faturamento',
    'Fluxo de caixa projetado',
    'Conciliação financeira',
    'Relatórios gerenciais',
    'Organização financeira',
    'Acompanhamento financeiro',
    'Suporte administrativo financeiro',
  ];

  const provaInstitucional = [
    { title: 'Não prestamos serviços contábeis', desc: 'Respeito absoluto à sua carteira: não concorremos com o contador em nenhuma hipótese.' },
    { title: 'Atuação exclusiva na rotina financeira', desc: 'Foco total no BPO operacional (contas, conciliação e caixa) para facilitar o trabalho contábil.' },
    { title: 'Comunicação transparente', desc: 'Canal aberto e constante com o escritório parceiro sobre o status de cada cliente.' },
    { title: 'Processos documentados e padronizados', desc: 'Metodologia testada e controle rigoroso de entregas para evitar qualquer imprevisto.' },
    { title: 'Equipe experiente e multidisciplinar', desc: 'Profissionais com mais de 40 anos de bagagem acumulada em administração e finanças.' },
    { title: 'Atendimento humanizado e personalizado', desc: 'Suporte próximo e dedicado tanto para o empresário quanto para a equipe do contador.' },
    { title: 'Compromisso com ética e conformidade legal', desc: 'Contratos formais de confidencialidade (NDA), conformidade com a LGPD e regras do CFC.' },
  ];

  const faqs = [
    {
      question: 'Como funciona a parceria?',
      answer: 'Após uma conversa inicial, apresentamos o funcionamento do programa e definimos o modelo mais adequado para o perfil do seu escritório.'
    },
    {
      question: 'Existe contrato?',
      answer: 'Sim. Todas as parcerias são formalizadas para garantir transparência e segurança para ambas as partes.'
    },
    {
      question: 'Como funciona a condição Fundador?',
      answer: 'As 10 primeiras parcerias elegíveis entram em uma faixa especial de comissão escalonada, com possibilidade de condição vitalícia enquanto os critérios definidos em contrato forem mantidos. O modelo de repasse, a documentação fiscal, a conciliação e as regras de elegibilidade são apresentados na reunião comercial e validados antes da adesão.'
    },
    {
      question: 'Posso indicar apenas um cliente?',
      answer: 'Sim! Nosso programa foi desenvolvido para atender desde pequenos escritórios até operações de maior porte.'
    },
    {
      question: 'O cliente continua sendo meu?',
      answer: 'Sim! Absolutamente. Nosso relacionamento com o cliente é exclusivamente operacional e focado na gestão financeira. O relacionamento contábil, fiscal e tributário continua 100% sob a responsabilidade do seu escritório.'
    },
    {
      question: 'Vocês realizam serviços contábeis?',
      answer: 'Não! Nunca. Nosso foco é estritamente BPO Financeiro (gestão de rotina operacional de caixa). Não fazemos apuração de impostos, folha de pagamento ou contabilidade. Nós somamos ao trabalho do contador, nunca concorremos com ele.'
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 relative">

      {/* ── BOTÃO FLUTUANTE DE WHATSAPP PARCEIRO ── */}
      <a
        href={WA_PARCEIRO_HERO}
        target="_blank"
        rel="noopener noreferrer"
        id="btn-whatsapp-parceiro-float"
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center gap-3 group transition-all duration-300 hover:scale-110 animate-bounce"
        aria-label="Falar no WhatsApp com o Consultor de Parcerias"
      >
        <MessageCircle className="w-7 h-7 fill-slate-950 stroke-none" />
        <span className="font-bold text-sm hidden sm:inline pr-1">Seja um Parceiro</span>
      </a>

      {/* ── NAVBAR ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 shadow-xl shadow-black/30' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 transition-colors text-xs sm:text-sm font-medium mr-2">
              <ArrowLeft className="w-4 h-4" /> Início
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex flex-col items-start justify-center">
              <Image src="/logo.png" alt="AnalisAI.me — Programa de Parcerias Contábeis" width={480} height={132} className="h-10 sm:h-12 w-auto object-contain" priority />
              <span className="text-[9px] font-extrabold tracking-widest uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-md -mt-0.5">
                v2.5.0 · BPO Multi-tenant
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-xs xl:text-sm font-medium text-slate-300">
            <a href="#programa" className="hover:text-amber-400 transition-colors font-semibold text-amber-400">O Programa</a>
            <a href="#beneficios" className="hover:text-amber-400 transition-colors">Benefícios</a>
            <a href="#por-que-escolhem" className="hover:text-amber-400 transition-colors">Por Que Nós</a>
            <Link href="/contrato" className="hover:text-amber-400 transition-colors">Contrato</Link>
            <Link href="/privacidade" className="hover:text-emerald-400 transition-colors">Privacidade</Link>
            <Link href="/termos" className="hover:text-amber-400 transition-colors">Termos</Link>
            <a href="#faq" className="hover:text-amber-400 transition-colors">FAQ</a>
          </nav>

          <a
            href={WA_PARCEIRO_HERO}
            target="_blank"
            rel="noopener noreferrer"
            id="nav-cta-parceiro-whatsapp"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all hover:scale-[1.03] shadow-lg shadow-emerald-500/25 text-sm flex items-center gap-2"
          >
            <Handshake className="w-4 h-4" />
            Seja um Parceiro
          </a>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(245,158,11,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-grid-amber opacity-30 pointer-events-none" />
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl animate-float pointer-events-none" />

        <div ref={heroRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-700 ${heroInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* Texto do Hero */}
            <div className="lg:col-span-7 text-left space-y-6">
              
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Handshake className="w-4 h-4 text-amber-400" />
                Programa Estratégico de Parceria para Escritórios Contábeis
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
                Transforme um problema recorrente do seu escritório em uma{' '}
                <span className="text-shimmer-amber">nova fonte de receita</span>.
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                Seus clientes precisam de organização financeira. Nós executamos o trabalho. Você fortalece seu relacionamento, reduz retrabalho e entra na condição Fundador: as 10 primeiras parcerias elegíveis podem ter comissão escalonada acima do padrão, com condição vitalícia prevista em contrato.
              </p>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                <a
                  href={WA_PARCEIRO_HERO}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="hero-cta-parceiro-whatsapp"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3 text-base hover:scale-[1.02]"
                >
                  <Handshake className="w-5 h-5" />
                  Quero ser um parceiro
                  <ArrowRight className="w-5 h-5" />
                </a>

                <a
                  href={WA_PARCEIRO_REUNIAO}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="hero-cta-agendar-conversa"
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold px-7 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm text-center"
                >
                  Agendar uma conversa
                </a>
              </div>

              <p className="text-xs text-slate-500 flex items-center gap-2 pt-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Sem mensalidades · Sem concorrência · Respeito à sua carteira de clientes
              </p>
            </div>

            {/* Ilustração / Card de Fluxo Visual do Parceiro */}
            <div className="lg:col-span-5 relative">
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-2xl shadow-black/50 relative overflow-hidden animate-float">
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Ecossistema da Parceria</p>
                      <p className="text-slate-500 text-xs">Contabilidade + BPO + Cliente</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    Sinergia Perfeita
                  </span>
                </div>

                {/* Elementos visuais do card */}
                <div className="space-y-3 pt-2">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-amber-400" />
                      <span className="text-xs font-semibold text-white">Escritório Contábil</span>
                    </div>
                    <span className="text-xs text-amber-400 font-bold">+ Participação Financeira</span>
                  </div>

                  <div className="flex justify-center my-1">
                    <ChevronDown className="w-5 h-5 text-slate-600 animate-bounce" />
                  </div>

                  <div className="bg-slate-950 border border-amber-500/20 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-amber-400" />
                      <span className="text-xs font-semibold text-white">Operação BPO AnalisAI.me</span>
                    </div>
                    <span className="text-xs text-emerald-400 font-bold">Documentos em Dia</span>
                  </div>

                  <div className="flex justify-center my-1">
                    <ChevronDown className="w-5 h-5 text-slate-600 animate-bounce" />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs font-semibold text-white">Empresário (Seu Cliente)</span>
                    </div>
                    <span className="text-xs text-slate-400 font-bold">Gestão Organizada</span>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-amber-400" /> DRE &amp; Fluxo</span>
                  <span className="flex items-center gap-1.5"><Receipt className="w-4 h-4 text-emerald-400" /> Notas Organizadas</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SEÇÃO NOVA: PROGRAMA DE PARCERIAS (CRESCEMOS JUNTOS) ── */}
      <section id="programa" className="py-24 bg-slate-900/60 border-y border-slate-800/80 relative overflow-hidden">
        <div ref={crescemosRef} className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-700 ${crescemosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-amber-500/30 rounded-3xl p-8 sm:p-14 shadow-2xl text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-3xl space-y-5">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                Parceria Comercial Estratégica
              </span>

              <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
                Crescemos juntos.
              </h2>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                Nosso Programa de Parcerias foi desenvolvido para escritórios contábeis que desejam ampliar o valor entregue aos seus clientes, reduzir retrabalho e construir uma relação comercial de longo prazo.
              </p>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                Além de fortalecer o relacionamento com seus clientes, nossos parceiros fundadores contam com uma proposta de comissão escalonada e um modelo operacional de repasse. A ideia é que o escritório receba do próprio cliente e repasse a parcela da Lizaimi, com conciliação, critérios claros e formalização contratual. A estrutura final deve ser aprovada juridicamente, fiscalmente e financeiramente antes da publicação definitiva.
              </p>

              <div className="pt-4">
                <a
                  href={WA_PARCEIRO_HERO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-8 py-4 rounded-2xl transition-all hover:scale-[1.02] shadow-xl shadow-amber-500/20 text-sm"
                >
                  <Handshake className="w-5 h-5" />
                  Conhecer o Programa de Parcerias
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO: DORES DO CONTADOR ── */}
      <section className="py-20">
        <div ref={doresRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${doresInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Realidade dos Escritórios</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Você certamente já viveu isso...
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">Problemas operacionais que tiram a produtividade da sua equipe contábil no dia a dia.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doresContador.map((dor, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-6 text-left transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-slate-200 text-sm leading-relaxed font-medium">{dor}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 max-w-3xl mx-auto text-center">
            <p className="text-amber-300 font-bold text-base sm:text-lg">
              No final, seu escritório trabalha mais, gasta tempo orientando o básico e recebe exatamente o mesmo.
            </p>
          </div>
        </div>
      </section>

      {/* ── BLOCO DE TRANSIÇÃO ── */}
      <section className="py-24 bg-slate-900/30 border-y border-slate-800/80 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)] pointer-events-none" />

        <div ref={transicaoRef} className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 transition-all duration-700 ${transicaoInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4">Nova Realidade</span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-8">
            Agora imagine outro cenário.
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
            {[
              'Seus clientes possuem um departamento financeiro terceirizado.',
              'As contas a pagar e receber são organizadas e pagas rigorosamente em dia.',
              'O faturamento é faturado e documentado corretamente.',
              'Os comprovantes e documentos chegam à contabilidade no prazo.',
              'As informações financeiras ficam perfeitamente estruturadas.',
              'A contabilidade recebe tudo mastigado, ganhando alta produtividade.',
            ].map((item, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 flex items-start gap-3 transition-colors">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA (TIMELINE EM 4 ETAPAS) ── */}
      <section id="como-funciona" className="py-24">
        <div ref={comoFuncionaRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${comoFuncionaInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Passo a Passo</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Como Funciona a Parceria</h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">Processo simples, transparente e sem burocracia para seu escritório.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {comoFuncionaEtapas.map(({ num, title, desc }, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-7 text-left relative overflow-hidden flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-xl mb-6 group-hover:scale-110 transition-transform">
                    {num}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 z-20">
                    <ChevronRight className="w-6 h-6 text-amber-500/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS DO PARCEIRO (CARDS EXCLUSIVOS) ── */}
      <section id="beneficios" className="py-24 bg-slate-900/40 border-y border-slate-800/80">
        <div ref={beneficiosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${beneficiosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Vantagens do Programa</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white">Benefícios do Parceiro</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {beneficiosParceiro.map((item, i) => (
              <div key={i} className="card-glow-amber bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl flex items-center gap-4 transition-all">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POR QUE OS ESCRITÓRIOS ESCOLHEM TRABALHAR CONOSCO? (PROVA INSTITUCIONAL) ── */}
      <section id="por-que-escolhem" className="py-28">
        <div ref={porQueRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${porQueInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Prova Institucional</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-5">
              Por que os escritórios escolhem trabalhar conosco?
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">Diferenciais objetivos que transmitem confiança sólida para o contador parceiro.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {provaInstitucional.map(({ title, desc }, i) => (
              <div key={i} className="card-glow bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-7 rounded-3xl transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BLOCO INSTITUCIONAL: INOVAÇÃO CONTÍNUA ── */}
      <section id="inovacao" className="py-24 bg-slate-900/60 border-y border-slate-800/80 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)] pointer-events-none" />

        <div ref={inovacaoRef} className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-700 ${inovacaoInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/30 rounded-3xl p-8 sm:p-14 text-left relative overflow-hidden shadow-2xl">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5" /> Futuro da Gestão Financeira
              </span>

              <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
                Inovação Contínua
              </h2>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                Estamos investindo continuamente em tecnologia para ampliar os serviços oferecidos aos nossos parceiros. Entre nossos projetos está uma plataforma inteligente de apoio à gestão financeira, atualmente em fase de desenvolvimento e validação.
              </p>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                Os escritórios parceiros poderão participar dessa evolução e terão acesso antecipado às novidades, conforme disponibilidade e cronograma do projeto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── NOSSA EXPERIÊNCIA INSTITUCIONAL (MAIS DE 40 ANOS) ── */}
      <section id="experiencia" className="py-28">
        <div ref={experienciaRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${experienciaInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Tradição &amp; Solidez</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-5">
              Experiência construída ao longo de décadas.
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Nosso time reúne profissionais com sólida atuação em administração, gestão empresarial, gestão financeira e operações administrativas. São <strong className="text-amber-400">mais de quatro décadas de experiência acumulada</strong> em empresas de diferentes portes e segmentos da economia, apoiando organizações na estruturação de processos, organização financeira, controles internos e suporte à tomada de decisão.
            </p>
          </div>

          {/* Cards Institucionais */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left mb-14">
            {[
              { title: 'Administradores', desc: 'Profissionais com visão estratégica da gestão empresarial e dos processos organizacionais.', icon: <Building2 className="w-6 h-6 text-amber-400" /> },
              { title: 'Gestores Empresariais', desc: 'Especialistas em estruturação de processos, eficiência operacional e apoio à tomada de decisão.', icon: <Briefcase className="w-6 h-6 text-amber-400" /> },
              { title: 'Especialistas Financeiros', desc: 'Experiência em contas a pagar, contas a receber, fluxo de caixa, faturamento, conciliações e controles financeiros.', icon: <DollarSign className="w-6 h-6 text-amber-400" /> },
              { title: 'Analistas Operacionais', desc: 'Equipe preparada para executar operações financeiras com organização, precisão e confidencialidade.', icon: <FileSpreadsheet className="w-6 h-6 text-amber-400" /> },
              { title: 'Mais de 40 Anos de Bagagem', desc: 'Experiência acumulada em empresas de diversos segmentos e portes, desde pequenos negócios até organizações complexas.', icon: <Award className="w-6 h-6 text-amber-400" /> },
              { title: 'Processos Padronizados', desc: 'Metodologia testada para garantir consistência e cumprimento rigoroso dos prazos acordados.', icon: <Layers className="w-6 h-6 text-amber-400" /> },
            ].map(({ title, desc, icon }, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  {icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Indicadores Institucionais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center">
            {[
              { val: '+40 Anos', label: 'Experiência Acumulada' },
              { val: '100%', label: 'Conformidade LGPD & Ética' },
              { val: 'Zero', label: 'Concorrência com Contador' },
              { val: 'Recorrente', label: 'Participação por Indicação' },
            ].map(({ val, label }, i) => (
              <div key={i}>
                <p className="text-2xl sm:text-4xl font-extrabold text-amber-400 mb-1">{val}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── O QUE EXECUTAMOS PARA SEUS CLIENTES ── */}
      <section className="py-24 bg-slate-900/40 border-y border-slate-800/80">
        <div ref={oqueExecutamosRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${oqueExecutamosInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Escopo de Atuação</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">O que executamos para os seus clientes</h2>
            <p className="text-slate-400 text-sm mt-2">Um departamento financeiro completo operado por nossa equipe.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {oqueExecutamos.map((item, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 flex items-center gap-3 text-left transition-colors">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOSSO COMPROMISSO INSTITUCIONAL (FUNDO DIFERENCIADO DE ÉTICA) ── */}
      <section id="compromisso" className="py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border border-amber-500/40 rounded-3xl p-8 sm:p-14 relative overflow-hidden shadow-2xl text-left">
            <div className="max-w-3xl space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Shield className="w-4 h-4" />
                Nosso Compromisso Ético com o Contador
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
                Respeito absoluto ao seu relacionamento com o cliente.
              </h2>

              <div className="space-y-3 pt-2">
                {[
                  'NUNCA substituímos a contabilidade.',
                  'NUNCA prestamos serviços contábeis, fiscais ou tributários.',
                  'NUNCA interferimos no relacionamento entre escritório e cliente.',
                  'Atuação ética e transparente respeitando as normas do CFC.',
                  'Tratamento das informações financeiras com sigilo absoluto e conformidade LGPD.',
                  'Relacionamento baseado em parceria de longo prazo e ganho mútuo.',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-slate-200 font-semibold">{item}</span>
                  </div>
                ))}
              </div>

              <p className="text-slate-400 text-sm pt-2">
                Somos o departamento financeiro do seu cliente. Você continua sendo o contador de confiança.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ DO CONTADOR ── */}
      <section id="faq" className="py-24 bg-slate-900/30 border-t border-slate-800/80">
        <div ref={faqRef} className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${faqInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Tire Suas Dúvidas</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Perguntas Frequentes dos Contadores</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => <FaqItem key={i} question={f.question} answer={f.answer} />)}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-28 relative overflow-hidden bg-slate-900/60 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-8 sm:p-14 shadow-2xl relative overflow-hidden">

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
              Ofereça mais valor aos seus clientes sem aumentar a estrutura do seu escritório.
            </h2>

            <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              Organização financeira, processos estruturados e uma parceria construída para fortalecer seu escritório e seus clientes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={WA_PARCEIRO_HERO}
                target="_blank"
                rel="noopener noreferrer"
                id="btn-parceiro-final-main"
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-8 py-5 rounded-2xl transition-all hover:scale-[1.03] shadow-2xl shadow-emerald-500/30 text-base flex items-center justify-center gap-3"
              >
                <Handshake className="w-5 h-5" />
                Quero fazer parte do Programa de Parceiros
              </a>

              <a
                href={WA_PARCEIRO_REUNIAO}
                target="_blank"
                rel="noopener noreferrer"
                id="btn-parceiro-final-sec"
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold px-7 py-5 rounded-2xl transition-all text-sm text-center"
              >
                Falar com um especialista
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ── COMPLIANCE & FOOTER ── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
          
          {/* Seção Compliance */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-2">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" /> Segurança e Conformidade
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Tratamos todas as informações financeiras com rigor técnico e confidencialidade. Adotamos boas práticas de governança, segurança da informação e privacidade de dados, em conformidade com a Lei Geral de Proteção de Dados (LGPD). Todas as parcerias são conduzidas com transparência, ética profissional e respeito à legislação aplicável.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
            <div className="flex items-center gap-4">
              <Image src="/logo.png" alt="AnalisAI.me — Solucione Assessoria Virtual" width={360} height={100} className="h-10 w-auto object-contain" />
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-slate-400 font-medium">
              <a href={WA_PARCEIRO_HERO} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">WhatsApp Parceiros</a>
              <Link href="/contrato" className="hover:text-amber-400 transition-colors">Modelo de Contrato</Link>
              <Link href="/privacidade" className="hover:text-emerald-400 transition-colors">Política de Privacidade</Link>
              <Link href="/termos" className="hover:text-amber-400 transition-colors">Termos de Uso</Link>
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
            <div>
              <p className="text-slate-300 font-semibold mb-1">Solucione Assessoria Virtual</p>
              <p className="text-slate-500">CNPJ: 57.740.336/0001-08 · Programa de Parcerias Contábeis · {CONTACT_EMAIL}</p>
            </div>
            <p className="text-slate-600 max-w-md text-[11px] leading-relaxed">
              O BPO Financeiro é um serviço consultivo de gestão operacional de apoio à contabilidade. Não realizamos serviços contábeis ou apuração fiscal.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
