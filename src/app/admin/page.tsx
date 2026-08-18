'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, TrendingUp, Building2, Loader2, ArrowRight,
  AlertTriangle, CheckCircle2, Clock, CreditCard, RefreshCw
} from 'lucide-react';
import { PLANO_LABELS, PLANO_CORES, PlanoTenant } from '@/types/tenant';

interface TenantSummary {
  id: string;
  slug: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  plano: PlanoTenant;
  ativo: boolean;
  created_at: string;
  creditos?: {
    uso_mes_atual: number;
    limite_mensal: number;
    creditos_extra: number;
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const verificarAcesso = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }

    const { data: tu } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!tu || tu.role !== 'admin_bpo') {
      router.replace('/portal');
      return;
    }

    setAuthorized(true);
    await carregarTenants();
  }, []);

  const carregarTenants = async () => {
    setLoading(true);
    try {
      const { data: ts } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (ts) {
        // Buscar créditos de cada tenant
        const { data: creds } = await supabase
          .from('tenant_creditos')
          .select('tenant_id, uso_mes_atual, limite_mensal, creditos_extra');

        const credMap = new Map(creds?.map(c => [c.tenant_id, c]) || []);

        setTenants(ts.map(t => ({
          ...t,
          creditos: credMap.get(t.id),
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { verificarAcesso(); }, []);

  if (!authorized || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  const ativos = tenants.filter(t => t.ativo).length;
  const comCredLimite = tenants.filter(t =>
    t.creditos && t.creditos.uso_mes_atual >= t.creditos.limite_mensal
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* Header Admin */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-violet-500/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-violet-400 font-bold uppercase tracking-wider">Painel Administrador</p>
            <h1 className="text-base font-extrabold text-white">Solucione BPO · Gestão de Clientes</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={carregarTenants}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/admin/novo-cliente"
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
          >
            + Novo Cliente
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* KPIs Admin */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Clientes Ativos', value: ativos, icon: <Users className="w-4 h-4" />, cor: 'violet' },
            { label: 'Total Clientes', value: tenants.length, icon: <Building2 className="w-4 h-4" />, cor: 'slate' },
            { label: 'Créditos Esgotados', value: comCredLimite, icon: <AlertTriangle className="w-4 h-4" />, cor: comCredLimite > 0 ? 'rose' : 'slate' },
            { label: 'Planos Estratégico', value: tenants.filter(t => t.plano === 'estrategico').length, icon: <TrendingUp className="w-4 h-4" />, cor: 'emerald' },
          ].map(({ label, value, icon, cor }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-3 ${
                cor === 'violet' ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' :
                cor === 'emerald' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                cor === 'rose' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                'text-slate-400 bg-slate-800 border-slate-700'
              }`}>
                {icon}
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-extrabold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Lista de Clientes */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/60">
            <h2 className="text-sm font-bold text-white">Clientes BPO</h2>
          </div>

          <div className="divide-y divide-slate-800/60">
            {tenants.map(tenant => {
              const percUso = tenant.creditos
                ? Math.round((tenant.creditos.uso_mes_atual / (tenant.creditos.limite_mensal + tenant.creditos.creditos_extra)) * 100)
                : 0;

              return (
                <div key={tenant.id} className="px-6 py-4 hover:bg-slate-800/30 transition-colors flex items-center gap-4 flex-wrap">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-white text-sm">{tenant.nome_fantasia || tenant.razao_social}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PLANO_CORES[tenant.plano]}`}>
                        {PLANO_LABELS[tenant.plano]}
                      </span>
                      {!tenant.ativo && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{tenant.cnpj || 'CNPJ não informado'}</p>
                  </div>

                  {/* Créditos */}
                  {tenant.creditos && (
                    <div className="min-w-[140px]">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Créditos do mês</span>
                        <span className={percUso >= 90 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                          {percUso}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${percUso >= 100 ? 'bg-rose-400' : percUso >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(percUso, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {tenant.creditos.uso_mes_atual}/{tenant.creditos.limite_mensal}
                        {tenant.creditos.creditos_extra > 0 && ` +${tenant.creditos.creditos_extra}`}
                      </p>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/${tenant.id}/upload`}
                      className="text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      Upload
                    </Link>
                    <Link
                      href={`/admin/${tenant.id}/lancamentos`}
                      className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 px-3 py-2 rounded-xl transition-all"
                    >
                      Lançamentos
                    </Link>
                    <Link
                      href={`/admin/${tenant.id}`}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}

            {tenants.length === 0 && (
              <div className="px-6 py-12 text-center text-slate-600">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum cliente cadastrado ainda.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
