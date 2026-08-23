'use client';

import React from 'react';
import { PlanoTenant } from '@/types/tenant';
import { Lock, ArrowRight, Zap, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { WHATSAPP_NUMBER } from '@/lib/contact';

interface PlanGateProps {
  planoNecessario: PlanoTenant;
  planoAtual: PlanoTenant;
  children: React.ReactNode;
  featureLabel?: string;
}

const PLANO_ORDEM: Record<PlanoTenant, number> = {
  essencial: 1,
  gestao: 2,
  estrategico: 3,
};

const PLANO_UPGRADE_INFO: Record<PlanoTenant, { titulo: string; desc: string; cor: string }> = {
  gestao: {
    titulo: 'Plano Gestão',
    desc: 'Inclui DRE Gerencial com gráficos, KPIs financeiros e exportação em PDF.',
    cor: 'amber',
  },
  estrategico: {
    titulo: 'Plano Estratégico',
    desc: 'Inclui Simulador de Cenários com motor preditivo e análise por IA.',
    cor: 'emerald',
  },
  essencial: {
    titulo: 'Plano Essencial',
    desc: '',
    cor: 'slate',
  },
};

export function PlanGate({ planoNecessario, planoAtual, children, featureLabel }: PlanGateProps) {
  const temAcesso = PLANO_ORDEM[planoAtual] >= PLANO_ORDEM[planoNecessario];

  if (temAcesso) return <>{children}</>;

  const info = PLANO_UPGRADE_INFO[planoNecessario];
  const Icon = planoNecessario === 'gestao' ? TrendingUp : Zap;
  const borderCor = info.cor === 'amber' ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5';
  const iconCor = info.cor === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  const btnCor = info.cor === 'amber' ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950';

  return (
    <div className={`rounded-3xl border ${borderCor} p-10 flex flex-col items-center text-center gap-6 relative overflow-hidden`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(245,158,11,0.06),transparent)] pointer-events-none" />

      <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${iconCor}`}>
        <Lock className="w-8 h-8" />
      </div>

      <div>
        <div className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border mb-3 ${iconCor} border-current`}>
          <Icon className="w-3.5 h-3.5" />
          {info.titulo}
        </div>
        <h3 className="text-xl font-extrabold text-white mb-2">
          {featureLabel || 'Esta funcionalidade'} está disponível no {info.titulo}
        </h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
          {info.desc}
        </p>
      </div>

      <Link
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá! Gostaria de fazer upgrade para o ${info.titulo}.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 ${btnCor} font-bold px-7 py-3.5 rounded-xl transition-all shadow-lg text-sm group hover:scale-[1.02]`}
      >
        Fazer Upgrade para {info.titulo}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Link>

      <p className="text-xs text-slate-600">Fale com nosso consultor via WhatsApp · Sem burocracia</p>
    </div>
  );
}
