'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Clock, Mail, ArrowRight, Shield } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function SucessoContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center px-4 py-16">

      {/* Círculo de sucesso animado */}
      <div className={`transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>
          {/* Glow */}
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl" />
        </div>
      </div>

      <div className={`max-w-lg w-full text-center transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <Link href="/" className="inline-block mb-8 opacity-70 hover:opacity-100 transition-opacity">
          <Image src="/logo.png" alt="AnalisAI.me" width={140} height={40} className="h-8 w-auto mx-auto" />
        </Link>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
          Pagamento confirmado! 🎉
        </h1>
        <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-10">
          Seu diagnóstico financeiro está em andamento. Você receberá o formulário por{' '}
          <span className="text-white font-medium">e-mail ou WhatsApp</span> em instantes.
        </p>

        {/* Próximos passos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-left space-y-5 mb-8">
          <p className="text-slate-300 font-semibold text-sm uppercase tracking-wider mb-1">O que acontece agora:</p>

          {[
            {
              icon: <Mail className="w-5 h-5 text-amber-400 flex-shrink-0" />,
              titulo: 'Formulário no seu e-mail',
              desc: 'Você vai receber um link com o formulário simples para preencher os dados do seu negócio.',
            },
            {
              icon: <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />,
              titulo: 'Análise em até 72h',
              desc: 'Após enviar o formulário preenchido, entregamos o relatório PDF em até 72 horas.',
            },
            {
              icon: <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
              titulo: 'Dados protegidos',
              desc: 'Suas informações são usadas exclusivamente para gerar seu diagnóstico.',
            },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-slate-800/80 mt-0.5">{item.icon}</div>
              <div>
                <p className="text-white font-semibold text-sm">{item.titulo}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ID da sessão (debug discreto) */}
        {sessionId && (
          <p className="text-slate-600 text-xs mb-6 font-mono">
            Ref: {sessionId.slice(0, 24)}…
          </p>
        )}

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-400 transition-colors text-sm font-medium"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Voltar para o site
        </Link>
      </div>
    </div>
  );
}

export default function DiagnosticoSucesso() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>}>
      <SucessoContent />
    </Suspense>
  );
}
