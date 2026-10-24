import { createServiceRoleClient } from '@/lib/supabase-server';
import { format } from 'date-fns';

export interface TaxRevenueStatus {
  hasDefinedRegime: boolean;
  isPessoaFisica: boolean;
  taxRegime: 'mei' | 'simples_me' | 'simples_epp' | 'outro';
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

interface CachedRegimeLimit {
  code: 'mei' | 'simples_me' | 'simples_epp';
  name: string;
  annualLimit: number;
  toleranceLimit: number;
  monthlyAverageMax: number;
  maxEmployees: number;
}

let cachedLimits: Record<string, CachedRegimeLimit> | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache em memória

/**
 * Busca os limites tributários parametrizados na tabela tax_regime_limits com cache em memória
 * e suporte a fallback configurável via variável de ambiente (MEI_ANNUAL_LIMIT)
 */
export async function getParametrizedTaxRegimeLimits(
  regimeCode: 'mei' | 'simples_me' | 'simples_epp' = 'mei'
): Promise<CachedRegimeLimit> {
  const now = Date.now();
  if (cachedLimits && now - lastCacheFetchTime < CACHE_TTL_MS && cachedLimits[regimeCode]) {
    return cachedLimits[regimeCode];
  }

  const fallbackMeiLimit = Number(process.env.MEI_ANNUAL_LIMIT) || 140000;

  const defaultConfigs: Record<string, CachedRegimeLimit> = {
    mei: {
      code: 'mei',
      name: 'MEI (Microempreendedor Individual)',
      annualLimit: fallbackMeiLimit,
      toleranceLimit: Math.round(fallbackMeiLimit * 1.2),
      monthlyAverageMax: Math.round(fallbackMeiLimit / 12),
      maxEmployees: 2,
    },
    simples_me: {
      code: 'simples_me',
      name: 'Simples Nacional — ME (Microempresa)',
      annualLimit: 360000,
      toleranceLimit: 432000,
      monthlyAverageMax: 30000,
      maxEmployees: 999,
    },
    simples_epp: {
      code: 'simples_epp',
      name: 'Simples Nacional — EPP (Pequeno Porte)',
      annualLimit: 4800000,
      toleranceLimit: 5760000,
      monthlyAverageMax: 400000,
      maxEmployees: 999,
    },
  };

  try {
    const supabase = createServiceRoleClient();
    const { data: dbLimits, error } = await supabase
      .from('tax_regime_limits')
      .select('regime, annual_limit, tolerance_limit, max_employees, description');

    if (!error && Array.isArray(dbLimits) && dbLimits.length > 0) {
      const parsed: Record<string, CachedRegimeLimit> = { ...defaultConfigs };

      for (const row of dbLimits) {
        const key = (row.regime || '').toLowerCase();
        const baseKey = key.includes('mei') ? 'mei' : key.includes('epp') ? 'simples_epp' : 'simples_me';
        const annLim = Number(row.annual_limit) || defaultConfigs[baseKey].annualLimit;
        const tolLim = Number(row.tolerance_limit) || Math.round(annLim * 1.2);

        parsed[baseKey] = {
          code: baseKey as any,
          name: defaultConfigs[baseKey].name,
          annualLimit: annLim,
          toleranceLimit: tolLim,
          monthlyAverageMax: Math.round(annLim / 12),
          maxEmployees: Number(row.max_employees) || defaultConfigs[baseKey].maxEmployees,
        };
      }

      cachedLimits = parsed;
      lastCacheFetchTime = now;
      return parsed[regimeCode] || parsed.mei;
    }
  } catch (err) {
    console.warn('[Tax Meter] Erro ao buscar tax_regime_limits, usando fallbacks:', err);
  }

  cachedLimits = defaultConfigs;
  lastCacheFetchTime = now;
  return defaultConfigs[regimeCode] || defaultConfigs.mei;
}

export const TAX_CONFIGS = {
  mei: {
    code: 'mei' as const,
    name: 'MEI (Microempreendedor Individual)',
    annualLimit: Number(process.env.MEI_ANNUAL_LIMIT) || 140000,
    toleranceLimit: Math.round((Number(process.env.MEI_ANNUAL_LIMIT) || 140000) * 1.2),
    monthlyAverageMax: Math.round((Number(process.env.MEI_ANNUAL_LIMIT) || 140000) / 12),
  },
  simples_me: {
    code: 'simples_me' as const,
    name: 'Simples Nacional — ME (Microempresa)',
    annualLimit: 360000,
    toleranceLimit: 432000,
    monthlyAverageMax: 30000,
  },
  simples_epp: {
    code: 'simples_epp' as const,
    name: 'Simples Nacional — EPP (Pequeno Porte)',
    annualLimit: 4800000,
    toleranceLimit: 5760000,
    monthlyAverageMax: 400000,
  },
};

/**
 * Normaliza e busca o regime e o faturamento acumulado no ano para o cliente ou lead.
 */
export function normalizeTaxRegime(raw?: string | null): 'mei' | 'simples_me' | 'simples_epp' | 'outro' | null {
  if (!raw) return null;
  const clean = raw.toLowerCase().trim();
  if (clean === 'mei') return 'mei';
  if (clean === 'simples' || clean === 'me' || clean === 'simples_me' || clean === 'simples nacional') return 'simples_me';
  if (clean === 'epp' || clean === 'simples_epp') return 'simples_epp';
  if (clean === 'outro' || clean === 'outros' || clean === 'presumido' || clean === 'real' || clean === 'pf') return 'outro';
  return null;
}

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
  let taxRegimeCode: 'mei' | 'simples_me' | 'simples_epp' | 'outro' | null = null;
  let hasExplicitTaxRegime = false;
  let isPessoaFisica = false;
  let baselineRevenue = 0;
  let systemRevenue = 0;

  // 1. Tenta localizar cliente ativo
  if (!resolvedClientId && rawPhone) {
    const cleanNumber = rawPhone.length > 11 ? rawPhone.slice(-11) : rawPhone;
    const { data: client } = await supabase
      .from('clients')
      .select('id, profile_type, tax_regime, annual_revenue_baseline')
      .or(`whatsapp_number.eq.${rawPhone},whatsapp_number.ilike.%${cleanNumber}`)
      .limit(1)
      .maybeSingle();

    if (client) {
      resolvedClientId = client.id;
      if (client.profile_type && client.profile_type.startsWith('pf')) {
        isPessoaFisica = true;
      }
      const norm = normalizeTaxRegime(client.tax_regime);
      if (norm) {
        taxRegimeCode = norm;
        hasExplicitTaxRegime = true;
      }
      baselineRevenue = Number(client.annual_revenue_baseline) || 0;
    }
  } else if (resolvedClientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('profile_type, tax_regime, annual_revenue_baseline')
      .eq('id', resolvedClientId)
      .maybeSingle();

    if (client) {
      if (client.profile_type && client.profile_type.startsWith('pf')) {
        isPessoaFisica = true;
      }
      const norm = normalizeTaxRegime(client.tax_regime);
      if (norm) {
        taxRegimeCode = norm;
        hasExplicitTaxRegime = true;
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
      .select('profile_type, tax_regime, annual_revenue_baseline, annual_revenue_current')
      .or(`whatsapp_number.eq.${rawPhone},whatsapp_number.ilike.%${cleanNumber}`)
      .limit(1)
      .maybeSingle();

    if (lead) {
      if (lead.profile_type && lead.profile_type.startsWith('pf')) {
        isPessoaFisica = true;
      }
      const norm = normalizeTaxRegime(lead.tax_regime);
      if (norm) {
        taxRegimeCode = norm;
        hasExplicitTaxRegime = true;
      }
      baselineRevenue = Number(lead.annual_revenue_baseline) || 0;
      systemRevenue = Number(lead.annual_revenue_current) || 0;
    }
  }

  const activeRegimeCode: 'mei' | 'simples_me' | 'simples_epp' =
    taxRegimeCode && taxRegimeCode !== 'outro' ? taxRegimeCode : 'simples_me';

  const config = await getParametrizedTaxRegimeLimits(activeRegimeCode);
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

  let statusMessage = '';
  if (isPessoaFisica) {
    statusMessage = `ℹ️ *Perfil Pessoa Física Detectado*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O Termômetro Tributário de faturamento anual é exclusivo para Pessoas Jurídicas (CNPJ).
Para finanças pessoais, suas receitas são tratadas como entradas de salário ou honorários sem limite do Simples!

💡 _Deseja alterar seu perfil para empresa? Digite *!perfil*._`;
  } else if (!hasExplicitTaxRegime || taxRegimeCode === 'outro') {
    statusMessage = `ℹ️ *Regime Tributário Não Configurado*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para que eu monitore o teto fiscal do seu CNPJ sem surpresas com a Receita Federal, você pode se basear pela sua *média mensal de faturamento*:

• *MEI* → Média até *R$ 6.750/mês* (teto anual até R$ 81 mil)
• *Simples* → Média de *R$ 6.750 a R$ 30 mil/mês* (teto anual até R$ 360 mil para ME)
• *EPP* → Média de *R$ 30 mil a R$ 400 mil/mês* (teto anual até R$ 4,8 milhões)

👉 *Como configurar em 1 segundo:*
Basta responder *MEI*, *Simples* ou *EPP*.
Ou apenas me diga: *"Minha média é 15 mil por mês"* que eu calculo e adéquo para você!`;
  } else {
    const monthlyAllowedLimitFmt = Math.round(config.annualLimit / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    statusMessage = `🌡️ *Termômetro Tributário — ${config.name} (${currentYear})*\n`;
    statusMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    statusMessage += `• *Faturamento Acumulado:* ${totalFmt}\n`;
    statusMessage += `• *Teto Oficial Anual:* ${limitFmt} (~${monthlyAllowedLimitFmt}/mês)\n`;
    statusMessage += `• *Margem Segura Restante:* ${remainingFmt}\n`;
    statusMessage += `• *Termômetro Fiscal:* ${progressBar}\n`;
    statusMessage += `• *Sua Média Mensal Atual:* ${monthlyAvgFmt}/mês\n`;
    statusMessage += `• *Média Segura para os Próximos Meses:* ${safeMonthlyAvgFmt}/mês\n`;

    if (riskLevel === 'red') {
      if (totalRevenue <= config.toleranceLimit) {
        statusMessage += `\n⚠️ *Atenção Máxima (Excesso de até 20%):*\n`;
        statusMessage += `Você ultrapassou o teto anual de ${limitFmt}, mas está dentro da margem de tolerância de 20% (${toleranceFmt}).\n`;
        statusMessage += `📌 *Regra da Receita Federal:* O desenquadramento não é retroativo e ocorrerá a partir de 1º de janeiro do próximo ano.`;
      } else {
        statusMessage += `\n🚨 *ALERTA GRAVE (Excesso Superior a 20%):*\n`;
        statusMessage += `Você ultrapassou ${toleranceFmt} (> 20% acima do teto).\n`;
        statusMessage += `❗ *Penalidade da Receita Federal:* O desenquadramento se torna RETROATIVO a janeiro do ano corrente!`;
      }
    } else if (riskLevel === 'orange') {
      statusMessage += `\n🟠 *Atenção Elevada (Risco Iminente):*\n`;
      statusMessage += `Você já consumiu ${percentage}% do seu teto anual. Restam apenas ${remainingFmt} para emissão até dezembro.`;
    } else if (riskLevel === 'yellow') {
      statusMessage += `\n🟡 *Alerta Preventivo (Zona de Atenção):*\n`;
      statusMessage += `Você atingiu ${percentage}% do limite anual. Mantenha seu ritmo de faturamento médio abaixo de ${safeMonthlyAvgFmt}/mês.`;
    } else {
      statusMessage += `\n🟢 *Status Confortável (Zona Segura):*\n`;
      statusMessage += `Seu faturamento acumulado está equilibrado e seguro dentro do limite anual do ${config.name}.`;
    }

    statusMessage += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    statusMessage += `💡 _Dica: Para alterar seu regime ou faturamento prévio deste ano:_\n`;
    statusMessage += `• \`!regime mei\` ou \`!regime simples\`\n`;
    statusMessage += `• \`!faturamento [valor]\` (ex: \`!faturamento 15000\`)`;
  }

  // Mini badge: SÓ EXIBE SE NÃO FOR PF, SE TIVER REGIME EXPLICITO E NÃO FOR OUTRO
  let miniBadge = '';
  if (!isPessoaFisica && hasExplicitTaxRegime && taxRegimeCode !== 'outro') {
    const regimeLabel =
      taxRegimeCode === 'mei'
        ? 'MEI'
        : taxRegimeCode === 'simples_epp'
        ? 'Simples Nacional (EPP)'
        : 'Simples Nacional (ME)';
    miniBadge = `📊 *Termômetro ${regimeLabel}:* ${percentage}% utilizado (${remainingFmt} de margem restante)`;
  }

  return {
    hasDefinedRegime: hasExplicitTaxRegime,
    isPessoaFisica,
    taxRegime: (taxRegimeCode || 'simples_me') as any,
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
  regime: 'mei' | 'simples_me' | 'simples_epp' | 'outro';
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

  const regimeName =
    params.regime === 'outro'
      ? 'Gestão Empresarial (Sem cálculo de teto fiscal)'
      : (TAX_CONFIGS as any)[params.regime]?.name || params.regime;
  let msg = `✅ *Regime Tributário Atualizado!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seu perfil fiscal foi configurado como:
🏢 *${regimeName}*`;

  const conf = (TAX_CONFIGS as any)[params.regime];
  if (conf) {
    const monthlyFmt = conf.monthlyAverageMax.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const annualFmt = conf.annualLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    msg += `\n• *Teto Anual:* ${annualFmt}\n• *Média Mensal Permitida:* até ${monthlyFmt}/mês`;
  }

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
