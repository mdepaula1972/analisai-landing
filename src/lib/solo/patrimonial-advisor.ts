import { createServiceRoleClient } from '@/lib/supabase-server';

/**
 * Consultor Pedagógico de Blindagem Patrimonial (Separação PJ x PF)
 * 1. Detecta despesas de sócios e orienta pró-labore antes de pagar
 * 2. Detecta pagamentos a terceiros sem vínculo societário e alerta contra risco de 35% IRRF (pagamento sem causa)
 */

export interface PatrimonialAdvice {
  isPersonalExpense: boolean;
  categoryDetected?: string;
  isPartnerExpense?: boolean;
  isThirdPartyExpense?: boolean;
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
 * Sincroniza gratuitamente o Quadro de Sócios (QSA) via BrasilAPI e armazena no DB
 */
export async function syncPartnersFromQsa(clientId: string, cnpj: string): Promise<any[]> {
  const supabase = createServiceRoleClient();
  const cleanCnpj = cnpj.replace(/\D/g, '');

  if (cleanCnpj.length !== 14) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AnalisAI-TaxEngine/2.4' },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();
    const qsa = Array.isArray(data.qsa) ? data.qsa : [];

    const partnersToSave = [];
    for (const socio of qsa) {
      const name = socio.nome_socio || socio.nome;
      const cpfCnpj = (socio.cnpj_cpf_do_socio || socio.cpf_cnpj_socio || '').replace(/\D/g, '');
      const qual = socio.qualificacao_socio || 'Sócio';

      if (name) {
        partnersToSave.push({
          client_id: clientId,
          partner_name: name,
          partner_cpf: cpfCnpj || '00000000000',
          qualification: qual,
          is_managing_partner: qual.toLowerCase().includes('administrador') || qual.toLowerCase().includes('diretor'),
        });
      }
    }

    if (partnersToSave.length > 0) {
      await supabase.from('client_partners').upsert(partnersToSave, {
        onConflict: 'client_id,partner_cpf',
      });
    }

    return partnersToSave;
  } catch (err) {
    console.warn('[Patrimonial Advisor] Erro ao sincronizar QSA da BrasilAPI:', err);
    return [];
  }
}

/**
 * Analisa despesa e diferencia se o favorecido/pagador é:
 * - A própria PJ (Normal)
 * - Sócio da Empresa (Confusão patrimonial -> Pró-labore)
 * - Terceiro Externo Desconhecido (Grave -> Pagamento sem causa / 35% IRRF)
 */
export async function analyzeBeneficiaryAndExpense(
  clientId: string | null,
  doc: {
    supplier_name?: string;
    counterparty_name?: string;
    payer_name?: string;
    payer_tax_id?: string;
    category?: string;
    description?: string;
    amount?: number;
  }
): Promise<PatrimonialAdvice> {
  const supabase = createServiceRoleClient();
  const valFormatted = doc.amount
    ? Number(doc.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '';

  const cleanPayerTaxId = (doc.payer_tax_id || '').replace(/\D/g, '');
  const payerName = (doc.payer_name || '').trim();
  const supplier = doc.supplier_name || doc.counterparty_name || 'este lançamento';

  // 1. Verifica se temos sócios cadastrados para este cliente no DB
  let partners: any[] = [];
  if (clientId) {
    const { data } = await supabase
      .from('client_partners')
      .select('partner_name, partner_cpf')
      .eq('client_id', clientId);
    partners = data || [];
  }

  // 2. Se o documento contiver dados de Pessoa Física como pagador/favorecido
  const isCpf = cleanPayerTaxId.length === 11;
  if (isCpf || (payerName && !payerName.toLowerCase().includes('ltda') && !payerName.toLowerCase().includes('me') && !payerName.toLowerCase().includes('s/a'))) {
    // Verifica se bate com algum sócio cadastrado
    const isPartner = partners.some((p) => {
      if (cleanPayerTaxId && p.partner_cpf && cleanPayerTaxId === p.partner_cpf.replace(/\D/g, '')) return true;
      if (payerName && p.partner_name && p.partner_name.toLowerCase().includes(payerName.toLowerCase())) return true;
      return false;
    });

    if (isPartner) {
      // É despesa do SÓCIO
      return {
        isPersonalExpense: true,
        isPartnerExpense: true,
        adviceMessage: `💡 *Orientação de Blindagem Patrimonial (Conta do Sócio)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que a conta de *${supplier}* ${valFormatted ? `(${valFormatted})` : ''} está vinculada ao titular/sócio *${payerName || 'da empresa'}*.

🛡️ *Dica Consultiva AnalisAí:*
Evite pagar contas particulares diretamente pela conta bancária da sua PJ. Isso distorce o lucro real do negócio e gera risco de confusão patrimonial perante a Receita Federal.

👉 *Procedimento Seguro e Recomendado:*
1️⃣ Transfira o valor exato da conta bancária PJ para sua conta pessoal (PF) como **Pró-Labore** ou **Distribuição de Lucros**;
2️⃣ Em seguida, efetue o pagamento pelo app da sua conta de **Pessoa Física**!`,
      };
    } else if (partners.length > 0 && cleanPayerTaxId) {
      // É despesa de TERCEIRO EXTERNO (Pior ainda!)
      return {
        isPersonalExpense: true,
        isThirdPartyExpense: true,
        adviceMessage: `⚠️ *Alerta Contábil Crítico — Pagamento a Terceiro Sem Causa!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que este boleto de *${supplier}* ${valFormatted ? `(${valFormatted})` : ''} está emitido para *${payerName || 'Pessoa Física Externa'}* (CPF: ${cleanPayerTaxId}), que **NÃO consta no quadro de sócios** da sua empresa.

⚖️ *Risco Fiscal Grave (Receita Federal):*
Pagar despesas de terceiros diretamente pela conta bancária da sua PJ é caracterizado como "Pagamento sem Causa ou a Beneficiário Indireto" (Art. 61 da Lei nº 8.981/95).
Essa prática pode sofrer **tributação punitiva de até 35% de IRRF na fonte** e quebra da blindagem da personalidade jurídica no Código Civil!

👉 *Recomendação dos nossos Consultores:*
1. Se for prestador de serviço/colaborador, exija Nota Fiscal ou formalize via RPA com retenção legal.
2. Se for ajuda a parentes/amigos, faça o acerto diretamente pela sua conta bancária **Pessoa Física (CPF)** após receber seu pró-labore!`,
      };
    }
  }

  // 3. Fallback de palavras-chave de despesas pessoais cotidianas
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

  if (matched) {
    return {
      isPersonalExpense: true,
      categoryDetected: matched,
      adviceMessage: `💡 *Orientação Consultiva AnalisAí (Blindagem Patrimonial)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que a conta de *${supplier}* ${valFormatted ? `(${valFormatted})` : ''} tem características de **despesa pessoal (PF)**.

🛡️ *Dica de Ouro para a Saúde da sua Empresa:*
Evite pagar contas particulares diretamente pela conta bancária da sua PJ. A "confusão patrimonial" distorce o lucro real do negócio e gera riscos fiscais desnecessários.

👉 *O caminho recomendado pelos nossos consultores:*
1️⃣ Transfira o valor exato da conta da sua PJ para a sua conta pessoal (PF) como **Pró-Labore** ou **Distribuição de Lucros**;
2️⃣ Em seguida, realize o pagamento pelo app da sua conta de **Pessoa Física**!`,
    };
  }

  return { isPersonalExpense: false };
}

// Mantém retrocompatibilidade síncrona simples
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

  return {
    isPersonalExpense: true,
    categoryDetected: matched,
    adviceMessage: `💡 *Orientação Consultiva AnalisAí (Blindagem Patrimonial)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que a conta de *${supplier}* ${valFormatted ? `(${valFormatted})` : ''} tem características de **despesa pessoal (PF)**.

🛡️ *Dica de Ouro para a Saúde da sua Empresa:*
Evite pagar contas particulares diretamente pela conta bancária da sua empresa (PJ). A "confusão patrimonial" distorce o lucro real do negócio e gera riscos desnecessários com a Receita Federal.

👉 *O caminho recomendado pelos nossos consultores:*
1️⃣ Transfira o valor exato da conta bancária da sua PJ para a sua conta pessoal (PF) como **Pró-Labore** ou **Distribuição de Lucros**;
2️⃣ Em seguida, realize o pagamento do boleto pelo app da sua conta de **Pessoa Física**!

_(Assim sua contabilidade fica 100% blindada e sua empresa protegida contra autuações fiscais!)_`,
  };
}
