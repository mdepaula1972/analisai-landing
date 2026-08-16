'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PlanoTenant, PLANO_LABELS } from '@/types/tenant';
import {
  Building2, Mail, Lock, Eye, EyeOff, ArrowRight,
  Loader2, ShieldCheck, CheckCircle2, UserCheck
} from 'lucide-react';

function RegistroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planoParam = (searchParams.get('plano') as PlanoTenant) || 'essencial';

  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [plano, setPlano] = useState<PlanoTenant>(planoParam);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/portal');
    });
  }, []);

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Não foi possível criar o usuário.');

      // 2. Gerar slug limpo para o tenant
      const baseSlug = razaoSocial
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      // 3. Criar o tenant (empresa)
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({
          slug,
          razao_social: razaoSocial,
          nome_fantasia: razaoSocial,
          cnpj: cnpj || null,
          plano,
          ativo: true,
        })
        .select()
        .single();

      if (tenantErr) throw tenantErr;

      // 4. Vincular usuário como 'gestor' da empresa
      const { error: tuErr } = await supabase
        .from('tenant_users')
        .insert({
          tenant_id: tenant.id,
          user_id: authData.user.id,
          role: 'gestor',
        });

      if (tuErr) throw tuErr;

      // 5. Inicializar créditos do plano
      await supabase.rpc('init_tenant_creditos', {
        p_tenant_id: tenant.id,
        p_plano: plano,
      });

      // 6. Sucesso -> redirecionar ao portal
      router.replace('/portal');
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      setErro(
        err.message?.includes('User already registered')
          ? 'Este e-mail já está cadastrado. Faça login.'
          : err.message || 'Erro ao criar conta. Tente novamente.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.12),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_80%,rgba(16,185,129,0.06),transparent)] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo + Tag Versão */}
        <div className="flex flex-col items-center mb-6">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="AnalisAI.me"
              width={200}
              height={55}
              className="h-12 w-auto object-contain"
            />
          </Link>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md mt-1">
            v2.5.0 · BPO Multi-tenant
          </span>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-black/50">
          
          {/* Abas Login / Registro */}
          <div className="flex bg-slate-950 p-1 rounded-2xl mb-8 border border-slate-800">
            <Link
              href="/login"
              className="flex-1 text-center py-2.5 text-xs font-extrabold text-slate-400 hover:text-white rounded-xl transition-all"
            >
              Já tenho conta (Login)
            </Link>
            <button
              type="button"
              className="flex-1 text-center py-2.5 text-xs font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-xl shadow-sm transition-all"
            >
              Cadastrar Empresa
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-6 h-6 text-amber-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-1">Cadastrar Nova Empresa</h1>
            <p className="text-slate-400 text-sm">Crie seu acesso ao Portal BPO do AnalisAI.me</p>
          </div>

          <form onSubmit={handleRegistro} className="space-y-4">
            {/* Razão Social */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nome da Empresa / Razão Social *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={razaoSocial}
                  onChange={e => setRazaoSocial(e.target.value)}
                  placeholder="Minha Empresa Ltda"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none transition-colors text-sm"
                />
              </div>
            </div>

            {/* CNPJ */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                CNPJ (Opcional)
              </label>
              <input
                type="text"
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none transition-colors text-sm"
              />
            </div>

            {/* Escolha de Plano */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Plano Escolhido *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['essencial', 'gestao', 'estrategico'] as PlanoTenant[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlano(p)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      plano === p
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 ring-1 ring-amber-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {PLANO_LABELS[p].replace('Plano ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                E-mail do Responsável *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com.br"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none transition-colors text-sm"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Senha (mínimo 6 caracteres) *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-12 py-3 text-white placeholder:text-slate-600 focus:outline-none transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 text-sm flex items-center justify-center gap-2 group mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Criar Conta e Acessar Portal
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Segurança */}
          <div className="mt-6 pt-6 border-t border-slate-800 flex items-center gap-2 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-slate-500">
              Conexão segura · Isolamento RLS por empresa
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    }>
      <RegistroForm />
    </Suspense>
  );
}
