export interface DuplicateMatchResult {
  hasMatch: boolean;
  matchType: 'EXACT_DUPLICATE' | 'BOLETO_MATCHES_INVOICE_INSTALLMENT' | 'NONE';
  matchedAccount?: {
    id: string;
    description: string;
    amount: number;
    current_due_date: string;
    barcode_or_pix?: string;
    is_provision?: boolean;
    source?: 'payables_receivables' | 'trial_leads';
  };
}

const STOP_WORDS = new Set([
  'ltda',
  'sa',
  's/a',
  'me',
  'epp',
  'eireli',
  'ss',
  'cia',
  'comercio',
  'com',
  'industria',
  'ind',
  'servicos',
  'serv',
  'importacao',
  'importaca',
  'imp',
  'exportacao',
  'exportaca',
  'exp',
  'distribuidora',
  'pagamento',
  'despesa',
  'receita',
  'fornecedor',
  'cliente',
  'emitente',
  'cedente',
  'beneficiario',
  'sacador',
  'favorecido',
  'nfe',
  'nfse',
  'nf',
  'nota',
  'fiscal',
  'boleto',
  'parc',
  'parcela',
  'estimativa',
  'provisao',
  'de',
  'da',
  'do',
  'dos',
  'das',
  'e',
]);

const BANK_NAMES = new Set([
  'banrisul',
  'bradesco',
  'itau',
  'santander',
  'caixa',
  'sicoob',
  'sicredi',
  'inter',
  'nubank',
  'safra',
  'btg',
  'banco',
  'brasil',
]);

function normalizeCounterparty(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(parc\.?\s*\d+\/\d+\)/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token) && !/^\d+$/.test(token))
    .join(' ')
    .trim();
}

function isBankOnlyName(norm: string): boolean {
  if (!norm) return true;
  const tokens = norm.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => BANK_NAMES.has(t));
}

/**
 * Calcula similaridade semântica/léxica (0.0 a 1.0) entre dois nomes de favorecidos/fornecedores.
 * Considera equivalências de razão social/nome fantasia (ex: "Dufrio" vs "Refrigeração Dufrio")
 * e casos em que o boleto ou a NF traz o nome do banco emissor (ex: "Banrisul") ou placeholder ("Emitente").
 */
export function calculateCounterpartySimilarity(nameA?: string | null, nameB?: string | null): number {
  const normA = normalizeCounterparty(nameA);
  const normB = normalizeCounterparty(nameB);

  // Se um dos lados for genérico ("Emitente", "Fornecedor") ou nome de banco ("Banrisul", "Bradesco"),
  // retorna compatibilidade positiva (0.65) para permitir o cruzamento por valor idêntico + vencimento.
  if (!normA || !normB || isBankOnlyName(normA) || isBankOnlyName(normB)) {
    return 0.65;
  }
  if (normA === normB) return 1.0;
  if (normA.length >= 3 && normB.length >= 3 && (normA.includes(normB) || normB.includes(normA))) {
    return 0.95;
  }

  const tokensA = normA.split(' ').filter((t) => t.length >= 3 && !BANK_NAMES.has(t));
  const tokensB = normB.split(' ').filter((t) => t.length >= 3 && !BANK_NAMES.has(t));

  for (const tA of tokensA) {
    for (const tB of tokensB) {
      if (tA === tB || (tA.length >= 4 && tB.length >= 4 && (tA.includes(tB) || tB.includes(tA)))) {
        return 0.88;
      }
    }
  }

  // Coeficiente de Sørensen–Dice por bigramas
  if (normA.length < 2 || normB.length < 2) return 0;
  const bigramsA = new Map<string, number>();
  for (let i = 0; i < normA.length - 1; i++) {
    const bg = normA.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < normB.length - 1; i++) {
    const bg = normB.slice(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      bigramsA.set(bg, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (normA.length - 1 + (normB.length - 1));
}

function getCalendarDaysDifference(dateA?: string | null, dateB?: string | null): number | null {
  if (!dateA || !dateB) return null;
  const cleanA = String(dateA).slice(0, 10);
  const cleanB = String(dateB).slice(0, 10);
  const tA = Date.parse(`${cleanA}T12:00:00Z`);
  const tB = Date.parse(`${cleanB}T12:00:00Z`);
  if (isNaN(tA) || isNaN(tB)) return null;
  return Math.round(Math.abs(tA - tB) / (1000 * 60 * 60 * 24));
}

function getSameYearDaysDifference(dateA?: string | null, dateB?: string | null): number | null {
  if (!dateA || !dateB) return null;
  const cleanA = String(dateA).slice(0, 10);
  const cleanB = String(dateB).slice(0, 10);
  if (cleanA.length < 10 || cleanB.length < 10) return null;
  const mmDdA = cleanA.slice(5, 10);
  const mmDdB = cleanB.slice(5, 10);
  const tA = Date.parse(`2026-${mmDdA}T12:00:00Z`);
  const tB = Date.parse(`2026-${mmDdB}T12:00:00Z`);
  if (isNaN(tA) || isNaN(tB)) return null;
  return Math.round(Math.abs(tA - tB) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula a diferença em dias úteis (segunda a sexta) entre duas datas YYYY-MM-DD.
 */
export function getBusinessDaysDifference(dateA?: string | null, dateB?: string | null): number | null {
  if (!dateA || !dateB) return null;
  const cleanA = String(dateA || '').trim().slice(0, 10);
  const cleanB = String(dateB || '').trim().slice(0, 10);
  if (!cleanA || !cleanB || cleanA.length < 8 || cleanB.length < 8) return null;
  const tA = Date.parse(`${cleanA}T12:00:00Z`);
  const tB = Date.parse(`${cleanB}T12:00:00Z`);
  if (isNaN(tA) || isNaN(tB)) return null;
  if (tA === tB) return 0;

  const startMs = Math.min(tA, tB);
  const endMs = Math.max(tA, tB);
  const oneDayMs = 1000 * 60 * 60 * 24;

  // Limite de segurança para evitar loops longos se as datas estiverem distantes
  const maxDaysDiff = Math.round((endMs - startMs) / oneDayMs);
  if (maxDaysDiff > 365) return maxDaysDiff;

  let businessDays = 0;
  for (let cur = startMs + oneDayMs; cur <= endMs; cur += oneDayMs) {
    const dayOfWeek = new Date(cur).getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }
  return businessDays;
}

function isInvoiceOrProvisionAccount(acc: {
  description?: string | null;
  counterparty_name?: string | null;
  document_type?: string | null;
  is_provision?: boolean | null;
  barcode_or_pix?: string | null;
  status?: string | null;
}): boolean {
  if (!acc) return false;
  if (acc.is_provision) return true;
  if (acc.status === 'previsto' || acc.status === 'provisioned') return true;
  const combined = `${acc.description || ''} ${acc.counterparty_name || ''} ${acc.document_type || ''}`.toLowerCase();
  if (/\b(parc\.?|parcela|nfe|nf-e|nfse|nfs-e|danfe|nota\s*fiscal|estimativa|provis[aã]o|emitente)\b/i.test(combined)) {
    return true;
  }
  if (!acc.barcode_or_pix) return true;
  return false;
}

/**
 * Audita o documento extraído contra as contas e provisões/estimativas ativas do cliente
 * (payables_receivables + trial_leads.bills_list).
 */
export async function checkDocumentDuplication(
  supabase: any,
  clientId: string | null,
  extracted: {
    amount?: number;
    total_amount?: number;
    due_date?: string | null;
    counterparty?: string | null;
    counterparty_name?: string | null;
    doc_type?: string;
    barcode?: string | null;
    barcode_or_pix?: string | null;
    digitable_line?: string | null;
    invoice_number?: string | null;
    invoice_number_ref?: string | null;
  },
  cleanPhone?: string
): Promise<DuplicateMatchResult> {
  try {
    if (!extracted || !supabase) {
      return { hasMatch: false, matchType: 'NONE' };
    }

    const extractedAmount = Math.abs(Number(extracted.amount ?? extracted.total_amount ?? 0));
    if (!extractedAmount || isNaN(extractedAmount) || extractedAmount <= 0) {
      return { hasMatch: false, matchType: 'NONE' };
    }

    const extractedCounterparty = String(extracted.counterparty || extracted.counterparty_name || '');
    const cleanExtractedBarcode = String(
      extracted.barcode || extracted.barcode_or_pix || extracted.digitable_line || ''
    ).replace(/\D/g, '');
    const cleanInvoiceRef = String(extracted.invoice_number || extracted.invoice_number_ref || '')
      .replace(/^0+/, '')
      .trim();

    interface NormalizedCandidate {
      id: string;
      description: string;
      counterparty_name: string;
      amount: number;
      current_due_date: string;
      barcode_or_pix?: string;
      is_provision?: boolean;
      status?: string;
      document_type?: string;
      source: 'payables_receivables' | 'trial_leads';
    }

    const candidates: NormalizedCandidate[] = [];

    const rawDigits = cleanPhone ? String(cleanPhone).replace(/\D/g, '') : '';
    const altPhone =
      rawDigits.length === 13 && rawDigits.startsWith('55')
        ? rawDigits.slice(0, 4) + rawDigits.slice(5)
        : rawDigits.length === 12 && rawDigits.startsWith('55')
        ? rawDigits.slice(0, 4) + '9' + rawDigits.slice(4)
        : rawDigits;

    let resolvedClientId = clientId;
    if (!resolvedClientId && rawDigits) {
      const { data: foundClient } = await supabase
        .from('clients')
        .select('id')
        .or(`whatsapp_number.eq.${rawDigits},whatsapp_number.eq.${altPhone}`)
        .limit(1)
        .maybeSingle();
      if (foundClient?.id) {
        resolvedClientId = String(foundClient.id);
      }
    }

    // 1. Busca contas e provisões em payables_receivables
    if (resolvedClientId) {
      const { data: openBills } = await supabase
        .from('payables_receivables')
        .select('id, counterparty_name, amount, current_due_date, original_due_date, barcode_or_pix, is_provision, status')
        .eq('client_id', resolvedClientId)
        .in('status', ['pending', 'open', 'overdue', 'postponed', 'previsto', 'provisioned'])
        .order('current_due_date', { ascending: true });

      if (Array.isArray(openBills)) {
        for (const b of openBills) {
          if (!b) continue;
          candidates.push({
            id: String(b.id || ''),
            description: String(b.counterparty_name || 'Fornecedor'),
            counterparty_name: String(b.counterparty_name || 'Fornecedor'),
            amount: Math.abs(Number(b.amount || 0)),
            current_due_date: String(b.current_due_date || b.original_due_date || ''),
            barcode_or_pix: b.barcode_or_pix ? String(b.barcode_or_pix) : undefined,
            is_provision: Boolean(b.is_provision),
            status: String(b.status || 'open'),
            source: 'payables_receivables',
          });
        }
      }
    }

    // 1.1 Busca também em trial_leads.bills_list (incluindo provisões/estimativas is_provision = true)
    if (rawDigits) {
      const { data: lead } = await supabase
        .from('trial_leads')
        .select('bills_list')
        .or(`whatsapp_number.eq.${rawDigits},whatsapp_number.eq.${altPhone}`)
        .limit(1)
        .maybeSingle();

      if (lead && Array.isArray(lead.bills_list)) {
        for (const b of lead.bills_list) {
          if (!b || b.is_paid || b.status === 'paid') continue;
          const bAmount = Math.abs(Number(b.amount ?? b.total_amount ?? 0));
          candidates.push({
            id: String(b.id || b.supplier_name || 'trial_bill'),
            description: String(b.supplier_name || b.counterparty_name || 'Fornecedor'),
            counterparty_name: String(b.supplier_name || b.counterparty_name || 'Fornecedor'),
            amount: bAmount,
            current_due_date: String(b.due_date || b.current_due_date || ''),
            barcode_or_pix: b.barcode_or_pix ? String(b.barcode_or_pix) : undefined,
            is_provision: Boolean(b.is_provision),
            status: String(b.status || 'open'),
            document_type: b.document_type || b.doc_type ? String(b.document_type || b.doc_type) : undefined,
            source: 'trial_leads',
          });
        }
      }
    }

    if (candidates.length === 0) {
      return { hasMatch: false, matchType: 'NONE' };
    }

    // 2. Checagem prioritária por código de barras idêntico (>= 20 dígitos)
    if (cleanExtractedBarcode.length >= 20) {
      const sameBarcodeAcc = candidates.find((c) => {
        const cBarcode = String(c.barcode_or_pix || '').replace(/\D/g, '');
        return cBarcode.length >= 20 && cBarcode === cleanExtractedBarcode;
      });

      if (sameBarcodeAcc) {
        return {
          hasMatch: true,
          matchType: 'EXACT_DUPLICATE',
          matchedAccount: {
            id: sameBarcodeAcc.id,
            description: sameBarcodeAcc.description,
            amount: Number(sameBarcodeAcc.amount || 0),
            current_due_date: sameBarcodeAcc.current_due_date,
            barcode_or_pix: sameBarcodeAcc.barcode_or_pix,
            is_provision: sameBarcodeAcc.is_provision,
            source: sameBarcodeAcc.source,
          },
        };
      }
    }

    // 3. Filtra contas e provisões com valor idêntico ou aproximado (diferença <= R$ 0,10)
    const amountMatches = candidates.filter((item) => Math.abs(Number(item.amount || 0) - extractedAmount) <= 0.10);
    if (amountMatches.length === 0) {
      return { hasMatch: false, matchType: 'NONE' };
    }

    // Prioriza candidatos que são provisões/parcelas de NF sem código de barras e com vencimento mais próximo
    const sortedAmountMatches = [...amountMatches].sort((a, b) => {
      const aProv = isInvoiceOrProvisionAccount(a) && (!a.barcode_or_pix || a.is_provision) ? 0 : 1;
      const bProv = isInvoiceOrProvisionAccount(b) && (!b.barcode_or_pix || b.is_provision) ? 0 : 1;
      if (aProv !== bProv) return aProv - bProv;
      const diffA = Math.min(
        getCalendarDaysDifference(extracted.due_date, a.current_due_date) ?? 999,
        getSameYearDaysDifference(extracted.due_date, a.current_due_date) ?? 999
      );
      const diffB = Math.min(
        getCalendarDaysDifference(extracted.due_date, b.current_due_date) ?? 999,
        getSameYearDaysDifference(extracted.due_date, b.current_due_date) ?? 999
      );
      return diffA - diffB;
    });

    // 4. Avalia favorecido coincidente/similar e vencimento
    for (const acc of sortedAmountMatches) {
      const accDescLower = (acc.description || '').toLowerCase();
      const similarity = calculateCounterpartySimilarity(extractedCounterparty, acc.counterparty_name);
      const hasInvoiceRefMatch =
        cleanInvoiceRef.length >= 3 && accDescLower.replace(/\D/g, '').includes(cleanInvoiceRef);
      const isFromInvoiceOrProvision = isInvoiceOrProvisionAccount(acc);

      const isCounterpartyCompatible = similarity > 0.4 || hasInvoiceRefMatch;
      if (!isCounterpartyCompatible) continue;

      // Se a conta existente for uma provisão/estimativa ou parcela de NF sem código de barras
      // e tiver valor idêntico (<= R$ 0,10) + favorecido compatível, vincula à parcela!
      if (isFromInvoiceOrProvision && (!acc.barcode_or_pix || acc.is_provision)) {
        return {
          hasMatch: true,
          matchType: 'BOLETO_MATCHES_INVOICE_INSTALLMENT',
          matchedAccount: {
            id: acc.id,
            description: acc.description,
            amount: Number(acc.amount || 0),
            current_due_date: acc.current_due_date,
            barcode_or_pix: acc.barcode_or_pix,
            is_provision: acc.is_provision,
            source: acc.source,
          },
        };
      }

      const businessDaysDiff = getBusinessDaysDifference(extracted.due_date, acc.current_due_date);
      const calendarDaysDiff = getCalendarDaysDifference(extracted.due_date, acc.current_due_date);
      const sameYearDaysDiff = getSameYearDaysDifference(extracted.due_date, acc.current_due_date);

      // Tolerância para duplicidade exata de contas comuns: até 3 dias úteis (ou até 5 dias corridos)
      const isDateCompatible =
        businessDaysDiff !== null && calendarDaysDiff !== null
          ? businessDaysDiff <= 3 || calendarDaysDiff <= 5 || (sameYearDaysDiff !== null && sameYearDaysDiff <= 3)
          : similarity >= 0.6;

      if (!isDateCompatible) continue;

      return {
        hasMatch: true,
        matchType: 'EXACT_DUPLICATE',
        matchedAccount: {
          id: acc.id,
          description: acc.description,
          amount: Number(acc.amount || 0),
          current_due_date: acc.current_due_date,
          barcode_or_pix: acc.barcode_or_pix,
          is_provision: acc.is_provision,
          source: acc.source,
        },
      };
    }

    return { hasMatch: false, matchType: 'NONE' };
  } catch (err) {
    console.error('[checkDocumentDuplication] Erro capturado na verificação de duplicidade:', err);
    // Retornar fallback seguro para não travar o webhook
    return { hasMatch: false, matchType: 'NONE' };
  }
}
