'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Clock, Mail, ArrowRight, Shield, MessageCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const PHONE_NUMBER = '5514930855878';
const WA_SUCESSO_LINK = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Acabei de contratar o Diagnóstico Financeiro (R$ 197) e gostaria de confirmar meus dados e receber o formulário.')}`;

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
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl" />
        </div>
      </div>

      <div className={`max-w-lg w-full text-center transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <Link href="/" className="inline-block mb-8 opacity-70 hover:opacity-100 transition-opacity">
          <Image src="/logo.png" alt="AnalisAI.me" width={140} height={40} className="h-8 w-auto mx-auto" />
        </Link>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
          Pedido Registrado com Sucesso
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
          Tudo pronto! 🎉
        </h1>
        <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
          Recebemos as informações do seu <span className="text-amber-400 font-semibold">Diagnóstico Financeiro</span>.
        </p>

        {/* Botão de Ação Rápida: WhatsApp */}
        <div className="mb-8">
          <a
            href={WA_SUCESSO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-4 px-6 rounded-2xl shadow-xl shadow-emerald-500/25 text-base transition-all hover:scale-[1.02]"
          >
            <MessageCircle className="w-5 h-5 fill-slate-950 stroke-none" />
            Falar agora no WhatsApp para agilizar o início
          </a>
          <p className="text-xs text-slate-500 mt-2">
            Nossa equipe já está de prontidão para enviar o seu formulário.
          </p>
        </div>

        {/* Próximos passos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-left space-y-4 mb-8">
          <p className="text-slate-300 font-bold text-xs uppercase tracking-wider mb-1">O que acontece agora:</p>

          {[
            {
              icon: <Mail className="w-5 h-5 text-amber-400 flex-shrink-0" />,
              titulo: '1. Envio do Formulário',
              desc: 'Você receberá o link do formulário simples (sem termos técnicos) para preencher os números do seu negócio.',
            },
            {
              icon: <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />,
              titulo: '2. Análise em até 72h',
              desc: 'Após preencher o formulário, processamos seus dados e geramos os cenários de simulação.',
            },
            {
              icon: <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
              titulo: '3. Entrega do Relatório PDF',
              desc: 'Você recebe o relatório direto no seu e-mail e WhatsApp, claro e pronto para tomar decisões.',
            },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-slate-800/80 mt-0.5">{item.icon}</div>
              <div>
                <p className="text-white font-semibold text-sm">{item.titulo}</p>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ID da sessão (quando via Stripe) */}
        {sessionId && (
          <p className="text-slate-600 text-xs mb-6 font-mono">
            Ref Stripe: {sessionId.slice(0, 24)}…
          </p>
        )}

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-400 transition-colors text-sm font-medium"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Voltar para a página inicial
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
