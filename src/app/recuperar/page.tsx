'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldCheck, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

function RecuperarEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const erro = searchParams.get('erro');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (erro) {
      setErrorMessage('Este link de recuperação expirou ou já foi utilizado. Solicite um novo link pelo WhatsApp.');
    } else if (!token) {
      setErrorMessage('Link incompleto ou inválido. Inicie a recuperação digitando !recuperaremail no WhatsApp do AnalisAí.');
    }
  }, [token, erro]);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    if (!token) return;
    setLoading(true);
    setErrorMessage('');

    try {
      const redirectUrl = `${window.location.origin}/api/auth/callback?token=${encodeURIComponent(token)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao iniciar autenticação.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-4 text-emerald-400 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Validação de Titularidade
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Prova Social de Segurança via Supabase Auth
          </p>
        </div>

        {errorMessage ? (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 mb-6 text-red-200 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Atenção</p>
              <p className="text-xs text-red-200/80 mt-1">{errorMessage}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-6 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Proteção Criptográfica Ativa</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Para impedir que pessoas não autorizadas assumam sua conta, confirme que você é o titular legítimo conectando-se à sua conta Google ou Apple pessoal.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={loading || !token}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-xl transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                {loading ? 'Conectando ao Google...' : 'Continuar com Google'}
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('apple')}
                disabled={loading || !token}
                className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-750 text-white font-semibold py-3 px-4 rounded-xl border border-slate-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12.01-14.42-6.53-9.98-11.66-21.72-15.4-35.22-3.74-13.5-5.61-26.06-5.61-37.69 0-14.54 3.73-26.47 11.19-35.79 7.46-9.32 16.71-14.07 27.75-14.26 5.86 0 12.39 1.63 19.59 4.89 7.2 3.26 11.83 4.95 13.88 5.06 1.63 0 6.53-1.8 14.7-5.4 8.17-3.6 15.02-5.18 20.57-4.75 15.35 1.19 27.24 6.88 35.66 17.07-13.72 8.38-20.47 19.8-20.26 34.26.22 11.33 4.41 20.89 12.57 28.69 8.16 7.8 17.84 12.39 29.04 13.78-2.61 7.85-5.99 15.93-10.14 24.23zM119.22 31.84c0-7.39 2.72-14.42 8.16-21.09 5.44-6.67 12.19-10.75 20.24-12.25.11 1.09.16 2.07.16 2.94 0 7.39-2.88 14.59-8.65 21.59-5.76 7.01-12.79 11.23-21.09 12.67-.44-1.3-.82-2.58-1.12-3.86z" />
                </svg>
                {loading ? 'Conectando à Apple...' : 'Continuar com Apple'}
              </button>
            </div>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Ambiente seguro com criptografia de ponta a ponta. Solucione & AnalisAI.me
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RecuperarEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Carregando verificação...</p>
      </div>
    }>
      <RecuperarEmailContent />
    </Suspense>
  );
}
