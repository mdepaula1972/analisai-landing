import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export type ProfileType = 'pj' | 'pf_liberal' | 'pf_individual' | 'pf_family';
export type OnboardingStep = 'awaiting_pf_or_pj' | 'awaiting_pf_subtype' | 'completed';

export interface OnboardingState {
  isCompleted: boolean;
  step?: OnboardingStep;
  profileType?: ProfileType;
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
    .select('id, onboarding_step, profile_type')
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
      // Salva perfil PJ
      if (lead?.id) {
        await supabase
          .from('trial_leads')
          .update({
            profile_type: 'pj',
            onboarding_step: 'completed',
            tax_regime: 'simples',
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
        text: getOnboardingCompletionMessage('pj'),
      });

      return { handled: true, completed: true, profile: 'pj' };
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

  return { handled: false, completed: true };
}
