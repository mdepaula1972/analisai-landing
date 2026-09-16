/**
 * Consultor Pedagógico de Blindagem Patrimonial (Separação PJ x PF)
 * Detecta despesas pessoais e orienta o cliente com carinho e postura de consultor contábil
 * a transferir como pró-labore/lucro antes de pagar, evitando confusão patrimonial.
 */

export interface PatrimonialAdvice {
  isPersonalExpense: boolean;
  categoryDetected?: string;
  adviceMessage?: string;
}

const PERSONAL_EXPENSE_KEYWORDS = [
  'escola',
  'colegio',
  'faculdade',
  'creche',
  'condominio residencial',
  'pet shop',
  'veterinario',
  'petshop',
  'plano de saude individual',
  'plano familiar',
  'unimed pessoa fisica',
  'dentista',
  'academia',
  'smart fit',
  'fatura cartao pessoal',
  'vestuario',
  'supermercado',
  'farmacia',
  'drogasil',
  'droga raia',
];

/**
 * Analisa se uma despesa cadastrada possui indícios claros de ser de Pessoa Física (PF)
 */
export function analyzePatrimonialExpense(doc: {
  supplier_name?: string;
  counterparty_name?: string;
  category?: string;
  description?: string;
  amount?: number;
}): PatrimonialAdvice {
  const textToAnalyze = [
    doc.supplier_name,
    doc.counterparty_name,
    doc.category,
    doc.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const matched = PERSONAL_EXPENSE_KEYWORDS.find((kw) => {
    const normKw = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return textToAnalyze.includes(normKw);
  });

  if (!matched) {
    return { isPersonalExpense: false };
  }

  const supplier = doc.supplier_name || doc.counterparty_name || 'este lançamento';
  const valFormatted = doc.amount
    ? Number(doc.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '';

  const adviceMessage = `💡 *Orientação Consultiva AnalisAí (Blindagem Patrimonial)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que a conta de *${supplier}* ${valFormatted ? `(${valFormatted})` : ''} tem características de **despesa pessoal (PF)**.

🛡️ *Dica de Ouro para a Saúde da sua Empresa:*
Evite pagar contas particulares diretamente pela conta bancária da sua empresa (PJ). A "confusão patrimonial" distorce o lucro real do negócio e gera riscos desnecessários com a Receita Federal.

👉 *O caminho recomendado pelos nossos consultores:*
1️⃣ Transfira o valor exato da conta bancária da sua PJ para a sua conta pessoal (PF) como **Pró-Labore** ou **Distribuição de Lucros**;
2️⃣ Em seguida, realize o pagamento do boleto pelo app da sua conta de **Pessoa Física**!

_(Assim sua contabilidade fica 100% blindada e sua empresa protegida contra autuações fiscais!)_`;

  return {
    isPersonalExpense: true,
    categoryDetected: matched,
    adviceMessage,
  };
}
