'use client';

import React, { useState, useEffect } from 'react';
import { usePortal } from '../layout';
import { supabase } from '@/lib/supabase';
import { calcCreditStatus } from '@/types/credits';
import { PACOTES_CREDITOS } from '@/types/credits';
import type { TenantCreditos, CreditStatus } from '@/types/credits';
import { CreditCard, Zap, Clock, TrendingUp, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

function formatBRL(v: number) {
  return (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMes(mes: string) {
  const [ano, m] = mes.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(m) - 1]}/${ano}`;
}

export default function CreditosPage() {
  const { tenant } = usePortal();
  const [creditos, setCreditos] = useState<TenantCreditos | null>(null);
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comprando, setComprando] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    async function load() {
      const [{ data: cred }, { data: hist }] = await Promise.all([
        supabase.from('tenant_creditos').select('*').eq('tenant_id', tenant!.id).single(),
        supabase.from('credito_transacoes').select('*').eq('tenant_id', tenant!.id)
          .order('created_at', { ascending: false }).limit(20),
      ]);

      if (cred) {
        setCreditos(cred as TenantCreditos);
        setStatus(calcCreditStatus(cred as TenantCreditos));
      }
      setHistorico(hist || []);
      setLoading(false);
    }
    load();
  }, [tenant?.id]);

  const handleComprar = async (pacoteId: string) => {
    const pacote = PACOTES_CREDITOS.find(p => p.id === pacoteId);
    if (!pacote || !tenant?.id) return;
    setComprando(pacoteId);

    // Aqui integraria Stripe Checkout
    // Por ora: exibe mensagem de redirecionamento
    alert(`Em breve: checkout Stripe para ${pacote.label} (${pacote.quantidade} créditos por ${pacote.precoLabel})\n\nEntre em contato: comercial@solucione.com.br`);
    setComprando(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-white">Créditos e Uso</h1>
        <p className="text-slate-400 text-sm">Acompanhe seu consumo e adquira créditos extras quando precisar</p>
      </div>

      {/* Status atual */}
      {status && creditos && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <p className="text-sm font-bold text-white">Uso no mês de {formatMes(creditos.mes_referencia)}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {status.usoAtual} lançamentos usados · {status.disponivelTotal - status.usoAtual} restantes
              </p>
            </div>
            <div className={`text-sm font-extrabold px-4 py-2 rounded-xl border ${
              status.estado === 'normal' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
              status.estado === 'aviso' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
              'text-rose-400 bg-rose-500/10 border-rose-500/20'
            }`}>
              {status.percentualUso}% utilizado
            </div>
          </div>

          {/* Barra de progresso grande */}
          <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden mb-4 relative">
            {/* Plano base */}
            <div
              className="h-4 rounded-full transition-all absolute left-0"
              style={{
                width: `${Math.min((status.usoAtual / status.disponivelTotal) * 100, 100)}%`,
                background: status.estado === 'normal' ? 'linear-gradient(90deg, #10b981, #34d399)' :
                             status.estado === 'aviso' ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
                             'linear-gradient(90deg, #f43f5e, #fb7185)',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-extrabold text-white">{status.usoAtual}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Lançamentos usados</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-white">{status.limiteMensal}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Incluídos no plano</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-amber-400">{status.creditosExtra}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Créditos extras</p>
            </div>
          </div>
        </div>
      )}

      {/* Pacotes de créditos */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Comprar Créditos Extras</h2>
        <p className="text-xs text-slate-600 mb-4">
          Quando seus créditos mensais acabam, você nunca é bloqueado. Compre créditos extras e continue sem interrupção.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {PACOTES_CREDITOS.map(pacote => (
            <div
              key={pacote.id}
              className={`bg-slate-900 border rounded-2xl p-5 relative transition-all ${
                pacote.destaque
                  ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {pacote.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full">
                  Mais popular
                </div>
              )}
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{pacote.label}</p>
              <p className="text-2xl font-extrabold text-white mb-0.5">{pacote.quantidade} créditos</p>
              <p className="text-sm font-bold text-amber-400 mb-4">{pacote.precoLabel}</p>
              <p className="text-[10px] text-slate-600 mb-4">
                R$ {((pacote.preco / pacote.quantidade) / 100).toFixed(2).replace('.', ',')} por crédito
              </p>
              <button
                onClick={() => handleComprar(pacote.id)}
                disabled={comprando === pacote.id}
                className={`w-full font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 ${
                  pacote.destaque
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                {comprando === pacote.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Comprar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/60">
            <h3 className="text-sm font-bold text-white">Histórico de Transações</h3>
          </div>
          <div className="divide-y divide-slate-800/60">
            {historico.map(t => (
              <div key={t.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  t.tipo === 'compra' ? 'bg-emerald-500/10 text-emerald-400' :
                  t.tipo === 'uso' ? 'bg-slate-800 text-slate-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>
                  {t.tipo === 'compra' ? <CreditCard className="w-4 h-4" /> :
                   t.tipo === 'uso' ? <Zap className="w-4 h-4" /> :
                   <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{t.descricao || t.tipo}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-sm font-bold ${t.tipo === 'uso' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {t.tipo === 'uso' ? '-' : '+'}{t.quantidade}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
