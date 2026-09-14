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
import DashboardShowcase from '@/components/DashboardShowcase';

// ── Links de WA ──────────────────────────────────────────────────────────────
const WA_SOLO        = WHATSAPP.soloTeste;
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
      question: 'Como funciona o teste grátis no WhatsApp?',
      answer: 'Você não precisa cadastrar cartão de crédito nem preencher formulários longos. Basta clicar em "Testar no WhatsApp", mandar um "Olá" e enviar a foto ou PDF de um boleto. Em 2 segundos a IA lê os dados, cadastra a conta e te dá as boas-vindas.',
    },
    {
      question: 'Quais tipos de documentos a inteligência artificial lê?',
      answer: 'Boletos bancários (em PDF ou fotos mesmo que amassados), faturas de consumo (luz, água, telefone, internet), notas fiscais (NF-e, NFS-e) e recibos. Você também pode mandar áudios de voz gravados com gastos do dia a dia.',
    },
    {
      question: 'Vocês têm acesso à minha conta bancária ou realizam pagamentos?',
      answer: 'Não! O AnalisAí organiza suas contas, monta seu Livro Caixa e te envia alertas de vencimento pelo WhatsApp. Quem autoriza e realiza 100% dos pagamentos no aplicativo do seu banco é você. Seus dados financeiros são estritamente confidenciais e criptografados.',
    },
    {
      question: 'Como funciona a emissão do Relatório de Livro Caixa em PDF?',
      answer: 'A qualquer momento você pode pedir no WhatsApp (por exemplo: "me manda o relatório em PDF"). A IA gera instantaneamente um documento A4 executivo com o logotipo da sua empresa, CNPJ, extrato cronológico e relação de contas atrasadas e a vencer.',
    },
    {
      question: 'Qual a diferença entre o AnalisAí Solo (IA) e o BPO Financeiro com consultor?',
      answer: 'No AnalisAí Solo (a partir de R$ 39,90/mês), você tem autonomia total: manda documentos e recebe relatórios pelo WhatsApp. No BPO Financeiro com consultor (a partir de R$ 397/mês), um especialista humano assume a conciliação bancária, emissão de notas e reuniões mensais com você.',
    },
    {
      question: 'Como faço para assinar após o teste?',
      answer: 'Você pode assinar diretamente na seção de Planos do site ou solicitar o link de pagamento Asaas pelo próprio WhatsApp. A liberação do limite do seu plano é instantânea.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden">

      {/* Botão flutuante WhatsApp */}
      <a
        href={WA_SOLO}
        target="_blank"
        rel="noopener noreferrer"
        id="btn-whatsapp-float"
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center gap-3 transition-all duration-300 hover:scale-110 animate-bounce"
        aria-label="Testar no WhatsApp"
      >
        <MessageCircle className="w-6 h-6 fill-slate-950 stroke-none" />
        <span className="font-extrabold text-sm hidden sm:inline pr-1">Testar 1 Boleto Grátis</span>
      </a>

      {/* ── HERO + NAVBAR ── */}
      <HeroSection waUrl={WA_SOLO} scrolled={scrolled} />

      {/* ── NÚMEROS DE IMPACTO ── */}
      <div className="border-y border-slate-800/60 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { valor: '2 seg', label: 'Tempo de leitura do boleto pela IA' },
              { valor: 'R$ 39,90', label: 'Planos a partir de /mês' },
              { valor: '100%', label: 'No seu WhatsApp sem instalar app' },
              { valor: 'PDF A4', label: 'Relatório oficial com seu CNPJ' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl sm:text-4xl font-black text-amber-300 mb-1">{stat.valor}</p>
                <p className="text-xs sm:text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── VITRINE DO PAINEL EXECUTIVO ── */}
      <section id="painel" className="relative overflow-hidden py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(16,185,129,0.07),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-emerald-300 mb-5">
              <Sparkles className="h-3.5 w-3.5" /> Inteligência Analítica
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
              Seus números organizados e{' '}
              <span className="text-shimmer-emerald">sempre na palma da mão</span>
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              Diga adeus às pilhas de comprovantes esquecidos. Com o AnalisAí, seu fluxo de caixa, vencimentos e relatórios estão sempre atualizados pelo WhatsApp.
            </p>
          </div>
          <DashboardShowcase />
          <div className="mt-10 flex flex-col items-center gap-4">
            <a
              href={WA_SOLO}
              target="_blank"
              rel="noopener noreferrer"
              id="painel-cta-whatsapp"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-emerald-400 px-7 py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300"
            >
              <MessageCircle className="h-4 w-4 fill-slate-950 stroke-none" /> Experimentar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── O QUE ENTREGAMOS TODO MÊS ── */}
      <ReportShowcase />

      {/* ── SEGURANÇA + SETORES ── */}
      <TrustSection waUrl={WA_SOLO} />

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
            <p className="text-slate-400">Tudo o que você precisa saber sobre o AnalisAí Solo.</p>
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
            <span className="text-shimmer-amber">no piloto automático?</span>
          </h2>
          <p className="text-xl text-slate-300 mb-10 leading-relaxed">
            Envie a foto de 1 boleto gratuitamente no WhatsApp e veja a mágica acontecer em segundos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={WA_SOLO}
              target="_blank"
              rel="noopener noreferrer"
              id="final-cta-primary"
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-8 py-4 text-base font-black text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:-translate-y-1 hover:bg-emerald-300"
            >
              <MessageCircle className="h-5 w-5 fill-slate-950 stroke-none" />
              Testar 1 Boleto Grátis no WhatsApp
              <ArrowRight className="h-5 w-5" />
            </a>
            <a
              href="#planos"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 font-bold text-slate-200 transition hover:border-amber-300/50 hover:text-amber-200"
            >
              Ver Planos e Assinar
            </a>
          </div>
          <div className="mt-4">
            <Link
              href="/parceiros"
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-amber-300 transition-colors"
            >
              <HeartHandshake className="h-4 w-4" />
              É contador? Conheça nosso Programa de Parcerias Contábeis
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
