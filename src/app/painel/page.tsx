'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  PieChart as PieChartIcon,
  FileText,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  X,
  MessageCircle,
  Building2,
  Wallet,
} from 'lucide-react';

interface BillItem {
  id: string;
  counterparty_name: string;
  amount: number;
  current_due_date: string;
  status: 'open' | 'paid' | 'overdue';
  type: 'payable' | 'receivable';
  barcode_or_pix?: string | null;
  is_provision?: boolean;
}

interface DashboardData {
  user: {
    id?: string;
    name: string;
    companyName: string;
    taxId?: string;
    taxType?: string;
    role: 'admin' | 'operator';
    isTrial: boolean;
  };
  summary: {
    totalWeekPayable: number;
    totalMonthPayable: number;
    totalMonthReceivable: number;
    totalOverdue: number;
    realizedIncomeMonth: number;
    realizedExpenseMonth: number;
    netBalanceMonth: number;
    overdueCount: number;
    weekBillsCount: number;
    openPayablesCount: number;
    isRestrictedView?: boolean;
  };
  dates?: {
    today: string;
    monday: string;
    sunday: string;
    monthStart?: string;
    monthEnd?: string;
  };
  bills: BillItem[];
  categoriesChart: Array<{ name: string; value: number }>;
  taxMeter?: {
    regime: string;
    annualLimit: number;
    currentRevenue: number;
    percentage: number;
    status: 'tranquilo' | 'atencao' | 'perigo';
    remainingSafetyMargin: number;
    warningMessage?: string;
  } | null;
}

export default function PainelPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'semana' | 'fluxo' | 'categorias' | 'fiscal'>('semana');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);

  // 1. Captura de Evento de Instalação PWA
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // 2. Extração e Persistência do Magic Link Token
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const localToken = localStorage.getItem('analisai_dash_token');

    const effective = urlToken || localToken || '';

    if (effective) {
      setToken(effective);
      localStorage.setItem('analisai_dash_token', effective);
      loadDashboardData(effective);
    } else {
      setLoading(false);
    }
  }, []);

  // 3. Chamada da API com o Token
  async function loadDashboardData(authToken: string) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/dashboard/data?token=${encodeURIComponent(authToken)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível carregar os dados financeiros.');
      }

      setData(json);
    } catch (err: any) {
      console.error('[Dashboard PWA] Erro ao carregar dados:', err);
      setError(err.message || 'Sua sessão expirou ou o token é inválido.');
    } finally {
      setLoading(false);
    }
  }

  // 4. Copiar código de barras ou Pix
  function handleCopy(text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2500);
  }

  // 5. Instalar PWA
  async function handleInstallClick() {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsStandalone(true);
      }
      setInstallPrompt(null);
    } else {
      setShowIosInstallModal(true);
    }
  }

  // Formatadores
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  // Separação de contas
  const { weekBills, otherMonthBills, overdueBills } = useMemo(() => {
    if (!data?.bills) return { weekBills: [], otherMonthBills: [], overdueBills: [] };

    const todayStr = data.dates?.today || new Date().toISOString().split('T')[0];
    const mon = data.dates?.monday || '';
    const sun = data.dates?.sunday || '';

    const overdue = data.bills.filter((b) => b.type === 'payable' && b.status === 'open' && b.current_due_date < todayStr);
    const thisWeek = data.bills.filter((b) => b.current_due_date >= mon && b.current_due_date <= sun);
    const others = data.bills.filter((b) => !thisWeek.includes(b));

    return { weekBills: thisWeek, otherMonthBills: others, overdueBills: overdue };
  }, [data]);

  // Se não houver token ou sessão (Tela de boas-vindas / Pedir Magic Link)
  if (!loading && !token) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 bg-grid flex items-center justify-center p-4 relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-500/5 blur-[100px] pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-2xl card-glow relative z-10 animate-fadeInUp">
          {/* Logotipo Oficial */}
          <div className="flex justify-center mb-6">
            <Link href="/" className="inline-block transition-transform hover:scale-105">
              <Image
                src="/logo-horizontal.jpg"
                alt="AnalisAI.me"
                width={480}
                height={132}
                className="h-9 sm:h-11 w-auto object-contain"
                priority
              />
            </Link>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-[10px] font-extrabold uppercase tracking-[.1em] mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Painel Financeiro Mobile</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
            Acesso Seguro via WhatsApp
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed">
            Sem senhas e sem formulários cadastrais. Seu acesso visual ao Livro Caixa e fluxo de caixa é exclusivo através de link seguro enviado no seu WhatsApp.
          </p>

          <a
            href="https://wa.me/5513920099874?text=painel"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-400/25 transition-all transform active:scale-95 text-sm"
          >
            <MessageCircle className="w-5 h-5 fill-slate-950 stroke-none" />
            <span>Pedir Link no WhatsApp</span>
          </a>

          <p className="text-xs text-slate-500 mt-5">
            Basta enviar a palavra <code className="bg-slate-950 border border-slate-800 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">painel</code> no nosso número oficial.
          </p>
        </div>
      </main>
    );
  }

  // Estado de carregamento
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans bg-grid flex flex-col items-center justify-center p-6 space-y-6 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/10 blur-[100px] pointer-events-none" />
        
        <Image
          src="/logo-horizontal.jpg"
          alt="AnalisAI.me"
          width={480}
          height={132}
          className="h-9 w-auto object-contain opacity-90 animate-pulse"
          priority
        />
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-slate-400 text-xs sm:text-sm font-medium tracking-wide">
          Sincronizando seu Livro Caixa em tempo real...
        </p>
      </div>
    );
  }

  // Erro de autenticação
  if (error && !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 font-sans bg-grid flex items-center justify-center p-4 relative overflow-hidden">
        <div className="max-w-md w-full bg-slate-900/90 border border-rose-500/30 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl relative z-10">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-horizontal.jpg"
              alt="AnalisAI.me"
              width={480}
              height={132}
              className="h-9 w-auto object-contain"
            />
          </div>
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Link Expirado ou Inválido</h2>
          <p className="text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed">{error}</p>
          <a
            href="https://wa.me/5513920099874?text=painel"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-400/20 text-xs sm:text-sm"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950 stroke-none" />
            <span>Gerar Novo Link no WhatsApp</span>
          </a>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 bg-grid pb-28 md:pb-12 antialiased relative overflow-x-hidden">
      {/* Luzes de ambientação da landing */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-emerald-500/10 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-48 right-0 w-80 h-80 bg-amber-500/5 blur-[100px] pointer-events-none -z-10" />

      {/* ── HEADER NAVBAR NO PADRÃO DA LANDING ── */}
      <header className="sticky top-0 z-40 px-3 pt-2 sm:px-6 transition-all duration-300">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xl backdrop-blur-2xl">
          {/* Logo Oficial + Badge */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <Link href="/" className="flex items-center shrink-0 transition-opacity hover:opacity-90" aria-label="AnalisAI.me — início">
              <Image
                src="/logo-horizontal.jpg"
                alt="AnalisAI.me"
                width={480}
                height={132}
                className="h-7 sm:h-9 w-auto object-contain"
                priority
              />
            </Link>
            <span className="inline-flex whitespace-nowrap rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[.1em] text-emerald-300">
              Painel
            </span>
          </div>

          {/* Ações Topo: Refresh & Instalação */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => token && loadDashboardData(token)}
              disabled={loading}
              title="Atualizar dados"
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition active:scale-95 shadow-sm"
              aria-label="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {!isStandalone && (
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold rounded-xl transition shadow-sm"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Instalar App</span>
                <span className="sm:hidden">App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── IDENTIFICAÇÃO DO USUÁRIO & EMPRESA ── */}
      <div className="max-w-4xl mx-auto px-4 pt-3">
        <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800/80 rounded-2xl px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <h1 className="text-xs sm:text-sm font-bold text-white truncate">
              {data?.user.companyName || data?.user.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {data?.user.isTrial ? (
              <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                Degustação
              </span>
            ) : (
              <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">
                Assinante
              </span>
            )}
            {data?.user.role === 'operator' && (
              <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-400/10 text-blue-300 border border-blue-400/30">
                Operador
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── BANNER DE INSTALAÇÃO PWA MOBILE ── */}
      {!isStandalone && (
        <div className="max-w-4xl mx-auto px-4 pt-2">
          <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900/70 to-slate-900/70 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-400/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-300">
                <strong className="text-white">Adicione à tela de início</strong> para usar como app sem barra de navegador.
              </p>
            </div>
            <button
              onClick={handleInstallClick}
              className="shrink-0 px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black rounded-xl shadow-md transition"
            >
              Instalar
            </button>
          </div>
        </div>
      )}

      {/* ── ALERTA DE CONTAS VENCIDAS (SE HOUVER) ── */}
      {overdueBills.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pt-2">
          <div className="bg-rose-950/50 border border-rose-500/40 rounded-2xl p-3.5 flex items-start gap-3 text-rose-200 shadow-lg shadow-rose-950/20">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="font-bold text-rose-300">
                Atenção: {overdueBills.length} conta(s) em atraso somando {formatBRL(data?.summary.totalOverdue || 0)}
              </strong>
              <p className="text-rose-300/80 mt-0.5">
                Priorize a liquidação para evitar custos de juros diários e pendências fiscais.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="max-w-4xl mx-auto px-4 pt-3 space-y-4">
        {/* CARDS DE RESUMO VISUAL (KPIs) — ESTILO NÚMEROS DE IMPACTO DA LANDING */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Semana */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm card-glow transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Esta Semana</span>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight">
                {data?.summary.isRestrictedView ? 'Sigiloso' : formatBRL(data?.summary.totalWeekPayable || 0)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {data?.summary.weekBillsCount || 0} conta(s) a pagar
              </p>
            </div>
          </div>

          {/* Card 2: Mês Contas */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm card-glow transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">A Pagar no Mês</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {data?.summary.isRestrictedView ? 'Sigiloso' : formatBRL(data?.summary.totalMonthPayable || 0)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {data?.summary.openPayablesCount || 0} obrigações abertas
              </p>
            </div>
          </div>

          {/* Card 3: Receitas Realizadas */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm card-glow transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Entradas de Caixa</span>
              <ArrowDownRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                {data?.summary.isRestrictedView ? 'Sigiloso' : formatBRL(data?.summary.realizedIncomeMonth || 0)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Liquidado no Livro Caixa</p>
            </div>
          </div>

          {/* Card 4: Saldo Líquido */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm card-glow transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Resultado do Mês</span>
              <DollarSign className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <div
                className={`text-xl sm:text-2xl font-black tracking-tight ${
                  (data?.summary.netBalanceMonth || 0) >= 0 ? 'text-teal-300' : 'text-rose-400'
                }`}
              >
                {data?.summary.isRestrictedView ? 'Sigiloso' : formatBRL(data?.summary.netBalanceMonth || 0)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Receitas — Despesas</p>
            </div>
          </div>
        </section>

        {/* NAVEGAÇÃO DE TABS EM PÍLULA — ESTILO LANDING PAGE */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800/80 p-1.5 rounded-2xl overflow-x-auto scrollbar-none backdrop-blur-md">
          <button
            onClick={() => setActiveTab('semana')}
            className={`flex-1 min-w-[95px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              activeTab === 'semana'
                ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Contas</span>
          </button>
          <button
            onClick={() => setActiveTab('fluxo')}
            className={`flex-1 min-w-[95px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              activeTab === 'fluxo'
                ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Fluxo Caixa</span>
          </button>
          <button
            onClick={() => setActiveTab('categorias')}
            className={`flex-1 min-w-[95px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              activeTab === 'categorias'
                ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            <span>Categorias</span>
          </button>
          <button
            onClick={() => setActiveTab('fiscal')}
            className={`flex-1 min-w-[95px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              activeTab === 'fiscal'
                ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Termômetro</span>
          </button>
        </div>

        {/* ── TAB 1: CONTAS DA SEMANA E DO MÊS ── */}
        {activeTab === 'semana' && (
          <section className="space-y-4">
            {/* Bloco 1: Vencem esta semana */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 sm:p-5 card-glow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-200">
                    Cronograma Desta Semana
                  </h2>
                </div>
                <span className="text-xs text-amber-300 font-bold bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                  {weekBills.length} contas
                </span>
              </div>

              {weekBills.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs sm:text-sm">
                  Nenhuma conta agendada para vencer nesta semana! 🎉
                </div>
              ) : (
                <div className="space-y-2.5">
                  {weekBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">{bill.counterparty_name}</p>
                          {bill.is_provision && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                              Variável
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span
                            className={
                              bill.status === 'overdue'
                                ? 'text-rose-400 font-bold'
                                : bill.status === 'paid'
                                ? 'text-emerald-400 font-bold'
                                : 'text-slate-300'
                            }
                          >
                            Vence dia {formatDate(bill.current_due_date)}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{bill.status === 'open' ? 'Em aberto' : bill.status === 'paid' ? 'Pago' : 'Atrasado'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-sm sm:text-base font-black ${
                            bill.type === 'receivable' ? 'text-emerald-400' : 'text-white'
                          }`}
                        >
                          {data?.summary.isRestrictedView ? '•••' : formatBRL(bill.amount)}
                        </div>
                        {bill.barcode_or_pix && (
                          <button
                            onClick={() => handleCopy(bill.barcode_or_pix!)}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-bold mt-1"
                          >
                            {copiedCode === bill.barcode_or_pix ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar Linha</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco 2: Outros Vencimentos do Mês */}
            {otherMonthBills.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 sm:p-5 card-glow">
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                  Demais Vencimentos Agendados
                </h3>
                <div className="space-y-2">
                  {otherMonthBills.slice(0, 15).map((bill) => (
                    <div
                      key={bill.id}
                      className="bg-slate-900/70 border border-slate-800/70 rounded-2xl p-3 flex items-center justify-between text-xs hover:border-slate-700 transition"
                    >
                      <div>
                        <p className="font-semibold text-slate-200">{bill.counterparty_name}</p>
                        <p className="text-slate-500 mt-0.5">Vencimento em {formatDate(bill.current_due_date)}</p>
                      </div>
                      <div className="text-right font-black text-white">
                        {data?.summary.isRestrictedView ? '•••' : formatBRL(bill.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── TAB 2: FLUXO DE CAIXA ── */}
        {activeTab === 'fluxo' && (
          <section className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 card-glow">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Demonstrativo do Mês Atual</span>
              </h3>
              <p className="text-xs text-slate-400 mb-6">Valores consolidados no Livro Caixa</p>

              <div className="space-y-4">
                {/* Barra 1: Entradas */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      <ArrowDownRight className="w-3.5 h-3.5" /> Receitas Realizadas
                    </span>
                    <span className="text-white font-black">{formatBRL(data?.summary.realizedIncomeMonth || 0)}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            10,
                            ((data?.summary.realizedIncomeMonth || 0) /
                              Math.max(1, (data?.summary.realizedIncomeMonth || 0) + (data?.summary.realizedExpenseMonth || 0))) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Barra 2: Saídas */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-rose-400 flex items-center gap-1 font-bold">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Despesas Pagas
                    </span>
                    <span className="text-white font-black">{formatBRL(data?.summary.realizedExpenseMonth || 0)}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            10,
                            ((data?.summary.realizedExpenseMonth || 0) /
                              Math.max(1, (data?.summary.realizedIncomeMonth || 0) + (data?.summary.realizedExpenseMonth || 0))) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Saldo Resultante */}
              <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-semibold">Resultado Líquido do Caixa</span>
                  <p className="text-[11px] text-slate-500">Saldo apurado das movimentações</p>
                </div>
                <div
                  className={`text-lg md:text-xl font-black ${
                    (data?.summary.netBalanceMonth || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatBRL(data?.summary.netBalanceMonth || 0)}
                </div>
              </div>
            </div>

            {/* Dica do Consultor */}
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/20 rounded-3xl p-5 card-glow">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-slate-300">
                  <strong className="text-emerald-300 font-bold block mb-1">
                    Como alimentar este painel no piloto automático?
                  </strong>
                  Basta mandar fotos dos comprovantes e áudios no WhatsApp quando fizer compras ou vendas. O AnalisAí processa o OCR contábil e atualiza este gráfico na hora!
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── TAB 3: CATEGORIAS (DRE) ── */}
        {activeTab === 'categorias' && (
          <section className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 card-glow">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-emerald-400" />
                <span>Distribuição de Despesas por Categoria</span>
              </h3>
              <p className="text-xs text-slate-400 mb-5">Centro de custos para gestão e DRE contábil</p>

              {(!data?.categoriesChart || data.categoriesChart.length === 0) ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Nenhuma despesa categorizada no período atual.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {data.categoriesChart.map((cat, idx) => {
                    const totalVal = data.categoriesChart.reduce((a, b) => a + b.value, 0);
                    const pct = totalVal > 0 ? Math.round((cat.value / totalVal) * 100) : 0;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-200">{cat.name}</span>
                          <span className="text-slate-400">
                            {formatBRL(cat.value)} <strong className="text-slate-300 ml-1">({pct}%)</strong>
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── TAB 4: TERMÔMETRO TRIBUTÁRIO ── */}
        {activeTab === 'fiscal' && (
          <section className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 card-glow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Termômetro de Limite Fiscal</h3>
                </div>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                  {data?.taxMeter?.regime?.toUpperCase() || 'SIMPLES / MEI'}
                </span>
              </div>

              {data?.taxMeter ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-400">Consumo do Teto Anual:</span>
                      <span className="font-black text-amber-300">{data.taxMeter.percentage}% utilizado</span>
                    </div>
                    <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          data.taxMeter.status === 'perigo'
                            ? 'bg-rose-500'
                            : data.taxMeter.status === 'atencao'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, data.taxMeter.percentage)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Faturamento Apurado</span>
                      <strong className="text-sm font-black text-white">
                        {formatBRL(data.taxMeter.currentRevenue)}
                      </strong>
                    </div>
                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Teto Limite Anual</span>
                      <strong className="text-sm font-black text-slate-300">
                        {formatBRL(data.taxMeter.annualLimit)}
                      </strong>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-300 font-semibold">Margem de Segurança Restante</span>
                      <p className="text-[11px] text-slate-500">Espaço para faturar sem desenquadramento</p>
                    </div>
                    <span className="text-sm sm:text-base font-black text-emerald-400">
                      {formatBRL(data.taxMeter.remainingSafetyMargin)}
                    </span>
                  </div>

                  {data.taxMeter.warningMessage && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{data.taxMeter.warningMessage}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <p>Cadastre seu CNPJ no AnalisAí para habilitar o monitoramento fiscal contínuo.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ── BARRA FIXA INFERIOR DE AÇÕES RÁPIDAS NO PADRÃO LANDING (MOBILE BOTTOM BAR) ── */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-800/80 p-3 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
          <a
            href="https://wa.me/5513920099874"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-400/25 transition active:scale-95 text-xs sm:text-sm"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950 stroke-none" />
            <span>Lançar no WhatsApp</span>
          </a>

          <a
            href="https://wa.me/5513920099874?text=relatorio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-3.5 px-4 bg-slate-900/90 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-600 rounded-2xl text-xs font-bold transition active:scale-95 shadow-sm"
            title="Solicitar relatório em PDF no WhatsApp"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Gerar PDF</span>
          </a>
        </div>
      </nav>

      {/* ── MODAL INSTRUÇÕES IOS PWA ── */}
      {showIosInstallModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-400/20">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Como Instalar no seu Celular</h3>
            <div className="text-xs text-slate-300 text-left space-y-2.5 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <p>
                <strong>No iPhone (Safari):</strong>
                <br />1. Toque no botão de <strong>Compartilhar</strong> (ícone com quadrado e seta para cima).
                <br />2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
              </p>
              <p>
                <strong>No Android (Chrome):</strong>
                <br />1. Toque nos <strong>três pontinhos</strong> no topo do navegador.
                <br />2. Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
              </p>
            </div>
            <button
              onClick={() => setShowIosInstallModal(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
