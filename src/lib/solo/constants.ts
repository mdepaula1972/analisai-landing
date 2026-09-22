/**
 * Configuração Oficial de Checkout Asaas
 * Camada AnalisAí: Start, Solo e Solo Plus + Produtos Avulsos
 */

export const ASAAS_WEBHOOK_AUTH_TOKEN =
  process.env.ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_WEBHOOK_AUTH_TOKEN || '';

/** WhatsApp Oficial do Robô AnalisAí Solo: (13) 3150-0987 */
export const OFFICIAL_BOT_WHATSAPP = '551331500987';
export const OFFICIAL_BOT_PHONE_DISPLAY = '(13) 3150-0987';

export const ASAAS_PLANS = {
  monthly: {
    start: {
      code: 'start',
      name: 'AnalisAí Start (Mensal)',
      priceCents: 3990,
      priceFormatted: 'R$ 39,90/mês',
      slug: 'u6coqlztwsm1h4l8',
      checkoutUrl: 'https://www.asaas.com/c/u6coqlztwsm1h4l8',
      docLimit: 30,
      trialDocs: 1,
      cnpjsLimit: 1,
      bankAccountsLimit: 0,
    },
    solo: {
      code: 'solo',
      name: 'AnalisAí Solo (Mensal)',
      priceCents: 8799,
      priceFormatted: 'R$ 87,99/mês',
      slug: '5swlpaq9pb9gr6vj',
      checkoutUrl: 'https://www.asaas.com/c/5swlpaq9pb9gr6vj',
      docLimit: 80,
      trialDocs: 1,
      cnpjsLimit: 1,
      bankAccountsLimit: 1,
    },
    solo_plus: {
      code: 'solo_plus',
      name: 'AnalisAí Solo Plus (Mensal)',
      priceCents: 15799,
      priceFormatted: 'R$ 157,99/mês',
      slug: '4q4ibc9k87yl03l3',
      checkoutUrl: 'https://www.asaas.com/c/4q4ibc9k87yl03l3',
      docLimit: 200,
      trialDocs: 1,
      cnpjsLimit: 1,
      bankAccountsLimit: 1,
    },
    pro: {
      code: 'pro',
      name: 'AnalisAí Pro (Mensal)',
      priceCents: 29700,
      priceFormatted: 'R$ 297,00/mês',
      slug: 'q8m0k46rrqv4jzvv',
      checkoutUrl: 'https://www.asaas.com/c/q8m0k46rrqv4jzvv',
      docLimit: 500,
      trialDocs: 10,
      cnpjsLimit: 2,
      bankAccountsLimit: 2,
    },
    super: {
      code: 'super',
      name: 'AnalisAí Super (Mensal)',
      priceCents: 59700,
      priceFormatted: 'R$ 597,00/mês',
      slug: '6k5itkpa1wuqryo9',
      checkoutUrl: 'https://www.asaas.com/c/6k5itkpa1wuqryo9',
      docLimit: 1000,
      trialDocs: 50,
      cnpjsLimit: 4,
      bankAccountsLimit: 4,
    },
  },
  annual: {
    start: {
      code: 'start',
      name: 'AnalisAí Start (Anual com 20% OFF)',
      priceCents: 38304,
      priceFormatted: 'R$ 383,04/ano',
      slug: 'rx7u0rghulotvxqy',
      checkoutUrl: 'https://www.asaas.com/c/rx7u0rghulotvxqy',
      docLimit: 30,
      trialDocs: 1,
      cnpjsLimit: 1,
      bankAccountsLimit: 0,
    },
    solo: {
      code: 'solo',
      name: 'AnalisAí Solo (Anual com 20% OFF)',
      priceCents: 84470,
      priceFormatted: 'R$ 844,70/ano',
      slug: 'eng7q7ppj002flzb',
      checkoutUrl: 'https://www.asaas.com/c/eng7q7ppj002flzb',
      docLimit: 80,
      trialDocs: 1,
      cnpjsLimit: 1,
      bankAccountsLimit: 1,
    },
    solo_plus: {
      code: 'solo_plus',
      name: 'AnalisAí Solo Plus (Anual com 20% OFF)',
      priceCents: 151670,
      priceFormatted: 'R$ 1.516,70/ano',
      slug: 'hmm2qnvy6kur1v6l',
      checkoutUrl: 'https://www.asaas.com/c/hmm2qnvy6kur1v6l',
      docLimit: 200,
      trialDocs: 1,
      cnpjsLimit: 1,
      bankAccountsLimit: 1,
    },
    pro: {
      code: 'pro',
      name: 'AnalisAí Pro (Anual com 20% OFF)',
      priceCents: 285120,
      priceFormatted: 'R$ 2.851,20/ano',
      slug: '3e7dh971lzcj7zf3',
      checkoutUrl: 'https://www.asaas.com/c/3e7dh971lzcj7zf3',
      docLimit: 500,
      trialDocs: 10,
      cnpjsLimit: 2,
      bankAccountsLimit: 2,
    },
    super: {
      code: 'super',
      name: 'AnalisAí Super (Anual com 20% OFF)',
      priceCents: 573120,
      priceFormatted: 'R$ 5.731,20/ano',
      slug: '6svs4qiwqc1qdxm9',
      checkoutUrl: 'https://www.asaas.com/c/6svs4qiwqc1qdxm9',
      docLimit: 1000,
      trialDocs: 50,
      cnpjsLimit: 4,
      bankAccountsLimit: 4,
    },
  },
} as const;

export const ADMIN_PERSONAL_WHATSAPP = '5514930855878';

export const ASAAS_ONE_OFF = {
  extraUser: {
    code: 'extra_user_seat',
    name: 'Usuário Adicional (Operador)',
    priceCents: 2990,
    priceFormatted: 'R$ 29,90/mês',
    checkoutUrl: 'https://www.asaas.com/c/kurk0fge7wqim8lv',
    slug: 'kurk0fge7wqim8lv',
  },
  cashFlowAnalysis: {
    code: 'cash_flow_extra',
    name: 'Análise de Fluxo de Caixa (Avulsa)',
    priceCents: 4900,
    priceFormatted: 'R$ 49,00',
    checkoutUrl: 'https://www.asaas.com/c/icv2c1fiit1781q3',
    slug: 'icv2c1fiit1781q3',
  },
  supplierXray: {
    code: 'supplier_xray',
    name: 'Raio-X de Fornecedores',
    priceCents: 5990,
    priceFormatted: 'R$ 59,90',
    checkoutUrl: 'https://www.asaas.com/c/opzifr0h6d2pds70',
    slug: 'opzifr0h6d2pds70',
  },
  digitalCertificateA1: {
    code: 'certificado_digital_a1',
    name: 'Certificado Digital A1',
    priceCents: 17000,
    priceFormatted: 'R$ 170,00',
    checkoutUrl: 'https://www.asaas.com/c/mlxgbfsqmh4blf4j',
    slug: 'mlxgbfsqmh4blf4j',
  },
  extraDocsPackage: {
    code: 'extra_docs_package',
    name: 'Pacote Extra (+20 Lançamentos)',
    priceCents: 1490,
    priceFormatted: 'R$ 14,90',
    checkoutUrl: 'https://www.asaas.com/c/82tfkx0s9pu1vdd9',
    slug: '82tfkx0s9pu1vdd9',
    docsAmount: 20,
    validityDays: 60,
  },
  dreConsolidatedMultiCnpj: {
    code: 'dre_consolidated_multi_cnpj',
    name: 'DRE Agrupado Multi-CNPJ (por CNPJ adicional)',
    priceCents: 2799,
    priceFormatted: 'R$ 27,99/CNPJ',
    checkoutUrl: 'https://www.asaas.com/c/4u53a9gvju2j7lzl',
    slug: '4u53a9gvju2j7lzl',
  },
  bankReconciliationExtra: {
    code: 'bank_reconciliation_extra',
    name: 'Conciliação Bancária Extra (por conta/mês)',
    priceCents: 3700,
    priceFormatted: 'R$ 37,00/mês',
    checkoutUrl: 'https://www.asaas.com/c/378wvlvonyxfumme',
    slug: '378wvlvonyxfumme',
  },
} as const;

// Aliases para compatibilidade total com o código legado
export const INFINITE_PAY_PLANS = ASAAS_PLANS;
export const INFINITE_PAY_ONE_OFF = ASAAS_ONE_OFF;
