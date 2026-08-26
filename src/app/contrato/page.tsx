'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Shield, CheckCircle2 } from 'lucide-react';

export default function ContratoPage() {
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
            href="/docs/Contrato_Modular_BPO_AnalisAi.docx"
            download
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Baixar DOCX
          </a>
        </div>
      </header>

      {/* ── CONTEÚDO ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-24">
        
        {/* Banner do documento */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 mb-10 text-left relative overflow-hidden shadow-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Modelo Transparente</span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">Contrato Modular de Prestação de Serviços — BPO Financeiro</h1>
            </div>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4">
            Disponibilizamos publicamente nosso modelo padrão de contrato para consulta e transparência. Este modelo estabelece com clareza a limitação de acessos, zero movimentação e as obrigações formais de confidencialidade.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/docs/Contrato_Modular_BPO_AnalisAi.docx"
              download
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all"
            >
              <Download className="w-4 h-4" /> Baixar Arquivo Editável (.DOCX)
            </a>
          </div>
        </div>

        {/* Texto do Contrato */}
        <article className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-12 text-slate-300 text-sm leading-relaxed space-y-6 text-left">
          
          <div className="border-b border-slate-800 pb-6">
            <h2 className="text-lg font-bold text-white mb-2">CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BPO FINANCEIRO MODELO MODULAR — AnalisAI.me</h2>
            <p className="text-xs text-slate-400">Solucione Assessoria Virtual · CNPJ: 57.740.336/0001-08</p>
          </div>

          <p>
            Pelo presente instrumento particular, de um lado: <br />
            <strong className="text-white">CONTRATADA: Solucione Assessoria Virtual (AnalisAI.me)</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 57.740.336/0001-08, doravante denominada simplesmente &quot;CONTRATADA&quot;; e, de outro lado, <br />
            <strong className="text-white">CONTRATANTE: [RAZÃO SOCIAL OU NOME DO CLIENTE]</strong>, inscrita no CNPJ/CPF sob o nº [00.000.000/0000-00], doravante denominada simplesmente &quot;CONTRATANTE&quot;; têm entre si justo e contratado o presente Contrato de Prestação de Serviços de BPO Financeiro, regido pelas cláusulas seguintes:
          </p>

          <h3 className="text-base font-bold text-amber-400 pt-2">CLÁUSULA 1ª — DO OBJETO E DOS MÓDULOS CONTRATADOS</h3>
          <p>O presente contrato tem por objeto a prestação, pela CONTRATADA à CONTRATANTE, dos serviços de BPO Financeiro assinalados abaixo, os quais compõem o escopo efetivo da contratação:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li><strong>Contas a Pagar e a Receber:</strong> organização, agendamento e controle de cobranças e vencimentos, para aprovação e efetivação final pela CONTRATANTE.</li>
            <li><strong>Conciliação Bancária:</strong> conferência de entradas e saídas com base em extratos e saldos fornecidos pela CONTRATANTE.</li>
            <li><strong>Fluxo de Caixa Projetado:</strong> projeção de entradas e saídas para os próximos 30 a 90 dias.</li>
            <li><strong>DRE Gerencial Mensal:</strong> elaboração de demonstração de resultado gerencial simplificada.</li>
            <li><strong>Suporte Fiscal &amp; Notas:</strong> organização e envio de documentos fiscais à contabilidade da CONTRATANTE.</li>
            <li><strong>Relatórios Executivos:</strong> resumo periódico de indicadores financeiros.</li>
            <li><strong>Acesso à Plataforma AnalisAI (IA Preditiva):</strong> quando disponibilizada, nos termos de módulo contratual específico.</li>
          </ul>

          <h3 className="text-base font-bold text-amber-400 pt-2">CLÁUSULA 2ª — DO ACESSO A DADOS E DA LIMITAÇÃO DE MOVIMENTAÇÃO</h3>
          <p><strong>2.1.</strong> Para a execução dos módulos contratados — em especial Conciliação Bancária e Contas a Pagar/Receber — a CONTRATANTE fornecerá ou autorizará o acesso da CONTRATADA a extratos bancários, saldos, boletos, comprovantes e demais documentos financeiros necessários.</p>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 my-2 text-slate-200">
            <p className="font-bold text-amber-400 mb-2">2.2. A CONTRATADA declara e a CONTRATANTE reconhece que, independentemente dos módulos contratados:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
              <li>A CONTRATADA <strong>NÃO realizará pagamentos, transferências, PIX ou qualquer movimentação financeira</strong> na conta da CONTRATANTE;</li>
              <li>A CONTRATADA <strong>NÃO solicitará nem armazenará senhas de acesso</strong> a internet banking, aplicativos financeiros ou tokens de autenticação bancária;</li>
              <li>Toda efetivação de pagamento, transferência ou movimentação financeira é de <strong>responsabilidade exclusiva da CONTRATANTE</strong> ou de pessoa por ela formalmente designada.</li>
            </ul>
          </div>
          <p><strong>2.3.</strong> O acesso da CONTRATADA aos dados financeiros da CONTRATANTE tem finalidade estritamente de registro, organização, conciliação e elaboração de relatórios, não conferindo à CONTRATADA qualquer poder de disposição sobre os recursos da CONTRATANTE.</p>

          <h3 className="text-base font-bold text-amber-400 pt-2">CLÁUSULA 3ª — DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)</h3>
          <p><strong>3.1.</strong> A CONTRATADA obriga-se a manter absoluto sigilo sobre todas as informações financeiras, comerciais, fiscais e estratégicas da CONTRATANTE às quais tiver acesso em razão da execução deste contrato.</p>
          <p><strong>3.2.</strong> Todos os colaboradores, prepostos ou subcontratados da CONTRATADA com acesso a tais informações estarão vinculados a obrigação equivalente de confidencialidade (NDA).</p>
          <p><strong>3.3.</strong> O tratamento de dados pessoais no âmbito deste contrato observará a Lei nº 13.709/2018 (LGPD), nos termos da Política de Privacidade disponível em analisai.me/privacidade.</p>

          <h3 className="text-base font-bold text-amber-400 pt-2">CLÁUSULA 4ª — DAS OBRIGAÇÕES DA CONTRATADA</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Executar os serviços contratados com zelo, diligência técnica e dentro dos prazos acordados.</li>
            <li>Manter os dados e documentos da CONTRATANTE organizados e disponíveis para consulta durante a vigência contratual.</li>
            <li>Não movimentar, sob qualquer hipótese, os recursos financeiros da CONTRATANTE, conforme Cláusula 2ª.</li>
          </ul>

          <h3 className="text-base font-bold text-amber-400 pt-2">CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATANTE</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Fornecer, com veracidade e tempestividade, os extratos, comprovantes e documentos necessários.</li>
            <li>Efetivar pessoalmente, ou por meio de pessoa autorizada, todos os pagamentos agendados pela CONTRATADA.</li>
            <li>Efetuar o pagamento pontual da remuneração acordada.</li>
          </ul>

          <h3 className="text-base font-bold text-amber-400 pt-2">CLÁUSULA 6ª — DA REMUNERAÇÃO E VIGÊNCIA</h3>
          <p>Pelos serviços contratados de BPO Financeiro, a CONTRATANTE pagará à CONTRATADA o valor mensal acordado na contratação sob medida. Este contrato vigora por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso prévio por escrito de 30 dias.</p>

          <h3 className="text-base font-bold text-amber-400 pt-2">CLÁUSULA 7ª — DO DIAGNÓSTICO FINANCEIRO &amp; CICLO DE 2 REANÁLISES</h3>
          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 my-2 text-slate-300 space-y-2.5 text-xs leading-relaxed">
            <p className="font-bold text-amber-400 text-sm">Disposições Específicas do Ciclo de Diagnóstico:</p>
            <p><strong>7.1. Objeto:</strong> A contratação avulsa do Diagnóstico Financeiro (R$ 197) confere à CONTRATANTE a emissão de Relatório Executivo Oficial estruturado e o direito a 2 (duas) reanálises programadas nos marcos de 45 e 90 dias a contar da data de confirmação do pagamento.</p>
            <p><strong>7.2. Janela de Tolerância de 5 Dias Corridos:</strong> A realização de cada reanálise deve ocorrer impreterivelmente dentro da janela de até <strong>5 (cinco) dias corridos subsequentes</strong> à abertura de cada marco temporal (aos 45 e 90 dias).</p>
            <p><strong>7.3. Preclusão da Etapa:</strong> A não realização da reanálise pelo cliente dentro do prazo de tolerância de 5 dias corridos do ciclo vigente acarreta a perda definitiva do direito àquela etapa específica, ficando vedada a cumulação de reanálises no ciclo seguinte.</p>
            <p><strong>7.4. Validade Máxima:</strong> O ciclo total de acompanhamento e o acesso à sala de coleta expiram em 90 dias corridos (+ 5 dias corridos de tolerância final).</p>
          </div>

          <h3 className="text-base font-bold text-amber-400 pt-2">CLÁUSULA 8ª — DO FORO</h3>
          <p>Fica eleito o Foro da Comarca da sede da CONTRATADA para dirimir quaisquer dúvidas ou litígios decorrentes deste Contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

        </article>

        {/* Footer da página de contrato */}
        <div className="mt-10 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Solucione Assessoria Virtual (AnalisAI.me) · CNPJ 57.740.336/0001-08</p>
        </div>

      </main>

    </div>
  );
}
