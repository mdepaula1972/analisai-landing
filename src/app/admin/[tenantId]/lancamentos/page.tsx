'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import {
  FileText, CheckCircle2, X, ArrowLeft, Loader2,
  AlertTriangle, Clock, Upload, Send
} from 'lucide-react';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminLancamentosPage() {
  const { tenantId } = useParams();
  const supabase = createClient();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('uploads')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['revisao', 'processando', 'erro'])
      .order('created_at', { ascending: false });

    setLancamentos(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [tenantId]);

  const statusCor: Record<string, string> = {
    processando: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    revisao: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    concluido: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    erro: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="inline-flex items-center gap-2 text-slate-400 hover:text-violet-400 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Painel
          </Link>
          <span className="text-slate-700">/</span>
          <Link href={`/admin/${tenantId}/upload`} className="inline-flex items-center gap-2 text-slate-400 hover:text-violet-400 transition-colors text-sm">
            <Upload className="w-4 h-4" /> Novo Upload
          </Link>
        </div>

        <div className="bg-slate-900 border border-violet-500/20 rounded-3xl p-6">
          <h1 className="text-lg font-extrabold text-white mb-1">Revisão de Lançamentos</h1>
          <p className="text-xs text-slate-500">Uploads aguardando revisão e publicação</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          </div>
        ) : lancamentos.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400/30 mx-auto mb-3" />
            <p className="text-white font-semibold">Nenhum lançamento pendente</p>
            <p className="text-slate-500 text-sm mt-1">Todos os uploads foram revisados e publicados.</p>
            <Link
              href={`/admin/${tenantId}/upload`}
              className="inline-flex items-center gap-2 mt-4 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
            >
              <Upload className="w-4 h-4" /> Novo Upload
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {lancamentos.map(upload => (
              <div key={upload.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{upload.nome_original || 'Sem nome'}</p>
                      <p className="text-xs text-slate-500">{new Date(upload.created_at).toLocaleString('pt-BR')}</p>

                      {upload.ia_extracao && (
                        <div className="mt-2 bg-slate-800/50 rounded-xl p-3 text-xs space-y-1">
                          {upload.ia_extracao.descricao && (
                            <p className="text-slate-300">{upload.ia_extracao.descricao}</p>
                          )}
                          {upload.ia_extracao.valor && (
                            <p className="text-amber-400 font-bold">{formatBRL(upload.ia_extracao.valor)}</p>
                          )}
                          {upload.ia_extracao.tipo && (
                            <p className="text-slate-500">Tipo: <span className="text-slate-300">{upload.ia_extracao.tipo}</span></p>
                          )}
                        </div>
                      )}

                      {upload.erro_msg && (
                        <div className="mt-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                          {upload.erro_msg}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusCor[upload.status] || statusCor.processando}`}>
                      {upload.status}
                    </span>
                    {upload.status === 'revisao' && (
                      <Link
                        href={`/admin/${tenantId}/upload`}
                        className="text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 px-3 py-2 rounded-xl transition-all"
                      >
                        Revisar
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
