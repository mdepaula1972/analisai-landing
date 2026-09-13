/**
 * Configuração Oficial de Checkout Asaas
 * Camada AnalisAí: Start, Solo e Solo Plus + Produtos Avulsos
 */

export const ASAAS_WEBHOOK_AUTH_TOKEN =
  process.env.ASAAS_WEBHOOK_TOKEN || 'whsec_A6nET6eQeKLt21yUqmOqK0qyqGtclj-vNPGxl3BaR7g';

export const ASAAS_PLANS = {
  monthly: {
    start: {
      code: 'start',
      name: 'AnalisAí Start (Mensal)',
      priceCents: 3990,
      priceFormatted: 'R$ 39,90/mês',
      slug: 'u6coqlztwsm1h4l8',
      checkoutUrl: 'https://www.asaas.com/c/u6coqlztwsm1h4l8',
    },
    solo: {
      code: 'solo',
      name: 'AnalisAí Solo (Mensal)',
      priceCents: 8799,
      priceFormatted: 'R$ 87,99/mês',
      slug: '5swlpaq9pb9gr6vj',
      checkoutUrl: 'https://www.asaas.com/c/5swlpaq9pb9gr6vj',
    },
    solo_plus: {
      code: 'solo_plus',
      name: 'AnalisAí Solo Plus (Mensal)',
      priceCents: 15799,
      priceFormatted: 'R$ 157,99/mês',
      slug: '4q4ibc9k87yl03l3',
      checkoutUrl: 'https://www.asaas.com/c/4q4ibc9k87yl03l3',
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
    },
    solo: {
      code: 'solo',
      name: 'AnalisAí Solo (Anual com 20% OFF)',
      priceCents: 84470,
      priceFormatted: 'R$ 844,70/ano',
      slug: 'eng7q7ppj002flzb',
      checkoutUrl: 'https://www.asaas.com/c/eng7q7ppj002flzb',
    },
    solo_plus: {
      code: 'solo_plus',
      name: 'AnalisAí Solo Plus (Anual com 20% OFF)',
      priceCents: 151670,
      priceFormatted: 'R$ 1.516,70/ano',
      slug: 'hmm2qnvy6kur1v6l',
      checkoutUrl: 'https://www.asaas.com/c/hmm2qnvy6kur1v6l',
    },
  },
} as const;

export const ASAAS_ONE_OFF = {
  cashFlowAnalysis: {
    code: 'cash_flow_extra',
    name: 'Análise de Fluxo de Caixa (Avulsa)',
    priceCents: 1490,
    priceFormatted: 'R$ 14,90',
    checkoutUrl: 'https://www.asaas.com/c/85t737y1uom4k2b5',
  },
  supplierXray: {
    code: 'supplier_xray',
    name: 'Raio-X de Fornecedores',
    priceCents: 5990,
    priceFormatted: 'R$ 59,90',
    checkoutUrl: 'https://www.asaas.com/c/opzifr0h6d2pds70',
  },
  digitalCertificateA1: {
    code: 'certificado_digital_a1',
    name: 'Certificado Digital A1',
    priceCents: 17000,
    priceFormatted: 'R$ 170,00',
    checkoutUrl: 'https://www.asaas.com/c/mlxgbfsqmh4blf4j',
  },
  extraDocsPackage: {
    code: 'extra_docs_package',
    name: 'Pacote Extra (+20 Documentos)',
    priceCents: 1490,
    priceFormatted: 'R$ 14,90',
    checkoutUrl: 'https://www.asaas.com/c/82tfkx0s9pu1vdd9',
    slug: '82tfkx0s9pu1vdd9',
    docsAmount: 20,
    validityDays: 60,
  },
} as const;

// Aliases para compatibilidade total com o código legado
export const INFINITE_PAY_PLANS = ASAAS_PLANS;
export const INFINITE_PAY_ONE_OFF = ASAAS_ONE_OFF;
