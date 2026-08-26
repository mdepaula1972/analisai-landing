'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Mic, MicOff, Send, CheckCircle2, Clock,
  ShieldCheck, FileText, ArrowRight, MessageCircle,
  Building2, DollarSign, PieChart, Sparkles, HelpCircle,
  AlertCircle, ChevronRight, Lock
} from 'lucide-react';

/* ── CONFIGURAÇÃO ── */
const VERSION = 'v4.0 · Coleta Oficial';
const WHATSAPP_OFICIAL = '551331500987';

function ColetaFormContent() {
  const searchParams = useSearchParams();
  const pedidoIdParam = searchParams.get('pedido_id') || '';
  const nomeParam = searchParams.get('nome') || '';
  const emailParam = searchParams.get('email') || '';
  const whatsappParam = searchParams.get('whatsapp') || '';

  // Estados do formulário
  const [nomeNegocio, setNomeNegocio] = useState(nomeParam);
  const [setor, setSetor] = useState('');
  const [faturamentoMedio, setFaturamentoMedio] = useState('');
  const [custosFixos, setCustosFixos] = useState('');
  const [custosVariaveis, setCustosVariaveis] = useState('');
  const [dividasParcelamentos, setDividasParcelamentos] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [whatsapp, setWhatsapp] = useState(whatsappParam);

  // Estados de controle
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  // Reconhecimento de Voz (Web Speech API)
  const [campoAtivoVoz, setCampoAtivoVoz] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'pt-BR';

        rec.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
          }
          if (text) {
            aplicarTranscricao(text);
          }
        };

        rec.onerror = (event: any) => {
          console.warn('[Web Speech API] Erro no reconhecimento:', event.error);
          setGravando(false);
          setCampoAtivoVoz(null);
        };

        rec.onend = () => {
          setGravando(false);
          setCampoAtivoVoz(null);
        };

        recognitionRef.current = rec;
      }
    }
  }, [campoAtivoVoz]);

  function aplicarTranscricao(texto: string) {
    if (!campoAtivoVoz) return;
    switch (campoAtivoVoz) {
      case 'nomeNegocio':
        setNomeNegocio((prev) => (prev ? `${prev} ${texto}` : texto));
        break;
      case 'setor':
        setSetor((prev) => (prev ? `${prev} ${texto}` : texto));
        break;
      case 'faturamentoMedio':
        setFaturamentoMedio(texto.replace(/[^\d.,]/g, ''));
        break;
      case 'custosFixos':
        setCustosFixos(texto.replace(/[^\d.,]/g, ''));
        break;
      case 'custosVariaveis':
        setCustosVariaveis(texto.replace(/[^\d.,]/g, ''));
        break;
      case 'dividasParcelamentos':
        setDividasParcelamentos((prev) => (prev ? `${prev} ${texto}` : texto));
        break;
      case 'email':
        setEmail(texto.toLowerCase().replace(/\s+/g, ''));
        break;
      case 'whatsapp':
        setWhatsapp(texto.replace(/[^\d]/g, ''));
        break;
      default:
        break;
    }
  }

  function toggleVozParaCampo(campo: string) {
    if (!recognitionRef.current) {
      alert('Seu navegador não suporta reconhecimento de voz nativo. Você pode digitar diretamente no campo.');
      return;
    }

    if (gravando && campoAtivoVoz === campo) {
      recognitionRef.current.stop();
      setGravando(false);
      setCampoAtivoVoz(null);
    } else {
      if (gravando) {
        recognitionRef.current.stop();
      }
      setCampoAtivoVoz(campo);
      setGravando(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Erro ao iniciar reconhecimento de voz:', err);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeNegocio.trim() || !email.trim() || !whatsapp.trim()) {
      setErro('Por favor, preencha o nome da sua empresa, e-mail e WhatsApp.');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      const res = await fetch('/api/diagnostico/salvar-coleta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedidoIdParam || null,
          nome_negocio: nomeNegocio,
          setor,
          faturamento_medio: faturamentoMedio,
          custos_fixos: custosFixos,
          custos_variaveis: custosVariaveis,
          dividas_parcelamentos: dividasParcelamentos,
          email,
          whatsapp,
          origem_preenchimento: 'sala_de_coleta_v4',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Dispara eventos de rastreamento (Meta Pixel e Google Analytics 4)
        if (typeof window !== 'undefined') {
          // Meta Pixel Lead Event
          if ((window as any).fbq) {
            (window as any).fbq('track', 'Lead', {
              content_name: 'Diagnostico Financeiro Coleta',
              status: 'enviado',
            });
          }
          // GA4 submit_formulario Event
          if ((window as any).gtag) {
            (window as any).gtag('event', 'submit_formulario', {
              event_category: 'diagnostico',
              event_label: nomeNegocio,
            });
          }
        }

        setSucesso(true);
      } else {
        setErro(data.error || 'Erro ao registrar os dados. Tente novamente.');
      }
    } catch {
      setErro('Erro de conexão ao enviar os dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 relative pb-16">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_15%,rgba(245,158,11,0.12),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-grid-amber opacity-20 pointer-events-none" />

      {/* ── HEADER ── */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-4 sm:px-8 py-4 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-1.5 rounded-2xl bg-slate-900 border border-slate-800 group-hover:border-amber-500/40 transition-colors shadow-md">
              <Image
                src="/logo.png"
                alt="Logo AnalisAI.me"
                width={160}
                height={45}
                className="h-9 sm:h-11 w-auto object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-black text-white tracking-tight group-hover:text-amber-400 transition-colors">
                  AnalisAI<span className="text-amber-400">.me</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Sala de Coleta de Dados
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Ambiente Seguro LGPD</span>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="relative z-10 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col justify-center">
        {sucesso ? (
          /* TELA DE CONFIRMAÇÃO */
          <div className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 text-center shadow-2xl shadow-emerald-500/10 animate-fadeIn space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Coleta Confirmada
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Recebemos seus dados com sucesso!
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg mx-auto font-medium">
                Seu Diagnóstico Financeiro personalizado está em preparação e chegará em{' '}
                <strong className="text-amber-400">até 72 horas</strong> no e-mail ou WhatsApp informado.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 max-w-md mx-auto space-y-2 text-left">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Próximos passos:</span>
              </div>
              <p>1. Nossos consultores analisarão sua estrutura de custos e faturamento.</p>
              <p>2. Elaboraremos seu relatório com a DRE Gerencial Sintética e recomendações.</p>
              <p>3. Você receberá o documento em PDF oficial diretamente no seu contato.</p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`https://wa.me/${WHATSAPP_OFICIAL}?text=${encodeURIComponent(
                  `Olá! Acabei de enviar meus dados de diagnóstico para a empresa ${nomeNegocio}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3.5 rounded-2xl transition-all shadow-lg text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Falar com a equipe no WhatsApp
              </Link>

              <Link
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white text-sm font-medium transition-all"
              >
                Voltar à Página Principal
              </Link>
            </div>
          </div>
        ) : (
          /* FORMULÁRIO DE COLETA (TEXTO OU VOZ) */
          <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
            <div className="border-b border-slate-800 pb-5 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                <FileText className="w-3.5 h-3.5" /> Etapa de Coleta de Dados
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Ficha de Informações do Negócio
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Preencha os campos abaixo digitando ou clicando no ícone do microfone <Mic className="inline w-3.5 h-3.5 text-amber-400" /> para ditar sua resposta por voz.
              </p>
            </div>

            {erro && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              {/* 1. Nome do Negócio e Setor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Nome da Empresa / Negócio *
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={nomeNegocio}
                      onChange={(e) => setNomeNegocio(e.target.value)}
                      placeholder="Ex: Minha Loja, Consultoria X..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVozParaCampo('nomeNegocio')}
                      title="Ditar por voz"
                      className={`absolute right-2 p-1.5 rounded-lg text-xs transition-colors ${
                        gravando && campoAtivoVoz === 'nomeNegocio'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      {gravando && campoAtivoVoz === 'nomeNegocio' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Setor / Ramo de Atuação
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={setor}
                      onChange={(e) => setSetor(e.target.value)}
                      placeholder="Ex: Comércio, Alimentação, Serviços..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVozParaCampo('setor')}
                      title="Ditar por voz"
                      className={`absolute right-2 p-1.5 rounded-lg text-xs transition-colors ${
                        gravando && campoAtivoVoz === 'setor'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      {gravando && campoAtivoVoz === 'setor' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Faturamento e Custos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1.5">
                    Faturamento Médio (3 meses) *
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={faturamentoMedio}
                      onChange={(e) => setFaturamentoMedio(e.target.value)}
                      placeholder="R$ 0,00"
                      className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 text-sm text-emerald-300 font-bold focus:border-emerald-400 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVozParaCampo('faturamentoMedio')}
                      title="Ditar valor"
                      className={`absolute right-2 p-1.5 rounded-lg text-xs transition-colors ${
                        gravando && campoAtivoVoz === 'faturamentoMedio'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'text-slate-400 hover:text-emerald-400'
                      }`}
                    >
                      {gravando && campoAtivoVoz === 'faturamentoMedio' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Média mensal aproximada</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-400 mb-1.5">
                    Custos Fixos Mensais (R$)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={custosFixos}
                      onChange={(e) => setCustosFixos(e.target.value)}
                      placeholder="R$ 0,00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:border-rose-400 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVozParaCampo('custosFixos')}
                      title="Ditar valor"
                      className={`absolute right-2 p-1.5 rounded-lg text-xs transition-colors ${
                        gravando && campoAtivoVoz === 'custosFixos'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'text-slate-400 hover:text-rose-400'
                      }`}
                    >
                      {gravando && campoAtivoVoz === 'custosFixos' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Aluguel, folha, pró-labore...</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1.5">
                    Custos Variáveis / Insumos (R$)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={custosVariaveis}
                      onChange={(e) => setCustosVariaveis(e.target.value)}
                      placeholder="R$ 0,00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:border-amber-400 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVozParaCampo('custosVariaveis')}
                      title="Ditar valor"
                      className={`absolute right-2 p-1.5 rounded-lg text-xs transition-colors ${
                        gravando && campoAtivoVoz === 'custosVariaveis'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      {gravando && campoAtivoVoz === 'custosVariaveis' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Mercadorias e matérias-primas</span>
                </div>
              </div>

              {/* 3. Dívidas e Parcelamentos */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Dívidas, Empréstimos ou Parcelamentos Ativos
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={dividasParcelamentos}
                    onChange={(e) => setDividasParcelamentos(e.target.value)}
                    placeholder="Ex: Empréstimo bancário com parcelas de R$ 1.500 até dez/2026, parcelamento de impostos..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:border-amber-400 outline-none pr-10 resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVozParaCampo('dividasParcelamentos')}
                    title="Ditar observações"
                    className={`absolute right-2 top-2 p-1.5 rounded-lg text-xs transition-colors ${
                      gravando && campoAtivoVoz === 'dividasParcelamentos'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    {gravando && campoAtivoVoz === 'dividasParcelamentos' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 4. Contatos para Recebimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    E-mail para Recebimento do Relatório *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@empresa.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    WhatsApp para Envio e Contato *
                  </label>
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              {/* Botão de Envio */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black px-8 py-4.5 rounded-2xl shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.01] text-base cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span>Salvando dados com segurança...</span>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Enviar Dados para Elaboração do Diagnóstico
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Seus dados são 100% confidenciais e protegidos sob a LGPD</span>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DiagnosticoColetaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
          <div className="animate-pulse text-amber-400 text-sm font-bold">
            Carregando Sala de Coleta...
          </div>
        </div>
      }
    >
      <ColetaFormContent />
    </Suspense>
  );
}
