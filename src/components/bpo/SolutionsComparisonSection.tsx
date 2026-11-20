'use client';

import React from 'react';
import {
  X, Check, ShieldCheck, ArrowRight, MessageCircle,
  Lock, Users, FileSpreadsheet, Scale, DollarSign,
  TrendingUp, EyeOff,
} from 'lucide-react';
import { WHATSAPP } from '@/lib/contact';

const COMPARATIVO_ITEMS = [
  {
    criterio: 'Custo Mensal',
    icone: <DollarSign className="w-4 h-4 text-amber-400" />,
    clt: {
      titulo: 'R$ 4.000+ (salário, encargos, benefícios e provisões)',
      detalhe: 'Custo fixo elevado somando salário base, FGTS, INSS, provisão de férias, 13º, benefícios e risco rescisório.',
    },
    bpo: {
      titulo: 'Fração do valor em contrato B2B previsível',
      detalhe: 'Reduza seus custos financeiros em mais de 50% logo no primeiro mês, sem encargos trabalhistas ou surpresas.',
      destaque: 'Economia Real',
    },
  },
  {
    criterio: 'Risco e Continuidade',
    icone: <Users className="w-4 h-4 text-blue-400" />,
    clt: {
      titulo: 'Férias, 13º, faltas, turnover e passivo trabalhista',
      detalhe: 'Ausências, férias, pedidos de demissão e curva de treinamento interrompem o financeiro e geram passivo trabalhista.',
    },
    bpo: {
      titulo: 'Zero vínculo trabalhista e operação contínua com equipe de 4 especialistas',
      detalhe: 'Operação contínua o ano inteiro com time dedicado de analistas de faturamento, contas a pagar e contas a receber.',
      destaque: 'Continuidade',
    },
  },
  {
    criterio: 'Nível de Entrega',
    icone: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    clt: {
      titulo: 'Operador focado apenas em lançar boletos',
      detalhe: 'Rotina operacional reativa em planilhas manuais, sem análise de margens, DRE gerencial ou visão de controladoria.',
    },
    bpo: {
      titulo: 'Controladoria sênior (+30 anos de experiência) + Painel Executivo em tempo real',
      detalhe: 'Conciliação bancária diária, DRE gerencial completa, fluxo de caixa e parecer analítico revisado por liderança sênior.',
      destaque: 'Nível Sênior',
    },
  },
  {
    criterio: 'Segurança Bancária',
    icone: <Lock className="w-4 h-4 text-emerald-400" />,
    clt: {
      titulo: 'Risco de acesso a senhas e movimentações',
      detalhe: 'Compartilhamento de credenciais bancárias ou tokens internos expõe o caixa da empresa a erros e fraudes.',
    },
    bpo: {
      titulo: 'Zero acesso às suas contas (você aprova tudo no seu banco)',
      detalhe: 'Segurança Total: não pedimos senhas nem acessos bancários. Você mantém 100% do controle das aprovações e pagamentos.',
      destaque: '100% Blindado',
    },
  },
  {
    criterio: 'Sigilo de Dados',
    icone: <EyeOff className="w-4 h-4 text-amber-400" />,
    clt: {
      titulo: 'Funcionário interno com visão de saldos e lucros',
      detalhe: 'Colaborador interno acaba visualizando faturamento real, saldos bancários, margem de lucro e retiradas dos sócios.',
    },
    bpo: {
      titulo: 'Modo Equipe com sigilo absoluto de saldos',
      detalhe: 'Sua equipe interna envia boletos e notas pelo WhatsApp sem jamais ter acesso a extratos, saldos ou lucros da empresa.',
      destaque: 'Sigilo Absoluto',
    },
  },
  {
    criterio: 'Fechamento Contábil',
    icone: <FileSpreadsheet className="w-4 h-4 text-purple-400" />,
    clt: {
      titulo: 'Envio manual e despadronizado',
      detalhe: 'Comprovantes soltos, pastas incompletas e atrasos recorrentes que geram retrabalho constante com a contabilidade.',
    },
    bpo: {
      titulo: 'Pacote Fiscal em .ZIP + CSV estruturado entregue até o 5º dia útil',
      detalhe: 'Todos os comprovantes organizados, notas fiscais renomeadas e conciliação estruturada prontos para o seu contador.',
      destaque: 'Até o 5º Dia Útil',
    },
  },
];

export default function SolutionsComparisonSection({ waUrl }: { waUrl?: string }) {
  const diagnosticoUrl = waUrl || WHATSAPP.diagnostico;

  return (
    <section
      id="comparativo"
      className="relative py-20 sm:py-28 overflow-hidden border-y border-slate-800/70 bg-slate-900/40"
    >
      {/* Luzes de fundo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(16,185,129,0.08),transparent)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="pointer-events-none absolute top-1/4 right-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-emerald-300 mb-5">
            <ShieldCheck className="h-3.5 w-3.5" /> BPO vs. Contratação CLT
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.08] tracking-tight mb-5">
            BPO AnalisAí.me vs.{' '}
            <span className="text-slate-400 line-through decoration-red-500/60 decoration-2 font-extrabold">
              Analista Financeiro CLT
            </span>
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Compare custos reais, continuidade e nível de entrega e entenda por que empresas em crescimento substituem a folha fixa CLT por uma{' '}
            <strong className="text-emerald-300">controladoria sênior terceirizada</strong>.
          </p>
        </div>

        {/* ── DESKTOP: TABELA COMPARATIVA ── */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-xl">
          {/* Header das Colunas */}
          <div className="grid grid-cols-[1.2fr_1.4fr_1.8fr] border-b border-slate-800 bg-slate-900/90 text-sm font-extrabold">
            <div className="px-6 py-4 text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-400" />
              Critério de Escolha
            </div>
            <div className="px-6 py-4 border-l border-slate-800/80 text-slate-300 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <X className="w-3.5 h-3.5 text-red-400" />
              </div>
              <span>Analista Financeiro CLT (R$ 4.000+/mês)</span>
            </div>
            <div className="px-6 py-4 border-l border-emerald-500/40 bg-emerald-500/10 text-emerald-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/25 border border-emerald-400/50 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
                </div>
                <span className="font-black text-white text-base">BPO AnalisAí.me</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                Recomendado
              </span>
            </div>
          </div>

          {/* Linhas da Tabela */}
          {COMPARATIVO_ITEMS.map((item, idx) => (
            <div
              key={item.criterio}
              className={`grid grid-cols-[1.2fr_1.4fr_1.8fr] border-b border-slate-800/60 transition-colors last:border-b-0 ${
                idx % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/30'
              } hover:bg-slate-800/20`}
            >
              {/* Critério */}
              <div className="px-6 py-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                  {item.icone}
                </div>
                <span className="text-sm font-bold text-slate-200 leading-snug">
                  {item.criterio}
                </span>
              </div>

              {/* Analista Financeiro CLT */}
              <div className="px-6 py-5 border-l border-slate-800/80 bg-red-950/10 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-3 h-3 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-300 mb-1 leading-snug">
                    {item.clt.titulo}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.clt.detalhe}
                  </p>
                </div>
              </div>

              {/* BPO AnalisAí.me */}
              <div className="px-6 py-5 border-l border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[3]" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-extrabold text-white leading-snug">
                      {item.bpo.titulo}
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md whitespace-nowrap">
                      {item.bpo.destaque}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.bpo.detalhe}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── MOBILE: CARDS EMPILHADOS ── */}
        <div className="md:hidden space-y-4">
          {COMPARATIVO_ITEMS.map((item) => (
            <div
              key={item.criterio}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl"
            >
              {/* Header do Card */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-800/60 border-b border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-slate-700/80 flex items-center justify-center shrink-0">
                  {item.icone}
                </div>
                <h3 className="text-sm font-extrabold text-white">{item.criterio}</h3>
              </div>

              {/* Conteúdo Comparativo */}
              <div className="p-4 space-y-3">
                {/* CLT */}
                <div className="rounded-xl border border-red-950/40 bg-red-950/15 p-3">
                  <div className="flex items-center gap-2 mb-1 text-red-400 text-xs font-bold uppercase tracking-wider">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Analista Financeiro CLT (R$ 4.000+/mês)</span>
                  </div>
                  <p className="text-xs font-bold text-red-200 mb-0.5">{item.clt.titulo}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.clt.detalhe}</p>
                </div>

                {/* BPO AnalisAí.me */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-black uppercase tracking-wider">
                      <Check className="w-4 h-4 stroke-[3] shrink-0" />
                      <span>BPO AnalisAí.me</span>
                    </div>
                    <span className="text-[9px] font-black uppercase bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {item.bpo.destaque}
                    </span>
                  </div>
                  <p className="text-xs font-black text-white mb-0.5">{item.bpo.titulo}</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{item.bpo.detalhe}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── CARD RESUMO DE SEGURANÇA & CTA ── */}
        <div className="mt-10 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-emerald-950/40 p-6 sm:p-8 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-black text-white">
                Segurança Total e Economia Comprovada
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-0.5">
                No BPO AnalisAí.me você reduz custos pela metade frente a um CLT, mantém segurança total sem acesso à sua conta bancária e recebe fechamento até o 5º dia útil.
              </p>
            </div>
          </div>

          <a
            href={diagnosticoUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="comparativo-cta-whatsapp"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3.5 text-xs sm:text-sm font-black text-slate-950 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5 hover:bg-emerald-300 shrink-0 w-full md:w-auto"
          >
            <MessageCircle className="h-4 w-4 fill-slate-950 stroke-none" />
            <span>Solicitar Diagnóstico Financeiro</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
