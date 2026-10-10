import { createServiceRoleClient } from '@/lib/supabase-server';
import { formatIdentifierDisplay, getIdentifierVariations } from './qa-whitelist';
import { ADMIN_PERSONAL_WHATSAPP, OFFICIAL_BOT_WHATSAPP } from './constants';

export interface LeadItem {
  phone: string;
  formattedPhone: string;
  name: string;
  origin: string; // 'convite_qa' | 'indicacao' | 'organico'
  referrer?: string | null;
  docsProcessedCount: number;
  interestedPlan?: string | null;
  createdAt: string;
  lastInteractionAt?: string | null;
}

export interface AdminMetricsData {
  summary: {
    totalClients: number;
    activeSubscribers: number;
    mrrCents: number;
    mrrFormatted: string;
    plansDistribution: Record<string, number>;
  };
  funnel: {
    totalGuestsAndLeads: number;
    dormantCount: number;      // Não testaram (0 contas)
    hotTrialCount: number;     // Testaram mas não converteram
    convertedCount: number;    // Converteram para plano pago
    conversionRatePercent: number;
    activationRatePercent: number; // Quantos % chegaram a testar
  };
  dormantLeads: LeadItem[];
  hotLeads: LeadItem[];
  convertedLeads: LeadItem[];
  webToken: string;
}

/**
 * Obtém ou inicializa o token administrativo de acesso seguro à Web
 */
export async function getOrCreateAdminWebToken(): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', 'admin_web_token')
    .maybeSingle();

  if (row?.value) {
    return row.value;
  }

  // Gera um token administrativo seguro inicial
  const newToken = 'marcos_admin_' + Math.random().toString(36).substring(2, 10);
  await supabase.from('bot_config').upsert(
    { key: 'admin_web_token', value: newToken, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  return newToken;
}

/**
 * Coleta e consolida todas as métricas em tempo real para o WhatsApp e para o Painel Web
 */
export async function collectAdminMetrics(): Promise<AdminMetricsData> {
  const supabase = createServiceRoleClient();

  // 1. Clientes e Administradores
  const { data: clientsRaw } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number, is_admin, status, created_at');

  const clients = clientsRaw || [];
  const adminVariations = getIdentifierVariations(ADMIN_PERSONAL_WHATSAPP || '5514930855878');
  const botVariations = getIdentifierVariations(OFFICIAL_BOT_WHATSAPP || '5513920099874');

  // 2. Assinaturas e Planos Ativos
  const { data: subsRaw } = await supabase
    .from('subscriptions')
    .select('id, client_id, status, billing_period, plans(code, name, monthly_price_cents)')
    .eq('status', 'active');

  const subs = subsRaw || [];
  let mrrCents = 0;
  const plansDistribution: Record<string, number> = {
    start: 0,
    solo: 0,
    solo_plus: 0,
    pro: 0,
    super: 0,
  };

  const payingClientIds = new Set<string>();

  for (const s of subs) {
    payingClientIds.add(s.client_id);
    const plan = (s as any).plans;
    if (plan) {
      const code = plan.code || 'solo';
      plansDistribution[code] = (plansDistribution[code] || 0) + 1;
      mrrCents += Number(plan.monthly_price_cents || 0);
    }
  }

  // 3. Convidados na QA Whitelist (Amigos, familiares e VIPs cadastrados pelo Marcos)
  const { data: qaRaw } = await supabase
    .from('qa_whitelist')
    .select('identifier, description, created_by, created_at, is_active')
    .eq('is_active', true);

  // 4. Leads de Degustação (trial_leads)
  const { data: leadsRaw } = await supabase
    .from('trial_leads')
    .select('id, whatsapp_number, referrer_phone, doc_processed, trial_docs_count, converted_to_client, created_at, first_interaction_at, interested_plan, bills_list');

  const trialLeads = leadsRaw || [];

  // Mapear números de telefone deduplicados para evitar contar a mesma pessoa duas vezes
  const knownPhonesMap = new Map<string, {
    basePhone: string;
    name: string;
    origin: string;
    referrer?: string | null;
    docsProcessedCount: number;
    isConverted: boolean;
    hasTested: boolean;
    interestedPlan?: string | null;
    createdAt: string;
    lastInteractionAt?: string | null;
  }>();

  // A. Processa convidados da QA Whitelist
  for (const q of (qaRaw || [])) {
    const cleanId = (q.identifier || '').replace(/\D/g, '');
    if (!cleanId || cleanId.length < 10) continue;

    const variations = getIdentifierVariations(cleanId);
    // Ignora o admin Marcos e o bot
    if (variations.some((v) => adminVariations.includes(v) || botVariations.includes(v))) {
      continue;
    }

    // Normaliza chave base
    const basePhone = cleanId.startsWith('55') ? cleanId : `55${cleanId}`;
    if (!knownPhonesMap.has(basePhone)) {
      knownPhonesMap.set(basePhone, {
        basePhone,
        name: q.description || 'Convidado VIP',
        origin: 'convite_qa',
        referrer: q.created_by || 'Marcos Admin',
        docsProcessedCount: 0,
        isConverted: false,
        hasTested: false,
        interestedPlan: null,
        createdAt: q.created_at || new Date().toISOString(),
        lastInteractionAt: null,
      });
    }
  }

  // B. Processa trial_leads (mesclando com convidados se houver)
  for (const lead of trialLeads) {
    const cleanLeadPhone = (lead.whatsapp_number || '').replace(/\D/g, '');
    if (!cleanLeadPhone) continue;

    const variations = getIdentifierVariations(cleanLeadPhone);
    // Ignora o admin Marcos e o bot
    if (variations.some((v) => adminVariations.includes(v) || botVariations.includes(v))) {
      continue;
    }

    const basePhone = cleanLeadPhone.startsWith('55') ? cleanLeadPhone : `55${cleanLeadPhone}`;
    const billsCount = Array.isArray(lead.bills_list) ? lead.bills_list.length : 0;
    const docsCount = Number(lead.trial_docs_count) || (lead.doc_processed ? 1 : 0) || billsCount;
    const hasTested = docsCount > 0 || Boolean(lead.doc_processed);
    const isConverted = Boolean(lead.converted_to_client);

    const existing = knownPhonesMap.get(basePhone);
    if (existing) {
      existing.docsProcessedCount = Math.max(existing.docsProcessedCount, docsCount);
      existing.hasTested = existing.hasTested || hasTested;
      existing.isConverted = existing.isConverted || isConverted;
      if (lead.interested_plan) existing.interestedPlan = lead.interested_plan;
      if (lead.first_interaction_at) existing.lastInteractionAt = lead.first_interaction_at;
      if (lead.referrer_phone) existing.referrer = lead.referrer_phone;
    } else {
      knownPhonesMap.set(basePhone, {
        basePhone,
        name: `Lead ${cleanLeadPhone.slice(-4)}`,
        origin: lead.referrer_phone ? 'indicacao' : 'organico',
        referrer: lead.referrer_phone || null,
        docsProcessedCount: docsCount,
        isConverted,
        hasTested,
        interestedPlan: lead.interested_plan || null,
        createdAt: lead.created_at || new Date().toISOString(),
        lastInteractionAt: lead.first_interaction_at || null,
      });
    }
  }

  // C. Cruza com assinaturas pagantes reais
  for (const c of clients) {
    const cleanClientPhone = (c.whatsapp_number || '').replace(/\D/g, '');
    if (!cleanClientPhone) continue;

    const basePhone = cleanClientPhone.startsWith('55') ? cleanClientPhone : `55${cleanClientPhone}`;
    const isSubscriber = payingClientIds.has(c.id);

    const item = knownPhonesMap.get(basePhone);
    if (item) {
      if (c.name && !item.name.startsWith('Convidado')) {
        item.name = c.name;
      }
      if (isSubscriber) {
        item.isConverted = true;
      }
    }
  }

  // Separar em categorias do Funil
  const dormantLeads: LeadItem[] = [];
  const hotLeads: LeadItem[] = [];
  const convertedLeads: LeadItem[] = [];

  knownPhonesMap.forEach((item) => {
    const leadObj: LeadItem = {
      phone: item.basePhone,
      formattedPhone: formatIdentifierDisplay(item.basePhone),
      name: item.name,
      origin: item.origin,
      referrer: item.referrer,
      docsProcessedCount: item.docsProcessedCount,
      interestedPlan: item.interestedPlan,
      createdAt: item.createdAt,
      lastInteractionAt: item.lastInteractionAt,
    };

    if (item.isConverted) {
      convertedLeads.push(leadObj);
    } else if (item.hasTested) {
      hotLeads.push(leadObj);
    } else {
      dormantLeads.push(leadObj);
    }
  });

  const totalGuestsAndLeads = knownPhonesMap.size;
  const activatedCount = hotLeads.length + convertedLeads.length;
  const conversionRatePercent =
    totalGuestsAndLeads > 0 ? (convertedLeads.length / totalGuestsAndLeads) * 100 : 0;
  const activationRatePercent =
    totalGuestsAndLeads > 0 ? (activatedCount / totalGuestsAndLeads) * 100 : 0;

  const mrrFormatted = (mrrCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const webToken = await getOrCreateAdminWebToken();

  return {
    summary: {
      totalClients: clients.filter((c) => !c.is_admin).length,
      activeSubscribers: payingClientIds.size,
      mrrCents,
      mrrFormatted,
      plansDistribution,
    },
    funnel: {
      totalGuestsAndLeads,
      dormantCount: dormantLeads.length,
      hotTrialCount: hotLeads.length,
      convertedCount: convertedLeads.length,
      conversionRatePercent: Number(conversionRatePercent.toFixed(1)),
      activationRatePercent: Number(activationRatePercent.toFixed(1)),
    },
    dormantLeads,
    hotLeads,
    convertedLeads,
    webToken,
  };
}

/**
 * Retorna mensagem completa formatada para exibição no WhatsApp do Marcos
 */
export async function getAdminExecutiveDashboardWhatsAppMessage(): Promise<string> {
  const data = await collectAdminMetrics();
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const { summary, funnel } = data;

  const plansStr = [
    summary.plansDistribution.start > 0 ? `${summary.plansDistribution.start} Start` : null,
    summary.plansDistribution.solo > 0 ? `${summary.plansDistribution.solo} Solo` : null,
    summary.plansDistribution.solo_plus > 0 ? `${summary.plansDistribution.solo_plus} Plus` : null,
    summary.plansDistribution.pro > 0 ? `${summary.plansDistribution.pro} Pro` : null,
    summary.plansDistribution.super > 0 ? `${summary.plansDistribution.super} Super` : null,
  ]
    .filter(Boolean)
    .join(' | ') || 'Nenhum plano ativo';

  const webUrl = `https://analisai.me/admin?token=${data.webToken}`;

  return `📊 *PAINEL EXECUTIVO ANALISAÍ • ${dateStr}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 *ASSINANTES & RECEITA*
• *Assinantes Ativos:* ${summary.activeSubscribers}
• *MRR Estimado:* ${summary.mrrFormatted}/mês
• *Distribuição de Planos:* ${plansStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌪️ *FUNIL DE CONVITES & DEGUSTAÇÃO*
• *Total Mapeado:* ${funnel.totalGuestsAndLeads} contatos

1. 💤 *Dormindo (Não testaram):* ${funnel.dormantCount} (${funnel.totalGuestsAndLeads > 0 ? ((funnel.dormantCount / funnel.totalGuestsAndLeads) * 100).toFixed(0) : 0}%)
   ↳ Receberam o convite/link mas nunca enviaram comprovante.
   👉 Digite *!dormindo* para ver a lista e reengajar.

2. 🔥 *Quentes (Testaram e não assinaram):* ${funnel.hotTrialCount} (${funnel.totalGuestsAndLeads > 0 ? ((funnel.hotTrialCount / funnel.totalGuestsAndLeads) * 100).toFixed(0) : 0}%)
   ↳ Enviaram contas na degustação, viram valor, aguardam fechamento!
   👉 Digite *!quentes* para ver os leads prontos para converter.

3. 🏆 *Convertidos (Assinantes):* ${funnel.convertedCount} (${funnel.conversionRatePercent}%)
   ↳ *Taxa de Ativação do Trial:* ${funnel.activationRatePercent}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💻 *PAINEL WEB COMPLETO (1 TOQUE):*
👉 ${webUrl}
_(Abre direto no navegador do celular ou PC com filtros e gráficos!)_`;
}

/**
 * Retorna listagem dos leads/convidados dormindo (que não testaram)
 */
export async function getDormantLeadsReportWhatsAppMessage(): Promise<string> {
  const data = await collectAdminMetrics();
  const list = data.dormantLeads;

  if (list.length === 0) {
    return `🎉 *Excelente!* Nenhum convidado ou indicado está dormindo no momento. Todos os que receberam convite já enviaram ao menos 1 conta!`;
  }

  const itemsStr = list
    .slice(0, 15) // Máximo 15 para não poluir
    .map((item, idx) => {
      const origem = item.origin === 'convite_qa' ? 'Convite VIP' : 'Indicação';
      const ref = item.referrer ? ` (por ${item.referrer})` : '';
      return `${idx + 1}. *${item.name}* — ${item.formattedPhone}\n   ↳ Origem: ${origem}${ref}\n   📲 [Conversar no WhatsApp](https://wa.me/${item.phone})`;
    })
    .join('\n\n');

  const extraCount = list.length > 15 ? `\n\n_... e mais ${list.length - 15} contatos disponíveis no painel web!_` : '';

  return `💤 *CONTATOS DORMINDO (${list.length} que não testaram)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estes contatos foram cadastrados/convidados mas ainda não enviaram nenhum documento ou comprovante:

${itemsStr}${extraCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Dica do Marcos:* Dê um toque rápido perguntando: *"Conseguiu mandar sua primeira conta no robô?"*`;
}

/**
 * Retorna listagem dos leads quentes (que testaram mas não converteram)
 */
export async function getHotLeadsReportWhatsAppMessage(): Promise<string> {
  const data = await collectAdminMetrics();
  const list = data.hotLeads;

  if (list.length === 0) {
    return `✨ *Nenhum Lead Quente Pendente:* No momento, todos os que testaram já são assinantes ou você ainda não tem leads expirados pendentes de conversão.`;
  }

  const itemsStr = list
    .slice(0, 15)
    .map((item, idx) => {
      const planStr = item.interestedPlan ? ` • Interesse: Plano *${item.interestedPlan.toUpperCase()}*` : '';
      return `${idx + 1}. *${item.name}* — ${item.formattedPhone}\n   ↳ Testou *${item.docsProcessedCount} conta(s)*${planStr}\n   📲 [Chamar para Fechamento](https://wa.me/${item.phone})`;
    })
    .join('\n\n');

  const extraCount = list.length > 15 ? `\n\n_... e mais ${list.length - 15} leads disponíveis no painel web!_` : '';

  return `🔥 *LEADS QUENTES (${list.length} testaram e não assinaram)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estes contatos já sentiram o valor do AnalisAí na prática, enviaram boletos/áudios e estão no ponto de conversão:

${itemsStr}${extraCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Ação de Fechamento:* Toque no link de WhatsApp de qualquer um deles para oferecer uma condição especial ou tirar dúvidas!`;
}

/**
 * Retorna listagem dos clientes com assinaturas ativas
 */
export async function getActiveClientsReportWhatsAppMessage(): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data: subsRaw } = await supabase
    .from('subscriptions')
    .select('id, client_id, status, billing_period, created_at, plans(name, code, monthly_price_cents), clients(id, name, whatsapp_number, is_admin, status)')
    .eq('status', 'active');

  const subs = subsRaw || [];

  if (subs.length === 0) {
    return `👥 *Nenhum Assinante Ativo:* Ainda não há assinaturas ativas cadastradas na base.`;
  }

  let totalMrrCents = 0;

  const itemsStr = subs.map((s: any, idx: number) => {
    const client = s.clients;
    const plan = s.plans;
    const cleanPhone = (client?.whatsapp_number || '').replace(/\D/g, '');
    const formattedPhone = cleanPhone ? formatIdentifierDisplay(cleanPhone) : 'Não informado';
    const period = s.billing_period === 'annual' ? 'Anual' : 'Mensal';
    const priceCents = Number(plan?.monthly_price_cents || 0);
    totalMrrCents += priceCents;
    const priceFormatted = (priceCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const adminTag = client?.is_admin ? ' 👑 *(Admin)*' : '';

    return `${idx + 1}. *${client?.name || 'Cliente'}*${adminTag}
   📦 Plano: *${plan?.name || 'Solo'}* (${priceFormatted}/mês • ${period})
   📱 ${formattedPhone}
   📲 [Abrir no WhatsApp](https://wa.me/${cleanPhone})`;
  }).join('\n\n');

  const totalMrrFormatted = (totalMrrCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return `👥 *CLIENTES ATIVOS (${subs.length} assinaturas ativas)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${itemsStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Receita Mensal Recorrente (MRR):* ${totalMrrFormatted}/mês
💡 Para ver o funil completo e todos os contatos, envie *!painel*.`;
}
