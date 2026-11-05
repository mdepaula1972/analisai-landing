'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import type { DailyBpoAudit } from '@/types/bpo';

export default function BpoAuditoriaHistoryPage() {
  const [audits, setAudits] = useState<DailyBpoAudit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      const savedToken = localStorage.getItem('analisai_admin_token');
      const effectiveToken = urlToken || savedToken || '';
      if (effectiveToken) {
        setToken(effectiveToken);
        localStorage.setItem('analisai_admin_token', effectiveToken);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const fetchHistory = async (currentToken: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/bpo/history?token=${encodeURIComponent(currentToken)}`);
      if (!res.ok) {
        if (res.status === 401) throw new Error('Token administrativo inválido.');
        throw new Error('Falha ao consultar histórico de auditorias.');
      }
      const data = await res.json();
      setAudits(data.audits || []);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchHistory(token);
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/bpo?token=${encodeURIComponent(token)}`}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-2 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Torre de Controle</span>
          </Link>
          <div className="h-6 w-px bg-slate-800 mx-1" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Histórico Cronológico de Auditorias BPO
            </h1>
            <p className="text-xs text-slate-400">Registro oficial de conformidade e fechamento de turnos</p>
          </div>
        </div>

        <button
          onClick={() => fetchHistory(token)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-300">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs">Carregando histórico de auditorias...</p>
          </div>
        )}

        {!loading && audits.length === 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">Nenhum registro de auditoria arquivado ainda.</p>
            <p className="text-xs text-slate-500 mt-1">
              Conclua uma auditoria diária na Torre de Controle para gerar o primeiro carimbo de turno.
            </p>
          </div>
        )}

        {!loading && audits.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Data Auditoria</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Lembretes D-0 (Hoje)</th>
                    <th className="px-5 py-3.5">Lembretes D-1 (Amanhã)</th>
                    <th className="px-5 py-3.5">Docs Homologados</th>
                    <th className="px-5 py-3.5">Inconsistências</th>
                    <th className="px-5 py-3.5">Concluído em</th>
                    <th className="px-5 py-3.5">Operador / Gestor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {audits.map((item) => {
                    const isCompleted = item.status === 'completed';
                    const [y, m, d] = (item.audit_date || '').split('-');
                    const dateFormatted = d && m && y ? `${d}/${m}/${y}` : item.audit_date;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-semibold text-white whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Concluída
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5" />
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-medium text-slate-200">
                            {item.d0_reminders_sent} / {item.d0_reminders_expected}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-medium text-slate-200">
                            {item.d1_reminders_sent} / {item.d1_reminders_expected}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-semibold text-emerald-400">
                            {item.documents_approved}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {item.inconsistencies_flagged > 0 ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {item.inconsistencies_flagged}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-400">
                          {item.completed_at
                            ? new Date(item.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-300">
                          {item.audited_by || 'Sistema'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
