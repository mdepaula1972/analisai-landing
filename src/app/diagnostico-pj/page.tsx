'use client';

import React, { useState } from 'react';
import Link from 'next/image';
import NextLink from 'next/link';
import Image from 'next/image';
import {
  Building2, TrendingUp, AlertTriangle, CheckCircle2,
  ArrowRight, ArrowLeft, Sparkles, Shield, Clock,
  MessageCircle, BarChart3, Lock, Zap, Check
} from 'lucide-react';
import { WHATSAPP } from '@/lib/contact';

const SETORES_PJ = [
  'Comércio / Varejo',
  'Prestação de Serviços',
  'Clínicas / Saúde',
  'Tecnologia / Software',
  'Construção / Engenharia',
  'Alimentação / Gastronomia',
  'Outro Segmento',
];

const FAIXAS_FATURAMENTO = [
  'Até R$ 15.000 / mês',
  'R$ 15.000 a R$ 40.000 / mês',
  'R$ 40.000 a R$ 100.000 / mês',
  'R$ 100.000 a R$ 300.000 / mês',
  'Acima de R$ 300.000 / mês',
];

const GARGALOS_PJ = [
  { id: 'mistura', label: 'Misturo contas pessoais com as da empresa', icon: '💳' },
  { id: 'lucro_cego', label: 'Vendo bem, mas não sei quanto realmente sobra no final', icon: '❓' },
  { id: 'caixa_apertado', label: 'Falta de capital de giro e surpresas no fim do mês', icon: '⚠️' },
  { id: 'tempo_perdido', label: 'Perco horas preciosas pagando contas e conciliando planilhas', icon: '⏳' },
  { id: 'inadimplencia', label: 'Cobrança desorganizada e clientes inadimplentes', icon: '📉' },
];

export default function DiagnosticoPjPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Formulário
  const [nomeNegocio, setNomeNegocio] = useState('');
  const [setor, setSetor] = useState('');
  const [faturamento, setFaturamento] = useState('');
  const [custosFixos, setCustosFixos] = useState('');
  const [gargalo, setGargalo] = useState('');
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

  // Validação dos passos
  const handleAvancarPasso1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNegocio.trim() || !setor || !faturamento) {
      setErrorMsg('Por favor, preencha o nome da empresa, setor e faturamento.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleAvancarPasso2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custosFixos.trim() || !gargalo) {
      setErrorMsg('Por favor, informe os custos fixos aproximados e selecione seu principal gargalo.');
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

    // Cálculo do Score
    let score = 70;
    if (gargalo === 'mistura') score -= 25;
    if (gargalo === 'lucro_cego') score -= 20;
    if (gargalo === 'caixa_apertado') score -= 30;
    if (gargalo === 'tempo_perdido') score -= 15;
    if (gargalo === 'inadimplencia') score -= 20;

    let nivel = 'Saúde Operacional Moderada';
    let cor = 'text-amber-400';
    let diagnostico = 'Sua empresa possui volume de faturamento, mas há vazamento de eficiência financeira e falta de visibilidade nos números gerenciais.';
    let recomendacoes = [
      'Separar imediatamente a conta bancária física da jurídica.',
      'Implantar rotina diária de conciliação para eliminar despesas fantasmas.',
      'Estruturar DRE Gerencial mensal para enxergar a margem líquida real.',
    ];

    if (score < 50) {
      nivel = 'Zona de Alerta Crítico';
      cor = 'text-red-400';
      diagnostico = 'Seus gargalos atuais indicam risco iminente de asfixia de caixa e sobrecarga de gestão. É urgente estancar os vazamentos.';
      recomendacoes = [
        'Auditoria emergencial de contas a pagar e contratos recorrentes.',
        'Renegociação de despesas fixas para recompor margem.',
        'Terceirização da operação de contas para focar em vendas e clientes.',
      ];
    } else if (score >= 75) {
      nivel = 'Boa Estrutura com Potencial de Escala';
      cor = 'text-emerald-400';
      diagnostico = 'Sua empresa opera com boa base, mas pode acelerar o lucro e liberar tempo da diretoria profissionalizando a rotina com BPO.';
      recomendacoes = [
        'Elaborar projeção de fluxo de caixa futuro de 90 dias.',
        'Monitorar EBITDA e FCL mensalmente com painel digital.',
        'Eliminar tarefas braçais de pagamentos para focar na expansão.',
      ];
    }

    const resultadoFinal = { score, nivel, cor, diagnostico, recomendacoes };
    setResultadoScore(resultadoFinal);

    try {
      await fetch('/api/leads/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'PJ',
          nome,
          email,
          whatsapp,
          empresa_ou_ocupacao: nomeNegocio,
          setor,
          faturamento_ou_renda: faturamento,
          custos_ou_gastos: `R$ ${custosFixos}`,
          desafio_ou_objetivo: GARGALOS_PJ.find((g) => g.id === gargalo)?.label || gargalo,
          score_ou_classificacao: `${score}/100 — ${nivel}`,
          detalhes_adicionais: {
            diagnostico,
            recomendacoes,
          },
        }),
      });
    } catch (err) {
      console.error('Erro ao enviar lead:', err);
    } finally {
      setLoading(false);
      setStep(4);
    }
  };

  const waLeadMsg = encodeURIComponent(
    `Olá! Acabei de fazer o Diagnóstico Empresarial Gratuito na AnalisAI.me para a empresa "${nomeNegocio}" (Score: ${resultadoScore?.score}/100 - ${resultadoScore?.nivel}) e gostaria de receber a devolutiva completa do especialista.`
  );
  const waUrlDevolutiva = `https://wa.me/${WHATSAPP.diagnostico.split('text=')[0].replace(/[^0-9]/g, '')}?text=${waLeadMsg}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">

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
            <span className="hidden sm:inline-flex text-[9px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Raio-X PJ Gratuito
            </span>
          </NextLink>

          <div className="flex items-center gap-3">
            <NextLink
              href="/diagnostico-pf"
              className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
            >
              É Pessoa Física? <span className="underline">Diagnóstico PF</span>
            </NextLink>
            <NextLink
              href="/"
              className="text-xs font-bold text-amber-300 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-xl hover:bg-amber-500/20 transition-colors hidden md:inline-flex"
            >
              Conhecer BPO Financeiro
            </NextLink>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        {step < 4 && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" /> 100% Gratuito · Avaliação em 2 Minutos
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-3">
              Descubra onde sua empresa está{' '}
              <span className="text-shimmer-amber">perdendo dinheiro</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Responda a 4 perguntas simples e receba na hora seu Índice de Eficiência Operacional com recomendações práticas para aumentar o lucro.
            </p>

            {/* Barra de Progresso */}
            <div className="mt-8 max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Passo {step} de 3</span>
                <span>{step === 1 ? 'Perfil do Negócio' : step === 2 ? 'Estrutura Financeira' : 'Contato'}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 rounded-full"
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

          {/* PASSO 1: DADOS DO NEGÓCIO */}
          {step === 1 && (
            <form onSubmit={handleAvancarPasso1} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  1. Qual é o nome do seu negócio ou empresa?
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Minha Empresa Ltda / Consultoria Silva"
                  value={nomeNegocio}
                  onChange={(e) => setNomeNegocio(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  2. Em qual setor seu negócio atua?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SETORES_PJ.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSetor(s)}
                      className={`p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${
                        setor === s
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{s}</span>
                      {setor === s && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  3. Qual é o faturamento médio mensal aproximado?
                </label>
                <div className="space-y-2">
                  {FAIXAS_FATURAMENTO.map((f) => (
                    <button
                      type="button"
                      key={f}
                      onClick={() => setFaturamento(f)}
                      className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${
                        faturamento === f
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{f}</span>
                      {faturamento === f && <Check className="w-4 h-4 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-4 rounded-xl transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 text-base cursor-pointer mt-8"
              >
                Próximo Passo
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* PASSO 2: ESTRUTURA E GARGALOS */}
          {step === 2 && (
            <form onSubmit={handleAvancarPasso2} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  4. Quanto a empresa gasta por mês em Custos Fixos aproximados?
                </label>
                <p className="text-xs text-slate-400 mb-3">
                  (Inclui aluguel, salários, pró-labore, ferramentas, contabilidade, luz, internet, etc.)
                </p>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-500 font-bold text-sm">R$</span>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 8.500 ou 25.000"
                    value={custosFixos}
                    onChange={(e) => setCustosFixos(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-3">
                  5. Qual é o maior gargalo financeiro da sua empresa hoje?
                </label>
                <div className="space-y-2.5">
                  {GARGALOS_PJ.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => setGargalo(g.id)}
                      className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center gap-3 ${
                        gargalo === g.id
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-lg">{g.icon}</span>
                      <span className="flex-1">{g.label}</span>
                      {gargalo === g.id && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
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
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-4 rounded-xl transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 text-base cursor-pointer"
                >
                  Ver Meu Resultado
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
                  Seu Raio-X Financeiro está pronto!
                </h3>
                <p className="text-xs text-slate-400">
                  Informe onde deseja receber a cópia do relatório com o parecer analítico.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Seu Nome Completo:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-medium"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Seu Melhor E-mail:</label>
                <input
                  type="email"
                  required
                  placeholder="joao@minhaempresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-medium"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={consentimento}
                    onChange={(e) => setConsentimento(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-950"
                  />
                  <span>
                    Autorizo o uso dos dados para geração do meu diagnóstico, conforme a{' '}
                    <NextLink href="/privacidade" className="text-amber-400 underline">
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

          {/* PASSO 4: RESULTADO DO DIAGNÓSTICO */}
          {step === 4 && resultadoScore && (
            <div className="space-y-8 animate-fadeIn">
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase tracking-wide mb-3">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Raio-X Concluído
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
                  Diagnóstico Preliminar: {nomeNegocio}
                </h2>
                <p className="text-xs text-slate-400">
                  Segmento: {setor} · Faturamento: {faturamento}
                </p>
              </div>

              {/* Score Box */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center relative overflow-hidden">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Índice de Eficiência Operacional
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

              {/* Recomendações */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Principais Ações Recomendadas:
                </h4>
                <div className="space-y-2.5">
                  {resultadoScore.recomendacoes.map((rec, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box de Ação - WhatsApp do Consultor */}
              <div className="p-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 text-center space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-white mb-1">
                    Quer entender exatamente onde cortar custos e destravar seu lucro?
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Nossa equipe preparou uma devolutiva técnica gratuita de 30 minutos para analisar os números do seu negócio e mostrar como organizar seu financeiro.
                  </p>
                </div>

                <a
                  href={waUrlDevolutiva}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black px-8 py-4 rounded-2xl shadow-xl shadow-emerald-500/25 transition-all text-sm sm:text-base"
                >
                  <MessageCircle className="w-5 h-5" />
                  Agendar Devolutiva Gratuita no WhatsApp
                  <ArrowRight className="w-4 h-4" />
                </a>

                <p className="text-[11px] text-slate-500">
                  Sem custo · Sem compromisso · 100% focado no seu negócio
                </p>
              </div>

              <div className="text-center pt-2">
                <NextLink
                  href="/"
                  className="text-xs text-slate-400 hover:text-amber-300 font-semibold underline transition-colors"
                >
                  ← Conhecer os Planos e Serviços de BPO Financeiro da Solucione
                </NextLink>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* ── RODAPÉ ── */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-600">
        <p>© {new Date().getFullYear()} AnalisAI.me · Solucione Assessoria Virtual · Diagnóstico Empresarial</p>
      </footer>
    </div>
  );
}
