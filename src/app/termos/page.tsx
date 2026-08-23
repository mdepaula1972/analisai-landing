'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Download, FileCheck, Scale } from 'lucide-react';

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* ── HEADER ── */}
      <header className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-amber-400 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>
          <Image src="/logo.png" alt="AnalisAI.me" width={320} height={90} className="h-12 sm:h-16 w-auto object-contain" />
          <a
            href="/docs/Termos_de_Uso_AnalisAi.docx"
            download
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Baixar DOCX
          </a>
        </div>
      </header>

      {/* ── CONTEÚDO ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-24">
        
        {/* Banner */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 mb-10 text-left relative overflow-hidden shadow-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Regras Gerais</span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">Termos de Uso — AnalisAI.me</h1>
            </div>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4">
            Estes Termos de Uso regulam a prestação de serviços de BPO Financeiro e o uso da plataforma AnalisAI.me operados pela Solucione Assessoria Virtual.
          </p>
          <a
            href="/docs/Termos_de_Uso_AnalisAi.docx"
            download
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all"
          >
            <Download className="w-4 h-4" /> Baixar DOCX Oficial
          </a>
        </div>

        {/* Texto dos Termos */}
        <article className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-12 text-slate-300 text-sm leading-relaxed space-y-6 text-left">
          
          <div className="border-b border-slate-800 pb-6">
            <h2 className="text-lg font-bold text-white mb-2">TERMOS DE USO — AnalisAI.me</h2>
            <p className="text-xs text-slate-400">Solucione Assessoria Virtual · CNPJ: 57.740.336/0001-08</p>
          </div>

          <h3 className="text-base font-bold text-amber-400">1. Objeto</h3>
          <p>A Solucione Assessoria Virtual (AnalisAI.me) presta serviços de terceirização financeira (BPO Financeiro), que incluem organização de contas a pagar/receber, conciliação bancária, DRE gerencial e relatórios executivos. Adicionalmente, disponibiliza o Diagnóstico Financeiro Express por Inteligência Artificial e a plataforma AnalisAI de inteligência preditiva.</p>

          <h3 className="text-base font-bold text-amber-400 pt-2">2. Regras Específicas do Diagnóstico Financeiro &amp; Ciclo de 3 Reanálises</h3>
          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 my-2 text-slate-300 space-y-3 text-xs leading-relaxed">
            <p className="font-bold text-amber-400 text-sm">Regulamento do Ciclo de Acompanhamento de 90 Dias:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Direito a 3 Reanálises Programadas:</strong> A contratação do Diagnóstico Financeiro confere ao Usuário a emissão do Relatório Inicial no ato e o direito a 3 (três) reanálises/reavaliações programadas nos marcos de <strong>30, 60 e 90 dias corridos</strong> a partir da data de confirmação do pagamento.</li>
              <li><strong>Janela de Tolerância de 5 Dias Corridos:</strong> Cada reanálise fica disponível para execução a partir da data exata de seu respectivo marco (30, 60 ou 90 dias) e deverá ser realizada pelo Usuário no prazo limite improrrogável de até <strong>5 (cinco) dias corridos subsequentes</strong> à abertura da janela.</li>
              <li><strong>Perda do Direito da Etapa (Sem Cumulação):</strong> Caso o Usuário não realize a reanálise dentro da janela de 5 dias corridos do ciclo vigente, <strong>o direito àquela reanálise específica precluirá</strong>, ficando o Usuário autorizado a realizar apenas a reanálise do ciclo subsequente quando de sua abertura (aos 60 ou 90 dias), sendo vedada a cumulação ou compensação retroativa.</li>
              <li><strong>Validade Máxima:</strong> O ciclo completo de acompanhamento e o acesso à sala de reavaliação expiram definitivamente após <strong>90 dias corridos (+ 5 dias corridos do último ciclo)</strong> da compra.</li>
            </ul>
          </div>

          <h3 className="text-base font-bold text-amber-400 pt-2">3. Natureza dos Serviços — Limites Operacionais</h3>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 my-2 text-slate-300 space-y-2 text-xs">
            <p className="font-bold text-white">Regras Claras de Atuação:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A Contratada organiza, registra e projeta informações financeiras fornecidas pelo Cliente;</li>
              <li>A Contratada <strong>NÃO realiza pagamentos, PIX ou qualquer movimentação bancária</strong> em nome do Cliente;</li>
              <li>A Contratada <strong>NÃO solicita senhas de acesso</strong> ao internet banking ou aplicativos do Cliente;</li>
              <li>Toda efetivação financeira é feita exclusivamente pelo Cliente ou por pessoa autorizada por ele;</li>
              <li>Os serviços de BPO e Diagnóstico não substituem os serviços de contabilidade fiscal/tributária.</li>
            </ul>
          </div>

          <h3 className="text-base font-bold text-amber-400 pt-2">4. Responsabilidades do Cliente</h3>
          <p>O Cliente é responsável por fornecer com veracidade e tempestividade os extratos e comprovantes necessários, bem como efetivar pessoalmente os pagamentos agendados e validados.</p>

          <h3 className="text-base font-bold text-amber-400 pt-2">5. Propriedade Intelectual</h3>
          <p>Todos os direitos sobre a marca AnalisAI.me, marca Solucione Assessoria Virtual, metodologias, softwares e inteligência preditiva pertencem exclusivamente à Contratada.</p>

          <h3 className="text-base font-bold text-amber-400 pt-2">6. Foro</h3>
          <p>Fica eleito o foro da comarca da sede da Contratada para dirimir quaisquer controvérsias oriundas destes Termos.</p>

        </article>

        <div className="mt-10 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Solucione Assessoria Virtual (AnalisAI.me) · CNPJ 57.740.336/0001-08</p>
        </div>

      </main>

    </div>
  );
}
