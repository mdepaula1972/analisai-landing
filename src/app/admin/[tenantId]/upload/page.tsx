'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, Image, FileText, Mic, CheckCircle2, AlertTriangle,
  Loader2, X, RefreshCw, ArrowLeft, Send, Edit3,
  DollarSign, Calendar, Building2, Tag, MessageSquare
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import type { IaExtracaoResult } from '@/types/dre';

// ── Helpers ───────────────────────────────────────────────────

const TIPO_ICONS: Record<string, React.ReactNode> = {
  imagem: <Image className="w-5 h-5" />,
  audio: <Mic className="w-5 h-5" />,
  pdf: <FileText className="w-5 h-5" />,
};

function formatBRL(v?: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Upload Zone ───────────────────────────────────────────────

function UploadZone({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const allowed = ['image/', 'audio/', 'application/pdf'];
    if (!allowed.some(t => file.type.startsWith(t))) {
      alert('Formato não suportado. Use imagem, áudio ou PDF.');
      return;
    }
    onFileSelected(file);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
        drag ? 'border-violet-400 bg-violet-500/10' : 'border-slate-700 hover:border-violet-500/50 hover:bg-slate-800/30'
      }`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,audio/*,.pdf"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
      />

      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
        <Upload className="w-8 h-8 text-violet-400" />
      </div>

      <h3 className="text-white font-bold text-lg mb-2">Arraste o arquivo aqui</h3>
      <p className="text-slate-400 text-sm mb-6">
        Suportado: <strong>Imagens</strong> (notas, boletos, recibos) · <strong>PDF</strong> · <strong>Áudio</strong> (mensagens de voz)
      </p>

      <div className="flex justify-center gap-3">
        {[
          { icon: <Image className="w-4 h-4" />, label: 'Imagem' },
          { icon: <FileText className="w-4 h-4" />, label: 'PDF' },
          { icon: <Mic className="w-4 h-4" />, label: 'Áudio' },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
            {icon} {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card de Revisão IA ────────────────────────────────────────

function IaRevisaoCard({
  iaData, onChange, onPublicar, onDescartar, publicando
}: {
  iaData: IaExtracaoResult;
  onChange: (key: keyof IaExtracaoResult, value: string | number) => void;
  onPublicar: () => void;
  onDescartar: () => void;
  publicando: boolean;
}) {
  const confianca = iaData.confianca || 0;
  const confiancaLabel = confianca >= 0.8 ? 'Alta' : confianca >= 0.5 ? 'Média' : 'Baixa';
  const confiancaCor = confianca >= 0.8 ? 'text-emerald-400' : confianca >= 0.5 ? 'text-amber-400' : 'text-rose-400';

  const Field = ({ icon, label, field, type = 'text' }: {
    icon: React.ReactNode; label: string; field: keyof IaExtracaoResult; type?: string;
  }) => (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        {icon} {label}
      </label>
      <input
        type={type}
        value={(iaData[field] as string | number) ?? ''}
        onChange={e => onChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none transition-colors"
      />
    </div>
  );

  return (
    <div className="bg-slate-900 border border-violet-500/30 rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="bg-violet-500/10 border-b border-violet-500/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-violet-400" />
          <div>
            <p className="text-white font-bold text-sm">Dados Extraídos pela IA</p>
            <p className="text-xs text-slate-500">Revise e corrija antes de publicar</p>
          </div>
        </div>
        <div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${confiancaCor}`}>
            Confiança: {confiancaLabel} ({Math.round(confianca * 100)}%)
          </span>
        </div>
      </div>

      {/* Campos */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field icon={<MessageSquare className="w-3 h-3" />} label="Descrição" field="descricao" />
        <Field icon={<DollarSign className="w-3 h-3" />} label="Valor (R$)" field="valor" type="number" />
        <Field icon={<Building2 className="w-3 h-3" />} label="Fornecedor / Cliente" field="fornecedor_ou_cliente" />
        <Field icon={<Calendar className="w-3 h-3" />} label="Data (YYYY-MM-DD)" field="data" />
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            <Tag className="w-3 h-3" /> Tipo
          </label>
          <select
            value={iaData.tipo || 'pagar'}
            onChange={e => onChange('tipo', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none transition-colors"
          >
            <option value="pagar">Conta a Pagar</option>
            <option value="receber">Conta a Receber</option>
            <option value="dre">Lançamento DRE</option>
          </select>
        </div>
        <Field icon={<Tag className="w-3 h-3" />} label="Conta DRE / Categoria" field="conta_dre" />
        <Field icon={<Calendar className="w-3 h-3" />} label="Período (Jan/26)" field="periodo" />
        <div className="sm:col-span-2">
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            <MessageSquare className="w-3 h-3" /> Observações
          </label>
          <textarea
            value={iaData.observacoes ?? ''}
            onChange={e => onChange('observacoes', e.target.value)}
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none transition-colors resize-none"
          />
        </div>
      </div>

      {/* Ações */}
      <div className="px-6 pb-6 flex gap-3">
        <button
          onClick={onPublicar}
          disabled={publicando}
          className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
        >
          {publicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Publicar no Portal do Cliente
        </button>
        <button
          onClick={onDescartar}
          className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-sm flex items-center gap-2"
        >
          <X className="w-4 h-4" /> Descartar
        </button>
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────

export default function AdminUploadPage() {
  const { tenantId } = useParams();
  const supabase = createClient();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [iaData, setIaData] = useState<IaExtracaoResult | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleUpload = async () => {
    if (!file || !tenantId) return;
    setUploading(true);
    setErro('');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('tenantId', tenantId as string);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok || data.error) {
        setErro(data.error || 'Erro no upload');
        return;
      }

      setUploadId(data.uploadId);
      setIaData(data.iaExtracao || {});
    } catch (e) {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handlePublicar = async () => {
    if (!iaData || !uploadId || !tenantId) return;
    setPublicando(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Publicar conforme tipo
      if (iaData.tipo === 'pagar') {
        await supabase.from('contas_pagar').insert({
          tenant_id: tenantId,
          descricao: iaData.descricao || 'Sem descrição',
          fornecedor: iaData.fornecedor_ou_cliente,
          valor: iaData.valor || 0,
          data_vencimento: iaData.data || new Date().toISOString().split('T')[0],
          categoria: iaData.categoria || iaData.conta_dre,
          observacoes: iaData.observacoes,
          upload_id: uploadId,
          created_by: user?.id,
        });
      } else if (iaData.tipo === 'receber') {
        await supabase.from('contas_receber').insert({
          tenant_id: tenantId,
          descricao: iaData.descricao || 'Sem descrição',
          cliente_nome: iaData.fornecedor_ou_cliente,
          valor: iaData.valor || 0,
          data_vencimento: iaData.data || new Date().toISOString().split('T')[0],
          categoria: iaData.categoria,
          observacoes: iaData.observacoes,
          upload_id: uploadId,
          created_by: user?.id,
        });
      } else {
        // DRE
        await supabase.from('dre_lancamentos').insert({
          tenant_id: tenantId,
          periodo: iaData.periodo || 'N/D',
          conta_dre: iaData.conta_dre || 'Outros',
          valor: iaData.valor || 0,
          tipo: 'despesa',
          descricao: iaData.descricao,
          status: 'publicado',
          upload_id: uploadId,
          created_by: user?.id,
        });
      }

      // Marcar upload como concluído
      await supabase.from('uploads')
        .update({ status: 'concluido' })
        .eq('id', uploadId);

      setSucesso('Publicado com sucesso no portal do cliente!');
      setIaData(null);
      setFile(null);
      setUploadId(null);
    } catch (e) {
      setErro('Erro ao publicar. Tente novamente.');
    } finally {
      setPublicando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Voltar */}
        <Link href="/admin" className="inline-flex items-center gap-2 text-slate-400 hover:text-violet-400 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        {/* Header */}
        <div className="bg-slate-900 border border-violet-500/20 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Upload className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white">Upload + Extração IA</h1>
              <p className="text-xs text-slate-500">Envie imagem, PDF ou áudio — a IA extrai os dados automaticamente</p>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {sucesso && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-emerald-300 text-sm font-semibold">{sucesso}</p>
            <button onClick={() => setSucesso('')} className="ml-auto text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {erro && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl px-5 py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <p className="text-rose-300 text-sm">{erro}</p>
          </div>
        )}

        {/* Upload Zone */}
        {!iaData && (
          <>
            <UploadZone onFileSelected={setFile} />
            {file && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-violet-400">
                  {TIPO_ICONS[file.type.startsWith('audio') ? 'audio' : file.type === 'application/pdf' ? 'pdf' : 'imagem']}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setFile(null)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-sm transition-all"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Processando...' : 'Processar com IA'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Revisão IA */}
        {iaData && (
          <IaRevisaoCard
            iaData={iaData}
            onChange={(key, value) => setIaData(prev => prev ? { ...prev, [key]: value } : null)}
            onPublicar={handlePublicar}
            onDescartar={() => { setIaData(null); setFile(null); setUploadId(null); }}
            publicando={publicando}
          />
        )}
      </div>
    </div>
  );
}
