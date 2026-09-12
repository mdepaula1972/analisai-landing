/**
 * Configuração Oficial de Checkout e Slugs da InfinitePay
 * Camada AnalisAí: Start, Solo e Solo Plus + Produtos Avulsos
 */

export const INFINITE_PAY_BASE_URL = 'https://link.infinitepay.io/solucione-0s1';

export const INFINITE_PAY_PLANS = {
  monthly: {
    start: {
      code: 'start',
      name: 'AnalisAí Start (Mensal)',
      priceCents: 3990,
      priceFormatted: 'R$ 39,90/mês',
      slug: 'rYcg3rNjdl',
      checkoutUrl: `${INFINITE_PAY_BASE_URL}/rYcg3rNjdl`,
    },
    solo: {
      code: 'solo',
      name: 'AnalisAí Solo (Mensal)',
      priceCents: 8799,
      priceFormatted: 'R$ 87,99/mês',
      slug: 'SUNank0LdB',
      checkoutUrl: `${INFINITE_PAY_BASE_URL}/SUNank0LdB`,
    },
    solo_plus: {
      code: 'solo_plus',
      name: 'AnalisAí Solo Plus (Mensal)',
      priceCents: 15799,
      priceFormatted: 'R$ 157,99/mês',
      slug: 'lIog4XV9jg',
      checkoutUrl: `${INFINITE_PAY_BASE_URL}/lIog4XV9jg`,
    },
  },
  annual: {
    start: {
      code: 'start',
      name: 'AnalisAí Start (Anual com 20% OFF)',
      priceCents: 38304,
      priceFormatted: 'R$ 383,04/ano',
      slug: '3wqiVTvm9F',
      checkoutUrl: `${INFINITE_PAY_BASE_URL}/3wqiVTvm9F`,
    },
    solo: {
      code: 'solo',
      name: 'AnalisAí Solo (Anual com 20% OFF)',
      priceCents: 84470,
      priceFormatted: 'R$ 844,70/ano',
      slug: 'cTMKe9qST6',
      checkoutUrl: `${INFINITE_PAY_BASE_URL}/cTMKe9qST6`,
    },
    solo_plus: {
      code: 'solo_plus',
      name: 'AnalisAí Solo Plus (Anual com 20% OFF)',
      priceCents: 151670,
      priceFormatted: 'R$ 1.516,70/ano',
      slug: 'lExOaiuxRJ',
      checkoutUrl: `${INFINITE_PAY_BASE_URL}/lExOaiuxRJ`,
    },
  },
} as const;

export const INFINITE_PAY_ONE_OFF = {
  cashFlowAnalysis: {
    code: 'cash_flow_extra',
    name: 'Análise de Fluxo de Caixa (Avulsa)',
    priceCents: 1490,
    priceFormatted: 'R$ 14,90',
    checkoutUrl: 'https://link.infinitepay.io/solucione-0s1/Ri0x-c0b5Jn2EZL-14,90',
  },
  supplierXray: {
    code: 'supplier_xray',
    name: 'Raio-X de Fornecedores',
    priceCents: 5990,
    priceFormatted: 'R$ 59,90',
    checkoutUrl: 'https://link.infinitepay.io/solucione-0s1/Ri0x-FtwzjwK2YW-59,90',
  },
  digitalCertificateA1: {
    code: 'certificado_digital_a1',
    name: 'Certificado Digital A1',
    priceCents: 17000,
    priceFormatted: 'R$ 170,00',
    checkoutUrl: 'https://link.infinitepay.io/solucione-0s1/Ri0x-qV8KaaMU9p-117,99',
  },
} as const;
