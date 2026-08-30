'use client';

import React from 'react';
import {
  Check, CheckCircle2, Star, Sparkles, MessageCircle,
  ArrowRight, AlertCircle, Zap, Shield,
} from 'lucide-react';
import { WHATSAPP } from '@/lib/contact';

// ── Dados dos planos inclusivos ──────────────────────────────────────────────

const PLANOS = [
  {
    id: 'mei',
    nome: 'Autônomo & MEI',
    subtitulo: 'Para autônomos, MEIs e liberais',
    preco: 'R$ 397',
    periodo: '/mês',
    destaque: false,
    badge: 'Inicial Inclusivo',
    waLink: WHATSAPP.planoMei,
    itens: [
      'Contas a pagar e receber essenciais',
      'Conciliação bancária mensal',
      'Emissão de notas fiscais e boletos',
      'Relatório mensal de fechamento',
      'Suporte operacional via WhatsApp',
    ],
    nao: [
      'Conciliação bancária diária',
      'DRE Gerencial completa',
      'Dashboard executivo digital',
      'Reuniões de acompanhamento',
    ],
  },
  {
    id: 'essencial',
    nome: 'Essencial',
    subtitulo: 'Para micro e pequenas empresas',
    preco: 'R$ 697',
    periodo: '/mês',
    destaque: false,
    badge: null,
    waLink: WHATSAPP.planoEssencial,
    itens: [
      'Tudo do Plano MEI',
      'Conciliação bancária diária',
      'Gestão e agendamento de pagamentos',
      'Fluxo de caixa semanal atualizado',
      'Relatório gerencial mensal',
      'Suporte ágil via WhatsApp',
    ],
    nao: [
      'DRE Gerencial com análise de margens',
      'Dashboard executivo digital 24h',
      'Reunião mensal com especialista',
    ],
  },
  {
    id: 'gestao',
    nome: 'Gestão & Relatórios',
    subtitulo: 'Mais escolhido pelas PMEs',
    preco: 'R$ 1.397',
    periodo: '/mês',
    destaque: true,
    badge: 'Mais Escolhido',
    waLink: WHATSAPP.planoGestao,
    itens: [
      'Tudo do Plano Essencial',
      'DRE Gerencial completa (Sintética + Analítica)',
      'Dashboard executivo digital (acesso 24h)',
      'Análise de margens, custos e EBITDA',
      'Alertas preventivos de caixa',
      'Reunião mensal de revisão (60 min)',
      'Parecer executivo analítico mensal',
      'Suporte prioritário dedicado',
    ],
    nao: [],
  },
  {
    id: 'estrategico',
    nome: 'CFO Estratégico',
    subtitulo: 'Para visão e inteligência de escala',
    preco: 'R$ 1.997',
    periodo: '/mês',
    destaque: false,
    badge: 'Avançado',
    waLink: WHATSAPP.planoEstrategico,
    itens: [
      'Tudo do Plano Gestão & Relatórios',
      'Planejamento orçamentário anual (Budget)',
      'Simulação de cenários e ponto de equilíbrio',
      'Gestão de capital de giro (FCL/ROI)',
      'Reuniões quinzenais estratégicas',
      'KPIs customizados para diretoria e sócios',
      'Acesso antecipado a novas features IA',
    ],
    nao: [],
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function PricingSection() {
  return (
    <section id="planos" className="relative py-20 sm:py-28 overflow-hidden">

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(245,158,11,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-amber opacity-15" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Título */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-amber-300 mb-5">
            <Star className="h-3.5 w-3.5" /> Planos acessíveis e escaláveis
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
            Gestão financeira sob medida para o{' '}
            <span className="text-shimmer-amber">tamanho do seu negócio</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            Do autônomo e MEI à empresa em expansão: organização profissional, sem burocracia e com previsibilidade.
          </p>
        </div>

        {/* Grid dos 4 planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch mb-12">
          {PLANOS.map((plano) => (
            <div
              key={plano.id}
              className={`relative flex flex-col rounded-3xl border p-6 sm:p-7 transition-all duration-300 ${
                plano.destaque
                  ? 'bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-900 border-amber-500/60 shadow-2xl shadow-amber-500/10 scale-[1.02] z-10'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Badge superior */}
              {plano.badge && (
                <div
                  className={`absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-widest whitespace-nowrap shadow-md ${
                    plano.destaque
                      ? 'bg-amber-500 text-slate-950 shadow-amber-500/30'
                      : 'bg-slate-800 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {plano.destaque ? <Sparkles className="w-3 h-3" /> : <Zap className="w-3 h-3 text-amber-400" />}
                  {plano.badge}
                </div>
              )}

              {/* Cabeçalho */}
              <div className="mb-5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full mb-3 inline-block">
                  {plano.subtitulo}
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-3">{plano.nome}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-slate-400 font-semibold">A partir de</span>
                  <span className={`text-2xl sm:text-3xl font-black leading-none ${plano.destaque ? 'text-amber-300' : 'text-white'}`}>
                    {plano.preco}
                  </span>
                  {plano.periodo && (
                    <span className="text-slate-400 text-xs sm:text-sm">{plano.periodo}</span>
                  )}
                </div>
              </div>

              {/* Itens incluídos */}
              <div className="flex-1 space-y-2 mb-6">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">O que inclui:</p>
                {plano.itens.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-xs sm:text-[13px] text-slate-300 leading-snug">
                    <CheckCircle2 className={`mt-0.5 w-3.5 h-3.5 shrink-0 ${plano.destaque ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <span>{item}</span>
                  </div>
                ))}

                {/* Itens não incluídos (para dar ancoragem) */}
                {plano.nao.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-800/80 space-y-1.5 opacity-60">
                    {plano.nao.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-xs text-slate-500 leading-snug">
                        <span className="w-3.5 h-3.5 shrink-0 text-center font-bold text-slate-600">—</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA */}
              <a
                href={plano.waLink}
                target="_blank"
                rel="noopener noreferrer"
                id={`plano-cta-${plano.id}`}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4 font-extrabold text-xs sm:text-sm transition-all hover:-translate-y-0.5 ${
                  plano.destaque
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/25'
                    : 'border border-slate-700 text-slate-200 hover:border-amber-500/50 hover:text-amber-200 bg-slate-800/50'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                Solicitar Proposta
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>

        {/* Avisos e garantias */}
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white mb-0.5">Taxa de implantação (onboarding) única</p>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Todos os planos incluem onboarding estruturado para mapeamento de contas, parametrização dos processos e alinhamento da rotina. Valor dimensionado na proposta conforme volume e complexidade.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <Check className="w-4 h-4 text-emerald-400" />, text: 'Contrato mensal — sem multa de saída' },
              { icon: <MessageCircle className="w-4 h-4 text-emerald-400" />, text: 'Suporte direto via WhatsApp' },
              { icon: <Shield className="w-4 h-4 text-emerald-400" />, text: 'NDA e sigilo contratual rigoroso' },
            ].map((item) => (
              <div key={item.text} className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-center">
                {item.icon}
                <span className="text-xs text-slate-300 font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
