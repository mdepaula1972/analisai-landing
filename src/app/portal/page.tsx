'use client';

import React, { useState, useEffect } from 'react';
import { usePortal } from './layout';
import { getContasKpis } from '@/services/contas.service';
import { CreditBanner } from '@/components/portal/CreditBanner';
import { calcCreditStatus } from '@/types/credits';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Receipt, DollarSign, FileText, Zap, ArrowRight, Loader2,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import { PLANO_LABELS } from '@/types/tenant';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PortalOverviewPage() {
  const { tenant, loading: ctxLoading } = usePortal();
  const [kpis, setKpis] = useState<any>(null);
  const [creditStatus, setCreditStatus] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;

    async function load() {
      try {
        const [kpiData, credData] = await Promise.all([
          getContasKpis(tenant!.id),
          supabase.from('tenant_creditos').select('*').eq('tenant_id', tenant!.id).single(),
        ]);

        setKpis(kpiData);
        if (credData.data) setCreditStatus(calcCreditStatus(credData.data));
      } finally {
        setLoadingData(false);
      }
    }

    load();
  }, [tenant?.id]);

  if (ctxLoading || loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  const saudacao = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Banner de créditos */}
      {creditStatus && <CreditBanner status={creditStatus} />}

      {/* Boas-vindas */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full mb-3">
            {saudacao()}, equipe {tenant?.nome_fantasia || tenant?.razao_social?.split(' ')[0]}!
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            Seu portal financeiro BPO
          </h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Aqui você acompanha em tempo real tudo que a Solucione está gerenciando para você.
            Dados sempre atualizados, sem precisar fazer nada.
          </p>
          {tenant && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-slate-500">Plano ativo:</span>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                {PLANO_LABELS[tenant.plano]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs de Contas */}
      {kpis && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            Resumo Financeiro do Mês
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="A Pagar (em aberto)"
              value={formatBRL(kpis.pagar.totalAberto)}
              sub={`${kpis.pagar.quantidadeAberto} conta${kpis.pagar.quantidadeAberto !== 1 ? 's' : ''}`}
              icon={<Receipt className="w-5 h-5" />}
              cor="amber"
            />
            <KpiCard
              label="A Receber (em aberto)"
              value={formatBRL(kpis.receber.totalAberto)}
              sub={`${kpis.receber.quantidadeAberto} conta${kpis.receber.quantidadeAberto !== 1 ? 's' : ''}`}
              icon={<DollarSign className="w-5 h-5" />}
              cor="emerald"
            />
            <KpiCard
              label="Atrasadas a Pagar"
              value={formatBRL(kpis.pagar.totalAtrasado)}
              sub={`${kpis.pagar.quantidadeAtrasado} vencida${kpis.pagar.quantidadeAtrasado !== 1 ? 's' : ''}`}
              icon={<AlertTriangle className="w-5 h-5" />}
              cor={kpis.pagar.quantidadeAtrasado > 0 ? 'rose' : 'slate'}
            />
            <KpiCard
              label="Recebido este mês"
              value={formatBRL(kpis.receber.totalPagoMes)}
              sub="mês atual"
              icon={<CheckCircle2 className="w-5 h-5" />}
              cor="emerald"
            />
          </div>
        </div>
      )}

      {/* Atalhos */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
          Acesso Rápido
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLink
            href="/portal/contas"
            icon={<Receipt className="w-5 h-5 text-amber-400" />}
            title="Contas a Pagar"
            desc="Veja vencimentos e status de pagamentos"
          />
          <QuickLink
            href="/portal/receber"
            icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
            title="Contas a Receber"
            desc="Acompanhe recebimentos e inadimplências"
          />
          {tenant && ['gestao', 'estrategico'].includes(tenant.plano) && (
            <QuickLink
              href="/portal/dre"
              icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
              title="DRE Gerencial"
              desc="Resultado financeiro mensal consolidado"
            />
          )}
          {tenant?.plano === 'estrategico' && (
            <QuickLink
              href="/portal/simulador"
              icon={<Zap className="w-5 h-5 text-emerald-400" />}
              title="Simulador"
              desc="Projete cenários e tome decisões com dados"
            />
          )}
          <QuickLink
            href="/portal/creditos"
            icon={<Calendar className="w-5 h-5 text-slate-400" />}
            title="Meus Créditos"
            desc="Veja o uso do mês e compre créditos extras"
          />
        </div>
      </div>

    </div>
  );
}

function KpiCard({ label, value, sub, icon, cor }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; cor: 'amber' | 'emerald' | 'rose' | 'slate';
}) {
  const corMap = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    slate: 'text-slate-400 bg-slate-800 border-slate-700',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${corMap[cor]}`}>
        {icon}
      </div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-extrabold text-white">{value}</p>
      <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

function QuickLink({ href, icon, title, desc }: {
  href: string; icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <Link
      href={href}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start gap-4 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all mt-0.5" />
    </Link>
  );
}
