import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export type ProfileType = 'pj' | 'pf_liberal' | 'pf_individual' | 'pf_family';
export type OnboardingStep =
  | 'awaiting_pf_or_pj'
  | 'awaiting_pf_subtype'
  | 'awaiting_pj_regime'
  | 'awaiting_pj_regime_confirmation'
  | 'awaiting_initial_balance'
  | 'completed';

export interface OnboardingState {
  isCompleted: boolean;
  step?: OnboardingStep;
  profileType?: ProfileType;
  isMixedProfile?: boolean;
}

export interface RevenueInferenceResult {
  monthlyAmount: number;
  annualAmount: number;
  suggestedRegime: 'mei' | 'simples_me' | 'simples_epp' | 'outro';
  regimeName: string;
  explanation: string;
  hasNoInvoiceContext?: boolean;
}

/**
 * Infere o regime tributário adequado com sensibilidade entre Caixa Real e Notas Fiscais Declaradas.
 */
export function inferRevenueAndRegime(input: string): RevenueInferenceResult | null {
  const clean = input.toLowerCase().trim();

  // Opções diretas tratadas à parte
  if (['1', '2', '3', '4', 'mei', 'simples', 'epp', 'outro', 'outros', 'presumido'].includes(clean)) {
    return null;
  }

  const hasNoInvoiceContext =
    /(sem nota|sem nf|n[aã]o emito nota|n[aã]o tiro nota|n[aã]o emite nota|sem emitir|s[oó] dinheiro|sem faturar oficial|n[aã]o oficial)/i.test(clean);

  const hasRevenueContext =
    /(fatur|m[eé]dia|ganh|receb|entr|m[eê]s|mensal|ano|anual|reais|r\$|\bmil\b|\bk\b|\bmi\b|milh|nota|nf)/i.test(clean) ||
    hasNoInvoiceContext ||
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

  // Regra de sensibilidade contábil (Caixa Real vs Notas Fiscais Declaradas):
  if (hasNoInvoiceContext) {
    suggestedRegime = 'mei';
    regimeName = 'MEI (Microempreendedor Individual)';
    explanation = `Entendi! Sua movimentação total de caixa é de *${monthlyFmt}/mês* (~*${annualFmt}/ano*), sem emissão de Nota Fiscal.\n\n` +
      `💡 *Sensibilidade Fiscal:*\n` +
      `• Para o **MEI**, a emissão de NF para consumidor final (pessoa física) é dispensada por lei, com teto de até R$ 81 mil/ano (~R$ 6.750/mês).\n` +
      `• Já para o **Simples Nacional**, a emissão de NF é obrigatória em todas as operações e o imposto DAS incide sobre as notas transmitidas.\n\n` +
      `O AnalisAí controlará **100% das suas entradas reais de caixa** para você não perder dinheiro, e cuidará da régua do seu CNPJ.`;
  } else if (monthlyAmount <= 6750) {
    suggestedRegime = 'mei';
    regimeName = 'MEI (Microempreendedor Individual)';
    explanation = `Com uma média de *${monthlyFmt}/mês* (~*${annualFmt}/ano*), seu negócio está confortavelmente dentro do teto do *MEI* (até R$ 81 mil/ano).\n` +
      `Lembrando que para o MEI, a emissão de nota fiscal para consumidor pessoa física é dispensada!`;
  } else if (monthlyAmount <= 30000) {
    suggestedRegime = 'simples_me';
    regimeName = 'Simples Nacional — ME (Microempresa)';
    explanation = `Sua média de faturamento no caixa é de *${monthlyFmt}/mês* (~*${annualFmt}/ano*).\n\n` +
      `💡 *Sensibilidade Fiscal (Caixa Real vs Notas Fiscais):*\n` +
      `• O enquadramento na Receita Federal considera o faturamento **oficial emitido em Nota Fiscal**.\n` +
      `• Se a sua empresa emite NF desse valor total, seu regime adequado é o *Simples Nacional — ME (Microempresa)*, com teto até R$ 360 mil/ano.\n` +
      `• Se você formalmente ainda é *MEI* (emitindo até R$ 6.750/mês em notas fiscais oficiais):\n` +
      `  O AnalisAí gerencia 100% do seu caixa real e monitora no termômetro o teto formal do MEI!`;
  } else if (monthlyAmount <= 400000) {
    suggestedRegime = 'simples_epp';
    regimeName = 'Simples Nacional — EPP (Pequeno Porte)';
    explanation = `Sua média de faturamento no caixa é de *${monthlyFmt}/mês* (~*${annualFmt}/ano*).\n\n` +
      `💡 *Sensibilidade Fiscal:*\n` +
      `No Simples Nacional, os limites de ME (R$ 360 mil/ano) e EPP (R$ 4,8 milhões/ano) incidem estritamente sobre as **notas fiscais emitidas e informadas à Receita Federal**.`;
  } else {
    suggestedRegime = 'outro';
    regimeName = 'Lucro Presumido / Outro';
    explanation = `Com uma média de *${monthlyFmt}/mês* (~*${annualFmt}/ano*), o faturamento supera o teto do Simples Nacional (R$ 4,8 milhões/ano em NF), enquadrando-se em *Lucro Presumido ou Lucro Real*.`;
  }

  return {
    monthlyAmount,
    annualAmount,
    suggestedRegime,
    regimeName,
    explanation,
    hasNoInvoiceContext,
  };
}

/**
 * Monta a mensagem didática e educativa para confirmação do usuário (sem tom fiscal punitivo)
 */
export function buildTaxRegimeProposalMessage(inference: RevenueInferenceResult): string {
  const monthlyFmt = inference.monthlyAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const annualFmt = inference.annualAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Caso 1: Usuário mencionou que não emite nota ou opera direto no caixa
  if (inference.hasNoInvoiceContext) {
    return `📊 *Análise Educativa do seu Negócio:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Excelente! Ter uma movimentação de *${monthlyFmt}/mês* (~*${annualFmt}/ano*) mostra que seu negócio tem tração e está girando forte! 🚀

💡 *Um toque amigo sobre seu enquadramento:*
No dia a dia de quem atende o público, é muito comum o dinheiro do caixa ser diferente do que tem nota emitida:
• Se o seu CNPJ hoje é **MEI**, fique super tranquilo! O AnalisAí vai organizar **100% das suas entradas reais de caixa** para você não perder dinheiro, e te ajuda a acompanhar suavemente a referência de R$ 81 mil/ano.
• Se você já emite notas fiscais ou quer calibrar para o **Simples Nacional**, também podemos ajustar agora mesmo!

👉 *Como você prefere calibrar seu assistente hoje?*
• Digite *1* (ou *Sim*) para manter no *MEI* (eu controlo seu caixa total e te aviso o momento ideal de crescer)
• Digite *2* se seu CNPJ já opera formalmente como *Simples Nacional (ME)*
• Digite *3* se for *EPP* ou outro formato`;
  }

  // Caso 2: Faturamento médio entre R$ 6.750 e R$ 30.000/mês
  if (inference.monthlyAmount > 6750 && inference.monthlyAmount <= 30000) {
    return `📊 *Análise Educativa do seu Negócio:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parabéns pelo ritmo! Uma média de *${monthlyFmt}/mês* (~*${annualFmt}/ano*) é uma ótima marca para o seu negócio! 🚀

💡 *Um toque parceiro sobre seu enquadramento:*
No dia a dia, é super comum haver diferença entre o total que entra no caixa e as notas fiscais emitidas:
• Se o seu CNPJ hoje ainda é **MEI**, sem crise nenhuma! Eu controlo 100% do seu dinheiro real no caixa e te dou visibilidade para você planejar os próximos passos com segurança.
• Se você já emite notas fiscais nesse volume, o regime de **Microempresa (Simples Nacional)** se encaixa como uma luva (limite até R$ 360 mil/ano).

👉 *Como você prefere que o AnalisAí calibre seu termômetro hoje?*
• Digite *1* (ou *Sim*) se quer calibrar como *Simples Nacional (ME)*
• Digite *2* (ou *MEI*) se seu CNPJ hoje opera como *MEI* (eu cuido do seu caixa e te aviso com antecedência quando valer a pena mudar)
• Ou me diga se for *EPP* ou outro formato!`;
  }

  // Caso 3: Faturamento entre 30 mil e 400 mil/mês (EPP)
  if (inference.monthlyAmount > 30000 && inference.monthlyAmount <= 400000) {
    return `📊 *Análise Educativa do seu Negócio:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seu negócio está em uma escala impressionante! Faturar cerca de *${monthlyFmt}/mês* (~*${annualFmt}/ano*) é sinal de grande expansão! 🚀

💡 *Toque preventivo do AnalisAí:*
Nessa faixa de faturamento, a categoria de **Empresa de Pequeno Porte (EPP — Simples Nacional)** ou **Lucro Presumido** oferece toda a flexibilidade que você precisa para crescer sem travas (teto até R$ 4,8 milhões/ano).

👉 *Podemos calibrar seu termômetro como Simples Nacional (EPP)?*
• Digite *1* ou *Sim* para confirmar como *EPP*.
• Digite *2* se seu faturamento oficial com notas ainda for de *Microempresa (ME)*.
• Ou me diga se for outro formato.`;
  }

  // Caso 4: Faturamento até R$ 6.750/mês (MEI)
  if (inference.monthlyAmount <= 6750) {
    return `📊 *Análise Educativa do seu Negócio:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Muito bom! Com uma média de *${monthlyFmt}/mês* (~*${annualFmt}/ano*), seu negócio se encaixa com total folga na faixa do **MEI (Microempreendedor Individual)**! 🚀

💡 *Dica amiga:* O MEI é super prático e tem teto de R$ 81 mil/ano. O AnalisAí vai te ajudar a manter as contas em dia e aproveitar essa tranquilidade.

👉 *Podemos confirmar seu enquadramento como MEI?*
• Responda *1* ou *Sim* para confirmar e ativar seu radar.
• Ou digite *2* se seu CNPJ já estiver estruturado como *Simples Nacional (ME)*.`;
  }

  // Caso 5: Acima de 400 mil/mês
  return `📊 *Análise Educativa do seu Negócio:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Espetacular! Faturamento de *${monthlyFmt}/mês* (~*${annualFmt}/ano*) reflete uma operação robusta e madura! 🚀

💡 *Dica do AnalisAí:*
Nesse patamar, o foco principal é fluxo de caixa refinado, conciliação e relatórios de DRE executivos.

👉 *Podemos confirmar seu perfil para Gestão Empresarial Completa?*
• Responda *1* ou *Sim* para confirmar.`;
}

/**
 * 1. Mensagem de Boas-Vindas + Pergunta Didática Inicial (PF, PJ ou Ambos)
 */
export function getWelcomeAndPfPjMessage(): string {
  return `👋 *Olá! Seja muito bem-vindo ao AnalisAí!*
Sou sua inteligência financeira no WhatsApp, pronta para desburocratizar sua rotina, organizar suas contas e fluxo de caixa em segundos.

Para que eu personalize seus alertas, categorias e relatórios desde o início, me conte:
*Como você pretende utilizar o AnalisAí hoje?*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *Escolha uma das opções abaixo:*

*1* ou *PJ* → *Pessoa Jurídica (Empresa / MEI)*
_(Para MEIs, prestadores de serviço e empresas. Foco no Livro Caixa, DRE contábil, notas e teto fiscal)._

*2* ou *PF* → *Pessoa Física (Pessoal / Autônomo)*
_(Para finanças pessoais, orçamento do lar ou profissional liberal sem CNPJ)._

*3* ou *Ambos* → *Ambos (Misturo contas pessoais e da empresa)*
_(Ideal para empresários e MEIs que ainda usam a mesma conta ou cartão para despesas pessoais e do negócio)._
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Basta responder com *1*, *2* ou *3* (ou digitar *PJ*, *PF* ou *Ambos*)._`;
}

/**
 * Mensagem didática para quem escolheu a Opção 3 (Ambos / Mistura contas)
 */
export function getMixedProfileWelcomeMessage(): string {
  return `⚠️ *Aviso Amigo de Gestão & Alerta de Confusão Patrimonial*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entendi perfeitamente! Mais de 70% dos empresários brasileiros começam misturando as contas do negócio com as contas de casa. Você não está sozinho!

💡 *Como o AnalisAí vai te proteger:*
1. Sua conta principal será configurada como **Pessoa Jurídica (PJ)** para proteger o teto fiscal do seu negócio e organizar seu Livro Caixa.
2. Contas de cunho pessoal que você enviar serão sinalizadas com a tag **[PF_PESSOAL]**, gerando alerta preventivo contra riscos de desconsideração da personalidade jurídica e glosas fiscais.
3. Seus relatórios gerenciais e DRE serão consolidados na empresa. Se no futuro você quiser relatórios 100% separados para a sua Pessoa Física, você poderá ativar um perfil adicional e migrar seu histórico em 1 clique!

Agora vamos calibrar o seu negócio:`;
}

/**
 * Mensagem de Marco Zero Flexível (Saldo Inicial)
 */
export function getInitialBalancePromptMessage(): string {
  return `💰 *Marco Zero: Saldo Inicial em Caixa*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para começarmos com o pé direito e projetarmos seu fluxo de caixa com precisão:

*Qual é o saldo aproximado somando suas contas correntes hoje?* (Ou envie uma foto/print/extrato bancário do seu banco).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Se preferir não informar agora, digite *[Pular]* ou *0* (você poderá calibrar quando quiser)._`;
}

/**
 * Mensagem de Conclusão e Convite do Primeiro Lançamento Guiado
 */
export function getFirstBillGuidedMessage(): string {
  return `🎉 *Tudo pronto! Seu AnalisAí está 100% configurado!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para testar na prática e ver a mágica acontecer:

📸 *Envie agora a foto, PDF, áudio ou documento do seu próximo boleto, nota a pagar ou valor que tem a receber.*

Em 2 segundos a IA lê todos os dados, agenda seus lembretes e organiza seu Livro Caixa! 🚀`;
}

/**
 * 2. Mensagem Didática e Acolhedora para PJ
 */
export function getPjTaxRegimeMessage(): string {
  return `Perfeito! 🏢 *Gestão Financeira para sua Empresa (PJ).*

O AnalisAí é o seu parceiro no WhatsApp: cuidamos de 100% das suas contas, despesas e entradas reais de dinheiro, para você focar no que faz melhor — vender e crescer!

Para calibrar seus relatórios e termômetro de forma educativa e personalizada:
*Como seu negócio está enquadrado hoje?*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *Escolha uma opção ou me conte sua média de faturamento:*

*1* → *MEI (Microempreendedor Individual)*
• Média de referência até *R$ 6.750/mês* (teto de R$ 81 mil/ano).
• _Ideal para quem está no começo ou vende direto para pessoas físicas. Eu cuido de todo o seu caixa real e te ajudo a crescer seguro._

*2* → *Simples Nacional (Microempresa — ME)*
• Faturamento de *R$ 6.750 a R$ 30 mil/mês* (até R$ 360 mil/ano).
• _Ideal para quem emite notas fiscais regularmente, tem equipe ou busca expandir._

*3* → *Simples Nacional (Empresa de Pequeno Porte — EPP)*
• Faturamento de *R$ 30 mil a R$ 400 mil/mês* (até R$ 4,8 milhões/ano).
• _Para empresas consolidadas e em forte aceleração._

*4* → *Lucro Presumido / Outro / Grande Porte*
• Faturamento acima de *R$ 400 mil/mês* (gestão executiva sem teto do Simples).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Dúvida no enquadramento?*
Basta me dizer quanto costuma entrar no seu caixa por mês (ex: *"minha média é 10 mil"* ou *"faturo 15 mil no caixa, mas sou MEI"*).
O AnalisAí sugere o melhor ajuste para você aprovar!`;
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
 * Atualização resiliente de trial_leads:
 * Atualiza campos existentes com segurança e isola colunas de migrations recentes em try/catch,
 * armazenando também no doc_data (JSONB) para garantir persistência sem quebras de schema.
 */
async function safeUpdateLead(
  supabase: any,
  leadId: string,
  coreUpdates: {
    onboarding_step?: OnboardingStep;
    profile_type?: ProfileType;
    tax_regime?: string;
    annual_revenue_baseline?: number | null;
    doc_data?: any;
    terms_accepted_at?: string;
  },
  optionalColumns?: {
    is_mixed_profile?: boolean;
    initial_balance?: number;
    last_balance_prompt_at?: string;
  }
) {
  // Mescla colunas opcionais dentro do doc_data como garantia definitiva de persistência
  const existingDocData = (coreUpdates.doc_data && typeof coreUpdates.doc_data === 'object') ? coreUpdates.doc_data : {};
  if (optionalColumns && Object.keys(optionalColumns).length > 0) {
    coreUpdates.doc_data = {
      ...existingDocData,
      ...optionalColumns,
    };
  }

  const res = await supabase
    .from('trial_leads')
    .update(coreUpdates)
    .eq('id', leadId);

  if (optionalColumns && Object.keys(optionalColumns).length > 0) {
    try {
      await supabase
        .from('trial_leads')
        .update(optionalColumns)
        .eq('id', leadId);
    } catch {
      // Colunas da migration 025 ainda não aplicadas; já persistidas no doc_data
    }
  }

  return res;
}

/**
 * Atualização resiliente de clients:
 * Atualiza campos cadastrais com segurança e isola colunas de migrations recentes em try/catch.
 */
async function safeUpdateClient(
  supabase: any,
  clientId: string,
  coreUpdates: {
    profile_type?: ProfileType;
    tax_type?: string;
    tax_regime?: string;
    annual_revenue_baseline?: number | null;
    terms_accepted_at?: string;
  },
  optionalColumns?: {
    is_mixed_profile?: boolean;
    initial_bank_balance?: number;
    last_balance_update_date?: string;
    last_balance_prompt_at?: string;
  }
) {
  const res = await supabase
    .from('clients')
    .update(coreUpdates)
    .eq('id', clientId);

  if (optionalColumns && Object.keys(optionalColumns).length > 0) {
    try {
      await supabase
        .from('clients')
        .update(optionalColumns)
        .eq('id', clientId);
    } catch {
      // Colunas da migration 025 ainda não aplicadas
    }
  }

  return res;
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
    .select('id, doc_data')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (existingLead) {
    await safeUpdateLead(supabase, existingLead.id, {
      onboarding_step: 'awaiting_pf_or_pj',
      terms_accepted_at: nowIso,
      doc_data: existingLead.doc_data,
    });
  } else {
    await supabase.from('trial_leads').insert({
      whatsapp_number: cleanPhone,
      onboarding_step: 'awaiting_pf_or_pj',
      terms_accepted_at: nowIso,
      first_interaction_at: nowIso,
      doc_data: {},
    });
  }

  if (client?.id) {
    await safeUpdateClient(supabase, client.id, { terms_accepted_at: nowIso });
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
  const nowIso = new Date().toISOString();

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  let { data: lead } = await supabase
    .from('trial_leads')
    .select('id, onboarding_step, profile_type, doc_data')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  // Se o lead ainda não existe na base (primeiro contato do novo número), cria imediatamente!
  if (!lead && !client?.id) {
    const { data: newLead } = await supabase
      .from('trial_leads')
      .insert({
        whatsapp_number: cleanPhone,
        onboarding_step: 'awaiting_pf_or_pj',
        terms_accepted_at: nowIso,
        first_interaction_at: nowIso,
        doc_data: {},
      })
      .select('id, onboarding_step, profile_type, doc_data')
      .maybeSingle();

    if (newLead) {
      lead = newLead;
    }
  }

  const currentStep: OnboardingStep = (lead?.onboarding_step as OnboardingStep) || 'awaiting_pf_or_pj';

  // Se já completou, não intercepta
  if (currentStep === 'completed') {
    return { handled: false, completed: true, profile: lead?.profile_type as ProfileType };
  }

  // ── RECONHECIMENTO DE SAUDAÇÃO INICIAL ──
  const isGreetingOnly =
    /^(oi\b|ol[aá]\b|bom dia\b|boa tarde\b|boa noite\b|ola\b|e a[ií]\b|menu\b|ajuda\b|come[çc]ar\b|start\b|ol[aá]!\b)/i.test(clean) &&
    clean.length <= 25;

  if (currentStep === 'awaiting_pf_or_pj' && isGreetingOnly) {
    if (lead?.id) {
      await safeUpdateLead(supabase, lead.id, {
        onboarding_step: 'awaiting_pf_or_pj',
        terms_accepted_at: nowIso,
        doc_data: lead.doc_data,
      });
    }
    await sendEvolutionText({
      phone,
      text: getWelcomeAndPfPjMessage(),
    });
    return { handled: true, completed: false };
  }

  // ── ETAPA 1: ESCOLHA ENTRE PF, PJ OU AMBOS ──
  if (currentStep === 'awaiting_pf_or_pj') {
    // Recuperação contextual rápida caso o usuário já responda um perfil específico ou regime
    const isLiberalDirect =
      /^(liberal\b|aut[oô]nomo\b|freelancer\b|m[eé]dico\b|advogado\b|dentista\b|arquiteto\b|corretor\b|consultor\b|psic[oó]logo\b|honor[aá]rios\b)/i.test(clean);

    const isFamilyDirect =
      /^(fam[ií]lia\b|casal\b|casa\b|dom[eé]stico\b|filhos\b|resid[eê]ncia\b|escola\b)/i.test(clean);

    const isIndividualDirect =
      /^([uú]nico\b|pessoal\b|individual\b|s[oó] meu\b|apenas eu\b|minhas contas\b)/i.test(clean);

    const isPjRegimeDirect =
      /^(mei\b|simples\b|microempresa\b|epp\b|lucro presumido\b)/i.test(clean);

    if (isLiberalDirect) {
      if (lead?.id) {
        await safeUpdateLead(supabase, lead.id, {
          profile_type: 'pf_liberal',
          tax_regime: 'pf',
          onboarding_step: 'awaiting_initial_balance',
          doc_data: lead.doc_data,
        });
      }
      if (client?.id) {
        await safeUpdateClient(supabase, client.id, { profile_type: 'pf_liberal', tax_type: 'CPF' });
      }
      await sendEvolutionText({
        phone,
        text: `${getOnboardingCompletionMessage('pf_liberal')}\n\n${getInitialBalancePromptMessage()}`,
      });
      return { handled: true, completed: false, profile: 'pf_liberal' };
    }

    if (isFamilyDirect) {
      if (lead?.id) {
        await safeUpdateLead(supabase, lead.id, {
          profile_type: 'pf_family',
          tax_regime: 'pf',
          onboarding_step: 'awaiting_initial_balance',
          doc_data: lead.doc_data,
        });
      }
      if (client?.id) {
        await safeUpdateClient(supabase, client.id, { profile_type: 'pf_family', tax_type: 'CPF' });
      }
      await sendEvolutionText({
        phone,
        text: `${getOnboardingCompletionMessage('pf_family')}\n\n${getInitialBalancePromptMessage()}`,
      });
      return { handled: true, completed: false, profile: 'pf_family' };
    }

    if (isIndividualDirect) {
      if (lead?.id) {
        await safeUpdateLead(supabase, lead.id, {
          profile_type: 'pf_individual',
          tax_regime: 'pf',
          onboarding_step: 'awaiting_initial_balance',
          doc_data: lead.doc_data,
        });
      }
      if (client?.id) {
        await safeUpdateClient(supabase, client.id, { profile_type: 'pf_individual', tax_type: 'CPF' });
      }
      await sendEvolutionText({
        phone,
        text: `${getOnboardingCompletionMessage('pf_individual')}\n\n${getInitialBalancePromptMessage()}`,
      });
      return { handled: true, completed: false, profile: 'pf_individual' };
    }

    if (isPjRegimeDirect) {
      const chosenRegime = clean.includes('mei') ? 'mei' : clean.includes('epp') ? 'simples_epp' : clean.includes('presumido') ? 'outro' : 'simples_me';
      if (lead?.id) {
        await safeUpdateLead(supabase, lead.id, {
          profile_type: 'pj',
          tax_regime: chosenRegime,
          onboarding_step: 'awaiting_initial_balance',
          doc_data: lead.doc_data,
        });
      }
      if (client?.id) {
        await safeUpdateClient(supabase, client.id, { profile_type: 'pj', tax_regime: chosenRegime, tax_type: 'CNPJ' });
      }
      await sendEvolutionText({
        phone,
        text: `${getPjOnboardingCompletionMessage(chosenRegime)}\n\n${getInitialBalancePromptMessage()}`,
      });
      return { handled: true, completed: false, profile: 'pj' };
    }

    const isAmbos =
      /^(3\b|3\.|ambos\b|ambas\b|misturo\b|misturado\b|os dois\b|as duas\b|pf e pj\b|pj e pf\b)/i.test(clean) ||
      clean === '3' || clean === 'ambos';

    const isPj =
      /^(1\b|1\.|pj\b|empresa\b|cnpj\b|jur[ií]dica\b|microempresa\b|comercial\b|neg[oó]cio\b)/i.test(clean) ||
      clean === '1' || clean === 'pj';

    const isPf =
      /^(2\b|2\.|pf\b|f[ií]sica\b|pessoa f[ií]sica\b|pessoal\b|casa\b|mim\b|minha\b|particular\b)/i.test(clean) ||
      clean === '2' || clean === 'pf';

    if (isAmbos) {
      if (lead?.id) {
        await safeUpdateLead(
          supabase,
          lead.id,
          {
            profile_type: 'pj',
            onboarding_step: 'awaiting_pj_regime',
            doc_data: lead.doc_data,
          },
          { is_mixed_profile: true }
        );
      }
      if (client?.id) {
        await safeUpdateClient(
          supabase,
          client.id,
          { profile_type: 'pj', tax_type: 'CNPJ' },
          { is_mixed_profile: true }
        );
      }

      await sendEvolutionText({
        phone,
        text: `${getMixedProfileWelcomeMessage()}\n\n${getPjTaxRegimeMessage()}`,
      });

      return { handled: true, completed: false };
    }

    if (isPj) {
      if (lead?.id) {
        await safeUpdateLead(
          supabase,
          lead.id,
          {
            profile_type: 'pj',
            onboarding_step: 'awaiting_pj_regime',
            doc_data: lead.doc_data,
          },
          { is_mixed_profile: false }
        );
      }
      if (client?.id) {
        await safeUpdateClient(
          supabase,
          client.id,
          { profile_type: 'pj', tax_type: 'CNPJ' },
          { is_mixed_profile: false }
        );
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
        await safeUpdateLead(
          supabase,
          lead.id,
          {
            onboarding_step: 'awaiting_pf_subtype',
            doc_data: lead.doc_data,
          },
          { is_mixed_profile: false }
        );
      }
      if (client?.id) {
        await safeUpdateClient(
          supabase,
          client.id,
          {},
          { is_mixed_profile: false }
        );
      }

      await sendEvolutionText({
        phone,
        text: getPfSubtypeMessage(),
      });

      return { handled: true, completed: false };
    }

    // Se o usuário digitou algo não reconhecido durante a pergunta PF x PJ
    import('@/lib/solo/friction-radar')
      .then((m) =>
        m.recordInsight({
          phone: cleanPhone,
          eventType: 'onboarding_hesitation',
          category: 'onboarding',
          rawMessage: rawText,
          detectedIntent: 'Hesitação na escolha inicial PF x PJ',
        })
      )
      .catch(() => {});

    await sendEvolutionText({
      phone,
      text: `Entendi! Para eu direcionar sua experiência corretamente:
*Como você pretende utilizar o AnalisAí hoje?*

• Digite *1* para *Pessoa Jurídica (PJ / MEI / Empresa)*
• Digite *2* para *Pessoa Física (PF / Contas Pessoais)*
• Digite *3* para *Ambos (Misturo contas pessoais e da empresa)*`,
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
        await safeUpdateLead(supabase, lead.id, {
          profile_type: chosenProfile,
          onboarding_step: 'awaiting_initial_balance',
          tax_regime: 'pf',
          doc_data: lead.doc_data,
        });
      }
      if (client?.id) {
        await safeUpdateClient(supabase, client.id, { profile_type: chosenProfile, tax_type: 'CPF' });
      }

      await sendEvolutionText({
        phone,
        text: `${getOnboardingCompletionMessage(chosenProfile)}\n\n${getInitialBalancePromptMessage()}`,
      });

      return { handled: true, completed: false, profile: chosenProfile };
    }

    // Se não compreendeu o subtipo
    import('@/lib/solo/friction-radar')
      .then((m) =>
        m.recordInsight({
          phone: cleanPhone,
          eventType: 'onboarding_hesitation',
          category: 'onboarding',
          rawMessage: rawText,
          detectedIntent: 'Hesitação na escolha de perfil PF',
        })
      )
      .catch(() => {});

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
        await safeUpdateLead(supabase, lead.id, {
          profile_type: 'pj',
          tax_regime: chosenRegime,
          onboarding_step: 'awaiting_initial_balance',
          doc_data: lead.doc_data,
        });
      }
      if (client?.id) {
        await safeUpdateClient(supabase, client.id, {
          profile_type: 'pj',
          tax_regime: chosenRegime,
          tax_type: 'CNPJ',
        });
      }

      await sendEvolutionText({
        phone,
        text: `${getPjOnboardingCompletionMessage(chosenRegime)}\n\n${getInitialBalancePromptMessage()}`,
      });

      return { handled: true, completed: false, profile: 'pj' };
    }

    // Se o usuário digitou uma média mensal ou faturamento em texto livre
    const inference = inferRevenueAndRegime(clean);
    if (inference) {
      const existingDocData = (lead?.doc_data && typeof lead.doc_data === 'object') ? lead.doc_data : {};
      if (lead?.id) {
        await safeUpdateLead(supabase, lead.id, {
          profile_type: 'pj',
          onboarding_step: 'awaiting_pj_regime_confirmation',
          doc_data: {
            ...existingDocData,
            suggested_regime: inference.suggestedRegime,
            estimated_monthly: inference.monthlyAmount,
            estimated_annual: inference.annualAmount,
          },
        });
      }

      await sendEvolutionText({
        phone,
        text: buildTaxRegimeProposalMessage(inference),
      });

      return { handled: true, completed: false };
    }

    // Se o usuário digitou algo não reconhecido durante a pergunta de regime PJ
    import('@/lib/solo/friction-radar')
      .then((m) =>
        m.recordInsight({
          phone: cleanPhone,
          eventType: 'onboarding_hesitation',
          category: 'tax',
          rawMessage: rawText,
          detectedIntent: 'Dúvida ou hesitação no regime tributário PJ',
        })
      )
      .catch(() => {});

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
      /^(sim\b|s\b|confirmo\b|confirmar\b|confirmado\b|pode ser\b|correto\b|isso\b|ok\b|beleza\b|perfeito\b|fechado\b|claro\b|positivo\b)/i.test(clean) ||
      clean === 'sim' || clean === 's';

    const isOption1 = clean === '1' || clean === '1.';
    const isOption2 = clean === '2' || clean === '2.';
    const isOption3 = clean === '3' || clean === '3.';

    const isMei = clean === 'mei' || clean.includes('sou mei') || clean.includes('cnpj é mei') || clean.includes('ainda é mei');
    const isSimples = clean === 'simples' || clean.includes('sou simples') || clean === 'me' || clean.includes('sou me');
    const isEpp = clean === 'epp' || clean.includes('sou epp');
    const isOutro = clean === 'outro' || clean === 'presumido';

    const docData: any = (lead?.doc_data && typeof lead.doc_data === 'object') ? lead.doc_data : {};
    let resolvedRegime: 'mei' | 'simples_me' | 'simples_epp' | 'outro' | null = null;

    if (isOption2 || isMei) {
      resolvedRegime = 'mei';
    } else if (isOption3 || isEpp) {
      resolvedRegime = 'simples_epp';
    } else if (isSimples) {
      resolvedRegime = 'simples_me';
    } else if (isOutro) {
      resolvedRegime = 'outro';
    } else if (isAffirmative || isOption1) {
      resolvedRegime = docData.suggested_regime || 'simples_me';
    }

    if (resolvedRegime) {
      if (lead?.id) {
        await safeUpdateLead(supabase, lead.id, {
          profile_type: 'pj',
          tax_regime: resolvedRegime,
          onboarding_step: 'awaiting_initial_balance',
          annual_revenue_baseline: docData.estimated_annual || null,
          doc_data: docData,
        });
      }
      if (client?.id) {
        await safeUpdateClient(supabase, client.id, {
          profile_type: 'pj',
          tax_regime: resolvedRegime,
          tax_type: 'CNPJ',
          annual_revenue_baseline: docData.estimated_annual || null,
        });
      }

      await sendEvolutionText({
        phone,
        text: `${getPjOnboardingCompletionMessage(resolvedRegime)}\n\n${getInitialBalancePromptMessage()}`,
      });

      return { handled: true, completed: false, profile: 'pj' };
    }

    const isNegative = /^(n[aã]o\b|n\b|errado\b|incorreto\b)/i.test(clean);
    if (isNegative) {
      if (lead?.id) {
        await safeUpdateLead(supabase, lead.id, {
          onboarding_step: 'awaiting_pj_regime',
          doc_data: docData,
        });
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
        await safeUpdateLead(supabase, lead.id, {
          doc_data: {
            ...docData,
            suggested_regime: newInference.suggestedRegime,
            estimated_monthly: newInference.monthlyAmount,
            estimated_annual: newInference.annualAmount,
          },
        });
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

  // ── ETAPA 5: MARCO ZERO FLEXÍVEL (SALDO INICIAL) ──
  if (currentStep === 'awaiting_initial_balance') {
    const isSkip =
      /^(pular|pulo|pule|skip|0|zero|depois|mais tarde|n[aã]o|nao|sem saldo|nenhum|ignorar)$/i.test(clean) ||
      clean === '0' || clean === 'pular';

    const brDateFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [d, m, y] = brDateFormatter.format(new Date()).split('/');
    const today = `${y}-${m}-${d}`;

    const existingDocData = (lead?.doc_data && typeof lead.doc_data === 'object') ? lead.doc_data : {};

    if (isSkip) {
      if (lead?.id) {
        await safeUpdateLead(supabase, lead.id, {
          onboarding_step: 'completed',
          doc_data: {
            ...existingDocData,
            initial_balance: 0,
            balance_calibrated: false,
          },
        });
      }
      await sendEvolutionText({
        phone,
        text: `Sem problemas! Deixamos seu saldo inicial como R$ 0,00 por enquanto.\n\n${getFirstBillGuidedMessage()}`,
      });
      return { handled: true, completed: true };
    }

    // Tenta extrair valor numérico de saldo
    let parsedVal: number | null = null;
    if (clean.includes('k') || clean.includes('mil')) {
      const kMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:mil\b|k\b)/i);
      if (kMatch) {
        parsedVal = parseFloat(kMatch[1].replace(',', '.')) * 1000;
      }
    }

    if (parsedVal === null) {
      const numMatch = clean.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:[.,]\d{2})?|\d+)/i);
      if (numMatch) {
        let numStr = numMatch[1];
        if (numStr.includes('.') && numStr.includes(',')) {
          numStr = numStr.replace(/\./g, '').replace(',', '.');
        } else if (numStr.includes('.')) {
          if (numStr.split('.')[1].length === 3) numStr = numStr.replace(/\./g, '');
        } else if (numStr.includes(',')) {
          numStr = numStr.replace(',', '.');
        }
        const n = parseFloat(numStr);
        if (!isNaN(n) && n >= 0) parsedVal = n;
      }
    }

    if (parsedVal !== null) {
      if (lead?.id) {
        await safeUpdateLead(
          supabase,
          lead.id,
          {
            onboarding_step: 'completed',
            doc_data: {
              ...existingDocData,
              initial_balance: parsedVal,
              balance_calibrated: true,
            },
          },
          { initial_balance: parsedVal }
        );
      }

      if (client?.id) {
        await safeUpdateClient(
          supabase,
          client.id,
          {},
          {
            initial_bank_balance: parsedVal,
            last_balance_update_date: today,
          }
        );

        try {
          await supabase.from('cash_ledger_entries').insert({
            client_id: client.id,
            entry_date: today,
            description: 'Saldo Inicial de Abertura (Marco Zero)',
            amount: parsedVal,
            entry_type: 'income',
            dre_group: 'outros',
            status: 'realizado',
            origin_profile: 'PJ',
            entry_nature: 'BALANCE_ADJUSTMENT',
          });
        } catch (ledgerErr) {
          console.warn('[Onboarding Initial Balance Entry Error]:', ledgerErr);
        }
      }

      const valFmt = parsedVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      await sendEvolutionText({
        phone,
        text: `💰 *Saldo inicial de ${valFmt} registrado com sucesso!*\n\n${getFirstBillGuidedMessage()}`,
      });

      return { handled: true, completed: true };
    }

    // Se não for nem skip nem número, orienta amigavelmente
    await sendEvolutionText({
      phone,
      text: `Por favor, informe apenas o valor aproximado do seu saldo em reais (ex: *"5.000"* ou *"1200"*).\n\n_Ou digite *[Pular]* para avançar sem saldo inicial._`,
    });
    return { handled: true, completed: false };
  }

  return { handled: false, completed: true };
}
