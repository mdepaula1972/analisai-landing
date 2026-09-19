
/**
 * Retorna o link de convite oficial para o pioneiro VIP indicar parceiros
 */
export function getPioneerShareLink(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  const botNumber = '5514930855878';
  const text = encodeURIComponent(`Olá! Fui indicado pelo parceiro VIP ${clean} para garantir uma das 50 Vagas VIP Gratuitas do AnalisAí Solo!`);
  return `https://wa.me/${botNumber}?text=${text}`;
}

export function getPioneerShareMessage(phone: string): string {
  const link = getPioneerShareLink(phone);
  return `👑 *Compartilhe sua Vaga VIP e Ganhe Mensalidade Grátis!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você faz parte da Safra dos 50 Pioneiros VIP do AnalisAí.

🎁 *Como zerar sua assinatura:*
Indique 3 amigos, clientes ou parceiros empresariais para testarem o AnalisAí. Enquanto eles continuarem ativos no plano Solo ou superior, **sua mensalidade fica 100% por nossa conta**!

👉 *Seu link exclusivo para compartilhar no WhatsApp:*
${link}

_Encaminhe este link para seus contatos empresariais. Ao clicarem, o sistema reconhece sua indicação na hora!_`;
}
export const MAX_BETA_VIP_USERS = 50;
export const BETA_VIP_DOCS_LIMIT = 10;
export const BETA_VIP_DAYS = 30;

import { createServiceRoleClient } from '@/lib/supabase-server';
import { ASAAS_PLANS, ASAAS_ONE_OFF } from '@/lib/solo/constants';
import { formatDueDateDetails } from '@/lib/solo/date-utils';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { classifyTaxId, TaxClassification } from '@/lib/solo/tax-classifier';
import { addDays, format } from 'date-fns';

export interface TrialStatus {
  hasUsedTrial: boolean;
  docsCount: number;
  docsLimit: number;
  remainingDocs: number;
  docData?: any;
  taxType?: 'cpf' | 'mei' | 'simples' | 'empresa';
  interestedPlan?: string;
}

/**
 * Consulta se este número de WhatsApp já esgotou a sua cota de degustação gratuita
 */
export async function checkTrialStatus(phone: string): Promise<TrialStatus> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // 0. Verifica se o número ou documento está na Whitelist de QA (acesso livre sem limites)
  const { isQaWhitelisted } = await import('@/lib/solo/qa-whitelist');
  if (await isQaWhitelisted(cleanPhone) || await isQaWhitelisted(altPhone)) {
    return {
      hasUsedTrial: false,
      docsCount: 0,
      docsLimit: 99999,
      remainingDocs: 99999,
    };
  }

  const { data } = await supabase
    .from('trial_leads')
    .select('doc_processed, doc_data, trial_docs_count, trial_docs_limit, interested_plan, created_at, first_interaction_at')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (!data) {
    // Verifica se ainda há vagas abertas no lote das 50 Vagas VIP
    const { count } = await supabase
      .from('trial_leads')
      .select('*', { count: 'exact', head: true });

    const totalLeads = count || 0;
    const isVipEligible = totalLeads < MAX_BETA_VIP_USERS;
    const initialLimit = isVipEligible ? BETA_VIP_DOCS_LIMIT : 1;

    return {
      hasUsedTrial: false,
      docsCount: 0,
      docsLimit: initialLimit,
      remainingDocs: initialLimit,
    };
  }

  const docsLimit = Number(data.trial_docs_limit) || 1;
  const docsCount = Number(data.trial_docs_count) || (data.doc_processed ? 1 : 0);
  const remainingDocs = Math.max(0, docsLimit - docsCount);

  // Expiração após ciclo dos 30 Dias VIP
  const createdAt = data.first_interaction_at || data.created_at;
  let isExpiredByDays = false;
  if (createdAt) {
    const daysSinceCreated = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated > BETA_VIP_DAYS) {
      isExpiredByDays = true;
    }
  }

  const hasUsedTrial = remainingDocs <= 0 || isExpiredByDays;

  return {
    hasUsedTrial,
    docsCount,
    docsLimit,
    remainingDocs,
    docData: data.doc_data,
    interestedPlan: data.interested_plan,
  };
}

/**
 * Registra o uso da degustação gratuita para este número, incrementando a contagem de lançamentos
 * e detectando automaticamente o perfil tributário (CPF = 1, MEI = 3, Simples/Empresa = até 10)
 */
export async function recordTrialUsage(
  phone: string,
  docData: any,
  grantedLimit?: number
): Promise<void> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');

  // Consulta estado atual
  const current = await checkTrialStatus(cleanPhone);
  const newCount = current.docsCount + 1;

  // 1. Identificação inteligente do perfil tributário do lead
  let detectedLimit = current.docsLimit;
  let taxType: 'cpf' | 'mei' | 'simples' | 'empresa' = 'cpf';
  let suggestedPlan = current.interestedPlan || null;

  // Se o lead ainda tem o limite padrão inicial (<= 1) e nenhum limite manual forçado:
  if (!grantedLimit && current.docsLimit <= 1) {
    if (docData.tax_profile === 'mei') {
      detectedLimit = 3;
      taxType = 'mei';
      suggestedPlan = 'solo';
    } else if (docData.tax_profile === 'simples' || docData.tax_profile === 'empresa') {
      detectedLimit = 10;
      taxType = docData.tax_profile;
      suggestedPlan = 'pro';
    } else {
      const rawTaxId = docData.cnpj || docData.tax_id || docData.payer_tax_id || docData.counterparty_tax_id || null;
      const companyHint = docData.supplier_name || docData.counterparty_name || docData.payer_name || '';

      try {
        const classification = await classifyTaxId(rawTaxId, companyHint);
        detectedLimit = Math.max(current.docsLimit, classification.trialLimit);
        taxType = classification.type;

        if (classification.type === 'simples' || classification.type === 'empresa') {
          suggestedPlan = 'pro';
        } else if (classification.type === 'mei') {
          suggestedPlan = 'solo';
        } else {
          suggestedPlan = 'start';
        }
      } catch (classifyErr) {
        console.warn('[Trial Classification Warning]:', classifyErr);
      }
    }
  }

  const newLimit = grantedLimit || detectedLimit;

  // Recupera lista de contas já cadastradas para não perder histórico de múltiplos boletos
  const { data: leadRecord } = await supabase
    .from('trial_leads')
    .select('bills_list')
    .eq('whatsapp_number', cleanPhone)
    .maybeSingle();

  const billsList: any[] = Array.isArray(leadRecord?.bills_list) ? leadRecord.bills_list : [];
  billsList.push({
    id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    supplier_name: docData.supplier_name || docData.counterparty_name || 'Fornecedor',
    amount: docData.amount ? Number(docData.amount) : null,
    due_date: docData.due_date || null,
    barcode_or_pix: docData.barcode_or_pix || null,
    reminder_eve_sent: false,
    reminder_due_sent: false,
    created_at: new Date().toISOString(),
  });

  await supabase
    .from('trial_leads')
    .upsert(
      {
        whatsapp_number: cleanPhone,
        doc_processed: true,
        doc_data: docData,
        supplier_name: docData.supplier_name || null,
        amount: docData.amount ? Number(docData.amount) : null,
        due_date: docData.due_date || null,
        barcode_or_pix: docData.barcode_or_pix || null,
        trial_docs_count: newCount,
        trial_docs_limit: newLimit,
        interested_plan: suggestedPlan,
        bills_list: billsList,
        reminder_eve_sent: false,
        reminder_due_sent: false,
        trial_completed_at: new Date().toISOString(),
      },
      { onConflict: 'whatsapp_number' }
    );
}

/**
 * Mensagem de boas-vindas com convite para a Degustação Gratuita (sem fricção)
 */
export function getTrialWelcomeMessage(): string {
  return `👑 *Bem-vindo à Safra dos 50 Pioneiros VIP — AnalisAí Solo!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você foi contemplado com uma das **50 Vagas VIP Gratuitas** para ter seu assistente financeiro no piloto automático!

✨ *O que você ganha durante seus 30 dias VIP:*
• *Até 10 contas e boletos* cadastrados por foto, PDF, áudio ou texto;
• *Lembretes diários no WhatsApp* às 10h da véspera com código Pix pronto para cópia (evite juros e multas de atraso);
• *Relatório de Livro Caixa e DRE em PDF* com gráficos gerenciais direto no seu celular;
• *Zero planilhas e zero burocracia.*

👉 *Para começar agora mesmo:*
Envie uma foto ou PDF do seu primeiro **boleto ou nota fiscal**, ou mande um áudio/texto dizendo o que pagar (ex: *"Pagar aluguel R$ 1.500 dia 10"*).

Em segundos eu leio e já organizo seu primeiro lançamento!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *Deseja ativar seu plano oficial agora mesmo?*
• *AnalisAí Solo* (R$ 87,99/mês — menos de R$ 2,90/dia): ${ASAAS_PLANS.monthly.solo.checkoutUrl}
• *AnalisAí Start* (R$ 39,90/mês): ${ASAAS_PLANS.monthly.start.checkoutUrl}

💡 *Já é cliente e trocou de número?*
Envie seu **CPF ou CNPJ cadastrado** nesta conversa para transferir sua conta com segurança via verificação por e-mail (LGPD).`;
}

/**
 * Mensagem quando o lead esgotou sua cota de degustação gratuita
 * com adequação inteligente ao porte do cliente
 */
export function getTrialLimitReachedMessage(trialLimit: number = 1): string {
  // 1. Perfil VIP dos 50 Pioneiros (10 contas ou 30 dias concluídos)
  if (trialLimit >= 10) {
    return `🎉 *Parabéns! Durante o seu período VIP, o AnalisAí protegeu seu caixa e acompanhou 10 contas da sua empresa sem nenhum atraso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você experimentou a tranquilidade de não ser pego de surpresa na véspera de vencimentos e ter seu livro caixa organizado no piloto automático sem planilhas.

Para continuar com seus lembretes diários pontuais e relatórios em PDF ativos no próximo mês, confirme sua assinatura por apenas **menos de R$ 2,90/dia** (R$ 87,99/mês):

👉 *Assinar AnalisAí Solo:*
${ASAAS_PLANS.monthly.solo.checkoutUrl}

🎁 *Dica de Ouro — Mensalidade Grátis:*
Indique 3 amigos ou parceiros empresariais para o AnalisAí e a sua assinatura fica totalmente por nossa conta enquanto eles continuarem ativos!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*(Suas contas e relatórios continuam guardados a sete chaves aguardando sua confirmação.)*`;
  }

  // 2. Perfil MEI (já desfrutou de 3 lançamentos)
  if (trialLimit >= 3) {
    return `💼 *Você concluiu sua degustação MEI do AnalisAí!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você já organizou suas contas de teste e viu como é fácil manter seus pagamentos no piloto automático sem planilhas e sem atrasos.

Para continuar usando o robô o mês inteiro direto no seu WhatsApp, escolha seu plano:

1️⃣ *AnalisAí Solo* — R$ 87,99/mês ⭐ *Mais Escolhido*
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}
_(Até 30 lançamentos/mês, comandos por voz e texto, consultor de caixa e conciliação mensal)_

2️⃣ *AnalisAí Start* — R$ 39,90/mês
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}
_(Até 15 lançamentos/mês, livro caixa e avisos pontuais no WhatsApp)_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *Ativação imediata após confirmação no Asaas.*
Dúvidas? Pode perguntar por aqui!`;
  }

  // 3. Perfil Padrão / Pessoa Física / Autônomo (1 lançamento de demonstração)
  return `🎁 *Sua degustação gratuita foi concluída com sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para continuar organizando todas as suas contas, boletos e notas fiscais por foto, PDF, voz ou texto e receber avisos pontuais antes dos vencimentos, escolha seu plano:

1️⃣ *AnalisAí Start* — R$ 39,90/mês
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}
_(Até 15 lançamentos/mês, livro caixa e avisos pontuais no WhatsApp)_

2️⃣ *AnalisAí Solo* — R$ 87,99/mês ⭐ *Mais Escolhido*
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}
_(Até 30 lançamentos/mês, comandos por voz e texto, consultor de caixa e conciliação mensal)_

🏢 *Sua empresa possui maior volume ou múltiplos CNPJs?*
Conheça nossos planos empresariais:
• *AnalisAí Pro* (R$ 297,00/mês - 500 lançamentos & até 2 CNPJs): ${ASAAS_PLANS.monthly.pro.checkoutUrl}
• *AnalisAí Super* (R$ 597,00/mês - 1.000 lançamentos & até 4 CNPJs): ${ASAAS_PLANS.monthly.super.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *A ativação é instantânea após o pagamento no Asaas!*
Dúvidas? Pode perguntar por aqui!`;
}

/**
 * Formata o resumo do documento processado na degustação gratuita
 */
export function formatTrialDocSummary(doc: any, remainingDocs: number = 0): string {
  const dueInfo = doc.due_date ? formatDueDateDetails(doc.due_date) : 'Não identificado';
  const valFormatted = doc.amount
    ? Number(doc.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Não identificado';

  let txt = `📄 *Análise e Lançamento Concluído — Degustação AnalisAí*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `🏢 *Cedente/Fornecedor:* ${doc.supplier_name || 'Não identificado'}\n`;
  txt += `📑 *Tipo de Documento:* ${doc.document_type || 'Boleto/Conta'}\n`;
  txt += `💰 *Valor:* ${valFormatted}\n`;
  txt += `📅 *Vencimento:* ${dueInfo}\n`;
  if (doc.category) {
    txt += `📂 *Categoria:* ${doc.category}\n`;
  }

  txt += `\n💛 *Pode deixar comigo, esse já está guardado a sete chaves e monitorado!*
Na véspera do vencimento (às 10h em ponto) eu te envio o lembrete aqui com o código de barras prontinho para você pagar sem estresse e sem multas.\n`;
  txt += `🔒 *Nota:* Na degustação, salvamos os dados do lançamento para demonstrar a precisão da IA. Para ter o *Cofre Digital permanente em nuvem* com a 2ª via da imagem/PDF sempre guardada, assine um plano pago!`;

  return txt;
}

/**
 * Menu de conversão e apresentação dos recursos dos planos ativos
 */
export function getTrialConversionMenu(): string {
  return `✨ *Sabia que nos planos ativos o AnalisAí entrega muito mais para seu negócio?*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para que você tenha visão de tudo o que o robô faz no dia a dia da sua empresa, confira os recursos disponíveis em nossas assinaturas:

1️⃣ 📅 *Agenda Semanal de Contas (Incluso em todos os planos):*
• Digite *Semana* para consultar seus compromissos imediatos dos próximos 7 dias.

2️⃣ 🎙️ *Comandos por Voz e Áudio (Plano Solo):*
• Mande áudios na correria para registrar despesas, receitas ou adiar prazos sem precisar digitar.

3️⃣ 💡 *Consultor Estratégico de Caixa (Plano Solo / Solo Plus):*
• Apertou o caixa? Pergunte _"qual conta devo atrasar?"_ para ter orientação contábil sobre juros e multas.

4️⃣ 📑 *Relatórios Contábeis e DRE em PDF (Incluso em todos os planos):*
• Digite *Relatório* e receba seu Livro Caixa oficial em segundos para controle ou envio ao contador.

5️⃣ 🎁 *Mensalidade 100% Grátis por Indicação:*
• Ao assinar seu plano (1ª mensalidade paga), indique 3 parceiros que ativem um plano: suas faturas seguintes ficam **100% ISENTAS** enquanto os 3 continuarem ativos!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *Escolha o plano ideal e ative seu assistente agora mesmo:*

• *AnalisAí Start* (R$ 39,90/mês — 15 lançamentos/mês + Avisos no WhatsApp):
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}

• *AnalisAí Solo* (R$ 87,99/mês — 30 lançamentos/mês + Áudio + Consultor de Caixa):
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}

• *AnalisAí Solo Plus* (R$ 157,99/mês — 60 lançamentos/mês + Separação PJ x PF):
👉 ${ASAAS_PLANS.monthly.solo_plus.checkoutUrl}

🏢 *Precisa de múltiplos CNPJs ou mais de 500 lançamentos?*
Conheça os planos corporativos sob demanda:
• *AnalisAí Pro* (R$ 297/mês): ${ASAAS_PLANS.monthly.pro.checkoutUrl}
• *AnalisAí Super* (R$ 597/mês): ${ASAAS_PLANS.monthly.super.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Dúvidas ou faturamento corporativo? Pode responder aqui mesmo!*`;
}

export const BANK_SAFETY_NOTICE = `🛡️ *Segurança Bancária:* Antes de confirmar o pagamento no aplicativo do seu banco, confira sempre se o nome do favorecido, CNPJ e o valor na tela de confirmação correspondem exatamente ao seu credor/fornecedor. O AnalisAí realiza a leitura digital automatizada dos dados, cabendo exclusivamente ao pagador a conferência final e autorização da operação junto à sua instituição financeira.`;

/**
 * Mensagem da Véspera do Vencimento (disparo às 10h) — Etapa 1: Alívio da Prevenção e Livro Caixa
 */
export function getEveReminderMessage(lead: {
  supplier_name?: string;
  amount?: number;
  barcode_or_pix?: string;
}): string {
  const fornecedor = lead.supplier_name || 'seu fornecedor';
  const valFormatted = lead.amount
    ? Number(lead.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'valor cadastrado';

  let txt = `⏰ *Lembrete de Vencimento — AnalisAí*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `Olá! Passando para te lembrar que a sua conta de *${fornecedor}* (${valFormatted}) vence **AMANHÃ**!\n\n`;

  if (lead.barcode_or_pix) {
    txt += `📋 *Código de barras para pagar sem multas:*\n`;
    txt += `${lead.barcode_or_pix.trim()}\n\n`;
  }

  txt += `${BANK_SAFETY_NOTICE}\n\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `✨ *O Poder da Rotina no Piloto Automático:*\n`;
  txt += `Viu a tranquilidade de não ser pego de surpresa na véspera?\n\n`;
  txt += `Conheça os recursos disponíveis nos nossos planos oficiais:\n`;
  txt += `• *AnalisAí Start (R$ 39,90/mês):* 15 lançamentos/mês e lembretes diários pontuais no WhatsApp;\n`;
  txt += `• *AnalisAí Solo (R$ 87,99/mês):* 30 lançamentos, comandos por áudio, consultor de caixa e relatório de Livro Caixa em PDF;\n`;
  txt += `• *Planos Pro & Super (a partir de R$ 297/mês):* Para empresas com múltiplos CNPJs, centenas de lançamentos e conciliação bancária contínua.\n\n`;
  txt += `👉 *Escolha o plano sob medida para sua empresa:*\n`;
  txt += `• Assinar Start: ${ASAAS_PLANS.monthly.start.checkoutUrl}\n`;
  txt += `• Assinar Solo: ${ASAAS_PLANS.monthly.solo.checkoutUrl}\n`;
  txt += `• Conhecer todos os planos: https://analisai.me#planos`;

  return txt;
}

/**
 * Mensagem do Dia do Vencimento (disparo às 10h) — Etapa 2: Agilidade e Inteligência Financeira
 */
export function getDueReminderMessage(lead: {
  supplier_name?: string;
  amount?: number;
  barcode_or_pix?: string;
}): string {
  const fornecedor = lead.supplier_name || 'seu fornecedor';
  const valFormatted = lead.amount
    ? Number(lead.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'valor cadastrado';

  let txt = `🚨 *Atenção: Seu boleto vence HOJE!*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `A conta de *${fornecedor}* (${valFormatted}) vence no dia de hoje. Evite multas e juros de atraso!\n\n`;

  if (lead.barcode_or_pix) {
    txt += `📋 *Código de barras pronto para cópia:*\n`;
    txt += `${lead.barcode_or_pix.trim()}\n\n`;
  }

  txt += `${BANK_SAFETY_NOTICE}\n\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `⚡ *Agilidade e Organização Financeira:*\n`;
  txt += `Copie o código acima e liquide no app do seu banco para não pagar juros ou multas de atraso!\n\n`;
  txt += `🤖 *Cada plano é desenhado para o estágio do seu negócio:*\n`;
  txt += `• *Para Autônomos & MEIs:* Planos Start e Solo cuidam do básico essencial e avisos pontuais no WhatsApp;\n`;
  txt += `• *Para Empresas em Crescimento:* Plano Solo Plus (60 lançamentos) com conciliação mensal do seu extrato bancário;\n`;
  txt += `• *Para Grupos e Médias Empresas:* Planos Pro e Super gerenciam de 2 a 4 CNPJs com conciliação semanal e até 1.000 lançamentos/mês.\n\n`;
  txt += `👉 *Ative agora mesmo com liberação instantânea no WhatsApp:*\n`;
  txt += `• *AnalisAí Solo* (Mais Escolhido - R$ 87,99/mês): ${ASAAS_PLANS.monthly.solo.checkoutUrl}\n`;
  txt += `• *AnalisAí Pro* (Multi-CNPJ - R$ 297,00/mês): ${ASAAS_PLANS.monthly.pro.checkoutUrl}\n`;
  txt += `• *Análise de Caixa Avulsa (R$ 14,90):* ${ASAAS_ONE_OFF.cashFlowAnalysis.checkoutUrl}`;

  return txt;
}

/**
 * Processa a agenda diária de lembretes (executada às 10h da manhã)
 */
export async function processTrialReminders(): Promise<{ eveCount: number; dueCount: number }> {
  const supabase = createServiceRoleClient();

  // Data atual no fuso do Brasil
  const nowStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = nowStr.split('/').map(Number);
  const todayDate = new Date(year, month - 1, day);
  const tomorrowDate = addDays(todayDate, 1);

  const todayIso = format(todayDate, 'yyyy-MM-dd');
  const tomorrowIso = format(tomorrowDate, 'yyyy-MM-dd');

  let eveCount = 0;
  let dueCount = 0;

  // Processa Lembretes de VÉSPERA e DIA DO VENCIMENTO para TODAS as contas de cada Lead
  // Mesmo que o lead já tenha atingido o teto de 10 contas ou os 30 dias de trial,
  // continuamos informando pontualmente cada vencimento e oferecendo o plano Solo!
  const { data: allTrialLeads } = await supabase
    .from('trial_leads')
    .select('id, whatsapp_number, supplier_name, amount, due_date, barcode_or_pix, bills_list, reminder_eve_sent, reminder_due_sent')
    .eq('converted_to_client', false);

  if (allTrialLeads && allTrialLeads.length > 0) {
    for (const lead of allTrialLeads) {
      const { data: activeClient } = await supabase
        .from('clients')
        .select('id')
        .eq('whatsapp_number', lead.whatsapp_number)
        .eq('status', 'active')
        .maybeSingle();

      if (activeClient) {
        await supabase.from('trial_leads').update({ converted_to_client: true }).eq('id', lead.id);
        continue;
      }

      let billsList: any[] = Array.isArray(lead.bills_list) && lead.bills_list.length > 0
        ? [...lead.bills_list]
        : [];

      // Se bills_list estiver vazio mas o lead tiver a conta principal cadastrada:
      if (billsList.length === 0 && lead.due_date) {
        billsList.push({
          id: 'root_bill',
          supplier_name: lead.supplier_name,
          amount: lead.amount,
          due_date: lead.due_date,
          barcode_or_pix: lead.barcode_or_pix,
          reminder_eve_sent: lead.reminder_eve_sent,
          reminder_due_sent: lead.reminder_due_sent,
        });
      }

      let billsUpdated = false;

      for (const bill of billsList) {
        // 1. Lembrete de Véspera (vence amanhã)
        if (bill.due_date === tomorrowIso && !bill.reminder_eve_sent) {
          const msg = getEveReminderMessage(bill);
          await sendEvolutionText({ phone: lead.whatsapp_number, text: msg });
          bill.reminder_eve_sent = true;
          bill.reminder_eve_sent_at = new Date().toISOString();
          billsUpdated = true;
          eveCount++;
        }

        // 2. Lembrete do Dia (vence hoje)
        if (bill.due_date === todayIso && !bill.reminder_due_sent) {
          const msg = getDueReminderMessage(bill);
          await sendEvolutionText({ phone: lead.whatsapp_number, text: msg });
          bill.reminder_due_sent = true;
          bill.reminder_due_sent_at = new Date().toISOString();
          billsUpdated = true;
          dueCount++;
        }
      }

      if (billsUpdated) {
        await supabase
          .from('trial_leads')
          .update({
            bills_list: billsList,
            reminder_eve_sent: billsList.some(b => b.reminder_eve_sent),
            reminder_due_sent: billsList.some(b => b.reminder_due_sent),
          })
          .eq('id', lead.id);
      }
    }
  }

  return { eveCount, dueCount };
}
