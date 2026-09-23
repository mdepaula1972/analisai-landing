'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';

function RecuperarSucessoContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const provider = searchParams.get('provider') || 'social';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden text-center">
        <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-4 text-emerald-400 shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Identidade Confirmada!
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Sua titularidade foi verificada com sucesso via Prova Social ({provider.toUpperCase()}).
        </p>

        {email && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-6 text-left">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1">
              Novo E-mail de Segurança
            </span>
            <span className="text-sm font-mono text-emerald-400 font-bold break-all">
              {email}
            </span>
          </div>
        )}

        <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 mb-6 text-xs text-amber-300/90 text-left flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Quarentena Preventiva de 24h:</strong> Para sua total proteção, alterações de chave Pix para terceiros ficam suspensas por 24 horas.
          </span>
        </div>

        <p className="text-xs text-slate-500 mb-6">
          Você já pode fechar esta página e retornar ao WhatsApp do AnalisAí.
        </p>

        <a
          href="https://wa.me/551331500987"
          className="inline-flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 shadow-lg text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para o WhatsApp</span>
        </a>
      </div>
    </div>
  );
}

export default function RecuperarSucessoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Carregando confirmação...</p>
      </div>
    }>
      <RecuperarSucessoContent />
    </Suspense>
  );
}
