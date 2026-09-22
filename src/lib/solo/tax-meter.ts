import { createServiceRoleClient } from '@/lib/supabase-server';
import { format } from 'date-fns';

export interface TaxRevenueStatus {
  taxRegime: 'mei' | 'simples_me' | 'simples_epp';
  taxRegimeName: string;
  annualLimit: number;
  toleranceLimit: number;
  totalRevenueYear: number;
  baselineRevenue: number;
  systemRevenue: number;
  percentageUsed: number;
  remainingSafetyMargin: number;
  currentMonthlyAverage: number;
  maxSafeMonthlyAverage: number;
  riskLevel: 'green' | 'yellow' | 'orange' | 'red';
  progressBar: string;
  statusMessage: string;
  miniBadge: string;
}

export const TAX_CONFIGS = {
  mei: {
    code: 'mei' as const,
    name: 'MEI (Microempreendedor Individual)',
    annualLimit: 81000, // R$ 81.000,00 anuais
    toleranceLimit: 97200, // Tolerância de até 20% (R$ 97.200,00)
    monthlyAverageMax: 6750, // Média mensal esperada
  },
  simples_me: {
    code: 'simples_me' as const,
    name: 'Simples Nacional — ME (Microempresa)',
    annualLimit: 360000, // R$ 360.000,00 anuais
    toleranceLimit: 432000, // Tolerância de até 20% (R$ 432.000,00)
    monthlyAverageMax: 30000,
  },
  simples_epp: {
    code: 'simples_epp' as const,
    name: 'Simples Nacional — EPP (Pequeno Porte)',
    annualLimit: 4800000, // R$ 4.800.000,00 anuais
    toleranceLimit: 4800000,
    monthlyAverageMax: 400000,
  },
};

/**
 * Normaliza e busca o regime e o faturamento acumulado no ano para o cliente ou lead.
 */
export async function getTaxRevenueTracking(params: {
  clientId?: string;
  phone?: string;
  referenceDate?: Date;
}): Promise<TaxRevenueStatus> {
  const supabase = createServiceRoleClient();
  const refDate = params.referenceDate || new Date();
  const currentYear = refDate.getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;
  const currentMonth = refDate.getMonth() + 1; // 1 a 12
  const monthsRemaining = Math.max(1, 12 - currentMonth + 1);

  let rawPhone = (params.phone || '').replace(/\D/g, '');
  let resolvedClientId = params.clientId;
  let taxRegimeCode: 'mei' | 'simples_me' | 'simples_epp' = 'mei';
  let baselineRevenue = 0;
  let systemRevenue = 0;

  // 1. Tenta localizar cliente ativo
  if (!resolvedClientId && rawPhone) {
    const cleanNumber = rawPhone.length > 11 ? rawPhone.slice(-11) : rawPhone;
    const { data: client } = await supabase
      .from('clients')
      .select('id, tax_regime, annual_revenue_baseline')
      .or(`whatsapp_number.eq.${rawPhone},whatsapp_number.ilike.%${cleanNumber}`)
      .limit(1)
      .maybeSingle();

    if (client) {
      resolvedClientId = client.id;
      if (client.tax_regime && client.tax_regime in TAX_CONFIGS) {
        taxRegimeCode = client.tax_regime as any;
      }
      baselineRevenue = Number(client.annual_revenue_baseline) || 0;
    }
  } else if (resolvedClientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('tax_regime, annual_revenue_baseline')
      .eq('id', resolvedClientId)
      .maybeSingle();

    if (client) {
      if (client.tax_regime && client.tax_regime in TAX_CONFIGS) {
        taxRegimeCode = client.tax_regime as any;
      }
      baselineRevenue = Number(client.annual_revenue_baseline) || 0;
    }
  }

  // 2. Se for cliente ativo, soma os lançamentos de receita do Livro Caixa no ano corrente
  if (resolvedClientId) {
    const { data: entries } = await supabase
      .from('cash_ledger_entries')
      .select('amount, entry_type')
      .eq('client_id', resolvedClientId)
      .gte('entry_date', yearStart)
      .lte('entry_date', yearEnd);

    if (entries) {
      for (const e of entries) {
        const type = (e.entry_type || '').toLowerCase();
        if (type === 'income' || type === 'receita') {
          systemRevenue += Math.abs(Number(e.amount) || 0);
        }
      }
    }
  } else if (rawPhone) {
    // 3. Se for Trial Lead
    const cleanNumber = rawPhone.length > 11 ? rawPhone.slice(-11) : rawPhone;
    const { data: lead } = await supabase
      .from('trial_leads')
      .select('tax_regime, annual_revenue_baseline, annual_revenue_current')
      .or(`whatsapp_number.eq.${rawPhone},whatsapp_number.ilike.%${cleanNumber}`)
      .limit(1)
      .maybeSingle();

    if (lead) {
      if (lead.tax_regime && lead.tax_regime in TAX_CONFIGS) {
        taxRegimeCode = lead.tax_regime as any;
      }
      baselineRevenue = Number(lead.annual_revenue_baseline) || 0;
      systemRevenue = Number(lead.annual_revenue_current) || 0;
    }
  }

  const config = TAX_CONFIGS[taxRegimeCode] || TAX_CONFIGS.mei;
  const totalRevenue = baselineRevenue + systemRevenue;
  const percentage = Math.min(150, Math.round((totalRevenue / config.annualLimit) * 100));
  const remaining = Math.max(0, config.annualLimit - totalRevenue);

  // Médias
  const currentMonthlyAvg = currentMonth > 0 ? totalRevenue / currentMonth : totalRevenue;
  const maxSafeMonthlyAvg = remaining / monthsRemaining;

  // Risco e cor
  let riskLevel: 'green' | 'yellow' | 'orange' | 'red' = 'green';
  if (totalRevenue > config.annualLimit) {
    riskLevel = 'red';
  } else if (percentage >= 90) {
    riskLevel = 'orange';
  } else if (percentage >= 75) {
    riskLevel = 'yellow';
  } else {
    riskLevel = 'green';
  }

  // Barra de progresso visual de 15 blocos
  const totalBlocks = 15;
  const filledBlocks = Math.min(totalBlocks, Math.round((Math.min(100, percentage) / 100) * totalBlocks));
  const emptyBlocks = Math.max(0, totalBlocks - filledBlocks);
  const progressBar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}] ${percentage}%`;

  const totalFmt = totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const limitFmt = config.annualLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const toleranceFmt = config.toleranceLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const remainingFmt = remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const monthlyAvgFmt = currentMonthlyAvg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const safeMonthlyAvgFmt = maxSafeMonthlyAvg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let statusMessage = `🌡️ *Termômetro Tributário — ${config.name} (${currentYear})*\n`;
  statusMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  statusMessage += `• *Faturamento Acumulado:* ${totalFmt}\n`;
  statusMessage += `• *Teto Oficial Anual:* ${limitFmt}\n`;
  statusMessage += `• *Margem Segura Restante:* ${remainingFmt}\n`;
  statusMessage += `• *Termômetro Fiscal:* ${progressBar}\n`;
  statusMessage += `• *Sua Média Mensal Atual:* ${monthlyAvgFmt}/mês\n`;
  statusMessage += `• *Média Segura para os Próximos Meses:* ${safeMonthlyAvgFmt}/mês\n`;

  if (riskLevel === 'red') {
    if (totalRevenue <= config.toleranceLimit) {
      statusMessage += `\n⚠️ *Atenção Máxima (Excesso de até 20%):*\n`;
      statusMessage += `Você ultrapassou o teto anual de ${limitFmt}, mas está dentro da margem de tolerância de 20% (${toleranceFmt}).\n`;
      statusMessage += `📌 *Regra da Receita Federal:* O desenquadramento não é retroativo e ocorrerá a partir de 1º de janeiro do próximo ano. Você deverá recolher um DAS complementar sobre o excesso. Recomendamos procurar seu contador para planejar a migração sem sobressaltos!`;
    } else {
      statusMessage += `\n🚨 *ALERTA GRAVE (Excesso Superior a 20%):*\n`;
      statusMessage += `Você ultrapassou ${toleranceFmt} (> 20% acima do teto).\n`;
      statusMessage += `❗ *Penalidade da Receita Federal:* O desenquadramento se torna RETROATIVO a janeiro do ano corrente! Todos os impostos serão recalculados pelas regras de Microempresa (Simples Nacional) com juros e multa. Contate urgentemente seu contador!`;
    }
  } else if (riskLevel === 'orange') {
    statusMessage += `\n🟠 *Atenção Elevada (Risco Iminente):*\n`;
    statusMessage += `Você já consumiu ${percentage}% do seu teto anual. Restam apenas ${remainingFmt} para emissão até dezembro. Redobre o controle das notas e avalie com seu contador a viabilidade de desenquadramento planejado para ME!`;
  } else if (riskLevel === 'yellow') {
    statusMessage += `\n🟡 *Alerta Preventivo (Zona de Atenção):*\n`;
    statusMessage += `Você atingiu ${percentage}% do limite anual. Mantenha seu ritmo de faturamento médio abaixo de ${safeMonthlyAvgFmt}/mês para manter o enquadramento sem surpresas na virada do ano.`;
  } else {
    statusMessage += `\n🟢 *Status Confortável (Zona Segura):*\n`;
    statusMessage += `Seu faturamento acumulado está equilibrado e seguro dentro do limite anual do ${config.name}. Continue registrando todas as suas entradas para manter o radar em dia!`;
  }

  statusMessage += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  statusMessage += `💡 _Dica: Para alterar seu regime ou informar faturamento anterior fora do AnalisAí, use:_\n`;
  statusMessage += `• \`!regime mei\` ou \`!regime simples\`\n`;
  statusMessage += `• \`!faturamento [valor]\` (ex: \`!faturamento 15000\`)`;

  const miniBadge = `📊 *Termômetro ${taxRegimeCode.toUpperCase()}:* ${percentage}% utilizado (${remainingFmt} de margem restante)`;

  return {
    taxRegime: taxRegimeCode,
    taxRegimeName: config.name,
    annualLimit: config.annualLimit,
    toleranceLimit: config.toleranceLimit,
    totalRevenueYear: totalRevenue,
    baselineRevenue,
    systemRevenue,
    percentageUsed: percentage,
    remainingSafetyMargin: remaining,
    currentMonthlyAverage: currentMonthlyAvg,
    maxSafeMonthlyAverage: maxSafeMonthlyAvg,
    riskLevel,
    progressBar,
    statusMessage,
    miniBadge,
  };
}

/**
 * Atualiza o regime tributário e/ou faturamento baseline do cliente ou trial lead.
 */
export async function updateTaxRegime(params: {
  phone: string;
  regime: 'mei' | 'simples_me' | 'simples_epp';
  baseline?: number;
}): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const rawPhone = params.phone.replace(/\D/g, '');
  const cleanNumber = rawPhone.length > 11 ? rawPhone.slice(-11) : rawPhone;

  // Atualiza em clients se existir
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .or(`whatsapp_number.eq.${rawPhone},whatsapp_number.ilike.%${cleanNumber}`)
    .limit(1)
    .maybeSingle();

  const updateData: any = { tax_regime: params.regime };
  if (params.baseline !== undefined) {
    updateData.annual_revenue_baseline = params.baseline;
  }

  if (client) {
    await supabase.from('clients').update(updateData).eq('id', client.id);
  }

  // Atualiza também em trial_leads para consistência
  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id')
    .or(`whatsapp_number.eq.${rawPhone},whatsapp_number.ilike.%${cleanNumber}`)
    .limit(1)
    .maybeSingle();

  if (lead) {
    await supabase.from('trial_leads').update(updateData).eq('id', lead.id);
  }

  const regimeName = TAX_CONFIGS[params.regime]?.name || params.regime;
  let msg = `✅ *Regime Tributário Atualizado!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seu perfil fiscal foi configurado como:
🏢 *${regimeName}*`;

  if (params.baseline !== undefined) {
    msg += `\n💰 *Faturamento prévio considerado:* R$ ${params.baseline.toFixed(2)}`;
  }

  msg += `\n\nDigite *!termometro* a qualquer momento para ver sua margem e régua fiscal atualizadas.`;
  return { success: true, message: msg };
}

/**
 * Registra uma nova receita para o trial lead se ele ainda não for cliente ativo
 */
export async function addTrialLeadRevenue(phone: string, amount: number): Promise<void> {
  const supabase = createServiceRoleClient();
  const rawPhone = phone.replace(/\D/g, '');
  const cleanNumber = rawPhone.length > 11 ? rawPhone.slice(-11) : rawPhone;

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, annual_revenue_current')
    .or(`whatsapp_number.eq.${rawPhone},whatsapp_number.ilike.%${cleanNumber}`)
    .limit(1)
    .maybeSingle();

  if (lead) {
    const current = Number(lead.annual_revenue_current) || 0;
    await supabase
      .from('trial_leads')
      .update({ annual_revenue_current: current + amount })
      .eq('id', lead.id);
  }
}
