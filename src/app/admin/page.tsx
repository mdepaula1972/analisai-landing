'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { AdminMetricsData, LeadItem } from '@/lib/solo/admin-metrics';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [inputToken, setInputToken] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dormant' | 'hot' | 'converted' | 'all'>('dormant');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Carrega token dos parâmetros da URL ou do localStorage
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

  // 2. Busca métricas quando o token estiver definido
  const fetchMetrics = async (currentToken: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/metrics?token=${encodeURIComponent(currentToken)}`);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Chave ou Token Administrativo inválido. Verifique o link ou digite seu token.');
        }
        throw new Error('Falha ao carregar métricas do servidor.');
      }
      const data = await res.json();
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMetrics(token);
    }
  }, [token]);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    const cleanToken = inputToken.trim();
    setToken(cleanToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('analisai_admin_token', cleanToken);
    }
  };

  const handleLogout = () => {
    setToken('');
    setMetrics(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('analisai_admin_token');
    }
  };

  // Filtros de busca e listas
  const currentLeadsList = useMemo(() => {
    if (!metrics) return [];
    let list: LeadItem[] = [];
    if (activeTab === 'dormant') list = metrics.dormantLeads;
    else if (activeTab === 'hot') list = metrics.hotLeads;
    else if (activeTab === 'converted') list = metrics.convertedLeads;
    else list = [...metrics.dormantLeads, ...metrics.hotLeads, ...metrics.convertedLeads];

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        item.formattedPhone.toLowerCase().includes(q) ||
        (item.referrer && item.referrer.toLowerCase().includes(q))
    );
  }, [metrics, activeTab, searchQuery]);

  // Tela de Autenticação se não tiver token válido
  if (!token && !loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">AnalisAí Solo</h1>
              <p className="text-xs text-slate-400">Painel Executivo do Fundador</p>
            </div>
          </div>

          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            Acesso restrito para administração de clientes, métricas de faturamento e funil de conversão.
          </p>

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Token ou Chave de Acesso
              </label>
              <input
                type="password"
                placeholder="Ex: marcos_admin_..."
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              Entrar no Painel
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500">
              💡 Você também pode abrir com 1 toque direto pelo WhatsApp enviando o comando <strong className="text-emerald-400">!painel</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight">AnalisAí Solo</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Admin Master
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Painel de Funil, Clientes & Desempenho em Tempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => fetchMetrics(token)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-300 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => fetchMetrics(token)} className="underline text-xs ml-4 cursor-pointer">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && !metrics && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm">Carregando métricas do banco de dados...</p>
          </div>
        )}

        {metrics && (
          <>
            {/* 1. KPIs Resumo Executivo */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Assinantes & MRR */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm relative overflow-hidden">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Receita Mensal (MRR)
                </div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                  {metrics.summary.mrrFormatted}
                </div>
                <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>{metrics.summary.activeSubscribers} assinante(s) ativo(s)</span>
                </div>
              </div>

              {/* Card 2: Total de Convidados & Mapeados */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Total no Funil
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">
                  {metrics.funnel.totalGuestsAndLeads}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Convidados VIPs + Leads degustação
                </div>
              </div>

              {/* Card 3: Taxa de Ativação do Trial */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Taxa de Ativação
                </div>
                <div className="text-xl sm:text-2xl font-bold text-cyan-400">
                  {metrics.funnel.activationRatePercent}%
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {metrics.funnel.hotTrialCount + metrics.funnel.convertedCount} enviaram ao menos 1 conta
                </div>
              </div>

              {/* Card 4: Taxa de Conversão */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Conversão em Clientes
                </div>
                <div className="text-xl sm:text-2xl font-bold text-purple-400">
                  {metrics.funnel.conversionRatePercent}%
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {metrics.funnel.convertedCount} clientes pagantes
                </div>
              </div>
            </section>

            {/* 2. Visualização Interativa do Funil */}
            <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center justify-between">
                <span>Etapas do Funil de Aquisição</span>
                <span className="text-xs text-slate-400 lowercase font-normal">
                  base: {metrics.funnel.totalGuestsAndLeads} contatos
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Etapa 1: Dormindo */}
                <div
                  onClick={() => setActiveTab('dormant')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    activeTab === 'dormant'
                      ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      1. Dormindo (Não testaram)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                      {metrics.funnel.dormantCount}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {metrics.funnel.dormantCount}
                  </div>
                  <p className="text-xs text-slate-400">
                    Receberam o convite mas nunca enviaram uma conta.
                  </p>
                </div>

                {/* Etapa 2: Quentes */}
                <div
                  onClick={() => setActiveTab('hot')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    activeTab === 'hot'
                      ? 'bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                      2. Quentes (Em Ponto de Venda)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                      {metrics.funnel.hotTrialCount}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {metrics.funnel.hotTrialCount}
                  </div>
                  <p className="text-xs text-slate-400">
                    Testaram as contas gratuitas e viram a mágica na prática.
                  </p>
                </div>

                {/* Etapa 3: Convertidos */}
                <div
                  onClick={() => setActiveTab('converted')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    activeTab === 'converted'
                      ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      3. Convertidos (Assinantes)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      {metrics.funnel.convertedCount}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {metrics.funnel.convertedCount}
                  </div>
                  <p className="text-xs text-slate-400">
                    Assinaturas pagantes ativas no AnalisAí.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. Tabela de Leads & Ações de WhatsApp */}
            <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Abas */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setActiveTab('dormant')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'dormant'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    💤 Não Testaram ({metrics.dormantLeads.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('hot')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'hot'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🔥 Quentes ({metrics.hotLeads.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('converted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'converted'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🏆 Assinantes ({metrics.convertedLeads.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'all'
                        ? 'bg-slate-800 text-white border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos ({metrics.funnel.totalGuestsAndLeads})
                  </button>
                </div>

                {/* Campo de Busca */}
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar nome ou telefone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Listagem */}
              <div className="divide-y divide-slate-800/80">
                {currentLeadsList.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Nenhum contato encontrado nesta visualização.
                  </div>
                ) : (
                  currentLeadsList.map((item) => {
                    const defaultMessage =
                      activeTab === 'dormant'
                        ? `Olá, ${item.name}! Vi que você recebeu o acesso VIP ao AnalisAí. Conseguiu testar sua primeira conta ou boleto? Se precisar de ajuda, estou por aqui!`
                        : `Olá, ${item.name}! Vi que você já testou o AnalisAí no WhatsApp. O que achou da agilidade de ter seu Livro Caixa automatizado? Tenho uma condição especial para você ativar sua conta!`;

                    const waUrl = `https://wa.me/${item.phone}?text=${encodeURIComponent(defaultMessage)}`;

                    return (
                      <div
                        key={item.phone}
                        className="p-4 sm:px-6 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{item.name}</span>
                            <span className="text-xs text-slate-400 font-mono">
                              {item.formattedPhone}
                            </span>
                            {item.origin === 'convite_qa' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                                Convite VIP
                              </span>
                            )}
                            {item.origin === 'indicacao' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                                Indicação
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                            <span>
                              Contas testadas: <strong className="text-slate-200">{item.docsProcessedCount}</strong>
                            </span>
                            {item.interestedPlan && (
                              <span>
                                Interesse: <strong className="text-emerald-400 uppercase">{item.interestedPlan}</strong>
                              </span>
                            )}
                            {item.referrer && (
                              <span>
                                Indicado por: <span className="text-slate-300">{item.referrer}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botão de Ação WhatsApp */}
                        <div>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                          >
                            <span>💬</span>
                            <span>{activeTab === 'dormant' ? 'Reengajar' : 'Chamar no WhatsApp'}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
