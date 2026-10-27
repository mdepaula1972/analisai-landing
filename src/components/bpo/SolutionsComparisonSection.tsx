'use client';

import React from 'react';
import {
  X, Check, ShieldCheck, ArrowRight, MessageCircle,
  Lock, Users, FileSpreadsheet, Scale, ShieldAlert
} from 'lucide-react';
import { WHATSAPP } from '@/lib/contact';

const COMPARATIVO_ITEMS = [
  {
    criterio: 'Acesso a senhas e Open Finance',
    icone: <Lock className="w-4 h-4 text-amber-400" />,
    outras: {
      titulo: 'Exigem conexão bancária direta',
      detalhe: 'Exigem senhas, tokens ou Open Finance, expondo credenciais e movimentações em servidores externos.',
      negativo: true,
    },
    analisai: {
      titulo: 'Zero acesso: sua conta bancária fica blindada',
      detalhe: 'Não pedimos senhas nem Open Finance. Toda a auditoria é feita a partir dos comprovantes que você envia.',
      destaque: '100% Blindado',
    },
  },
  {
    criterio: 'Risco de transação indevida',
    icone: <ShieldAlert className="w-4 h-4 text-red-400" />,
    outras: {
      titulo: 'Movimentam Pix e pagamentos pelo app',
      detalhe: 'Aplicativos integrados criam brechas para transferências incorretas ou fraudes em caso de perda do aparelho.',
      negativo: true,
    },
    analisai: {
      titulo: 'Risco zero: você aprova e paga no seu banco',
      detalhe: 'O AnalisAí audita e avisa vencimentos, mas você mantém 100% da soberania e paga exclusivamente no app do seu banco.',
      destaque: 'Risco Zero',
    },
  },
  {
    criterio: 'Acesso para secretária / operador',
    icone: <Users className="w-4 h-4 text-blue-400" />,
    outras: {
      titulo: 'Perigoso (teria acesso a pagar contas)',
      detalhe: 'Delegar o WhatsApp do banco tradicional permite que ajudantes vejam saldos da empresa ou façam pagamentos.',
      negativo: true,
    },
    analisai: {
      titulo: 'Modo Equipe com sigilo total de saldos',
      detalhe: 'Sua secretária ou operador pode anexar notas e boletos no WhatsApp sem jamais ter acesso a extratos, saldos ou lucros.',
      destaque: 'Sigilo de Saldos',
    },
  },
  {
    criterio: 'Apoio com impostos e teto fiscal',
    icone: <Scale className="w-4 h-4 text-emerald-400" />,
    outras: {
      titulo: 'Tratamento genérico',
      detalhe: 'Não diferenciam caixa real de notas declaradas, ignorando risco fiscal e limites de enquadramento tributário.',
      negativo: true,
    },
    analisai: {
      titulo: 'Alerta DAS-MEI e monitoramento de teto',
      detalhe: 'Sensibilidade fiscal inteligente: lembretes automáticos do DAS e termômetro do teto de faturamento para evitar desenquadramento.',
      destaque: 'Proteção Fiscal',
    },
  },
  {
    criterio: 'Fechamento para Contabilidade',
    icone: <FileSpreadsheet className="w-4 h-4 text-purple-400" />,
    outras: {
      titulo: 'Apenas extrato comum',
      detalhe: 'Geram listas simples de transações que exigem horas do contador para decifrar a que cada pagamento se referia.',
      negativo: true,
    },
    analisai: {
      titulo: 'CSV estruturado + pacote ZIP de comprovantes',
      detalhe: 'Gera relatório fiscal completo em CSV e consolida todos os PDFs e fotos de notas fiscais renomeados em um único arquivo ZIP para o seu contador.',
      destaque: '1 Clique',
    },
  },
];

export default function SolutionsComparisonSection({ waUrl }: { waUrl?: string }) {
  const soloUrl = waUrl || WHATSAPP.soloTeste;

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
            <ShieldCheck className="h-3.5 w-3.5" /> Segurança & Controle Total
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.08] tracking-tight mb-5">
            AnalisAí vs.{' '}
            <span className="text-slate-400 line-through decoration-red-500/60 decoration-2 font-extrabold">Outras Soluções</span>
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Por que conectar suas contas bancárias a robôs é um risco desnecessário. Compare e entenda por que o AnalisAí é a escolha de empresários que prezam por <strong className="text-emerald-300">segurança e sigilo absoluto</strong>.
          </p>
        </div>

        {/* ── DESKTOP: TABELA COMPARATIVA ── */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-xl">
          {/* Header das Colunas */}
          <div className="grid grid-cols-[1.4fr_1.3fr_1.8fr] border-b border-slate-800 bg-slate-900/90 text-sm font-extrabold">
            <div className="px-6 py-4 text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-400" />
              Critério de Escolha
            </div>
            <div className="px-6 py-4 border-l border-slate-800/80 text-slate-400 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <X className="w-3.5 h-3.5 text-red-400" />
              </div>
              <span>Bancos / Fintechs no WhatsApp</span>
            </div>
            <div className="px-6 py-4 border-l border-emerald-500/40 bg-emerald-500/10 text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/25 border border-emerald-400/50 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
                </div>
                <span className="font-black text-white text-base">AnalisAí</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                100% Seguro
              </span>
            </div>
          </div>

          {/* Linhas da Tabela */}
          {COMPARATIVO_ITEMS.map((item, idx) => (
            <div
              key={item.criterio}
              className={`grid grid-cols-[1.4fr_1.3fr_1.8fr] border-b border-slate-800/60 transition-colors last:border-b-0 ${
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

              {/* Bancos / Fintechs */}
              <div className="px-6 py-5 border-l border-slate-800/80 bg-red-950/10 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-3 h-3 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-300 mb-1 leading-snug">
                    {item.outras.titulo}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.outras.detalhe}
                  </p>
                </div>
              </div>

              {/* AnalisAí */}
              <div className="px-6 py-5 border-l border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[3]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-extrabold text-white leading-snug">
                      {item.analisai.titulo}
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md whitespace-nowrap">
                      {item.analisai.destaque}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.analisai.detalhe}
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
                {/* Outras soluções */}
                <div className="rounded-xl border border-red-950/40 bg-red-950/15 p-3">
                  <div className="flex items-center gap-2 mb-1 text-red-400 text-xs font-bold uppercase tracking-wider">
                    <X className="w-3.5 h-3.5" />
                    <span>Bancos / Fintechs no WhatsApp</span>
                  </div>
                  <p className="text-xs font-bold text-red-200 mb-0.5">{item.outras.titulo}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.outras.detalhe}</p>
                </div>

                {/* AnalisAí */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-black uppercase tracking-wider">
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>AnalisAí</span>
                    </div>
                    <span className="text-[9px] font-black uppercase bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full">
                      {item.analisai.destaque}
                    </span>
                  </div>
                  <p className="text-xs font-black text-white mb-0.5">{item.analisai.titulo}</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{item.analisai.detalhe}</p>
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
                Princípio da Blindagem Máxima
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-0.5">
                No AnalisAí, seu dinheiro nunca sai da sua conta e nenhuma senha é compartilhada. Experimente sem compromisso.
              </p>
            </div>
          </div>

          <a
            href={soloUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="comparativo-cta-whatsapp"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3.5 text-xs sm:text-sm font-black text-slate-950 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5 hover:bg-emerald-300 shrink-0 w-full md:w-auto"
          >
            <MessageCircle className="h-4 w-4 fill-slate-950 stroke-none" />
            <span>Testar no WhatsApp Agora</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
