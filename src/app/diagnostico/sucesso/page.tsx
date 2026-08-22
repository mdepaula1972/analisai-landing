'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Clock, Mail, ArrowRight, Shield, MessageCircle, Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

/* ── CONFIGURAÇÃO ── */
const VERSION = 'v2.0 · 22/08/2026 - 18:40';
const PHONE_NUMBER = '5514930855878';
const WA_SUCESSO_LINK = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent('Olá! Acabei de contratar o Diagnóstico Financeiro (R$ 197) e gostaria de confirmar meus dados e receber o formulário.')}`;

function SucessoContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [visible, setVisible] = useState(false);

  const pedidoId = searchParams.get('pedido_id') || '';
  const nome = searchParams.get('nome') || '';
  const email = searchParams.get('email') || '';
  const whatsapp = searchParams.get('whatsapp') || '';

  const voiceParams = new URLSearchParams({
    pedido_id: pedidoId,
    nome,
    email,
    whatsapp,
  });

  const LINK_COLETA_VOZ = `/diagnostico/coleta?${voiceParams.toString()}`;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center px-4 py-16 relative">

      {/* ── BADGE DE VERSÃO FIXO ── */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-500/40 bg-slate-950/95 backdrop-blur-md text-amber-400 text-[11px] font-bold font-mono shadow-2xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Sucesso {VERSION}
      </div>

      {/* Círculo de sucesso animado */}
      <div className={`transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl" />
        </div>
      </div>

      <div className={`max-w-lg w-full text-center transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

        {/* Logo de Destaque */}
        <Link href="/" className="inline-flex items-center gap-3 p-2 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 shadow-xl mb-6 transition-all group">
          <Image src="/logo.png" alt="AnalisAI.me" width={180} height={50} className="h-10 sm:h-12 w-auto mx-auto object-contain" />
          <div className="text-left hidden sm:block pr-2">
            <span className="text-xs font-black text-white block">AnalisAI.me</span>
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Inteligência Financeira</span>
          </div>
        </Link>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
          Pagamento Registrado com Sucesso
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
          Tudo pronto{nome ? `, ${nome.split(' ')[0]}` : ''}! 🎉
        </h1>
        <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
          Sem formulários burocráticos. Você só precisa <span className="text-amber-400 font-semibold">falar por 3 minutos</span> com nossa especialista por voz.
        </p>

        {/* CTA PRINCIPAL: SALA DE VOZ */}
        <div className="mb-6 space-y-3">
          <Link
            href={LINK_COLETA_VOZ}
            className="w-full inline-flex items-center justify-center gap-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-4 px-6 rounded-2xl shadow-2xl shadow-amber-500/30 text-base sm:text-lg transition-all hover:scale-[1.03] animate-pulse-glow-amber"
          >
            <Sparkles className="w-5 h-5" />
            Iniciar Entrevista por Voz Agora (3 min)
            <ArrowRight className="w-5 h-5" />
          </Link>

          <a
            href={WA_SUCESSO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-semibold py-3 px-4 rounded-xl text-xs transition-all"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            Prefere responder pelo WhatsApp? Clique aqui
          </a>
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
