
import { ASAAS_PLANS, ASAAS_ONE_OFF, OFFICIAL_BOT_WHATSAPP, OFFICIAL_BOT_PHONE_DISPLAY } from '@/lib/solo/constants';

/**
 * Retorna o link de convite oficial para o parceiro indicar contatos
 * Aponta diretamente para o robô oficial do AnalisAí: (13) 92009-9874
 */
export function getPioneerShareLink(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  const text = encodeURIComponent(`Olá! Vim por indicação do Analisador ${clean} para testar o AnalisAí.`);
  return `https://wa.me/${OFFICIAL_BOT_WHATSAPP}?text=${text}`;
}

export function getPioneerShareMessage(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  const link = getPioneerShareLink(phone);
  return `⚡ *Painel do Analisador • AnalisAí* ⚡
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Transforme suas conexões em renda mensal no Pix e use o AnalisAí de graça!

🎯 *Seu Selo:* *Analisador em Ação*
🎁 *Meta para Selo Oficial:* Traga 3 parceiros pagantes e conquiste o **Selo Analisador Oficial** com a **assinatura Solo 100% GRATUITA todo mês**!

💰 *Comissões Recorrentes por Plano (~20%/mês no Pix):*
• *Plano Start (R$ 39,90):* +R$ 8,00 / mês
• *Plano Solo (R$ 87,99):* +R$ 18,00 / mês
• *Plano Solo Plus (R$ 157,99):* +R$ 32,00 / mês
• *Plano Pro (R$ 297,00):* +R$ 60,00 / mês
• *Plano Super (R$ 597,00):* +R$ 120,00 / mês
_(A comissão cai na sua conta todo mês enquanto seu indicado mantiver o plano ativo!)_

🔗 *Seu Link Exclusivo de Analisador:*
${link}

📲 *Mensagem para copiar e enviar:*
_"Opa! Estou usando o AnalisAí para organizar minhas contas e pagar tudo sem estresse direto pelo WhatsApp. Você pode testar de graça agora enviando uma foto de conta ou boleto para o robô oficial: ${link}"_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Cadastre sua chave Pix enviando: *!pix sua_chave*`;
}
export const MAX_BETA_VIP_USERS = 5000;
export const BETA_VIP_DOCS_LIMIT = 100;
export const BETA_VIP_DAYS = 30;

import { createServiceRoleClient } from '@/lib/supabase-server';
import { formatDueDateDetails } from '@/lib/solo/date-utils';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { classifyTaxId, TaxClassification } from '@/lib/solo/tax-classifier';
import { addDays, format } from 'date-fns';

export interface TrialStatus {
  hasUsedTrial: boolean;
  docsCount: number;
  docsLimit: number;
  remainingDocs: number;
  docData?: any;
  taxType?: 'cpf' | 'mei' | 'simples' | 'empresa';
  interestedPlan?: string;
}

/**
 * Consulta se este número de WhatsApp já esgotou a sua cota de degustação gratuita
 */
export async function checkTrialStatus(phone: string): Promise<TrialStatus> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // 0. Verifica se o número ou documento está na Whitelist de QA (acesso livre sem limites)
  const { isQaWhitelisted } = await import('@/lib/solo/qa-whitelist');
  const isQa = (await isQaWhitelisted(cleanPhone)) || (await isQaWhitelisted(altPhone));

  const { data } = await supabase
    .from('trial_leads')
    .select('doc_processed, doc_data, trial_docs_count, trial_docs_limit, interested_plan, created_at, first_interaction_at')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (isQa) {
    const realCount = data ? (Number(data.trial_docs_count) || (data.doc_processed ? 1 : 0)) : 0;
    return {
      hasUsedTrial: false,
      docsCount: realCount,
      docsLimit: 99999,
      remainingDocs: 99999,
      docData: data?.doc_data,
      interestedPlan: data?.interested_plan,
    };
  }

  if (!data) {
    // Degustação Completa de 30 Dias: cota de segurança de até 100 documentos
    const initialLimit = BETA_VIP_DOCS_LIMIT; // 100 documentos

    return {
      hasUsedTrial: false,
      docsCount: 0,
      docsLimit: initialLimit,
      remainingDocs: initialLimit,
    };
  }

  // Cota de segurança oculta de até 100 documentos durante os 30 dias corridos
  const docsLimit = Math.max(Number(data.trial_docs_limit) || BETA_VIP_DOCS_LIMIT, BETA_VIP_DOCS_LIMIT);
  const docsCount = Number(data.trial_docs_count) || (data.doc_processed ? 1 : 0);
  const remainingDocs = Math.max(0, docsLimit - docsCount);

  // Expiração após ciclo dos 30 Dias VIP
  const createdAt = data.first_interaction_at || data.created_at;
  let isExpiredByDays = false;
  if (createdAt) {
    const daysSinceCreated = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated > BETA_VIP_DAYS) {
      isExpiredByDays = true;
    }
  }

  const hasUsedTrial = remainingDocs <= 0 || isExpiredByDays;

  return {
    hasUsedTrial,
    docsCount,
    docsLimit,
    remainingDocs,
    docData: data.doc_data,
    interestedPlan: data.interested_plan,
  };
}

/**
 * Registra o uso da degustação gratuita para este número, incrementando a contagem de lançamentos
 * e detectando automaticamente o perfil tributário (CPF = 1, MEI = 3, Simples/Empresa = até 10)
 */
export async function recordTrialUsage(
  phone: string,
  docData: any,
  grantedLimit?: number
): Promise<{ isDuplicate: boolean; existingBill?: any }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');

  // Consulta estado atual
  const current = await checkTrialStatus(cleanPhone);
  const newCount = current.docsCount + 1;

  // 1. Identificação inteligente do perfil tributário do lead
  let detectedLimit = current.docsLimit;
  let taxType: 'cpf' | 'mei' | 'simples' | 'empresa' = 'cpf';
  let suggestedPlan = current.interestedPlan || null;

  // Se o lead ainda tem o limite padrão inicial (<= 5) e nenhum limite manual forçado:
  if (!grantedLimit && current.docsLimit <= 5) {
    if (docData.tax_profile === 'mei') {
      detectedLimit = 5;
      taxType = 'mei';
      suggestedPlan = 'solo';
    } else if (docData.tax_profile === 'simples' || docData.tax_profile === 'empresa') {
      detectedLimit = 10;
      taxType = docData.tax_profile;
      suggestedPlan = 'pro';
    } else {
      const rawTaxId = docData.cnpj || docData.tax_id || docData.payer_tax_id || docData.counterparty_tax_id || null;
      const companyHint = docData.supplier_name || docData.counterparty_name || docData.payer_name || '';

      try {
        const classification = await classifyTaxId(rawTaxId, companyHint);
        detectedLimit = Math.max(current.docsLimit, classification.trialLimit, 5);
        taxType = classification.type;

        if (classification.type === 'simples' || classification.type === 'empresa') {
          suggestedPlan = 'pro';
        } else if (classification.type === 'mei') {
          suggestedPlan = 'solo';
        } else {
          suggestedPlan = 'start';
        }
      } catch (classifyErr) {
        console.warn('[Trial Classification Warning]:', classifyErr);
      }
    }
  }

  const newLimit = grantedLimit || Math.max(detectedLimit, BETA_VIP_DOCS_LIMIT);

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // Recupera lista de contas já cadastradas para não perder histórico de múltiplos boletos
  const { data: leadRecord } = await supabase
    .from('trial_leads')
    .select('id, bills_list, trial_docs_count, whatsapp_number')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  const targetPhone = leadRecord?.whatsapp_number || cleanPhone;
  const billsList: any[] = Array.isArray(leadRecord?.bills_list) ? leadRecord.bills_list : [];
  const supplierCandidate = (docData.supplier_name || docData.counterparty_name || 'Fornecedor').trim();
  const isProvision = Boolean(docData.is_provision);
  const rawAmount = docData.amount !== undefined && docData.amount !== null ? docData.amount : docData.total_amount;
  const numAmount = rawAmount !== undefined && rawAmount !== null && !isNaN(Number(rawAmount)) && Number(rawAmount) > 0 ? Number(rawAmount) : null;
  const categoryCandidate = docData.category || docData.category_suggestion || null;
  const barcodeOrPixCandidate = docData.barcode_or_pix || null;

  // ── DETECÇÃO ANTI-DUPLICIDADE EM CONTAS REAIS DA DEGUSTAÇÃO ────────────
  // Se o usuário enviar o mesmo boleto ou uma conta com mesmo fornecedor + valor + vencimento
  if (!isProvision && numAmount && numAmount > 0) {
    const duplicateIndex = billsList.findIndex((b: any) => {
      if (b.is_provision) return false;

      // 1. Mesmo código de barras / linha digitável
      if (barcodeOrPixCandidate && b.barcode_or_pix) {
        const cleanB = String(b.barcode_or_pix).replace(/\D/g, '');
        const cleanCand = String(barcodeOrPixCandidate).replace(/\D/g, '');
        if (cleanB.length >= 20 && cleanB === cleanCand) return true;
      }

      // 2. Mesmo fornecedor + mesma data de vencimento + mesmo valor (tolerância R$ 0,05)
      const bName = (b.supplier_name || b.counterparty_name || '').toLowerCase().trim();
      const candName = supplierCandidate.toLowerCase().trim();
      const sameSupplier = bName.length >= 3 && candName.length >= 3 && (bName.includes(candName) || candName.includes(bName));
      const sameDate = Boolean(b.due_date && docData.due_date && b.due_date === docData.due_date);
      const sameAmount = Boolean(b.amount && Math.abs(Number(b.amount) - numAmount) < 0.05);

      return sameSupplier && sameDate && sameAmount;
    });

    if (duplicateIndex >= 0) {
      const existing = billsList[duplicateIndex];
      // Se a conta cadastrada não tinha código de barras e o novo envio tem, anexa sem duplicar!
      if (barcodeOrPixCandidate && !existing.barcode_or_pix) {
        existing.barcode_or_pix = barcodeOrPixCandidate;
        await supabase
          .from('trial_leads')
          .update({ bills_list: billsList })
          .eq('whatsapp_number', targetPhone);
      }
      return { isDuplicate: true, existingBill: existing };
    }
  }

  // Se for uma conta definitiva com valor real e existir uma provisão prévia para o mesmo fornecedor ou serviço, concilia!
  // REGRA CRÍTICA: NUNCA reconcilia se a conta existente for uma conta real (duas contas reais são despesas distintas!)
  let reconciled = false;
  if (!isProvision && numAmount && numAmount > 0) {
    const existingIndex = billsList.findIndex((b: any) => {
      if (!b.is_provision) return false;

      const bName = (b.supplier_name || b.counterparty_name || '').toLowerCase().trim();
      const candName = supplierCandidate.toLowerCase().trim();
      const bCat = (b.category || '').toLowerCase().trim();
      const candCat = (categoryCandidate || '').toLowerCase().trim();

      const nameMatch = bName.length >= 3 && candName.length >= 3 && (bName.includes(candName) || candName.includes(bName));
      const categoryMatch = (bCat && candCat && (bCat.includes(candCat) || candCat.includes(bCat))) ||
        (candCat.includes('agua') && (bName.includes('água') || bName.includes('agua') || bName.includes('sabesp'))) ||
        (candCat.includes('energia') && (bName.includes('energia') || bName.includes('luz') || bName.includes('cpfl') || bName.includes('enel'))) ||
        (candCat.includes('telecom') && (bName.includes('internet') || bName.includes('vivo') || bName.includes('claro') || bName.includes('tim')));

      return nameMatch || categoryMatch;
    });

    if (existingIndex >= 0) {
      const old = billsList[existingIndex];
      billsList[existingIndex] = {
        ...old,
        supplier_name: supplierCandidate,
        amount: numAmount,
        due_date: docData.due_date || old.due_date,
        barcode_or_pix: barcodeOrPixCandidate || old.barcode_or_pix,
        category: categoryCandidate || old.category,
        payer_name: docData.payer_name || old.payer_name || null,
        payer_tax_id: docData.payer_tax_id || old.payer_tax_id || null,
        is_provision: false,
        reconciled_at: new Date().toISOString(),
      };
      reconciled = true;
    }
  }

  let effectiveDueDate = docData.due_date || null;
  let effectiveAmount = numAmount;

  if (!reconciled) {
    if (docData.installments && Array.isArray(docData.installments) && docData.installments.length > 1) {
      const todayStr = new Date().toISOString().split('T')[0];
      const futureInstallments = docData.installments.filter((i: any) => !i.due_date || i.due_date >= todayStr);
      const nextInst = futureInstallments[0] || docData.installments[0];

      if (nextInst) {
        effectiveDueDate = nextInst.due_date || effectiveDueDate;
        effectiveAmount = Number(nextInst.amount) || effectiveAmount;
      }

      for (const inst of docData.installments) {
        const isPast = inst.due_date ? inst.due_date < todayStr : false;
        billsList.push({
          id: `bill_${Date.now()}_${inst.installment_number || Math.random().toString(36).substring(2, 7)}`,
          supplier_name: `${supplierCandidate} (Parc. ${inst.installment_number}/${docData.installments.length})`,
          amount: Number(inst.amount) || null,
          due_date: inst.due_date || null,
          barcode_or_pix: inst.barcode_or_pix || barcodeOrPixCandidate,
          category: categoryCandidate,
          payer_name: docData.payer_name || null,
          payer_tax_id: docData.payer_tax_id || null,
          payer_tax_type: docData.payer_tax_type || null,
          is_provision: isProvision,
          is_past: isPast,
          is_insurance: Boolean(docData.is_insurance),
          status: isPast ? 'pending_past_confirmation' : 'open',
          reminder_eve_sent: false,
          reminder_due_sent: false,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      billsList.push({
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        supplier_name: supplierCandidate,
        amount: numAmount,
        due_date: docData.due_date || null,
        barcode_or_pix: barcodeOrPixCandidate,
        category: categoryCandidate,
        payer_name: docData.payer_name || null,
        payer_tax_id: docData.payer_tax_id || null,
        payer_tax_type: docData.payer_tax_type || null,
        is_provision: isProvision,
        is_insurance: Boolean(docData.is_insurance),
        is_rent: Boolean(docData.is_rent),
        reminder_eve_sent: false,
        reminder_due_sent: false,
        created_at: new Date().toISOString(),
      });
    }
  }

  await supabase
    .from('trial_leads')
    .upsert(
      {
        whatsapp_number: targetPhone,
        doc_processed: true,
        doc_data: docData,
        supplier_name: supplierCandidate,
        amount: effectiveAmount,
        due_date: effectiveDueDate,
        barcode_or_pix: barcodeOrPixCandidate,
        category: categoryCandidate,
        payer_name: docData.payer_name || (leadRecord as any)?.payer_name || null,
        payer_tax_id: docData.payer_tax_id || (leadRecord as any)?.payer_tax_id || null,
        trial_docs_count: reconciled ? (leadRecord as any)?.trial_docs_count || newCount : newCount,
        trial_docs_limit: newLimit,
        interested_plan: suggestedPlan,
        bills_list: billsList,
        reminder_eve_sent: false,
        reminder_due_sent: false,
        trial_completed_at: new Date().toISOString(),
      },
      { onConflict: 'whatsapp_number' }
    );

  return { isDuplicate: false };
}

/**
 * Registra múltiplos lançamentos informados no mesmo áudio ou mensagem
 */
export async function recordMultipleTrialUsage(
  phone: string,
  entries: any[],
  grantedLimit?: number
): Promise<void> {
  if (!entries || entries.length === 0) return;

  // BARREIRA DE CONFIABILIDADE: NUNCA grava lançamentos sem valor monetário positivo (> 0)
  const validEntries = entries.filter((e) => {
    const val = Number(e?.amount);
    return !isNaN(val) && val > 0 && e?.due_date;
  });

  if (validEntries.length === 0) {
    console.warn('[Trial Leads Protection] Tentativa de gravar entradas sem valor monetário positivo bloqueada:', entries);
    return;
  }

  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');
  const current = await checkTrialStatus(cleanPhone);

  const { data: leadRecord } = await supabase
    .from('trial_leads')
    .select('bills_list, trial_docs_count, trial_docs_limit, interested_plan')
    .eq('whatsapp_number', cleanPhone)
    .maybeSingle();

  const billsList: any[] = Array.isArray(leadRecord?.bills_list) ? [...leadRecord.bills_list] : [];

  for (const entry of validEntries) {
    const supplier = (entry.supplier_or_customer || entry.supplier_name || 'Fornecedor').trim();
    const isProvision = Boolean(entry.is_provision);
    const amountVal = Number(entry.amount);
    const dueDateVal = entry.due_date;

    // Tenta conciliar com provisão anterior se houver
    let reconciled = false;
    const currentEntryType = entry.entry_type || 'payable';
    if (!isProvision && amountVal && amountVal > 0) {
      const idx = billsList.findIndex((b: any) => {
        const bName = (b.supplier_name || '').toLowerCase();
        const candName = supplier.toLowerCase();
        const bType = b.entry_type || 'payable';
        if (bType !== currentEntryType) return false;

        // Reconcilia SE:
        // 1. Era uma provisão para este mesmo fornecedor/origem
        const isMatchingProvision = Boolean(b.is_provision) && (bName.includes(candName) || candName.includes(bName));
        // 2. OU se já existe um lançamento idêntico COM A MESMA DATA DE VENCIMENTO
        const isSameBillSameDate = !b.is_provision && dueDateVal && b.due_date === dueDateVal && (bName === candName || bName.includes(candName));

        return isMatchingProvision || isSameBillSameDate;
      });

      if (idx >= 0) {
        billsList[idx] = {
          ...billsList[idx],
          supplier_name: supplier,
          amount: amountVal,
          due_date: dueDateVal || billsList[idx].due_date,
          barcode_or_pix: entry.barcode_or_pix || billsList[idx].barcode_or_pix,
          is_provision: false,
          is_recurring: Boolean(entry.is_recurring),
          recurrence_day: entry.recurrence_day || null,
          entry_type: currentEntryType,
          reconciled_at: new Date().toISOString(),
        };
        reconciled = true;
      }
    }

    if (!reconciled) {
      billsList.push({
        id: `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        supplier_name: supplier,
        amount: amountVal,
        due_date: dueDateVal,
        barcode_or_pix: entry.barcode_or_pix || null,
        is_provision: isProvision,
        is_recurring: Boolean(entry.is_recurring),
        recurrence_day: entry.recurrence_day || null,
        entry_type: entry.entry_type || 'payable',
        category: entry.category_suggestion || entry.category || null,
        reminder_eve_sent: false,
        reminder_due_sent: false,
        created_at: new Date().toISOString(),
      });
    }
  }

  const newCount = (leadRecord?.trial_docs_count || current.docsCount || 0) + validEntries.length;
  const newLimit = grantedLimit || leadRecord?.trial_docs_limit || current.docsLimit || 10;
  const lastEntry = validEntries[validEntries.length - 1];

  await supabase
    .from('trial_leads')
    .upsert(
      {
        whatsapp_number: cleanPhone,
        doc_processed: true,
        doc_data: lastEntry,
        supplier_name: lastEntry.supplier_or_customer || lastEntry.supplier_name || null,
        amount: Number(lastEntry.amount),
        due_date: lastEntry.due_date,
        barcode_or_pix: lastEntry.barcode_or_pix || null,
        trial_docs_count: newCount,
        trial_docs_limit: newLimit,
        interested_plan: leadRecord?.interested_plan || current.interestedPlan || 'solo',
        bills_list: billsList,
        reminder_eve_sent: false,
        reminder_due_sent: false,
        trial_completed_at: new Date().toISOString(),
      },
      { onConflict: 'whatsapp_number' }
    );
}

/**
 * Apresentação profissional e elegante ("Olá, como funciona?"),
 * convidando delicadamente para a degustação VIP gratuita caso haja vagas abertas,
 * ou informando com transparência que a cota de avaliadores está temporariamente esgotada.
 */
export async function getHowItWorksMessage(phone?: string): Promise<string> {
  const supabase = createServiceRoleClient();

  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    let altPhone = cleanPhone;
    if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
      altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
      altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
    }

    // 1. Verifica se está na Whitelist de QA (Convidado VIP do Admin)
    const { data: whitelistEntry } = await supabase
      .from('qa_whitelist')
      .select('description, created_by')
      .or(`identifier.eq.${cleanPhone},identifier.eq.${altPhone}`)
      .limit(1)
      .maybeSingle();

    // 2. Verifica se o lead já possui contas cadastradas no Livro Caixa
    const { data: leadRecord } = await supabase
      .from('trial_leads')
      .select('id, bills_list, trial_docs_count, trial_docs_limit')
      .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
      .limit(1)
      .maybeSingle();

    const bills: any[] = Array.isArray(leadRecord?.bills_list) ? leadRecord.bills_list : [];

    // Se o usuário JÁ possui contas cadastradas no Livro Caixa, saúda com o resumo das contas (sem amnésia!)
    if (bills.length > 0) {
      const isQa = Boolean(whitelistEntry);
      const guestFirstName = whitelistEntry?.description ? whitelistEntry.description.split(' ')[0] : '';
      
      const totalAmount = bills.reduce((acc, b) => {
        const amt = Number(b.amount || b.total_amount || 0);
        return acc + (isNaN(amt) ? 0 : amt);
      }, 0);

      const billsSnippet = bills.slice(0, 5).map((b) => {
        const name = (b.supplier_name || b.counterparty_name || 'Conta').trim();
        const amt = Number(b.amount || b.total_amount || 0);
        const amtFmt = !isNaN(amt) && amt > 0 ? `R$ ${amt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'A apurar';
        let dueFmt = '';
        if (b.due_date) {
          const parts = String(b.due_date).split('-');
          if (parts.length === 3) dueFmt = ` (Venc: ${parts[2]}/${parts[1]})`;
        }
        return `• *${name}:* ${amtFmt}${dueFmt}`;
      }).join('\n');

      const extraText = bills.length > 5 ? `\n_... e mais ${bills.length - 5} lançamento(s)._\n` : '';

      return `👋 *Olá${guestFirstName ? `, ${guestFirstName}` : ''}! Bom te ver de volta!* 😊
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${isQa ? `🧪 *Acesso VIP Ilimitado (QA): Ativo*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : ''}📋 *Seu Livro Caixa Atual:*
Você já possui *${bills.length} ${bills.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}* (Total: R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}):
${billsSnippet}${extraText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *O que deseja fazer agora?*
• 📸 *Novo Lançamento:* Envie foto/PDF de boleto ou nota fiscal
• 🎙️ *Áudio ou Texto:* Fale ou digite (ex: *"Recebi 1.500 do cliente"* ou *"Paguei 50 de água"*)
• 📋 Digite *Contas* para ver seus lançamentos detalhados
• 📄 Digite *Relatório* para receber seu Livro Caixa em PDF
• ❓ Pode me perguntar qualquer dúvida sobre seu caixa!`;
    }

    if (whitelistEntry) {
      const guestFirstName = whitelistEntry.description ? whitelistEntry.description.split(' ')[0] : 'Convidado VIP';
      const inviter = whitelistEntry.created_by || 'Marcos';
      return `👋 *Olá, ${guestFirstName}! Que prazer ter você por aqui!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O *${inviter}* liberou o seu **acesso VIP completo e irrestrito** no **AnalisAí**, o seu assistente de inteligência financeira no WhatsApp!

Aqui você não precisa decorar comandos nem preencher formulários complicados:
• 📸 *Notas, Boletos e Comprovantes:* Basta enviar fotos ou PDFs que eu extraio valores, datas e CNPJs automaticamente;
• 🎙️ *Áudios ou Mensagens:* Pode falar ou digitar do seu jeito (ex: *"Paguei 180 de combustível"* ou *"Anota receber 1.200 do cliente"*);
• 💡 *Inteligência de Caixa e Relatórios:* Além de contas a pagar e receber, eu analiso seu fluxo de caixa, calculo juros e gero seu DRE em PDF.

💬 *Você tem total liberdade para conversar:*
Ficou com alguma dúvida ou quer saber o que mais posso fazer pela sua empresa? **Basta me perguntar por áudio ou texto** (ex: *"o que você pode fazer por mim?"* ou *"como vejo meu fluxo de caixa?"*) que eu te oriento passo a passo!

👉 *Para começar agora mesmo:*
Envie uma foto de um **boleto** ou mande um áudio/texto dizendo suas contas. Em segundos eu organizo tudo para você! 🚀`;
    }
  }

  const { count } = await supabase
    .from('trial_leads')
    .select('*', { count: 'exact', head: true });

  const totalLeads = count || 0;
  const remainingVipSlots = Math.max(0, MAX_BETA_VIP_USERS - totalLeads);
  const hasVipSlots = remainingVipSlots > 0;

  if (hasVipSlots) {
    return `👋 *Olá! Que bom ter você por aqui!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O *AnalisAí* é o seu assistente financeiro no WhatsApp para desburocratizar a sua rotina:

• 📸 *Praticidade total:* Envie fotos de boletos, notas fiscais, áudios ou digite textos com suas contas a pagar e receber do jeito que preferir.
• ⏰ *Lembretes na véspera:* Te aviso com antecedência para te ajudar a evitar juros e multas por atraso ou esquecimento.
• 📊 *Fluxo de Caixa Descomplicado:* Veja o saldo futuro e receba relatórios de Livro Caixa direto no celular.

🎁 *Quer experimentar gratuitamente?*
Estamos com **vagas abertas** na nossa degustação VIP para novos avaliadores testarem na prática, sem compromisso e sem precisar cadastrar cartão!

👉 *Para começar a testar agora mesmo:*
Envie uma foto de um **boleto**, ou mande um áudio/texto dizendo suas contas (ex: *"Pagar internet R$ 90 dia 21 e receber cliente R$ 1.500 dia 25"*).

Em segundos eu organizo tudo para você! 🚀

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Já possui cadastro? Digite seu *CPF ou CNPJ* para carregar seus dados._`;
  }

  // Se a cota dos 50 Pioneiros VIP estiver preenchida, NUNCA perde o lead: oferece a Degustação Express (5 contas)
  return `👋 *Olá! Que bom ter você por aqui!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O *AnalisAí* é o seu assistente financeiro no WhatsApp para MEIs e pequenas empresas:

• 📸 *Praticidade total:* Envie fotos de boletos, notas fiscais, áudios ou digite textos com suas contas a pagar e receber do jeito que preferir.
• ⏰ *Lembretes na véspera:* Te aviso com antecedência para te ajudar a evitar juros e multas por atraso ou esquecimento.
• 📊 *Fluxo de Caixa Descomplicado:* Acompanhe seu saldo e livro caixa direto na conversa.

🎁 *Quer experimentar gratuitamente?*
Nossa cota de 50 vagas VIP completas foi preenchida, mas liberamos para você uma **Degustação Express Gratuita (com até 5 contas)** para você testar a inteligência agora mesmo sem nenhum compromisso!

👉 *Para testar imediatamente:*
Envie uma foto de um **boleto** ou mande um áudio/texto com uma conta sua (ex: *"Pagar internet R$ 90 dia 21"*). Em segundos eu organizo para você! 🚀

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Deseja assinar agora? Planos a partir de R$ 39,90/mês. Digite *planos* para ver as opções._`;
}

/**
 * Mensagem de boas-vindas com convite para a Degustação Gratuita (sem fricção)
 */
export function getTrialWelcomeMessage(): string {
  return `👋 *Olá! Quer experimentar o AnalisAí gratuitamente?*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O *AnalisAí* é o seu assistente financeiro no WhatsApp que cuida das suas contas a pagar e receber sem burocracia!

✨ *O que você ganha durante seu período de teste:*
• *Até 10 contas e boletos* cadastrados por foto, PDF, áudio ou texto;
• *Lembretes diários no WhatsApp* às 10h da véspera com código Pix pronto para cópia (evite juros e multas de atraso);
• *Relatório de Livro Caixa e DRE em PDF* com gráficos gerenciais direto no seu celular;
• *Zero planilhas e zero burocracia.*

👉 *Para começar agora mesmo:*
Envie uma foto ou PDF do seu primeiro **boleto ou nota fiscal**, ou mande um áudio/texto dizendo o que pagar (ex: *"Pagar aluguel R$ 1.500 dia 10"*).

Em segundos eu leio e já organizo seu primeiro lançamento!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *Deseja ativar seu plano oficial agora mesmo?*
• *AnalisAí Solo* (R$ 87,99/mês — menos de R$ 2,90/dia): ${ASAAS_PLANS.monthly.solo.checkoutUrl}
• *AnalisAí Start* (R$ 39,90/mês): ${ASAAS_PLANS.monthly.start.checkoutUrl}

💡 *Já é cliente e trocou de número?*
Envie seu **CPF ou CNPJ cadastrado** nesta conversa para transferir sua conta com segurança via verificação por e-mail (LGPD).`;
}

/**
 * Mensagem quando o lead esgotou sua cota de degustação gratuita
 * com adequação inteligente ao porte do cliente
 */
export function getTrialLimitReachedMessage(trialLimit: number = 1, actualDocsCount: number = 0): string {
  // 1. Se o usuário tem consumo leve/moderado (até 5 contas cadastradas)
  // Destaca o plano Start (R$ 39,90) como campeão de economia para não forçar planos caros
  if (actualDocsCount > 0 && actualDocsCount <= 5) {
    return `🎉 *Parabéns! O AnalisAí acompanhou e protegeu suas ${actualDocsCount} contas no período de testes!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pelo seu volume de despesas, o plano perfeito e mais econômico para o seu negócio é o:

⭐ *1️⃣ AnalisAí Start — Apenas R$ 39,90/mês* (menos de R$ 1,35/dia!)
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}
_(Até 15 lançamentos/mês, livro caixa oficial e lembretes diários pontuais no WhatsApp)_

🚀 *Prefere comandos por voz, áudio e consultor financeiro de caixa?*
• *2️⃣ AnalisAí Solo — R$ 87,99/mês* (30 lançamentos/mês + Inteligência de Caixa):
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*(Suas contas e relatórios continuam guardados a sete chaves aguardando sua confirmação.)*`;
  }

  // 2. Perfil VIP dos 50 Pioneiros com maior volume (> 5 até 10 contas)
  // O Solo é ideal porque o Start (15) ficaria apertado para quem já lançou 6 a 10 contas em poucos dias
  if (trialLimit >= 10 || actualDocsCount > 5) {
    return `🎉 *Parabéns! Durante o seu período VIP, o AnalisAí protegeu seu caixa e acompanhou suas contas sem nenhum atraso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pelo seu ritmo de lançamentos, recomendamos o plano que garante capacidade ideal para sua rotina:

⭐ *1️⃣ AnalisAí Solo — R$ 87,99/mês* (menos de R$ 2,90/dia — Mais Escolhido)
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}
_(Até 30 lançamentos/mês, comandos por áudio e texto, consultor de caixa e DRE completo em PDF)_

💡 *Seu volume é menor e prefere pagar ainda menos?*
• *2️⃣ AnalisAí Start — R$ 39,90/mês* (Até 15 lançamentos/mês):
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*(Suas contas e relatórios continuam guardados a sete chaves aguardando sua confirmação.)*`;
  }

  // 2. Perfil MEI (já desfrutou de 3 lançamentos)
  if (trialLimit >= 3) {
    return `💼 *Você concluiu sua degustação MEI do AnalisAí!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você já organizou suas contas de teste e viu como é fácil manter seus pagamentos no piloto automático sem planilhas e sem atrasos.

Para continuar usando o robô o mês inteiro direto no seu WhatsApp, escolha seu plano:

1️⃣ *AnalisAí Solo* — R$ 87,99/mês ⭐ *Mais Escolhido*
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}
_(Até 30 lançamentos/mês, comandos por voz e texto, consultor de caixa e conciliação mensal)_

2️⃣ *AnalisAí Start* — R$ 39,90/mês
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}
_(Até 15 lançamentos/mês, livro caixa e avisos pontuais no WhatsApp)_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *Ativação imediata após confirmação no Asaas.*
Dúvidas? Pode perguntar por aqui!`;
  }

  // 3. Perfil Padrão / Pessoa Física / Autônomo (1 lançamento de demonstração)
  return `🎁 *Sua degustação gratuita foi concluída com sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para continuar organizando todas as suas contas, boletos e notas fiscais por foto, PDF, voz ou texto e receber avisos pontuais antes dos vencimentos, escolha seu plano:

1️⃣ *AnalisAí Start* — R$ 39,90/mês
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}
_(Até 15 lançamentos/mês, livro caixa e avisos pontuais no WhatsApp)_

2️⃣ *AnalisAí Solo* — R$ 87,99/mês ⭐ *Mais Escolhido*
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}
_(Até 30 lançamentos/mês, comandos por voz e texto, consultor de caixa e conciliação mensal)_

🏢 *Sua empresa possui maior volume ou múltiplos CNPJs?*
Conheça nossos planos empresariais:
• *AnalisAí Pro* (R$ 297,00/mês - 500 lançamentos & até 2 CNPJs): ${ASAAS_PLANS.monthly.pro.checkoutUrl}
• *AnalisAí Super* (R$ 597,00/mês - 1.000 lançamentos & até 4 CNPJs): ${ASAAS_PLANS.monthly.super.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *A ativação é instantânea após o pagamento no Asaas!*
Dúvidas? Pode perguntar por aqui!`;
}

/**
 * Mapeamento padronizado de categorias contábeis e financeiras para exibição clara
 */
export function formatCategoryLabel(rawCategory?: string | null): string {
  if (!rawCategory) return 'Geral';
  const clean = rawCategory.trim().toLowerCase();
  const map: Record<string, string> = {
    energia_eletrica: 'Energia Elétrica',
    energia: 'Energia Elétrica',
    telecomunicacoes: 'Internet / Telefonia',
    telecom: 'Internet / Telefonia',
    internet: 'Internet / Telefonia',
    agua_saneamento: 'Água e Saneamento',
    agua: 'Água e Saneamento',
    fornecedores_mercadoria: 'Fornecedores',
    fornecedores: 'Fornecedores',
    servicos_terceiros: 'Serviços de Terceiros',
    servicos: 'Serviços',
    tributos: 'Impostos e Tributos',
    impostos: 'Impostos e Tributos',
    aluguel: 'Aluguel / Imóvel',
    seguro: 'Seguro',
    seguros: 'Seguro',
    combustivel: 'Combustível',
    alimentacao: 'Alimentação',
    contabilidade: 'Contabilidade',
    pessoal: 'Pessoal / Pró-labore',
    emprestimos: 'Empréstimos / Financiamentos',
    receita_vendas: 'Receita / Clientes',
    receita: 'Receita / Clientes',
    outros: 'Outros',
  };
  return map[clean] || rawCategory.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formata o resumo do documento processado na degustação gratuita (limpo, inteligente e com acolhimento contábil)
 */
export function formatTrialDocSummary(doc: any, remainingDocs: number = 0): string {
  const isDuePresent = Boolean(doc.due_date);
  const dueInfo = isDuePresent ? formatDueDateDetails(doc.due_date) : 'Não identificado';
  const rawAmount = doc.amount !== undefined && doc.amount !== null ? doc.amount : doc.total_amount;
  const valFormatted = rawAmount !== undefined && rawAmount !== null && !isNaN(Number(rawAmount)) && Number(rawAmount) > 0
    ? Number(rawAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Não identificado';

  const supplier = doc.supplier_name || doc.counterparty_name || 'Não identificado';

  // Mapeamento amigável de tipos de documento
  const docTypeRaw = (doc.document_type || doc.doc_type || 'boleto').toLowerCase();
  const docTypeMap: Record<string, string> = {
    nfe: 'Nota Fiscal (NF-e)',
    nfse: 'Nota Fiscal de Serviço (NFS-e)',
    boleto: 'Boleto/Conta de Consumo',
    recibo: 'Recibo',
    cupom: 'Cupom Fiscal',
    outro: 'Boleto/Fatura de Consumo',
  };
  let docTypeFormatted = docTypeMap[docTypeRaw] || doc.document_type || doc.doc_type || 'Boleto/Conta';
  if (doc.is_insurance || /seguro|seguradora/i.test(supplier)) docTypeFormatted = 'Seguro (Carnê/Apólice)';
  if (doc.is_rent || /aluguel|loca[cç][aã]o|administradora de bens/i.test(supplier)) docTypeFormatted = 'Aluguel / Notificação de Locação';

  // Mapeamento amigável de categorias
  const categoryRaw = doc.category || doc.category_suggestion;
  let categoryFormatted = categoryRaw ? formatCategoryLabel(categoryRaw) : null;
  if (doc.is_rent && !categoryFormatted) categoryFormatted = 'Aluguel / Imóvel';
  if (doc.is_insurance && !categoryFormatted) categoryFormatted = 'Seguro';

  // Tratamento especializado para Carnê / Seguro com múltiplas parcelas (Img 3 e 4)
  if (doc.installments && Array.isArray(doc.installments) && doc.installments.length > 1) {
    const todayStr = new Date().toISOString().split('T')[0];
    const past = doc.installments.filter((i: any) => i.due_date && i.due_date < todayStr);
    const future = doc.installments.filter((i: any) => !i.due_date || i.due_date >= todayStr);
    const nextInst = future[0] || doc.installments[0];
    const nextVal = Number(nextInst.amount) || (rawAmount && Number(rawAmount) > 0 ? Number(rawAmount) / doc.installments.length : 0);
    const nextValFmt = nextVal > 0 ? nextVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A calcular';
    const totalContractFmt = rawAmount && Number(rawAmount) > 0
      ? Number(rawAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : `${doc.installments.length}x de ${nextValFmt}`;

    let txt = `📄 *Lançamento Registrado — Carnê Parcelado*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `🏢 *Cedente/Fornecedor:* ${supplier}\n`;
    txt += `📑 *Tipo de Documento:* ${docTypeFormatted}\n`;
    txt += `💰 *Valor Total do Contrato:* ${totalContractFmt} (${doc.installments.length} parcelas)\n`;
    txt += `📅 *Próxima Parcela (${nextInst.installment_number || 1}ª):* ${formatDueDateDetails(nextInst.due_date)} — *${nextValFmt}*\n`;
    if (categoryFormatted) {
      txt += `📂 *Categoria:* ${categoryFormatted}\n`;
    }
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `📊 *Detalhamento do Cronograma:*\n`;
    txt += `• *A Vencer:* ${future.length} parcela(s) agendadas no seu calendário.\n`;
    if (past.length > 0) {
      txt += `• *Anteriores:* ${past.length} parcela(s) com datas passadas.\n`;
      txt += `\n❓ *Você já efetuou o pagamento das ${past.length} parcelas anteriores?*\n`;
      txt += `👉 *Responda "Sim"* se já foram quitadas para eu manter seu histórico limpo, ou me avise se alguma ficou em aberto!\n`;
    } else {
      txt += `\n⏰ *Fique tranquilo:* Na véspera de cada parcela (às 10h em ponto), te aviso aqui para você não esquecer e manter seus pagamentos em dia!\n`;
    }

    if (doc.is_insurance || categoryRaw === 'seguro' || /seguro|seguradora/i.test(supplier)) {
      txt += `\n🛡️ *Auditoria de Apólice AnalisAí:*\nIdentifiquei que este é um seguro de *${supplier}*. Que tal enviar a **Apólice Completa** em PDF para o AnalisAí analisar suas coberturas, franquias e vigência? 📄\n`;
    }

    txt += `\n💡 _Digite *contas* para ver seus agendamentos ou *planos* para assinar._`;
    return txt;
  }

  let txt = `📄 *Lançamento Registrado — Degustação AnalisAí*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `🏢 *Cedente/Fornecedor:* ${supplier}\n`;
  txt += `📑 *Tipo de Documento:* ${docTypeFormatted}\n`;
  txt += `💰 *Valor:* ${valFormatted}\n`;
  txt += `📅 *Vencimento:* ${dueInfo}\n`;
  if (categoryFormatted) {
    txt += `📂 *Categoria:* ${categoryFormatted}\n`;
  }

  // 1. Tratamento de Vencimento Ausente (Ponto 1 e Ponto 4)
  if (!isDuePresent) {
    txt += `\n⚠️ *Atenção:* Como este documento não possui data de vencimento expressa, *para quando é o pagamento?*\n`;
    txt += `👉 *Responda com a data* (ex: *25/10* ou *dia 25*) para eu agendar seu lembrete na véspera!\n`;
  } else {
    const hasFullBarcode = doc.barcode_or_pix && doc.barcode_or_pix.length >= 20;
    const reminderText = hasFullBarcode
      ? 'te envio o lembrete aqui com o código prontinho para pagar sem estresse.'
      : 'te envio o lembrete aqui para você não esquecer da obrigação e manter seus pagamentos em dia!';
    txt += `\n⏰ *Fique tranquilo:* Na véspera do vencimento (às 10h em ponto), ${reminderText}\n`;
  }

  // 2. Tratamento de Boleto sem Código de Barras (Ponto 2)
  const isBoleto = docTypeRaw === 'boleto' || docTypeFormatted.toLowerCase().includes('boleto');
  const hasValidBarcode = doc.barcode_or_pix && doc.barcode_or_pix.length >= 20;
  if (isBoleto && !hasValidBarcode && !doc.is_rent && !doc.is_insurance) {
    txt += `\n💡 *Não identifiquei o código de barras/linha digitável nesta foto.*\n`;
    txt += `Se você tiver a linha digitável, envie o número aqui (ou tire uma foto mais aberta) para eu já deixar o código pronto para você pagar quando vencer!\n`;
  }

  // 3. Tratamento de Aluguel e Chave Pix (Ponto 4)
  if (doc.is_rent || categoryRaw === 'aluguel' || docTypeFormatted.includes('Aluguel')) {
    if (doc.pix_key) {
      const pixType = doc.pix_key_type ? doc.pix_key_type.toUpperCase() : 'PIX';
      txt += `\n🔑 *Chave Pix para Pagamento (${pixType}):* \`${doc.pix_key}\`\n`;
    }
    txt += `\n🏠 *Dica de Aluguel:* Identifiquei que este é o aluguel do seu imóvel. Deseja cadastrar como *despesa recorrente mensal*? Em qual dia de cada mês costuma vencer?\n`;
  }

  // 4. Tratamento de Seguro / Apólice Completa (Ponto 5)
  if (doc.is_insurance || categoryRaw === 'seguro' || /seguro|seguradora/i.test(supplier)) {
    txt += `\n🛡️ *Dica de Blindagem:* Identifiquei que este é um seguro de *${supplier}*. Que tal enviar a **Apólice Completa** em PDF para o AnalisAí analisar suas coberturas, franquias e vigência? 📄\n`;
  }

  txt += `\n💡 _Digite *contas* para ver seus agendamentos ou *planos* para assinar._`;

  return txt;
}

/**
 * Formata a confirmação de 1 ou múltiplos lançamentos informados por voz ou texto (limpo, direto e sem poluição)
 */
export function formatMultipleTrialEntriesConfirmation(entries: any[], remainingDocs: number = 0): string {
  if (!entries || entries.length === 0) {
    return '✅ *Lançamento salvo com sucesso no seu AnalisAí!*';
  }

  const payables = entries.filter((e) => (e.entry_type || 'payable') !== 'receivable');
  const receivables = entries.filter((e) => (e.entry_type || 'payable') === 'receivable');

  const totalPayable = payables.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const totalReceivable = receivables.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const netBalance = totalReceivable - totalPayable;

  const totalPayableFmt = totalPayable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const totalReceivableFmt = totalReceivable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const netBalanceFmt = (netBalance >= 0 ? '+' : '') + netBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (entries.length === 1) {
    const doc = entries[0];
    const sup = doc.supplier_or_customer || doc.supplier_name || 'Fornecedor';
    const dueInfo = doc.due_date ? formatDueDateDetails(doc.due_date) : 'Data a confirmar';
    const valFormatted = doc.amount
      ? Number(doc.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : (doc.is_provision ? 'A confirmar (Provisão)' : 'Não informado');
    const isIncome = doc.entry_type === 'receivable';

    let txt = `✅ *Lançamento salvo e monitorado no seu AnalisAí:*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `${isIncome ? '🟢' : '🔴'} *${isIncome ? 'Cliente/Origem' : 'Fornecedor'}:* ${sup}\n`;
    txt += `💰 *Valor:* ${valFormatted}\n`;
    txt += `📅 *Vencimento:* ${dueInfo}\n`;
    txt += `📑 *Tipo:* ${isIncome ? 'Conta a Receber (Receita)' : 'Conta a Pagar (Despesa)'}\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (!doc.due_date) {
      txt += `\n⚠️ *Atenção:* Como a data de vencimento não foi informada, *para quando é o pagamento?*\n`;
      txt += `👉 *Responda aqui com a data* (ex: *25/10* ou *dia 25*) para eu agendar seu lembrete na véspera!\n\n`;
    } else {
      const reminderMsg = isIncome
        ? 'te envio um lembrete para acompanhar o recebimento desta receita!'
        : (doc.barcode_or_pix
          ? 'te envio o lembrete aqui com o código pronto para você pagar sem multas.'
          : 'te envio o lembrete aqui para você não esquecer da obrigação e evitar juros de atraso!');
      txt += `\n⏰ *Fique tranquilo:* Na véspera do vencimento (às 10h), ${reminderMsg}\n\n`;
    }

    if (doc.barcode_or_pix) {
      txt += `📋 *Código de Barras / Linha Digitável:*\n\`${doc.barcode_or_pix.trim()}\`\n\n`;
    }

    txt += `💡 _Digite *contas* para ver seus agendamentos ou *planos* para assinar._`;
    return txt;
  }

  // Múltiplos lançamentos (2 ou mais no mesmo áudio ou texto)
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣'];

  let txt = `✅ *${entries.length} lançamentos salvos e agendados no seu AnalisAí:*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  entries.forEach((e, idx) => {
    const num = emojis[idx] || `•`;
    const isIncome = (e.entry_type || 'payable') === 'receivable';
    const sup = e.supplier_or_customer || e.supplier_name || `Lançamento ${idx + 1}`;
    const dueInfo = e.due_date ? formatDueDateDetails(e.due_date) : 'Data a confirmar';
    const valFormatted = e.amount
      ? Number(e.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : (e.is_provision ? 'A confirmar (Provisão)' : 'R$ 0,00');
    const provTag = e.is_provision ? ' _(Estimativa)_' : '';
    const typeBadge = isIncome ? '🟢 _(Receita)_' : '🔴 _(Despesa)_';

    txt += `${num} *${sup}* ${typeBadge}\n`;
    txt += `   💰 ${valFormatted}${provTag} · 📅 ${dueInfo}\n`;
    if (e.barcode_or_pix) {
      txt += `   📋 Código/Pix: \`${e.barcode_or_pix.trim()}\`\n`;
    }
    txt += `\n`;
  });

  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (receivables.length > 0 && payables.length > 0) {
    txt += `🔴 *Total a Pagar (Despesas):* *${totalPayableFmt}*\n`;
    txt += `🟢 *Total a Receber (Receitas):* *${totalReceivableFmt}*\n`;
    txt += `💰 *Saldo Líquido Previsto:* *${netBalanceFmt}*\n`;
  } else if (receivables.length > 0) {
    txt += `🟢 *Total das Receitas a Receber:* *${totalReceivableFmt}*\n`;
  } else if (totalPayable > 0) {
    txt += `🔴 *Total das Despesas a Pagar:* *${totalPayableFmt}*\n`;
  }

  const hasMissingDue = entries.some((e) => !e.due_date);
  if (hasMissingDue) {
    txt += `⚠️ *Atenção:* Algumas contas estão sem data de vencimento definida. Você pode responder a qualquer momento com a data (ex: *"Sabesp vence dia 20"*).\n\n`;
  } else if (payables.length > 0) {
    txt += `⏰ *Fique tranquilo:* Às 10h da véspera de cada vencimento, te envio o lembrete aqui para você não esquecer de suas obrigações e manter seu fluxo em dia!\n\n`;
  } else {
    txt += `⏰ *Fique tranquilo:* Te avisarei nas datas programadas para acompanhar o recebimento das suas receitas!\n\n`;
  }

  txt += `💡 _Digite *contas* para ver seus agendamentos ou *planos* para assinar._`;

  return txt;
}

/**
 * Menu de conversão e apresentação dos recursos dos planos ativos
 */
export function getTrialConversionMenu(actualDocsCount: number = 0): string {
  // Se o usuário utilizou volume leve/moderado (padrão até 15 contas)
  if (actualDocsCount <= 15) {
    return `🚀 *Assinatura Antecipada — Escolha o Plano Ideal*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Selecionamos as 2 melhores opções para a sua rotina:

⭐ *1️⃣ AnalisAí Start — Apenas R$ 39,90/mês* (menos de R$ 1,35/dia!)
_(A proposta mais próxima do que você utilizou no seu dia a dia)_
• Até 15 lançamentos/mês por fotos de notas, boletos ou texto;
• Lembretes pontuais no WhatsApp na véspera e no dia do vencimento;
• Relatório completo do Livro Caixa em PDF para você e seu contador.
👉 ${ASAAS_PLANS.monthly.start.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *2️⃣ AnalisAí Solo — R$ 87,99/mês* ⭐ *Mais Escolhido*
*(O diferencial completo em relação ao Start por menos de R$ 2,90/dia)*
🔥 **O que você ganha a mais no Solo:**
• 🎙️ *Comandos por Áudio/Voz:* Mande áudios na correria para registrar despesas e receitas sem precisar digitar;
• 💡 *Consultor Estratégico de Caixa:* IA que orienta quais contas priorizar e projeta seu saldo futuro;
• 🔔 *Cobrança Amigável:* Lembretes de cobrança via Pix para clientes no WhatsApp com 1 toque;
• 📈 *Cota ampliada:* Até 30 lançamentos/mês inclusos!
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *Ativação instantânea após confirmação no Asaas.*
💬 Dúvidas ou faturamento corporativo? Pode responder por aqui!`;
  }

  // Se o usuário já opera com volume maior (> 15 contas)
  return `🚀 *Assinatura Antecipada — Escolha o Plano Ideal*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pelo seu ritmo de lançamentos, selecionamos as 2 opções sob medida:

⭐ *1️⃣ AnalisAí Solo — R$ 87,99/mês* (menos de R$ 2,90/dia — Mais Escolhido)
_(A proposta ideal para o seu volume atual de despesas)_
• Até 30 lançamentos/mês por foto, PDF, áudio ou texto;
• Lembretes na véspera às 10h com código de barras/Pix prontos;
• Consultor estratégico de caixa e DRE contábil em PDF.
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *2️⃣ AnalisAí Solo Plus — R$ 157,99/mês*
*(O diferencial para quem busca separar finanças da Empresa e Pessoais)*
🔥 **O que você ganha a mais no Solo Plus:**
• 👥 *Separação Blindada PJ x PF:* Dois caixas independentes na mesma conversa de WhatsApp;
• 📊 *Cota Dupla:* Até 60 lançamentos/mês para empresas em expansão;
• 🛡️ *Suporte Prioritário VIP:* Conciliação financeira assistida.
👉 ${ASAAS_PLANS.monthly.solo_plus.checkoutUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *Ativação instantânea após confirmação no Asaas.*
💬 Dúvidas? Pode responder por aqui!`;
}

export const BANK_SAFETY_NOTICE = `🛡️ *Segurança Bancária:* Antes de confirmar o pagamento no aplicativo do seu banco, confira sempre se o nome do favorecido, CNPJ e o valor na tela de confirmação correspondem exatamente ao seu credor/fornecedor. O AnalisAí realiza a leitura digital automatizada dos dados, cabendo exclusivamente ao pagador a conferência final e autorização da operação junto à sua instituição financeira.`;

/**
 * Formata uma lista de contas de forma elegante para mensagens do WhatsApp
 */
export function formatBillsList(bills: any[]): string {
  return bills
    .map((b) => {
      const fornecedor = b.supplier_name || b.counterparty_name || 'Conta / Fornecedor';
      const rawVal = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount;
      const valFmt = rawVal && Number(rawVal) > 0
        ? Number(rawVal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '_(Valor em aberto - Provisão)_';
      const provTag = b.is_provision ? ' 📝 _[Provisão]_' : '';
      let line = `• *${fornecedor}*: ${valFmt}${provTag}`;
      if (b.barcode_or_pix) {
        line += `\n  ↳ Linha/Pix: \`${b.barcode_or_pix.trim()}\``;
      }
      return line;
    })
    .join('\n');
}

/**
 * Mensagem da Véspera do Vencimento (disparo às 10h) — Suporta conta única ou agrupamento de múltiplas contas
 */
export function getEveReminderMessage(leadOrBills: any): string {
  const bills: any[] = Array.isArray(leadOrBills) ? leadOrBills : [leadOrBills];
  const isMultiple = bills.length > 1;
  const totalAmount = bills.reduce((acc, b) => {
    const rawVal = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount;
    return acc + (Number(rawVal) || 0);
  }, 0);
  const totalFmt = totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let txt = `⏰ *Lembrete de Vencimento — AnalisAí*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (!isMultiple) {
    const single = bills[0] || {};
    const fornecedor = single.supplier_name || single.counterparty_name || 'seu fornecedor';
    const rawVal = single.amount !== undefined && single.amount !== null ? single.amount : single.total_amount;
    const valFormatted = rawVal && Number(rawVal) > 0
      ? Number(rawVal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'valor cadastrado';
    const provTag = single.is_provision ? ' 📝 _(Provisão de valor)_' : '';

    txt += `Olá! Passando para te lembrar que a sua conta de *${fornecedor}* (${valFormatted}${provTag}) vence **AMANHÃ**!\n\n`;

    if (single.barcode_or_pix) {
      txt += `📋 *Código de barras para pagar sem multas:*\n`;
      txt += `${single.barcode_or_pix.trim()}\n\n`;
    }
  } else {
    txt += `Olá! Passando para te avisar que você tem *${bills.length} contas* agendadas para vencer **AMANHÃ**:\n\n`;
    txt += `${formatBillsList(bills)}\n\n`;
    txt += `💰 *Total previsto para amanhã:* ${totalFmt}\n\n`;
  }

  txt += `${BANK_SAFETY_NOTICE}\n\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `✨ *O Poder da Rotina no Piloto Automático:*\n`;
  txt += `Viu a tranquilidade de não ser pego de surpresa na véspera?\n\n`;
  txt += `Conheça os recursos disponíveis nos nossos planos oficiais:\n`;
  txt += `• *AnalisAí Start (R$ 39,90/mês):* 15 lançamentos/mês e lembretes diários pontuais no WhatsApp;\n`;
  txt += `• *AnalisAí Solo (R$ 87,99/mês):* 30 lançamentos, comandos por áudio, consultor de caixa e relatório de Livro Caixa em PDF;\n`;
  txt += `• *Planos Pro & Super (a partir de R$ 297/mês):* Para empresas com múltiplos CNPJs, centenas de lançamentos e conciliação bancária contínua.\n\n`;
  txt += `👉 *Escolha o plano sob medida para sua empresa:*\n`;
  txt += `• Assinar Start: ${ASAAS_PLANS.monthly.start.checkoutUrl}\n`;
  txt += `• Assinar Solo: ${ASAAS_PLANS.monthly.solo.checkoutUrl}\n`;
  txt += `• Conhecer todos os planos: https://analisai.me#planos`;

  return txt;
}

/**
 * Mensagem do Dia do Vencimento (disparo às 10h) — Suporta conta única ou agrupamento de múltiplas contas
 */
export function getDueReminderMessage(leadOrBills: any): string {
  const bills: any[] = Array.isArray(leadOrBills) ? leadOrBills : [leadOrBills];
  const isMultiple = bills.length > 1;
  const totalAmount = bills.reduce((acc, b) => {
    const rawVal = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount;
    return acc + (Number(rawVal) || 0);
  }, 0);
  const totalFmt = totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let txt = '';

  if (!isMultiple) {
    const single = bills[0] || {};
    const fornecedor = single.supplier_name || single.counterparty_name || 'seu fornecedor';
    const rawVal = single.amount !== undefined && single.amount !== null ? single.amount : single.total_amount;
    const valFormatted = rawVal && Number(rawVal) > 0
      ? Number(rawVal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'valor cadastrado';
    const provTag = single.is_provision ? ' 📝 _(Provisão de valor)_' : '';

    txt += `🚨 *Atenção: Seu boleto vence HOJE!*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `A conta de *${fornecedor}* (${valFormatted}${provTag}) vence no dia de hoje. Evite multas e juros de atraso!\n\n`;

    if (single.barcode_or_pix) {
      txt += `📋 *Código de barras pronto para cópia:*\n`;
      txt += `${single.barcode_or_pix.trim()}\n\n`;
    }
  } else {
    txt += `🚨 *Atenção: Você tem ${bills.length} contas vencendo HOJE!*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `Organize seus pagamentos no início do dia para evitar juros e multas de atraso:\n\n`;
    txt += `${formatBillsList(bills)}\n\n`;
    txt += `💰 *Total a pagar HOJE:* ${totalFmt}\n\n`;
  }

  txt += `${BANK_SAFETY_NOTICE}\n\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `⚡ *Agilidade e Organização Financeira:*\n`;
  txt += `Copie os dados acima e liquide no app do seu banco para não pagar juros ou multas de atraso!\n\n`;
  txt += `🤖 *Cada plano é desenhado para o estágio do seu negócio:*\n`;
  txt += `• *Para Autônomos & MEIs:* Planos Start e Solo cuidam do básico essencial e avisos pontuais no WhatsApp;\n`;
  txt += `• *Para Empresas em Crescimento:* Plano Solo Plus (60 lançamentos) com conciliação mensal do seu extrato bancário;\n`;
  txt += `• *Para Grupos e Médias Empresas:* Planos Pro e Super gerenciam de 2 a 4 CNPJs com conciliação semanal e até 1.000 lançamentos/mês.\n\n`;
  txt += `👉 *Ative agora mesmo com liberação instantânea no WhatsApp:*\n`;
  txt += `• *AnalisAí Solo* (Mais Escolhido - R$ 87,99/mês): ${ASAAS_PLANS.monthly.solo.checkoutUrl}\n`;
  txt += `• *AnalisAí Pro* (Multi-CNPJ - R$ 297,00/mês): ${ASAAS_PLANS.monthly.pro.checkoutUrl}\n`;
  txt += `• *Análise de Caixa Avulsa (R$ 14,90):* ${ASAAS_ONE_OFF.cashFlowAnalysis.checkoutUrl}`;

  return txt;
}

/**
 * Mensagem consolidada para o caso do lead possuir contas vencendo HOJE e contas vencendo AMANHÃ
 */
export function getConsolidatedDailyReminderMessage(params: {
  dueTodayBills: any[];
  dueTomorrowBills: any[];
}): string {
  const { dueTodayBills, dueTomorrowBills } = params;
  const todayTotal = dueTodayBills.reduce((acc, b) => {
    const rawVal = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount;
    return acc + (Number(rawVal) || 0);
  }, 0);
  const tomorrowTotal = dueTomorrowBills.reduce((acc, b) => {
    const rawVal = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount;
    return acc + (Number(rawVal) || 0);
  }, 0);
  const grandTotal = todayTotal + tomorrowTotal;

  const todayFmt = todayTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const tomorrowFmt = tomorrowTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const grandFmt = grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let txt = `☀️ *Bom dia! Seu Radar de Vencimentos — AnalisAí*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `Aqui está a sua programação de pagamentos prioritários:\n\n`;

  if (dueTodayBills.length > 0) {
    txt += `🚨 *VENCENDO HOJE (${dueTodayBills.length} conta${dueTodayBills.length > 1 ? 's' : ''}):*\n`;
    txt += `${formatBillsList(dueTodayBills)}\n`;
    txt += `💰 *Subtotal de Hoje:* ${todayFmt}\n\n`;
  }

  if (dueTomorrowBills.length > 0) {
    txt += `⏰ *VENCENDO AMANHÃ (${dueTomorrowBills.length} conta${dueTomorrowBills.length > 1 ? 's' : ''}):*\n`;
    txt += `${formatBillsList(dueTomorrowBills)}\n`;
    txt += `💰 *Subtotal de Amanhã:* ${tomorrowFmt}\n\n`;
  }

  txt += `📊 *Total de Obrigações do Período:* ${grandFmt}\n\n`;
  txt += `${BANK_SAFETY_NOTICE}\n\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `⚡ *Dica de Gestão:* Liquide as contas de hoje logo pela manhã para manter seu fluxo de caixa desimpedido.\n\n`;
  txt += `👉 *Gostou do lembrete consolidado? Ative o plano Solo por R$ 87,99/mês:*\n`;
  txt += `${ASAAS_PLANS.monthly.solo.checkoutUrl}`;

  return txt;
}

/**
 * Processa a agenda diária de lembretes (executada às 10h da manhã)
 * Garante rigorosamente o AGRUPAMENTO INTELIGENTE (1 única mensagem por lead)
 */
export async function processTrialReminders(): Promise<{ eveCount: number; dueCount: number }> {
  const supabase = createServiceRoleClient();

  // Data atual no fuso do Brasil
  const nowStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = nowStr.split('/').map(Number);
  const todayDate = new Date(year, month - 1, day);
  const tomorrowDate = addDays(todayDate, 1);

  const todayIso = format(todayDate, 'yyyy-MM-dd');
  const tomorrowIso = format(tomorrowDate, 'yyyy-MM-dd');

  let eveCount = 0;
  let dueCount = 0;

  // Processa Lembretes de VÉSPERA e DIA DO VENCIMENTO para TODAS as contas de cada Lead
  const { data: allTrialLeads } = await supabase
    .from('trial_leads')
    .select('id, whatsapp_number, supplier_name, amount, due_date, barcode_or_pix, bills_list, reminder_eve_sent, reminder_due_sent')
    .eq('converted_to_client', false);

  if (allTrialLeads && allTrialLeads.length > 0) {
    for (const lead of allTrialLeads) {
      const { data: activeClient } = await supabase
        .from('clients')
        .select('id')
        .eq('whatsapp_number', lead.whatsapp_number)
        .eq('status', 'active')
        .maybeSingle();

      if (activeClient) {
        await supabase.from('trial_leads').update({ converted_to_client: true }).eq('id', lead.id);
        continue;
      }

      let billsList: any[] = Array.isArray(lead.bills_list) && lead.bills_list.length > 0
        ? [...lead.bills_list]
        : [];

      // Se bills_list estiver vazio mas o lead tiver a conta principal cadastrada:
      if (billsList.length === 0 && lead.due_date) {
        billsList.push({
          id: 'root_bill',
          supplier_name: lead.supplier_name,
          amount: lead.amount,
          due_date: lead.due_date,
          barcode_or_pix: lead.barcode_or_pix,
          reminder_eve_sent: lead.reminder_eve_sent,
          reminder_due_sent: lead.reminder_due_sent,
        });
      }

      // Agrupa contas que vencem hoje e que vencem amanhã
      const dueToday = billsList.filter((b) => b.due_date === todayIso && !b.reminder_due_sent);
      const dueTomorrow = billsList.filter((b) => b.due_date === tomorrowIso && !b.reminder_eve_sent);

      if (dueToday.length === 0 && dueTomorrow.length === 0) {
        continue;
      }

      let consolidatedMessage = '';

      if (dueToday.length > 0 && dueTomorrow.length > 0) {
        // Envia UMA ÚNICA MENSAGEM consolidada para hoje e amanhã
        consolidatedMessage = getConsolidatedDailyReminderMessage({
          dueTodayBills: dueToday,
          dueTomorrowBills: dueTomorrow,
        });
      } else if (dueToday.length > 0) {
        // Envia UMA ÚNICA MENSAGEM com todas as contas de hoje agrupadas
        consolidatedMessage = getDueReminderMessage(dueToday);
      } else if (dueTomorrow.length > 0) {
        // Envia UMA ÚNICA MENSAGEM com todas as contas de amanhã agrupadas
        consolidatedMessage = getEveReminderMessage(dueTomorrow);
      }

      if (consolidatedMessage) {
        await sendEvolutionText({ phone: lead.whatsapp_number, text: consolidatedMessage });

        // Marca flags em cada conta processada
        for (const b of dueToday) {
          b.reminder_due_sent = true;
          b.reminder_due_sent_at = new Date().toISOString();
          dueCount++;
        }

        for (const b of dueTomorrow) {
          b.reminder_eve_sent = true;
          b.reminder_eve_sent_at = new Date().toISOString();
          eveCount++;
        }

        await supabase
          .from('trial_leads')
          .update({
            bills_list: billsList,
            reminder_eve_sent: billsList.some((b) => b.reminder_eve_sent),
            reminder_due_sent: billsList.some((b) => b.reminder_due_sent),
          })
          .eq('id', lead.id);
      }
    }
  }

  return { eveCount, dueCount };
}

/**
 * Retorna as contas ativas cadastradas pelo lead durante o período de degustação
 */
export async function getTrialBills(phone: string): Promise<any[]> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('bills_list')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  return Array.isArray(lead?.bills_list) ? lead.bills_list : [];
}

/**
 * Atualiza uma conta ou provisão de degustação
 */
export async function updateTrialBill(
  phone: string,
  identifier: string,
  updates: Partial<{ amount: number; due_date: string; is_provision: boolean; is_paid: boolean; supplier_name: string }>
): Promise<{ updated: boolean; oldBill?: any; newBill?: any }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, bills_list')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (!lead || !Array.isArray(lead.bills_list) || lead.bills_list.length === 0) {
    return { updated: false };
  }

  const cleanId = identifier.toLowerCase().trim();
  const index = lead.bills_list.findIndex((b: any) =>
    b.id === identifier ||
    (b.supplier_name && b.supplier_name.toLowerCase().includes(cleanId)) ||
    (b.supplier_name && cleanId.includes(b.supplier_name.toLowerCase()))
  );

  if (index === -1) return { updated: false };

  const oldBill = { ...lead.bills_list[index] };
  const newBill = {
    ...oldBill,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  lead.bills_list[index] = newBill;

  await supabase
    .from('trial_leads')
    .update({ bills_list: lead.bills_list })
    .eq('id', lead.id);

  return { updated: true, oldBill, newBill };
}

/**
 * Remove uma conta ou provisão de degustação
 */
export async function deleteTrialBill(
  phone: string,
  identifier: string
): Promise<{ deleted: boolean; deletedBill?: any }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phone.replace(/\D/g, '');
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, bills_list, trial_docs_count')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (!lead || !Array.isArray(lead.bills_list) || lead.bills_list.length === 0) {
    return { deleted: false };
  }

  const cleanId = identifier.toLowerCase().trim();
  const index = lead.bills_list.findIndex((b: any) =>
    b.id === identifier ||
    (b.supplier_name && b.supplier_name.toLowerCase().includes(cleanId)) ||
    (b.supplier_name && cleanId.includes(b.supplier_name.toLowerCase()))
  );

  if (index === -1) return { deleted: false };

  const deletedBill = lead.bills_list.splice(index, 1)[0];
  const newCount = Math.max(0, (lead.trial_docs_count || 1) - 1);

  await supabase
    .from('trial_leads')
    .update({
      bills_list: lead.bills_list,
      trial_docs_count: newCount,
    })
    .eq('id', lead.id);

  return { deleted: true, deletedBill };
}

/**
 * Formata as contas de degustação em mensagem executiva WhatsApp, separando contas a pagar e contas a receber
 */
export function formatTrialBillsListMessage(billsList: any[], periodLabel: string = 'Suas Contas Salvas'): string {
  if (!billsList || billsList.length === 0) {
    return `📋 *${periodLabel} (Degustação VIP)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você não possui nenhum lançamento agendado para o período consultado.

Envie uma foto de boleto ou mande um áudio/texto dizendo suas contas (ex: *"Pagar internet R$ 90 dia 21 e receber cliente R$ 1.500 dia 25"*) para agendar! 🚀`;
  }

  const payables = billsList.filter((b) => (b.entry_type || 'payable') !== 'receivable' && !b.is_provision);
  const receivables = billsList.filter((b) => (b.entry_type || 'payable') === 'receivable' && !b.is_provision);
  const provisions = billsList.filter((b) => b.is_provision);

  let totalPayables = 0;
  let totalReceivables = 0;
  let totalProvisions = 0;

  let text = `📋 *${periodLabel} (Degustação VIP)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (payables.length > 0) {
    text += `🔴 *CONTAS A PAGAR / DESPESAS (${payables.length}):*\n`;
    for (const b of payables) {
      const rawVal = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount;
      const val = Number(rawVal || 0);
      totalPayables += val;
      const valFmt = val > 0 ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A confirmar';
      const dueFmt = b.due_date ? formatDueDateDetails(b.due_date) : 'Data a confirmar';
      const recTag = b.is_recurring ? ' 🔄 _(Mensal)_' : '';
      const sup = b.supplier_name || b.counterparty_name || 'Conta';
      const catLabel = b.category ? formatCategoryLabel(b.category) : null;
      const catInfo = catLabel ? ` | 📂 ${catLabel}` : '';
      text += `• *${sup}*${recTag}\n  💰 ${valFmt} | 📅 ${dueFmt}${catInfo}\n`;
      if (b.barcode_or_pix) {
        text += `  ↳ 📋 _Linha digitável salva (digite *pagar ${sup.toLowerCase().split(' ')[0]}* para copiar)_\n`;
      }
    }
    text += `\n`;
  }

  if (receivables.length > 0) {
    text += `🟢 *CONTAS A RECEBER / RECEITAS (${receivables.length}):*\n`;
    for (const b of receivables) {
      const rawVal = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount;
      const val = Number(rawVal || 0);
      totalReceivables += val;
      const valFmt = val > 0 ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A confirmar';
      const dueFmt = b.due_date ? formatDueDateDetails(b.due_date) : 'Data a confirmar';
      const recTag = b.is_recurring ? ' 🔄 _(Mensal)_' : '';
      const sup = b.supplier_name || b.counterparty_name || 'Origem';
      const catLabel = b.category ? formatCategoryLabel(b.category) : null;
      const catInfo = catLabel ? ` | 📂 ${catLabel}` : '';
      text += `• *${sup}*${recTag}\n  💰 ${valFmt} | 📅 ${dueFmt}${catInfo}\n`;
    }
    text += `\n`;
  }

  if (provisions.length > 0) {
    text += `📌 *PROVISÕES / ESTIMATIVAS (${provisions.length}):*\n`;
    for (const b of provisions) {
      const rawVal = b.amount !== undefined && b.amount !== null ? b.amount : b.total_amount;
      const val = Number(rawVal || 0);
      totalProvisions += val;
      const valFmt = val > 0 ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A confirmar';
      const dueFmt = b.due_date ? formatDueDateDetails(b.due_date) : 'Data a confirmar';
      const typeStr = (b.entry_type || 'payable') === 'receivable' ? 'Receita Prevista' : 'Despesa Estimada';
      const sup = b.supplier_name || b.counterparty_name || 'Conta';
      const catLabel = b.category ? formatCategoryLabel(b.category) : null;
      const catInfo = catLabel ? ` | 📂 ${catLabel}` : '';
      text += `• *${sup}* _(${typeStr})_\n  💰 Estimativa: ${valFmt} | 📅 ${dueFmt}${catInfo}\n`;
    }
    text += `\n`;
  }

  const netBalance = totalReceivables - totalPayables;
  const netBalanceFmt = (netBalance >= 0 ? '+' : '') + netBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (receivables.length > 0 && payables.length > 0) {
    text += `🔴 *Total a Pagar:* *${totalPayables.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
    text += `🟢 *Total a Receber:* *${totalReceivables.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
    text += `💰 *Saldo Líquido Previsto:* *${netBalanceFmt}*\n`;
  } else if (receivables.length > 0) {
    text += `🟢 *Total a Receber:* *${totalReceivables.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
  } else {
    text += `🔴 *Total a Pagar:* *${(totalPayables + totalProvisions).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
  }

  text += `⏰ *Fique tranquilo:* Às 10h da véspera de cada vencimento, te envio o lembrete aqui para você manter seu fluxo em dia!\n\n`;
  text += `💡 *Ações Rápidas (Texto ou Voz):*\n`;
  text += `• *Copiar Código:* Digite *"pagar [nome]"* para receber a linha digitável/Pix;\n`;
  text += `• *Alterar Valor:* *"Mudar valor da [nome] para [valor]"*;\n`;
  text += `• *Alterar Vencimento:* *"Mudar vencimento da [nome] para dia [dia]"*;\n`;
  text += `• *Excluir:* *"Excluir conta da [nome]"*;\n`;
  text += `• *Outros Períodos:* Envie *"contas semana"*, *"contas mês"* ou *"todas as contas"*.\n`;
  text += `_(Você também pode enviar qualquer um desses comandos por áudio!)_`;

  return text;
}

/**
 * Dá baixa em uma conta a pagar ou conta a receber no Livro Caixa da degustação gratuita
 * Busca com tolerância fonética, nome do fornecedor/cliente, valor ou última conta
 */
export async function markTrialBillAsPaidOrReceived(params: {
  phone: string;
  query?: string;
  targetType?: 'payable' | 'receivable';
}): Promise<{
  success: boolean;
  message: string;
  bill?: any;
  isIncome?: boolean;
}> {
  const supabase = createServiceRoleClient();
  const cleanPhone = params.phone.replace(/\D/g, '');
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, bills_list')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (!lead || !Array.isArray(lead.bills_list) || lead.bills_list.length === 0) {
    return {
      success: false,
      message: '⚠️ Não encontrei nenhuma conta cadastrada no seu Livro Caixa para dar baixa.',
    };
  }

  const cleanQuery = (params.query || '').toLowerCase().trim();
  const bills = lead.bills_list;

  let matchedIndex = -1;

  // 1. Busca por nome do fornecedor/cliente
  if (cleanQuery.length >= 2) {
    matchedIndex = bills.findIndex((b: any) => {
      const name = (b.supplier_name || b.counterparty_name || '').toLowerCase();
      return name.includes(cleanQuery) || cleanQuery.includes(name);
    });

    // Se não achou por nome, tenta por valor numérico
    if (matchedIndex === -1) {
      const numMatch = cleanQuery.match(/\d+([.,]\d{2})?/);
      if (numMatch) {
        const val = parseFloat(numMatch[0].replace(',', '.'));
        matchedIndex = bills.findIndex((b: any) => Math.abs((Number(b.amount) || 0) - val) < 0.1);
      }
    }
  }

  // 2. Se não passou query ou não encontrou e o usuário disse apenas "já recebi" ou "já paguei":
  if (matchedIndex === -1) {
    if (params.targetType === 'receivable') {
      const recIdx = bills.findLastIndex((b: any) => (b.entry_type || 'payable') === 'receivable' && !b.is_paid);
      if (recIdx !== -1) matchedIndex = recIdx;
    } else if (params.targetType === 'payable') {
      const payIdx = bills.findLastIndex((b: any) => (b.entry_type || 'payable') === 'payable' && !b.is_paid);
      if (payIdx !== -1) matchedIndex = payIdx;
    } else {
      matchedIndex = bills.length - 1;
    }
  }

  if (matchedIndex === -1) {
    return {
      success: false,
      message: '⚠️ Não identifiquei qual conta você deseja dar baixa. Digite *Contas* para ver seus lançamentos abertos.',
    };
  }

  const targetBill = bills[matchedIndex];
  const isIncome = (targetBill.entry_type || 'payable') === 'receivable';

  // Marca como pago / recebido
  bills[matchedIndex] = {
    ...targetBill,
    is_paid: true,
    status: 'paid',
    reconciled_at: new Date().toISOString(),
  };

  await supabase
    .from('trial_leads')
    .update({ bills_list: bills })
    .eq('id', lead.id);

  const supName = targetBill.supplier_name || targetBill.counterparty_name || 'Conta';
  const valFmt = Number(targetBill.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return {
    success: true,
    bill: bills[matchedIndex],
    isIncome,
    message: isIncome
      ? `🎉 *Recebimento Confirmado no Livro Caixa!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ O recebimento de *${valFmt}* de *${supName}* foi marcado como **PAGO/RECEBIDO**!
📈 Sua receita foi consolidada e qualquer aviso de pendência foi baixado com sucesso.`
      : `✅ *Pagamento Confirmado no Livro Caixa!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Conta: *${supName}*
• Valor: *${valFmt}*
• Status: **PAGO**
📅 Atualizamos seu fluxo de caixa e seus relatórios do mês!`,
  };
}

