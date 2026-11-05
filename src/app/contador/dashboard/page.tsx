'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Eye,
  LogOut,
  RefreshCw,
  Calendar,
  DollarSign,
  FileSpreadsheet,
  FileArchive,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import type { AccountantDashboardResponse } from '@/app/api/contador/dashboard/route';

export default function ContadorDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AccountantDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Mês de referência selecionado (formato YYYY-MM)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultRefMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const [referenceMonth, setReferenceMonth] = useState<string>(defaultRefMonth);

  // Filtro de busca na tabela
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Estado de download de ZIP por cliente
  const [downloadingClientId, setDownloadingClientId] = useState<string | null>(null);

  // Estado do Modal de Extrato
  const [extratoModal, setExtratoModal] = useState<{
    isOpen: boolean;
    clientName: string;
    cnpj: string;
    entries: any[];
    loading: boolean;
  }>({
    isOpen: false,
    clientName: '',
    cnpj: '',
    entries: [],
    loading: false,
  });

  // Identificador do escritório
  const [officeId, setOfficeId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlOfficeId = urlParams.get('office_id');
      const savedOfficeId = localStorage.getItem('analisai_office_id');
      const effOfficeId = urlOfficeId || savedOfficeId || '';

      if (effOfficeId) {
        setOfficeId(effOfficeId);
        localStorage.setItem('analisai_office_id', effOfficeId);
      } else {
        // Se não tiver escritório salvo, tenta carregar dados padrão ou redireciona
        setOfficeId('seed-office-modelo-01');
      }
    }
  }, []);

  const fetchDashboard = async (targetOfficeId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/contador/dashboard?office_id=${encodeURIComponent(targetOfficeId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Escritório não localizado. Faça login novamente.');
        }
        throw new Error('Falha ao carregar dados do painel do contador.');
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
    if (officeId) {
      fetchDashboard(officeId);
    }
  }, [officeId]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('analisai_office_id');
      localStorage.removeItem('analisai_office_name');
    }
    router.push('/contador');
  };

  // Disparo do download do pacote fiscal em ZIP
  const handleDownloadZip = async (clientId: string, companyName: string) => {
    try {
      setDownloadingClientId(clientId);
      const res = await fetch(
        `/api/contador/download-fiscal-package?client_id=${encodeURIComponent(
          clientId
        )}&reference_month=${encodeURIComponent(referenceMonth)}`
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao gerar pacote ZIP.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `pacote_fiscal_${safeName}_${referenceMonth.replace('-', '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Erro ao baixar pacote fiscal: ${err?.message}`);
    } finally {
      setDownloadingClientId(null);
    }
  };

  // Abre modal de extrato
  const handleOpenExtrato = async (client: any) => {
    setExtratoModal({
      isOpen: true,
      clientName: client.company_name,
      cnpj: client.cnpj_cpf,
      entries: [],
      loading: true,
    });

    try {
      const res = await fetch(
        `/api/contador/extrato?client_id=${encodeURIComponent(client.id)}&period=${encodeURIComponent(
          referenceMonth
        )}`
      );
      const json = await res.json();
      setExtratoModal((prev) => ({
        ...prev,
        entries: json.entries || [],
        loading: false,
      }));
    } catch {
      setExtratoModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Lista de meses para o seletor
  const monthOptions = useMemo(() => {
    const list = [];
    const date = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const value = `${y}-${m}`;
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
      list.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return list;
  }, []);

  // Clientes filtrados por busca
  const filteredClients = useMemo(() => {
    if (!data?.clients) return [];
    if (!searchQuery.trim()) return data.clients;
    const q = searchQuery.toLowerCase();
    return data.clients.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        (c.trade_name && c.trade_name.toLowerCase().includes(q)) ||
        c.cnpj_cpf.includes(q)
    );
  }, [data?.clients, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white pb-20">
      {/* ── BARRA SUPERIOR ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20 text-sm">
            🏢
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {data?.office?.name || 'Escritório Contábil Parceiro'}
              </h1>
              {data?.office?.crc_number && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  CRC {data.office.crc_number}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Gestão de Carteira & Download de Pacotes Fiscais BPO
            </p>
          </div>
        </div>

        {/* Ações de Cabeçalho */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/bpo"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
          >
            <span>🎛️</span>
            <span>Torre BPO</span>
          </Link>

          <button
            onClick={() => fetchDashboard(officeId)}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Atualizar painel"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-300">
            ⚠️ {error}
          </div>
        )}

        {/* ── 1. GRID DE RESUMO EXECUTIVO ─────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Clientes Ativos */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                Clientes na Carteira BPO
              </span>
              <span className="text-xs font-bold text-emerald-400">Ativos</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-white">
                {data?.metrics?.total_active_clients || 0}
              </span>
              <span className="text-xs text-slate-400">empresas indicadas</span>
            </div>
            <p className="text-xs text-slate-400">
              Clientes recebendo conciliação diária e suporte financeiro do AnalisAí.
            </p>
          </div>

          {/* Card 2: Fechamentos do Mês */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Fechamento do Mês
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {data?.metrics?.closed_current_month || 0} de {data?.metrics?.total_active_clients || 0} Prontos
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-white">
                {data?.metrics?.closed_current_month || 0}
              </span>
              <span className="text-xs text-slate-400">
                de {data?.metrics?.total_active_clients || 0} pacotes gerados
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Pacotes fiscais consolidados (DRE, Livro Caixa e comprovantes arquivados).
            </p>
          </div>

          {/* Card 3: Comissão Recorrente */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Comissão Mensal Recorrente
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {data?.metrics?.commission_rate || 10}% ao mês
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-emerald-400">
                {(data?.metrics?.total_monthly_commission || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
              <span className="text-xs text-slate-400">/mês previsto</span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Chave Pix: <strong className="text-slate-300">{data?.office?.pix_key || data?.office?.email || 'A cadastrar'}</strong>
            </p>
          </div>
        </section>

        {/* ── 2. SELETOR DE MÊS & BARRA DE BUSCA ──────────────────────── */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Competência de Apuração
              </span>
              <span className="text-xs text-slate-400">Selecione o mês para download dos pacotes fiscais</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <select
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              className="px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar empresa ou CNPJ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </section>

        {/* ── 3. TABELA DE CLIENTES INDICADOS ─────────────────────────── */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Empresas Atendidas pelo BPO ({filteredClients.length})
            </h2>
            <span className="text-xs text-slate-400">
              Download em 1 clique do pacote completo em ZIP
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs">Carregando carteira de clientes...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">Nenhum cliente localizado nesta busca.</p>
              <p className="text-xs text-slate-500 mt-1">Verifique os filtros ou cadastre novos clientes parceiros.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Cliente / Razão Social</th>
                    <th className="px-5 py-3.5">Plano Contratado</th>
                    <th className="px-5 py-3.5">Última Conciliação</th>
                    <th className="px-5 py-3.5">Status Contábil</th>
                    <th className="px-5 py-3.5 text-right">Ações em 1 Clique</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredClients.map((client) => {
                    const isDownloading = downloadingClientId === client.id;
                    const tierBadge =
                      client.service_tier === 'bpo_cfo' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          BPO CFO
                        </span>
                      ) : client.service_tier === 'bpo_gestao' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          BPO Gestão
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Self-Service
                        </span>
                      );

                    const statusBadge =
                      client.status_fechamento === 'fechado' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          🟢 Pronto para Escrituração
                        </span>
                      ) : client.status_fechamento === 'pendente_documentos' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          🔴 Aguardando Cliente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          🟡 Em Conciliação
                        </span>
                      );

                    return (
                      <tr key={client.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-bold text-white text-sm block">
                            {client.company_name}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            CNPJ: {client.cnpj_cpf}
                          </span>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">{tierBadge}</td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          {client.last_conciliation_at ? (
                            <span className="text-slate-200 font-medium">
                              {client.last_conciliation_at}
                            </span>
                          ) : (
                            <span className="text-slate-500">Conciliado no fechamento</span>
                          )}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">{statusBadge}</td>

                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Botão Primário: Baixar Pacote Fiscal */}
                            <button
                              onClick={() => handleDownloadZip(client.id, client.company_name)}
                              disabled={isDownloading}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                              title="Download do ZIP (PDF, DRE, CSV e comprovantes)"
                            >
                              <FileArchive className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                              <span>{isDownloading ? 'Gerando ZIP...' : 'Baixar Pacote Fiscal (.ZIP)'}</span>
                            </button>

                            {/* Botão Secundário: Visualizar Extrato */}
                            <button
                              onClick={() => handleOpenExtrato(client)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
                              title="Visualizar movimentações em modo leitura"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Extrato</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ── MODAL DE VISUALIZAÇÃO DE EXTRATO (MODO LEITURA) ───────────── */}
      {extratoModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  Espelho de Movimentação Financeira
                </h3>
                <p className="text-xs text-slate-400">
                  {extratoModal.clientName} • CNPJ: {extratoModal.cnpj}
                </p>
              </div>
              <button
                onClick={() => setExtratoModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2">
              {extratoModal.loading ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Carregando lançamentos conciliados...</p>
                </div>
              ) : extratoModal.entries.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhum lançamento encontrado para a competência selecionada.
                </div>
              ) : (
                extratoModal.entries.map((entry) => {
                  const isIncome = entry.entry_type === 'income';
                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white block">{entry.description}</span>
                        <span className="text-slate-500 text-[11px]">
                          {entry.entry_date} • {entry.dre_group || 'Geral'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-bold text-sm ${
                            isIncome ? 'text-emerald-400' : 'text-slate-200'
                          }`}
                        >
                          {isIncome ? '+ ' : '- '}
                          {Number(entry.amount).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">
                          {entry.status || 'Conciliado'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setExtratoModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

