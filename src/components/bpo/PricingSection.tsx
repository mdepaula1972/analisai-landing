'use client';

import React from 'react';
import {
  Check, CheckCircle2, Star, Sparkles, MessageCircle,
  ArrowRight, AlertCircle,
} from 'lucide-react';
import { WHATSAPP } from '@/lib/contact';

// ── Dados dos planos ─────────────────────────────────────────────────────────

const PLANOS = [
  {
    id: 'essencial',
    nome: 'Essencial',
    subtitulo: 'Para começar com organização',
    preco: 'A partir de R$ 990',
    periodo: '/mês',
    destaque: false,
    badge: null,
    waLink: WHATSAPP.planoEssencial,
    itens: [
      'Contas a pagar e a receber',
      'Conciliação bancária diária',
      'Emissão de boletos e notas',
      'Fluxo de caixa atualizado',
      'Relatório mensal simplificado',
      'Suporte operacional via WhatsApp',
    ],
    nao: [
      'DRE Gerencial completa',
      'Dashboard executivo digital',
      'Reuniões mensais de revisão',
    ],
  },
  {
    id: 'gestao',
    nome: 'Gestão & Relatórios',
    subtitulo: 'Mais escolhido pelos nossos clientes',
    preco: 'A partir de R$ 1.890',
    periodo: '/mês',
    destaque: true,
    badge: 'Mais Escolhido',
    waLink: WHATSAPP.planoGestao,
    itens: [
      'Tudo do Plano Essencial',
      'DRE Gerencial completa (Sintética + Analítica)',
      'Dashboard executivo digital (acesso 24h)',
      'Análise de margens e indicadores',
      'Alertas automáticos de caixa',
      'Reunião mensal de revisão (60 min)',
      'Parecer executivo analítico mensal',
      'Suporte prioritário via WhatsApp',
    ],
    nao: [],
  },
  {
    id: 'estrategico',
    nome: 'CFO Estratégico',
    subtitulo: 'Para quem precisa de visão de longo prazo',
    preco: 'Sob Consulta',
    periodo: '',
    destaque: false,
    badge: 'Premium',
    waLink: WHATSAPP.planoEstrategico,
    itens: [
      'Tudo do Plano Gestão & Relatórios',
      'Planejamento orçamentário anual (Budget)',
      'Simulações de cenários financeiros',
      'Análise de ponto de equilíbrio',
      'Gestão de capital de giro',
      'Reuniões quinzenais estratégicas',
      'Acompanhamento de KPIs customizados',
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
            <Star className="h-3.5 w-3.5" /> Planos e investimento
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
            Escolha a estrutura{' '}
            <span className="text-shimmer-amber">ideal para sua empresa</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            Preços transparentes, contrato mensal sem multa de saída e sem surpresas.
          </p>
        </div>

        {/* Grid de planos */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch mb-10">
          {PLANOS.map((plano) => (
            <div
              key={plano.id}
              className={`relative flex flex-col rounded-3xl border p-7 transition-all duration-300 ${
                plano.destaque
                  ? 'bg-gradient-to-b from-amber-500/10 to-slate-900 border-amber-500/50 shadow-2xl shadow-amber-500/10 scale-[1.02]'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Badge */}
              {plano.badge && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-widest whitespace-nowrap ${
                  plano.destaque ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                }`}>
                  {plano.destaque && <Sparkles className="w-3 h-3" />}
                  {plano.badge}
                </div>
              )}

              {/* Cabeçalho */}
              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full mb-3 inline-block">
                  {plano.subtitulo}
                </span>
                <h3 className="text-2xl font-extrabold text-white mb-4">{plano.nome}</h3>
                <div className="flex items-end gap-1">
                  <span className={`text-3xl font-black leading-none ${plano.destaque ? 'text-amber-300' : 'text-white'}`}>
                    {plano.preco}
                  </span>
                  {plano.periodo && (
                    <span className="text-slate-400 text-sm mb-0.5">{plano.periodo}</span>
                  )}
                </div>
              </div>

              {/* Itens incluídos */}
              <div className="flex-1 space-y-2.5 mb-6">
                {plano.itens.map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <CheckCircle2 className={`mt-0.5 w-4 h-4 shrink-0 ${plano.destaque ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <span>{item}</span>
                  </div>
                ))}

                {/* Itens não incluídos */}
                {plano.nao.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-800/60 space-y-2">
                    {plano.nao.map((item) => (
                      <div key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <span className="mt-0.5 w-4 h-4 shrink-0 text-center font-bold">—</span>
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
                className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 px-6 font-extrabold text-sm transition-all hover:-translate-y-0.5 ${
                  plano.destaque
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/25'
                    : 'border border-slate-700 text-slate-200 hover:border-amber-500/50 hover:text-amber-200'
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
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white mb-0.5">Taxa de implantação (onboarding) única</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Todos os planos incluem um processo de onboarding estruturado para mapear sua empresa, configurar os processos e treinar o time. Valor informado na proposta conforme complexidade.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {[
              { icon: <Check className="w-4 h-4 text-emerald-400" />, text: 'Contrato mensal — sem multa de saída' },
              { icon: <MessageCircle className="w-4 h-4 text-emerald-400" />, text: 'Suporte via WhatsApp dedicado' },
              { icon: <Check className="w-4 h-4 text-emerald-400" />, text: 'NDA e contrato de confidencialidade' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 flex-1 justify-center rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
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
