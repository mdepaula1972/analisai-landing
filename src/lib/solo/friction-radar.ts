import { createServiceRoleClient } from '@/lib/supabase-server';

export type InsightEventType = 'question' | 'friction' | 'unsupported' | 'praise' | 'onboarding_hesitation' | 'general';
export type InsightCategory = 'onboarding' | 'tax' | 'ocr' | 'banking' | 'billing' | 'usability' | 'general';

export interface InteractionInsightItem {
  id: string;
  whatsapp_number: string;
  event_type: InsightEventType;
  category: InsightCategory;
  raw_message: string;
  detected_intent: string;
  metadata?: any;
  created_at: string;
}

/**
 * Registra um evento ou fricção no banco de dados de telemetria sem travar a resposta ao usuário
 */
export async function recordInsight(params: {
  phone: string;
  eventType: InsightEventType;
  category: InsightCategory;
  rawMessage: string;
  detectedIntent: string;
  metadata?: any;
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const cleanPhone = (params.phone || '').replace(/\D/g, '');

    await supabase.from('user_interaction_insights').insert({
      whatsapp_number: cleanPhone,
      event_type: params.eventType,
      category: params.category,
      raw_message: (params.rawMessage || '').slice(0, 1000),
      detected_intent: (params.detectedIntent || '').slice(0, 500),
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Friction Radar] Erro ao gravar insight (silencioso):', err);
  }
}

/**
 * Analisador inteligente de mensagens: detecta dúvidas, fricções e elogios
 */
export async function detectAndLogUserInteraction(params: {
  phone: string;
  text: string;
  isAudio?: boolean;
  onbStep?: string;
}): Promise<void> {
  const { phone, text, isAudio, onbStep } = params;
  if (!text || text.length < 3) return;

  const clean = text.toLowerCase().trim();

  // Ignora comandos administrativos de teste iniciados por '!'
  if (clean.startsWith('!')) return;

  // 1. Detecção de Dúvidas / Perguntas
  const isQuestion =
    clean.includes('?') ||
    /^(como\b|qual\b|onde\b|quando\b|quem\b|por que\b|porque\b|quanto\b|d[aá] pra\b|consigo\b|voc[eê]s?\b|o que [eé]\b)/i.test(clean) ||
    clean.includes('como funciona') || clean.includes('como fa[çc]o') ||
    clean.includes('emite nota') || clean.includes('emite nf') || clean.includes('tirar nota') ||
    clean.includes('calcula imposto') || clean.includes('guia do das') || clean.includes('pagar o das') ||
    clean.includes('extrato') || clean.includes('banco') || clean.includes('cart[aã]o') ||
    clean.includes('quanto custa') || clean.includes('valor do plano') || clean.includes('como assinar') ||
    clean.includes('contador') || clean.includes('fechamento cont[aá]bil');

  if (isQuestion) {
    let category: InsightCategory = 'general';
    let intent = 'Dúvida geral de uso';

    if (clean.includes('nota') || clean.includes('nf') || clean.includes('imposto') || clean.includes('das') || clean.includes('tribut')) {
      category = 'tax';
      intent = clean.includes('nota') ? 'Dúvida sobre emissão de Nota Fiscal' : 'Dúvida sobre cálculo ou pagamento de tributos/DAS';
    } else if (clean.includes('banco') || clean.includes('extrato') || clean.includes('cart[aã]o') || clean.includes('conta')) {
      category = 'banking';
      intent = 'Dúvida sobre integração bancária ou extrato';
    } else if (clean.includes('custa') || clean.includes('plano') || clean.includes('assinar') || clean.includes('pre[çc]o')) {
      category = 'billing';
      intent = 'Dúvida comercial sobre planos ou contratação';
    } else if (clean.includes('contador')) {
      category = 'tax';
      intent = 'Dúvida sobre envio de relatórios ao contador';
    }

    await recordInsight({
      phone,
      eventType: 'question',
      category,
      rawMessage: text,
      detectedIntent: intent,
      metadata: { isAudio, onbStep },
    });
    return;
  }

  // 2. Detecção de Fricções / Frustração / Dificuldade
  const isFriction =
    /^(n[aã]o entendi|n[aã]o deu certo|n[aã]o funcionou|est[aá] errado|erro|confuso|dif[ií]cil|complicado|socorro|ajuda|falar com atendente|atendente|humano|suporte)/i.test(clean) ||
    clean.includes('atendimento humano') || clean.includes('pessoa de verdade') || clean.includes('falar com alguem') ||
    clean.includes('não consegui') || clean.includes('deu erro');

  if (isFriction) {
    let intent = 'Fricção / Dificuldade de compreensão';
    if (clean.includes('humano') || clean.includes('atendente') || clean.includes('suporte')) {
      intent = 'Solicitação de suporte humano';
    } else if (clean.includes('n[aã]o entendi') || clean.includes('confuso')) {
      intent = 'Confusão na explicação do assistente';
    }

    await recordInsight({
      phone,
      eventType: 'friction',
      category: 'usability',
      rawMessage: text,
      detectedIntent: intent,
      metadata: { isAudio, onbStep },
    });
    return;
  }

  // 3. Detecção de Elogios / Encantamento (Momento UAU)
  const isPraise =
    /^(parab[eé]ns|sensacional|muito bom|top demais|top\b|excelente|maravilha|adorei|amei|uau\b|show de bola|salvou meu dia|pratico|pr[aá]tico|genial)/i.test(clean) ||
    clean.includes('muito r[aá]pido') || clean.includes('ajudou demais') || clean.includes('que massa');

  if (isPraise) {
    await recordInsight({
      phone,
      eventType: 'praise',
      category: 'usability',
      rawMessage: text,
      detectedIntent: 'Elogio ou encantamento com o AnalisAí (Momento UAU)',
      metadata: { isAudio },
    });
    return;
  }

  // 4. Detecção de Arquivos / Recursos Não Suportados
  const isUnsupported =
    clean.includes('.xlsx') || clean.includes('.xls') || clean.includes('.csv') ||
    clean.includes('.ofx') || clean.includes('.docx') || clean.includes('planilha');

  if (isUnsupported) {
    await recordInsight({
      phone,
      eventType: 'unsupported',
      category: 'banking',
      rawMessage: text,
      detectedIntent: 'Tentativa de envio de arquivo externo (planilha/extrato)',
      metadata: { isAudio },
    });
  }
}

/**
 * Gera um relatório executivo formatado para o WhatsApp com base nos insights dos últimos dias
 */
export async function generateRadarReport(days: number = 7): Promise<string> {
  const supabase = createServiceRoleClient();
  const dateLimit = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: insights } = await supabase
    .from('user_interaction_insights')
    .select('id, whatsapp_number, event_type, category, raw_message, detected_intent, created_at')
    .gte('created_at', dateLimit)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!insights || insights.length === 0) {
    return `🔍 *Radar de Aprendizado do AnalisAí:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nenhuma fricção, dúvida ou anomalia registrada nos últimos ${days} dias!
O sistema está operando com fluidez total. 🚀`;
  }

  const questions = insights.filter((i: any) => i.event_type === 'question');
  const frictions = insights.filter((i: any) => i.event_type === 'friction' || i.event_type === 'onboarding_hesitation');
  const praises = insights.filter((i: any) => i.event_type === 'praise');
  const unsupported = insights.filter((i: any) => i.event_type === 'unsupported');

  let report = `🔍 *Radar de Aprendizado & Fricções do AnalisAí:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Período:* Últimos ${days} dias
📊 *Total de Insights Mapeados:* ${insights.length}
`;

  // 1. Dúvidas Frequentes
  if (questions.length > 0) {
    report += `\n❓ *Principais Dúvidas dos Usuários (${questions.length}):*\n`;
    const uniqueIntents: Record<string, { count: number; sample: string }> = {};
    for (const q of questions) {
      const key = q.detected_intent;
      if (!uniqueIntents[key]) {
        uniqueIntents[key] = { count: 0, sample: q.raw_message };
      }
      uniqueIntents[key].count++;
    }

    const sorted = Object.entries(uniqueIntents).sort((a, b) => b[1].count - a[1].count).slice(0, 4);
    for (const [intent, info] of sorted) {
      report += `• *${intent}* (${info.count}x)\n  ↳ _Ex: "${info.sample.slice(0, 80)}"_\n`;
    }
  }

  // 2. Fricções & Hesitações
  if (frictions.length > 0) {
    report += `\n⚠️ *Pontos de Fricção Detectados (${frictions.length}):*\n`;
    const uniqueFrictions: Record<string, { count: number; sample: string }> = {};
    for (const f of frictions) {
      const key = f.detected_intent;
      if (!uniqueFrictions[key]) {
        uniqueFrictions[key] = { count: 0, sample: f.raw_message };
      }
      uniqueFrictions[key].count++;
    }

    const sortedF = Object.entries(uniqueFrictions).sort((a, b) => b[1].count - a[1].count).slice(0, 4);
    for (const [intent, info] of sortedF) {
      report += `• *${intent}* (${info.count}x)\n  ↳ _"${info.sample.slice(0, 80)}"_\n`;
    }
  }

  // 3. Oportunidades de Recursos
  if (unsupported.length > 0) {
    report += `\n💡 *Recursos Solicitados / Não Suportados (${unsupported.length}):*\n`;
    for (const u of unsupported.slice(0, 3)) {
      report += `• ${u.detected_intent}: _"${u.raw_message.slice(0, 70)}"_\n`;
    }
  }

  // 4. Momentos UAU (Elogios)
  if (praises.length > 0) {
    report += `\n🌟 *Momentos "UAU" & Satisfação (${praises.length}):*\n`;
    for (const p of praises.slice(0, 3)) {
      report += `• _"${p.raw_message.slice(0, 80)}"_\n`;
    }
  }

  report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `💡 _Para ver no painel web, acesse /admin ou digite !radar [dias]._`;

  return report;
}

/**
 * Retorna os últimos insights para consumo da tela /admin
 */
export async function getRecentRadarInsights(limit: number = 50): Promise<InteractionInsightItem[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('user_interaction_insights')
    .select('id, whatsapp_number, event_type, category, raw_message, detected_intent, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []) as InteractionInsightItem[];
}
