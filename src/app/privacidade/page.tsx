'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Download, ShieldCheck, Lock } from 'lucide-react';

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* ── HEADER ── */}
      <header className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>
          <Image src="/logo.png" alt="AnalisAI.me" width={240} height={66} className="h-10 w-auto object-contain" />
          <a
            href="/docs/Politica_de_Privacidade_AnalisAi.docx"
            download
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Baixar DOCX
          </a>
        </div>
      </header>

      {/* ── CONTEÚDO ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-24">
        
        {/* Banner */}
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 mb-10 text-left relative overflow-hidden shadow-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Proteção de Dados & LGPD</span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">Política de Privacidade — AnalisAI.me</h1>
            </div>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4">
            Esta Política de Privacidade descreve como a Solucione Assessoria Virtual (AnalisAI.me) coleta, utiliza, armazena e protege os dados pessoais e financeiros de seus clientes em conformidade com a LGPD (Lei nº 13.709/2018).
          </p>
          <a
            href="/docs/Politica_de_Privacidade_AnalisAi.docx"
            download
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all"
          >
            <Download className="w-4 h-4" /> Baixar DOCX Oficial
          </a>
        </div>

        {/* Texto do Documento */}
        <article className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-12 text-slate-300 text-sm leading-relaxed space-y-6 text-left">
          
          <div className="border-b border-slate-800 pb-6">
            <h2 className="text-lg font-bold text-white mb-2">POLÍTICA DE PRIVACIDADE — AnalisAI.me</h2>
            <p className="text-xs text-slate-400">Solucione Assessoria Virtual · CNPJ: 57.740.336/0001-08 · E-mail DPO: contato@analisai.me</p>
          </div>

          <h3 className="text-base font-bold text-emerald-400">1. Quem é o Controlador dos Dados</h3>
          <p>
            O controlador dos dados pessoais tratados no âmbito dos serviços de BPO Financeiro e da plataforma AnalisAI.me é: <br />
            <strong className="text-white">Razão Social: Solucione Assessoria Virtual (AnalisAI.me)</strong> <br />
            <strong className="text-white">CNPJ: 57.740.336/0001-08</strong> <br />
            <strong>Contato do Encarregado (DPO):</strong> contato@analisai.me
          </p>

          <h3 className="text-base font-bold text-emerald-400 pt-2">2. Quais Dados Coletamos</h3>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li><strong>Dados de identificação e contato:</strong> Nome completo, CPF/CNPJ, e-mail, telefone e cargo do responsável.</li>
            <li><strong>Dados financeiros:</strong> Extratos bancários e saldos disponibilizados pelo cliente exclusivamente para fins de conciliação bancária; boletos, notas fiscais e comprovantes de pagamento.</li>
            <li><strong>Dados de comunicação:</strong> Histórico de mensagens de atendimento via WhatsApp e e-mail.</li>
          </ul>

          <h3 className="text-base font-bold text-emerald-400 pt-2">3. O Que NÃO Fazemos com Seus Dados</h3>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 my-2 text-slate-200 space-y-2">
            <p className="font-bold text-emerald-400">Garantias Fundamentais de Segurança:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
              <li><strong>NÃO realizamos movimentações financeiras</strong>, pagamentos ou transferências em nome do cliente;</li>
              <li><strong>NÃO armazenamos senhas de acesso</strong> a contas bancárias, internet banking ou aplicativos financeiros;</li>
              <li><strong>NÃO compartilhamos dados financeiros</strong> do cliente com terceiros para fins comerciais ou publicitários;</li>
              <li><strong>NÃO vendemos ou comercializamos</strong> dados pessoais sob nenhuma hipótese.</li>
            </ul>
          </div>

          <h3 className="text-base font-bold text-emerald-400 pt-2">4. Finalidade e Base Legal (LGPD)</h3>
          <p>Tratamos os dados para execução do contrato de BPO Financeiro (Art. 7º, V da LGPD), cumprimento de obrigações fiscais (Art. 7º, II) e legítimo interesse no aprimoramento do atendimento (Art. 7º, IX).</p>

          <h3 className="text-base font-bold text-emerald-400 pt-2">5. Compartilhamento Restrito</h3>
          <p>Os dados poderão ser compartilhados exclusivamente com a contabilidade indicada pelo cliente (mediante autorização prévia) para envio de documentos fiscais, ou por determinação judicial e legal.</p>

          <h3 className="text-base font-bold text-emerald-400 pt-2">6. Direitos do Titular (Art. 18 da LGPD)</h3>
          <p>Você pode solicitar a qualquer momento a confirmação, correção, exclusão ou portabilidade dos seus dados através do e-mail <strong>contato@analisai.me</strong> ou do nosso canal oficial no WhatsApp.</p>

        </article>

        <div className="mt-10 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Solucione Assessoria Virtual (AnalisAI.me) · CNPJ 57.740.336/0001-08</p>
        </div>

      </main>

    </div>
  );
}
