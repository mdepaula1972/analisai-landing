'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  FileCheck,
  FileText,
  Building2,
  Users,
  Search,
  Filter,
  DollarSign,
  Calendar,
  RefreshCw,
  Edit3,
  XCircle,
  Copy,
  Check,
  MessageCircle,
  TrendingDown,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import type {
  DailyBpoAudit,
  AuditDailyOpsSummary,
  BpoClientOverview,
  ServiceTier,
} from '@/types/bpo';

export default function BpoControlTowerPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [data, setData] = useState<AuditDailyOpsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [inputToken, setInputToken] = useState<string>('');

  // Filtros e estados
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'queue' | 'd0_d1' | 'inconsistencies' | 'clients' | 'cfo'>('queue');
  const [dispatchingReminders, setDispatchingReminders] = useState<boolean>(false);
  const [completingAudit, setCompletingAudit] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [cfoData, setCfoData] = useState<any | null>(null);
  const [loadingCfo, setLoadingCfo] = useState<boolean>(false);

  // Estados de modais
  const [editingItem, setEditingItem] = useState<{
    id: string;
    clientId: string;
    counterparty: string;
    amount: number;
    dueDate: string;
    barcodeOrPix?: string;
  } | null>(null);

  const [inconsistentModalItem, setInconsistentModalItem] = useState<{
    docId: string;
    clientId: string;
    clientName: string;
    phone: string;
    fileName: string;
    reason: string;
  } | null>(null);

  // Carrega token administrativo ou telefone master
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      const urlPhone = urlParams.get('phone');
      const savedToken = localStorage.getItem('analisai_admin_token');
      const effectiveToken = urlToken || urlPhone || savedToken || '';

      if (effectiveToken) {
        setToken(effectiveToken);
        localStorage.setItem('analisai_admin_token', effectiveToken);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const fetchData = async (currentToken: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/audit-daily-ops?token=${encodeURIComponent(currentToken)}`);
      if (!res.ok) {
        if (res.status === 401) throw new Error('Token administrativo inválido.');
        throw new Error('Falha ao conectar com a Torre de Controle.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData(token);
    }
  }, [token]);

  const targetCfoClientId = useMemo(() => {
    if (selectedClientId !== 'all') return selectedClientId;
    return data?.clientsList?.[0]?.clientId || null;
  }, [selectedClientId, data?.clientsList]);

  useEffect(() => {
    if (activeTab === 'cfo' && targetCfoClientId && token) {
      setLoadingCfo(true);
      fetch(
        `/api/admin/bpo/cfo-metrics?client_id=${encodeURIComponent(
          targetCfoClientId
        )}&token=${encodeURIComponent(token)}`
      )
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setCfoData(json);
        })
        .catch((err) => console.warn('Erro ao carregar métricas CFO:', err))
        .finally(() => setLoadingCfo(false));
    }
  }, [activeTab, targetCfoClientId, token]);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    const clean = inputToken.trim();
    setToken(clean);
    if (typeof window !== 'undefined') {
      localStorage.setItem('analisai_admin_token', clean);
    }
  };

  // Ação: Disparar Lembretes Restantes Agora
  const handleDispatchReminders = async () => {
    try {
      setDispatchingReminders(true);
      setActionMessage(null);
      const res = await fetch(`/api/admin/audit-daily-ops?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispatch_reminders' }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setActionMessage(`✅ ${resJson.result?.sent || 0} lembrete(s) disparado(s) com sucesso via WhatsApp!`);
        fetchData(token);
      } else {
        throw new Error(resJson.error || 'Falha ao disparar lembretes.');
      }
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    } finally {
      setDispatchingReminders(false);
    }
  };

  // Ação: Concluir Auditoria do Dia
  const handleCompleteAudit = async () => {
    try {
      setCompletingAudit(true);
      setActionMessage(null);
      const res = await fetch(`/api/admin/bpo/actions?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'completeDailyAudit',
          auditedBy: 'Marcos / Operador BPO',
          notes: 'Auditoria matinal conferida e homologada na Torre de Controle.',
        }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setActionMessage('🎉 Auditoria do dia assinada e concluída com êxito!');
        fetchData(token);
      } else {
        throw new Error(resJson.error || 'Falha ao concluir auditoria.');
      }
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    } finally {
      setCompletingAudit(false);
    }
  };

  // Ação: Aprovar Documento em 1 Clique
  const handleApproveDoc = async (docItem: any) => {
    try {
      const payload = {
        action: 'approveDocument',
        docId: docItem.id,
        approvalData: {
          clientId: docItem.clientId,
          counterparty: docItem.extractedData?.counterparty || docItem.fileName,
          description: docItem.fileName,
          amount: Number(docItem.extractedData?.valor || docItem.extractedData?.amount || 0),
          dueDate: docItem.extractedData?.vencimento || docItem.extractedData?.dueDate || new Date().toISOString().split('T')[0],
          type: 'payable',
          barcodeOrPix: docItem.extractedData?.linha_digitavel || docItem.extractedData?.chave_pix || null,
        },
      };

      const res = await fetch(`/api/admin/bpo/actions?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (resJson.success) {
        setActionMessage('✅ Documento aprovado e integrado ao contas a pagar!');
        fetchData(token);
      } else {
        throw new Error(resJson.error || 'Erro ao aprovar documento.');
      }
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    }
  };

  // Ação: Salvar Edição de Lançamento
  const handleSaveEditBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/admin/bpo/actions?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateBillData',
          billId: editingItem.id,
          amount: editingItem.amount,
          currentDueDate: editingItem.dueDate,
          counterpartyName: editingItem.counterparty,
          barcodeOrPix: editingItem.barcodeOrPix,
        }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setEditingItem(null);
        setActionMessage('✅ Lançamento financeiro ajustado com sucesso!');
        fetchData(token);
      } else {
        throw new Error(resJson.error || 'Erro ao ajustar lançamento.');
      }
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    }
  };

  // Ação: Confirmar Inconsistência e Notificar Cliente
  const handleConfirmInconsistent = async () => {
    if (!inconsistentModalItem) return;

    try {
      const res = await fetch(`/api/admin/bpo/actions?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markInconsistent',
          docId: inconsistentModalItem.docId,
          clientId: inconsistentModalItem.clientId,
          phone: inconsistentModalItem.phone,
          fileName: inconsistentModalItem.fileName,
          reason: inconsistentModalItem.reason,
        }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setInconsistentModalItem(null);
        setActionMessage('⚠️ Documento marcado como inconsistente e cliente notificado no WhatsApp!');
        fetchData(token);
      } else {
        throw new Error(resJson.error || 'Erro ao registrar inconsistência.');
      }
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    }
  };

  // Filtra dados com base no cliente selecionado
  const filteredData = useMemo(() => {
    if (!data) return null;
    if (selectedClientId === 'all') return data;

    return {
      ...data,
      d0PayablesList: data.d0PayablesList.filter((i) => i.clientId === selectedClientId),
      d1PayablesList: data.d1PayablesList.filter((i) => i.clientId === selectedClientId),
      pendingReviewDocuments: data.pendingReviewDocuments.filter((i) => i.clientId === selectedClientId),
      inconsistenciesList: data.inconsistenciesList.filter((i) => i.clientId === selectedClientId),
    };
  }, [data, selectedClientId]);

  // Data atual por extenso
  const dateFormattedFull = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  // 1. Guard de montagem no cliente (evita erros de hidratação ou renderização prematura no SSR)
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-xl shadow-emerald-500/20 animate-pulse">
            🎛️
          </div>
          <p className="text-sm font-semibold text-slate-200">Torre de Controle Operacional BPO</p>
          <p className="text-xs text-slate-500">Iniciando ambiente de auditoria segura...</p>
        </div>
      </div>
    );
  }

  // 2. Tela de Login com Token se não houver token configurado
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
              BPO
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Torre de Controle</h1>
              <p className="text-xs text-slate-400">Controladoria Terceirizada AnalisAí</p>
            </div>
          </div>
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Token ou Chave do Gestor
              </label>
              <input
                type="password"
                placeholder="Digite seu token ou credencial..."
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Acessar Torre de Controle
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Estado de Carregamento inicial com token ativo
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-200">Carregando auditoria operacional...</p>
        </div>
      </div>
    );
  }

  const audit = data?.audit;
  const isAuditCompleted = audit?.status === 'completed';
  const totalRemindersExpected = (audit?.d0_reminders_expected || 0) + (audit?.d1_reminders_expected || 0);
  const totalRemindersSent = (audit?.d0_reminders_sent || 0) + (audit?.d1_reminders_sent || 0);
  const hasPendingReminders = totalRemindersSent < totalRemindersExpected;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white pb-20">
      {/* ── TOP HEADER COM NAVEGAÇÃO ─────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20">
            🎛️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Torre de Controle Operacional
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                BPO Financeiro
              </span>
            </div>
            <p className="text-xs text-slate-400 capitalize">{dateFormattedFull}</p>
          </div>
        </div>

        {/* Links Rápidos e Botão de Auditoria */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link
            href={`/admin/bpo/auditoria?token=${encodeURIComponent(token)}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Histórico de Auditorias</span>
          </Link>

          <Link
            href={`/contador/dashboard?token=${encodeURIComponent(token)}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Portal do Contador</span>
          </Link>

          <Link
            href={`/portal?demo=true`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 transition-all cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Portal do Cliente (PWA)</span>
          </Link>

          <Link
            href={`/admin?token=${encodeURIComponent(token)}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Clientes Solo</span>
          </Link>

          <button
            onClick={() => fetchData(token)}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Atualizar painel"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Botão de Fechamento de Turno */}
          {isAuditCompleted ? (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Auditoria do Dia Concluída</span>
            </div>
          ) : (
            <button
              onClick={handleCompleteAudit}
              disabled={completingAudit || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{completingAudit ? 'Concluindo...' : 'Concluir Auditoria do Dia'}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Feedback de Ação */}
        {actionMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-sm text-emerald-300 flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-xs text-emerald-400 hover:underline">
              Fechar
            </button>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-300">
            ⚠️ {error}
          </div>
        )}

        {/* ── 1. SEMÁFORO MATINAL DE SEGURANÇA ────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Verde: Lembretes D-0 e D-1 */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Lembretes Vencimento (D-0 / D-1)
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {totalRemindersSent} / {totalRemindersExpected} Notificados
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-extrabold text-white">{totalRemindersSent}</span>
              <span className="text-xs text-slate-400">de {totalRemindersExpected} contas notificadas</span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Disparos automáticos matinais com código Pix e linha digitável em 1 toque no WhatsApp.
            </p>

            {hasPendingReminders ? (
              <button
                onClick={handleDispatchReminders}
                disabled={dispatchingReminders}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{dispatchingReminders ? 'Disparando...' : 'Disparar Lembretes Restantes Agora'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>100% dos títulos do dia foram notificados no WhatsApp</span>
              </div>
            )}
          </div>

          {/* Card Amarelo: Fila de Homologação de Documentos */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Fila de Homologação
              </span>
              <span className="text-xs font-bold text-amber-400">
                {audit?.documents_pending_review || 0} Pendentes
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-extrabold text-white">
                {audit?.documents_pending_review || 0}
              </span>
              <span className="text-xs text-slate-400">comprovantes/docs recebidos</span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Mídias recebidas no WhatsApp com pré-extração inteligente por IA para aprovação em 1 clique.
            </p>

            <button
              onClick={() => setActiveTab('queue')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Fila de Homologação</span>
            </button>
          </div>

          {/* Card Vermelho: Inconsistências / Alertas Críticos */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${audit?.inconsistencies_flagged ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`} />
                Inconsistências & Caixa
              </span>
              <span className={`text-xs font-bold ${audit?.inconsistencies_flagged ? 'text-rose-400' : 'text-slate-400'}`}>
                {audit?.inconsistencies_flagged || 0} Alertas
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-extrabold ${audit?.inconsistencies_flagged ? 'text-rose-400' : 'text-white'}`}>
                {audit?.inconsistencies_flagged || 0}
              </span>
              <span className="text-xs text-slate-400">saídas pendentes de anexo</span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Lançamentos bancários sem nota/comprovante arquivado no Livro Caixa do mês.
            </p>

            <button
              onClick={() => setActiveTab('inconsistencies')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Inspecionar Alertas de Caixa</span>
            </button>
          </div>
        </section>

        {/* ── 2. SELETOR MULTITENANT DE CLIENTES ───────────────────────── */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Carteira de Clientes BPO
              </span>
              <span className="text-xs text-slate-400">Selecione para isolar lançamentos e contas</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">🏢 Todos os Clientes (Visão Geral da Carteira)</option>
              {data?.clientsList?.map((client) => {
                const tierLabel =
                  client.serviceTier === 'bpo_cfo'
                    ? '⭐ BPO CFO'
                    : client.serviceTier === 'bpo_gestao'
                    ? '📊 BPO Gestão'
                    : '🌱 Self-Service';
                return (
                  <option key={client.clientId} value={client.clientId}>
                    {client.companyName} — {tierLabel}
                  </option>
                );
              })}
            </select>
          </div>
        </section>

        {/* ── 3. ABAS DE CONTROLE OPERACIONAL ─────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'queue'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Fila de Homologação ({filteredData?.pendingReviewDocuments?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('d0_d1')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'd0_d1'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>
              Contas D-0 / D-1 (
              {(filteredData?.d0PayablesList?.length || 0) + (filteredData?.d1PayablesList?.length || 0)})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inconsistencies')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'inconsistencies'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Inconsistências de Caixa ({filteredData?.inconsistenciesList?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'clients'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Carteira BPO ({data?.clientsList?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('cfo')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'cfo'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Raio-X CFO Strategy</span>
          </button>
        </div>

        {/* ── ABA 1: FILA RÁPIDA DE HOMOLOGAÇÃO EM 1 CLIQUE ───────────── */}
        {activeTab === 'queue' && (
          <section className="space-y-4">
            {(!filteredData?.pendingReviewDocuments || filteredData.pendingReviewDocuments.length === 0) ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">Fila 100% Homologada!</h3>
                <p className="text-xs text-slate-400">
                  Nenhum documento ou áudio pendente de validação manual no momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredData.pendingReviewDocuments.map((docItem) => {
                  const extData = docItem.extractedData || {};
                  const counterparty = extData.counterparty || extData.fornecedor || docItem.fileName;
                  const valor = Number(extData.valor || extData.amount || 0);
                  const vencimento = extData.vencimento || extData.dueDate || 'Hoje';
                  const categoria = extData.categoria || extData.category || 'Despesa Geral';

                  return (
                    <div
                      key={docItem.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Tag e Empresa */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                            {docItem.docType || 'WhatsApp'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium truncate max-w-[160px]">
                            {docItem.clientName}
                          </span>
                        </div>

                        {/* Dados Extraídos */}
                        <h4 className="text-sm font-bold text-white mb-1 line-clamp-1">{counterparty}</h4>
                        <div className="flex items-baseline gap-1 text-emerald-400 font-extrabold text-xl mb-3">
                          {valor > 0
                            ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'Valor a confirmar'}
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-300 border-t border-slate-800/80 pt-3 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Vencimento:</span>
                            <span className="font-semibold">{vencimento}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Categoria:</span>
                            <span className="font-semibold text-slate-300">{categoria}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Arquivo:</span>
                            <span className="text-slate-400 truncate max-w-[160px]">{docItem.fileName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação em 1 Clique */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => handleApproveDoc(docItem)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aprovar & Agendar</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              setEditingItem({
                                id: docItem.id,
                                clientId: docItem.clientId,
                                counterparty,
                                amount: valor,
                                dueDate: vencimento === 'Hoje' ? new Date().toISOString().split('T')[0] : vencimento,
                                barcodeOrPix: extData.linha_digitavel || extData.chave_pix,
                              })
                            }
                            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Editar</span>
                          </button>

                          <button
                            onClick={() =>
                              setInconsistentModalItem({
                                docId: docItem.id,
                                clientId: docItem.clientId,
                                clientName: docItem.clientName,
                                phone: '',
                                fileName: docItem.fileName,
                                reason: 'Imagem com código cortado ou valor ilegível.',
                              })
                            }
                            className="py-1.5 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium rounded-lg border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Inconsistente</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── ABA 2: CONTAS D-0 E D-1 ─────────────────────────────────── */}
        {activeTab === 'd0_d1' && (
          <section className="space-y-6">
            {/* Seção D-0 (Hoje) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    🔴 Vencendo Hoje (D-0) — {filteredData?.d0PayablesList?.length || 0} contas
                  </h3>
                </div>
              </div>

              {(!filteredData?.d0PayablesList || filteredData.d0PayablesList.length === 0) ? (
                <p className="text-xs text-slate-500 py-3">Nenhuma conta com vencimento programado para hoje.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredData.d0PayablesList.map((bill) => (
                    <div key={bill.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-white text-sm block">{bill.counterparty}</span>
                        <span className="text-slate-400">
                          {bill.clientName} • Vencimento: <strong className="text-rose-400">{bill.currentDueDate}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-extrabold text-white text-base">
                          {bill.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {bill.isSentToday ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Check className="w-3 h-3" /> Notificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" /> Pendente Envio
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setEditingItem({
                              id: bill.id,
                              clientId: bill.clientId,
                              counterparty: bill.counterparty,
                              amount: bill.amount,
                              dueDate: bill.currentDueDate,
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seção D-1 (Amanhã) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    🟡 Vencendo Amanhã (D-1) — {filteredData?.d1PayablesList?.length || 0} contas
                  </h3>
                </div>
              </div>

              {(!filteredData?.d1PayablesList || filteredData.d1PayablesList.length === 0) ? (
                <p className="text-xs text-slate-500 py-3">Nenhuma conta com vencimento programado para amanhã.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredData.d1PayablesList.map((bill) => (
                    <div key={bill.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-white text-sm block">{bill.counterparty}</span>
                        <span className="text-slate-400">
                          {bill.clientName} • Vencimento: {bill.currentDueDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-extrabold text-white text-base">
                          {bill.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {bill.isSentToday ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Check className="w-3 h-3" /> Notificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" /> Pendente Envio
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setEditingItem({
                              id: bill.id,
                              clientId: bill.clientId,
                              counterparty: bill.counterparty,
                              amount: bill.amount,
                              dueDate: bill.currentDueDate,
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── ABA 3: INCONSISTÊNCIAS DE CAIXA ─────────────────────────── */}
        {activeTab === 'inconsistencies' && (
          <section className="space-y-4">
            {(!filteredData?.inconsistenciesList || filteredData.inconsistenciesList.length === 0) ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">Caixa 100% Conciliado!</h3>
                <p className="text-xs text-slate-400">
                  Todas as saídas recentes possuem comprovantes válidos anexados.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl divide-y divide-slate-800 overflow-hidden">
                {filteredData.inconsistenciesList.map((incons) => (
                  <div key={incons.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white text-sm block">{incons.clientName}</span>
                        <p className="text-slate-300 mt-0.5">{incons.reason}</p>
                      </div>
                    </div>
                    {incons.amount && (
                      <span className="font-extrabold text-rose-400 text-sm">
                        {incons.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── ABA 4: CARTEIRA DE CLIENTES BPO ─────────────────────────── */}
        {activeTab === 'clients' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Empresa / Razão Social</th>
                    <th className="px-5 py-3.5">Tier de Serviço</th>
                    <th className="px-5 py-3.5">Escritório Contábil</th>
                    <th className="px-5 py-3.5">Contas Hoje (D-0)</th>
                    <th className="px-5 py-3.5">Docs Pendentes</th>
                    <th className="px-5 py-3.5">Status BPO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.clientsList?.map((client) => {
                    const tierBadge =
                      client.serviceTier === 'bpo_cfo' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          BPO CFO
                        </span>
                      ) : client.serviceTier === 'bpo_gestao' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          BPO Gestão
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Self-Service
                        </span>
                      );

                    return (
                      <tr key={client.clientId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-bold text-white whitespace-nowrap">
                          {client.companyName}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">{tierBadge}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-300">
                          {client.accountantOfficeName || 'Escritório Modelo Contabilidade'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {client.todayPayablesCount > 0 ? (
                            <span className="font-bold text-rose-400">
                              {client.todayPayablesCount} conta(s) (
                              {(client.todayPayablesAmount || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                              )
                            </span>
                          ) : (
                            <span className="text-slate-500">Sem contas hoje</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {client.pendingDocumentsCount > 0 ? (
                            <span className="font-bold text-amber-400">{client.pendingDocumentsCount}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {client.status === 'up_to_date' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Em dia
                            </span>
                          ) : client.status === 'critical' ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" /> Atenção Crítica
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                              <Clock className="w-3.5 h-3.5" /> Pendências
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {/* ── ABA 5: RAIO-X DE INTELIGÊNCIA CFO STRATEGY ─────────────── */}
        {activeTab === 'cfo' && (
          <section className="space-y-6">
            {loadingCfo ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-16 text-center text-slate-400">
                <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs">Processando inteligência analítica CFO Strategy...</p>
              </div>
            ) : !cfoData ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-200">Selecione uma empresa para visualizar o Raio-X CFO.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Utilize o seletor de clientes acima para auditar gastos pessoais, juros evitados e projeção D+15/D+30.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Cabeçalho do Raio-X */}
                <div className="bg-gradient-to-r from-purple-900/40 via-slate-900/60 to-slate-900/80 border border-purple-500/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                      💎
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Diagnóstico CFO Consultivo —{' '}
                        {data?.clientsList?.find((c) => c.clientId === targetCfoClientId)?.companyName || 'Empresa'}
                      </h3>
                      <p className="text-xs text-purple-300">
                        Indicadores de alto valor para justificar mensalidades de controladoria e blindar a saúde do cliente.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {cfoData.cashTightness?.riskLevel === 'healthy' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Caixa Saudável
                      </span>
                    ) : cfoData.cashTightness?.riskLevel === 'tight' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Caixa Apertado
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" /> Caixa Crítico
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid dos 3 Pilares Consultivos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Juros e Multas Evitados (ROI) */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                          Proteção de Pontualidade
                        </span>
                        <span className="text-xs font-bold text-emerald-400">ROI Direto</span>
                      </div>
                      <div className="text-2xl font-extrabold text-emerald-400 mb-1">
                        {cfoData.avoidedInterest?.formattedAvoidedInterest || 'R$ 0,00'}
                      </div>
                      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                        Economia real apurada em multas (2%) e juros de mora evitados por pagamentos 100% no prazo.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-emerald-300">
                      ✨ <strong>{cfoData.avoidedInterest?.totalPaidBillsCount || 0}</strong> conta(s) gerida(s) e pagas pontualmente.
                    </div>
                  </div>

                  {/* Card 2: Contaminação PF x PJ */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          Contaminação PF x PJ
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          {cfoData.pfLeak?.percentageOfExpenses?.toFixed(1) || '0.0'}% do total
                        </span>
                      </div>
                      <div className="text-2xl font-extrabold text-amber-400 mb-1">
                        {(cfoData.pfLeak?.totalPfAmount || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                        Total de gastos com perfil pessoal (supermercado, condomínio, escola) pagos na conta jurídica.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                      💡 {cfoData.pfLeak?.totalPfAmount > 0 ? 'Orientação: unificar em pró-labore fixo.' : 'Blindagem 100% íntegra no período.'}
                    </div>
                  </div>

                  {/* Card 3: Previsão de Liquidez D+15 / D+30 */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-purple-400" />
                          Projeção D+15 e D+30
                        </span>
                        <span className="text-xs font-bold text-purple-400">Preditivo</span>
                      </div>
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Saldo Hoje:</span>
                          <span className="font-bold text-white">
                            {(cfoData.cashTightness?.currentBalance || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Projeção D+15:</span>
                          <span className={`font-bold ${cfoData.cashTightness?.projectedBalanceD15 < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {(cfoData.cashTightness?.projectedBalanceD15 || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Projeção D+30:</span>
                          <span className={`font-bold ${cfoData.cashTightness?.projectedBalanceD30 < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {(cfoData.cashTightness?.projectedBalanceD30 || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-[11px] text-purple-300">
                      {cfoData.cashTightness?.alertMessage || 'Fluxo de caixa futuro equilibrado para os próximos 30 dias.'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── MODAL DE EDIÇÃO RÁPIDA DE DADOS DO LANÇAMENTO ────────────── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-emerald-400" />
              Editar Dados do Lançamento
            </h3>

            <form onSubmit={handleSaveEditBill} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Fornecedor / Favorecido</label>
                <input
                  type="text"
                  value={editingItem.counterparty}
                  onChange={(e) => setEditingItem({ ...editingItem, counterparty: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.amount}
                    onChange={(e) => setEditingItem({ ...editingItem, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Vencimento</label>
                  <input
                    type="date"
                    value={editingItem.dueDate}
                    onChange={(e) => setEditingItem({ ...editingItem, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Linha Digitável ou Chave Pix</label>
                <input
                  type="text"
                  value={editingItem.barcodeOrPix || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, barcodeOrPix: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-[11px]"
                  placeholder="Cole o código ou chave..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-md"
                >
                  Salvar Ajustes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE MARCAR INCONSISTÊNCIA ───────────────────────────── */}
      {inconsistentModalItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Marcar Documento Inconsistente
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              O cliente ({inconsistentModalItem.clientName}) será orientado no WhatsApp sobre o motivo.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Motivo da Inconsistência</label>
                <textarea
                  rows={3}
                  value={inconsistentModalItem.reason}
                  onChange={(e) =>
                    setInconsistentModalItem({ ...inconsistentModalItem, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  placeholder="Ex: Código de barras cortado, imagem borrada..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setInconsistentModalItem(null)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInconsistent}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer shadow-md"
                >
                  Confirmar & Notificar WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

