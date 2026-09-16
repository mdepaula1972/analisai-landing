'use client';

import React, { useState } from 'react';
import {
  Check, CheckCircle2, Star, Sparkles, MessageCircle,
  ArrowRight, AlertCircle, Zap, Shield, Bot, Users, ExternalLink,
} from 'lucide-react';
import { WHATSAPP } from '@/lib/contact';
import { ASAAS_PLANS, ASAAS_ONE_OFF } from '@/lib/solo/constants';

// ── Planos BPO Humano Tradicional ──────────────────────────────────────────
const PLANOS_BPO = [
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

export default function PricingSection() {
  const [modalidade, setModalidade] = useState<'self' | 'bpo'>('self');
  const [frequencia, setFrequencia] = useState<'mensal' | 'anual'>('mensal');

  return (
    <section id="planos" className="relative py-20 sm:py-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(245,158,11,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-amber opacity-15" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Título */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-amber-300 mb-5">
            <Star className="h-3.5 w-3.5" /> Planos acessíveis e escaláveis
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">
            Gestão financeira sob medida para o{' '}
            <span className="text-shimmer-amber">tamanho do seu negócio</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            Escolha entre a autonomia 100% self-service com IA no WhatsApp ou nosso BPO financeiro completo com atendimento humano.
          </p>
        </div>

        {/* Seletor de Modalidade: Self-Service (IA) vs BPO Humano */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <button
              onClick={() => setModalidade('self')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                modalidade === 'self'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" />
              AnalisAí Solo (100% IA & WhatsApp)
            </button>
            <button
              onClick={() => setModalidade('bpo')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                modalidade === 'bpo'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              BPO com Consultor Humano Dedicado
            </button>
          </div>
        </div>

        {/* ── MODALIDADE 1: ANALISAÍ SOLO (SELF-SERVICE COM IA) ──────────────── */}
        {modalidade === 'self' && (
          <div>
            {/* Toggle Mensal / Anual (-20%) */}
            <div className="flex justify-center items-center gap-3 mb-10">
              <span className={`text-xs sm:text-sm font-semibold ${frequencia === 'mensal' ? 'text-white' : 'text-slate-400'}`}>
                Cobrança Mensal
              </span>
              <button
                onClick={() => setFrequencia(frequencia === 'mensal' ? 'anual' : 'mensal')}
                className="relative inline-flex h-7 w-14 items-center rounded-full bg-slate-800 border border-slate-700 p-1 transition-colors hover:border-amber-500/50"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-amber-500 shadow-md transition-transform ${
                    frequencia === 'anual' ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs sm:text-sm font-semibold flex items-center gap-1.5 ${frequencia === 'anual' ? 'text-white' : 'text-slate-400'}`}>
                Cobrança Anual
                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                  Economize 20%
                </span>
              </span>
            </div>

            {/* Grid dos 5 Planos Self-Service */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 max-w-7xl mx-auto items-stretch mb-14">
              
              {/* 1. Start */}
              <div className="relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/90 p-6 hover:border-slate-700 transition-all">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-3 py-1 rounded-full mb-4 inline-block w-fit">
                  Para começar
                </span>
                <h3 className="text-xl font-black text-white mb-2">AnalisAí Start</h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed min-h-[36px]">
                  O básico essencial para não esquecer contas e manter o caixa sob controle.
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      {frequencia === 'mensal' ? 'R$ 39,90' : 'R$ 383,04'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {frequencia === 'mensal' ? '/mês' : '/ano'}
                    </span>
                  </div>
                  {frequencia === 'anual' && (
                    <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                      Equivalente a R$ 31,92/mês
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 mb-7 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>15 lançamentos/mês</strong> (foto, PDF, voz ou texto)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>1 CNPJ ou CPF</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Livro Caixa cronológico</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Lembretes pontuais às 10h</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-400">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Conciliação avulsa sob demanda</span>
                  </div>
                </div>

                <a
                  href={frequencia === 'mensal' ? ASAAS_PLANS.monthly.start.checkoutUrl : ASAAS_PLANS.annual.start.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl py-3 px-3 font-extrabold text-xs border border-slate-700 text-slate-200 hover:border-amber-500/50 hover:text-amber-200 bg-slate-800/60 transition-all hover:-translate-y-0.5"
                >
                  Assinar Start
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* 2. Solo (Destaque) */}
              <div className="relative flex flex-col rounded-3xl border border-amber-500/60 bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-900 p-6 shadow-2xl shadow-amber-500/10 scale-[1.02] z-10">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 whitespace-nowrap">
                  <Sparkles className="w-3 h-3" /> Mais Escolhido
                </div>

                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-full mb-4 inline-block w-fit">
                  Áudio & Consultor IA
                </span>
                <h3 className="text-xl font-black text-white mb-2">AnalisAí Solo</h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed min-h-[36px]">
                  Controle por áudio no WhatsApp com IA consultora de fluxo de caixa.
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-amber-300">
                      {frequencia === 'mensal' ? 'R$ 87,99' : 'R$ 844,70'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {frequencia === 'mensal' ? '/mês' : '/ano'}
                    </span>
                  </div>
                  {frequencia === 'anual' && (
                    <span className="text-[10px] text-amber-400 font-semibold block mt-1">
                      Equivalente a R$ 70,39/mês
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 mb-7 text-xs text-slate-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>30 lançamentos/mês</strong> (foto, PDF, voz ou texto)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>1 CNPJ ou CPF</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Comandos por voz e texto</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>2 Análises de Caixa/mês</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Conciliação Mensal</strong> (1 banco)</span>
                  </div>
                </div>

                <a
                  href={frequencia === 'mensal' ? ASAAS_PLANS.monthly.solo.checkoutUrl : ASAAS_PLANS.annual.solo.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl py-3 px-3 font-extrabold text-xs bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-0.5"
                >
                  Assinar Solo
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* 3. Solo Plus */}
              <div className="relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/90 p-6 hover:border-slate-700 transition-all">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-3 py-1 rounded-full mb-4 inline-block w-fit">
                  Mais volume
                </span>
                <h3 className="text-xl font-black text-white mb-2">AnalisAí Solo Plus</h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed min-h-[36px]">
                  O dobro de capacidade em lançamentos e análises para rotinas movimentadas.
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      {frequencia === 'mensal' ? 'R$ 157,99' : 'R$ 1.516,70'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {frequencia === 'mensal' ? '/mês' : '/ano'}
                    </span>
                  </div>
                  {frequencia === 'anual' && (
                    <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                      Equivalente a R$ 126,39/mês
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 mb-7 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>60 lançamentos/mês</strong> (o dobro do Solo)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>🛡️ <strong>1 CNPJ + 1 CPF Integrados</strong> (Blindagem contra confusão patrimonial e pró-labore)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>4 Análises de Caixa/mês</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Comandos por voz e texto</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Conciliação Mensal</strong> (1 banco)</span>
                  </div>
                </div>

                <a
                  href={frequencia === 'mensal' ? ASAAS_PLANS.monthly.solo_plus.checkoutUrl : ASAAS_PLANS.annual.solo_plus.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl py-3 px-3 font-extrabold text-xs border border-slate-700 text-slate-200 hover:border-amber-500/50 hover:text-amber-200 bg-slate-800/60 transition-all hover:-translate-y-0.5"
                >
                  Assinar Solo Plus
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* 4. Pro (Sob Demanda) */}
              <div className="relative flex flex-col rounded-3xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/20 via-slate-900 to-slate-900 p-6 hover:border-cyan-500/70 transition-all">
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-full mb-4 inline-block w-fit">
                  Sob Demanda • Vagas Restritas
                </span>
                <h3 className="text-xl font-black text-white mb-2">AnalisAí Pro</h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed min-h-[36px]">
                  Alta performance operacional para empresas em expansão e holdings familiares.
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-cyan-300">
                      {frequencia === 'mensal' ? 'R$ 297,00' : 'R$ 2.851,20'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {frequencia === 'mensal' ? '/mês' : '/ano'}
                    </span>
                  </div>
                  {frequencia === 'anual' && (
                    <span className="text-[10px] text-cyan-400 font-semibold block mt-1">
                      Equivalente a R$ 237,60/mês
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 mb-7 text-xs text-slate-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>500 lançamentos/mês</strong> (foto, PDF, voz/texto)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Até 2 CNPJs inclusos</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Conciliação Semanal</strong> (até 2 contas)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>10 Análises de Caixa/mês</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>🛡️ <strong>Licença com Acompanhamento Dedicado</strong></span>
                  </div>
                </div>

                <a
                  href={`https://wa.me/551331500987?text=${encodeURIComponent('Olá! Tenho interesse no Plano Pro (sob demanda) e gostaria de consultar disponibilidade de vagas para a minha empresa.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl py-3 px-3 font-extrabold text-xs border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/20 bg-cyan-950/30 transition-all hover:-translate-y-0.5"
                >
                  Consultar Vagas (Sob Demanda)
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* 5. Super (Fila de Espera) */}
              <div className="relative flex flex-col rounded-3xl border border-purple-500/40 bg-gradient-to-b from-purple-950/25 via-slate-900 to-slate-900 p-6 hover:border-purple-500/70 transition-all">
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300 bg-purple-500/15 border border-purple-500/30 px-3 py-1 rounded-full mb-4 inline-block w-fit">
                  Alta Performance • Fila de Espera
                </span>
                <h3 className="text-xl font-black text-white mb-2">AnalisAí Super</h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed min-h-[36px]">
                  Poder contábil supremo para grupos empresariais, redes e comércios de alto giro.
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-purple-300">
                      {frequencia === 'mensal' ? 'R$ 597,00' : 'R$ 5.731,20'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {frequencia === 'mensal' ? '/mês' : '/ano'}
                    </span>
                  </div>
                  {frequencia === 'anual' && (
                    <span className="text-[10px] text-purple-400 font-semibold block mt-1">
                      Equivalente a R$ 477,60/mês
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 mb-7 text-xs text-slate-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>1.000 lançamentos/mês</strong> (foto, PDF, voz/texto)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Até 4 CNPJs inclusos</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Conciliação Semanal</strong> (até 4 contas)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>20 Análises de Caixa/mês</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>🛡️ <strong>Fila de Espera com Diretor de Contas</strong></span>
                  </div>
                </div>

                <a
                  href={`https://wa.me/551331500987?text=${encodeURIComponent('Olá! Tenho interesse no Plano Super (sob demanda) e gostaria de consultar disponibilidade de vagas para o nosso grupo empresarial.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl py-3 px-3 font-extrabold text-xs border border-purple-500/40 text-purple-200 hover:bg-purple-500/20 bg-purple-950/30 transition-all hover:-translate-y-0.5"
                >
                  Entrar na Fila de Espera
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

            </div>

            {/* Seção de Serviços e Itens Avulsos */}
            <div className="max-w-6xl mx-auto mb-14">
              <div className="text-center mb-7">
                <h4 className="text-lg sm:text-xl font-black text-white mb-1.5">Serviços Avulsos sob Demanda</h4>
                <p className="text-xs sm:text-sm text-slate-400">Contrate módulos complementares sem fidelidade ou necessidade de upgrade de plano.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* DRE Agrupado Multi-CNPJ */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-amber-500/40 transition-all">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full mb-2 inline-block">
                      Multi-Empresa
                    </span>
                    <h5 className="text-sm font-bold text-white mb-1">DRE Agrupado Multi-CNPJ</h5>
                    <p className="text-xs text-slate-400 mb-3">Consolidação de receitas, custos e lucro de múltiplos CNPJs em um só relatório visual.</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-base font-black text-white">{ASAAS_ONE_OFF.dreConsolidatedMultiCnpj.priceFormatted}</span>
                    <a
                      href={ASAAS_ONE_OFF.dreConsolidatedMultiCnpj.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
                    >
                      Contratar <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Conciliação Bancária Extra */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-cyan-500/40 transition-all">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full mb-2 inline-block">
                      Auditoria
                    </span>
                    <h5 className="text-sm font-bold text-white mb-1">Conciliação Bancária Extra</h5>
                    <p className="text-xs text-slate-400 mb-3">Auditoria de extrato bancário contra o livro caixa com apontamento de divergências.</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-base font-black text-white">{ASAAS_ONE_OFF.bankReconciliationExtra.priceFormatted}</span>
                    <a
                      href={ASAAS_ONE_OFF.bankReconciliationExtra.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300"
                    >
                      Contratar <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Análise de Caixa */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full mb-2 inline-block">
                      Fluxo de Caixa
                    </span>
                    <h5 className="text-sm font-bold text-white mb-1">Análise de Caixa Avulsa</h5>
                    <p className="text-xs text-slate-400 mb-3">Recomendação estratégica de qual conta postergar com menor custo financeiro.</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-base font-black text-white">{ASAAS_ONE_OFF.cashFlowAnalysis.priceFormatted}</span>
                    <a
                      href={ASAAS_ONE_OFF.cashFlowAnalysis.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
                    >
                      Contratar <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Pacote Extra de Lançamentos */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full mb-2 inline-block">
                      Capacidade
                    </span>
                    <h5 className="text-sm font-bold text-white mb-1">Pacote Extra (+20 Lançamentos)</h5>
                    <p className="text-xs text-slate-400 mb-3">Créditos de processamento com validade de 60 dias para picos sazonais de movimentação.</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-base font-black text-white">{ASAAS_ONE_OFF.extraDocsPackage.priceFormatted}</span>
                    <a
                      href={ASAAS_ONE_OFF.extraDocsPackage.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
                    >
                      Contratar <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Raio-X */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full mb-2 inline-block">
                      Pesquisa de Mercado
                    </span>
                    <h5 className="text-sm font-bold text-white mb-1">Raio-X de Fornecedores</h5>
                    <p className="text-xs text-slate-400 mb-3">Mapeamento regional via IA com relatório comparativo de preços e cotações.</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-base font-black text-white">{ASAAS_ONE_OFF.supplierXray.priceFormatted}</span>
                    <a
                      href={ASAAS_ONE_OFF.supplierXray.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
                    >
                      Contratar <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Certificado Digital */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full mb-2 inline-block">
                      Fiscal & Parceria
                    </span>
                    <h5 className="text-sm font-bold text-white mb-1">Certificado Digital A1</h5>
                    <p className="text-xs text-slate-400 mb-3">Emissão rápida de e-CNPJ ou e-CPF por videoconferência com segurança homologada.</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-base font-black text-white">{ASAAS_ONE_OFF.digitalCertificateA1.priceFormatted}</span>
                    <a
                      href={ASAAS_ONE_OFF.digitalCertificateA1.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
                    >
                      Emitir Agora <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

              </div>

              {/* Nota de Transparência Contratual sobre Lançamentos */}
              <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 text-center sm:text-left flex flex-col sm:flex-row items-center gap-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Como são contabilizados os lançamentos no seu plano:</strong> Qualquer conta a pagar ou receita cadastrada no sistema — seja enviando a foto ou PDF de um boleto/nota fiscal, ou informando dados por comando de voz ou texto no WhatsApp — computa como <strong>1 lançamento</strong> na sua cota mensal. Sem letras miúdas, com controle transparente e aviso antecipado quando a cota estiver próxima do limite.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODALIDADE 2: BPO FINANCEIRO DEDICADO COM EQUIPE HUMANA ─────────── */}
        {modalidade === 'bpo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch mb-12">
            {PLANOS_BPO.map((plano) => (
              <div
                key={plano.id}
                className={`relative flex flex-col rounded-3xl border p-6 sm:p-7 transition-all duration-300 ${
                  plano.destaque
                    ? 'bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-900 border-amber-500/60 shadow-2xl shadow-amber-500/10 scale-[1.02] z-10'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
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

                <div className="flex-1 space-y-2 mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">O que inclui:</p>
                  {plano.itens.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-xs sm:text-[13px] text-slate-300 leading-snug">
                      <CheckCircle2 className={`mt-0.5 w-3.5 h-3.5 shrink-0 ${plano.destaque ? 'text-amber-400' : 'text-emerald-400'}`} />
                      <span>{item}</span>
                    </div>
                  ))}

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
                  Falar com Especialista
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Avisos e garantias */}
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white mb-0.5">Transparência Total e Sem Fidelidade Forçada</p>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                No AnalisAí Solo, seus contadores de consumo são exibidos em tempo real pelo WhatsApp ou painel. No BPO com consultor humano, o alinhamento de rotinas é feito com acompanhamento contínuo e relatórios executivos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <Check className="w-4 h-4 text-emerald-400" />, text: 'Contrato flexível sem burocracia' },
              { icon: <MessageCircle className="w-4 h-4 text-emerald-400" />, text: 'Atendimento direto via WhatsApp' },
              { icon: <Shield className="w-4 h-4 text-emerald-400" />, text: 'Segurança e sigilo de dados' },
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
