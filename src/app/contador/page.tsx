'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, ShieldCheck, ArrowRight, FileSpreadsheet, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

export default function ContadorLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/contador/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível validar o acesso.');
      }

      // Salva no localStorage para persistência de navegação no client
      if (typeof window !== 'undefined') {
        localStorage.setItem('analisai_office_id', data.office.id);
        localStorage.setItem('analisai_office_name', data.office.name);
      }

      router.push(`/contador/dashboard?office_id=${encodeURIComponent(data.office.id)}`);
    } catch (err: any) {
      setError(err?.message || 'Erro ao conectar com o portal.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDemo = () => {
    setIdentifier('contato@escritoriomodelo.com.br');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Header Simples */}
      <header className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20 text-xs">
            A
          </div>
          <span className="font-bold text-white text-base tracking-tight">AnalisAí.me</span>
        </Link>

        <Link
          href="/parceiros"
          className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1"
        >
          <span>Conhecer o Programa de Parcerias</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Hero e Form de Login */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Luz sutil de fundo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Badges de Autoridade */}
          <div className="flex items-center gap-2 mb-6">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Portal do Contador Parceiro
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              BPO Financeiro
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Acesso Corporativo do Escritório
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mb-8 leading-relaxed">
            Consulte a carteira de clientes atendidos pelo BPO, baixe pacotes fiscais mensais consolidados em ZIP e acompanhe suas comissões recorrentes.
          </p>

          {/* Alerta de Erro */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <p className="flex-1 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Formulário de Acesso Sem Senhas Complexas */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                E-mail ou WhatsApp do Escritório
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: contato@escritorio.com.br ou (11) 98765-4321"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Utilize o mesmo e-mail ou WhatsApp cadastrado no termo de parceria contábil.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'Validando acesso...' : 'Acessar Painel do Escritório'}</span>
            </button>
          </form>

          {/* Sugestão Rápida para Demonstração */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>Deseja testar com o escritório modelo?</span>
            <button
              type="button"
              onClick={handleUseDemo}
              className="text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              Preencher dados de teste
            </button>
          </div>
        </div>
      </main>

      {/* Footer Simples */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600">
        AnalisAí BPO Financeiro & Controladoria Terceirizada • Segurança de Dados & LGPD
      </footer>
    </div>
  );
}

