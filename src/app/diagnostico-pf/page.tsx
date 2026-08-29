'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import Image from 'next/image';
import {
  User, Wallet, AlertTriangle, CheckCircle2,
  ArrowRight, ArrowLeft, Sparkles, Shield, Clock,
  MessageCircle, BarChart3, Lock, Zap, Check, PiggyBank
} from 'lucide-react';
import { WHATSAPP } from '@/lib/contact';

const OCUPACOES_PF = [
  'Autônomo / Freelancer / MEI',
  'Profissional Liberal (Médico, Advogado, etc.)',
  'CLT / Assalariado',
  'Empresário / Sócio de Empresa',
  'Funcionário Público',
  'Outra Ocupação',
];

const FAIXAS_RENDA = [
  'Até R$ 3.500 / mês',
  'R$ 3.500 a R$ 7.000 / mês',
  'R$ 7.000 a R$ 15.000 / mês',
  'R$ 15.000 a R$ 30.000 / mês',
  'Acima de R$ 30.000 / mês',
];

const SITUACAO_DIVIDAS = [
  { id: 'sem_dividas', label: 'Sem dívidas — contas e cartões 100% em dia', icon: '✅' },
  { id: 'parcelado', label: 'Dívidas controladas (financiamento ou parcelas no cartão)', icon: '💳' },
  { id: 'pesando', label: 'Juros de cartão / cheque especial pesando no fim do mês', icon: '⚠️' },
  { id: 'atrasado', label: 'Dívidas atrasadas ou nome restrito', icon: '🚨' },
];

const RESERVA_PF = [
  { id: 'nenhuma', label: 'Não possuo nenhuma reserva guardada' },
  { id: 'ate_3m', label: 'Tenho até 3 meses do meu custo de vida guardado' },
  { id: 'mais_6m', label: 'Tenho 6 meses ou mais de reserva de emergência' },
];

const OBJETIVOS_PF = [
  { id: 'organizar', label: 'Organizar meu orçamento e parar de viver no aperto', icon: '📋' },
  { id: 'quitar', label: 'Eliminar dívidas e juros caros', icon: '✂️' },
  { id: 'investir', label: 'Começar a poupar e investir todo mês', icon: '📈' },
  { id: 'separar', label: 'Separar meu dinheiro pessoal do dinheiro da empresa', icon: '🔄' },
];

export default function DiagnosticoPfPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Formulário
  const [ocupacao, setOcupacao] = useState('');
  const [renda, setRenda] = useState('');
  const [gastosFixos, setGastosFixos] = useState('');
  const [dividas, setDividas] = useState('');
  const [reserva, setReserva] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [consentimento, setConsentimento] = useState(true);

  // Resultado
  const [resultadoScore, setResultadoScore] = useState<{
    score: number;
    nivel: string;
    cor: string;
    diagnostico: string;
    recomendacoes: string[];
  } | null>(null);

  // Validação Passo 1
  const handleAvancarPasso1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocupacao || !renda) {
      setErrorMsg('Por favor, selecione sua ocupação e faixa de renda mensal.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  // Validação Passo 2
  const handleAvancarPasso2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastosFixos.trim() || !dividas || !reserva || !objetivo) {
      setErrorMsg('Por favor, preencha todos os campos sobre suas despesas e objetivo.');
      return;
    }
    setErrorMsg('');
    setStep(3);
  };

  // Envio final
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !whatsapp.trim() || !email.trim()) {
      setErrorMsg('Por favor, preencha seu nome, WhatsApp e e-mail para receber o resultado.');
      return;
    }
    if (!consentimento) {
      setErrorMsg('Por favor, aceite os termos de privacidade para prosseguir.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Cálculo do Score PF
    let score = 75;
    if (dividas === 'atrasado') score -= 35;
    if (dividas === 'pesando') score -= 25;
    if (dividas === 'parcelado') score -= 10;
    if (reserva === 'nenhuma') score -= 20;
    if (reserva === 'ate_3m') score += 5;
    if (reserva === 'mais_6m') score += 15;

    let nivel = 'Equilíbrio Financeiro Parcial';
    let cor = 'text-amber-400';
    let diagnostico = 'Você possui renda ativa, mas sua estrutura atual tem pouca proteção contra imprevistos ou excesso de compromissos parcelados.';
    let recomendacoes = [
      'Construir a Meta 1: Reserva de Emergência mínima de 3 meses de custo de vida.',
      'Mapear gastos invisíveis (assinaturas, pequenas compras diárias e taxas de cartão).',
      'Aplicar a regra 50/30/20 para garantir que 20% da sua renda seja poupada antes de gastar.',
    ];

    if (score < 50) {
      nivel = 'Zona de Alerta e Vulnerabilidade';
      cor = 'text-red-400';
      diagnostico = 'Seus números indicam alta vulnerabilidade a imprevistos e pressão dos custos fixos sobre sua renda líquida mensal.';
      recomendacoes = [
        'Congelar novas compras parceladas imediatamente.',
        'Priorizar a liquidação de dívidas que cobram os juros mais altos (cartão e cheque especial).',
        'Rever gastos fixos de moradia e transporte para reabrir folga no orçamento.',
      ];
    } else if (score >= 80) {
      nivel = 'Saúde Financeira Estável e Promissora';
      cor = 'text-emerald-400';
      diagnostico = 'Parabéns! Sua gestão pessoal é disciplinada e você possui boa capacidade de acumulação e multiplicação patrimonial.';
      recomendacoes = [
        'Diversificar sua reserva além da poupança tradicional (renda fixa atrelada a CDI/IPCA).',
        'Planejar metas de médio e longo prazo (imóvel, aposentadoria, liberdade financeira).',
        'Otimizar a eficiência tributária caso receba pró-labore ou distribuição de lucros.',
      ];
    }

    const resultadoFinal = { score, nivel, cor, diagnostico, recomendacoes };
    setResultadoScore(resultadoFinal);

    try {
      await fetch('/api/leads/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'PF',
          nome,
          email,
          whatsapp,
          empresa_ou_ocupacao: ocupacao,
          faturamento_ou_renda: renda,
          custos_ou_gastos: `R$ ${gastosFixos} (Gastos Fixos)`,
          desafio_ou_objetivo: `${OBJETIVOS_PF.find((o) => o.id === objetivo)?.label} | Dívidas: ${dividas} | Reserva: ${reserva}`,
          score_ou_classificacao: `${score}/100 — ${nivel}`,
          detalhes_adicionais: {
            diagnostico,
            recomendacoes,
          },
        }),
      });
    } catch (err) {
      console.error('Erro ao enviar lead PF:', err);
    } finally {
      setLoading(false);
      setStep(4);
    }
  };

  const waLeadMsg = encodeURIComponent(
    `Olá! Acabei de fazer o Diagnóstico Financeiro Pessoal Gratuito na AnalisAI.me (Score: ${resultadoScore?.score}/100 - ${resultadoScore?.nivel}) e gostaria de receber a orientação do especialista para organizar minhas finanças.`
  );
  const waUrlDevolutiva = `https://wa.me/${WHATSAPP.diagnostico.split('text=')[0].replace(/[^0-9]/g, '')}?text=${waLeadMsg}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">

      {/* ── HEADER SIMPLIFICADO ── */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <NextLink href="/" className="flex items-center gap-2">
            <Image
              src="/logo-horizontal.jpg"
              alt="AnalisAI.me"
              width={360}
              height={100}
              className="h-8 sm:h-10 w-auto object-contain"
              priority
            />
            <span className="hidden sm:inline-flex text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Raio-X PF Gratuito
            </span>
          </NextLink>

          <div className="flex items-center gap-3">
            <NextLink
              href="/diagnostico-pj"
              className="text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
            >
              É Empresa / PJ? <span className="underline">Diagnóstico PJ</span>
            </NextLink>
            <NextLink
              href="/"
              className="text-xs font-bold text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-xl hover:bg-emerald-500/20 transition-colors hidden md:inline-flex"
            >
              Página Principal
            </NextLink>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        {step < 4 && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4">
              <PiggyBank className="w-3.5 h-3.5" /> 100% Gratuito · Raio-X em 2 Minutos
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-3">
              Descubra seu Índice de{' '}
              <span className="text-shimmer-emerald">Saúde Financeira Pessoal</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Responda a perguntas rápidas sobre seus ganhos e despesas e receba na hora um panorama claro para sair do aperto e fazer o dinheiro render.
            </p>

            {/* Barra de Progresso */}
            <div className="mt-8 max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Passo {step} de 3</span>
                <span>{step === 1 ? 'Renda & Ocupação' : step === 2 ? 'Despesas & Reserva' : 'Contato'}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300 rounded-full"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── CARD DO FORMULÁRIO ── */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-10 shadow-2xl shadow-black/50 backdrop-blur-xl">

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* PASSO 1: RENDA E OCUPAÇÃO */}
          {step === 1 && (
            <form onSubmit={handleAvancarPasso1} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  1. Qual é a sua principal ocupação profissional?
                </label>
                <div className="space-y-2">
                  {OCUPACOES_PF.map((o) => (
                    <button
                      type="button"
                      key={o}
                      onClick={() => setOcupacao(o)}
                      className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${
                        ocupacao === o
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{o}</span>
                      {ocupacao === o && <Check className="w-4 h-4 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  2. Qual é a sua renda mensal líquida total aproximada?
                </label>
                <p className="text-xs text-slate-400 mb-3">(Inclua salário, pró-labore, retiradas ou média de trabalhos autônomos)</p>
                <div className="space-y-2">
                  {FAIXAS_RENDA.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setRenda(r)}
                      className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${
                        renda === r
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{r}</span>
                      {renda === r && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-base cursor-pointer mt-8"
              >
                Próximo Passo
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* PASSO 2: DESPESAS, DÍVIDAS E RESERVA */}
          {step === 2 && (
            <form onSubmit={handleAvancarPasso2} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  3. Quanto você gasta por mês em Despesas Fixas Pessoais?
                </label>
                <p className="text-xs text-slate-400 mb-3">
                  (Moradia, alimentação básica, transporte, planos, escola/faculdade, saúde)
                </p>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-500 font-bold text-sm">R$</span>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 3.500 ou 8.000"
                    value={gastosFixos}
                    onChange={(e) => setGastosFixos(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  4. Como está sua situação atual com Dívidas e Cartão de Crédito?
                </label>
                <div className="space-y-2">
                  {SITUACAO_DIVIDAS.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => setDividas(d.id)}
                      className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 ${
                        dividas === d.id
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{d.icon}</span>
                      <span className="flex-1">{d.label}</span>
                      {dividas === d.id && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  5. Você possui Reserva de Emergência?
                </label>
                <div className="space-y-2">
                  {RESERVA_PF.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setReserva(r.id)}
                      className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${
                        reserva === r.id
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{r.label}</span>
                      {reserva === r.id && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  6. Qual é o seu principal objetivo financeiro agora?
                </label>
                <div className="space-y-2">
                  {OBJETIVOS_PF.map((o) => (
                    <button
                      type="button"
                      key={o.id}
                      onClick={() => setObjetivo(o.id)}
                      className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 ${
                        objetivo === o.id
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{o.icon}</span>
                      <span className="flex-1">{o.label}</span>
                      {objetivo === o.id && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-4 border border-slate-700 hover:border-slate-500 text-slate-300 font-bold rounded-xl transition-colors text-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-base cursor-pointer"
                >
                  Ver Meu Raio-X Pessoal
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

          {/* PASSO 3: CONTATO */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center mb-6">
                <h3 className="text-lg font-extrabold text-white mb-1">
                  Seu Raio-X Financeiro Pessoal está pronto!
                </h3>
                <p className="text-xs text-slate-400">
                  Informe onde deseja receber o resultado detalhado com as recomendações práticas.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Seu Nome Completo:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Santos"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Seu WhatsApp (com DDD):</label>
                <input
                  type="tel"
                  required
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Seu Melhor E-mail:</label>
                <input
                  type="email"
                  required
                  placeholder="maria@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={consentimento}
                    onChange={(e) => setConsentimento(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950"
                  />
                  <span>
                    Autorizo o uso dos dados exclusivamente para gerar meu diagnóstico, conforme a{' '}
                    <NextLink href="/privacidade" className="text-emerald-400 underline">
                      Política de Privacidade
                    </NextLink>.
                  </span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-4 border border-slate-700 hover:border-slate-500 text-slate-300 font-bold rounded-xl transition-colors text-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-black py-4 rounded-xl transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Calculando...' : 'Liberar Meu Raio-X Agora'}
                  <Sparkles className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

          {/* PASSO 4: RESULTADO DO DIAGNÓSTICO PF */}
          {step === 4 && resultadoScore && (
            <div className="space-y-8 animate-fadeIn">
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase tracking-wide mb-3">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Raio-X Pessoal Concluído
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
                  Saúde Financeira: {nome}
                </h2>
                <p className="text-xs text-slate-400">
                  Ocupação: {ocupacao} · Renda Mensal: {renda}
                </p>
              </div>

              {/* Score Box */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center relative overflow-hidden">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Índice de Saúde Financeira Pessoal
                </p>
                <div className="flex items-center justify-center gap-2 my-2">
                  <span className={`text-6xl font-black tracking-tight ${resultadoScore.cor}`}>
                    {resultadoScore.score}
                  </span>
                  <span className="text-slate-600 text-2xl font-bold">/ 100</span>
                </div>
                <p className={`text-sm font-black uppercase tracking-wide mt-1 ${resultadoScore.cor}`}>
                  {resultadoScore.nivel}
                </p>
                <p className="text-xs text-slate-400 max-w-lg mx-auto mt-4 leading-relaxed">
                  {resultadoScore.diagnostico}
                </p>
              </div>

              {/* Regra 50/30/20 Visual */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/60">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Divisão Recomendada do seu Orçamento (Regra 50/30/20):
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="font-extrabold text-amber-400 text-sm">50%</p>
                    <p className="text-slate-300 font-semibold mt-0.5">Essenciais</p>
                    <p className="text-[10px] text-slate-500">Moradia, Contas, Alimentação</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="font-extrabold text-blue-400 text-sm">30%</p>
                    <p className="text-slate-300 font-semibold mt-0.5">Estilo de Vida</p>
                    <p className="text-[10px] text-slate-500">Lazer, Conforto, Compras</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="font-extrabold text-emerald-400 text-sm">20%</p>
                    <p className="text-slate-300 font-semibold mt-0.5">Futuro / Reserva</p>
                    <p className="text-[10px] text-slate-500">Investimentos & Dívidas</p>
                  </div>
                </div>
              </div>

              {/* Recomendações */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Próximos Passos para Blindar seu Dinheiro:
                </h4>
                <div className="space-y-2.5">
                  {resultadoScore.recomendacoes.map((rec, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box de Ação - WhatsApp */}
              <div className="p-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 text-center space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-white mb-1">
                    Quer ajuda para organizar suas finanças e montar seu plano de ação?
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Fale com nosso especialista no WhatsApp para tirar dúvidas e receber orientações personalizadas para a sua realidade.
                  </p>
                </div>

                <a
                  href={waUrlDevolutiva}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black px-8 py-4 rounded-2xl shadow-xl shadow-emerald-500/25 transition-all text-sm sm:text-base"
                >
                  <MessageCircle className="w-5 h-5" />
                  Receber Orientação no WhatsApp
                  <ArrowRight className="w-4 h-4" />
                </a>

                <p className="text-[11px] text-slate-500">
                  Sem custo · 100% confidencial · Resposta rápida
                </p>
              </div>

              <div className="text-center pt-2">
                <NextLink
                  href="/"
                  className="text-xs text-slate-400 hover:text-emerald-300 font-semibold underline transition-colors"
                >
                  ← Voltar para a Página Principal da AnalisAI.me
                </NextLink>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* ── RODAPÉ ── */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-600">
        <p>© {new Date().getFullYear()} AnalisAI.me · Solucione Assessoria Virtual · Diagnóstico Pessoal</p>
      </footer>
    </div>
  );
}
