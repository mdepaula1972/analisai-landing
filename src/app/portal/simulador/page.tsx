'use client';

import React from 'react';
import { usePortal } from '../layout';
import { PlanGate } from '@/components/portal/PlanGate';
import { Zap, TrendingUp, Info } from 'lucide-react';

export default function SimuladorPage() {
  const { tenant } = usePortal();
  if (!tenant) return null;

  return (
    <PlanGate planoNecessario="estrategico" planoAtual={tenant.plano} featureLabel="Simulador de Cenários">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-extrabold text-white">Simulador de Cenários</h1>
          <p className="text-slate-400 text-sm">{tenant.nome_fantasia || tenant.razao_social} · Plano Estratégico</p>
        </div>

        <div className="bg-slate-900 border border-emerald-500/20 rounded-3xl p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-extrabold text-white">Simulador em configuração</h2>
          <p className="text-slate-400 text-sm max-w-md">
            O Simulador de Cenários usa os dados do seu DRE para projetar o impacto de decisões estratégicas.
            Disponível assim que seus dados financeiros estiverem carregados pela equipe Solucione.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
            <Info className="w-3.5 h-3.5" />
            A equipe Solucione está preparando seus dados. Em breve disponível.
          </div>
        </div>
      </div>
    </PlanGate>
  );
}
