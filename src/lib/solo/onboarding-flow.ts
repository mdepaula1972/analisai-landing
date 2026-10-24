import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export type ProfileType = 'pj' | 'pf_liberal' | 'pf_individual' | 'pf_family';
export type OnboardingStep = 'awaiting_pf_or_pj' | 'awaiting_pf_subtype' | 'awaiting_pj_regime' | 'awaiting_pj_regime_confirmation' | 'completed';

export interface OnboardingState {
  isCompleted: boolean;
  step?: OnboardingStep;
  profileType?: ProfileType;
}

export interface RevenueInferenceResult {
  monthlyAmount: number;
  annualAmount: number;
  suggestedRegime: 'mei' | 'simples_me' | 'simples_epp' | 'outro';
  regimeName: string;
  explanation: string;
}

/**
 * Infere o regime tributário adequado com base na média mensal ou faturamento anual informado em texto livre.
 */
export function inferRevenueAndRegime(input: string): RevenueInferenceResult | null {
  const clean = input.toLowerCase().trim();

  // Opções diretas tratadas à parte
  if (['1', '2', '3', '4', 'mei', 'simples', 'epp', 'outro', 'outros', 'presumido'].includes(clean)) {
    return null;
  }

  const hasRevenueContext =
    /(fatur|m[eé]dia|ganh|receb|entr|m[eê]s|mensal|ano|anual|reais|r\$|\bmil\b|\bk\b|\bmi\b|milh)/i.test(clean) ||
    /\d+/.test(clean);

  if (!hasRevenueContext) return null;

  const isExplicitAnnual = /(ano|anual|ao ano|por ano|\/ano)/i.test(clean);
  let parsedValue = 0;

  // 1. Milhões
  const millionMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:milh[oõ]es|milh[aã]o|mi\b)/i);
  if (millionMatch) {
    const rawNum = parseFloat(millionMatch[1].replace(',', '.'));
    parsedValue = rawNum * 1_000_000;
  }

  // 2. Mil / K
  if (!parsedValue) {
    const thousandMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:mil\b|k\b)/i);
    if (thousandMatch) {
      const rawNum = parseFloat(thousandMatch[1].replace(',', '.'));
      parsedValue = rawNum * 1_000;
    }
  }

  // 3. Valor formatado em Reais ou numérico
  if (!parsedValue) {
    const numberMatch = clean.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:[.,]\d{2})?|\d+)/i);
    if (numberMatch) {
      let numStr = numberMatch[1];
      if (numStr.includes('.') && numStr.includes(',')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.');
      } else if (numStr.includes('.')) {
        if (numStr.split('.')[1].length === 3) {
          numStr = numStr.replace(/\./g, '');
        }
      } else if (numStr.includes(',')) {
        numStr = numStr.replace(',', '.');
      }
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        parsedValue = val;
      }
    }
  }

  if (!parsedValue || parsedValue < 100) {
    return null;
  }

  let monthlyAmount = 0;
  let annualAmount = 0;

  if (isExplicitAnnual) {
    annualAmount = parsedValue;
    monthlyAmount = Math.round(annualAmount / 12);
  } else {
    const hasMonthContext = /(m[eê]s|mensal|por m[eê]s|\/m[eê]s)/i.test(clean);
    if (parsedValue > 400000 && !hasMonthContext) {
      annualAmount = parsedValue;
      monthlyAmount = Math.round(annualAmount / 12);
    } else {
      monthlyAmount = parsedValue;
      annualAmount = parsedValue * 12;
    }
  }

  let suggestedRegime: 'mei' | 'simples_me' | 'simples_epp' | 'outro' = 'mei';
  let regimeName = '';
  let explanation = '';

  const monthlyFmt = monthlyAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const annualFmt = annualAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (monthlyAmount <= 6750) {
    suggestedRegime = 'mei';
    regimeName = 'MEI (Microempreendedor Individual)';
    explanation = `Com uma média de *${monthlyFmt}/mês* (~*${annualFmt}/ano*), seu negócio se enquadra perfeitamente no *MEI*, que tem teto anual de até *R$ 81 mil* (~R$ 6.750/mês).`;
  } else if (monthlyAmount <= 30000) {
    suggestedRegime = 'simples_me';
    regimeName = 'Simples Nacional — ME (Microempresa)';
    explanation = `Com uma média de *${monthlyFmt}/mês* (~*${annualFmt}/ano*), seu faturamento supera o teto do MEI (R$ 6.750/mês) e se adequa ao *Simples Nacional — ME (Microempresa)*, com limite anual de até *R$ 360 mil* (~R$ 30 mil/mês).`;
  } else if (monthlyAmount <= 400000) {
    suggestedRegime = 'simples_epp';
    regimeName = 'Simples Nacional — EPP (Pequeno Porte)';
    explanation = `Com uma média de *${monthlyFmt}/mês* (~*${annualFmt}/ano*), seu faturamento supera o teto de ME (R$ 30 mil/mês) e se adequa ao *Simples Nacional — EPP (Pequeno Porte)*, com limite de até *R$ 4,8 milhões/ano* (~R$ 400 mil/mês).`;
  } else {
    suggestedRegime = 'outro';
    regimeName = 'Lucro Presumido / Outro';
    explanation = `Com uma média de *${monthlyFmt}/mês* (~*${annualFmt}/ano*), o faturamento supera o teto máximo do Simples Nacional (R$ 4,8 milhões/ano), sendo mais adequado para *Lucro Presumido ou Lucro Real*.`;
  }

  return {
    monthlyAmount,
    annualAmount,
    suggestedRegime,
    regimeName,
    explanation,
  };
}

/**
 * Monta a mensagem de sugestão didática para confirmação do usuário
 */
export function buildTaxRegimeProposalMessage(inference: RevenueInferenceResult): string {
  return `📊 *Análise de Adequação do Enquadramento:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${inference.explanation}

👉 *Podemos confirmar seu enquadramento como ${inference.regimeName}?*
• Responda *1* ou *Sim* para confirmar e ativar seu radar fiscal.
• Ou me diga se o enquadramento for diferente (ex: *MEI*, *Simples* ou *EPP*).`;
}

/**
 * 1. Mensagem de Boas-Vindas + Pergunta Didática Inicial (PF ou PJ)
 */
export function getWelcomeAndPfPjMessage(): string {
  return `👋 *Olá! Seja muito bem-vindo ao AnalisAí!*
Sou sua inteligência financeira no WhatsApp, pronta para desburocratizar sua rotina, organizar suas contas e fluxo de caixa em segundos.

Para que eu personalize seus alertas, categorias e relatórios desde o início, me conte:
*A sua utilização será como Pessoa Física (PF) ou Pessoa Jurídica (PJ)?*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *Escolha uma opção:*

*1* ou *PJ* → *Pessoa Jurídica*
_(Para MEIs, autônomos com CNPJ e empresas. Foco no Livro Caixa do negócio, controle de faturamento, DRE contábil e teto fiscal do Simples/MEI)._

*2* ou *PF* → *Pessoa Física*
_(Para controle das finanças pessoais, contas do dia a dia, orçamento e patrimônio, sem necessidade de CNPJ)._
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Basta responder com *1* ou *2* (ou digitar *PJ* / *PF*)._`;
}

/**
 * 2. Mensagem Didática de Desdobramento para PJ com Média Mensal e Teto Anual
 */
export function getPjTaxRegimeMessage(): string {
  return `Perfeito! 🏢 *Gestão Financeira para Pessoa Jurídica (PJ).*

Para que eu monitore o teto fiscal do seu negócio sem surpresas com a Receita Federal, precisamos adequar seu enquadramento tributário.

Como muitos empreendedores têm dúvidas sobre os limites anuais, você pode se guiar pela sua *média mensal de faturamento*:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *Escolha uma das opções abaixo:*

*1* → *MEI (Microempreendedor Individual)*
• Média de até *R$ 6.750/mês* (teto anual de até R$ 81 mil)
• _Alerta automático de margem de segurança a cada receita._

*2* → *Simples Nacional (Microempresa — ME)*
• Média de *R$ 6.750 a R$ 30 mil/mês* (teto anual de até R$ 360 mil)
• _Separação de pró-labore, livro caixa contábil e fluxo de caixa._

*3* → *Simples Nacional (Empresa de Pequeno Porte — EPP)*
• Média de *R$ 30 mil a R$ 400 mil/mês* (teto anual de até R$ 4,8 milhões)
• _Monitoramento de faturamento avançado e múltiplos centros de custo._

*4* → *Lucro Presumido / Outro / Grande Porte*
• Faturamento acima de *R$ 400 mil/mês* (mais de R$ 4,8 milhões/ano)
• _Gestão empresarial completa sem monitoramento de teto do Simples._
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Dúvida no enquadramento?*
Basta responder dizendo quanto sua empresa fatura em média (ex: *"faturo 15 mil por mês"* ou *"média de 5 mil"*). 
O AnalisAí calculará a adequação e pedirá sua confirmação!`;
}

/**
 * 2.1 Mensagens de Conclusão do Onboarding para PJ por Regime
 */
export function getPjOnboardingCompletionMessage(regime: 'mei' | 'simples_me' | 'simples_epp' | 'outro'): string {
  if (regime === 'mei') {
    return `🏢 *Excelente! Seu AnalisAí está configurado para MEI (Microempreendedor Individual).*

A partir de agora, suas finanças serão geridas com inteligência tributária:
• 📑 *Leitura de notas fiscais, boletos e recibos* com extração automática
• ⏰ *Lembretes na véspera às 10h* com Pix copia-e-cola para não pagar juros
• 🌡️ *Termômetro MEI:* Radar ativo no faturamento para monitorar o teto anual de até R$ 81 mil (~R$ 6.750/mês)
• 📊 *Livro Caixa e DRE* prontos para você acompanhar e enviar ao contador

📸 *Para começar agora mesmo:*
Envie uma foto ou PDF de um boleto/nota fiscal, ou mande um áudio/texto dizendo suas despesas e receitas! 🚀`;
  }

  if (regime === 'simples_me') {
    return `🏢 *Excelente! Seu AnalisAí está configurado para Simples Nacional (Microempresa — ME).*

A partir de agora, suas finanças serão geridas com inteligência contábil empresarial:
• 📑 *Leitura de notas fiscais, boletos e faturas* com extração automática
• ⏰ *Lembretes na véspera às 10h* com código Pix copia-e-cola
• 🌡️ *Termômetro do Simples Nacional:* Acompanhamento anual do faturamento (limite de R$ 360 mil ou ~R$ 30 mil/mês)
• 📊 *Fechamento Contábil e DRE:* Relatórios limpos para você e seu contador

📸 *Para começar agora mesmo:*
Envie uma foto ou PDF de um boleto/nota fiscal, ou mande um áudio/texto dizendo suas despesas e receitas! 🚀`;
  }

  if (regime === 'simples_epp') {
    return `🏢 *Excelente! Seu AnalisAí está configurado para Simples Nacional (EPP — Empresa de Pequeno Porte).*

A partir de agora, suas finanças contarão com gestão contábil de alto nível:
• 📑 *Leitura de notas fiscais, boletos e faturas* com extração automática
• ⏰ *Lembretes na véspera às 10h* com código Pix copia-e-cola
• 🌡️ *Termômetro Tributário EPP:* Acompanhamento anual até R$ 4,8 milhões (~R$ 400 mil/mês)
• 📊 *Fechamento Contábil, Livro Caixa e DRE* completos em tempo real

📸 *Para começar agora mesmo:*
Envie uma foto ou PDF de um boleto/nota fiscal, ou mande um áudio/texto dizendo suas despesas e receitas! 🚀`;
  }

  return `🏢 *Excelente! Seu AnalisAí está configurado para Gestão Empresarial (Pessoa Jurídica).*

Seu assistente já está pronto para cuidar da rotina financeira do seu negócio:
• 📑 *Leitura de notas fiscais, boletos e faturas* em segundos
• ⏰ *Lembretes na véspera às 10h* para evitar multas e juros
• 📊 *Fluxo de caixa, relatórios contábeis e demonstrativo DRE* em tempo real

📸 *Para começar agora mesmo:*
Envie uma foto ou PDF de um boleto/nota fiscal, ou mande um áudio/texto dizendo suas despesas e receitas! 🚀`;
}

/**
 * 2. Mensagem Didática de Desdobramento para PF (Liberal, Único ou Família)
 */
export function getPfSubtypeMessage(): string {
  return `Perfeito! 👤 *Gestão Financeira para Pessoa Física.*

Para eu calibrar o seu assistente no formato exato da sua rotina, qual é o seu perfil de uso principal?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *Escolha uma das opções:*

*1* → *Profissional Liberal / Autônomo*
_(Ideal para médicos, advogados, dentistas, psicólogos, corretores, arquitetos e consultores. Permite separar despesas da profissão das pessoais para o Livro Caixa do Carnê-Leão e deduções no IRPF)._

*2* → *Uso Único / Pessoal Individual*
_(Ideal para você controlar seu salário, cartão de crédito, compras, contas fixas e metas financeiras pessoais com total privacidade)._

*3* → *Família / Casal*
_(Ideal para o orçamento compartilhado da residência: contas de luz, água, internet, supermercado, escola dos filhos e planejamento doméstico conjunto)._
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Basta responder com *1*, *2* ou *3* (ou escrever *Liberal*, *Pessoal* ou *Família*)._`;
}

/**
 * 3. Mensagens de Conclusão do Onboarding por Perfil
 */
export function getOnboardingCompletionMessage(profile: ProfileType): string {
  switch (profile) {
    case 'pj':
      return `🏢 *Excelente! Seu AnalisAí está configurado para Pessoa Jurídica (PJ).*

A partir de agora, suas finanças serão geridas com inteligência empresarial:
• 📑 *Leitura de notas fiscais, boletos e faturas* com extração automática de dados
• ⏰ *Lembretes na véspera às 10h* com código Pix copia-e-cola para não pagar juros
• 🌡️ *Termômetro Tributário* para monitorar seu faturamento anual no Simples/MEI
• 📊 *Livro Caixa e DRE* prontos para você acompanhar e enviar ao contador

📸 *Para começar agora mesmo:*
Envie uma foto ou PDF de um boleto/nota fiscal, ou mande um áudio/texto dizendo suas despesas e receitas (ex: *"Paguei 350 de fornecedor hoje"* ou *"Recebi 2.500 de serviço"*). 🚀`;

    case 'pf_liberal':
      return `💼 *Excelente! Seu AnalisAí está configurado para Profissional Liberal / Autônomo.*

Seu assistente já está calibrado para desburocratizar seu trabalho:
• 💵 *Entradas de honorários e pagamentos:* Registro rápido por áudio ou foto de comprovante
• ⚖️ *Separação inteligente:* Distingue despesas da sua atividade profissional de contas pessoais
• 📋 *Livro Caixa:* Histórico organizado para facilitar seu Carnê-Leão e declaração anual

📸 *Para começar agora mesmo:*
Envie a foto de um boleto/recibo ou mande um áudio simples (ex: *"Recebi 800 de honorários"* ou *"Paguei 120 de conselho profissional"*). Em segundos eu organizo para você! 🚀`;

    case 'pf_individual':
      return `✨ *Excelente! Seu AnalisAí está configurado para Uso Pessoal Individual.*

Seu assistente financeiro pessoal está ativo para cuidar do seu bolso:
• ⏰ *Lembretes na véspera às 10h:* Nunca mais pague multas ou juros por esquecer um vencimento
• 🧭 *Clareza financeira:* Saiba exatamente para onde vai o seu salário todo mês
• 📱 *Painel Mobile:* Acompanhe seus gráficos e fluxo financeiro em tempo real

📸 *Para começar agora mesmo:*
Envie a foto de um boleto ou mande uma mensagem/áudio com uma conta sua (ex: *"Pagar internet R$ 110 dia 20"*). É simples, rápido e direto! 🚀`;

    case 'pf_family':
      return `🏡 *Excelente! Seu AnalisAí está configurado para Gestão Familiar & Doméstica.*

O orçamento do seu lar agora conta com um assistente dedicado:
• 💡 *Contas da residência:* Energia, água, gás, internet e condomínio organizadas
• 🎒 *Despesas da família:* Supermercado, saúde, colégio dos filhos e passeios sob controle
• 📊 *Fechamento mensal descomplicado:* Saiba o custo total do lar sem planilhas difíceis

📸 *Para começar agora mesmo:*
Envie uma foto de conta de consumo ou mande um áudio/texto com os gastos da casa hoje (ex: *"Supermercado R$ 280"*). Eu agendo seus lembretes na hora! 🚀`;
  }
}

/**
 * Consulta o estado atual de Onboarding do contato
 */
export async function getOnboardingState(params: {
  cleanPhone: string;
  client?: any;
}): Promise<OnboardingState> {
  const { cleanPhone, client } = params;
  const supabase = createServiceRoleClient();

  // Se já for cliente cadastrado com perfil definido
  if (client?.profile_type) {
    return { isCompleted: true, profileType: client.profile_type as ProfileType };
  }

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('profile_type, onboarding_step')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (lead?.profile_type && lead?.onboarding_step === 'completed') {
    return {
      isCompleted: true,
      profileType: lead.profile_type as ProfileType,
      step: 'completed',
    };
  }

  return {
    isCompleted: false,
    step: (lead?.onboarding_step as OnboardingStep) || 'awaiting_pf_or_pj',
    profileType: (lead?.profile_type as ProfileType) || undefined,
  };
}

/**
 * Inicia o Onboarding enviando a mensagem de boas-vindas com a pergunta PF x PJ
 */
export async function startOnboarding(params: {
  phone: string;
  cleanPhone: string;
  client?: any;
}): Promise<void> {
  const { phone, cleanPhone, client } = params;
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // Registra no trial_leads o início do onboarding
  const { data: existingLead } = await supabase
    .from('trial_leads')
    .select('id')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (existingLead) {
    await supabase
      .from('trial_leads')
      .update({
        onboarding_step: 'awaiting_pf_or_pj',
        terms_accepted_at: nowIso,
      })
      .eq('id', existingLead.id);
  } else {
    await supabase.from('trial_leads').insert({
      whatsapp_number: cleanPhone,
      onboarding_step: 'awaiting_pf_or_pj',
      terms_accepted_at: nowIso,
      first_interaction_at: nowIso,
    });
  }

  if (client?.id) {
    await supabase
      .from('clients')
      .update({ terms_accepted_at: nowIso })
      .eq('id', client.id);
  }

  await sendEvolutionText({
    phone,
    text: getWelcomeAndPfPjMessage(),
  });
}

/**
 * Processa a resposta do usuário durante as etapas do onboarding
 */
export async function processOnboardingResponse(params: {
  phone: string;
  cleanPhone: string;
  rawText: string;
  client?: any;
}): Promise<{ handled: boolean; completed: boolean; profile?: ProfileType }> {
  const { phone, cleanPhone, rawText, client } = params;
  const clean = rawText.trim().toLowerCase();
  const supabase = createServiceRoleClient();

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, onboarding_step, profile_type, doc_data')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  const currentStep: OnboardingStep = (lead?.onboarding_step as OnboardingStep) || 'awaiting_pf_or_pj';

  // ── ETAPA 1: ESCOLHA ENTRE PF E PJ ──
  if (currentStep === 'awaiting_pf_or_pj') {
    const isPj =
      /^(1\b|1\.|pj\b|empresa\b|cnpj\b|jur[ií]dica\b|mei\b|microempresa\b|comercial\b|neg[oó]cio\b)/i.test(clean) ||
      clean === '1' || clean === 'pj';

    const isPf =
      /^(2\b|2\.|pf\b|f[ií]sica\b|pessoa f[ií]sica\b|pessoal\b|casa\b|mim\b|minha\b|particular\b)/i.test(clean) ||
      clean === '2' || clean === 'pf';

    if (isPj) {
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({
            profile_type: 'pj',
            onboarding_step: 'awaiting_pj_regime',
          })
          .eq('id', lead.id);
      }
      if (client?.id) {
        await supabase
          .from('clients')
          .update({ profile_type: 'pj', tax_type: 'CNPJ' })
          .eq('id', client.id);
      }

      await sendEvolutionText({
        phone,
        text: getPjTaxRegimeMessage(),
      });

      return { handled: true, completed: false };
    }

    if (isPf) {
      // Avança para a pergunta didática de subtipos da PF
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({
            onboarding_step: 'awaiting_pf_subtype',
          })
          .eq('id', lead.id);
      }

      await sendEvolutionText({
        phone,
        text: getPfSubtypeMessage(),
      });

      return { handled: true, completed: false };
    }

    // Se o usuário digitou algo não reconhecido durante a pergunta PF x PJ
    await sendEvolutionText({
      phone,
      text: `Entendi! Para eu direcionar sua experiência corretamente:
*A sua utilização será como Pessoa Jurídica (1) ou Pessoa Física (2)?*

• Digite *1* para *Pessoa Jurídica (PJ / MEI / Empresa)*
• Digite *2* para *Pessoa Física (PF / Contas Pessoais)*`,
    });
    return { handled: true, completed: false };
  }

  // ── ETAPA 2: ESCOLHA DO SUBTIPO DE PF (LIBERAL, ÚNICO OU FAMÍLIA) ──
  if (currentStep === 'awaiting_pf_subtype') {
    const isLiberal =
      /^(1\b|1\.|liberal\b|aut[oô]nomo\b|freelancer\b|m[eé]dico\b|advogado\b|dentista\b|arquiteto\b|corretor\b|consultor\b|psic[oó]logo\b|profissional\b|honor[aá]rios\b)/i.test(clean) ||
      clean === '1';

    const isIndividual =
      /^(2\b|2\.|[uú]nico\b|pessoal\b|individual\b|s[oó] meu\b|apenas eu\b|minhas contas\b|sal[aá]rio\b)/i.test(clean) ||
      clean === '2';

    const isFamily =
      /^(3\b|3\.|fam[ií]lia\b|casal\b|casa\b|dom[eé]stico\b|filhos\b|resid[eê]ncia\b|escola\b)/i.test(clean) ||
      clean === '3';

    let chosenProfile: ProfileType | null = null;
    if (isLiberal) chosenProfile = 'pf_liberal';
    else if (isIndividual) chosenProfile = 'pf_individual';
    else if (isFamily) chosenProfile = 'pf_family';

    if (chosenProfile) {
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({
            profile_type: chosenProfile,
            onboarding_step: 'completed',
            tax_regime: 'pf',
          })
          .eq('id', lead.id);
      }
      if (client?.id) {
        await supabase
          .from('clients')
          .update({ profile_type: chosenProfile, tax_type: 'CPF' })
          .eq('id', client.id);
      }

      await sendEvolutionText({
        phone,
        text: getOnboardingCompletionMessage(chosenProfile),
      });

      return { handled: true, completed: true, profile: chosenProfile };
    }

    // Se não compreendeu o subtipo
    await sendEvolutionText({
      phone,
      text: `Por favor, selecione qual é o seu formato principal de uso:
• Digite *1* para *Profissional Liberal / Autônomo* (Honorários e Carnê-Leão)
• Digite *2* para *Uso Único / Pessoal* (Salário, cartão e contas individuais)
• Digite *3* para *Família / Casal* (Orçamento doméstico compartilhado)`,
    });
    return { handled: true, completed: false };
  }

  // ── ETAPA 3: ESCOLHA OU DEDUÇÃO POR MÉDIA DO ENQUADRAMENTO DE PJ ──
  if (currentStep === 'awaiting_pj_regime') {
    const isMei =
      /^(1\b|1\.|mei\b|microempreendedor\b|teto 81\b)/i.test(clean) ||
      clean === '1' || clean === 'mei';

    const isSimples =
      /^(2\b|2\.|simples\b|simples nacional\b|microempresa\b|me\b)/i.test(clean) ||
      clean === '2' || clean === 'simples' || clean === 'me';

    const isEpp =
      /^(3\b|3\.|epp\b|pequeno porte\b|empresa de pequeno porte\b)/i.test(clean) ||
      clean === '3' || clean === 'epp';

    const isOutro =
      /^(4\b|4\.|outro\b|outros\b|presumido\b|real\b|n[aã]o sei\b|indiferente\b|grande porte\b)/i.test(clean) ||
      clean === '4' || clean === 'outro';

    let chosenRegime: 'mei' | 'simples_me' | 'simples_epp' | 'outro' | null = null;
    if (isMei) chosenRegime = 'mei';
    else if (isSimples) chosenRegime = 'simples_me';
    else if (isEpp) chosenRegime = 'simples_epp';
    else if (isOutro) chosenRegime = 'outro';

    if (chosenRegime) {
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({
            profile_type: 'pj',
            tax_regime: chosenRegime,
            onboarding_step: 'completed',
          })
          .eq('id', lead.id);
      }
      if (client?.id) {
        await supabase
          .from('clients')
          .update({
            profile_type: 'pj',
            tax_regime: chosenRegime,
            tax_type: 'CNPJ',
          })
          .eq('id', client.id);
      }

      await sendEvolutionText({
        phone,
        text: getPjOnboardingCompletionMessage(chosenRegime),
      });

      return { handled: true, completed: true, profile: 'pj' };
    }

    // Se o usuário digitou uma média mensal ou faturamento em texto livre
    const inference = inferRevenueAndRegime(clean);
    if (inference) {
      const existingDocData = (lead?.doc_data && typeof lead.doc_data === 'object') ? lead.doc_data : {};
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({
            profile_type: 'pj',
            onboarding_step: 'awaiting_pj_regime_confirmation',
            doc_data: {
              ...existingDocData,
              suggested_regime: inference.suggestedRegime,
              estimated_monthly: inference.monthlyAmount,
              estimated_annual: inference.annualAmount,
            },
          })
          .eq('id', lead.id);
      }

      await sendEvolutionText({
        phone,
        text: buildTaxRegimeProposalMessage(inference),
      });

      return { handled: true, completed: false };
    }

    // Se o usuário digitou algo não reconhecido durante a pergunta de regime PJ
    await sendEvolutionText({
      phone,
      text: `Entendi! Para que eu calibre o Termômetro Tributário do seu negócio:
*Qual é o enquadramento tributário da sua empresa?*

• Digite *1* para *MEI* (média até R$ 6.750/mês | teto R$ 81 mil/ano)
• Digite *2* para *Simples Nacional — ME* (média até R$ 30 mil/mês | teto R$ 360 mil/ano)
• Digite *3* para *Simples Nacional — EPP* (média até R$ 400 mil/mês | teto R$ 4,8 mi/ano)
• Digite *4* para *Lucro Presumido / Outro* (acima de R$ 400 mil/mês)

💡 _Ou simplesmente me diga sua média mensal (ex: *"faturo 15 mil por mês"*)._`,
    });
    return { handled: true, completed: false };
  }

  // ── ETAPA 4: CONFIRMAÇÃO DA ADEQUAÇÃO TRIBUTÁRIA SUGERIDA ──
  if (currentStep === 'awaiting_pj_regime_confirmation') {
    const isAffirmative =
      /^(1\b|1\.|sim\b|s\b|confirmo\b|confirmar\b|confirmado\b|pode ser\b|correto\b|isso\b|ok\b|beleza\b|perfeito\b|fechado\b|claro\b|positivo\b)/i.test(clean) ||
      clean === '1' || clean === 'sim' || clean === 's';

    const isMei = clean === 'mei' || clean.includes('sou mei');
    const isSimples = clean === 'simples' || clean.includes('sou simples') || clean === 'me';
    const isEpp = clean === 'epp' || clean.includes('sou epp');
    const isOutro = clean === 'outro' || clean === 'presumido';

    const docData: any = (lead?.doc_data && typeof lead.doc_data === 'object') ? lead.doc_data : {};
    const suggestedRegime: 'mei' | 'simples_me' | 'simples_epp' | 'outro' =
      isMei ? 'mei' : isSimples ? 'simples_me' : isEpp ? 'simples_epp' : isOutro ? 'outro' : docData.suggested_regime || 'simples_me';

    if (isAffirmative || isMei || isSimples || isEpp || isOutro) {
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({
            profile_type: 'pj',
            tax_regime: suggestedRegime,
            onboarding_step: 'completed',
            annual_revenue_baseline: docData.estimated_annual || null,
          })
          .eq('id', lead.id);
      }
      if (client?.id) {
        await supabase
          .from('clients')
          .update({
            profile_type: 'pj',
            tax_regime: suggestedRegime,
            tax_type: 'CNPJ',
            annual_revenue_baseline: docData.estimated_annual || null,
          })
          .eq('id', client.id);
      }

      await sendEvolutionText({
        phone,
        text: getPjOnboardingCompletionMessage(suggestedRegime),
      });

      return { handled: true, completed: true, profile: 'pj' };
    }

    const isNegative = /^(n[aã]o\b|n\b|errado\b|incorreto\b)/i.test(clean);
    if (isNegative) {
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({ onboarding_step: 'awaiting_pj_regime' })
          .eq('id', lead.id);
      }
      await sendEvolutionText({
        phone,
        text: getPjTaxRegimeMessage(),
      });
      return { handled: true, completed: false };
    }

    // Se o usuário digitou outro valor ou faturamento
    const newInference = inferRevenueAndRegime(clean);
    if (newInference) {
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({
            doc_data: {
              ...docData,
              suggested_regime: newInference.suggestedRegime,
              estimated_monthly: newInference.monthlyAmount,
              estimated_annual: newInference.annualAmount,
            },
          })
          .eq('id', lead.id);
      }
      await sendEvolutionText({
        phone,
        text: buildTaxRegimeProposalMessage(newInference),
      });
      return { handled: true, completed: false };
    }

    await sendEvolutionText({
      phone,
      text: `Por favor, me confirme:
Podemos definir seu enquadramento como sugerido?

• Digite *1* ou *Sim* para confirmar.
• Ou digite *MEI*, *Simples* ou *EPP* se preferir outro regime.`,
    });
    return { handled: true, completed: false };
  }

  return { handled: false, completed: true };
}
