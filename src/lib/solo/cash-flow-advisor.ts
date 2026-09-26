import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { formatDueDateDetails } from './date-utils';
import { getTrialBills, formatTrialBillsListMessage } from './trial';

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

  const totalOpen = openBills.reduce((acc: number, b: any) => acc + Number(b.amount), 0);

  // 2. Monta o contexto para o raciocínio do Gemini com data exata e dia da semana
  const billsContext = openBills
    .map(
      (b: any, idx: number) =>
        `${idx + 1}. Fornecedor: "${b.counterparty_name}" | Valor: R$ ${Number(b.amount).toFixed(2)} | Vencimento: ${formatDueDateDetails(b.current_due_date)} | Criticidade (1-5): ${b.criticality_score || 3} | Notas: ${b.notes || 'Nenhuma'}`
    )
    .join('\n');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
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
    
    const flexibleBills = openBills.filter((b: any) => {
      const name = b.counterparty_name.toLowerCase();
      return !highRiskTerms.some(term => name.includes(term));
    });

    const criticalBills = openBills.filter((b: any) => {
      const name = b.counterparty_name.toLowerCase();
      return highRiskTerms.some(term => name.includes(term));
    });

    const targetPostpone = flexibleBills.length > 0 ? flexibleBills[0] : openBills[openBills.length - 1];

    let fallbackText = `🎯 *Recomendação Direta de Caixa:*\n`;
    fallbackText += `Recomendo postergar o pagamento da conta de *${targetPostpone.counterparty_name}* (R$ ${Number(targetPostpone.amount).toFixed(2)} - Vencimento: ${formatDueDateDetails(targetPostpone.current_due_date)}).\n\n`;

    if (criticalBills.length > 0) {
      fallbackText += `🛡️ *Proteja Imediatamente (Risco Crítico ou Jurídico):*\n`;
      criticalBills.forEach((b: any) => {
        fallbackText += `• *${b.counterparty_name}* (R$ ${Number(b.amount).toFixed(2)} - ${formatDueDateDetails(b.current_due_date)})\n`;
      });
      fallbackText += `\n`;
    }

    fallbackText += `💬 *Texto Pronto para Negociação:* Copie e envie ao fornecedor:\n`;
    fallbackText += `_"Olá! Devido a um ajuste pontual no nosso cronograma de recebimentos, gostaríamos de solicitar a prorrogação do vencimento para a próxima semana. Agradecemos a costumeira parceria!"_\n\n`;
    fallbackText += LEGAL_DISCLAIMER;

    return fallbackText;
  }
}

/**
 * Detecta se a mensagem do usuário solicita a contratação ou relatório executivo avulso de Fluxo de Caixa Futuro (R$ 49)
 */
export function isLongTermCashFlowQuery(cleanText: string): boolean {
  const query = cleanText.toLowerCase();

  // Se o usuário estiver consultando suas contas, vencimentos, agenda ou lançamentos, NÃO cai no upsell
  if (
    query.includes('conta') ||
    query.includes('vencimento') ||
    query.includes('agenda') ||
    query.includes('despesa') ||
    query.includes('receita') ||
    query.includes('lançamento') ||
    query.includes('lancamento') ||
    query.includes('!contas') ||
    query.includes('ver') ||
    query.includes('listar') ||
    query.includes('mostrar')
  ) {
    return false;
  }

  const upsellKeywords = [
    'relatório executivo',
    'relatorio executivo',
    'relatório de fluxo de caixa',
    'relatorio de fluxo de caixa',
    'projeção de fluxo de caixa',
    'projecao de fluxo de caixa',
    'estudo de fluxo de caixa',
    'análise de fluxo de caixa futuro',
    'diagnóstico de fluxo de caixa',
    'fluxo de caixa futuro',
  ];

  return upsellKeywords.some((kw) => query.includes(kw));
}

/**
 * Detecta se a mensagem do usuário solicita consulta de contas, despesas, receitas ou agenda
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
    'minhas contas',
    'ver contas',
    'listar contas',
    'mostrar contas',
    'quais contas',
    'próximas contas',
    'proximas contas',
    'contas salvas',
    'despesas e receitas do dia a dia',
    'despesas e receitas',
    'receitas e despesas',
    'despesas',
    'receitas',
    'minhas despesas',
    'minhas receitas',
    'o que está salvo',
    'o que tem salvo',
    'o que foi salvo',
    'o que está agendado',
    'o que foi agendado',
    'o que tenho a pagar',
    'o que tenho que pagar',
    'o que pagar',
    'vencimentos',
    'agenda',
    'minha agenda',
    'o que vence',
    'consultar contas',
    'meus lançamentos',
    'meus lancamentos',
    'lançamentos',
    'lancamentos',
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

export interface BillsPeriodOption {
  periodDays: number | 'all';
  periodLabel: string;
}

/**
 * Extrai a janela de período solicitada pelo usuário (ex: semana, 15 dias, mês/30 dias, 60 dias, todas)
 */
export function extractBillsQueryPeriod(cleanText: string): BillsPeriodOption {
  const query = cleanText.toLowerCase().trim();

  if (/(?:todas|tudo|todos|completo|geral)/i.test(query)) {
    return { periodDays: 'all', periodLabel: 'Todas as Contas Agendadas' };
  }

  const matchDays = query.match(/(?:próximos|proximos|em|\b)(\d{1,3})\s*dias/i);
  if (matchDays && matchDays[1]) {
    const days = parseInt(matchDays[1], 10);
    return { periodDays: days, periodLabel: `Próximos ${days} Dias` };
  }

  if (query.includes('quinzena') || query.includes('15 dias')) {
    return { periodDays: 15, periodLabel: 'Próximos 15 Dias (Quinzena)' };
  }

  if (query.includes('semana') || query.includes('7 dias')) {
    return { periodDays: 7, periodLabel: 'Próximos 7 Dias (Semana)' };
  }

  if (query.includes('60 dias') || query.includes('dois meses') || query.includes('2 meses') || query.includes('bimestre')) {
    return { periodDays: 60, periodLabel: 'Próximos 60 Dias' };
  }

  if (query.includes('90 dias') || query.includes('trimestre') || query.includes('3 meses')) {
    return { periodDays: 90, periodLabel: 'Próximos 90 Dias' };
  }

  if (query.includes('mes') || query.includes('mês') || query.includes('mensal') || query.includes('30 dias')) {
    return { periodDays: 30, periodLabel: 'Próximos 30 Dias (Mês)' };
  }

  // Padrão amigável: Próximos 30 dias (visão completa do mês)
  return { periodDays: 30, periodLabel: 'Próximos 30 Dias' };
}

/**
 * Consulta e formata a relação de contas a pagar e receber para o período solicitado (ou todas)
 */
export async function getUpcomingBillsSummary(
  clientId: string | null,
  phone?: string,
  periodOption?: BillsPeriodOption
): Promise<string> {
  const supabase = createServiceRoleClient();
  const cleanPhone = (phone || '').replace(/\D/g, '');
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const period = periodOption || { periodDays: 30, periodLabel: 'Próximos 30 Dias' };
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const maxDueIso =
    period.periodDays === 'all'
      ? '9999-12-31'
      : new Date(now.getTime() + period.periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let rawBills: any[] = [];

  // 1. Tenta carregar do cliente em payables_receivables
  if (clientId) {
    const { data: dbBills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['open', 'postponed'])
      .order('current_due_date', { ascending: true });

    if (dbBills && dbBills.length > 0) {
      rawBills = dbBills.map((b) => ({
        supplier_name: b.counterparty_name || 'Fornecedor',
        amount: Number(b.amount || 0),
        due_date: b.current_due_date || b.original_due_date,
        entry_type: b.type === 'receivable' ? 'receivable' : 'payable',
        barcode_or_pix: b.barcode_or_pix || null,
        is_provision: false,
        is_recurring: Boolean(b.is_recurring),
      }));
    }
  }

  // 2. Se não encontrou contas no payables_receivables (ex: lead em degustação ou usuário testando como lead)
  if (rawBills.length === 0 && cleanPhone) {
    const trialBills = await getTrialBills(cleanPhone);
    if (trialBills && trialBills.length > 0) {
      rawBills = trialBills;
    } else {
      const { data: lead } = await supabase
        .from('trial_leads')
        .select('*')
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
        .maybeSingle();

      if (lead && lead.due_date && lead.amount) {
        rawBills = [
          {
            supplier_name: lead.supplier_name || 'Fornecedor',
            amount: Number(lead.amount),
            due_date: lead.due_date,
            barcode_or_pix: lead.barcode_or_pix || null,
            is_provision: false,
            entry_type: 'payable',
          },
        ];
      }
    }
  }

  if (rawBills.length === 0) {
    return `📅 *Agenda Financeira — ${period.periodLabel}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você não possui nenhuma conta cadastrada no momento.

👉 Envie uma foto ou PDF de boleto, ou envie um áudio/texto dizendo suas contas para agendar seu primeiro compromisso! 🚀`;
  }

  // Filtra as contas do período solicitado
  let filteredBills = rawBills.filter((b) => {
    if (!b.due_date) return true;
    if (period.periodDays === 'all') return true;
    return b.due_date >= todayIso && b.due_date <= maxDueIso;
  });

  let noticePrefix = '';

  // Se o usuário pediu um período curto (ex: 7 dias) e não tem contas no período, mas TEM contas futuras cadastradas
  if (filteredBills.length === 0 && rawBills.length > 0) {
    noticePrefix = `ℹ️ _Você não possui contas a vencer para os *${period.periodLabel}*! 🎉_\n💡 _Mostrando seus compromissos agendados para os próximos 30 dias:_\n\n`;
    const next30DaysIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    filteredBills = rawBills.filter((b) => !b.due_date || (b.due_date >= todayIso && b.due_date <= next30DaysIso));
    if (filteredBills.length === 0) {
      filteredBills = rawBills; // Mostra todas as contas salvas
      noticePrefix = `ℹ️ _Você não possui contas a vencer para os *${period.periodLabel}*! 🎉_\n💡 _Mostrando todas as suas contas cadastradas:_\n\n`;
    }
  }

  return noticePrefix + formatTrialBillsListMessage(filteredBills, `Agenda Financeira — ${period.periodLabel}`);
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
