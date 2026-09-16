import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { formatDueDateDetails } from './date-utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

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
    .eq('status', 'open')
    .order('current_due_date', { ascending: true });

  if (error || !openBills || openBills.length === 0) {
    return `Não identifiquei nenhuma conta a pagar em aberto no seu Livro Caixa no momento.

📝 *Como funciona o Consultor de Caixa:*
Assim que você envia fotos ou PDFs dos seus boletos (energia, fornecedores, aluguel), o AnalisAí registra os valores e vencimentos automaticamente.
Com esses boletos agendados, quando você perguntar *"qual conta devo atrasar?"*, eu calculo os juros de cada uma e indico a melhor decisão para proteger seu fluxo de caixa!

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
      model: 'gemini-2.5-flash',
      systemInstruction: `Você é o Consultor Sênior de Fluxo de Caixa do AnalisAí Solo.
Seu trabalho é apoiar autônomos, MEIs e microempresários que estão enfrentando aperto temporário de caixa, indicando exatamente qual conta pagar e qual postergar com o menor risco.

DIRETRIZES DE DECISÃO CONTÁBIL:
1. SERVIÇOS ESSENCIAIS (Energia, Água, Internet, Telefonia): NÃO adiar se houver risco de corte iminente. A interrupção paralisa as vendas da empresa.
2. ALUGUEL / IMÓVEL: Avaliar juros e multas contratuais (geralmente 10% mais juros diários). Se for adiar, deve ser alinhado com a imobiliária.
3. FORNECEDORES DE INSUMOS/MERCADORIAS: Priorizar postergação daqueles com melhor relacionamento ou onde a multa de mora seja menor que o custo de capital de giro.
4. FORNECEDORES DE SERVIÇOS NÃO CRÍTICOS: Podem ser postergados com aviso cordial.

IMPORTANTE SOBRE DATAS:
Sempre cite as contas mencionando a data de vencimento completa com o dia da semana (ex: 15/09/2026 - Terça-feira) para que o cliente saiba exatamente o dia sem precisar fazer contas mentais.

ESTRUTURA DA RESPOSTA (Mantenha concisa, clara e empática no WhatsApp):
- 🎯 **Recomendação Direta**: Qual boleto atrasar primeiro, mencionando o valor e o dia exato do vencimento com dia da semana.
- 🛡️ **Proteja Imediatamente**: Quais contas NÃO devem ser atrasadas sob nenhuma hipótese.
- 💬 **Texto Pronto de Negociação**: Um modelo curto de mensagem de WhatsApp para o cliente copiar e enviar ao fornecedor pedindo prorrogação sem atrito.`,
    });

    const prompt = `Analise a situação de caixa deste cliente e forneça sua recomendação especializada:
- Saldo em caixa informado no momento: ${availableCash ? `R$ ${availableCash.toFixed(2)}` : 'Aperto temporário sem valor exato informado'}
- Total de contas em aberto: R$ ${totalOpen.toFixed(2)}
- Lista das contas:
${billsContext}`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[Cash Flow Advisor Gemini Error]:', err);
    // Fallback contábil heurístico de alta precisão
    const essentialBills = openBills.filter(b => (b.criticality_score || 3) >= 4);
    const flexibleBills = openBills.filter(b => (b.criticality_score || 3) < 4);
    const targetPostpone = flexibleBills.length > 0 ? flexibleBills[0] : openBills[openBills.length - 1];

    let fallbackText = `🎯 *Recomendação Direta de Caixa:*\n`;
    fallbackText += `Recomendo postergar o pagamento da conta de *${targetPostpone.counterparty_name}* (R$ ${Number(targetPostpone.amount).toFixed(2)} - Vencimento: ${formatDueDateDetails(targetPostpone.current_due_date)}).\n\n`;

    if (essentialBills.length > 0) {
      fallbackText += `🛡️ *Proteja Imediatamente (NÃO atrase):*\n`;
      essentialBills.forEach(b => {
        fallbackText += `• ${b.counterparty_name} (R$ ${Number(b.amount).toFixed(2)} - ${formatDueDateDetails(b.current_due_date)})\n`;
      });
      fallbackText += `\n`;
    }

    fallbackText += `💬 *Texto Pronto para Negociação:* Copie e envie ao fornecedor:\n`;
    fallbackText += `_"Olá! Tudo bem? Tivemos um imprevisto pontual no fechamento de caixa e gostaria de solicitar a prorrogação do nosso boleto de R$ ${Number(targetPostpone.amount).toFixed(2)} para o dia 25. Conseguimos emitir com essa nova data sem juros? Agradeço muito a parceria!"_`;

    return fallbackText;
  }
}

/**
 * Detecta se a mensagem do usuário solicita projeções de períodos maiores que uma semana
 * (ex: mês, 30 dias, 60 dias, projeção de fluxo de caixa futuro)
 */
export function isLongTermCashFlowQuery(cleanText: string): boolean {
  const query = cleanText.toLowerCase();
  const longTermKeywords = [
    'fluxo de caixa',
    'projeção',
    'projecao',
    'projeções',
    'projecoes',
    'mês',
    'mes',
    'próximo mês',
    'proximo mes',
    '30 dias',
    '60 dias',
    '90 dias',
    'longo prazo',
    'médio prazo',
    'medio prazo',
    'trimestre',
    'bimestre',
    'visão do mês',
    'visao do mes',
    'contas do mês',
    'contas do mes',
    'vencimentos do mês',
    'vencimentos do mes',
  ];

  return longTermKeywords.some((kw) => query.includes(kw));
}

/**
 * Detecta se a mensagem do usuário solicita consulta de contas da semana (até 7 dias)
 */
export function isWeeklyBillsQuery(cleanText: string): boolean {
  const query = cleanText.toLowerCase().trim();
  const weeklyKeywords = [
    '!semana',
    '/semana',
    'semana',
    'essa semana',
    'esta semana',
    'da semana',
    'próximos 7 dias',
    'proximos 7 dias',
    '7 dias',
    'contas',
    '!contas',
    'vencimentos',
    'agenda',
    'o que vence',
    'quais contas',
    'próximas contas',
    'proximas contas',
  ];

  return weeklyKeywords.some((kw) => query === kw || query.includes(kw));
}

/**
 * Mensagem respeitosa e educada quando o cliente solicita projeção de médio/longo prazo (> 7 dias / mês),
 * recusando a análise gratuita no fluxo diário e oferecendo o produto avulso de Fluxo de Caixa Futuro (R$ 49)
 */
export function getExtendedCashFlowProposalMessage(): string {
  const checkoutUrl = 'https://www.asaas.com/c/icv2c1fiit1781q3';

  return `📊 *Projeção Estendida de Fluxo de Caixa Futuro (30 a 90 dias)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para seu acompanhamento diário, seu plano contempla, sem qualquer custo adicional, suas contas da semana!

Para ter uma **visão estendida de médio e longo prazo (30, 60 ou 90 dias)** com diagnóstico contábil de sobras e déficits futuros, análise de sazonalidade e simulações para saber exatamente quando você pode comprar ou investir, nós temos o nosso **Relatório Executivo de Fluxo de Caixa Futuro** por apenas **R$ 49,00 avulsos**!

👉 *Contratar Relatório Executivo de Fluxo de Caixa:*
${checkoutUrl}

💳 _A liberação é imediata e o estudo contábil detalhado é gerado por IA e entregue diretamente aqui no seu WhatsApp assim que o pagamento for confirmado no Asaas!_`;
}

/**
 * Gera e entrega o Relatório Executivo de Fluxo de Caixa Futuro (30 a 90 dias)
 * acionado automaticamente após a confirmação do pagamento de R$ 49 no Asaas
 */
export async function generateExtendedCashFlowReport(
  clientId: string,
  phone: string,
  daysHorizon: number = 90
): Promise<string> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const horizonIso = new Date(now.getTime() + daysHorizon * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Busca saídas futuras agendadas
  const { data: payables } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .eq('type', 'payable')
    .eq('status', 'open')
    .gte('current_due_date', todayIso)
    .lte('current_due_date', horizonIso)
    .order('current_due_date', { ascending: true });

  // 2. Busca entradas futuras agendadas
  const { data: receivables } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .eq('type', 'receivable')
    .eq('status', 'open')
    .gte('current_due_date', todayIso)
    .lte('current_due_date', horizonIso)
    .order('current_due_date', { ascending: true });

  // 3. Busca lançamentos históricos do livro caixa para análise de média mensal
  const { data: ledgerEntries } = await supabase
    .from('cash_ledger_entries')
    .select('amount, entry_type, dre_group, entry_date')
    .eq('client_id', clientId)
    .order('entry_date', { ascending: false })
    .limit(100);

  const totalPayables = (payables || []).reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  const totalReceivables = (receivables || []).reduce((acc: number, r: any) => acc + Number(r.amount), 0);
  const netProjection = totalReceivables - totalPayables;

  // Agrupamento por períodos de 30 dias
  const m30Iso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const m60Iso = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const payablesM1 = (payables || []).filter((p: any) => p.current_due_date <= m30Iso);
  const payablesM2 = (payables || []).filter((p: any) => p.current_due_date > m30Iso && p.current_due_date <= m60Iso);
  const payablesM3 = (payables || []).filter((p: any) => p.current_due_date > m60Iso);

  const sumM1 = payablesM1.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  const sumM2 = payablesM2.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  const sumM3 = payablesM3.reduce((acc: number, p: any) => acc + Number(p.amount), 0);

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `Você é o Diretor Financeiro (CFO) e Consultor Sênior de Estratégia de Caixa do AnalisAí.
Seu cliente contratou o Relatório Executivo de Fluxo de Caixa Futuro (R$ 49,00 avulso).
Seu objetivo é entregar um diagnóstico contábil estratégico de alto padrão, empático, claro e orientado à ação para os próximos 30 a 90 dias.

DIRETRIZES DO RELATÓRIO:
1. Quadro Geral de Liquidez (Próximos 30, 60 e 90 dias).
2. Diagnóstico de Sobras e Déficits: Onde o caixa vai apertar e onde haverá folga.
3. Análise de Sazonalidade e Concentração de Vencimentos: Quais semanas concentram os maiores desembolsos.
4. Simulação de Compras e Investimentos: Parecer claro sobre se a empresa pode assumir novas compras parceladas ou investimentos agora.
5. Plano de Ação Estratégico do CFO: 3 decisões prioritárias para maximizar a rentabilidade e proteger a liquidez.

Mantenha formatação primorosa para WhatsApp (emojis corporativos, negritos e tópicos legíveis).`,
    });

    const contextPrompt = `Dados Contábeis Projetados da Empresa (Próximos ${daysHorizon} dias):
- Total de Contas a Pagar Comprometidas: R$ ${totalPayables.toFixed(2)} (${payables?.length || 0} contas)
  • Próximos 30 dias (Mês 1): R$ ${sumM1.toFixed(2)} (${payablesM1.length} contas)
  • 31 a 60 dias (Mês 2): R$ ${sumM2.toFixed(2)} (${payablesM2.length} contas)
  • 61 a 90 dias (Mês 3): R$ ${sumM3.toFixed(2)} (${payablesM3.length} contas)
- Total de Entradas e Recebíveis Previstos: R$ ${totalReceivables.toFixed(2)} (${receivables?.length || 0} recebimentos)
- Saldo Líquido Projetado do Período: R$ ${netProjection.toFixed(2)}
- Principais contas compromissadas:
${(payables || []).slice(0, 10).map((p: any) => `• ${p.counterparty_name}: R$ ${Number(p.amount).toFixed(2)} (vence ${p.current_due_date})`).join('\n')}

Gere agora o Relatório Executivo de Fluxo de Caixa Futuro para este cliente.`;

    const result = await model.generateContent(contextPrompt);
    const reportText = result.response.text();

    const fullMessage = `📊 *RELATÓRIO EXECUTIVO DE FLUXO DE CAIXA FUTURO*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${reportText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Relatório gerado pelo AnalisAí CFO com base nos compromissos agendados no seu Livro Caixa._`;

    const { sendEvolutionText } = await import('@/lib/solo/evolution');
    await sendEvolutionText({ phone, text: fullMessage });

    return fullMessage;
  } catch (err) {
    console.error('[Generate Extended Cash Flow Report Error]:', err);
    // Fallback contábil caso haja timeout na IA
    const fallback = `📊 *RELATÓRIO EXECUTIVO DE FLUXO DE CAIXA FUTURO*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos os compromissos futuros da sua empresa para os próximos 90 dias:

💰 *Mapa de Compromissos Futuros:*
• *Mês 1 (Próximos 30 dias):* R$ ${sumM1.toFixed(2)} (${payablesM1.length} contas a pagar)
• *Mês 2 (31 a 60 dias):* R$ ${sumM2.toFixed(2)} (${payablesM2.length} contas a pagar)
• *Mês 3 (61 a 90 dias):* R$ ${sumM3.toFixed(2)} (${payablesM3.length} contas a pagar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 *Total Comprometido:* R$ ${totalPayables.toFixed(2)}
📈 *Recebíveis Previstos:* R$ ${totalReceivables.toFixed(2)}
⚖️ *Saldo Projetado:* R$ ${netProjection.toFixed(2)}

🎯 *Diagnóstico do CFO:*
1. Mantenha reserva de liquidez para a concentração de vencimentos nos próximos 30 dias.
2. Evite novas compras a prazo até que o fluxo do Mês 2 se estabilize.
3. Antecipe cobranças de clientes com mais de 5 dias em aberto para reforçar o caixa.`;

    const { sendEvolutionText } = await import('@/lib/solo/evolution');
    await sendEvolutionText({ phone, text: fallback });
    return fallback;
  }
}

/**
 * Consulta e formata a relação de contas a pagar da semana (próximos 7 dias)
 */
export async function getUpcomingBillsSummary(
  clientId: string | null,
  phone?: string
): Promise<string> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const next7DaysIso = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Se for cliente cadastrado com ID
  if (clientId) {
    const { data: bills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', clientId)
      .eq('type', 'payable')
      .eq('status', 'open')
      .gte('current_due_date', todayIso)
      .lte('current_due_date', next7DaysIso)
      .order('current_due_date', { ascending: true });

    if (!bills || bills.length === 0) {
      return `📅 *Agenda Financeira da Semana (Próximos 7 Dias)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você não possui nenhuma conta a pagar cadastrada com vencimento para os próximos 7 dias! 🎉

Tudo em ordem com seu fluxo de caixa imediato.

💡 _Precisa da visão estendida do mês completo ou próximos 60 dias? Digite *Mês* para conhecer nosso Relatório de Fluxo de Caixa Futuro!_`;
    }

    const totalWeek = bills.reduce((sum, b) => sum + Number(b.amount), 0);
    const billsList = bills
      .map((b) => {
        const hasBarcode = b.barcode_or_pix ? '📋 _(código disponível)_' : '⚠️ _(sem código de barras)_';
        return `• *${formatDueDateDetails(b.current_due_date)}:* ${b.counterparty_name} — R$ ${Number(b.amount).toFixed(2)} ${hasBarcode}`;
      })
      .join('\n');

    return `📅 *Agenda Financeira da Semana (Próximos 7 Dias)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${billsList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Total previsto para a semana:* R$ ${totalWeek.toFixed(2)}

💡 _O AnalisAí vai te lembrar às 10h da véspera de cada vencimento com o código de barras prontinho para pagar!_
📊 _Precisa da visão estendida do mês completo ou próximos 60 dias? Digite *Mês* para conhecer nosso Relatório de Fluxo de Caixa Futuro!_`;
  }

  // 2. Se for lead em degustação consultando pelo telefone
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    const { data: lead } = await supabase
      .from('trial_leads')
      .select('*')
      .eq('whatsapp_number', cleanPhone)
      .maybeSingle();

    if (lead && lead.due_date && lead.amount) {
      return `📅 *Agenda Financeira — Degustação AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identifiquei seu boleto registrado em teste:
• *Vencimento:* ${formatDueDateDetails(lead.due_date)}
• *Favorecido:* ${lead.supplier_name || 'Fornecedor'}
• *Valor:* R$ ${Number(lead.amount).toFixed(2)}
• *Código de barras:* ${lead.barcode_or_pix ? 'Salvo para o lembrete' : 'Não identificado'}

💡 _Na véspera deste vencimento, às 10h em ponto, eu vou te mandar o lembrete aqui com o código de barras limpo para você pagar sem atrasos!_
📊 _Para acompanhar todas as contas do mês e ter projeção futura contínua, assine um de nossos planos!_`;
    }
  }

  return `📅 *Agenda Financeira da Semana*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Não encontrei contas cadastradas para a sua empresa nos próximos 7 dias.

👉 Envie uma foto ou PDF de boleto para agendar seu primeiro vencimento!`;
}

