'use client';

import React from 'react';
import {
  Shield, Lock, Users, Building2, Stethoscope,
  Briefcase, CheckCircle2, FileText, Zap,
} from 'lucide-react';

const PILARES = [
  {
    icon: <Lock className="w-6 h-6 text-emerald-400" />,
    titulo: 'Zero acesso às suas contas',
    texto: 'Trabalhamos com extratos e dados que você nos compartilha. Nunca realizamos pagamentos, transferências ou temos senha de acesso. Você aprova 100% das movimentações.',
  },
  {
    icon: <FileText className="w-6 h-6 text-amber-400" />,
    titulo: 'Contrato de confidencialidade',
    texto: 'Assinamos NDA antes de começar. Toda a manipulação de dados é regida por cláusulas de confidencialidade e limitação de acesso, em conformidade com a LGPD.',
  },
  {
    icon: <Users className="w-6 h-6 text-blue-400" />,
    titulo: 'Time especializado em BPO',
    texto: 'Equipe com experiência exclusiva em finanças operacionais para PMEs. Não somos generalistas: nossa especialidade é BPO Financeiro e nada mais.',
  },
];

const SETORES = [
  {
    icon: <Building2 className="w-6 h-6 text-amber-400" />,
    titulo: 'Comércio & Distribuição',
    desc: 'Alto volume de boletos, conciliação de recebíveis, controle de fornecedores e fluxo de caixa contínuo.',
    tags: ['Conciliação diária', 'Gestão de fornecedores', 'DRE por filial'],
  },
  {
    icon: <Stethoscope className="w-6 h-6 text-amber-400" />,
    titulo: 'Clínicas & Saúde',
    desc: 'Organização de repasses, controle de contas, conciliação de recebimentos e DRE gerencial simplificado.',
    tags: ['Repasse de planos', 'Faturamento recorrente', 'Relatório mensal'],
  },
  {
    icon: <Briefcase className="w-6 h-6 text-amber-400" />,
    titulo: 'Serviços & Tech',
    desc: 'Previsibilidade de faturamento recorrente, acompanhamento de inadimplência e relatórios executivos.',
    tags: ['MRR / ARR', 'Controle de SaaS', 'Dashboard executivo'],
  },
];

export default function TrustSection({ waUrl }: { waUrl: string }) {
  return (
    <>
      {/* ── SEGURANÇA ── */}
      <section id="seguranca" className="relative py-20 sm:py-24 overflow-hidden bg-slate-900/40 border-y border-slate-800/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_50%,rgba(16,185,129,0.05),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-emerald-300 mb-5">
              <Shield className="h-3.5 w-3.5" /> Segurança e Transparência
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
              Seu financeiro em mãos experientes.{' '}
              <span className="text-emerald-400">Com contrato.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PILARES.map((p) => (
              <div key={p.titulo} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-slate-700 transition-colors group">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {p.icon}
                </div>
                <h3 className="text-base font-extrabold text-white mb-2">{p.titulo}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SETORES ── */}
      <section id="setores" className="relative py-20 sm:py-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_20%_60%,rgba(245,158,11,0.05),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-amber-300 mb-5">
              <Zap className="h-3.5 w-3.5" /> Setores atendidos
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
              BPO especializado no{' '}
              <span className="text-shimmer-amber">seu segmento</span>
            </h2>
            <p className="text-slate-400">Adaptamos a operação financeira para a realidade de cada setor, sem modelos genéricos.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {SETORES.map((s) => (
              <div key={s.titulo} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-amber-500/30 transition-all group card-glow-amber">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                  {s.icon}
                </div>
                <h3 className="text-base font-extrabold text-white mb-2">{s.titulo}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{s.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.tags.map((tag) => (
                    <span key={tag} className="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* CTA de setores */}
          <div className="mt-12 text-center">
            <p className="text-slate-400 text-sm mb-4">Não encontrou seu setor? Atendemos empresas de todos os segmentos.</p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="setores-cta-whatsapp"
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-7 py-3.5 text-sm font-extrabold text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              Falar com especialista sobre meu setor
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
