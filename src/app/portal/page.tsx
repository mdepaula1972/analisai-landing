'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  MessageCircle,
  Building2,
  Wallet,
  Eye,
  EyeOff,
  Smartphone,
  LogOut,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
} from 'lucide-react';
import { BpoPortalData } from '@/types/bpo';

export default function PortalClientePage() {
  const [data, setData] = useState<BpoPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showValues, setShowValues] = useState<boolean>(true);
  const [loginInput, setLoginInput] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // PWA Support
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone
    ) {
      setIsStandalone(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Extração e verificação de token ou modo demo
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const localToken =
      localStorage.getItem('analisai_portal_token') ||
      localStorage.getItem('analisai_dash_token');
    const isDemo = urlParams.get('demo') === 'true';

    const effective = urlToken || localToken || '';

    if (effective) {
      setToken(effective);
      localStorage.setItem('analisai_portal_token', effective);
      loadPortalData(effective, false);
    } else if (isDemo) {
      loadPortalData('', true);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadPortalData(authToken: string, isDemo = false) {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/portal/data';
      if (isDemo) {
        url += '?demo=true';
      } else if (authToken) {
        url += `?token=${encodeURIComponent(authToken)}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível carregar os dados do seu BPO.');
      }

      setData(json);
    } catch (err: any) {
      console.error('[Portal Cliente] Erro:', err);
      setError(err.message || 'Sua sessão expirou ou o link não é mais válido.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginInput.trim()) return;

    try {
      setLoginLoading(true);
      setLoginError(null);

      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginInput }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao autenticar.');
      }

      if (json.token) {
        setToken(json.token);
        localStorage.setItem('analisai_portal_token', json.token);
        await loadPortalData(json.token, false);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Telefone ou CNPJ não encontrado.');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('analisai_portal_token');
    localStorage.removeItem('analisai_dash_token');
    setToken('');
    setData(null);
  }

  function handleCopy(text?: string | null) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 3000);
  }

  function handleInstallClick() {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    }
  }

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    if (!showValues) return 'R$ ••••••••';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatTime = (isoDate?: string) => {
    if (!isoDate) return 'Hoje';
    try {
      const d = new Date(isoDate);
      return `Hoje às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return 'Hoje';
    }
  };

  // Se estiver carregando inicial
  if (loading && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-200">
        <div className="relative mb-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse">
            <Building2 className="w-7 h-7" />
          </div>
          <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <p className="font-semibold text-lg text-slate-100">Carregando seu BPO Financeiro...</p>
        <p className="text-xs text-slate-400 mt-1">Sincronizando contas e saldo conciliado</p>
      </div>
    );
  }

  // TELA DE LOGIN / SOLICITAÇÃO DE ACESSO CASO NÃO AUTENTICADO
  if (!data) {
    return (
      <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 bg-slate-950 text-slate-100 max-w-md mx-auto">
        <div className="pt-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
              A
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">AnalisAí</span>
              <span className="text-xs font-semibold text-emerald-400 ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                BPO Financeiro
              </span>
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white mb-2">
            Portal do Cliente
          </h1>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Seu saldo bancário conciliado, contas a pagar da semana e lucros apurados pelo seu operador de BPO em tempo real.
          </p>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Seu WhatsApp ou CNPJ Cadastrado
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="(11) 99999-9999 ou CNPJ"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading || !loginInput.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validando cadastro...</span>
                </>
              ) : (
                <>
                  <span>Acessar Meu Painel</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-900 text-center">
            <button
              onClick={() => loadPortalData('', true)}
              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center justify-center gap-1.5 mx-auto transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Experimentar Demonstração Interativa</span>
            </button>
          </div>
        </div>

        <div className="py-6 text-center text-xs text-slate-500">
          <p>Dúvidas com seu acesso? Fale com seu operador no WhatsApp.</p>
        </div>
      </div>
    );
  }

  // TELA PRINCIPAL DO PORTAL DO CLIENTE (MOBILE FIRST)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 max-w-lg mx-auto relative px-4 sm:px-6 pt-4">
      {/* Top Banner PWA Install (se disponível) */}
      {installPrompt && (
        <div className="mb-4 p-3 bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-200">Instalar Aplicativo BPO</p>
              <p className="text-[11px] text-slate-400">Acesse com 1 toque na tela inicial</p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="text-xs font-bold bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-colors shadow-sm"
          >
            Instalar
          </button>
        </div>
      )}

      {/* HEADER EXECUTIVO */}
      <header className="mb-6 pt-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-black text-base shadow-md shadow-emerald-500/20">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">AnalisAí</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  {data.client.serviceTier === 'bpo_cfo'
                    ? 'BPO CFO'
                    : data.client.serviceTier === 'bpo_gestao'
                    ? 'BPO Gestão'
                    : 'Self-Service'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium truncate max-w-[200px]">
                {data.client.companyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowValues(!showValues)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title={showValues ? 'Ocultar valores' : 'Mostrar valores'}
            >
              {showValues ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => loadPortalData(token, !token)}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Desconectar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status de Parceria Contábil */}
        {data.client.accountantOfficeName && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400">
            <Building2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">
              Contabilidade integrada: <strong className="text-slate-200">{data.client.accountantOfficeName}</strong>
            </span>
          </div>
        )}
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CARD 1: SALDO CONCILIADO HOJE (HERO CARD)                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="mb-5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/25 p-5 shadow-xl shadow-emerald-950/20">
          <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
                Saldo Conciliado Hoje
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" />
              {formatTime(data.card1_reconciledBalance.lastConciliatedAt)}
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {formatCurrency(data.card1_reconciledBalance.currentBalance)}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Entradas Hoje</p>
                <p className="text-xs font-bold text-emerald-300">
                  {formatCurrency(data.card1_reconciledBalance.todayInflow)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Saídas Hoje</p>
                <p className="text-xs font-bold text-rose-300">
                  {formatCurrency(data.card1_reconciledBalance.todayOutflow)}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                Auditor BPO
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CARD 2: CONTAS QUE VENCEM NOS PRÓXIMOS 7 DIAS                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="mb-5">
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Contas dos Próximos 7 Dias</h2>
                <p className="text-[11px] text-slate-400">
                  {data.card2_weekPayables.count} compromisso(s) a pagar
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total a Pagar</p>
              <p className="text-sm font-black text-amber-300">
                {formatCurrency(data.card2_weekPayables.totalPayable)}
              </p>
            </div>
          </div>

          {/* Alerta de contas em atraso (se houver) */}
          {data.card2_weekPayables.overdueCount > 0 && (
            <div className="mb-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs text-rose-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  <strong>{data.card2_weekPayables.overdueCount}</strong> conta(s) em atraso
                </span>
              </div>
              <span className="font-bold">{formatCurrency(data.card2_weekPayables.overdueAmount)}</span>
            </div>
          )}

          {/* Lista de Contas */}
          {data.card2_weekPayables.bills.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-950/50 border border-slate-800/60">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold text-slate-200">
                Nenhuma conta a pagar nos próximos 7 dias!
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Seu fluxo de caixa está em dia e protegido pelo BPO.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.card2_weekPayables.bills.map((bill) => {
                const isOverdue = bill.daysUntilDue < 0 || bill.status === 'overdue';
                const isToday = bill.daysUntilDue === 0;
                const isTomorrow = bill.daysUntilDue === 1;

                return (
                  <div
                    key={bill.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isOverdue
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : isToday
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-slate-950/40 border-slate-800/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-100 truncate">
                          {bill.counterpartyName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isOverdue
                                ? 'bg-rose-500/20 text-rose-300'
                                : isToday
                                ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                                : isTomorrow
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {bill.humanDueDate}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-white">
                          {formatCurrency(bill.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Botão de Cópia em 1 Toque (Código de barras ou Chave Pix) */}
                    {bill.barcodeOrPix ? (
                      <button
                        onClick={() => handleCopy(bill.barcodeOrPix)}
                        className={`w-full mt-2 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          copiedCode === bill.barcodeOrPix
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60'
                        }`}
                      >
                        {copiedCode === bill.barcodeOrPix ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Código copiado para o banco! ✓</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">Copiar Linha Digitável / Pix</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="mt-2 text-right">
                        <span className="text-[10px] text-slate-500 italic">
                          Comprovante em conferência pelo BPO
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CARD 3: RESUMO DE LUCRO DOS ÚLTIMOS 3 MESES (DRE SIMPLIFICADA) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="mb-5">
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Lucro dos Últimos 3 Meses</h2>
                <p className="text-[11px] text-slate-400">DRE Executiva Gerencial</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Média Mensal</p>
              <p className="text-sm font-black text-emerald-400">
                {formatCurrency(data.card3_profitSummary.averageMonthlyProfit)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {data.card3_profitSummary.months.map((m) => {
              const profitRatio = m.revenue > 0 ? Math.min(Math.max((m.netProfit / m.revenue) * 100, 5), 100) : 0;

              return (
                <div
                  key={m.monthKey}
                  className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/60"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200">{m.monthLabel}</span>
                    <span
                      className={`text-xs font-black ${
                        m.isProfitable ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatCurrency(m.netProfit)}
                      <span className="text-[10px] font-semibold text-slate-400 ml-1.5">
                        ({m.marginPercent}%)
                      </span>
                    </span>
                  </div>

                  {/* Barra Visual de Proporção */}
                  <div className="w-full bg-slate-800/80 rounded-full h-2 mb-2 overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        m.isProfitable ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.abs(profitRatio)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/40">
                    <span>
                      Entradas: <strong className="text-slate-300">{formatCurrency(m.revenue)}</strong>
                    </span>
                    <span>
                      Despesas: <strong className="text-slate-300">{formatCurrency(m.expenses)}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SEÇÃO CFO STRATEGY: PROTEÇÃO E INTELIGÊNCIA BPO               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-indigo-500/20 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Proteção Financeira BPO
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Escudo de Pontualidade / Economia em Juros Evitados */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-indigo-200">
                  Economia em Juros & Multas
                </span>
                <span className="text-xs font-black text-emerald-400">
                  {formatCurrency(data.cfoStrategy.avoidedInterest)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {data.cfoStrategy.avoidedInterestRoiText ||
                  '100% das suas contas pagas no prazo graças ao controle diário de vencimentos do BPO.'}
              </p>
            </div>

            {/* Auditoria PF x PJ */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/60 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  {data.cfoStrategy.personalExpenseLeakAmount > 0
                    ? 'Despesas Pessoais Identificadas no Caixa PJ'
                    : 'Separação de Contas PF x PJ Perfeita'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {data.cfoStrategy.personalExpenseLeakAmount > 0
                    ? `Foram apontados ${formatCurrency(data.cfoStrategy.personalExpenseLeakAmount)} em despesas pessoais na conta da empresa. O BPO recomenda separar para blindagem societária.`
                    : 'Nenhuma mistura de despesas pessoais na conta corporativa identificada neste mês.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center text-xs text-slate-500 space-y-1 mb-6">
        <p>AnalisAí BPO Financeiro • Controladoria Ativa</p>
        <p className="text-[11px]">
          Operador Responsável: <strong className="text-slate-400">{data.support.operatorName}</strong>
        </p>
      </footer>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTÃO FLUTUANTE (FAB): ENVIAR COMPROVANTE NO WHATSAPP         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-5 left-0 right-0 px-4 max-w-lg mx-auto z-40">
        <a
          href={data.support.whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-4 px-5 rounded-2xl flex items-center justify-center gap-2.5 shadow-2xl shadow-emerald-500/30 transition-all transform active:scale-[0.98]"
        >
          <div className="w-7 h-7 rounded-full bg-slate-950/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-slate-950 fill-current" />
          </div>
          <span className="text-sm">Enviar Comprovante no WhatsApp</span>
        </a>
      </div>
    </div>
  );
}

