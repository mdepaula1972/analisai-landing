'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Mic, MicOff, Send, Volume2, VolumeX, Sparkles,
  CheckCircle2, ArrowRight, Clock, ShieldCheck,
  FileText, MessageCircle, RefreshCw, BarChart3,
  HelpCircle, ChevronRight, Check, AlertCircle, FlaskConical
} from 'lucide-react';

interface Mensagem {
  role: 'user' | 'model';
  content: string | any;
}

interface ResumoFinanceiro {
  ramo_atividade?: string;
  faturamento_mensal_estimado?: number;
  custos_fixos_estimados?: number;
  custos_variaveis_estimados?: number;
  principais_gargalos?: string[];
  cenarios_solicitados?: string[];
}

/* ── CONFIGURAÇÃO ── */
const VERSION = 'v1.6 · 22/08/2026 - 18:05';

function ColetaVoiceContent() {
  const searchParams = useSearchParams();
  const pedidoId = searchParams.get('pedido_id');
  const nomeParam = searchParams.get('nome') || '';
  const emailParam = searchParams.get('email') || '';
  const whatsappParam = searchParams.get('whatsapp') || '';

  // Estados principais
  const [coletaId, setColetaId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [assistenteFala, setAssistenteFala] = useState(
    `Olá ${nomeParam ? nomeParam.split(' ')[0] : ''}! Sou seu Consultor Financeiro aqui na AnalisAí. Estou aqui para entender o seu negócio de verdade, sem jargões e sem formulários chatos. Para a gente começar: me conta, qual é a sua atividade e como sua empresa funciona no dia a dia?`
  );
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [finalizado, setFinalizado] = useState(false);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);
  const [resumo, setResumo] = useState<ResumoFinanceiro>({});

  // Estados de voz e input
  const [gravando, setGravando] = useState(false);
  const [transcricaoAoVivo, setTranscricaoAoVivo] = useState('');
  const [textoInput, setTextoInput] = useState('');
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [audioAtivado, setAudioAtivado] = useState(true);
  const [modoTexto, setModoTexto] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Inicializa síntese de voz (TTS) e Reconhecimento de fala (STT)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'pt-BR';

        rec.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const text = final || interim;
          setTranscricaoAoVivo(text);
          setTextoInput(text);
        };

        rec.onerror = (event: any) => {
          console.warn('[Voice STT] Erro no reconhecimento:', event.error);
          setGravando(false);
        };

        rec.onend = () => {
          setGravando(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  function falarTexto(texto: string) {
    if (!audioAtivado || typeof window === 'undefined' || !synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    synthRef.current.speak(utterance);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      falarTexto(assistenteFala);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  function toggleGravacao() {
    if (!recognitionRef.current) {
      alert('Seu navegador não suporta reconhecimento de voz direto. Você pode usar o campo de texto!');
      setModoTexto(true);
      return;
    }

    if (gravando) {
      recognitionRef.current.stop();
      setGravando(false);
      if (textoInput.trim()) {
        enviarResposta(textoInput);
      }
    } else {
      if (synthRef.current) synthRef.current.cancel();
      setTranscricaoAoVivo('');
      setTextoInput('');
      try {
        recognitionRef.current.start();
        setGravando(true);
      } catch (err) {
        console.error('Erro ao iniciar reconhecimento:', err);
      }
    }
  }

  async function enviarResposta(mensagemTexto: string) {
    if (!mensagemTexto.trim() || carregandoIA) return;

    if (recognitionRef.current && gravando) {
      recognitionRef.current.stop();
      setGravando(false);
    }

    const novaMensagemUsuario = mensagemTexto.trim();
    setTextoInput('');
    setTranscricaoAoVivo('');
    setCarregandoIA(true);

    const novoHistorico: Mensagem[] = [
      ...historico,
      { role: 'user', content: novaMensagemUsuario },
    ];
    setHistorico(novoHistorico);

    try {
      const res = await fetch('/api/diagnostico/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coleta_id: coletaId,
          pedido_id: pedidoId,
          historico: novoHistorico,
          nova_mensagem: novaMensagemUsuario,
          cliente_info: {
            nome: nomeParam,
            email: emailParam,
            whatsapp: whatsappParam,
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.coleta_id) setColetaId(data.coleta_id);
        if (data.mensagem) {
          setAssistenteFala(data.mensagem);
          falarTexto(data.mensagem);
        }
        if (data.etapa_atual) setEtapaAtual(data.etapa_atual);
        if (data.resumo_extracao) setResumo(data.resumo_extracao);
        if (data.aguardando_confirmacao) setAguardandoConfirmacao(true);
        if (data.finalizado) {
          setFinalizado(true);
          setAguardandoConfirmacao(false);
        }

        setHistorico([
          ...novoHistorico,
          { role: 'model', content: data.mensagem },
        ]);
      } else {
        alert(data.error || 'Erro ao processar fala.');
      }
    } catch {
      alert('Erro de conexão ao enviar sua mensagem.');
    } finally {
      setCarregandoIA(false);
    }
  }

  const etapas = [
    { num: 1, label: 'Modelo & Operação' },
    { num: 2, label: 'Faturamento' },
    { num: 3, label: 'Custos & Gastos' },
    { num: 4, label: 'Gargalos & Objetivos' },
    { num: 5, label: 'Confirmação do Diagnóstico' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden">
      
      {/* ── BADGE DE VERSÃO FIXO ── */}
      <div className="fixed bottom-3 left-3 z-50 flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/40 bg-slate-950/95 backdrop-blur-md text-amber-400 text-[10px] font-bold font-mono shadow-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Sala de Voz {VERSION}
      </div>

      {/* Backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_20%,rgba(245,158,11,0.12),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-grid-amber opacity-20 pointer-events-none" />

      {/* ── HEADER COM LOGO DESTACADO ── */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-4 sm:px-8 py-3.5 shadow-lg shadow-black/20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo com presença e destaque */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-amber-500/40 transition-colors shadow-md">
              <Image
                src="/logo.png"
                alt="AnalisAI.me — Inteligência Financeira"
                width={180}
                height={48}
                className="h-10 sm:h-12 w-auto object-contain"
                priority
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-black tracking-wider text-white">AnalisAI.me</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Sala de Voz · Consultoria Financeira
              </span>
            </div>
          </Link>

          {/* Controles do Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                if (audioAtivado && synthRef.current) synthRef.current.cancel();
                setAudioAtivado(!audioAtivado);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/80 transition-colors cursor-pointer"
            >
              {audioAtivado ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              <span className="hidden sm:inline">{audioAtivado ? 'Voz Ativa' : 'Mudo'}</span>
            </button>

            <Link
              href="/"
              className="text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1.5"
            >
              Sair
            </Link>
          </div>
        </div>
      </header>

      {/* ── BANNER DE GARANTIA E REANÁLISES ── */}
      <div className="relative z-10 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span><strong>Garantia AnalisAí:</strong> Você tem direito a <strong>2 reanálises gratuitas</strong> após a entrega do relatório para refinar dados ou novos cenários.</span>
      </div>

      {/* ── CORPO PRINCIPAL ── */}
      <main className="relative z-10 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col justify-center items-center">

        {!finalizado ? (
          <div className="w-full flex flex-col items-center text-center space-y-5">

            {/* Barra de Progresso das Etapas */}
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Etapa {etapaAtual} de 5
                </span>
                <span>{etapas[Math.min(etapaAtual - 1, 4)]?.label}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(etapaAtual * 20, 100)}%` }}
                />
              </div>
            </div>

            {/* Balão de Fala da Assistente IA */}
            <div className="relative w-full rounded-3xl border border-amber-500/30 bg-slate-900/90 p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-left">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    Especialista Financeira AnalisAí
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">40 anos de gestão</span>
              </div>

              <p className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
                {assistenteFala}
              </p>

              {/* Transcrição ao vivo */}
              {transcricaoAoVivo && (
                <div className="mt-4 pt-4 border-t border-slate-800 text-sm text-amber-300 italic">
                  &ldquo;{transcricaoAoVivo}&rdquo;
                </div>
              )}
            </div>

            {/* Raio-X dos Dados Coletados em Tempo Real */}
            {(resumo.faturamento_mensal_estimado || resumo.custos_fixos_estimados || resumo.ramo_atividade) && (
              <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-left grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {resumo.ramo_atividade && (
                  <div className="p-2 rounded-lg bg-slate-950/60">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Ramo:</span>
                    <span className="text-slate-200 font-semibold">{resumo.ramo_atividade}</span>
                  </div>
                )}
                {resumo.faturamento_mensal_estimado ? (
                  <div className="p-2 rounded-lg bg-slate-950/60">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Faturamento Estimado:</span>
                    <span className="text-emerald-400 font-bold">R$ {resumo.faturamento_mensal_estimado.toLocaleString('pt-BR')}</span>
                  </div>
                ) : null}
                {resumo.custos_fixos_estimados ? (
                  <div className="p-2 rounded-lg bg-slate-950/60">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Custos Fixos:</span>
                    <span className="text-amber-400 font-bold">R$ {resumo.custos_fixos_estimados.toLocaleString('pt-BR')}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── BOTÕES DE CONFIRMAÇÃO EXPLICITA ── */}
            {aguardandoConfirmacao ? (
              <div className="w-full max-w-md p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-3">
                <p className="text-xs text-slate-300 font-medium">
                  Os números acima estão corretos para gerar seu relatório?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => enviarResposta('Sim, os dados estão corretos, pode gerar o diagnóstico!')}
                    disabled={carregandoIA}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Confirmar Dados
                  </button>
                  <button
                    onClick={() => {
                      setModoTexto(true);
                      setTextoInput('Gostaria de ajustar o valor de ');
                    }}
                    className="flex-1 border border-slate-700 hover:border-slate-600 text-slate-300 py-3 px-4 rounded-xl text-xs font-semibold"
                  >
                    Ajustar um número
                  </button>
                </div>
              </div>
            ) : null}

            {/* ── CONTROLE CENTRAL DE VOZ (MICROFONE) ── */}
            <div className="flex flex-col items-center gap-3 pt-2">
              
              {/* Botão Microfone com Ondas */}
              <div className="relative">
                {gravando && (
                  <>
                    <div className="absolute -inset-4 rounded-full bg-red-500/20 animate-ping" />
                    <div className="absolute -inset-8 rounded-full bg-red-500/10 animate-pulse" />
                  </>
                )}

                <button
                  onClick={toggleGravacao}
                  disabled={carregandoIA}
                  className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer ${
                    gravando
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/50 scale-110'
                      : carregandoIA
                      ? 'bg-slate-800 text-slate-500 cursor-wait'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/40 hover:scale-105 animate-pulse-glow-amber'
                  }`}
                  aria-label={gravando ? 'Parar e Enviar' : 'Tocar para Falar'}
                >
                  {carregandoIA ? (
                    <RefreshCw className="w-10 h-10 animate-spin text-amber-400" />
                  ) : gravando ? (
                    <>
                      <MicOff className="w-10 h-10 animate-bounce" />
                      <span className="text-[10px] font-extrabold uppercase mt-1">Parar</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-10 h-10" />
                      <span className="text-[10px] font-extrabold uppercase mt-1">Falar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status e Dica */}
              <p className="text-xs sm:text-sm font-medium text-slate-400">
                {carregandoIA
                  ? 'Processando com inteligência financeira...'
                  : gravando
                  ? '🔴 Ouvindo você... Toque novamente quando terminar de falar.'
                  : '👉 Toque no microfone e responda falando naturalmente.'}
              </p>

              {/* Alternar para modo texto / digitação */}
              <button
                onClick={() => setModoTexto(!modoTexto)}
                className="text-xs text-slate-500 hover:text-amber-400 underline transition-colors"
              >
                {modoTexto ? 'Ocultar teclado' : 'Prefere digitar? Clique aqui'}
              </button>

              {/* Campo de Texto Alternativo */}
              {modoTexto && (
                <div className="w-full max-w-lg flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Digite sua resposta aqui..."
                    value={textoInput}
                    onChange={(e) => setTextoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') enviarResposta(textoInput);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => enviarResposta(textoInput)}
                    disabled={!textoInput.trim() || carregandoIA}
                    className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ── TELA DE SUCESSO / FICHA COLETADA ── */
          <div className="w-full max-w-xl text-center space-y-6 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              Entrevista e Dados Confirmados! 🎉
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Todos os dados do seu negócio foram mapeados com precisão. Nosso motor financeiro já iniciou a elaboração do seu diagnóstico.
            </p>

            {/* Resumo da Ficha Financeira Extraída */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-left space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> Ficha Inicial Sintetizada
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block">Ramo:</span>
                  <span className="text-white font-bold">{resumo.ramo_atividade || 'Mapeado'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block">Faturamento Médio:</span>
                  <span className="text-emerald-400 font-bold">
                    {resumo.faturamento_mensal_estimado ? `R$ ${resumo.faturamento_mensal_estimado.toLocaleString('pt-BR')}` : 'Mapeado'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1">Gargalos e Focos Mapeados:</span>
                <span className="text-slate-200">
                  {resumo.principais_gargalos?.length ? resumo.principais_gargalos.join(', ') : 'Estruturação de caixa, DRE gerencial e cenários simulados.'}
                </span>
              </div>
            </div>

            {/* Garantia das 2 Reanálises */}
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-slate-300 text-left space-y-2">
              <p className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Entrega em até 72h + 2 Reanálises Inclusas
              </p>
              <p>
                Você receberá o seu <strong>Relatório Executivo em PDF</strong> por e-mail e WhatsApp. Caso queira refinar qualquer número ou simular novos cenários após a leitura, você tem direito a <strong>2 reanálises gratuitas</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="https://wa.me/5514930855878?text=Ol%C3%A1!%20Acabei%20de%20concluir%20a%20minha%20entrevista%20por%20voz%20do%20Diagn%C3%B3stico%20Financeiro."
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3.5 px-6 rounded-xl transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Falar com a equipe no WhatsApp
              </a>

              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white transition-colors text-sm font-semibold"
              >
                Voltar ao site
              </Link>
            </div>
          </div>
        )}

      </main>

      {/* ── FOOTER DISCRETO ── */}
      <footer className="relative z-10 border-t border-slate-900 px-4 py-4 text-center text-xs text-slate-500">
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Seus dados de áudio e informações financeiras são confidenciais e protegidos pela LGPD.
        </p>
      </footer>
    </div>
  );
}

export default function DiagnosticoColetaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando Sala de Voz...</div>}>
      <ColetaVoiceContent />
    </Suspense>
  );
}

