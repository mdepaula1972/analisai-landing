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
  modelo_operacao?: string;
  faturamento_mensal_estimado?: number;
  custo_mercadorias_insumos?: number;
  aluguel_condominio?: number;
  folha_funcionarios?: number;
  pro_labore_socios?: number;
  utilidades_energia_internet?: number;
  sistemas_ferramentas?: number;
  outras_despesas_fixas?: number;
  custos_fixos_estimados?: number;
  custos_variaveis_estimados?: number;
  mistura_contas_pf_pj?: string;
  principais_gargalos?: string[];
  cenarios_solicitados?: string[];
}

/* ── CONFIGURAÇÃO ── */
const VERSION = 'v2.4 · 23/08/2026 - 10:50';

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
    `Olá ${nomeParam ? nomeParam.split(' ')[0] : ''}! Sou seu Consultor Financeiro aqui na AnalisAI.me. Enquanto conversamos, vou montando a sua FICHA FINANCEIRA AO VIVO na tela. Para começarmos o Passo 1: qual é a sua atividade e como sua empresa funciona no dia a dia?`
  );
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [finalizado, setFinalizado] = useState(false);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);
  const [abaFichaAberta, setAbaFichaAberta] = useState(true);
  const [resumo, setResumo] = useState<ResumoFinanceiro>({
    faturamento_mensal_estimado: 0,
    custo_mercadorias_insumos: 0,
    aluguel_condominio: 0,
    folha_funcionarios: 0,
    pro_labore_socios: 0,
    utilidades_energia_internet: 0,
    sistemas_ferramentas: 0,
    outras_despesas_fixas: 0,
  });

  // Estados de voz e input
  const [gravando, setGravando] = useState(false);
  const [transcricaoAoVivo, setTranscricaoAoVivo] = useState('');
  const [textoInput, setTextoInput] = useState('');
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [audioAtivado, setAudioAtivado] = useState(true);
  const [modoTexto, setModoTexto] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Recalcula totais automáticos
  const totalDespesasFixas = 
    (resumo.aluguel_condominio || 0) +
    (resumo.folha_funcionarios || 0) +
    (resumo.pro_labore_socios || 0) +
    (resumo.utilidades_energia_internet || 0) +
    (resumo.sistemas_ferramentas || 0) +
    (resumo.outras_despesas_fixas || 0) || (resumo.custos_fixos_estimados || 0);

  const totalCustosVariaveis = (resumo.custo_mercadorias_insumos || 0) || (resumo.custos_variaveis_estimados || 0);
  const faturamento = resumo.faturamento_mensal_estimado || 0;
  const sobraOperacional = faturamento - totalCustosVariaveis - totalDespesasFixas;

  // Função para atualizar campos individuais da ficha
  const atualizarCampoFicha = (campo: keyof ResumoFinanceiro, valor: any) => {
    setResumo(prev => {
      const atualizado = { ...prev, [campo]: valor };
      if (typeof valor === 'number') {
        const novosFixos = 
          (campo === 'aluguel_condominio' ? valor : (atualizado.aluguel_condominio || 0)) +
          (campo === 'folha_funcionarios' ? valor : (atualizado.folha_funcionarios || 0)) +
          (campo === 'pro_labore_socios' ? valor : (atualizado.pro_labore_socios || 0)) +
          (campo === 'utilidades_energia_internet' ? valor : (atualizado.utilidades_energia_internet || 0)) +
          (campo === 'sistemas_ferramentas' ? valor : (atualizado.sistemas_ferramentas || 0)) +
          (campo === 'outras_despesas_fixas' ? valor : (atualizado.outras_despesas_fixas || 0));
        atualizado.custos_fixos_estimados = novosFixos;
        if (campo === 'custo_mercadorias_insumos') {
          atualizado.custos_variaveis_estimados = valor;
        }
      }
      return atualizado;
    });
  };

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
          resumo_atual: resumo,
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
        if (data.resumo_extracao) {
          setResumo(prev => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(data.resumo_extracao).filter(([_, v]) => v !== 0 && v !== '' && v !== null && v !== undefined)
            )
          }));
        }
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
    { num: 1, label: '1. Modelo', sub: 'Como você opera' },
    { num: 2, label: '2. Vendas', sub: 'Faturamento médio' },
    { num: 3, label: '3. Custos', sub: 'Insumos e fixos' },
    { num: 4, label: '4. Gargalos', sub: 'Dores e objetivos' },
    { num: 5, label: '5. Raio-X', sub: 'Confirmação final' },
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
        <span><strong>Garantia AnalisAI.me:</strong> Você tem direito a <strong>2 reanálises gratuitas</strong> após a entrega do relatório para refinar dados ou novos cenários.</span>
      </div>

      {/* ── CORPO PRINCIPAL ── */}
      <main className="relative z-10 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col justify-center items-center">

        {!finalizado ? (
          <div className="w-full flex flex-col items-center text-center space-y-5">

            {/* ── MAPA VISUAL DAS 5 ETAPAS (STEPPER) ── */}
            <div className="w-full max-w-2xl bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3 sm:p-4 shadow-lg">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2 px-1">
                <span className="text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Entrevista em 5 Passos Rápidos
                </span>
                <span>Passo {etapaAtual} de 5</span>
              </div>

              <div className="grid grid-cols-5 gap-1 sm:gap-2">
                {etapas.map((et) => {
                  const isConcluida = etapaAtual > et.num;
                  const isAtual = etapaAtual === et.num;

                  return (
                    <div
                      key={et.num}
                      className={`p-2 rounded-xl text-left transition-all ${
                        isAtual
                          ? 'bg-amber-500/15 border border-amber-500/60 shadow-md shadow-amber-500/10'
                          : isConcluida
                          ? 'bg-emerald-500/10 border border-emerald-500/30'
                          : 'bg-slate-950/40 border border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[11px] font-black ${isAtual ? 'text-amber-300' : isConcluida ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {et.label}
                        </span>
                        {isConcluida && <Check className="w-3 h-3 text-emerald-400" />}
                        {isAtual && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
                      </div>
                      <p className="text-[9px] text-slate-400 hidden sm:block truncate">{et.sub}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Balão de Fala da Assistente IA */}
            <div className="relative w-full rounded-3xl border border-amber-500/30 bg-slate-900/90 p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-left">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    Consultor Financeiro AnalisAI.me
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

            {/* ── FICHA FINANCEIRA INTERATIVA AO VIVO (EDITÁVEL PELO USUÁRIO OU PELA IA) ── */}
            <div className="w-full rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-2xl text-left space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Ficha Financeira ao Vivo
                  </h3>
                  <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                    Editável por Voz ou Clique
                  </span>
                </div>
                <button
                  onClick={() => setAbaFichaAberta(!abaFichaAberta)}
                  className="text-xs text-slate-400 hover:text-white font-medium underline"
                >
                  {abaFichaAberta ? 'Recolher Ficha' : 'Expandir Ficha'}
                </button>
              </div>

              {abaFichaAberta && (
                <div className="space-y-4 text-xs">
                  
                  {/* Ramo e Modelo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block text-[11px] font-bold mb-1">
                        Atividade / Ramo de Atuação:
                      </label>
                      <input
                        type="text"
                        value={resumo.ramo_atividade || ''}
                        onChange={(e) => atualizarCampoFicha('ramo_atividade', e.target.value)}
                        placeholder="Ex: Restaurante, Loja de Roupas, Clínica, Oficina..."
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-amber-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block text-[11px] font-bold mb-1">
                        Modelo de Operação:
                      </label>
                      <input
                        type="text"
                        value={resumo.modelo_operacao || ''}
                        onChange={(e) => atualizarCampoFicha('modelo_operacao', e.target.value)}
                        placeholder="Ex: Loja física e delivery, fábrica sob encomenda..."
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-amber-400 outline-none"
                      />
                    </div>
                  </div>

                  {/* Vendas & Custos Variáveis */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/20">
                      <label className="text-emerald-400 block text-[11px] font-bold mb-1">
                        💰 Faturamento Médio Mensal (R$):
                      </label>
                      <input
                        type="number"
                        value={resumo.faturamento_mensal_estimado || ''}
                        onChange={(e) => atualizarCampoFicha('faturamento_mensal_estimado', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                        className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl px-3 py-2 text-emerald-300 font-bold text-sm focus:border-emerald-400 outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">Quanto costuma entrar no caixa por mês.</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-amber-500/20">
                      <label className="text-amber-400 block text-[11px] font-bold mb-1">
                        📦 Custos com Mercadorias / Insumos (R$):
                      </label>
                      <input
                        type="number"
                        value={resumo.custo_mercadorias_insumos || ''}
                        onChange={(e) => atualizarCampoFicha('custo_mercadorias_insumos', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                        className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-amber-300 font-bold text-sm focus:border-amber-400 outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">Compra de produtos p/ revenda ou matérias-primas.</span>
                    </div>
                  </div>

                  {/* Despesas Fixas Discriminadas */}
                  <div className="pt-2">
                    <span className="text-slate-400 block text-[11px] font-bold uppercase tracking-wider mb-2">
                      🏛️ Principais Despesas Fixas da Empresa:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      
                      {/* Aluguel */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <label className="text-slate-400 block text-[10px] font-bold mb-1">
                          🏢 Aluguel, IPTU & Condomínio:
                        </label>
                        <input
                          type="number"
                          value={resumo.aluguel_condominio || ''}
                          onChange={(e) => atualizarCampoFicha('aluguel_condominio', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:border-amber-400 outline-none"
                        />
                      </div>

                      {/* Folha */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <label className="text-slate-400 block text-[10px] font-bold mb-1">
                          👥 Folha de Funcionários:
                        </label>
                        <input
                          type="number"
                          value={resumo.folha_funcionarios || ''}
                          onChange={(e) => atualizarCampoFicha('folha_funcionarios', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:border-amber-400 outline-none"
                        />
                      </div>

                      {/* Pró-labore */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-cyan-500/30">
                        <label className="text-cyan-400 block text-[10px] font-bold mb-1">
                          💼 Pró-labore Sócios (Salário):
                        </label>
                        <input
                          type="number"
                          value={resumo.pro_labore_socios || ''}
                          onChange={(e) => atualizarCampoFicha('pro_labore_socios', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="w-full bg-slate-900 border border-cyan-500/40 rounded-lg px-2.5 py-1.5 text-cyan-300 font-bold focus:border-cyan-400 outline-none"
                        />
                      </div>

                      {/* Utilidades */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <label className="text-slate-400 block text-[10px] font-bold mb-1">
                          ⚡ Energia, Água & Internet:
                        </label>
                        <input
                          type="number"
                          value={resumo.utilidades_energia_internet || ''}
                          onChange={(e) => atualizarCampoFicha('utilidades_energia_internet', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:border-amber-400 outline-none"
                        />
                      </div>

                      {/* Sistemas */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <label className="text-slate-400 block text-[10px] font-bold mb-1">
                          💻 Sistemas & Softwares:
                        </label>
                        <input
                          type="number"
                          value={resumo.sistemas_ferramentas || ''}
                          onChange={(e) => atualizarCampoFicha('sistemas_ferramentas', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:border-amber-400 outline-none"
                        />
                      </div>

                      {/* Outras Despesas */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <label className="text-slate-400 block text-[10px] font-bold mb-1">
                          📦 Outras Despesas Fixas:
                        </label>
                        <input
                          type="number"
                          value={resumo.outras_despesas_fixas || ''}
                          onChange={(e) => atualizarCampoFicha('outras_despesas_fixas', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:border-amber-400 outline-none"
                        />
                      </div>

                    </div>
                  </div>

                  {/* Separação PF/PJ */}
                  <div className="pt-2">
                    <label className="text-slate-400 block text-[11px] font-bold mb-1.5">
                      💳 Mistura de Contas Pessoais com a Empresa:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['Não mistura (Contas 100% separadas)', 'Parcialmente (Paga algumas contas da casa)', 'Sim (Usa caixa da empresa para tudo)'].map((opcao) => (
                        <button
                          key={opcao}
                          type="button"
                          onClick={() => atualizarCampoFicha('mistura_contas_pf_pj', opcao)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            resumo.mistura_contas_pf_pj === opcao
                              ? 'bg-rose-500/20 border border-rose-500 text-rose-300'
                              : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {opcao}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Totalizador Financeiro em Tempo Real */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Faturamento:</span>
                      <span className="text-emerald-400 font-bold text-xs sm:text-sm">
                        R$ {faturamento.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Custos Variáveis:</span>
                      <span className="text-amber-400 font-bold text-xs sm:text-sm">
                        R$ {totalCustosVariaveis.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Despesas Fixas:</span>
                      <span className="text-rose-400 font-bold text-xs sm:text-sm">
                        R$ {totalDespesasFixas.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Sobra Operacional:</span>
                      <span className={`font-black text-xs sm:text-sm ${sobraOperacional >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        R$ {sobraOperacional.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => enviarResposta(`Atualizei alguns números na ficha: Faturamento R$ ${faturamento}, Mercadorias R$ ${totalCustosVariaveis}, Despesas Fixas R$ ${totalDespesasFixas}. Pode analisar?`)}
                      disabled={carregandoIA}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Pedir para a IA analisar a ficha atualizada
                    </button>
                  </div>

                </div>
              )}
            </div>

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
                  className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer ${gravando
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/50 scale-110'
                      : carregandoIA
                        ? 'bg-slate-800 text-slate-500 cursor-wait'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/40 hover:scale-105 animate-pulse-glow-amber'
                    }`}
                  aria-label={gravando ? 'Terminei de falar' : 'Tocar para Falar'}
                >
                  {carregandoIA ? (
                    <RefreshCw className="w-10 h-10 animate-spin text-amber-400" />
                  ) : gravando ? (
                    <>
                      <MicOff className="w-8 h-8 animate-pulse" />
                      <span className="text-[9px] font-extrabold uppercase mt-1 leading-tight text-center px-1">
                        Terminei<br />de falar
                      </span>
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
                  ? '🔴 Ouvindo você... Toque em "Terminei de falar" quando concluir.'
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
                href="https://wa.me/551331500987?text=Ol%C3%A1!%20Acabei%20de%20concluir%20a%20minha%20entrevista%20por%20voz%20do%20Diagn%C3%B3stico%20Financeiro."
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

