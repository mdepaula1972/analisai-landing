'use client';

import React from 'react';
import Link from 'next/link';
import { CreditStatus } from '@/types/credits';
import { AlertTriangle, X, CreditCard, Zap } from 'lucide-react';

interface CreditBannerProps {
  status: CreditStatus;
  onDismiss?: () => void;
}

export function CreditBanner({ status, onDismiss }: CreditBannerProps) {
  if (status.estado === 'normal') return null;

  const configs = {
    aviso: {
      bg: 'bg-amber-500/10 border-amber-500/30',
      icon: 'text-amber-400',
      text: 'text-amber-300',
      sub: 'text-amber-400/70',
      IconEl: AlertTriangle,
      titulo: `Você usou ${status.percentualUso}% dos seus créditos mensais`,
      desc: `Restam ${status.disponivelTotal - status.usoAtual} lançamentos neste mês.`,
    },
    soft_limit: {
      bg: 'bg-rose-500/10 border-rose-500/30',
      icon: 'text-rose-400',
      text: 'text-rose-300',
      sub: 'text-rose-400/70',
      IconEl: AlertTriangle,
      titulo: 'Limite do plano atingido — mas você não foi bloqueado!',
      desc: 'Os próximos lançamentos usarão seus créditos extras.',
    },
    esgotado: {
      bg: 'bg-rose-500/10 border-rose-500/30',
      icon: 'text-rose-400',
      text: 'text-rose-300',
      sub: 'text-rose-400/70',
      IconEl: Zap,
      titulo: 'Créditos esgotados — adquira mais para continuar',
      desc: 'Os lançamentos continuam sendo registrados. Regularize para manter o serviço.',
    },
  };

  const c = configs[status.estado] || configs.aviso;
  const Icon = c.IconEl;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-2xl border ${c.bg} mb-6`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${c.icon}`} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${c.text}`}>{c.titulo}</p>
        <p className={`text-xs mt-0.5 ${c.sub}`}>{c.desc}</p>

        {/* Barra de progresso */}
        <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all ${
              status.estado === 'normal' ? 'bg-amber-400' :
              status.estado === 'aviso' ? 'bg-amber-400' : 'bg-rose-400'
            }`}
            style={{ width: `${Math.min(status.percentualUso, 100)}%` }}
          />
        </div>
        <p className={`text-[10px] mt-1 ${c.sub}`}>
          {status.usoAtual}/{status.limiteMensal} incluídos no plano
          {status.creditosExtra > 0 && ` + ${status.creditosExtra} créditos extras`}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {(status.estado === 'soft_limit' || status.estado === 'esgotado') && (
          <Link
            href="/portal/creditos"
            className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Comprar créditos
          </Link>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="text-slate-600 hover:text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
