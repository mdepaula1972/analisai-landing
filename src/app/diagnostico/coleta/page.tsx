'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Mic, MicOff, Send, Volume2, VolumeX, Sparkles,
  CheckCircle2, ArrowRight, Clock, ShieldCheck,
  FileText, MessageCircle, RefreshCw, BarChart3,
  HelpCircle, ChevronRight, Check, AlertCircle, Printer, Download,
  Building2, UserCheck, TrendingUp, AlertTriangle, ShieldAlert
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

interface RelatorioData {
  titulo?: string;
  score_saude_financeira?: number;
  classificacao_saude?: string;
  resumo_executivo?: string;
  indicadores_chave?: {
    margem_bruta_estimada?: string;
    margem_liquida_estimada?: string;
    ponto_equilibrio_mensal?: string;
    grau_comprometimento_fixos?: string;
  };
  alertas_criticos?: string[];
  pontos_fortes?: string[];
  plano_acao_estrategico?: Array<{
    prazo: string;
    titulo: string;
    acoes: string[];
  }>;
  conclusao_consultor?: string;
}

/* ── CONFIGURAÇÃO ── */
const VERSION = 'v3.2 · 23/08/2026 - 13:00';
const WHATSAPP_OFICIAL = '551331500987';

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

  // Ficha Financeira
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

  // Dados Cadastrais para o Relatório
  const [razaoSocial, setRazaoSocial] = useState('');
  const [documentoEmpresa, setDocumentoEmpresa] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState(nomeParam || '');
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [relatorioEmitido, setRelatorioEmitido] = useState<RelatorioData | null>(null);

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

  function toggleGravacao() {
    if (!recognitionRef.current) {
      alert('Seu navegador não possui suporte a microfone por voz. Você pode utilizar o campo de texto digitado!');
      setModoTexto(true);
      return;
    }

    if (gravando) {
      recognitionRef.current.stop();
      setGravando(false);
      if (transcricaoAoVivo.trim() || textoInput.trim()) {
        enviarResposta(transcricaoAoVivo || textoInput);
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

  // Gera o Relatório Executivo Oficial Instantaneamente
  async function gerarRelatorioInstantaneo() {
    setGerandoRelatorio(true);
    try {
      const res = await fetch('/api/diagnostico/gerar-relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ficha: {
            ...resumo,
            faturamento_mensal_estimado: faturamento,
            custos_fixos_estimados: totalDespesasFixas,
            custos_variaveis_estimados: totalCustosVariaveis,
            sobra_operacional_estimada: sobraOperacional,
          },
          identificacao: {
            razao_social: razaoSocial || resumo.ramo_atividade || 'Empresa Diagnosticada',
            documento: documentoEmpresa || 'Não informado',
            responsavel: nomeResponsavel || nomeParam || 'Gestor(a)',
            email: emailParam,
            whatsapp: whatsappParam,
            data_emissao: new Date().toLocaleDateString('pt-BR'),
          }
        }),
      });

      const data = await res.json();
      if (res.ok && data.relatorio) {
        setRelatorioEmitido(data.relatorio);
        setFinalizado(true);
      } else {
        alert(data.error || 'Erro ao emitir relatório instantâneo.');
      }
    } catch {
      alert('Erro de comunicação ao emitir o relatório.');
    } finally {
      setGerandoRelatorio(false);
    }
  }

  const etapas = [
    { num: 1, label: '1. Modelo', sub: 'Como você opera' },
    { num: 2, label: '2. Vendas', sub: 'Faturamento médio' },
    { num: 3, label: '3. Custos', sub: 'Insumos e fixos' },
    { num: 4, label: '4. Diagnóstico', sub: 'Dores e melhorias' },
    { num: 5, label: '5. Relatório', sub: 'Emissão imediata' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 relative pb-32 print:pb-0 print:bg-white print:text-slate-900">

      {/* ── BADGE DE VERSÃO FIXO (Apenas Desktop para não sobrepor o microfone no mobile) ── */}
      <div className="hidden md:flex fixed bottom-3 left-3 z-50 items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/40 bg-slate-950/95 backdrop-blur-md text-amber-400 text-[10px] font-bold font-mono shadow-xl print:hidden">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Sala de Voz {VERSION}
      </div>

      {/* Backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_20%,rgba(245,158,11,0.12),transparent)] pointer-events-none print:hidden" />
      <div className="absolute inset-0 bg-grid-amber opacity-20 pointer-events-none print:hidden" />

      {/* ── HEADER COM LOGO DESTACADO ── */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-4 sm:px-8 py-3.5 shadow-lg shadow-black/20 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">

          {/* Logo com presença e autoridade */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-amber-500/40 transition-colors shadow-md">
              <Image
                src="/logo.png"
                alt="Logo AnalisAI.me"
                width={36}
                height={36}
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black text-white tracking-tight group-hover:text-amber-400 transition-colors">
                  AnalisAI<span className="text-amber-400">.me</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
                  {VERSION.split('·')[0].trim()}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                Inteligência Financeira com Emissão no Ato
              </span>
            </div>
          </Link>

          {/* Botões de Controle Superior */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (audioAtivado && synthRef.current) synthRef.current.cancel();
                setAudioAtivado(!audioAtivado);
              }}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                audioAtivado
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-slate-800 bg-slate-900 text-slate-500'
              }`}
              title={audioAtivado ? 'Voz da IA ativada' : 'Voz da IA mutada'}
            >
              {audioAtivado ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{audioAtivado ? 'Áudio Ativo' : 'Mudo'}</span>
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
      <div className="relative z-10 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-center text-xs text-emerald-300 flex items-center justify-center gap-2 print:hidden">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span><strong>Garantia AnalisAI.me:</strong> Relatório Executivo emitido no ato + <strong>2 reanálises gratuitas</strong> após a entrega.</span>
      </div>

      {/* ── CORPO PRINCIPAL ── */}
      <main className="relative z-10 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col justify-center items-center">

        {!relatorioEmitido ? (
          <div className="w-full flex flex-col items-center text-center space-y-5">

            {/* ── MAPA VISUAL DAS 5 ETAPAS (STEPPER) ── */}
            <div className="w-full max-w-3xl bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3 sm:p-4 shadow-lg">
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

            {/* Balão de Fala do Consultor IA */}
            <div className="relative w-full rounded-3xl border border-amber-500/30 bg-slate-900/90 p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-left">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    Consultor Financeiro AnalisAI.me
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">40 anos de vivência executiva</span>
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

                </div>
              )}
            </div>

            {/* ── PAINEL DE IDENTIFICAÇÃO E EMISSÃO IMEDIATA DO RELATÓRIO ── */}
            <div className="w-full max-w-2xl p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 space-y-4 text-left shadow-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Identificação para o Relatório Oficial em PDF</h4>
                  <p className="text-xs text-slate-400">Insira os dados para o cabeçalho oficial de emissão.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Razão Social ou Nome do Estabelecimento:</label>
                  <input
                    type="text"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    placeholder="Ex: Restaurante Sabor & Arte LTDA"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">CNPJ ou CPF (Opcional):</label>
                  <input
                    type="text"
                    value={documentoEmpresa}
                    onChange={(e) => setDocumentoEmpresa(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={gerarRelatorioInstantaneo}
                disabled={gerandoRelatorio}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black py-4 px-6 rounded-2xl text-sm transition-all shadow-xl shadow-amber-500/20 hover:scale-[1.01] cursor-pointer disabled:opacity-50"
              >
                {gerandoRelatorio ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Gerando Relatório Executivo por IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Gerar Meu Relatório Executivo em PDF no Ato
                  </>
                )}
              </button>
            </div>

          </div>
        ) : (
          /* ── VISUALIZADOR OFICIAL DO RELATÓRIO EXECUTIVO (PRONTO PARA PDF / IMPRESSÃO) ── */
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-left space-y-8 animate-fadeIn print:border-none print:shadow-none print:p-0 print:bg-white print:text-slate-900">
            
            {/* Cabeçalho do Relatório com Logo AnalisAI.me */}
            <div className="border-b border-slate-800 print:border-slate-300 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-slate-950 border border-slate-800 print:border-slate-300">
                  <Image
                    src="/logo.png"
                    alt="Logo AnalisAI.me"
                    width={48}
                    height={48}
                    className="w-10 h-10 object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white print:text-slate-950">
                    AnalisAI<span className="text-amber-400">.me</span>
                  </h2>
                  <p className="text-xs text-slate-400 print:text-slate-600">
                    Autoridade Emissora de Diagnósticos Empresariais
                  </p>
                </div>
              </div>

              <div className="text-right sm:text-right text-xs text-slate-400 print:text-slate-600">
                <p><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
                <p><strong>Empresa:</strong> {razaoSocial || resumo.ramo_atividade || 'Empresa Diagnosticada'}</p>
                {documentoEmpresa && <p><strong>Doc:</strong> {documentoEmpresa}</p>}
              </div>
            </div>

            {/* Ações de Impressão / PDF */}
            <div className="flex items-center justify-between gap-3 print:hidden bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Relatório Executivo Gerado com Sucesso!
              </span>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir / Baixar em PDF
              </button>
            </div>

            {/* Score e Diagnóstico Geral */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 print:border-slate-200 text-center flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Saúde Financeira:</span>
                <span className="text-3xl font-black text-amber-400 print:text-amber-600 mt-1">
                  {relatorioEmitido.score_saude_financeira || 70}/100
                </span>
                <span className="text-xs font-bold text-slate-300 print:text-slate-700 mt-1">
                  {relatorioEmitido.classificacao_saude || 'Atenção Operacional'}
                </span>
              </div>

              <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 print:border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Sumário Executivo:</span>
                <p className="text-xs sm:text-sm text-slate-300 print:text-slate-800 leading-relaxed">
                  {relatorioEmitido.resumo_executivo}
                </p>
              </div>
            </div>

            {/* ── DRE GERENCIAL SINTÉTICA OFICIAL ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 print:text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" /> DRE Gerencial Sintética (Demonstrativo de Resultado)
                </h4>
                <span className="text-[10px] text-slate-400 print:text-slate-600 font-mono">
                  Base Mensal Estimada
                </span>
              </div>

              {/* Tabela Estruturada de DRE */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-slate-300 bg-slate-950/60 print:bg-white text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 print:border-slate-300 bg-slate-900/80 print:bg-slate-100 text-[11px] font-bold text-slate-400 print:text-slate-700">
                      <th className="py-2.5 px-3 sm:px-4">Estrutura de Contas</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Valor Mensal (R$)</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">% s/ Faturamento</th>
                      <th className="py-2.5 px-3 sm:px-4 text-left hidden sm:table-cell">Diagnóstico / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                    
                    {/* Receita Bruta */}
                    <tr className="font-bold text-slate-100 print:text-slate-900 bg-emerald-500/5">
                      <td className="py-2.5 px-3 sm:px-4 text-emerald-400 print:text-emerald-800 flex items-center gap-1">
                        (+) Faturamento Bruto Médio
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right text-emerald-400 print:text-emerald-800">
                        R$ {faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right text-slate-300 print:text-slate-700 font-mono">
                        100,0%
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-slate-400 print:text-slate-600 hidden sm:table-cell text-[11px]">
                        Base operacional total
                      </td>
                    </tr>

                    {/* CMV / Variáveis */}
                    <tr className="text-slate-300 print:text-slate-800">
                      <td className="py-2.5 px-3 sm:px-4 text-amber-400/90 print:text-amber-800 pl-6 sm:pl-8">
                        (-) Custos com Mercadorias / Insumos (CMV)
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right text-amber-400/90 print:text-amber-800">
                        - R$ {totalCustosVariaveis.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono">
                        {faturamento > 0 ? ((totalCustosVariaveis / faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-slate-400 print:text-slate-600 hidden sm:table-cell text-[11px]">
                        {(totalCustosVariaveis / (faturamento || 1)) > 0.45 ? '⚠️ Acima da média' : '✅ Nível controlado'}
                      </td>
                    </tr>

                    {/* Margem de Contribuição */}
                    <tr className="font-extrabold text-slate-100 print:text-slate-900 bg-slate-900/60 print:bg-slate-50 border-t border-slate-700/60">
                      <td className="py-2.5 px-3 sm:px-4 text-cyan-400 print:text-cyan-800">
                        (=) MARGEM DE CONTRIBUIÇÃO BRUTA
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right text-cyan-400 print:text-cyan-800">
                        R$ {(faturamento - totalCustosVariaveis).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono">
                        {faturamento > 0 ? (((faturamento - totalCustosVariaveis) / faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-slate-400 print:text-slate-600 hidden sm:table-cell text-[11px]">
                        Recurso para pagar fixos e lucro
                      </td>
                    </tr>

                    {/* Folha */}
                    <tr className="text-slate-400 print:text-slate-700">
                      <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8">
                        (-) Folha de Pagamento & Encargos
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right text-rose-400/90 print:text-rose-800">
                        - R$ {(resumo.folha_funcionarios || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right font-mono">
                        {faturamento > 0 ? (((resumo.folha_funcionarios || 0) / faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-slate-500 print:text-slate-600 hidden sm:table-cell text-[11px]">
                        Equipe operacional
                      </td>
                    </tr>

                    {/* Aluguel */}
                    <tr className="text-slate-400 print:text-slate-700">
                      <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8">
                        (-) Aluguel, IPTU & Ocupação
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right text-rose-400/90 print:text-rose-800">
                        - R$ {(resumo.aluguel_condominio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right font-mono">
                        {faturamento > 0 ? (((resumo.aluguel_condominio || 0) / faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-slate-500 print:text-slate-600 hidden sm:table-cell text-[11px]">
                        Custo de ponto físico
                      </td>
                    </tr>

                    {/* Pró-labore */}
                    <tr className="text-slate-400 print:text-slate-700">
                      <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8">
                        (-) Pró-labore dos Sócios (Salário)
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right text-rose-400/90 print:text-rose-800">
                        - R$ {(resumo.pro_labore_socios || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right font-mono">
                        {faturamento > 0 ? (((resumo.pro_labore_socios || 0) / faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-slate-500 print:text-slate-600 hidden sm:table-cell text-[11px]">
                        Remuneração da gestão
                      </td>
                    </tr>

                    {/* Outras Fixas */}
                    <tr className="text-slate-400 print:text-slate-700">
                      <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8">
                        (-) Utilidades, Softwares & Outras Fixas
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right text-rose-400/90 print:text-rose-800">
                        - R$ {((resumo.utilidades_energia_internet || 0) + (resumo.sistemas_ferramentas || 0) + (resumo.outras_despesas_fixas || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right font-mono">
                        {faturamento > 0 ? ((((resumo.utilidades_energia_internet || 0) + (resumo.sistemas_ferramentas || 0) + (resumo.outras_despesas_fixas || 0)) / faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-slate-500 print:text-slate-600 hidden sm:table-cell text-[11px]">
                        Infraestrutura geral
                      </td>
                    </tr>

                    {/* Total Despesas Fixas */}
                    <tr className="font-bold text-slate-200 print:text-slate-900 bg-slate-950/40">
                      <td className="py-2.5 px-3 sm:px-4 text-rose-400 print:text-rose-800">
                        (=) TOTAL DE DESPESAS FIXAS
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right text-rose-400 print:text-rose-800">
                        - R$ {totalDespesasFixas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono">
                        {faturamento > 0 ? ((totalDespesasFixas / faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-slate-400 print:text-slate-600 hidden sm:table-cell text-[11px]">
                        Peso dos custos de estrutura
                      </td>
                    </tr>

                    {/* Resultado Operacional Líquido */}
                    <tr className={`font-black text-sm ${sobraOperacional >= 0 ? 'bg-emerald-500/10 text-emerald-400 print:text-emerald-800' : 'bg-rose-500/10 text-rose-400 print:text-rose-800'}`}>
                      <td className="py-3 px-3 sm:px-4">
                        (=) RESULTADO OPERACIONAL LÍQUIDO (SOBRA)
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right">
                        R$ {sobraOperacional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right font-mono">
                        {faturamento > 0 ? ((sobraOperacional / faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-3 px-3 sm:px-4 hidden sm:table-cell text-xs">
                        {sobraOperacional >= 0 ? '✅ Operação Lucrativa' : '🚨 Sangria Operacional'}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>

              {/* Box Ponto de Equilíbrio */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 print:border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-amber-400 print:text-amber-800 block text-xs">
                    🎯 Ponto de Equilíbrio Operacional Estimado:
                  </span>
                  <span className="text-slate-400 print:text-slate-600 text-[11px]">
                    Faturamento mínimo necessário por mês apenas para cobrir todos os custos e não ter prejuízo.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-white print:text-slate-950">
                    R$ {(() => {
                      const mc = faturamento - totalCustosVariaveis;
                      const percMC = faturamento > 0 ? (mc / faturamento) : 0;
                      const pe = percMC > 0 ? (totalDespesasFixas / percMC) : 0;
                      return pe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Alertas Críticos */}
            {relatorioEmitido.alertas_criticos && relatorioEmitido.alertas_criticos.length > 0 && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 print:border-rose-300 text-xs space-y-2">
                <h5 className="font-bold text-rose-400 print:text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Alertas Críticos de Risco e Caixa
                </h5>
                <ul className="space-y-1 text-slate-300 print:text-slate-800 pl-4 list-disc">
                  {relatorioEmitido.alertas_criticos.map((alerta, idx) => (
                    <li key={idx}>{alerta}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Plano de Ação Estratégico */}
            {relatorioEmitido.plano_acao_estrategico && (
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 print:text-slate-900 border-b border-slate-800 print:border-slate-200 pb-1">
                  🎯 Plano de Ação Recomendado
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {relatorioEmitido.plano_acao_estrategico.map((plano, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 print:border-slate-200 space-y-2">
                      <span className="text-[10px] font-bold uppercase text-amber-400 print:text-amber-700 block">
                        {plano.prazo}
                      </span>
                      <h6 className="font-bold text-white print:text-slate-950">{plano.titulo}</h6>
                      <ul className="space-y-1 text-slate-400 print:text-slate-700 pl-3 list-disc text-[11px]">
                        {plano.acoes.map((acao, i) => (
                          <li key={i}>{acao}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parecer do Consultor e Validação */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 print:border-slate-200 text-xs space-y-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Parecer dos Especialistas:</span>
              <p className="text-slate-300 print:text-slate-800 italic leading-relaxed">
                &ldquo;{relatorioEmitido.conclusao_consultor || 'Recomendamos acompanhamento contínuo dos indicadores para garantir o estancamento de vazamentos e a consolidação de uma margem líquida sustentável.'}&rdquo;
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] text-slate-500 print:text-slate-600 border-t border-slate-800 print:border-slate-200">
                <span>Emitido por Inteligência AnalisAI.me</span>
                <span>Chave: {pedidoId || 'DIAG-PRO'}</span>
              </div>
            </div>

            {/* Botões Finais de Ação & Envio de Relatório no WhatsApp */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 print:hidden">
              <a
                href={`https://wa.me/${WHATSAPP_OFICIAL}?text=${encodeURIComponent(
                  `*RELATÓRIO EXECUTIVO DE DIAGNÓSTICO FINANCEIRO - AnalisAI.me*\n\n` +
                  `Olá Consultores! Gerei meu relatório oficial e gostaria de agendar o alinhamento com o especialista.\n\n` +
                  `🏢 *DADOS DA EMPRESA:*\n` +
                  `• Empresa: ${razaoSocial || resumo.ramo_atividade || 'Não informada'}\n` +
                  `• Responsável: ${nomeResponsavel || nomeParam || 'Gestor'}\n` +
                  `• CNPJ/CPF: ${documentoEmpresa || 'Não informado'}\n` +
                  `• Ramo & Modelo: ${resumo.ramo_atividade || 'Mapeado'}\n\n` +
                  `💰 *RAIO-X FINANCEIRO CONSOLIDADO:*\n` +
                  `• Faturamento Médio Mensal: R$ ${faturamento.toLocaleString('pt-BR')}\n` +
                  `• Custos com Insumos/Mercadorias: R$ ${totalCustosVariaveis.toLocaleString('pt-BR')}\n` +
                  `• Total Despesas Fixas: R$ ${totalDespesasFixas.toLocaleString('pt-BR')}\n` +
                  `• Sobra Operacional Estimada: R$ ${sobraOperacional.toLocaleString('pt-BR')}\n` +
                  `• Pró-labore dos Sócios: R$ ${(resumo.pro_labore_socios || 0).toLocaleString('pt-BR')}\n` +
                  `• Mistura de Contas PF/PJ: ${resumo.mistura_contas_pf_pj || 'Não informado'}\n\n` +
                  `📊 *SCORE DE SAÚDE:* ${relatorioEmitido?.score_saude_financeira || 70}/100 (${relatorioEmitido?.classificacao_saude || 'Atenção Operacional'})\n\n` +
                  `Gostaria de entender os próximos passos para consultoria / assessoria!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3.5 px-6 rounded-xl transition-all shadow-lg"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar Relatório para a Equipe no WhatsApp (13) 3150-0987
              </a>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-6 py-3.5 rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir / Salvar em PDF
              </button>

              <button
                onClick={() => setRelatorioEmitido(null)}
                className="px-5 py-3.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-semibold cursor-pointer"
              >
                Voltar à Ficha
              </button>
            </div>

          </div>
        )}

      </main>

      {/* ── BARRA FLUTUANTE INFERIOR FIXA (FLOATING VOICE & INPUT DOCK) ── */}
      {!relatorioEmitido && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/85 backdrop-blur-2xl border-t border-slate-800/80 px-4 py-3 shadow-2xl shadow-black print:hidden">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            
            {/* Status Compacto à Esquerda */}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                {gravando ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-red-400">Gravando sua voz...</span>
                  </>
                ) : carregandoIA ? (
                  <>
                    <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                    <span className="text-amber-300">Consultor analisando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Toque no microfone e fale naturalmente</span>
                  </>
                )}
              </span>
              <span className="text-[10px] text-slate-500 truncate max-w-xs">
                {transcricaoAoVivo ? `"${transcricaoAoVivo}"` : 'Você pode falar valores ou editar na tela'}
              </span>
            </div>

            {/* Botão Microfone Central Flutuante */}
            <div className="flex items-center gap-3 mx-auto sm:mx-0">
              <button
                onClick={toggleGravacao}
                disabled={carregandoIA}
                className={`relative px-5 py-2.5 sm:px-6 sm:py-3 rounded-full flex items-center gap-2.5 font-bold transition-all shadow-xl cursor-pointer ${
                  gravando
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/40 animate-pulse scale-105'
                    : carregandoIA
                    ? 'bg-slate-800 text-slate-500 cursor-wait'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30 hover:scale-105'
                }`}
                aria-label={gravando ? 'Terminei de falar' : 'Tocar para Falar'}
              >
                {carregandoIA ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span className="text-xs uppercase tracking-wider">Processando</span>
                  </>
                ) : gravando ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider">Terminei de falar</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider">Falar com Consultor</span>
                  </>
                )}
              </button>

              {/* Botão de Digitação / Teclado */}
              <button
                onClick={() => setModoTexto(!modoTexto)}
                className={`p-2.5 rounded-full border text-xs transition-colors ${
                  modoTexto ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
                title="Digitar texto"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>

            {/* Atalho para Gerar Relatório Direto */}
            <div className="hidden sm:block">
              <button
                onClick={gerarRelatorioInstantaneo}
                disabled={gerandoRelatorio}
                className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Gerar Relatório Agora
              </button>
            </div>

          </div>

          {/* Campo de Texto em Modo Digitação */}
          {modoTexto && (
            <div className="max-w-2xl mx-auto flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-800/80">
              <input
                type="text"
                placeholder="Digite sua resposta ou ajuste de valor aqui..."
                value={textoInput}
                onChange={(e) => setTextoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') enviarResposta(textoInput);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => enviarResposta(textoInput)}
                disabled={!textoInput.trim() || carregandoIA}
                className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FOOTER DISCRETO ── */}
      <footer className="relative z-10 border-t border-slate-900 px-4 py-4 text-center text-xs text-slate-500 print:hidden">
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Seus dados e relatórios são protegidos pela LGPD. Emissão oficial AnalisAI.me.
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
