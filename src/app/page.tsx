'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { WHATSAPP, CONTACT_EMAIL } from '@/lib/contact';
import {
  ChevronDown, MessageCircle, Calendar, ArrowRight,
  Sparkles, HeartHandshake,
} from 'lucide-react';

// Componentes BPO
import HeroSection from '@/components/bpo/HeroSection';
import CostComparisonSection from '@/components/bpo/CostComparisonSection';
import ReportShowcase from '@/components/bpo/ReportShowcase';
import PricingSection from '@/components/bpo/PricingSection';
import TrustSection from '@/components/bpo/TrustSection';

// ── Links de WA ──────────────────────────────────────────────────────────────
const WA_DIAGNOSTICO = WHATSAPP.diagnostico;
const WA_BETA        = WHATSAPP.beta;

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

// ── Página Principal ─────────────────────────────────────────────────────────
export default function BpoLandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const [faqRef, faqInView] = useInView();
  const [ctaRef, ctaInView] = useInView();

  const faqs = [
    {
      question: 'Vocês têm acesso ao saldo ou movimentação da minha conta bancária?',
      answer: 'Para a conciliação bancária, trabalhamos com os extratos e saldos que você nos disponibiliza. Não realizamos pagamentos, transferências nem temos senha de acesso. Você aprova e executa 100% das movimentações. Essa separação é formalizada em cláusula contratual de confidencialidade e limitação de acesso.',
    },
    {
      question: 'Como funciona o Diagnóstico Financeiro Gratuito?',
      answer: 'É uma reunião técnica de 30 a 45 minutos onde nosso especialista analisa a rotina atual da sua empresa, mapeia gargalos operacionais e dimensiona a solução exata para a sua realidade — sem compromisso.',
    },
    {
      question: 'O BPO Financeiro substitui a minha contabilidade?',
      answer: 'Não. O BPO cuida da rotina diária (contas a pagar/receber, conciliação e DRE gerencial). A contabilidade trata de impostos, folha e obrigações fiscais. Trabalhamos em sintonia com seu contador atual.',
    },
    {
      question: 'Qual é o prazo para começar após contratar?',
      answer: 'Após a assinatura do contrato e onboarding (mapeamento da sua empresa), iniciamos a operação em até 10 dias úteis. O onboarding inclui a configuração dos processos, acesso às ferramentas e treinamento do ponto de contato da sua empresa.',
    },
    {
      question: 'Como funciona a taxa de implantação?',
      answer: 'A taxa de onboarding é cobrada uma única vez e varia conforme a complexidade da operação da sua empresa (volume de lançamentos, número de contas, histórico de dados). O valor é informado e acordado na proposta comercial antes da assinatura.',
    },
    {
      question: 'Posso fazer um diagnóstico antes de contratar um plano?',
      answer: 'Sim! Esse é exatamente o nosso processo padrão. Agendamos um diagnóstico gratuito de 30 a 45 minutos onde entendemos sua realidade e apresentamos a proposta mais adequada. Nenhum compromisso antes disso.',
    },
    {
      question: 'E o AnalisAI.me (IA Preditiva)? Quando estará disponível?',
      answer: 'O AnalisAI.me é nosso laboratório de inteligência preditiva em constante evolução. Clientes de BPO Financeiro têm acesso prioritário ao Programa Beta conforme disponibilização gradual dos recursos.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden">

      {/* Botão flutuante WhatsApp */}
      <a
        href={WA_DIAGNOSTICO}
        target="_blank"
        rel="noopener noreferrer"
        id="btn-whatsapp-float"
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center gap-3 transition-all duration-300 hover:scale-110 animate-bounce"
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle className="w-6 h-6 fill-slate-950 stroke-none" />
        <span className="font-bold text-sm hidden sm:inline pr-1">Diagnóstico Gratuito</span>
      </a>

      {/* ── HERO + NAVBAR ── */}
      <HeroSection waUrl={WA_DIAGNOSTICO} scrolled={scrolled} />

      {/* ── COMPARATIVO CLT vs BPO ── */}
      <CostComparisonSection />

      {/* ── NÚMEROS DE IMPACTO ── */}
      <div className="border-y border-slate-800/60 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { valor: '+120',  label: 'Empresas atendidas'         },
              { valor: 'R$ 2M+', label: 'Gerenciados mensalmente'  },
              { valor: '95%',  label: 'Clientes com renovação'     },
              { valor: '< 48h', label: 'Para primeira entrega'     },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl sm:text-4xl font-black text-amber-300 mb-1">{stat.valor}</p>
                <p className="text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── O QUE ENTREGAMOS TODO MÊS ── */}
      <ReportShowcase />

      {/* ── SEGURANÇA + SETORES ── */}
      <TrustSection waUrl={WA_DIAGNOSTICO} />

      {/* ── PLANOS ── */}
      <PricingSection />

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 sm:py-28 bg-slate-900/30 border-t border-slate-800/60">
        <div
          ref={faqRef}
          className={`mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ${faqInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Perguntas frequentes</h2>
            <p className="text-slate-400">Transparência desde a primeira conversa.</p>
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
            <Sparkles className="h-3.5 w-3.5" /> Próximo passo
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
            Pronto para ter clareza{' '}
            <span className="text-shimmer-amber">financeira de verdade?</span>
          </h2>
          <p className="text-xl text-slate-300 mb-10 leading-relaxed">
            Agende o diagnóstico gratuito e descubra exatamente o que está impedindo sua empresa de ter um caixa previsível e saudável.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={WA_DIAGNOSTICO}
              target="_blank"
              rel="noopener noreferrer"
              id="final-cta-primary"
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-8 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:-translate-y-1 hover:bg-emerald-300"
            >
              <Calendar className="h-5 w-5" />
              Agendar Diagnóstico Gratuito
              <ArrowRight className="h-5 w-5" />
            </a>
            <Link
              href="/parceiros"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 font-bold text-slate-200 transition hover:border-amber-300/50 hover:text-amber-200"
            >
              <HeartHandshake className="h-5 w-5" />
              Programa de Parcerias Contábeis
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Ou envie um e-mail:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-300 hover:text-amber-200 font-semibold transition-colors">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800/60 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Marca */}
            <div className="lg:col-span-2">
              <p className="text-base font-black text-white mb-2">AnalisAI.me</p>
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                BPO Financeiro especializado para PMEs. Rotina financeira, relatórios gerenciais e inteligência analítica para você decidir com clareza.
              </p>
              <a
                href={WA_BETA}
                target="_blank"
                rel="noopener noreferrer"
                id="footer-cta-beta"
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 rounded-lg hover:bg-emerald-400/20 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Programa Beta IA — Acesso Prioritário
              </a>
            </div>

            {/* Links */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Serviços</p>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li><a href="#planos" className="hover:text-amber-300 transition-colors">Planos BPO</a></li>
                <li><a href="#entregamos" className="hover:text-amber-300 transition-colors">Relatório Executivo</a></li>
                <li><Link href="/diagnostico" className="hover:text-amber-300 transition-colors">Diagnóstico PJ</Link></li>
                <li><Link href="/diagnostico" className="hover:text-amber-300 transition-colors">Diagnóstico PF</Link></li>
                <li><Link href="/parceiros" className="hover:text-amber-300 transition-colors">Parcerias Contábeis</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Legal & Contato</p>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li><Link href="/privacidade" className="hover:text-amber-300 transition-colors">Política de Privacidade</Link></li>
                <li><Link href="/termos" className="hover:text-amber-300 transition-colors">Termos de Uso</Link></li>
                <li><Link href="/contrato" className="hover:text-amber-300 transition-colors">Contrato de Serviço</Link></li>
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
            <p className="text-xs text-slate-700">Feito com foco em resultados reais para empresas reais.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
