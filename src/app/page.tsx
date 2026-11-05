'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/contact';
import {
  ChevronDown, MessageCircle, ArrowRight,
  Sparkles, HeartHandshake, ShieldCheck, Building2,
  Smartphone, Settings, Check, FileText, Lock,
  TrendingUp, BarChart3, Clock, HelpCircle,
  FileCheck2, FolderArchive, ArrowUpRight, CheckCircle2
} from 'lucide-react';

// Componentes BPO
import HeroSection, { WA_DIAGNOSTICO } from '@/components/bpo/HeroSection';
import SolutionsComparisonSection from '@/components/bpo/SolutionsComparisonSection';
import ReportShowcase from '@/components/bpo/ReportShowcase';
import TrustSection from '@/components/bpo/TrustSection';
import DashboardShowcase from '@/components/DashboardShowcase';

// Link comercial oficial do WhatsApp
const WA_COMERCIAL = WA_DIAGNOSTICO;
const WA_PARCERIA = 'https://wa.me/5513920099874?text=Ol%C3%A1%2C%20sou%20contador%20e%20gostaria%20de%20conhecer%20a%20parceria%20de%20BPO%20do%20AnalisA%C3%AD';

// ── Hook de visibilidade ─────────────────────────────────────────────────────
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

// ── FAQ ──────────────────────────────────────────────────────────────────────
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

// ── Página Principal Reformulada ─────────────────────────────────────────────
export default function BpoLandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const [pilaresRef, pilaresInView] = useInView();
  const [contadoresRef, contadoresInView] = useInView();
  const [faqRef, faqInView] = useInView();
  const [ctaRef, ctaInView] = useInView();

  const faqs = [
    {
      question: 'Como funciona o BPO Financeiro do AnalisAí no dia a dia?',
      answer: 'O processo é extremamente natural e integrado ao WhatsApp. Ao longo do dia, você ou sua equipe fotografam boletos, notas fiscais ou mandam áudios com despesas de rua. Nossa inteligência faz a extração inicial e o time de controladoria valida, agenda os pagamentos, concilia centavo por centavo e mantém o fluxo de caixa sempre em dia.',
    },
    {
      question: 'O AnalisAí terá acesso à minha conta bancária ou senhas?',
      answer: 'Não! Adotamos o Protocolo Zero Banking Access. Jamais solicitamos senhas, tokens ou permissão de movimentação bancária. O AnalisAí organiza, agenda e envia a linha digitável ou código Pix pronto para que você, titular da conta, efetue a aprovação final em 1 clique dentro do aplicativo do seu próprio banco.',
    },
    {
      question: 'Como meu contador recebe os documentos e o fechamento do mês?',
      answer: 'Eliminamos completamente o envio de extratos amassados e a digitação manual na contabilidade. Até o 5º dia útil do mês seguinte, o escritório contábil recebe o Pacote Fiscal completo em arquivo .ZIP estruturado, contendo o Livro Caixa em PDF, a DRE Gerencial, a pasta com todos os comprovantes originais e um arquivo CSV formatado para importação direta no sistema contábil (Domínio, Questor, Alterdata, etc.).',
    },
    {
      question: 'Como é calculada a mensalidade do serviço de BPO?',
      answer: 'Nossa precificação é consultiva e personalizada de acordo com o porte e o volume operacional da sua empresa (quantidade média de lançamentos por mês, número de contas bancárias a conciliar e complexidade fiscal). Agendamos um diagnóstico inicial de 15 minutos para entender sua rotina e apresentar uma proposta sob medida com excelente relação custo-benefício.',
    },
    {
      question: 'Minha secretária ou assistente pode lançar contas sem ver meu saldo ou lucros?',
      answer: 'Sim! Nosso fluxo pelo WhatsApp conta com proteção hierárquica de dados. Operadores e assistentes cadastrados podem enviar comprovantes, cadastrar contas e consultar vencimentos operacionais sem jamais ter acesso a extratos consolidados, saldos bancários ou margens de lucro da empresa.',
    },
    {
      question: 'O que é o Radar Semanal de Caixa e a DRE Gerencial?',
      answer: 'Toda segunda-feira de manhã, enviamos um resumo preditivo com as entradas e saídas programadas para a semana e o saldo livre projetado. Até o dia 5 de cada mês, emitimos a DRE analítica detalhada com receitas, custos fixos/variáveis, apuração de margem e auditoria preventiva para evitar despesas pessoais na conta jurídica.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden">

      {/* Botão flutuante WhatsApp */}
      <a
        href={WA_COMERCIAL}
        target="_blank"
        rel="noopener noreferrer"
        id="btn-whatsapp-float"
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center gap-3 transition-all duration-300 hover:scale-105 group"
        aria-label="Solicitar Diagnóstico no WhatsApp"
      >
        <MessageCircle className="w-6 h-6 fill-slate-950 stroke-none" />
        <span className="font-extrabold text-sm hidden sm:inline pr-1">Falar com Especialista</span>
      </a>

      {/* ── HERO + NAVBAR ── */}
      <HeroSection scrolled={scrolled} />

      {/* ── NÚMEROS DE IMPACTO DA CONTROLADORIA ── */}
      <div className="border-y border-slate-800/60 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { valor: 'Até 5º Dia Útil', label: 'Pacote fiscal entregue ao contador' },
              { valor: 'Zero Senhas', label: 'Sua conta bancária 100% blindada' },
              { valor: '100% no Zap', label: 'Sem planilhas ou sistemas complexos' },
              { valor: 'DRE & Radar', label: 'Previsibilidade semanal e mensal' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl sm:text-4xl font-black text-amber-300 mb-1">{stat.valor}</p>
                <p className="text-xs sm:text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SEÇÃO: PILARES OPERACIONAIS (COMO FUNCIONA) ── */}
      <section id="pilares" className="relative py-24 sm:py-32 overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(16,185,129,0.06),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-emerald-300 mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Metodologia Operacional
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
              Como o BPO AnalisAí transforma a rotina do seu negócio
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              Combinamos a simplicidade do WhatsApp com processos rigorosos de controladoria para dar total clareza e previsibilidade ao seu financeiro.
            </p>
          </div>

          <div
            ref={pilaresRef}
            className={`grid md:grid-cols-3 gap-8 transition-all duration-700 ${pilaresInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            {/* Pilar 1 */}
            <div className="relative rounded-3xl border border-slate-800 bg-slate-900/60 p-8 hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between group">
              <div className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-[11px] font-black text-emerald-300">
                PILAR 01
              </div>
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                  <Smartphone className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Entrada Descomplicada no WhatsApp
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Esqueça a tarefa de sentar no fim do dia para preencher planilhas. Basta fotografar boletos, notas fiscais ou ditar áudios de despesas na rua. Nossa tecnologia extrai dados e organiza tudo em segundos.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 border-t border-slate-800/80 pt-5">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Leitura instantânea de boletos e notas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Áudios de despesas gravados no dia a dia</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Acesso seguro para secretária e auxiliares</span>
                </li>
              </ul>
            </div>

            {/* Pilar 2 */}
            <div className="relative rounded-3xl border border-slate-800 bg-slate-900/60 p-8 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between group">
              <div className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-[11px] font-black text-amber-300">
                PILAR 02
              </div>
              <div>
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                  <Lock className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Protocolo Zero Banking Access
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Sua segurança é inegociável. Nunca pedimos senhas, tokens ou autorização de movimentação bancária. Agendamos e entregamos linhas digitáveis prontas para autorização em 1 clique pelo titular.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 border-t border-slate-800/80 pt-5">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Zero risco de transações indevidas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Você mantém a soberania no seu banco</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Lembretes matinais para evitar juros e multas</span>
                </li>
              </ul>
            </div>

            {/* Pilar 3 */}
            <div className="relative rounded-3xl border border-slate-800 bg-slate-900/60 p-8 hover:border-teal-500/40 transition-all duration-300 flex flex-col justify-between group">
              <div className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-teal-500/20 border border-teal-500/40 px-3 py-1 text-[11px] font-black text-teal-300">
                PILAR 03
              </div>
              <div>
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Inteligência e Previsibilidade
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Não somos apenas digitadores de contas passadas. Toda segunda-feira você recebe o Radar Semanal de Caixa e, no fechamento do mês, uma DRE analítica detalhada com suporte de controladoria consultiva.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 border-t border-slate-800/80 pt-5">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Radar Semanal de Liquidez às segundas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>DRE Gerencial detalhada no dia 5</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Auditoria e proteção de despesas PF x PJ</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── VITRINE DO PAINEL EXECUTIVO ── */}
      <section id="painel" className="relative overflow-hidden py-20 sm:py-28 bg-slate-900/30 border-y border-slate-800/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(16,185,129,0.07),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-emerald-300 mb-5">
              <BarChart3 className="h-3.5 w-3.5" /> Visão Consolidada
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
              Seus números organizados e{' '}
              <span className="text-shimmer-emerald">sempre na palma da mão</span>
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              Diga adeus às pilhas de comprovantes desorganizados. Acompanhe entradas, saídas, boletos pendentes e projeções em tempo real pelo WhatsApp ou no portal web do cliente.
            </p>
          </div>
          <DashboardShowcase />
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={WA_COMERCIAL}
              target="_blank"
              rel="noopener noreferrer"
              id="painel-cta-whatsapp"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-emerald-400 px-7 py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300"
            >
              <MessageCircle className="h-4 w-4 fill-slate-950 stroke-none" /> Agendar Demonstração Operacional
            </a>
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-bold text-slate-200 hover:text-white hover:border-slate-500 transition-colors"
            >
              <Smartphone className="h-4 w-4 text-emerald-400" /> Acessar Área do Cliente
            </Link>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO: PARA ESCRITÓRIOS DE CONTABILIDADE (PARCERIA) ── */}
      <section id="contadores" className="relative py-24 sm:py-32 overflow-hidden bg-slate-950 border-b border-slate-800/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_20%,rgba(245,158,11,0.08),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            ref={contadoresRef}
            className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center transition-all duration-700 ${contadoresInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            {/* Texto de Parceria */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-amber-300 mb-6">
                <Building2 className="h-3.5 w-3.5" /> Parceria Estratégica
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-6 leading-[1.15]">
                Seu escritório livre de digitar extratos amassados e conciliar notas atrasadas.
              </h2>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
                O AnalisAí atua como a extensão operacional do seu escritório dentro dos seus clientes. Nós garantimos a rotina diária de contas e conciliação para que seu time contábil receba tudo auditado e pronto para apuração.
              </p>

              <div className="space-y-4 mb-10">
                <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-white text-sm font-bold block mb-1">Pacote Fiscal Completo em .ZIP até o 5º Dia Útil</strong>
                    <span className="text-slate-400 text-xs leading-relaxed">
                      Download com 1 clique do Livro Caixa em PDF, DRE Gerencial, pasta de comprovantes originais e CSV estruturado para Domínio, Questor, Alterdata e outros.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-white text-sm font-bold block mb-1">Conciliação Conferida Centavo por Centavo</strong>
                    <span className="text-slate-400 text-xs leading-relaxed">
                      Acabe com as lacunas de conciliação. Toda entrada e saída é checada ao longo do mês pelo nosso time de controladoria.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-white text-sm font-bold block mb-1">Modelo de Receita Recorrente para o Escritório</strong>
                    <span className="text-slate-400 text-xs leading-relaxed">
                      Monitore a carteira indicada em tempo real pelo Portal do Contador e receba comissão recorrente mensal garantida por contrato.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contador"
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 px-7 py-4 text-sm font-black text-slate-950 shadow-xl shadow-amber-500/20 transition hover:-translate-y-0.5"
                >
                  <Building2 className="w-4 h-4" />
                  Acessar Portal do Contador
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href={WA_PARCERIA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-4 text-sm font-bold text-slate-200 hover:text-white hover:border-slate-500 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  Falar sobre Parceria Contábil
                </a>
              </div>
            </div>

            {/* Card Visual do Pacote Fiscal */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 backdrop-blur-md shadow-2xl relative">
              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Portal do Contador</p>
                    <p className="text-sm font-bold text-white">Pacote Fiscal Consolidado (ZIP)</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-[11px] font-bold text-emerald-300">
                  Pronto até o 5º Dia Útil
                </span>
              </div>

              <div className="py-6 space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold text-slate-200">livro_caixa_competencia.pdf</p>
                      <p className="text-[10px] text-slate-500">Livro Caixa oficial com CNPJ, resumo cronológico e saldos</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400">Gerado</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-xs font-semibold text-slate-200">dre_gerencial_analitica.pdf</p>
                      <p className="text-[10px] text-slate-500">Demonstração de resultado detalhada com centros de custos</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400">Gerado</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <FileCheck2 className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-xs font-semibold text-slate-200">extrato_conciliado_dominio.csv</p>
                      <p className="text-[10px] text-slate-500">Formato pronto para importação contábil (Domínio / Questor)</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400">Pronto</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <FolderArchive className="w-4 h-4 text-teal-400" />
                    <div>
                      <p className="text-xs font-semibold text-slate-200">comprovantes_originais/</p>
                      <p className="text-[10px] text-slate-500">Todos os boletos, notas fiscais e recibos auditados</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400">100% Salvos</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Totalmente integrado à Torre BPO</span>
                <Link href="/contador" className="text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1">
                  Ver painel de demonstração <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── O QUE ENTREGAMOS TODO MÊS (RELATÓRIOS) ── */}
      <ReportShowcase />

      {/* ── TABELA COMPARATIVA (ANALISAÍ VS OUTRAS SOLUÇÕES) ── */}
      <SolutionsComparisonSection waUrl={WA_COMERCIAL} />

      {/* ── SEGURANÇA + SETORES ── */}
      <TrustSection waUrl={WA_COMERCIAL} />

      {/* ── SEÇÃO: DIAGNÓSTICO CONSULTIVO & PROPOSTA SOB MEDIDA ── */}
      <section id="proposta" className="relative py-24 sm:py-32 overflow-hidden bg-slate-950 border-t border-slate-800/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(16,185,129,0.1),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-emerald-300 mb-4">
              <ShieldCheck className="h-3.5 w-3.5" /> Proposta Consultiva
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
              Precificação sob medida para o volume da sua empresa
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              Não acreditamos em pacotes genéricos com taxas ocultas. Cada empresa tem um volume específico de contas, contas bancárias e rotinas. Fazemos um diagnóstico rápido de 15 minutos para entregar a solução ideal.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Modalidade 1 */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 sm:p-10 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
              <div>
                <span className="inline-block rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-400 uppercase tracking-wider mb-4">
                  Modalidade Operacional
                </span>
                <h3 className="text-2xl font-black text-white mb-2">BPO Gestão Financeira</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Ideal para empresas que precisam eliminar a rotina pesada de lançar pagamentos, emitir lembretes e conciliar contas com rigor.
                </p>

                <ul className="space-y-3 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Contas a pagar e receber via WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Conciliação bancária diária conferida</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Protocolo Zero Banking Access (segurança total)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Fechamento fiscal e envio direto ao contador</span>
                  </li>
                </ul>
              </div>

              <a
                href={WA_COMERCIAL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 text-sm transition-colors border border-slate-700"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                Solicitar Proposta para Gestão
              </a>
            </div>

            {/* Modalidade 2 */}
            <div className="rounded-3xl border-2 border-emerald-500/60 bg-gradient-to-b from-slate-900/90 to-slate-900/50 p-8 sm:p-10 flex flex-col justify-between shadow-2xl shadow-emerald-500/10 relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-emerald-400 px-3.5 py-1 text-[11px] font-black text-slate-950 uppercase tracking-wider">
                Mais Solicitado
              </div>
              <div>
                <span className="inline-block rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-black text-emerald-300 uppercase tracking-wider mb-4">
                  Modalidade Estratégica
                </span>
                <h3 className="text-2xl font-black text-white mb-2">BPO Controladoria & CFO</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Para empresários que buscam visão de futuro, previsibilidade de fluxo de caixa e consultoria para redução de custos e blindagem.
                </p>

                <ul className="space-y-3 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Tudo da modalidade Gestão Financeira</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Radar Semanal de Liquidez toda segunda-feira</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>DRE Gerencial analítica detalhada com indicadores</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Auditoria de despesas particulares (PF x PJ)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Reunião mensal de alinhamento e estratégia</span>
                  </li>
                </ul>
              </div>

              <a
                href={WA_COMERCIAL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black py-4 text-sm transition-all shadow-xl shadow-emerald-500/25 hover:-translate-y-0.5"
              >
                <MessageCircle className="w-4 h-4 fill-slate-950 stroke-none" />
                Agendar Diagnóstico Gratuito
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 sm:py-28 bg-slate-900/30 border-t border-slate-800/60">
        <div
          ref={faqRef}
          className={`mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${faqInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Perguntas frequentes</h2>
            <p className="text-slate-400">Tudo o que você precisa saber sobre a Controladoria e BPO AnalisAí.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.question} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(245,158,11,0.12),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-grid-amber opacity-20" />

        <div
          ref={ctaRef}
          className={`mx-auto max-w-3xl px-4 sm:px-6 text-center transition-all duration-700 ${ctaInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[.14em] text-amber-300">
            <Sparkles className="h-3.5 w-3.5" /> Comece agora mesmo
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
            Pronto para colocar seu financeiro{' '}
            <span className="text-shimmer-amber">nas mãos de especialistas?</span>
          </h2>
          <p className="text-xl text-slate-300 mb-10 leading-relaxed">
            Elimine a desordem fiscal, ganhe previsibilidade e abasteça seu contador sem atrito.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={WA_COMERCIAL}
              target="_blank"
              rel="noopener noreferrer"
              id="final-cta-primary"
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-8 py-4 text-base font-black text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:-translate-y-1 hover:bg-emerald-300"
            >
              <MessageCircle className="h-5 w-5 fill-slate-950 stroke-none" />
              Solicitar Diagnóstico Financeiro
              <ArrowRight className="h-5 w-5" />
            </a>
            <Link
              href="/contador"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 font-bold text-slate-200 transition hover:border-amber-300/50 hover:text-amber-200"
            >
              <Building2 className="w-5 h-5 text-amber-400" />
              Sou Escritório Contábil
            </Link>
          </div>
          <p className="mt-8 text-sm text-slate-500">
            Ou envie um e-mail para nossa equipe:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-300 hover:text-amber-200 font-semibold transition-colors">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </section>

      {/* ── FOOTER REFORMULADO COM PORTAIS DE ACESSO ── */}
      <footer className="border-t border-slate-800/60 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Marca */}
            <div className="lg:col-span-2">
              <p className="text-base font-black text-white mb-2">AnalisAI.me</p>
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-4">
                Plataforma de Controladoria Terceirizada (BPO Financeiro) para pequenas e médias empresas e escritórios contábeis. Gestão de pagamentos, conciliação e previsibilidade sem fricção.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 rounded-lg hover:bg-emerald-400/20 transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Área do Cliente
                </Link>
                <Link
                  href="/contador"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 rounded-lg hover:bg-amber-400/20 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5" /> Portal do Contador
                </Link>
                <Link
                  href="/admin/bpo"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 border border-slate-700 bg-slate-900 px-3 py-1.5 rounded-lg hover:text-slate-200 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Torre BPO
                </Link>
              </div>
            </div>

            {/* Links Rápidos */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Acessos Rápidos</p>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li><Link href="/portal" className="hover:text-emerald-300 transition-colors flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-emerald-400" /> Área do Cliente</Link></li>
                <li><Link href="/contador" className="hover:text-amber-300 transition-colors flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-amber-400" /> Portal do Contador</Link></li>
                <li><Link href="/admin/bpo" className="hover:text-slate-200 transition-colors flex items-center gap-1.5"><Settings className="w-3.5 h-3.5 text-slate-400" /> Torre de Controle (Gestor)</Link></li>
                <li><a href="#pilares" className="hover:text-amber-300 transition-colors">Pilares Operacionais</a></li>
                <li><a href="#proposta" className="hover:text-amber-300 transition-colors">Diagnóstico Consultivo</a></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Legal & Contato</p>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li><Link href="/privacidade" className="hover:text-amber-300 transition-colors">Política de Privacidade</Link></li>
                <li><Link href="/termos" className="hover:text-amber-300 transition-colors">Termos de Uso</Link></li>
                <li><Link href="/contrato" className="hover:text-amber-300 transition-colors">Contrato de BPO Modular</Link></li>
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-amber-300 transition-colors">{CONTACT_EMAIL}</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              © {new Date().getFullYear()} AnalisAI.me · Solucione Assessoria Virtual · Todos os direitos reservados.
            </p>
            <p className="text-xs text-slate-700">Controladoria e BPO Financeiro com Tecnologia de Ponta.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
