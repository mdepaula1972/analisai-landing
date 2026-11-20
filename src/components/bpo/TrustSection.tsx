'use client';

import React from 'react';
import {
  Shield, Lock, Users, Building2, Stethoscope,
  Briefcase, FileText, Zap, Award, Camera,
  BarChart3, Layers, UserCheck,
} from 'lucide-react';

const METRICAS_OPERACIONAIS = [
  {
    valor: '+R$ 15 milhões/ano',
    detalhe: 'em movimentação financeira sob gestão (+R$ 1,2 milhão/mês).',
    icon: <BarChart3 className="w-5 h-5 text-emerald-400" />,
  },
  {
    valor: '+3.200 lançamentos/mês',
    detalhe: 'processados (contas a pagar e receber).',
    icon: <Layers className="w-5 h-5 text-amber-400" />,
  },
  {
    valor: '7 empresas',
    detalhe: 'atendidas simultaneamente com rigor de controladoria.',
    icon: <Building2 className="w-5 h-5 text-emerald-400" />,
  },
  {
    valor: '4 especialistas',
    tituloAuxiliar: 'Equipe dedicada de 4 especialistas',
    detalhe: 'analistas de faturamento, contas a pagar e contas a receber.',
    icon: <Users className="w-5 h-5 text-amber-400" />,
  },
];

const PILARES = [
  {
    icon: <Lock className="w-6 h-6 text-emerald-400" />,
    titulo: 'Segurança Total: Sem Acesso à Sua Conta Bancária',
    texto: 'Trabalhamos com extratos e documentos que você compartilha. Nunca realizamos pagamentos, transferências ou temos senha de acesso. Você aprova 100% das movimentações.',
  },
  {
    icon: <FileText className="w-6 h-6 text-amber-400" />,
    titulo: 'Contrato de confidencialidade',
    texto: 'Assinamos NDA antes de começar. Toda a manipulação de dados é regida por cláusulas de confidencialidade e limitação de acesso, em conformidade com a LGPD.',
  },
  {
    icon: <Users className="w-6 h-6 text-blue-400" />,
    titulo: 'Equipe dedicada de 4 especialistas',
    texto: 'Time especializado em BPO financeiro para PMEs cobrindo faturamento, contas a pagar, contas a receber e conciliação diária — sem depender de um único funcionário.',
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
    tags: ['Repasse de planos', 'Faturamento recorrente', 'Relatório até o 5º dia útil'],
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
      {/* ── SEGURANÇA + AUTORIDADE OPERACIONAL ── */}
      <section id="seguranca" className="relative py-20 sm:py-24 overflow-hidden bg-slate-900/40 border-y border-slate-800/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_50%,rgba(16,185,129,0.05),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-emerald-300 mb-5">
              <Shield className="h-3.5 w-3.5" /> Autoridade & Segurança Comprovada
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
              Seu financeiro em mãos experientes.{' '}
              <span className="text-emerald-400">Com contrato.</span>
            </h2>
          </div>

          {/* Bloco de Liderança com espaço reservado para foto profissional */}
          <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 mb-8 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
              {/* Espaço reservado para foto profissional — substituir por <Image src="/marcos-paula.jpg" alt="Marcos Antonio de Paula" width={160} height={160} className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover border border-amber-500/40 shrink-0" /> */}
              <div
                aria-label="Espaço reservado para foto profissional de Marcos Antonio de Paula"
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-2 border-dashed border-amber-500/40 bg-slate-950/90 flex flex-col items-center justify-center text-center p-3 shrink-0"
              >
                <Camera className="w-7 h-7 text-amber-400 mb-2" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                  Foto Profissional
                </span>
                <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                  Marcos A. de Paula
                </span>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-3">
                  <Award className="w-3.5 h-3.5" /> Liderança & Controladoria Sênior
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
                  Marcos Antonio de Paula
                </h3>
                <p className="text-sm sm:text-base font-bold text-emerald-300 mb-3 flex items-center justify-center sm:justify-start gap-2">
                  <UserCheck className="w-4 h-4 shrink-0 text-emerald-400 hidden sm:inline" />
                  +30 anos de experiência em gestão financeira e administrativa corporativa.
                </p>
                <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
                  À frente da operação de BPO Financeiro, une rigor de controladoria corporativa com agilidade diária pelo WhatsApp e painel executivo em tempo real — garantindo previsibilidade de caixa e fechamento contábil estruturado até o 5º dia útil.
                </p>
              </div>
            </div>
          </div>

          {/* Estrutura Operacional Comprovada (4 cards numéricos) */}
          <div className="mb-10">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400 mb-4 text-center sm:text-left">
              Estrutura Operacional Comprovada
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {METRICAS_OPERACIONAIS.map((metrica) => (
                <div
                  key={metrica.valor}
                  className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 hover:border-emerald-500/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                    {metrica.icon}
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-amber-300 leading-tight mb-1">
                    {metrica.valor}
                  </p>
                  {metrica.tituloAuxiliar && (
                    <p className="text-xs font-extrabold text-white mb-1">
                      {metrica.tituloAuxiliar}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 leading-relaxed">{metrica.detalhe}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3 Pilares de Segurança e Operação */}
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
