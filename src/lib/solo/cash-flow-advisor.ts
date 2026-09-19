import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { formatDueDateDetails } from './date-utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

const LEGAL_DISCLAIMER = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *Nota Legal:* As orientações deste assistente têm caráter estritamente consultivo e educativo com base nas informações enviadas. A decisão financeira e jurídica final cabe exclusivamente ao empresário, isentando a Solucione e o AnalisAí de quaisquer responsabilidades, ônus ou consequências de suas decisões operacionais.`;

export async function generateCashFlowPostponeAdvice(
  clientId: string,
  availableCash?: number
): Promise<string> {
  const supabase = createServiceRoleClient();

  // 1. Busca contas a pagar em aberto do cliente
  const { data: openBills, error } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .eq('type', 'payable')
    .in('status', ['open', 'postponed'])
    .order('current_due_date', { ascending: true });

  if (error || !openBills || openBills.length === 0) {
    return `Não identifiquei nenhuma conta a pagar em aberto no seu Livro Caixa no momento.

📝 *Como funciona o Consultor de Caixa:*
Assim que você envia fotos ou PDFs dos seus boletos (energia, fornecedores, aluguel), o AnalisAí registra os valores e vencimentos automaticamente.
Com esses boletos agendados, quando você perguntar *"qual conta devo atrasar?"*, eu calculo os juros e os riscos jurídicos de cada uma e indico a melhor decisão para proteger seu fluxo de caixa e seu patrimônio!

👉 Envie uma foto ou PDF de boleto agora para começarmos!`;
  }

  const totalOpen = openBills.reduce((acc, b) => acc + Number(b.amount), 0);

  // 2. Monta o contexto para o raciocínio do Gemini com data exata e dia da semana
  const billsContext = openBills
    .map(
      (b, idx) =>
        `${idx + 1}. Fornecedor: "${b.counterparty_name}" | Valor: R$ ${Number(b.amount).toFixed(2)} | Vencimento: ${formatDueDateDetails(b.current_due_date)} | Criticidade (1-5): ${b.criticality_score || 3} | Notas: ${b.notes || 'Nenhuma'}`
    )
    .join('\n');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: `Você é o Consultor Sênior de Fluxo de Caixa e Blindagem Patrimonial do AnalisAí Solo.
Seu trabalho é orientar autônomos, MEIs e empresários em momentos de aperto financeiro, analisando com extrema sensibilidade os riscos operacionais, contratuais e JURÍDICOS de cada conta.

MATRIZ DE RISCO CRÍTICO E JURÍDICO INEGOCIÁVEL (NUNCA RECOMENDAR ADIAR):
1. PENSÃO ALIMENTÍCIA: Risco iminente de prisão civil (art. 528 CPC). Criticidade 5/5. NUNCA adiar sob qualquer hipótese.
2. ACORDO JUDICIAL / TERMO DE CONCILIAÇÃO (TRT, TJ, CEJUSC): Atraso de 1 dia gera multa de 30% a 50% e bloqueio instantâneo de contas via SISBAJUD. Criticidade 5/5. NUNCA adiar.
3. FINANCIAMENTO HABITACIONAL / IMOBILIÁRIO (Caixa, Bancos): 3 parcelas em atraso dão direito ao banco de executar a garantia fiduciária e leiloar o imóvel. Criticidade 5/5.
4. FINANCIAMENTO DE VEÍCULO (Alienação Fiduciária): Atraso a partir de 2 ou 3 parcelas permite Ação de Busca e Apreensão liminar do veículo. Criticidade 4.5/5.
5. INSS RETIDO DE FUNCIONÁRIOS / FGTS: Deixar de repassar INSS descontado em folha configura Crime de Apropriação Indébita Previdenciária (art. 168-A CP). Criticidade 5/5.
6. SERVIÇOS ESSENCIAIS COM AVISO DE CORTE (Energia, Água, Internet): Paralisação física das operações e vendas.

CONTAS COM FLEXIBILIDADE DE NEGOCIAÇÃO (CANDIDATAS A POSTERGAÇÃO):
- Fornecedores de insumos ou embalagens com relacionamento de parceria;
- Prestadores de serviços secundários;
- Boletos comuns sem cláusulas de garantia real ou bloqueio judicial.

ESTRUTURA DA RESPOSTA:
- 🎯 **Recomendação Direta**: Qual boleto atrasar primeiro (valor e vencimento completo com dia da semana).
- 🛡️ **Proteja Imediatamente (Riscos Críticos e Jurídicos)**: Alerte com firmeza quais contas NÃO podem ser postergadas (ex: risco de busca e apreensão, penhora ou corte).
- 💬 **Texto Pronto de Negociação**: Modelo curto e cordial para o cliente enviar no WhatsApp do fornecedor pedindo prazo sem atrito.`,
    });

    const prompt = `Analise a situação de caixa deste cliente e forneça sua recomendação especializada:
- Saldo em caixa informado no momento: ${availableCash ? `R$ ${availableCash.toFixed(2)}` : 'Aperto temporário sem valor exato informado'}
- Total de contas em aberto: R$ ${totalOpen.toFixed(2)}
- Lista das contas:
${billsContext}`;

    const result = await model.generateContent(prompt);
    const textAdvice = result.response.text();
    return `${textAdvice}\n\n${LEGAL_DISCLAIMER}`;
  } catch (err) {
    console.error('[Cash Flow Advisor Gemini Error]:', err);

    // Fallback heurístico inteligente de sensibilidade crítica
    const highRiskTerms = ['pensão', 'pensao', 'acordo', 'judicial', 'processo', 'trt', 'financiamento', 'veículo', 'veiculo', 'parcela', 'inss', 'fgts', 'energia', 'copel', 'enel', 'água', 'sabesp', 'sanepar'];
    
    const flexibleBills = openBills.filter(b => {
      const name = b.counterparty_name.toLowerCase();
      return !highRiskTerms.some(term => name.includes(term));
    });

    const criticalBills = openBills.filter(b => {
      const name = b.counterparty_name.toLowerCase();
      return highRiskTerms.some(term => name.includes(term));
    });

    const targetPostpone = flexibleBills.length > 0 ? flexibleBills[0] : openBills[openBills.length - 1];

    let fallbackText = `🎯 *Recomendação Direta de Caixa:*
`;
    fallbackText += `Recomendo postergar o pagamento da conta de *${targetPostpone.counterparty_name}* (R$ ${Number(targetPostpone.amount).toFixed(2)} - Vencimento: ${formatDueDateDetails(targetPostpone.current_due_date)}).

`;

    if (criticalBills.length > 0) {
      fallbackText += `🛡️ *Proteja Imediatamente (Risco Crítico ou Jurídico):*
`;
      criticalBills.forEach(b => {
        fallbackText += `• *${b.counterparty_name}* (R$ ${Number(b.amount).toFixed(2)} - ${formatDueDateDetails(b.current_due_date)})
`;
      });
      fallbackText += `
`;
    }

    fallbackText += `💬 *Texto Pronto para Negociação:* Copie e envie ao fornecedor:
`;
    fallbackText += `_"Olá! Devido a um ajuste pontual no nosso cronograma de recebimentos, gostaríamos de solicitar a prorrogação do vencimento para a próxima semana. Agradecemos a costumeira parceria!"_

`;
    fallbackText += LEGAL_DISCLAIMER;

    return fallbackText;
  }
}
