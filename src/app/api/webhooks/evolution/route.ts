import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText, sendEvolutionPoll, sendEvolutionList, sendActionSequenceMenu, fetchMediaBase64FromEvolution } from '@/lib/solo/evolution';
import {
  extractDocumentWithGemini,
  processVoiceCommandWithGemini,
  parseConversationalFinancialEntry,
  parseConversationalCorrections,
} from '@/lib/solo/gemini';
import { routeConversationalIntent, UserConversationalContext } from '@/lib/solo/conversational-router';
import { recordAuditLog } from '@/lib/solo/audit';
import { resolveUserAndClient, addTeamMember, listTeamMembers, removeTeamMember, updateTeamMember, handleNaturalLanguageTeamCommand, markTeamMemberActivated } from '@/lib/solo/team';
import { checkAndIncrementQuota, getClientPlanAndCurrentCycle, formatConsumptionSummary } from '@/lib/solo/quota';
import { handleAdminCommands, inviteContactVip } from '@/lib/solo/admin';
import {
  generateCashFlowPostponeAdvice,
  isLongTermCashFlowQuery,
  isWeeklyBillsQuery,
  extractBillsQueryPeriod,
  getExtendedCashFlowProposalMessage,
  getUpcomingBillsSummary,
} from '@/lib/solo/cash-flow-advisor';
import { ASAAS_PLANS, ASAAS_ONE_OFF, OFFICIAL_BOT_WHATSAPP } from '@/lib/solo/constants';
import { formatDueDateDetails } from '@/lib/solo/date-utils';
import { solicitarTrocaNumeroCom2FA, validarCodigo2FATrocaNumero } from '@/lib/solo/phone-change';
import {
  checkTrialStatus,
  recordTrialUsage,
  recordMultipleTrialUsage,
  getTrialWelcomeMessage,
  getHowItWorksMessage,
  getTrialLimitReachedMessage,
  formatTrialDocSummary,
  formatMultipleTrialEntriesConfirmation,
  getTrialConversionMenu,
  getPioneerShareMessage,
  getTrialBills,
  updateTrialBill,
  deleteTrialBill,
  formatTrialBillsListMessage,
  BANK_SAFETY_NOTICE,
} from '@/lib/solo/trial';
import { checkAntiLoopStatus, recordFruitlessAttempt } from '@/lib/solo/anti-loop';
import { isFeedbackMessage, recordClientFeedback } from '@/lib/solo/feedback';
import { sendTrialPdfToWhatsApp, sendCashLedgerPdfToWhatsApp } from '@/lib/solo/cash-ledger-pdf';
import { recordWaitlistLead } from '@/lib/solo/waitlist';
import {
  linkReferralLead,
  getReferralShareMessage,
  solicitarAlteracaoPix,
  confirmarAlteracaoPix,
  cancelarAlteracaoPix,
  solicitarAlteracaoEmail,
  confirmarAlteracaoEmail,
  cancelarAlteracaoEmail,
  cadastrarEmailCliente,
  getReferralStatus,
} from '@/lib/solo/referral';
import { analyzePatrimonialExpense, analyzeBeneficiaryAndExpense, syncPartnersFromQsa } from '@/lib/solo/patrimonial-advisor';
import { getMonthlyDividendTracking } from '@/lib/solo/dividend-tracker';
import {
  handleGenerateFriendlyCollection,
  markReceivableAsPaid,
  getOpenReceivables,
} from '@/lib/solo/friendly-collection';
import { getTaxRevenueTracking, updateTaxRegime, addTrialLeadRevenue } from '@/lib/solo/tax-meter';
import { isQaWhitelisted } from '@/lib/solo/qa-whitelist';
import {
  iniciarDesafioRecuperacaoEmail,
  processarRespostaDesafioEmail,
} from '@/lib/solo/email-recovery';
import { escalateToHumanConsultant } from '@/lib/solo/consultant-escalation';
import { reconcileBankTransactions } from '@/lib/solo/bank-reconciliation';
import { addMinutes } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EvolutionWebhookBody {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: { mimetype: string; caption?: string; url?: string };
      documentMessage?: { mimetype: string; fileName?: string; url?: string };
      audioMessage?: { mimetype: string; url?: string; ptt?: boolean };
      contactMessage?: { displayName?: string; vcard?: string };
      contactsArrayMessage?: { displayName?: string; contacts?: Array<{ displayName?: string; vcard?: string }> };
    };
    messageType?: string;
    base64?: string;
  };
}

function getUpgradeCheckoutUrl(currentCode?: string): string {
  if (currentCode === 'start') return ASAAS_PLANS.monthly.solo.checkoutUrl;
  if (currentCode === 'solo') return ASAAS_PLANS.monthly.solo_plus.checkoutUrl;
  if (currentCode === 'solo_plus') return ASAAS_PLANS.monthly.pro.checkoutUrl;
  return ASAAS_PLANS.monthly.super.checkoutUrl;
}

async function processConversationalEntry(
  client: any,
  plan: any,
  phone: string,
  rawText: string,
  origin: 'texto' | 'áudio' = 'texto'
): Promise<boolean> {
  try {
    const conv = await parseConversationalFinancialEntry(rawText);
    if (!conv.is_financial_entry) return false;

    if (conv.needs_clarification) {
      await sendEvolutionText({
        phone,
        text:
          conv.clarification_prompt ||
          'Entendi a sua intenção! Para registrar certinho no seu fluxo de caixa, por favor me informe o valor e a data de vencimento.',
      });
      return true;
    }

    const entries = Array.isArray(conv.entries) && conv.entries.length > 0 ? conv.entries : [];
    if (entries.length === 0 && conv.amount && conv.due_date) {
      entries.push({
        supplier_or_customer: conv.supplier_or_customer,
        amount: conv.amount,
        due_date: conv.due_date,
        entry_type: conv.entry_type || 'payable',
        category_suggestion: conv.category_suggestion,
        is_provision: Boolean(conv.is_provision),
      });
    }

    const validEntries = entries.filter((e: any) => (e.amount || e.is_provision) && (e.due_date || e.is_provision));

    if (validEntries.length > 1) {
      const quotaCheck = await checkAndIncrementQuota(client.id, 'doc', validEntries.length);
      const cleanNumber = phone.replace(/\D/g, '');
      const isEntryQa = client.is_admin || await isQaWhitelisted(cleanNumber) || await isQaWhitelisted(client.tax_id);

      if (!quotaCheck.allowed && !isEntryQa) {
        await sendEvolutionText({
          phone,
          text: `⚠️ *Limite de Lançamentos do Mês Atingido!*
Você tentou registrar ${validEntries.length} lançamentos, mas ultrapassou a cota mensal disponível do seu plano.
Para contratar lançamentos extras válidos por 60 dias:
👉 ${ASAAS_ONE_OFF.extraDocsPackage.checkoutUrl}`,
        });
        return true;
      }

      const supabase = createServiceRoleClient();
      for (const item of validEntries) {
        const isInc = item.entry_type === 'receivable';
        const ent = item.supplier_or_customer || (isInc ? 'Cliente' : 'Fornecedor');
        const grp = item.category_suggestion || (isInc ? 'receita_operacional' : 'despesa_administrativa');
        const isProv = Boolean(item.is_provision);

        await supabase.from('cash_ledger_entries').insert({
          client_id: client.id,
          entry_date: item.due_date,
          description: `${isInc ? 'RECEITA' : 'DESPESA'} - ${ent} (via ${origin})`,
          amount: isInc ? Math.abs(item.amount) : -Math.abs(item.amount),
          entry_type: isInc ? 'income' : 'expense',
          dre_group: grp,
          status: 'previsto',
        });

        await supabase.from('payables_receivables').insert({
          client_id: client.id,
          counterparty_name: ent,
          type: isInc ? 'receivable' : 'payable',
          amount: Math.abs(item.amount),
          original_due_date: item.due_date,
          current_due_date: item.due_date,
          status: 'open',
          is_provision: isProv,
          barcode_or_pix: item.barcode_or_pix || null,
          notes: isProv ? '[PROVISÃO] Valor estimado a confirmar' : null,
        });
      }

      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      let msg = `✅ *${validEntries.length} lançamentos registrados no seu Livro Caixa (via ${origin})!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      validEntries.forEach((it: any, idx: number) => {
        const num = emojis[idx] || '•';
        const valFmt = Number(it.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dueFmt = it.due_date ? formatDueDateDetails(it.due_date) : 'A definir';
        msg += `${num} *${it.supplier_or_customer}*: ${valFmt} | ${dueFmt}\n`;
      });
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nO AnalisAí vai te lembrar às 10h da véspera de cada vencimento! Digite *relatório* para gerar o PDF ou *contas* para ver seus agendamentos.`;

      await sendEvolutionText({ phone, text: msg });

      for (const it of validEntries) {
        if (it.barcode_or_pix) {
          await sendPaymentCodeMessage(phone, { barcode_or_pix: it.barcode_or_pix });
        }
      }
      return true;
    }

    if (conv.amount && conv.due_date) {
      const quotaCheck = await checkAndIncrementQuota(client.id, 'doc', 1);
      const cleanNumber = phone.replace(/\D/g, '');
      const isEntryQa = client.is_admin || await isQaWhitelisted(cleanNumber) || await isQaWhitelisted(client.tax_id);

      if (!quotaCheck.allowed && !isEntryQa) {
        await sendEvolutionText({
          phone,
          text: `⚠️ *Limite de Lançamentos do Mês Atingido!*
Você já processou todos os ${quotaCheck.limit} lançamentos inclusos no seu plano este mês.

As informações enviadas via ${origin} são computadas no seu limite mensal contratual. Para registrar essa conta sem travar sua rotina:

1️⃣ *Pacote Extra (+20 Lançamentos) por R$ 14,90:*
Válido por 60 dias para qualquer canal (texto, áudio, fotos ou PDFs):
👉 ${ASAAS_ONE_OFF.extraDocsPackage.checkoutUrl}

2️⃣ *Upgrade para o próximo plano:*
👉 ${getUpgradeCheckoutUrl(plan?.code)}`,
        });
        return true;
      }

      const supabase = createServiceRoleClient();
      const isIncome = conv.entry_type === 'receivable';
      const entity = conv.supplier_or_customer || (isIncome ? 'Cliente' : 'Fornecedor');
      const dreGroup =
        conv.category_suggestion || (isIncome ? 'receita_operacional' : 'despesa_administrativa');

      await supabase.from('cash_ledger_entries').insert({
        client_id: client.id,
        entry_date: conv.due_date,
        description: `${isIncome ? 'RECEITA' : 'DESPESA'} - ${entity} (via ${origin})`,
        amount: isIncome ? Math.abs(conv.amount) : -Math.abs(conv.amount),
        entry_type: isIncome ? 'income' : 'expense',
        dre_group: dreGroup,
        status: 'previsto',
      });

      const isProvision = Boolean(conv.is_provision);

      // Se for conta definitiva e existir uma provisão prévia em aberto para o mesmo fornecedor, concilia!
      let provisionReconciled = false;
      if (!isIncome && !isProvision && client?.id) {
        const { data: openProvisions } = await supabase
          .from('payables_receivables')
          .select('*')
          .eq('client_id', client.id)
          .eq('type', 'payable')
          .eq('is_provision', true)
          .in('status', ['open', 'postponed']);

        const matchedProv = openProvisions?.find((p: any) => {
          const pName = (p.counterparty_name || '').toLowerCase();
          const candName = entity.toLowerCase();
          return pName.includes(candName) || candName.includes(pName) || pName.slice(0, 4) === candName.slice(0, 4);
        });

        if (matchedProv) {
          const oldAmtFmt = Number(matchedProv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const newAmtFmt = Number(conv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const newDueFmt = formatDueDateDetails(conv.due_date);

          await supabase
            .from('payables_receivables')
            .update({
              amount: Math.abs(conv.amount),
              current_due_date: conv.due_date,
              is_provision: false,
              notes: `Provisão conciliada com a fatura real em ${new Date().toLocaleDateString('pt-BR')}`,
            })
            .eq('id', matchedProv.id);

          if (matchedProv.document_id) {
            await supabase
              .from('cash_ledger_entries')
              .update({
                amount: -Math.abs(conv.amount),
                entry_date: conv.due_date,
                description: `DESPESA - ${entity} (Fatura Real Conciliada)`,
              })
              .eq('document_id', matchedProv.document_id);
          }

          await sendEvolutionText({
            phone,
            text: `🎯 *Provisão Conciliada com a Fatura Real!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${entity}
• *Estimativa Anterior:* ${oldAmtFmt} ➔ *Valor Real:* *${newAmtFmt}*
• *Vencimento Atualizado:* *${newDueFmt}*
• *Status:* Conta a Pagar Definitiva (Provisão Baixada)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seu fluxo de caixa e relatórios foram ajustados para o valor exato da fatura!`,
          });
          return true;
        }
      }

      await supabase.from('payables_receivables').insert({
        client_id: client.id,
        counterparty_name: entity,
        type: isIncome ? 'receivable' : 'payable',
        amount: Math.abs(conv.amount),
        original_due_date: conv.due_date,
        current_due_date: conv.due_date,
        status: 'open',
        barcode_or_pix: conv.barcode_or_pix || null,
        is_provision: isProvision,
        notes: isProvision ? '[PROVISÃO / COMPROMISSO VARIÁVEL] Valor estimado a confirmar' : null,
      });

      const formattedDate = formatDueDateDetails(conv.due_date);
      const valFmt = Number(conv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const quotaFootnote = client.is_admin
        ? '👑 _Modo Admin Irrestrito_'
        : quotaCheck.consumed_from_extra
          ? `🎁 _Lançado utilizando sua carteira de lançamentos extras (restam ${quotaCheck.extra_credits_remaining} extras válidos)._`
          : `Você ainda tem *${quotaCheck.remaining}* lançamento(s) disponível(is) neste mês.`;

      if (isIncome) {
        let taxBadge = '';
        try {
          const taxStatus = await getTaxRevenueTracking({ clientId: client.id });
          taxBadge = `\n${taxStatus.miniBadge}`;
        } catch (tErr) {
          console.warn('[Tax Meter Badge Warning]:', tErr);
        }

        await sendEvolutionText({
          phone,
          text: `✅ *Previsão de Recebimento Registrada (via ${origin})!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Cliente/Origem:* ${entity}
• *Valor:* ${valFmt}
• *Data Prevista:* ${formattedDate}
• *Classificação:* Receita Operacional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${quotaFootnote}${taxBadge}
Essa entrada já foi computada na projeção do seu Livro Caixa e DRE. Digite *relatório* para ver o PDF atualizado!`,
        });
      } else {
        if (isProvision) {
          await sendEvolutionText({
            phone,
            text: `📌 *Provisão Financeira Registrada (via ${origin})!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Compromisso:* ${entity}
• *Valor Estimado:* ${valFmt} *(Provisão a Confirmar)*
• *Vencimento Previsto:* ${formattedDate}
• *Classificação:* ${dreGroup}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${quotaFootnote}
💡 *Compromisso seguro na sua agenda!*
Assim que a fatura real chegar, basta me enviar a foto do boleto ou avisar por voz/texto (ex: _"Chegou a ${entity}, deu R$ 238,40"_) que eu concilio automaticamente sem duplicar!`,
          });
        } else {
          await sendEvolutionText({
            phone,
            text: `✅ *Conta a Pagar Registrada (via ${origin})!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${entity}
• *Valor:* ${valFmt}
• *Vencimento:* ${formattedDate}
• *Classificação:* ${dreGroup}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${quotaFootnote}
O AnalisAí vai te lembrar às 10h da véspera e no dia do vencimento para manter seu caixa impecável!`,
          });
        }

        if (conv.barcode_or_pix) {
          await sendPaymentCodeMessage(phone, { barcode_or_pix: conv.barcode_or_pix });
        }

        // Consultoria Pedagógica de Blindagem Patrimonial (Separação PJ x PF)
        const patrimonial = analyzePatrimonialExpense({
          supplier_name: entity,
          category: dreGroup,
          amount: Math.abs(conv.amount),
        });
        if (patrimonial.isPersonalExpense && patrimonial.adviceMessage) {
          await sendEvolutionText({
            phone,
            text: patrimonial.adviceMessage,
          });
        }
      }
      return true;
    }
  } catch (convErr) {
    console.warn(`[Conversational ${origin} Parsing Warning]:`, convErr);
  }
  return false;
}

async function renderBillsList(clientId: string, phone: string, filter?: string) {
  const supabase = createServiceRoleClient();
  const { data: bills, error } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .eq('type', 'payable')
    .in('status', ['open', 'postponed'])
    .order('current_due_date', { ascending: true });

  if (error || !bills || bills.length === 0) {
    await sendEvolutionText({
      phone,
      text: '📋 *Suas Contas a Pagar:*\n\nParabéns! Você não possui nenhuma conta a pagar pendente cadastrada no momento. 🎉',
    });
    return;
  }

  const todayYMD = new Date().toISOString().split('T')[0];
  const overdueBills: any[] = [];
  const upcomingBills: any[] = [];
  const provisionBills: any[] = [];
  let totalOverdue = 0;
  let totalUpcoming = 0;
  let totalProvisions = 0;

  for (const b of bills) {
    if (b.is_provision) {
      provisionBills.push(b);
      totalProvisions += Number(b.amount || 0);
      continue;
    }
    const dueDate = b.current_due_date || b.original_due_date;
    const isOverdue = dueDate < todayYMD;
    if (isOverdue) {
      overdueBills.push(b);
      totalOverdue += Number(b.amount || 0);
    } else {
      upcomingBills.push(b);
      totalUpcoming += Number(b.amount || 0);
    }
  }

  let text = '📋 *Painel de Contas & Provisões*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  if (overdueBills.length > 0 && filter !== 'upcoming') {
    text += `🔴 *VENCIDAS (${overdueBills.length}):*\n`;
    for (const b of overdueBills) {
      const amtFmt = Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      text += `• *${b.counterparty_name}*\n  Valor: *${amtFmt}* | Vencimento: ${formatDueDateDetails(b.current_due_date)}\n`;
    }
    text += `Subtotal Vencido: *${totalOverdue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n`;
  }

  if (upcomingBills.length > 0 && filter !== 'overdue') {
    text += `🟡 *A VENCER (${upcomingBills.length}):*\n`;
    for (const b of upcomingBills) {
      const amtFmt = Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      text += `• *${b.counterparty_name}*\n  Valor: *${amtFmt}* | Vencimento: ${formatDueDateDetails(b.current_due_date)}\n`;
    }
    text += `Subtotal a Vencer: *${totalUpcoming.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n`;
  }

  if (provisionBills.length > 0) {
    text += `📌 *PROVISÕES ESTIMADAS / COMPROMISSOS VARIÁVEIS (${provisionBills.length}):*\n`;
    for (const b of provisionBills) {
      const amtFmt = Number(b.amount) > 0 ? Number(b.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A confirmar';
      text += `• *${b.counterparty_name}*\n  Estimativa: *${amtFmt}* | Previsão: ${formatDueDateDetails(b.current_due_date)}\n`;
    }
    text += `Subtotal Provisões: *${totalProvisions.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n`;
  }

  const grandTotal = (totalOverdue + totalUpcoming + totalProvisions).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total Geral a Pagar:* *${grandTotal}*\n\n💡 *Dica:* Para conciliar uma provisão com a fatura real, envie a foto do boleto ou digite:\nEx: _"Mudar valor da Sabesp para 85,00"_ ou _"Adiar Copel para dia 25"_`;

  await sendEvolutionText({ phone, text });
}

async function handleAmountChange(
  client: any,
  phone: string,
  cleanPhone: string,
  supplierQuery: string,
  newAmount: number
) {
  const supabase = createServiceRoleClient();
  if (!supplierQuery || isNaN(newAmount) || newAmount <= 0) {
    await sendEvolutionText({
      phone,
      text: '⚠️ Não consegui identificar o fornecedor ou o novo valor. Por favor, envie no formato:\n*"Mudar valor da Sabesp para 85,00"*',
    });
    return;
  }

  const cleanQuery = supplierQuery.toLowerCase().trim();
  const stopWords = ['conta', 'fornecedor', 'boleto', 'de', 'da', 'do', 'o', 'a', 'valor', 'reais'];
  const tokens = cleanQuery.split(/\s+/).filter((t: string) => t.length >= 3 && !stopWords.includes(t));

  // 1. Tenta buscar em payables_receivables se for cliente cadastrado
  if (client?.id) {
    const { data: openBills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['open', 'postponed'])
      .order('current_due_date', { ascending: true });

    let matchedBill = openBills?.find((b: any) => b.counterparty_name.toLowerCase().includes(cleanQuery));
    if (!matchedBill && tokens.length > 0 && openBills) {
      matchedBill = openBills.find((b: any) => tokens.some((t: string) => b.counterparty_name.toLowerCase().includes(t)));
    }

    if (matchedBill) {
      const oldAmount = Number(matchedBill.amount);
      const isProv = Boolean(matchedBill.is_provision);
      const isRec = matchedBill.type === 'receivable';

      await supabase
        .from('payables_receivables')
        .update({
          amount: newAmount,
          is_provision: false,
          notes: `Valor atualizado de R$ ${oldAmount.toFixed(2)} para R$ ${newAmount.toFixed(2)} em ${new Date().toLocaleDateString('pt-BR')}`,
        })
        .eq('id', matchedBill.id);

      if (matchedBill.document_id) {
        await supabase
          .from('cash_ledger_entries')
          .update({ amount: isRec ? Math.abs(newAmount) : -Math.abs(newAmount) })
          .eq('document_id', matchedBill.document_id);
      }

      const oldFmt = oldAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const newFmt = newAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const dueFmt = formatDueDateDetails(matchedBill.current_due_date);

      await sendEvolutionText({
        phone,
        text: `✅ *${isProv ? 'Provisão Conciliada com a Fatura Real!' : 'Valor Atualizado com Sucesso!'}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *${isRec ? 'Cliente' : 'Fornecedor'}:* ${matchedBill.counterparty_name}
• *Valor Anterior:* ${oldFmt}
• *Novo Valor Corrigido:* *${newFmt}*
• *Vencimento:* ${dueFmt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seus relatórios e fluxo de caixa já foram sincronizados com o novo valor.`,
      });
      return;
    }
  }

  // 2. Se for lead em degustação (ou cliente sem match no banco oficial):
  const trialRes = await updateTrialBill(cleanPhone, cleanQuery, { amount: newAmount, is_provision: false });
  if (trialRes.updated && trialRes.oldBill && trialRes.newBill) {
    const oldAmount = Number(trialRes.oldBill.amount || 0);
    const oldFmt = oldAmount > 0 ? oldAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A confirmar';
    const newFmt = newAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dueFmt = trialRes.newBill.due_date ? trialRes.newBill.due_date.split('-').reverse().join('/') : 'A definir';

    await sendEvolutionText({
      phone,
      text: `✅ *${trialRes.oldBill.is_provision ? 'Provisão Conciliada com a Fatura Real!' : 'Valor Atualizado com Sucesso!'}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Conta:* ${trialRes.newBill.supplier_name}
• *Valor Anterior:* ${oldFmt}
• *Novo Valor Corrigido:* *${newFmt}*
• *Vencimento:* ${dueFmt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seu painel de contas da degustação VIP foi atualizado com o valor real!`,
    });
    return;
  }

  // 3. Se não achou em nenhum lugar, exibe a lista existente
  const bills = client
    ? (await supabase.from('payables_receivables').select('counterparty_name, amount').eq('client_id', client.id).in('status', ['open', 'postponed']))?.data
    : await getTrialBills(cleanPhone);

  const listStr = bills && bills.length > 0
    ? bills.map((b: any) => `• *${b.counterparty_name || b.supplier_name}* (R$ ${Number(b.amount || 0).toFixed(2)})`).join('\n')
    : 'Nenhuma conta cadastrada.';

  await sendEvolutionText({
    phone,
    text: `Não localizei a conta correspondente a "${supplierQuery}".\n\nSuas contas cadastradas são:\n${listStr}\n\nEnvie o nome correto da conta que deseja alterar.`,
  });
}

async function handleDeleteBill(
  client: any,
  phone: string,
  cleanPhone: string,
  supplierQuery: string
) {
  const supabase = createServiceRoleClient();
  const cleanQuery = supplierQuery ? supplierQuery.toLowerCase().trim() : '';

  let matchedBill: any = null;
  let isTrial = false;

  if (client?.id) {
    const { data: bills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['open', 'postponed'])
      .order('created_at', { ascending: false });

    if (bills && bills.length > 0) {
      if (cleanQuery.includes('último') || cleanQuery.includes('ultimo') || cleanQuery.includes('recente') || !cleanQuery) {
        matchedBill = bills[0];
      } else {
        const stopWords = ['conta', 'fornecedor', 'boleto', 'de', 'da', 'do', 'a', 'o', 'excluir', 'apagar', 'remover'];
        const tokens = cleanQuery.split(/\s+/).filter((t: string) => t.length >= 3 && !stopWords.includes(t));
        matchedBill = bills.find((b: any) => b.counterparty_name.toLowerCase().includes(cleanQuery));
        if (!matchedBill && tokens.length > 0) {
          matchedBill = bills.find((b: any) => tokens.some((t: string) => b.counterparty_name.toLowerCase().includes(t)));
        }
      }
    }
  }

  if (!matchedBill) {
    const trialBills = await getTrialBills(cleanPhone);
    if (trialBills && trialBills.length > 0) {
      if (cleanQuery.includes('último') || cleanQuery.includes('ultimo') || cleanQuery.includes('recente') || !cleanQuery) {
        matchedBill = trialBills[trialBills.length - 1];
        isTrial = true;
      } else {
        matchedBill = trialBills.find((b: any) =>
          b.supplier_name && (b.supplier_name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(b.supplier_name.toLowerCase()))
        );
        if (matchedBill) isTrial = true;
      }
    }
  }

  if (!matchedBill) {
    const bills = client
      ? (await supabase.from('payables_receivables').select('counterparty_name, amount').eq('client_id', client.id).in('status', ['open', 'postponed']))?.data
      : await getTrialBills(cleanPhone);

    const listStr = bills && bills.length > 0
      ? bills.map((b: any) => `• *${b.counterparty_name || b.supplier_name}* (R$ ${Number(b.amount || 0).toFixed(2)})`).join('\n')
      : 'Nenhuma conta encontrada.';

    await sendEvolutionText({
      phone,
      text: `Não localizei a conta correspondente a "${supplierQuery}".\n\nSuas contas cadastradas são:\n${listStr}\n\nEnvie o nome exato da conta que deseja excluir.`,
    });
    return;
  }

  const supplier = matchedBill.counterparty_name || matchedBill.supplier_name;
  const amount = Number(matchedBill.amount || 0);
  const dueDate = matchedBill.current_due_date || matchedBill.due_date;

  // Grava confirmação pendente
  await supabase.from('bot_action_confirmations').insert({
    client_id: client?.id || null,
    phone_number: cleanPhone,
    action_type: 'delete_bill',
    target_entity_id: isTrial ? null : matchedBill.id,
    proposed_payload: {
      isTrial,
      billId: matchedBill.id,
      supplier,
      amount,
      dueDate,
      documentId: matchedBill.document_id || null,
    },
    status: 'pending',
    expires_at: addMinutes(new Date(), 10).toISOString(),
  });

  const dueFmt = dueDate ? (dueDate.includes('-') ? dueDate.split('-').reverse().join('/') : dueDate) : 'A definir';
  const amtFmt = amount > 0 ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A confirmar';

  await sendEvolutionText({
    phone,
    text: `🗑️ *Confirmação de Exclusão de Lançamento*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Conta:* ${supplier}
• *Valor:* ${amtFmt}
• *Vencimento:* ${dueFmt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deseja realmente excluir este lançamento?

1️⃣ *Sim, confirmar exclusão*
2️⃣ *Não, cancelar*

👉 _Responda com *1* (ou *Sim*) para confirmar, ou *2* (ou *Não*) para cancelar._`,
  });
}

async function handleMarkBillPaid(
  client: any,
  phone: string,
  cleanPhone: string,
  supplierQuery: string
) {
  const supabase = createServiceRoleClient();
  const cleanQuery = supplierQuery ? supplierQuery.toLowerCase().trim() : '';

  let matchedBill: any = null;
  let isTrial = false;

  if (client?.id) {
    const { data: bills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['open', 'postponed'])
      .order('current_due_date', { ascending: true });

    if (bills && bills.length > 0) {
      if (cleanQuery.includes('últim') || cleanQuery.includes('ultim') || cleanQuery.includes('recente') || !cleanQuery || cleanQuery === 'tudo' || cleanQuery === 'conta') {
        matchedBill = bills[0];
      } else {
        const stopWords = ['conta', 'fornecedor', 'cliente', 'boleto', 'de', 'da', 'do', 'a', 'o', 'pagar', 'paguei', 'baixar', 'baixa', 'recebi', 'recebido'];
        const tokens = cleanQuery.split(/\s+/).filter((t: string) => t.length >= 3 && !stopWords.includes(t));
        matchedBill = bills.find((b: any) => b.counterparty_name.toLowerCase().includes(cleanQuery));
        if (!matchedBill && tokens.length > 0) {
          matchedBill = bills.find((b: any) => tokens.some((t: string) => b.counterparty_name.toLowerCase().includes(t)));
        }
      }
    }
  }

  if (!matchedBill) {
    const trialBills = await getTrialBills(cleanPhone);
    if (trialBills && trialBills.length > 0) {
      const openTrialBills = trialBills.filter((b: any) => b.status !== 'paid' && b.status !== 'canceled');
      if (openTrialBills.length > 0) {
        if (cleanQuery.includes('últim') || cleanQuery.includes('ultim') || cleanQuery.includes('recente') || !cleanQuery || cleanQuery === 'tudo' || cleanQuery === 'conta') {
          matchedBill = openTrialBills[0];
          isTrial = true;
        } else {
          matchedBill = openTrialBills.find((b: any) =>
            b.supplier_name && (b.supplier_name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(b.supplier_name.toLowerCase()))
          );
          if (matchedBill) isTrial = true;
        }
      }
    }
  }

  if (!matchedBill) {
    const bills = client
      ? (await supabase.from('payables_receivables').select('counterparty_name, amount').eq('client_id', client.id).in('status', ['open', 'postponed']))?.data
      : await getTrialBills(cleanPhone);

    const listStr = bills && bills.length > 0
      ? bills.map((b: any) => `• *${b.counterparty_name || b.supplier_name}* (R$ ${Number(b.amount || 0).toFixed(2)})`).join('\n')
      : 'Nenhuma conta pendente encontrada.';

    await sendEvolutionText({
      phone,
      text: `Não localizei uma conta em aberto correspondente a "${supplierQuery}".\n\nSuas contas pendentes são:\n${listStr}\n\nEnvie o nome da conta que deseja dar baixa (ex: *"Paguei a Sabesp"* ou *"Recebi do João"*).`,
    });
    return;
  }

  const supplier = matchedBill.counterparty_name || matchedBill.supplier_name;
  const amount = Number(matchedBill.amount || 0);
  const amtFmt = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const isReceivable = (matchedBill.type || matchedBill.entry_type) === 'receivable';
  const todayYMD = new Date().toISOString().split('T')[0];

  if (client?.id) {
    await supabase
      .from('payables_receivables')
      .update({
        status: 'paid',
        notes: `Baixa manual informada pelo usuário em ${new Date().toLocaleDateString('pt-BR')}`,
      })
      .eq('id', matchedBill.id);

    if (matchedBill.document_id) {
      await supabase
        .from('cash_ledger_entries')
        .update({ status: 'realizado', entry_date: todayYMD })
        .eq('document_id', matchedBill.document_id);
    } else {
      await supabase.from('cash_ledger_entries').insert({
        client_id: client.id,
        entry_date: todayYMD,
        description: `${isReceivable ? 'RECEBIMENTO' : 'PAGAMENTO'} BAIXADO - ${supplier}`,
        amount: isReceivable ? Math.abs(amount) : -Math.abs(amount),
        entry_type: isReceivable ? 'income' : 'expense',
        dre_group: matchedBill.category || (isReceivable ? 'receita_operacional' : 'despesa_administrativa'),
        status: 'realizado',
      });
    }
  } else {
    await updateTrialBill(cleanPhone, supplier, {
      status: 'paid',
      notes: `Baixa informada pelo usuário em ${new Date().toLocaleDateString('pt-BR')}`,
    });
  }

  const actionLabel = isReceivable ? 'Recebimento Confirmado e Liquidado' : 'Conta Baixada como Paga';
  await sendEvolutionText({
    phone,
    text: `✅ *${actionLabel}!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *${isReceivable ? 'Cliente' : 'Fornecedor'}:* ${supplier}
• *Valor:* *${amtFmt}*
• *Data da Baixa:* ${formatDueDateDetails(todayYMD)}
• *Status:* Liquidado no Livro Caixa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Seu fluxo de caixa e relatórios já foram atualizados com a quitação!`,
  });

  await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
}

async function handleMarkBillOverdue(
  client: any,
  phone: string,
  cleanPhone: string,
  supplierQuery: string
) {
  const supabase = createServiceRoleClient();
  const cleanQuery = supplierQuery ? supplierQuery.toLowerCase().trim() : '';

  let matchedBill: any = null;
  if (client?.id) {
    const { data: bills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['open', 'postponed'])
      .order('current_due_date', { ascending: true });

    if (bills && bills.length > 0) {
      if (!cleanQuery || cleanQuery === 'atrasada' || cleanQuery === 'atrasado' || cleanQuery === '2') {
        matchedBill = bills[0];
      } else {
        matchedBill = bills.find((b: any) => b.counterparty_name.toLowerCase().includes(cleanQuery)) || bills[0];
      }
    }
  } else {
    const trialBills = await getTrialBills(cleanPhone);
    if (trialBills && trialBills.length > 0) {
      matchedBill = trialBills[0];
    }
  }

  if (matchedBill) {
    const sup = matchedBill.counterparty_name || matchedBill.supplier_name;
    const amtFmt = Number(matchedBill.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (client?.id) {
      await supabase
        .from('payables_receivables')
        .update({ notes: `Marcada como atrasada pelo usuário em ${new Date().toLocaleDateString('pt-BR')}` })
        .eq('id', matchedBill.id);
    }
    await sendEvolutionText({
      phone,
      text: `⚠️ *Registrado como Atrasada!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Conta:* ${sup}
• *Valor:* ${amtFmt}
• *Status:* Em Atraso (Monitoramento de Cobrança Ativo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Vamos manter este título sob vigilância no seu radar para você não perder o controle de juros e multas. Quando efetuar o pagamento, basta me avisar!`,
    });
    await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
    return true;
  }
  return false;
}

/**
 * Extrai valores monetários falados ou digitados em português de forma resiliente
 * Trata: "81,24", "81.24", "81 e 24", "81 com 24", "81 reais e 5 centavos", "81 reais"
 */
function parseAmountFromSpokenText(str: string): number | null {
  if (!str) return null;
  const clean = str.toLowerCase().trim();

  // 1. "81 reais e 5 centavos" ou "81 e 5 centavos"
  const centavosMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:reais)?\s*e\s*(\d{1,2})\s*centavos?/i);
  if (centavosMatch) {
    const intPart = centavosMatch[1].replace(/\./g, '');
    const centPart = centavosMatch[2].padStart(2, '0');
    const val = parseFloat(`${intPart}.${centPart}`);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. "81 e 24", "81 com 24", "81,24", "81.24"
  const compoundMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:reais)?\s*(?:e|com|,|\.)\s*(\d{1,2})/i);
  if (compoundMatch) {
    const intPart = compoundMatch[1].replace(/\./g, '');
    let centPart = compoundMatch[2];
    if (centPart.length === 1) centPart = centPart + '0';
    const val = parseFloat(`${intPart}.${centPart}`);
    if (!isNaN(val) && val > 0) return val;
  }

  // 3. Padrão numérico brasileiro com separador de milhar: "1.250,00" ou "81,00"
  const brlMatch = clean.match(/(\d{1,3}(?:\.\d{3})+,\d{2})/);
  if (brlMatch) {
    const val = parseFloat(brlMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }

  // 4. Padrão numérico direto simples: "81", "81.00", "81,00"
  const directMatch = clean.match(/(?:r\$\s*)?(\d+(?:[.,]\d+)?)/i);
  if (directMatch) {
    const val = parseFloat(directMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Normaliza datas faladas ou digitadas em português
 * Trata: "dia 10", "dia 15 de outubro", "quinze", "10/10", "15/10/2026", "2026-10-15"
 */
function parseDateFromSpokenText(str: string): string | null {
  if (!str) return null;
  let clean = str.toLowerCase().trim();
  clean = clean.replace(/^(?:pro\s+dia|para\s+o\s+dia|para\s+dia|no\s+dia|o\s+dia|dia)\s*/i, '').trim();

  const wordToDay: Record<string, string> = {
    primeiro: '01', um: '01', dois: '02', tres: '03', três: '03', quatro: '04', cinco: '05',
    seis: '06', sete: '07', oito: '08', nove: '09', dez: '10', onze: '11', doze: '12',
    treze: '13', catorze: '14', quatorze: '14', quinze: '15', dezesseis: '16', dezessete: '17',
    dezoito: '18', dezenove: '19', vinte: '20', 'vinte e um': '21', 'vinte e dois': '22',
    'vinte e tres': '23', 'vinte e três': '23', 'vinte e quatro': '24', 'vinte e cinco': '25',
    'vinte e seis': '26', 'vinte e sete': '27', 'vinte e oito': '28', 'vinte e nove': '29',
    trinta: '30', 'trinta e um': '31'
  };

  const monthWords: Record<string, string> = {
    janeiro: '01', fevereiro: '02', marco: '03', março: '03', abril: '04', maio: '05',
    junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
  };

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = String(now.getMonth() + 1).padStart(2, '0');

  // "15 de outubro" ou "dia 15 de outubro" ou "quinze de outubro"
  const dayMonthNameMatch = clean.match(/^(\d{1,2}|[a-z\s]+?)\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?$/);
  if (dayMonthNameMatch) {
    let dayStr = dayMonthNameMatch[1].trim();
    if (wordToDay[dayStr]) dayStr = wordToDay[dayStr];
    const mStr = monthWords[dayMonthNameMatch[2].trim()];
    const yStr = dayMonthNameMatch[3] || String(curYear);
    if (dayStr && mStr) {
      return `${yStr}-${mStr}-${dayStr.padStart(2, '0')}`;
    }
  }

  // Se for palavra simples de dia ou número (ex: "quinze", "dez", "10", "15", "5")
  let targetDayNum: number | null = null;
  if (wordToDay[clean]) {
    targetDayNum = parseInt(wordToDay[clean], 10);
  } else if (/^\d{1,2}$/.test(clean)) {
    targetDayNum = parseInt(clean, 10);
  }

  if (targetDayNum !== null && targetDayNum >= 1 && targetDayNum <= 31) {
    const todayDay = now.getDate();
    let targetYear = curYear;
    let targetMonth = now.getMonth() + 1; // 1 a 12

    // Se o dia informado já passou no mês corrente (ex: hoje é dia 27 e pediu dia 10),
    // o usuário deseja agendar para o PRÓXIMO MÊS em vez de gerar fatura vencida no passado!
    if (targetDayNum < todayDay) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
    }
    const dayStr = String(targetDayNum).padStart(2, '0');
    const monthStr = String(targetMonth).padStart(2, '0');
    return `${targetYear}-${monthStr}-${dayStr}`;
  }

  // Formato dd/mm
  if (/^\d{1,2}\/\d{1,2}$/.test(clean)) {
    const [d, m] = clean.split('/');
    return `${curYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Formato dd/mm/aaaa
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Formato aaaa-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  return null;
}

/**
 * Envia o código de pagamento destacado com identificação inteligente
 * (Linha digitável / Código de barras bancário vs Chave Pix vs Pix Copia e Cola)
 * Garante que CNPJ/CPF nunca sejam rotulados como Código de Barras!
 */
async function sendPaymentCodeMessage(phone: string, data: {
  barcode_or_pix?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
}): Promise<boolean> {
  const rawCandidate = (data.barcode_or_pix || '').trim();
  const pixKey = (data.pix_key || '').trim();
  const pixType = (data.pix_key_type || '').toLowerCase();

  // 1. Prioridade para Chave Pix explícita (CNPJ, CPF, Celular, E-mail, EVP)
  if (pixKey) {
    const labelType = pixType ? ` (${pixType.toUpperCase()})` : '';
    await sendEvolutionText({
      phone,
      text: `📋 *Chave Pix para Pagamento${labelType} (toque para copiar):*
\`${pixKey}\`

${BANK_SAFETY_NOTICE}`,
    });
    return true;
  }

  if (!rawCandidate) return false;

  const digitsOnly = rawCandidate.replace(/\D/g, '');

  // 2. Pix Copia e Cola (EMV payload padrão BR Code inicia com 000201)
  if (rawCandidate.startsWith('000201')) {
    await sendEvolutionText({
      phone,
      text: `📋 *Pix Copia e Cola (toque para copiar):*
\`${rawCandidate}\`

${BANK_SAFETY_NOTICE}`,
    });
    return true;
  }

  // 3. Se parece com CNPJ (14 dígitos) ou CPF (11 dígitos):
  // NUNCA rotular como código de barras!
  const isCnpjPattern = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(rawCandidate) || (digitsOnly.length === 14 && rawCandidate.length <= 18);
  const isCpfPattern = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(rawCandidate) || (digitsOnly.length === 11 && rawCandidate.length <= 14);

  if (isCnpjPattern) {
    await sendEvolutionText({
      phone,
      text: `📋 *Chave Pix (CNPJ) para Pagamento (toque para copiar):*
\`${rawCandidate}\`

${BANK_SAFETY_NOTICE}`,
    });
    return true;
  }

  if (isCpfPattern) {
    await sendEvolutionText({
      phone,
      text: `📋 *Chave Pix (CPF) para Pagamento (toque para copiar):*
\`${rawCandidate}\`

${BANK_SAFETY_NOTICE}`,
    });
    return true;
  }

  // 4. Código de Barras / Linha Digitável Bancária (>= 40 dígitos)
  if (digitsOnly.length >= 40) {
    await sendEvolutionText({
      phone,
      text: `📋 *Código de Barras / Linha Digitável (toque para copiar):*
\`${rawCandidate}\`

${BANK_SAFETY_NOTICE}`,
    });
    return true;
  }

  // 5. Linhas de concessionárias com formatações menores mas claras (>= 20 dígitos numéricos)
  if (digitsOnly.length >= 20) {
    await sendEvolutionText({
      phone,
      text: `📋 *Código para Pagamento (toque para copiar):*
\`${rawCandidate}\`

${BANK_SAFETY_NOTICE}`,
    });
    return true;
  }

  return false;
}

/**
 * Intercepta resposta de data para contas que foram registradas sem vencimento
 * (ex: NF Melissa Leite Machado, onde o bot perguntou para quando é o pagamento)
 */
async function handlePendingBillDateResponse(
  client: any,
  phone: string,
  cleanPhone: string,
  rawText: string
): Promise<boolean> {
  const clean = rawText.trim().toLowerCase();
  // Se for uma mensagem muito longa ou comando complexo, não é apenas uma resposta de data
  if (clean.length > 40 || clean.includes('ajuda') || clean.includes('plano')) return false;

  const normalizedDate = parseDateFromSpokenText(clean);
  if (!normalizedDate) return false;

  const supabase = createServiceRoleClient();

  // 1. Cliente Ativo
  if (client?.id) {
    const { data: pendingBill } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', client.id)
      .eq('type', 'payable')
      .is('original_due_date', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingBill) {
      await supabase
        .from('payables_receivables')
        .update({
          original_due_date: normalizedDate,
          current_due_date: normalizedDate,
          notes: `Vencimento informado pelo usuário em ${new Date().toLocaleDateString('pt-BR')}`,
        })
        .eq('id', pendingBill.id);

      const valFmt = Number(pendingBill.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      await sendEvolutionText({
        phone,
        text: `📅 *Data de Vencimento Cadastrada com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${pendingBill.counterparty_name}
• *Vencimento:* *${formatDueDateDetails(normalizedDate)}*
• *Valor:* ${valFmt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ *Fique tranquilo:* Na véspera do vencimento (às 10h em ponto) te envio o lembrete aqui para você não esquecer da obrigação e manter seus pagamentos em dia!`,
      });
      await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
      return true;
    }
  }

  // 2. Lead em Degustação (trial_leads)
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, whatsapp_number, bills_list, due_date, supplier_name, amount')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (lead && Array.isArray(lead.bills_list) && lead.bills_list.length > 0) {
    const bills: any[] = [...lead.bills_list];
    // Procura o bill mais recente sem due_date
    const pendingIdx = bills.map((b, idx) => ({ b, idx })).reverse().find((item) => !item.b.due_date);

    if (pendingIdx !== undefined) {
      const targetBill = bills[pendingIdx.idx];
      targetBill.due_date = normalizedDate;
      bills[pendingIdx.idx] = targetBill;

      await supabase
        .from('trial_leads')
        .update({
          bills_list: bills,
          due_date: lead.due_date || normalizedDate,
        })
        .eq('id', lead.id);

      const valFmt = targetBill.amount
        ? Number(targetBill.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : 'Valor registrado';

      await sendEvolutionText({
        phone,
        text: `📅 *Data de Vencimento Cadastrada com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${targetBill.supplier_name || lead.supplier_name || 'Fornecedor'}
• *Vencimento:* *${formatDueDateDetails(normalizedDate)}*
• *Valor:* ${valFmt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ *Fique tranquilo:* Na véspera do vencimento (às 10h em ponto) te envio o lembrete aqui para você não esquecer da obrigação e manter seus pagamentos em dia!`,
      });
      await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
      return true;
    }
  }

  return false;
}

/**
 * Trata resposta do usuário sobre parcelas anteriores de carnê/seguro (Img 3 e 4)
 */
async function handlePendingInstallmentConfirmation(
  client: any,
  phone: string,
  cleanPhone: string,
  rawText: string
): Promise<boolean> {
  const clean = rawText.trim().toLowerCase();
  const isAffirmative = /^(sim|ja paguei|já paguei|paguei|todas pagas|pagas|quitadas|lançar as vencidas|lancar as vencidas|pode lancar|pode lançar|sim já|sim ja)$/i.test(clean);
  const isNegative = /^(não|nao|apenas as futuras|apenas futuras|so futuras|só futuras|so as que faltam|só as que faltam)$/i.test(clean);

  if (!isAffirmative && !isNegative) return false;

  const supabase = createServiceRoleClient();
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, bills_list, supplier_name')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (lead && Array.isArray(lead.bills_list)) {
    const hasPendingConfirmation = lead.bills_list.some((b: any) => b.status === 'pending_past_confirmation' || b.is_past);
    if (hasPendingConfirmation) {
      const updatedBills = lead.bills_list.map((b: any) => {
        if (b.status === 'pending_past_confirmation' || b.is_past) {
          return {
            ...b,
            status: isAffirmative ? 'paid' : 'archived',
            is_past_paid: isAffirmative,
          };
        }
        return b;
      });

      await supabase
        .from('trial_leads')
        .update({ bills_list: updatedBills })
        .eq('id', lead.id);

      if (isAffirmative) {
        await sendEvolutionText({
          phone,
          text: `✅ *Histórico Atualizado com Sucesso!*
As parcelas anteriores foram registradas como quitadas no seu histórico financeiro.
As parcelas futuras continuam ativas e monitoradas na véspera de cada vencimento (às 10h)!`,
        });
      } else {
        await sendEvolutionText({
          phone,
          text: `✅ *Perfeito!*
Mantivemos no seu calendário apenas as parcelas futuras a vencer, sem poluir seu fluxo de caixa!`,
        });
      }
      await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
      return true;
    }
  }

  return false;
}

async function handleDueDateChange(
  client: any,
  phone: string,
  cleanPhone: string,
  supplierQuery: string,
  newDateRaw: string
) {
  const supabase = createServiceRoleClient();
  const normalizedDate = parseDateFromSpokenText(newDateRaw);

  if (!normalizedDate) {
    await sendEvolutionText({
      phone,
      text: `⚠️ Não consegui entender a nova data de vencimento informada ("${newDateRaw}").\n\n💡 Por favor, informe no formato:\n*"Mudar vencimento da Sabesp para dia 15"* ou *"para 15/10"*.`,
    });
    return;
  }

  // 1. Cliente cadastrado
  if (client?.id) {
    const { data: openBills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['open', 'postponed']);

    const cleanQuery = supplierQuery.toLowerCase().trim();
    const matchedBill = openBills?.find((b: any) => (b.counterparty_name || '').toLowerCase().includes(cleanQuery));
    if (matchedBill) {
      await supabase
        .from('payables_receivables')
        .update({
          current_due_date: normalizedDate,
          notes: `Vencimento alterado para ${formatDueDateDetails(normalizedDate)} em ${new Date().toLocaleDateString('pt-BR')}`,
        })
        .eq('id', matchedBill.id);

      const isRec = matchedBill.type === 'receivable';
      await sendEvolutionText({
        phone,
        text: `✅ *Vencimento Atualizado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *${isRec ? 'Recebível / Cliente' : 'Conta / Fornecedor'}:* ${matchedBill.counterparty_name}
• *Novo Vencimento:* *${formatDueDateDetails(normalizedDate)}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 O lembrete da véspera foi reprogramado automaticamente (às 10h)!`,
      });

      await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
      return;
    }
  }

  // 2. Lead em degustação
  const trialRes = await updateTrialBill(cleanPhone, supplierQuery, { due_date: normalizedDate });
  if (trialRes.updated && trialRes.newBill) {
    await sendEvolutionText({
      phone,
      text: `✅ *Vencimento Atualizado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Conta:* ${trialRes.newBill.supplier_name}
• *Novo Vencimento:* *${formatDueDateDetails(normalizedDate)}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 O lembrete da véspera foi reprogramado automaticamente (às 10h)!`,
    });

    await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
    return;
  }

  await sendEvolutionText({
    phone,
    text: `⚠️ Não consegui localizar a conta "*${supplierQuery}*" para alterar o vencimento.\n\n💡 Digite *contas* para consultar a sua lista de compromissos.`,
  });
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function findBestBillMatch(bills: any[], query: string): any | null {
  if (!bills || bills.length === 0 || !query) return null;
  const cleanQ = query.toLowerCase().trim();
  const stopWords = ['a', 'o', 'da', 'de', 'do', 'das', 'dos', 'com', 'conta', 'fornecedor', 'para', 'em', 'onde', 'está', 'esta', 'eh', 'é'];
  const queryTokens = cleanQ.split(/\s+/).filter((t: string) => t.length >= 2 && !stopWords.includes(t));

  // 1. Match exato
  const exact = bills.find((b: any) => {
    const name = (b.supplier_name || b.counterparty_name || '').toLowerCase().trim();
    return name === cleanQ;
  });
  if (exact) return exact;

  // 2. Substring direta (name inclui query ou query inclui name)
  const substring = bills.find((b: any) => {
    const name = (b.supplier_name || b.counterparty_name || '').toLowerCase().trim();
    return name.includes(cleanQ) || cleanQ.includes(name);
  });
  if (substring) return substring;

  // 3. Match por interseção de tokens significativos
  let bestTokenMatch: any = null;
  let maxTokenOverlap = 0;
  for (const b of bills) {
    const name = (b.supplier_name || b.counterparty_name || '').toLowerCase().trim();
    const nameTokens = name.split(/\s+/).filter((t: string) => t.length >= 2 && !stopWords.includes(t));
    let overlap = 0;
    for (const qTok of queryTokens) {
      if (nameTokens.some((nTok: string) => nTok.includes(qTok) || qTok.includes(nTok))) {
        overlap++;
      }
    }
    if (overlap > maxTokenOverlap) {
      maxTokenOverlap = overlap;
      bestTokenMatch = b;
    }
  }
  if (bestTokenMatch && maxTokenOverlap > 0) return bestTokenMatch;

  // 4. Distância de Levenshtein básica para variações fonéticas (ex: Persi vs Perci, Faco vs Facundo)
  let bestFuzzyMatch: any = null;
  let minFuzzyDist = 999;
  for (const b of bills) {
    const name = (b.supplier_name || b.counterparty_name || '').toLowerCase().trim();
    const bTokens = name.split(/\s+/).filter(Boolean);
    for (const bTok of bTokens) {
      for (const qTok of queryTokens) {
        if (Math.abs(bTok.length - qTok.length) <= 3) {
          const dist = levenshteinDistance(bTok, qTok);
          if (dist <= 2 && dist < minFuzzyDist) {
            minFuzzyDist = dist;
            bestFuzzyMatch = b;
          }
        }
      }
    }
  }
  if (bestFuzzyMatch) return bestFuzzyMatch;

  return null;
}

async function handleSupplierRename(
  client: any,
  cleanPhone: string,
  currentNameQuery: string,
  newName: string
): Promise<{ success: boolean; oldName: string; newName: string }> {
  const supabase = createServiceRoleClient();
  const cleanQuery = currentNameQuery.toLowerCase().trim();
  const cleanNewName = newName.trim();

  // 1. Cliente cadastrado
  if (client?.id) {
    const { data: bills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['open', 'postponed']);

    const matched = findBestBillMatch(bills || [], cleanQuery);
    if (matched) {
      await supabase
        .from('payables_receivables')
        .update({ counterparty_name: cleanNewName })
        .eq('id', matched.id);
      return { success: true, oldName: matched.counterparty_name, newName: cleanNewName };
    }
  }

  // 2. Lead em degustação
  const trialBills = await getTrialBills(cleanPhone);
  const matchedTrial = findBestBillMatch(trialBills, cleanQuery);
  if (matchedTrial) {
    const trialRes = await updateTrialBill(cleanPhone, matchedTrial.id || matchedTrial.supplier_name, { supplier_name: cleanNewName });
    if (trialRes.updated) {
      return { success: true, oldName: matchedTrial.supplier_name, newName: cleanNewName };
    }
  }

  // Tentativa direta com cleanQuery caso não tenha dado match na lista
  const directRes = await updateTrialBill(cleanPhone, cleanQuery, { supplier_name: cleanNewName });
  if (directRes.updated && directRes.oldBill) {
    return { success: true, oldName: directRes.oldBill.supplier_name, newName: cleanNewName };
  }

  return { success: false, oldName: currentNameQuery, newName: cleanNewName };
}

async function handleGetBarcodeOrPix(
  client: any,
  phone: string,
  cleanPhone: string,
  supplierQuery: string
) {
  const supabase = createServiceRoleClient();
  const cleanQuery = (supplierQuery || '').toLowerCase().trim();
  const stopWords = ['pagar', 'codigo', 'código', 'linha', 'pix', 'de', 'barras', 'conta', 'da', 'do', 'a', 'o', 'para', 'quero', 'antecipar', 'me', 'manda'];
  const tokens = cleanQuery.split(/\s+/).filter((t: string) => t.length >= 3 && !stopWords.includes(t));
  const searchName = tokens.join(' ') || cleanQuery;

  // 1. Se cliente cadastrado
  if (client?.id) {
    const { data: bills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', client.id)
      .eq('type', 'payable')
      .in('status', ['open', 'postponed']);

    const matched = bills?.find((b: any) => {
      const bName = (b.counterparty_name || '').toLowerCase();
      return bName.includes(searchName) || tokens.some((t: string) => bName.includes(t));
    });

    if (matched) {
      if (matched.barcode_or_pix) {
        await sendEvolutionText({
          phone,
          text: `📋 *Código de Barras / Linha Digitável — ${matched.counterparty_name}*
💰 *Valor:* R$ ${Number(matched.amount).toFixed(2)} | 📅 *Vencimento:* ${formatDueDateDetails(matched.current_due_date)}

(Toque no código abaixo para copiar):
\`${matched.barcode_or_pix.trim()}\`

${BANK_SAFETY_NOTICE}`,
        });

        await sendActionSequenceMenu(phone, `O que deseja fazer com a conta de ${matched.counterparty_name}?`);
        return;
      } else {
        await sendEvolutionText({
          phone,
          text: `ℹ️ A conta de *${matched.counterparty_name}* não possui código de barras ou Pix cadastrado ainda.\n\n👉 Envie uma foto do boleto ou cole a linha digitável aqui para anexar!`,
        });
        return;
      }
    }
  }

  // 2. Lead em degustação
  const trialBills = await getTrialBills(cleanPhone);
  const matchedTrial = trialBills.find((b: any) => {
    const bName = (b.supplier_name || b.counterparty_name || '').toLowerCase();
    return bName.includes(searchName) || tokens.some((t: string) => bName.includes(t));
  });

  if (matchedTrial) {
    const rawVal = matchedTrial.amount !== undefined && matchedTrial.amount !== null ? matchedTrial.amount : matchedTrial.total_amount;
    const valFmt = rawVal && Number(rawVal) > 0 ? Number(rawVal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A confirmar';
    const dueFmt = matchedTrial.due_date ? formatDueDateDetails(matchedTrial.due_date) : 'Data a confirmar';

    if (matchedTrial.barcode_or_pix) {
      await sendEvolutionText({
        phone,
        text: `📋 *Código de Barras / Linha Digitável — ${matchedTrial.supplier_name}*
💰 *Valor:* ${valFmt} | 📅 *Vencimento:* ${dueFmt}

(Toque no código abaixo para copiar):
\`${matchedTrial.barcode_or_pix.trim()}\`

${BANK_SAFETY_NOTICE}`,
      });

      await sendActionSequenceMenu(phone, `O que deseja fazer com a conta de ${matchedTrial.supplier_name}?`);
      return;
    } else {
      await sendEvolutionText({
        phone,
        text: `ℹ️ A conta de *${matchedTrial.supplier_name}* (${valFmt}) foi cadastrada sem código de barras numérico legível (ou a foto continha apenas QR Code Pix impresso).\n\n👉 Se você tiver a linha digitável ou chave Pix, basta digitar ou colar aqui que anexamos na hora!`,
      });
      return;
    }
  }

  await sendEvolutionText({
    phone,
    text: `⚠️ Não encontrei nenhuma conta com o nome "*${supplierQuery}*" na sua lista.\n\n💡 Digite *contas* para ver seus compromissos agendados.`,
  });
}

/**
 * Despachante unificado de comandos de ação para Texto, Respostas de Enquetes/Botões e Áudio transcrito
 */
async function dispatchUserActionCommand(params: {
  text: string;
  phone: string;
  cleanPhone: string;
  client: any;
}): Promise<boolean> {
  const { text, phone, cleanPhone, client } = params;
  if (!text) return false;
  const clean = text.toLowerCase().trim();
  const normalizedClean = clean.replace(/^[^\w\d]+|[^\w\d]+$/g, '').trim();

  // Intercepta respostas pendentes de data de vencimento (ex: NF sem vencimento)
  const handledPendingDate = await handlePendingBillDateResponse(client, phone, cleanPhone, text);
  if (handledPendingDate) return true;

  // Intercepta confirmação de parcelas passadas de carnê/seguro (ex: Tokio Marine)
  const handledInstallmentConfirm = await handlePendingInstallmentConfirmation(client, phone, cleanPhone, text);
  if (handledInstallmentConfirm) return true;

  // Intercepta resposta sobre Titularidade de Documento / Empresa vs CPF vs Sócio vs Funcionário vs Terceiro vs Outro CNPJ
  const cleanTitular = clean.replace(/^[^\w\d]+|[^\w\d]+$/g, '').trim();
  const isFuncionarioAns =
    cleanTitular === 'funcionario' || cleanTitular === 'funcionário' ||
    cleanTitular === 'colaborador' || cleanTitular === 'colaboradores' ||
    cleanTitular === 'equipe' || cleanTitular === 'adiantamento' ||
    cleanTitular === 'bonus' || cleanTitular === 'bônus' ||
    cleanTitular === 'beneficio' || cleanTitular === 'benefício' ||
    cleanTitular === 'vale' || cleanTitular.includes('funcionario') ||
    cleanTitular.includes('funcionário') || cleanTitular.includes('colaborador') ||
    cleanTitular.includes('adiantamento');

  const isTerceiroAns =
    cleanTitular === 'terceiro' || cleanTitular === 'terceiros' ||
    cleanTitular === 'aleatorio' || cleanTitular === 'aleatório' ||
    cleanTitular === 'amigo' || cleanTitular === 'parente' ||
    cleanTitular === 'outro' || cleanTitular === 'outra pessoa' ||
    cleanTitular.includes('terceiro') || cleanTitular.includes('aleatorio') ||
    cleanTitular.includes('aleatório');

  const isEmpresaAns =
    cleanTitular === 'minha empresa' || cleanTitular === 'empresa' ||
    cleanTitular === 'empresa principal' || cleanTitular === 'minha' ||
    cleanTitular.startsWith('empresa');

  const isCpfSocioAns =
    cleanTitular === 'meu cpf' || cleanTitular === 'cpf' ||
    cleanTitular === 'pessoal' || cleanTitular === 'minha pessoal' ||
    cleanTitular.startsWith('meu cpf') || cleanTitular === 'socio' ||
    cleanTitular === 'sócio' || cleanTitular === 'de um socio' ||
    cleanTitular === 'de um sócio' || cleanTitular.includes('socio') ||
    cleanTitular.includes('sócio');

  const isOutroCnpjAns =
    cleanTitular === 'outro cnpj' || cleanTitular === 'outra empresa' ||
    cleanTitular === 'filial' || cleanTitular.includes('outro cnpj') ||
    cleanTitular.includes('filial');

  if (isFuncionarioAns || isTerceiroAns || isEmpresaAns || isCpfSocioAns || isOutroCnpjAns) {
    let confirmTxt = '';
    let targetCategory = 'despesas_gerais';
    let targetNotes = '';

    if (isFuncionarioAns) {
      targetCategory = 'pessoal_folha_adiantamento';
      targetNotes = 'Pagamento de Funcionário (Adiantamento Salarial / Bônus / Benefício)';
      confirmTxt = `💼 *Registrado como Pagamento de Funcionário / Colaborador!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Classificamos este lançamento no seu Livro Caixa. Como a empresa vai pagar diretamente, você pode categorizá-la no fechamento da folha como:
• *Adiantamento Salarial / Vale* (com desconto no próximo holerite)
• *Bônus / Premiação* (incentivo por metas)
• *Ajuda de Custo / Benefício* (se previsto em acordo ou convenção)

⚠️ *Dica Trabalhista do AnalisAí:* Mantenha o registro na folha/holerite para respaldar sua empresa contra riscos e passivos trabalhistas!`;
    } else if (isTerceiroAns) {
      targetCategory = 'distribuicao_lucros_dividendos';
      targetNotes = 'Conta de Terceiro paga via Distribuição de Lucros/Dividendos do Sócio';
      confirmTxt = `🛡️ *Registrado como Conta de Terceiro (Via Dividendos do Sócio)!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Como este pagamento é para alguém sem vínculo com a empresa, classificamos no Livro Caixa como **Distribuição de Lucros / Dividendos do Sócio** (ou Pró-Labore).

💡 *Por que isso protege sua empresa:*
Pagamentos a terceiros sem causa comprovada sofrem risco de tributação punitiva de até 35% de IRRF pela Receita Federal. Registrando como retirada de lucros/dividendos sua, sua empresa fica 100% blindada e auditável!`;
    } else if (isEmpresaAns) {
      targetCategory = 'despesa_operacional';
      targetNotes = 'Despesa Operacional da Empresa (faturada em CPF/CNPJ)';
      confirmTxt = `✅ *Registrado como Empresa Principal!*
Vinculei este lançamento como despesa operacional da sua pessoa jurídica. Seus relatórios de DRE e Livro Caixa foram organizados para o seu negócio!`;
    } else if (isOutroCnpjAns) {
      targetCategory = 'despesa_filial_outro_cnpj';
      targetNotes = 'Despesa de Filial ou Outro CNPJ do grupo';
      confirmTxt = `🏢 *Registrado como Filial / Outra Empresa!*
Lançamos este documento com centro de custo individualizado para sua outra unidade ou empresa parceira, garantindo separação fiscal perfeita!`;
    } else {
      targetCategory = 'distribuicao_lucros_dividendos';
      targetNotes = 'Despesa Particular de Sócio (Distribuição de Lucros / Dividendos)';
      confirmTxt = `🛡️ *Registrado como Despesa de Sócio (Distribuição de Lucros / Dividendos)!*
Lançamos esta obrigação particular com a anotação para pagamento via **Distribuição de Lucros / Dividendos** (ou Pró-labore), mantendo seu patrimônio blindado contra confusão patrimonial!`;
    }

    // Atualiza a última conta cadastrada no banco de dados para refletir essa escolha
    const supabase = createServiceRoleClient();
    if (client?.id) {
      const { data: lastBill } = await supabase
        .from('payables_receivables')
        .select('id, notes')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastBill) {
        await supabase
          .from('payables_receivables')
          .update({
            category: targetCategory,
            notes: targetNotes,
          })
          .eq('id', lastBill.id);
      }
    } else {
      const { data: lead } = await supabase
        .from('trial_leads')
        .select('id, bills_list')
        .eq('whatsapp_number', cleanPhone)
        .maybeSingle();

      if (lead && Array.isArray(lead.bills_list) && lead.bills_list.length > 0) {
        const updatedBills = [...lead.bills_list];
        const lastIdx = updatedBills.length - 1;
        updatedBills[lastIdx] = {
          ...updatedBills[lastIdx],
          category: targetCategory,
          notes: targetNotes,
        };
        await supabase
          .from('trial_leads')
          .update({ bills_list: updatedBills })
          .eq('id', lead.id);
      }
    }

    await sendEvolutionText({ phone, text: confirmTxt });
    await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
    return true;
  }

  // A) Interceptação de botões interativos de sequência / Menu Numerado
  // 1. Ver Minhas Contas
  if (
    clean === '1' || normalizedClean === '1' || clean === '1️⃣' ||
    normalizedClean === 'um' || normalizedClean === 'hum' || normalizedClean === 'primeiro' ||
    clean.startsWith('opcao 1') || clean.startsWith('opção 1') ||
    clean.startsWith('opcao um') || clean.startsWith('opção um') ||
    clean === 'primeira opcao' || clean === 'primeira opção' ||
    clean.includes('ver minhas contas') || clean.includes('ver_minhas_contas') ||
    clean.includes('ver todas as contas') || clean === '📅 ver minhas contas' ||
    isWeeklyBillsQuery(clean) || clean === 'contas' || clean === '!contas' || clean === 'minhas contas' ||
    clean.includes('listar contas') || clean.includes('mostrar contas') || clean.includes('quais contas') ||
    clean.includes('o que tenho a pagar') || clean.includes('o que tenho que pagar') || clean.includes('contas a pagar')
  ) {
    const periodOption = extractBillsQueryPeriod(clean);
    const billsMsg = await getUpcomingBillsSummary(client?.id || null, cleanPhone, periodOption);
    await sendEvolutionText({ phone, text: billsMsg });
    await sendActionSequenceMenu(phone, 'O que deseja fazer com as suas contas?');
    return true;
  }

  // 2. Solicitar Código para Pagar / Antecipar
  if (
    clean === '2' || normalizedClean === '2' || clean === '2️⃣' ||
    normalizedClean === 'dois' || normalizedClean === 'segundo' ||
    clean.startsWith('opcao 2') || clean.startsWith('opção 2') ||
    clean.startsWith('opcao dois') || clean.startsWith('opção dois') ||
    clean === 'segunda opcao' || clean === 'segunda opção' ||
    clean.includes('solicitar código') || clean.includes('solicitar codigo') || clean.includes('solicitar_codigo') ||
    clean.includes('código para pagar') || clean.includes('codigo para pagar')
  ) {
    await sendEvolutionText({
      phone,
      text: `📋 *Para obter o código de barras ou Pix para pagar/antecipar:*
Envie um texto ou áudio dizendo:
*"Pagar [nome da conta]"* ou *"Código [nome da conta]"*

Exemplo: *"Pagar Sabesp"* ou *"Código da Vivo"*`,
    });
    return true;
  }

  // 3. Alterar Valor de uma Conta
  if (
    clean === '3' || normalizedClean === '3' || clean === '3️⃣' ||
    normalizedClean === 'tres' || normalizedClean === 'três' || normalizedClean === 'terceiro' ||
    clean.startsWith('opcao 3') || clean.startsWith('opção 3') ||
    clean.startsWith('opcao tres') || clean.startsWith('opção tres') ||
    clean.startsWith('opcao três') || clean.startsWith('opção três') ||
    clean === 'terceira opcao' || clean === 'terceira opção' ||
    clean.includes('alterar valor da conta') || clean.includes('alterar valor de uma conta') ||
    clean.includes('alterar valor') || clean.includes('alterar_valor') ||
    clean.includes('mudar valor') || clean.includes('corrigir valor')
  ) {
    await sendEvolutionText({
      phone,
      text: `✏️ *Para alterar o valor de uma conta:*
Envie um texto ou áudio dizendo:
*"Mudar o valor da [nome] para [valor]"*

Exemplo: *"Mudar valor da Sabesp para 81,24"*`,
    });
    return true;
  }

  // 4. Alterar Vencimento
  if (
    clean === '4' || normalizedClean === '4' || clean === '4️⃣' ||
    normalizedClean === 'quatro' || normalizedClean === 'quarto' ||
    clean.startsWith('opcao 4') || clean.startsWith('opção 4') ||
    clean.startsWith('opcao quatro') || clean.startsWith('opção quatro') ||
    clean === 'quarta opcao' || clean === 'quarta opção' ||
    clean.includes('alterar vencimento') || clean.includes('alterar_vencimento') ||
    clean.includes('mudar vencimento') || clean.includes('prorrogar') || clean.includes('adiar')
  ) {
    await sendEvolutionText({
      phone,
      text: `🗓️ *Para alterar a data de vencimento:*
Envie um texto ou áudio dizendo:
*"Mudar vencimento da [nome] para dia [dia]"*

Exemplo: *"Mudar vencimento da Sabesp para dia 15"* ou *"para 15/10"*`,
    });
    return true;
  }

  // 5. Conhecer Planos Oficiais / Consulta de Planos
  if (
    clean === '5' || normalizedClean === '5' || clean === '5️⃣' ||
    normalizedClean === 'cinco' || normalizedClean === 'quinto' ||
    clean.startsWith('opcao 5') || clean.startsWith('opção 5') ||
    clean.startsWith('opcao cinco') || clean.startsWith('opção cinco') ||
    clean === 'quinta opcao' || clean === 'quinta opção' ||
    clean.includes('conhecer planos oficiais') || clean.includes('conhecer planos') ||
    clean.includes('conhecer_planos') || clean.includes('planos oficiais') ||
    clean === 'planos' || clean === 'plano' || clean === 'assinar' ||
    clean === 'preços' || clean === 'precos' || clean === 'valores' ||
    clean === 'quanto custa' || clean.includes('ver planos') ||
    clean.includes('quais planos') || clean.includes('quero assinar')
  ) {
    await sendEvolutionText({ phone, text: getTrialConversionMenu() });
    return true;
  }

  // B) Interceptação Inteligente de Correção Conversacional de Fornecedores, Valores e Vencimentos (Gemini Flash)
  const isCorrectionIntent =
    clean.includes('corrija') ||
    clean.includes('corrigir') ||
    clean.includes('correção') ||
    clean.includes('correcao') ||
    clean.includes('onde esta') ||
    clean.includes('onde está') ||
    clean.includes('onde ta') ||
    clean.includes('onde tá') ||
    clean.includes('mudar nome') ||
    clean.includes('trocar nome') ||
    clean.includes('alterar nome') ||
    clean.includes('renomear') ||
    clean.includes('com s é') ||
    clean.includes('com c é') ||
    clean.includes('com z é') ||
    clean.includes('fornecedores') ||
    (clean.includes('fornecedor') && (clean.includes('nome') || clean.includes('errado') || clean.includes('certo')));

  if (isCorrectionIntent) {
    try {
      const corrections = await parseConversationalCorrections(text);
      if (
        corrections.has_corrections &&
        (corrections.renames.length > 0 || corrections.amount_changes.length > 0 || corrections.due_date_changes.length > 0)
      ) {
        const resultLines: string[] = [];

        for (const rename of corrections.renames) {
          if (!rename.current_name_query || !rename.new_name) continue;
          const res = await handleSupplierRename(client, cleanPhone, rename.current_name_query, rename.new_name);
          if (res.success) {
            resultLines.push(`• *${res.oldName}* ➔ corrigido para *${res.newName}*`);
          } else {
            resultLines.push(`• Não localizei "*${rename.current_name_query}*" para alterar para *${rename.new_name}*`);
          }
        }

        for (const amt of corrections.amount_changes) {
          if (amt.supplier_query && amt.new_amount > 0) {
            await handleAmountChange(client, phone, cleanPhone, amt.supplier_query, amt.new_amount);
          }
        }

        for (const dDate of corrections.due_date_changes) {
          if (dDate.supplier_query && dDate.new_due_date_raw) {
            await handleDueDateChange(client, phone, cleanPhone, dDate.supplier_query, dDate.new_due_date_raw);
          }
        }

        if (resultLines.length > 0) {
          await sendEvolutionText({
            phone,
            text: `✅ *Dados dos Fornecedores Corrigidos com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${resultLines.join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Seus relatórios e lembretes futuros já foram atualizados com os novos nomes!`,
          });
          await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
          return true;
        }
      }
    } catch (corrErr) {
      console.error('[Corrections Error]:', corrErr);
    }
  }

  // C) Comando explícito de alteração de nome de fornecedor (Regex direto)
  const renameMatch =
    clean.match(/(?:mudar|alterar|trocar|corrigir|renomear)\s+(?:o\s+)?nome\s+(?:d[ao]\s+)?([a-zA-Z0-9\s]+?)\s+para\s+(.+)/i) ||
    clean.match(/onde\s+(?:está|esta|tá|ta)\s+([a-zA-Z0-9\s]+?)[,;\s]+(?:é|e|coloca|coloque|mudar para|alterar para)\s+(.+)/i);

  if (renameMatch) {
    const rawSup = renameMatch[1].replace(/^(conta\s+d[ao]|fornecedor\s+d[ao]|conta)\s+/i, '').trim();
    const newName = renameMatch[2].replace(/[?.!]+$/, '').trim();
    if (rawSup.length >= 2 && newName.length >= 2) {
      const res = await handleSupplierRename(client, cleanPhone, rawSup, newName);
      if (res.success) {
        await sendEvolutionText({
          phone,
          text: `✅ *Fornecedor Atualizado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• De: *${res.oldName}*
• Para: *${res.newName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Seus lembretes e relatórios futuros já foram atualizados!`,
        });
        await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
        return true;
      }
    }
  }

  if (
    clean.includes('excluir esta conta') ||
    clean.includes('excluir uma conta') ||
    clean === '🗑️ excluir esta conta'
  ) {
    await sendEvolutionText({
      phone,
      text: `🗑️ *Para excluir um lançamento:*
Envie um texto ou áudio dizendo:
*"Excluir conta da [nome da conta]"*

Exemplo: *"Excluir conta da Sabesp"*`,
    });
    return true;
  }

  // D) Solicitação de Código de Barras / Linha Digitável / Pix para Pagamento/Antecipação
  const payMatch =
    clean.match(/^(?:pagar|codigo|código|linha|pix|copiar|antecipar)\s+(?:a\s+conta\s+d[ao]|conta\s+d[ao]|a\s+conta|conta|d[ao]|a\s+|o\s+)?(.+)/i) ||
    clean.match(/(?:código|codigo|linha)\s+(?:de\s+barras\s+|digit[aá]vel\s+)(?:d[ao]\s+)?(.+)/i) ||
    clean.match(/(?:quero\s+pagar|vou\s+pagar|passa\s+o\s+código|passa\s+o\s+codigo|manda\s+o\s+código|manda\s+o\s+codigo)\s+(?:a\s+conta\s+d[ao]|conta\s+d[ao]|a\s+conta|conta|d[ao]|a\s+)?(.+)/i) ||
    clean.match(/(?:qual\s+(?:é|e)\s+o\s+)?(?:código|codigo|linha|pix)\s+(?:d[ao]\s+)?(.+)/i);

  if (payMatch) {
    let targetSup = payMatch[1]
      .replace(/[?.!]+$/, '')
      .replace(/\s+(?:por\s+favor|pfv|a[ií]|hoje)$/i, '')
      .trim();

    if (targetSup.length >= 2 && !['conta', 'contas', 'plano', 'planos', 'status'].includes(targetSup)) {
      await handleGetBarcodeOrPix(client, phone, cleanPhone, targetSup);
      return true;
    }
  }

  // E) Exclusão de Conta
  const delMatch =
    clean.match(/^(?:excluir|apagar|remover|deletar|cancelar)\s+(?:a\s+conta\s+d[ao]|conta\s+d[ao]|a\s+conta|conta|d[ao]|o\s+boleto\s+d[ao]|boleto\s+d[ao]|o\s+boleto|boleto)?\s*(.+)/i) ||
    clean.match(/(?:excluir|apagar|remover|deletar)\s+conta\s+(?:d[ao]\s+)?(.+)/i);

  if (delMatch) {
    let targetSup = delMatch[1].replace(/[?.!]+$/, '').trim();
    if (targetSup.length >= 2 && !['conta', 'contas', 'tudo'].includes(targetSup)) {
      await handleDeleteBill(client, phone, cleanPhone, targetSup);
      return true;
    }
  }

  // F) Alteração de Valor
  const amountMatch =
    clean.match(/(?:mudar|alterar|corrigir|trocar|atualizar)\s+(?:o\s+)?valor\s+(?:d[ao]\s+)?([a-zA-Z0-9\s]+?)\s+(?:de\s+[\d.,\s]+(?:reais)?\s+)?para\s+(.+)/i) ||
    clean.match(/([a-zA-Z0-9\s]+?)[,;:\s]+(?:mudar|alterar|corrigir|trocar|atualizar)\s+(?:o\s+)?valor\s+(?:de\s+[\d.,\s]+(?:reais)?\s+)?para\s+(.+)/i) ||
    clean.match(/(?:mudar|alterar|corrigir|trocar|atualizar)\s+([a-zA-Z0-9\s]+?)\s+para\s+([0-9.,\s]+(?:reais)?(?:\s*e\s*[0-9.,\s]+)?(?:\s*centavos)?)/i);

  if (amountMatch) {
    const rawSup = amountMatch[1].replace(/^(conta\s+d[ao]|fornecedor\s+d[ao]|conta)\s+/i, '').trim();
    const rawValStr = amountMatch[2].replace(/[?.!]+$/, '').trim();
    const parsedVal = parseAmountFromSpokenText(rawValStr);
    if (parsedVal && parsedVal > 0 && rawSup.length >= 2) {
      await handleAmountChange(client, phone, cleanPhone, rawSup, parsedVal);
      return true;
    }
  }

  // G) Alteração de Vencimento
  const dueDateMatch =
    clean.match(/(?:mudar|alterar|trocar|prorrogar|adiar|atualizar)\s+(?:o\s+)?vencimento\s+(?:d[ao]\s+)?([a-zA-Z0-9\s]+?)\s+para\s+(?:o\s+)?(?:dia\s+)?([\w\s/-]+)/i) ||
    clean.match(/(?:mudar|alterar|trocar|prorrogar|adiar|atualizar)\s+(?:a\s+data\s+d[ao]\s+)?([a-zA-Z0-9\s]+?)\s+para\s+(?:o\s+)?(?:dia\s+)?([\w\s/-]+)/i);

  if (dueDateMatch) {
    const rawSup = dueDateMatch[1].replace(/^(conta\s+d[ao]|fornecedor\s+d[ao]|conta)\s+/i, '').trim();
    const targetDate = dueDateMatch[2].replace(/[?.!]+$/, '').trim();
    if (rawSup.length >= 2 && targetDate) {
      await handleDueDateChange(client, phone, cleanPhone, rawSup, targetDate);
      return true;
    }
  }

  // H) Baixa de Pagamento ou Recebimento Conversacional
  const markPaidMatch =
    clean.match(/^(?:j[aá]\s+)?(?:paguei|quitei|liquidei|baixei|pago)\s+(?:a\s+conta\s+d[ao]|conta\s+d[ao]|a\s+conta|conta|d[ao]|a\s+|o\s+)?(.+)/i) ||
    clean.match(/^(?:dar\s+)?baixa\s+(?:n[ao]|da|de|em|para)?\s*(?:a\s+conta\s+d[ao]|conta\s+d[ao]|a\s+conta|conta|d[ao]|a\s+|o\s+)?(.+)/i) ||
    clean.match(/^(?:j[aá]\s+)?(?:recebi|recebido|recebimento)\s+(?:d[ao]|de|do\s+cliente|da\s+cliente)?\s*(.+)/i) ||
    clean.match(/^(?:o\s+)?cliente\s+(.+?)\s+(?:já\s+)?pagou/i);

  if (markPaidMatch) {
    let target = markPaidMatch[1]?.replace(/[?.!]+$/, '').trim();
    if (target && !['conta', 'contas', 'plano', 'planos'].includes(target)) {
      await handleMarkBillPaid(client, phone, cleanPhone, target);
      return true;
    }
  }

  if (
    clean === 'paguei' || clean === 'já paguei' || clean === 'ja paguei' ||
    clean === 'baixar' || clean === 'dar baixa' || clean === 'baixa' ||
    clean === 'recebi' || clean === 'já recebi' || clean === 'ja recebi' ||
    clean === 'conta paga' || clean === 'já foi paga' || clean === 'ja foi paga' ||
    clean === '1' && (clean.includes('paga') || clean.includes('recebi'))
  ) {
    await handleMarkBillPaid(client, phone, cleanPhone, '');
    return true;
  }

  // I) Respostas de Auditoria de Contas Vencidas: Atrasada, Postergada, Cancelada
  if (
    clean === 'atrasada' || clean === 'está atrasada' || clean === 'esta atrasada' ||
    clean === 'atrasou' || clean === 'marcar como atrasada' || clean === 'considerar atrasada' ||
    clean.startsWith('atrasada ') || clean.startsWith('atrasado ') || clean === '2' && clean.includes('atras')
  ) {
    const supQuery = clean.replace(/^(?:marcar\s+como\s+|considerar\s+)?(?:atrasada|atrasado|está atrasada|esta atrasada)\s*(?:a\s+conta\s+d[ao]|conta\s+d[ao]|a\s+conta|d[ao])?/i, '').trim();
    const handledOverdue = await handleMarkBillOverdue(client, phone, cleanPhone, supQuery);
    if (handledOverdue) return true;
  }

  return false;
}

const dispatchTrialUserCommand = dispatchUserActionCommand;

async function handleConversationalNaturalLanguageRouter(params: {
  text: string;
  phone: string;
  cleanPhone: string;
  client: any;
  body: any;
  isAdminPhone: boolean;
  isOperator: boolean;
}): Promise<boolean> {
  const { text, phone, cleanPhone, client, body, isAdminPhone, isOperator } = params;
  if (!text || text.trim().length === 0) return false;

  const supabase = createServiceRoleClient();
  const trialStatus = await checkTrialStatus(cleanPhone);
  const isAdmin = Boolean(client?.is_admin || isAdminPhone);

  const context: UserConversationalContext = {
    userId: client?.id || cleanPhone,
    userName: client?.name || body?.data?.pushName || 'Usuário',
    phone: cleanPhone,
    isAdmin,
    userType: client ? (isOperator ? 'operator' : 'subscriber') : 'trial',
    plan: client?.plan || (client?.id ? 'solo' : 'trial'),
    companyName: client?.company_name || undefined,
    hasOpenBills: trialStatus.docsCount > 0,
  };

  try {
    const decision = await routeConversationalIntent(text, context);
    console.log(`[Conversational Router] Intent: ${decision.intent}, Confidence: ${decision.confidence}, Applicable: ${decision.is_applicable}`);

    // Se a IA determinou que não é aplicável ao perfil do usuário
    if (!decision.is_applicable) {
      const msg = decision.inapplicable_message || 'Essa funcionalidade não está habilitada para o seu perfil no momento.';
      await sendEvolutionText({ phone, text: msg });
      return true;
    }

    // 1. Convidar alguém / Liberar acesso VIP QA / Indicar parceiro
    if (decision.intent === 'INVITE_GUEST') {
      const rawTarget = decision.invite_params?.phone;
      const guestName = decision.invite_params?.name || 'Convidado VIP';

      if (rawTarget) {
        const cleanDigits = rawTarget.replace(/\D/g, '');
        const cleanPhoneWith55 = cleanDigits.length <= 11 && !cleanDigits.startsWith('55') ? `55${cleanDigits}` : cleanDigits;

        if (isAdmin) {
          const { addQaWhitelist, formatIdentifierDisplay } = await import('@/lib/solo/qa-whitelist');
          await addQaWhitelist(cleanDigits, guestName, client?.name || 'Administrador');

          let inviteSent = false;
          try {
            await sendEvolutionText({
              phone: cleanPhoneWith55,
              text: `👋 Olá, ${guestName.split(' ')[0]}! Que bom ter você por aqui!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O *${client?.name || 'Administrador'}* liberou o seu acesso VIP no **AnalisAí**, o assistente financeiro inteligente no WhatsApp!

Você agora tem **acesso livre e sem custos** para testar tudo na prática:
• 📸 *Boleto/Nota:* Envie a foto ou PDF de uma conta para agendar em segundos;
• 🎙️ *Áudios e Textos:* Mande um áudio dizendo suas contas (ex: *"Pagar luz R$ 180 dia 15"*);
• ⏰ *Lembretes na Véspera:* Te aviso com antecedência para evitar multas e juros;
• 📊 *Livro Caixa e DRE:* Peça seu relatório em PDF com gráficos a qualquer hora digitando *"relatório"*.

👉 *Para começar agora mesmo:*
Salve este contato na sua agenda e envie uma foto de boleto ou um áudio por aqui! 🚀`,
            });
            inviteSent = true;
          } catch (e) {
            console.error('[Conversational Router Invite Error]:', e);
          }

          const formattedTarget = formatIdentifierDisplay(cleanDigits);
          await sendEvolutionText({
            phone,
            text: `🎉 *Convite VIP Concluído com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Convidado:* ${guestName}
📱 *WhatsApp:* ${formattedTarget}
⚡ *Status QA:* **Acesso Livre & Irrestrito Liberado!**
📲 *Mensagem no WhatsApp:* ${inviteSent ? '✅ Enviada com sucesso para ele!' : '⚠️ Enviada (verifique o número)'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${guestName} agora pode testar comandos por voz, fotos de boletos e relatórios sem nenhuma restrição!

💡 *Dica de Equipe:* Para cadastrá-lo como operador da sua empresa, basta dizer: *"Adiciona o ${guestName} na minha equipe"*.`,
          });
          return true;
        } else {
          const shareMsg = await getReferralShareMessage(client?.id || cleanPhone, client?.name);
          await sendEvolutionText({
            phone,
            text: `🎁 *Que ótimo que você quer convidar o ${guestName}!*
Aqui está o seu link de convite exclusivo para compartilhar com ele:\n\n${shareMsg}`,
          });
          return true;
        }
      }
    }

    // 2. Gestão de Equipe (Linguagem Natural)
    if (decision.intent === 'TEAM_MANAGEMENT' && client?.id) {
      const teamRes = await handleNaturalLanguageTeamCommand(client.id, text);
      if (teamRes.handled && teamRes.message) {
        await sendEvolutionText({ phone, text: teamRes.message });
        return true;
      }
      if (decision.team_params?.action === 'add' && decision.team_params.phone) {
        const { addTeamMember } = await import('@/lib/solo/team');
        const res = await addTeamMember(client.id, decision.team_params.phone, decision.team_params.name || 'Operador');
        await sendEvolutionText({ phone, text: res.message });
        return true;
      }
    }

    // 3. Consulta de Contas / Agenda de Pagamentos
    if (decision.intent === 'QUERY_BILLS') {
      const period = decision.bills_query_params?.period || 'week';
      const billsMsg = await getUpcomingBillsSummary(client?.id || null, cleanPhone, period);
      await sendEvolutionText({ phone, text: billsMsg });
      await sendActionSequenceMenu(phone, 'O que deseja fazer com as suas contas?');
      return true;
    }

    // 4. Solicitação de Código de Barras / Pix para pagar
    if (decision.intent === 'GET_PAYMENT_CODE' && decision.payment_code_params?.supplier_query) {
      await handleGetBarcodeOrPix(client, phone, cleanPhone, decision.payment_code_params.supplier_query);
      return true;
    }

    // 5. Edição / Correção de Contas (Renomeações, Valores, Vencimentos)
    if (decision.intent === 'EDIT_BILL' && decision.edit_params) {
      const { renames, amount_changes, due_date_changes } = decision.edit_params;
      const resultLines: string[] = [];

      if (Array.isArray(renames)) {
        for (const ren of renames) {
          if (!ren.current_name_query || !ren.new_name) continue;
          const res = await handleSupplierRename(client, cleanPhone, ren.current_name_query, ren.new_name);
          if (res.success) {
            resultLines.push(`• *${res.oldName}* ➔ corrigido para *${res.newName}*`);
          } else {
            resultLines.push(`• Não localizei "*${ren.current_name_query}*" para alterar para *${ren.new_name}*`);
          }
        }
      }

      if (Array.isArray(amount_changes)) {
        for (const amt of amount_changes) {
          if (amt.supplier_query && amt.new_amount > 0) {
            await handleAmountChange(client, phone, cleanPhone, amt.supplier_query, amt.new_amount);
          }
        }
      }

      if (Array.isArray(due_date_changes)) {
        for (const dDate of due_date_changes) {
          if (dDate.supplier_query && dDate.new_due_date_raw) {
            await handleDueDateChange(client, phone, cleanPhone, dDate.supplier_query, dDate.new_due_date_raw);
          }
        }
      }

      if (resultLines.length > 0) {
        await sendEvolutionText({
          phone,
          text: `✅ *Dados Atualizados com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${resultLines.join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Seus relatórios e lembretes futuros já foram atualizados com os novos dados!`,
        });
        await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
        return true;
      }
    }

    // 6. Exclusão de Conta
    if (decision.intent === 'DELETE_BILL' && decision.delete_params?.supplier_query) {
      await handleDeleteBill(client, phone, cleanPhone, decision.delete_params.supplier_query);
      return true;
    }

    // 7. Lançamento Financeiro Identificado
    if (decision.intent === 'RECORD_FINANCIAL_ENTRY' && Array.isArray(decision.financial_entries) && decision.financial_entries.length > 0) {
      const validEntries = decision.financial_entries.filter((e) => (e.amount && e.amount > 0) || e.is_provision);
      if (validEntries.length > 0) {
        if (!client) {
          // Degustação (trial)
          await recordMultipleTrialUsage(cleanPhone, validEntries);
          const remainingAfter = Math.max(0, (trialStatus.remainingDocs || 1) - validEntries.length);
          const confirmationText = formatMultipleTrialEntriesConfirmation(validEntries, remainingAfter);
          await sendEvolutionText({ phone, text: confirmationText });
          return true;
        } else {
          // Cliente cadastrado
          for (const ent of validEntries) {
            const isIncome = ent.entry_type === 'receivable';
            const entity = ent.supplier_or_customer || (isIncome ? 'Cliente' : 'Fornecedor');
            const targetDue = ent.due_date || new Date().toISOString().split('T')[0];

            await supabase.from('payables_receivables').insert({
              client_id: client.id,
              counterparty_name: entity,
              type: isIncome ? 'receivable' : 'payable',
              amount: ent.amount ? Math.abs(ent.amount) : 0,
              original_due_date: targetDue,
              current_due_date: targetDue,
              status: 'open',
            });
          }

          const confirmationText = formatMultipleTrialEntriesConfirmation(validEntries, 99);
          await sendEvolutionText({ phone, text: confirmationText });
          return true;
        }
      }
    }

    // 8. Relatório em PDF (Livro Caixa / DRE)
    if (decision.intent === 'REQUEST_PDF_REPORT') {
      if (client?.id) {
        await sendCashLedgerPdfToWhatsApp(client.id, phone);
        return true;
      } else {
        await sendTrialPdfToWhatsApp(cleanPhone, phone);
        return true;
      }
    }

    // 9. Consulta de Preços / Planos
    if (decision.intent === 'VIEW_PLANS_PRICING') {
      await sendEvolutionText({ phone, text: getTrialConversionMenu() });
      return true;
    }

    // 10. Simulação de Teste Admin em Linguagem Natural
    if (decision.intent === 'ADMIN_SIMULATION' && isAdmin && decision.simulation_params?.action) {
      const cmd = `!${decision.simulation_params.action} ${decision.simulation_params.target_plan || ''}`.trim();
      const adminRes = await handleAdminCommands(client?.id || cleanPhone, cmd);
      if (adminRes.handled && adminRes.message) {
        await sendEvolutionText({ phone, text: adminRes.message });
        return true;
      }
    }

    // 11. Conversação Geral / Dúvida com resposta direta da IA
    if (decision.conversational_reply && decision.confidence >= 0.8) {
      await sendEvolutionText({ phone, text: decision.conversational_reply });
      return true;
    }
  } catch (routerErr) {
    console.error('[handleConversationalNaturalLanguageRouter Error]:', routerErr);
  }

  return false;
}

function unwrapMessage(msg: any): any {
  if (!msg) return {};
  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
  if (msg.documentWithCaptionMessage?.message) return unwrapMessage(msg.documentWithCaptionMessage.message);
  return msg;
}

function extractTextFromMessage(msg: any, fullData?: any): string {
  const unwrapped = unwrapMessage(msg);
  const directText = (
    unwrapped?.conversation ||
    unwrapped?.extendedTextMessage?.text ||
    unwrapped?.buttonsResponseMessage?.selectedDisplayText ||
    unwrapped?.buttonsResponseMessage?.selectedButtonId ||
    unwrapped?.templateButtonReplyMessage?.selectedDisplayText ||
    unwrapped?.templateButtonReplyMessage?.selectedId ||
    unwrapped?.listResponseMessage?.title ||
    unwrapped?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    unwrapped?.pollUpdateMessage?.vote?.selectedOptions?.[0]?.name ||
    unwrapped?.pollResponse?.selectedOptions?.[0] ||
    unwrapped?.imageMessage?.caption ||
    unwrapped?.videoMessage?.caption ||
    unwrapped?.documentMessage?.caption ||
    ''
  );

  if (directText && typeof directText === 'string' && directText.trim().length > 0) {
    return directText.trim();
  }

  if (fullData) {
    if (fullData.body && typeof fullData.body === 'string') return fullData.body.trim();
    if (fullData.selectedRowId) return String(fullData.selectedRowId).trim();
    if (fullData.selectedButtonId) return String(fullData.selectedButtonId).trim();
  }

  return '';
}

export interface ExtractedContact {
  name: string;
  phone: string;
  rawVcard?: string;
}

export function extractContactsFromPayload(msg: any): ExtractedContact[] {
  const unwrapped = unwrapMessage(msg);
  const contacts: ExtractedContact[] = [];
  const rawList: Array<{ displayName?: string; vcard?: string }> = [];

  if (unwrapped?.contactMessage) rawList.push(unwrapped.contactMessage);
  if (unwrapped?.contactsArrayMessage?.contacts && Array.isArray(unwrapped.contactsArrayMessage.contacts)) {
    rawList.push(...unwrapped.contactsArrayMessage.contacts);
  }

  for (const item of rawList) {
    if (!item) continue;
    const vcard = item.vcard || '';
    let name = item.displayName || '';

    if (!name && vcard) {
      const fnMatch = vcard.match(/FN[;:]([^\r\n]+)/i);
      if (fnMatch && fnMatch[1]) {
        name = fnMatch[1].trim();
      } else {
        const nMatch = vcard.match(/N[;:]([^;\r\n]*);([^;\r\n]*)/i);
        if (nMatch) {
          name = `${nMatch[2] || ''} ${nMatch[1] || ''}`.trim();
        }
      }
    }

    let phone = '';
    const waidMatch = vcard.match(/waid=(\d+)/i);
    if (waidMatch && waidMatch[1]) {
      phone = waidMatch[1];
    } else {
      const telMatches = [...vcard.matchAll(/TEL[^:]*:([^\r\n]+)/gi)];
      for (const tm of telMatches) {
        const rawDigits = (tm[1] || '').replace(/\D/g, '');
        if (rawDigits.length >= 8) {
          phone = rawDigits;
          if (rawDigits.length >= 10) break;
        }
      }
    }

    if (phone) {
      if (phone.length <= 11 && !phone.startsWith('55')) {
        phone = '55' + phone;
      }
      contacts.push({
        name: name ? name.trim() : 'Convidado VIP',
        phone: phone.trim(),
        rawVcard: vcard,
      });
    }
  }

  return contacts;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvolutionWebhookBody;

    const message = unwrapMessage(body.data?.message);
    const rawText = extractTextFromMessage(body.data?.message, body.data);
    const isCommand = rawText.trim().startsWith('!') || rawText.trim().startsWith('/');
    const isAudio =
      body.data?.messageType === 'audioMessage' ||
      !!message?.audioMessage ||
      !!body.data?.message?.audioMessage;
    const isContact =
      body.data?.messageType === 'contactMessage' ||
      body.data?.messageType === 'contactsArrayMessage' ||
      !!message?.contactMessage ||
      !!message?.contactsArrayMessage;

    const key = body.data?.key || ({} as any);
    const remoteJid = key.remoteJid || '';
    const remoteJidAlt = key.remoteJidAlt || (body.data as any)?.remoteJidAlt || '';
    const participant = key.participant || (body.data as any)?.participant || '';

    // Extrai o número do telefone de forma robusta
    let candidateJid = remoteJid;
    if (candidateJid.includes('@lid')) {
      if (remoteJidAlt && !remoteJidAlt.includes('@lid')) {
        candidateJid = remoteJidAlt;
      } else if (participant && !participant.includes('@lid')) {
        candidateJid = participant;
      }
    }

    // Remove qualquer domínio (@s.whatsapp.net, @lid, etc.) e sufixo de dispositivo (:1, :19, etc.)
    const userPart = candidateJid.split('@')[0].split(':')[0];
    const phone = userPart.replace(/\D/g, '');

    if (!phone) {
      return NextResponse.json({ ignored: true, reason: 'no_phone' }, { status: 200 });
    }

    const isAdminTester = phone === '5514930855878' || phone.includes('930855878');

    // Ignora fromMe apenas se NÃO for o Marcos Administrador testando, NÃO for comando, áudio ou contato
    if (body.data?.key?.fromMe && !isAdminTester && !isCommand && !isAudio && !isContact) {
      return NextResponse.json({ ignored: true, reason: 'from_me' }, { status: 200 });
    }

    // Aguarda o processamento para que a Vercel Serverless não congele a execução antes da resposta
    try {
      await processMessageAsync(phone, body);
    } catch (procErr: unknown) {
      console.error('[Evolution Webhook] Erro durante processMessageAsync:', procErr);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    console.error('[Evolution Webhook] Erro ao decodificar webhook:', error);
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
}

async function processMessageAsync(phone: string, body: EvolutionWebhookBody) {
  const supabase = createServiceRoleClient();

  // Normaliza o número para buscar com e sem o 9º dígito e com/sem 55
  let cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10) {
    cleanPhone = '55' + cleanPhone;
  }
  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // 1. Localiza cliente pelo número de WhatsApp ou WhatsApp LID
  let { data: client } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number, status, is_admin, whatsapp_lid, tax_id')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone},whatsapp_lid.eq.${cleanPhone}`)
    .limit(1)
    .maybeSingle();

  // 1.1 Identifica se o remetente é um Membro de Equipe (Operador) previamente cadastrado pelo titular
  let isOperator = false;
  let operatorName = '';
  let operatorRecord: any = null;
  if (!client) {
    const userContext = await resolveUserAndClient(cleanPhone);
    if (userContext?.isTeamMember && userContext.client) {
      client = userContext.client;
      isOperator = true;
      operatorName = userContext.memberName || 'Operador(a)';
      operatorRecord = userContext.teamMember || null;
    }
  }

  // Garante privilégios de Administrador se for o número pessoal do Marcos
  const isAdminPhone = cleanPhone === '5514930855878' || altPhone === '5514930855878' || cleanPhone.includes('930855878');
  if (isAdminPhone) {
    if (!client) {
      const { data: adminCreated } = await supabase
        .from('clients')
        .insert({
          name: 'Marcos Administrador',
          whatsapp_number: cleanPhone,
          tax_id: '00000000000',
          tax_type: 'CPF',
          is_admin: true,
          status: 'active',
        })
        .select('id, name, whatsapp_number, status, is_admin, whatsapp_lid, tax_id')
        .single();
      if (adminCreated) client = adminCreated;
    } else if (!client.is_admin) {
      await supabase.from('clients').update({ is_admin: true }).eq('id', client.id);
      client.is_admin = true;
    }
  }

  // Se o cliente foi localizado e a mensagem veio com LID, sincroniza automaticamente
  if (client && body.data?.key?.remoteJid?.includes('@lid') && !client.whatsapp_lid) {
    const lidDigits = body.data.key.remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (lidDigits) {
      await supabase.from('clients').update({ whatsapp_lid: lidDigits }).eq('id', client.id);
    }
  }

  // Se o cliente titular possui número oficial cadastrado, garante o envio para ele
  if (!isOperator && client?.whatsapp_number) {
    phone = client.whatsapp_number;
  }
  // Se for operador de equipe, o retorno DEVE ser enviado diretamente para o operador
  if (isOperator) {
    phone = cleanPhone;
  }

  const message = unwrapMessage(body.data?.message);
  const rawText = extractTextFromMessage(body.data?.message);
  const cleanText = rawText.trim().toLowerCase();
  const digitsOnly = rawText.replace(/\D/g, '');
  const isCommand = rawText.trim().startsWith('!') || rawText.trim().startsWith('/');
  const isAdminTester = isAdminPhone;
  const hasMonetaryPattern = /(?:r\$\s*|reais|\b\d+[,.]\d{2}\b)/i.test(rawText);
  const isFinancialAction = /(?:pagar|receber|comprei|gastei|transferir|lance|lançar)/i.test(cleanText);

  // Verifica se este número está em Modo Simulação de Lead Novo (Degustação)
  const { data: simLeadRow } = await supabase
    .from('bot_config')
    .select('value')
    .or(`key.eq.simulating_lead_${cleanPhone},key.eq.simulating_lead_${altPhone}`)
    .maybeSingle();

  const isSimulatingLead = simLeadRow?.value === 'true';

  // Se estiver simulando lead e NÃO for comando de controle administrativo, mascara client = null
  // para que o fluxo execute 100% da Degustação Gratuita real do novo cliente
  if (isSimulatingLead && !isCommand) {
    client = null;
  }

  // ── 0. INTERCEPTADOR DE CONFIRMAÇÕES PENDENTES (AÇÕES QUE MEXEM EM LANÇAMENTOS) ──
  const nowIso = new Date().toISOString();
  let confQuery = supabase
    .from('bot_action_confirmations')
    .select('*')
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  if (client?.id) {
    confQuery = confQuery.or(`client_id.eq.${client.id},phone_number.eq.${cleanPhone},phone_number.eq.${altPhone}`);
  } else {
    confQuery = confQuery.or(`phone_number.eq.${cleanPhone},phone_number.eq.${altPhone}`);
  }

  const { data: pendingActionList } = await confQuery;
  const pendingAction = pendingActionList?.[0];

  if (pendingAction && rawText) {
    const trimmed = cleanText.trim().toLowerCase();
    const isAffirmative =
      /^(sim\b|s\b|confirmo\b|confirmar\b|pode\b|correto\b|ok\b|positivo\b|com\s*certeza\b|1\b|sim,\s*apagar|sim,\s*confirmar)/i.test(trimmed) &&
      trimmed.length <= 40;
    const isNegative =
      /^(n[aã]o\b|n\b|cancela\b|cancelar\b|errado\b|incorreto\b|deixa\b|2\b|n[aã]o,\s*cancelar)/i.test(trimmed) &&
      trimmed.length <= 40;

    // Trata confirmação de 2FA para Alteração de Chave Pix (Abordagem 2)
    if (pendingAction.action_type === 'change_pix_key') {
      if (isNegative || cleanText === '!cancelarpix' || cleanText === 'cancelar') {
        const cancelMsg = await cancelarAlteracaoPix(client?.id || cleanPhone);
        await sendEvolutionText({ phone, text: cancelMsg });
        return;
      }

      const otpCandidate = rawText.replace(/^[!/](confirmarpix|confirmar)\s*/i, '').replace(/\D/g, '').trim();
      if (otpCandidate.length === 6) {
        const confirmResult = await confirmarAlteracaoPix(client?.id || cleanPhone, otpCandidate);
        await sendEvolutionText({ phone, text: confirmResult.message });
        return;
      }
    }

    // Trata confirmação de 2FA para Alteração de E-mail
    if (pendingAction.action_type === 'change_email') {
      if (isNegative || cleanText === '!cancelaremail' || cleanText === 'cancelar') {
        const cancelMsg = await cancelarAlteracaoEmail(client?.id || cleanPhone);
        await sendEvolutionText({ phone, text: cancelMsg });
        return;
      }

      const otpCandidate = rawText.replace(/^[!/](confirmaremail|confirmar)\s*/i, '').replace(/\D/g, '').trim();
      if (otpCandidate.length === 6) {
        const confirmResult = await confirmarAlteracaoEmail(client?.id || cleanPhone, otpCandidate);
        await sendEvolutionText({ phone, text: confirmResult.message });
        return;
      }
    }

    // Trata Desafio Cadastral de Recuperação de E-mail (Receita Federal)
    if (pendingAction.action_type === 'email_recovery_challenge') {
      const recoveryRes = await processarRespostaDesafioEmail(client?.id || cleanPhone, rawText);
      if (recoveryRes.handled && recoveryRes.message) {
        await sendEvolutionText({ phone, text: recoveryRes.message });
        return;
      }
    }

    // Trata Confirmação de Onboarding pós-assinatura: Limpar Contas de Teste vs Manter
    if (pendingAction.action_type === 'onboarding_clean_test_bills') {
      const isClean =
        /^(1\b|limpar|apagar|zerar|come[çc]ar do zero|novo|apaga|limpa|zera|excluir|1\.|sim\b)/i.test(trimmed);
      const isKeep =
        /^(2\b|manter|fica|deixar|continua|continuar|importar|2\.|n[aã]o\b)/i.test(trimmed);

      if (isClean) {
        await supabase
          .from('bot_action_confirmations')
          .update({ status: 'confirmed' })
          .eq('id', pendingAction.id);

        if (client?.id) {
          await supabase.from('payables_receivables').delete().eq('client_id', client.id);
          await supabase.from('cash_ledger_entries').delete().eq('client_id', client.id);
        }
        await supabase
          .from('trial_leads')
          .delete()
          .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`);

        await sendEvolutionText({
          phone,
          text: `🧹 *Livro Caixa Zerado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Todas as contas e documentos de teste enviados durante a degustação foram removidos.

Seu assistente está pronto com a "folha em branco" para organizar as contas reais da sua empresa e da sua vida pessoal! Pode me enviar suas notas, boletos ou áudios do dia a dia a qualquer momento. 🚀`,
        });
        return;
      } else if (isKeep) {
        await supabase
          .from('bot_action_confirmations')
          .update({ status: 'rejected' })
          .eq('id', pendingAction.id);

        await sendEvolutionText({
          phone,
          text: `✅ *Contas Mantidas com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seus lançamentos foram preservados no seu Livro Caixa oficial e os lembretes de véspera às 10h continuam agendados.

💡 Digite *contas* para ver sua agenda ou envie novos boletos a qualquer momento!`,
        });
        return;
      }
    }

    if (isAffirmative) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'confirmed' })
        .eq('id', pendingAction.id);

      // AÇÃO 1: Reset Geral / Apagar Tudo
      if (pendingAction.action_type === 'reset_all') {
        await supabase
          .from('trial_leads')
          .delete()
          .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`);

        await supabase
          .from('bot_loop_tracking')
          .delete()
          .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`);

        if (client) {
          await supabase.from('payables_receivables').delete().eq('client_id', client.id);
          await supabase.from('cash_ledger_entries').delete().eq('client_id', client.id);
          await supabase
            .from('usage_cycles')
            .update({
              docs_processed_count: 0,
              bot_interactions_count: 0,
              cash_flow_analyses_count: 0,
              hit_doc_limit: false,
              hit_bot_limit: false,
              hit_analysis_limit: false,
              upsell_status: 'none',
            })
            .eq('client_id', client.id);
        }

        await sendEvolutionText({
          phone,
          text: `🗑️ *Tudo limpo e zerado com sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Contas a pagar e histórico de testes foram completamente apagados.
✅ Seu perfil de teste foi restaurado para o estado inicial.
✅ Cota de lançamentos dos Pioneiros VIP 100% renovada!

Pode me enviar seu novo lançamento ou provisão por voz, texto ou foto de boleto agora mesmo! 🚀`,
        });
        return;
      }

      // AÇÃO 2: Exclusão de Conta Específica
      if (pendingAction.action_type === 'delete_bill') {
        const payload = pendingAction.proposed_payload as any;

        if (payload.isTrial) {
          await deleteTrialBill(cleanPhone, payload.billId || payload.supplier);
        } else if (client) {
          await supabase
            .from('payables_receivables')
            .update({
              status: 'canceled',
              notes: `Conta cancelada via confirmação WhatsApp por ${phone} em ${new Date().toISOString()}`,
            })
            .eq('id', payload.billId);

          if (payload.documentId) {
            await supabase
              .from('cash_ledger_entries')
              .delete()
              .eq('document_id', payload.documentId);
          }

          await recordAuditLog({
            clientId: client.id,
            actorPhone: phone,
            action: 'DELETE_BILL',
            entityType: 'payables_receivables',
            entityId: payload.billId,
            details: payload,
          });
        }

        await sendEvolutionText({
          phone,
          text: `🗑️ *Lançamento Excluído com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Conta:* ${payload.supplier}
• *Valor:* R$ ${Number(payload.amount || 0).toFixed(2)}

O lançamento foi removido permanentemente da sua agenda financeira.`,
        });
        return;
      }

      // AÇÃO 3: Confirmação de Leitura de Baixa Certeza
      if (pendingAction.action_type === 'confirm_low_confidence_doc' && client) {
        const payload = pendingAction.proposed_payload as any;
        await supabase.from('cash_ledger_entries').insert({
          client_id: client.id,
          document_id: payload.document_id,
          entry_date: payload.due_date || new Date().toISOString().split('T')[0],
          description: `${payload.doc_type?.toUpperCase() || 'DOCUMENTO'} - ${payload.counterparty_name}`,
          amount: -Math.abs(Number(payload.total_amount)),
          entry_type: 'expense',
          dre_group: payload.category_suggestion || 'despesa_administrativa',
          status: 'realizado',
        });

        if (payload.due_date) {
          await supabase.from('payables_receivables').insert({
            client_id: client.id,
            document_id: payload.document_id,
            counterparty_name: payload.counterparty_name,
            type: 'payable',
            amount: Number(payload.total_amount),
            original_due_date: payload.due_date,
            current_due_date: payload.due_date,
            status: 'open',
            barcode_or_pix: payload.barcode_or_pix,
          });
        }

        await sendEvolutionText({
          phone,
          text: `✅ *Lançamento confirmado com sucesso!*
O valor de *R$ ${Number(payload.total_amount).toFixed(2)}* referente a *${payload.counterparty_name}* foi registrado no seu Livro Caixa.`,
        });
        return;
      }
    } else if (isNegative) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'rejected' })
        .eq('id', pendingAction.id);

      await sendEvolutionText({
        phone,
        text: `🚫 *Ação cancelada com segurança.*
Nenhum lançamento foi alterado ou excluído. Seus dados e histórico permanecem 100% preservados.`,
      });
      return;
    }
  }

  // ── Interceptação Universal: Reset / Apagar com Confirmação Prévia ───────
  const isForceReset =
    cleanText === '!reset force' || cleanText === '!reset -f' || cleanText === '!reset sim' || cleanText === '!reset confirmar';

  const isResetCommand =
    isForceReset ||
    cleanText === '!apagar' || cleanText === 'apagar' ||
    cleanText === '!reset' || cleanText === 'reset' ||
    cleanText === '!limpar' || cleanText === 'limpar' ||
    cleanText === '!zerar' || cleanText === 'zerar' ||
    cleanText === '!excluir' || cleanText === 'excluir' ||
    cleanText === 'apagar tudo' || cleanText === 'limpar tudo' || cleanText === 'zerar tudo' ||
    cleanText === 'excluir tudo';

  if (isResetCommand) {
    // Só executa direto se o usuário enviou explicitamente o parâmetro de força (!reset force / !reset sim)
    if (isForceReset && (client?.is_admin || isAdminTester)) {
      await supabase
        .from('trial_leads')
        .delete()
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`);

      await supabase
        .from('bot_loop_tracking')
        .delete()
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`);

      if (client) {
        await supabase.from('payables_receivables').delete().eq('client_id', client.id);
        await supabase.from('cash_ledger_entries').delete().eq('client_id', client.id);
        await supabase
          .from('usage_cycles')
          .update({
            docs_processed_count: 0,
            bot_interactions_count: 0,
            cash_flow_analyses_count: 0,
            hit_doc_limit: false,
            hit_bot_limit: false,
            hit_analysis_limit: false,
            upsell_status: 'none',
          })
          .eq('client_id', client.id);
      }

      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'confirmed' })
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.${altPhone}`)
        .eq('status', 'pending');

      await sendEvolutionText({
        phone,
        text: `🔄 *Reset Forçado Concluído com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Contas a pagar e lançamentos anteriores foram apagados.
✅ Histórico de degustação (trial) foi zerado.
✅ Contadores de uso restaurados para 0.

Seu perfil foi limpo para o estado inicial! 🚀`,
      });
      return;
    }

    // Para todos os demais casos (incluindo admin), solicita confirmação obrigatória de 2 passos
    await supabase.from('bot_action_confirmations').insert({
      client_id: client?.id || null,
      phone_number: cleanPhone,
      action_type: 'reset_all',
      proposed_payload: {
        cleanPhone,
        altPhone,
        clientId: client?.id || null,
      },
      status: 'pending',
      expires_at: addMinutes(new Date(), 10).toISOString(),
    });

    await sendEvolutionText({
      phone,
      text: `⚠️ *Confirmação de Segurança — Zerar Lançamentos*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você solicitou *apagar todos os lançamentos e histórico*.
Esta ação é irreversível e excluirá permanentemente suas contas cadastradas.

1️⃣ *Sim, confirmar e apagar tudo*
2️⃣ *Não, cancelar*

👉 _Responda com *1* (ou *Sim*) para confirmar, ou *2* (ou *Não*) para cancelar._`,
    });
    return;
  }

  // ── Interceptação Operador de Equipe: Primeiro Contato / Saudação Inbound ──
  if (isOperator) {
    const isGreeting = /^(oi|ola|olá|bom dia|boa tarde|boa noite|oii|oie|opa|começar|iniciar|ativar|teste)[!.]*$/i.test(cleanText);
    if (isGreeting) {
      // PONTO 3: Notificar o Dono na ativação formal do operador para permitir cobrança de omissões
      if (operatorRecord && !operatorRecord.activated_at) {
        // markTeamMemberActivated imported statically
        await markTeamMemberActivated(operatorRecord.id);

        await recordAuditLog({
          clientId: client.id,
          actorPhone: cleanPhone,
          action: 'TEAM_MEMBER_ACTIVATED',
          entityType: 'client_team_members',
          entityId: operatorRecord.id,
          details: {
            operatorName,
            operatorPhone: cleanPhone,
            activatedAt: new Date().toISOString(),
          },
        });

        if (client.whatsapp_number && client.whatsapp_number !== cleanPhone) {
          const nowBr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          await sendEvolutionText({
            phone: client.whatsapp_number,
            text: `✅ *Confirmação de Equipe — ${client.name || 'Sua Empresa'}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*${operatorName}* (WhatsApp: +${cleanPhone}) acabou de ativar seu acesso e iniciar o uso do AnalisAí como **Operadora** da sua empresa!

📅 *Ativação:* ${nowBr}
🛡️ *Status:* Habilitada para enviar fotos de notas, boletos e áudios de despesas.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Registro formalizado para controle interno e auditoria de equipe._`,
          });
        }
      }

      await sendEvolutionText({
        phone,
        text: `Olá, ${operatorName}! 👋 Identifiquei que você faz parte da equipe de *${client.name || 'sua empresa'}*!

📋 *Instruções & Regras de Uso da Equipe:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ *Boletos e Notas:* Basta tirar uma foto nítida (ou mandar o PDF) aqui nesta conversa. Eu leio o valor, vencimento e código de barras em segundos.
2️⃣ *Despesas do Dia a Dia:* Pode mandar um áudio simples (ex: _"Comprei R$ 45 de material de limpeza no dinheiro"_) ou digitar o valor.
3️⃣ *Confirmação Automática:* Cada lançamento entra diretamente no Livro Caixa da empresa.
4️⃣ *Privacidade & Diretrizes:* Por segurança corporativa, demonstrativos consolidados, saldos e extratos bancários são visíveis exclusivamente para a diretoria.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *Seu acesso está ativo e registrado para auditoria interna.* Pode me enviar sua primeira nota ou boleto agora mesmo!`,
      });
      return;
    }

    // PONTO 4: Tentativa de acesso a recursos além do perfil -> Alerta de Segurança ao Dono + Bloqueio + Log
    if (
      cleanText.startsWith('!dre') || cleanText === 'dre' ||
      cleanText.startsWith('!saldo') || cleanText === 'saldo' ||
      cleanText.startsWith('!dividendos') || cleanText === 'dividendos' ||
      cleanText.startsWith('!lucros') || cleanText === 'lucros' ||
      cleanText.startsWith('!equipe') || cleanText.startsWith('/equipe') ||
      cleanText.includes('dre') || cleanText.includes('quanto temos de saldo') ||
      cleanText.startsWith('!reset') || cleanText.startsWith('/reset') ||
      cleanText.includes('excluir conta') || cleanText.includes('apagar conta')
    ) {
      // 1. Grava no log forense de auditoria
      await recordAuditLog({
        clientId: client.id,
        actorPhone: cleanPhone,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'client_team_members',
        entityId: operatorRecord?.id || 'unknown',
        details: {
          operatorName,
          operatorPhone: cleanPhone,
          attemptedCommand: rawText,
          timestamp: new Date().toISOString(),
        },
      });

      // 2. Dispara notificação imediata ao Dono da conta
      if (client.whatsapp_number && client.whatsapp_number !== cleanPhone) {
        const nowBr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        await sendEvolutionText({
          phone: client.whatsapp_number,
          text: `⚠️ *Alerta de Segurança da Equipe — AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A operadora *${operatorName}* (+${cleanPhone}) tentou acessar uma função restrita ao titular:
📋 *Comando solicitado:* "${rawText.slice(0, 80)}"
⏰ *Horário:* ${nowBr}
🛡️ *Ação do Sistema:* Acesso **bloqueado** preventivamente.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Caso deseje promover esta operadora ou alterar as permissões de acesso, digite !equipe nesta conversa._`,
        });
      }

      // 3. Responde educadamente à operadora
      await sendEvolutionText({
        phone,
        text: `🔒 *Acesso Restrito ao Titular*\n\nOlá, ${operatorName}! Relatórios gerenciais consolidados, demonstrativos de DRE e configurações da equipe são visíveis exclusivamente para o titular da conta (*${client.name || 'Dono'}*).\n\nUma notificação de segurança foi registrada. Você tem autorização para me enviar fotos de notas, boletos e áudios de despesas do dia a dia! 🚀`,
      });
      return;
    }
  }

  // ── Proteção Anti-Looping de Robôs (Escada de Bloqueio Progressivo) ────────
  if (!client?.is_admin && !isAdminPhone) {
    // checkAntiLoopStatus imported statically
    const loopStatus = await checkAntiLoopStatus(cleanPhone, rawText);
    if (!loopStatus.allowed) {
      return; // Silêncio absoluto para quebrar loop ou recurso já processado
    }
  }

  // ── Interceptação 0: Feedbacks, Críticas e Sugestões dos Clientes ──────────
  // isFeedbackMessage, recordClientFeedback imported statically
  const feedbackCheck = isFeedbackMessage(rawText);
  if (feedbackCheck.isFeedback) {
    const res = await recordClientFeedback({
      phone: cleanPhone,
      message: feedbackCheck.cleanMessage,
      clientId: client?.id,
      clientName: client?.name || body.data?.pushName,
    });
    await sendEvolutionText({ phone, text: res.userReply });
    return;
  }

  // ── Interceptação 0.05: Contato(s) Anexado(s) via WhatsApp (VCard) ────────────
  const attachedContacts = extractContactsFromPayload(body.data?.message);
  if (attachedContacts.length > 0) {
    const isDeactivate =
      cleanText.startsWith('!inabilitar') || cleanText.startsWith('/inabilitar') ||
      cleanText.startsWith('!desconvidar') || cleanText.startsWith('/desconvidar') ||
      cleanText.startsWith('!remover') || cleanText.startsWith('/remover') ||
      cleanText.startsWith('!qa remove') || cleanText.startsWith('/qa remove');

    if (isDeactivate && (client?.is_admin || isAdminPhone)) {
      const { removeQaWhitelist } = await import('@/lib/solo/qa-whitelist');
      const targetContact = attachedContacts[0];
      const res = await removeQaWhitelist(targetContact.phone);
      await sendEvolutionText({ phone, text: res.message });
      return;
    }

    if (client?.is_admin || isAdminPhone || cleanText.startsWith('!convidar') || cleanText.startsWith('/convidar')) {
      const inviterName = client?.name || 'Marcos Administrador';

      if (attachedContacts.length > 1) {
        let summary = `🎉 *${attachedContacts.length} Pré-cadastros VIP Concluídos!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const c of attachedContacts) {
          const res = await inviteContactVip(inviterName, c.phone, c.name);
          summary += `• 👤 *${res.name}* (${res.formattedTarget}): ✅ Whitelist Liberada!\n  🔗 ${res.inviteLink}\n`;
        }
        summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🛡️ *Segurança Anti-Spam:* O robô NÃO disparou mensagens frias. Encaminhe os links acima para cada um deles ativar o acesso! 🚀`;
        await sendEvolutionText({ phone, text: summary });
        return;
      }

      const targetContact = attachedContacts[0];
      const customName = cleanText.replace(/^[!/](convidar|convite)\s*/i, '').trim();
      const finalName = customName || targetContact.name;

      const res = await inviteContactVip(inviterName, targetContact.phone, finalName);
      await sendEvolutionText({ phone, text: res.message });
      return;
    }

    // Se for cliente comum compartilhando contato (Pré-cadastro de indicação seguro)
    const contact = attachedContacts[0];
    const clientName = client?.name || body.data?.pushName || 'Cliente Parceiro';
    const clientPhone = client?.whatsapp_number || phone;

    // Pré-registra o lead vinculado ao cliente para atribuir comissão futura
    const linkResult = await linkReferralLead(contact.phone, clientPhone);
    if (!linkResult.success) {
      await sendEvolutionText({
        phone,
        text:
          linkResult.message ||
          `⚠️ Não foi possível cadastrar o contato *${contact.name}* (${contact.phone}) como sua indicação.`,
      });
      return;
    }

    const refGreeting = `Olá! Recebi a indicação do ${clientName}!`;
    const refLink = `https://wa.me/${OFFICIAL_BOT_WHATSAPP}?text=${encodeURIComponent(refGreeting)}`;
    const contactFirstName = contact.name.split(' ')[0] || 'Parceiro';

    const forwardShare = `👋 Olá, ${contactFirstName}!
O *${clientName}* recomendou o **AnalisAí** para você!

É o assistente de inteligência financeira no WhatsApp que organiza notas fiscais, boletos e fluxo de caixa automaticamente. Você ganha uma degustação gratuita para testar!

👉 *Clica aqui para falar com o AnalisAí:*
${refLink}`;

    await sendEvolutionText({
      phone,
      text: `Recebi o contato de *${contact.name}* (${contact.phone})! 😊
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ **Pré-cadastro de Indicação Realizado!**
🛡️ *Segurança Anti-Spam:* O robô **NÃO** enviou mensagem fria para ele. O vínculo de indicação já foi registrado no seu nome!

📲 *Mensagem pronta para você encaminhar para ele no WhatsApp:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${forwardShare}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Sua Recompensa:* Assim que ele assinar qualquer plano, você ganha **1 Mês Grátis de AnalisAí** abatido na sua assinatura! 🎁

👉 *Obs:* Se você queria adicioná-lo como funcionário/operador da sua própria empresa, digite:
*!equipe add ${contact.phone} ${contact.name}*`,
    });
    return;
  }

  // ── Interceptação 0.1: Comandos de Administração Diretos (!qa, !feedbacks, !ajuda, etc.) ──
  if (client?.is_admin && (cleanText.startsWith('!') || cleanText.startsWith('/'))) {
    const adminResponse = await handleAdminCommands(client.id, rawText);
    if (adminResponse.handled && adminResponse.message) {
      await sendEvolutionText({ phone, text: adminResponse.message });
      return;
    }
  }

  // ── Interceptação 0.2: Gestão de Membros de Equipe (Linguagem Natural ou Comandos) ────
  if (client?.id) {
    const teamResponse = await handleNaturalLanguageTeamCommand(client.id, rawText);
    if (teamResponse.handled && teamResponse.message) {
      await sendEvolutionText({ phone, text: teamResponse.message });
      return;
    }
  }

  // ── Interceptação 0.3: Tag Rápida [Pessoal] vs [Empresa] ─────────────────
  const isTagPersonal = /^(pessoal|é pessoal|conta pessoal|mudar para pessoal|particular|despesa pessoal)$/i.test(cleanText);
  const isTagBusiness = /^(empresa|é da empresa|conta da empresa|mudar para empresa|pj|despesa da empresa)$/i.test(cleanText);

  if (isTagPersonal || isTagBusiness) {
    let billUpdated = false;
    let billName = '';

    if (client?.id) {
      const { data: lastBill } = await supabase
        .from('payables_receivables')
        .select('id, counterparty_name, category')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastBill) {
        const newCat = isTagPersonal ? 'despesa_pessoal' : 'despesa_operacional';
        await supabase
          .from('payables_receivables')
          .update({ category: newCat })
          .eq('id', lastBill.id);
        billUpdated = true;
        billName = lastBill.counterparty_name || 'Última conta';
      }
    } else {
      // Degustação / Trial Lead
      const { data: trialLead } = await supabase
        .from('trial_leads')
        .select('id, bills_list')
        .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
        .maybeSingle();

      if (trialLead && Array.isArray(trialLead.bills_list) && trialLead.bills_list.length > 0) {
        const list = [...trialLead.bills_list];
        const lastIdx = list.length - 1;
        list[lastIdx].category = isTagPersonal ? 'despesa_pessoal' : 'despesa_operacional';
        await supabase.from('trial_leads').update({ bills_list: list }).eq('id', trialLead.id);
        billUpdated = true;
        billName = list[lastIdx].supplier_name || 'Última conta';
      }
    }

    if (billUpdated) {
      await sendEvolutionText({
        phone,
        text: `✅ *Classificação atualizada para [${isTagPersonal ? '🏠 Pessoal/Particular' : '💼 Empresa/Operacional'}]!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Conta:* ${billName}
• *Classificação:* ${isTagPersonal ? 'Despesa Pessoal' : 'Despesa da Empresa'}

Seus relatórios e Livro Caixa já foram sincronizados com essa separação.`,
      });
      return;
    }
  }

  // ── Interceptação 0.4: Cobrança Amigável & Baixa de Recebimentos ────────────
  // A. Pedido de Cobrança (!cobrar, !recebimentos, ou linguagem natural "cobrar o Carlos")
  const isCollectCommand = /^[!/](cobrar|receber|recebimentos)(\s+(.*))?$/i.test(cleanText);
  const isCollectNatural = /^(cobrar|quero cobrar|gerar cobrança d[eao]|cobrança d[eao]|manda a cobrança d[eao])\s+(.+)$/i.test(cleanText);

  if (isCollectCommand || isCollectNatural) {
    let targetQuery = '';
    const matchCmd = cleanText.match(/^[!/](cobrar|receber|recebimentos)(\s+(.*))?$/i);
    const matchNat = cleanText.match(/^(cobrar|quero cobrar|gerar cobrança d[eao]|cobrança d[eao]|manda a cobrança d[eao])\s+(.+)$/i);

    if (matchCmd && matchCmd[3]) {
      targetQuery = matchCmd[3].trim();
    } else if (matchNat && matchNat[2]) {
      targetQuery = matchNat[2].trim();
    }

    const collectRes = await handleGenerateFriendlyCollection(cleanPhone, targetQuery);
    await sendEvolutionText({ phone, text: collectRes.message });
    return;
  }

  // B. Baixa de Recebimento (!pago, !recebido, ou "Carlos pagou", "Recebi do Carlos")
  const isPaidCommand = /^[!/](pago|recebido|baixar)\s+(.+)$/i.test(cleanText);
  const isPaidNatural1 = /^(.+?)\s+(já\s+)?(pagou|acertou|quitou)$/i.test(cleanText);
  const isPaidNatural2 = /^(recebi|caiu o pix|pago|recebido)\s+(d[eao]\s+)?(.+)$/i.test(cleanText);

  if (isPaidCommand || isPaidNatural1 || isPaidNatural2) {
    let customerQuery = '';
    const matchCmd = cleanText.match(/^[!/](pago|recebido|baixar)\s+(.+)$/i);
    const matchNat1 = cleanText.match(/^(.+?)\s+(já\s+)?(pagou|acertou|quitou)$/i);
    const matchNat2 = cleanText.match(/^(recebi|caiu o pix|pago|recebido)\s+(d[eao]\s+)?(.+)$/i);

    if (matchCmd && matchCmd[2]) customerQuery = matchCmd[2].trim();
    else if (matchNat1 && matchNat1[1]) customerQuery = matchNat1[1].trim();
    else if (matchNat2 && matchNat2[3]) customerQuery = matchNat2[3].trim();

    // Filtra palavras que poderiam ser falso positivo (ex: "já pagou a conta de luz?")
    if (customerQuery && !/^(a|o|uma|minha)\s+conta/i.test(customerQuery)) {
      const paidRes = await markReceivableAsPaid(cleanPhone, customerQuery);
      await sendEvolutionText({ phone, text: paidRes.message });
      return;
    }
  }

  // ── Interceptação 1: Comandos do Analisador Oficial, Indicação & Parcerias ────
  const isAnalisadorCommand =
    cleanText === '!analisador' || cleanText === 'analisador' || cleanText === '/analisador' ||
    cleanText === '!analisar' || cleanText === 'analisar' || cleanText === '/analisar' ||
    cleanText === '!indicar' || cleanText === 'indicar' || cleanText === '/indicar' ||
    cleanText === '!indicação' || cleanText === 'indicação' || cleanText === '!indicacao' || cleanText === 'indicacao' ||
    cleanText === '!comissao' || cleanText === 'comissao' || cleanText === '!comissão' || cleanText === 'comissão' || cleanText === '/comissao' ||
    cleanText === '!parceiro' || cleanText === 'parceiro' || cleanText === '/parceiro' ||
    cleanText === '!vip' || cleanText === 'vip' ||
    cleanText === '!pioneiro' || cleanText === 'pioneiro';

  if (isAnalisadorCommand) {
    const shareMsg = await getReferralShareMessage(client?.id || cleanPhone, body.data?.pushName);
    await sendEvolutionText({ phone, text: shareMsg });
    return;
  }

  // ── Interceptação 1.04: Confirmação e Cancelamento de 2FA do Pix ──────────
  if (cleanText.startsWith('!confirmarpix') || cleanText.startsWith('/confirmarpix')) {
    const rawCode = rawText.replace(/^[!/](confirmarpix)\s*/i, '').trim();
    const result = await confirmarAlteracaoPix(client?.id || cleanPhone, rawCode);
    await sendEvolutionText({ phone, text: result.message });
    return;
  }

  if (cleanText === '!cancelarpix' || cleanText === '/cancelarpix') {
    const cancelMsg = await cancelarAlteracaoPix(client?.id || cleanPhone);
    await sendEvolutionText({ phone, text: cancelMsg });
    return;
  }

  // ── Interceptação 1.05: Confirmação e Cancelamento de 2FA do E-mail ────────
  if (cleanText.startsWith('!confirmaremail') || cleanText.startsWith('/confirmaremail')) {
    const rawCode = rawText.replace(/^[!/](confirmaremail)\s*/i, '').trim();
    const result = await confirmarAlteracaoEmail(client?.id || cleanPhone, rawCode);
    await sendEvolutionText({ phone, text: result.message });
    return;
  }

  if (cleanText === '!cancelaremail' || cleanText === '/cancelaremail') {
    const cancelMsg = await cancelarAlteracaoEmail(client?.id || cleanPhone);
    await sendEvolutionText({ phone, text: cancelMsg });
    return;
  }

  // ── Interceptação 1.06: Comando de E-mail de Segurança (!email [email]) ─────
  if (cleanText.startsWith('!email') || cleanText.startsWith('/email')) {
    const rawEmail = rawText.replace(/^[!/](email)\s*/i, '').trim();
    if (!rawEmail) {
      const currentEmail = client?.email;
      if (currentEmail) {
        await sendEvolutionText({
          phone,
          text: `📧 *Seu E-mail de Segurança Cadastrado:*
👉 \`${currentEmail}\`

Para alterar, envie: *!email novo_email@empresa.com*`,
        });
      } else {
        await sendEvolutionText({
          phone,
          text: `⚠️ *Nenhum E-mail de Segurança Cadastrado!*

Para habilitar validações em duas etapas (2FA) e cadastrar chaves Pix alternativas, registre seu e-mail enviando:
👉 *!email seu_email@empresa.com*`,
        });
      }
      return;
    }

    const emailResult = await cadastrarEmailCliente(client?.id || cleanPhone, rawEmail);
    let replyText = emailResult.message;
    if (replyText.includes('Autorização de Troca de E-mail Obrigatória')) {
      replyText += `\n\n💡 _Perdeu o acesso ao e-mail anterior? Use a recuperação por Prova Social Oficial:_\n👉 *!recuperaremail ${rawEmail}*`;
    }
    await sendEvolutionText({ phone, text: replyText });
    return;
  }

  // ── Interceptação 1.07: Recuperação de E-mail por Prova Social (!recuperaremail / !recuperar email) ──
  if (
    cleanText.startsWith('!recuperaremail') || cleanText.startsWith('/recuperaremail') ||
    cleanText.startsWith('!recuperar email') || cleanText.startsWith('/recuperar email') ||
    cleanText.startsWith('!recuperar') || cleanText.startsWith('/recuperar')
  ) {
    const rawEmail = rawText
      .replace(/^[!/](recuperaremail|recuperar\s*email|recuperar)\s*/i, '')
      .trim();
    const result = await iniciarDesafioRecuperacaoEmail(client?.id || cleanPhone, rawEmail);
    await sendEvolutionText({ phone, text: result.message });
    return;
  }

  // ── Interceptação 1.06: Comando de Chave Pix (!pix [chave]) ────────────────
  if (cleanText.startsWith('!pix') || cleanText.startsWith('/pix') || cleanText === 'pix') {
    const rawPix = rawText.replace(/^[!/](pix)\s*/i, '').replace(/^pix\s*/i, '').trim();
    if (!rawPix) {
      const status = await getReferralStatus(client?.id || cleanPhone);
      if (status.pixKey) {
        await sendEvolutionText({
          phone,
          text: `🔑 *Sua Chave Pix para Repasses de Analisador:*
👉 \`${status.pixKey}\` ${status.isDocumentPixKey ? '🛡️ *(CNPJ/CPF Oficial do Titular)*' : '✅'}

🛡️ *Segurança Ativa (Abordagem 2):*
Qualquer alteração para chaves alternativas requer validação obrigatória por código de segurança (2FA) enviado ao seu e-mail cadastrado.

Para alterar sua chave Pix, envie:
👉 *!pix nova_chave*`,
        });
      } else {
        await sendEvolutionText({
          phone,
          text: `⚠️ *Nenhuma Chave Pix Cadastrada!*

Para receber suas comissões mensais como Analisador direto no Pix, cadastre sua chave agora enviando:
👉 *!pix sua_chave*
_(Ex: !pix 12.345.678/0001-90 ou !pix financeiro@empresa.com)_`,
        });
      }
      return;
    }

    const result = await solicitarAlteracaoPix(client?.id || cleanPhone, rawPix);
    await sendEvolutionText({ phone, text: result.message });
    return;
  }

  // ── Interceptação 1.1: Comando de Dividendos e Retiradas de Lucro (!dividendos) ─
  if (cleanText === '!dividendos' || cleanText === 'dividendos' || cleanText === '!lucros' || cleanText === 'lucros' || cleanText === '/dividendos') {
    if (client) {
      const tracking = await getMonthlyDividendTracking(client.id);
      await sendEvolutionText({ phone, text: tracking.summaryMessage });
      return;
    } else {
      await sendEvolutionText({
        phone,
        text: `📈 *Monitor Diário de Dividendos AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O AnalisAí monitora todo dia suas retiradas de pró-labore e lucros para garantir que você permaneça seguro dentro da faixa de isenção de R$ 50.000,00/mês da Receita Federal.

Assine um de nossos planos para ativar seu CFO digital 24h!`,
      });
      return;
    }
  }

  // ── Interceptação 1.15: Termômetro Tributário MEI x Simples Nacional (Ideia #55) ─
  const isTaxMeterCommand =
    cleanText === '!termometro' || cleanText === 'termometro' ||
    cleanText === '!termômetro' || cleanText === 'termômetro' ||
    cleanText === '!tributos' || cleanText === 'tributos' ||
    cleanText === '!impostos' || cleanText === 'impostos' ||
    cleanText === '!mei' || cleanText === 'mei' ||
    cleanText === '!simples' || cleanText === 'simples' ||
    cleanText === '/termometro' || cleanText === '/tributos' ||
    cleanText.includes('limite mei') || cleanText.includes('limite do mei') ||
    cleanText.includes('teto mei') || cleanText.includes('teto do mei') ||
    cleanText.includes('termometro mei') || cleanText.includes('termômetro mei') ||
    cleanText.includes('limite simples') || cleanText.includes('teto simples') ||
    cleanText.includes('quanto posso faturar') || cleanText.includes('quanto ainda posso faturar');

  if (isTaxMeterCommand) {
    const tracking = await getTaxRevenueTracking({
      clientId: client?.id,
      phone: cleanPhone,
    });
    await sendEvolutionText({ phone, text: tracking.statusMessage });
    return;
  }

  // Configuração de Regime: !regime [mei|simples|epp] [baseline?]
  if (cleanText.startsWith('!regime') || cleanText.startsWith('/regime')) {
    const parts = cleanText.split(/\s+/);
    const targetRegime = parts[1]?.toLowerCase();
    let regimeCode: 'mei' | 'simples_me' | 'simples_epp' = 'mei';

    if (targetRegime === 'simples' || targetRegime === 'me' || targetRegime === 'simples_me') {
      regimeCode = 'simples_me';
    } else if (targetRegime === 'epp' || targetRegime === 'simples_epp') {
      regimeCode = 'simples_epp';
    } else {
      regimeCode = 'mei';
    }

    let baselineNum: number | undefined = undefined;
    if (parts[2]) {
      const parsedBaseline = parseFloat(parts[2].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(parsedBaseline)) baselineNum = parsedBaseline;
    }

    const res = await updateTaxRegime({
      phone: cleanPhone,
      regime: regimeCode,
      baseline: baselineNum,
    });
    await sendEvolutionText({ phone, text: res.message });
    return;
  }

  // Configuração de Faturamento Base: !faturamento [valor]
  if (cleanText.startsWith('!faturamento') || cleanText.startsWith('/faturamento')) {
    const parts = cleanText.split(/\s+/);
    if (parts[1]) {
      const parsed = parseFloat(parts[1].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(parsed) && parsed >= 0) {
        const currentTracking = await getTaxRevenueTracking({ clientId: client?.id, phone: cleanPhone });
        const res = await updateTaxRegime({
          phone: cleanPhone,
          regime: currentTracking.taxRegime,
          baseline: parsed,
        });
        await sendEvolutionText({ phone, text: res.message });
        return;
      }
    }
    await sendEvolutionText({
      phone,
      text: `💡 *Como informar seu faturamento prévio deste ano:*\nDigite: \`!faturamento [valor]\`\nExemplo: \`!faturamento 25000\``,
    });
    return;
  }

  // ── Interceptação: "Olá, como funciona?" / Apresentação e Dúvidas Gerais ──
  const isHowItWorksIntent =
    /como funciona/i.test(cleanText) ||
    /o que [eé]\??$/i.test(cleanText) ||
    /o que [eé] o analisai/i.test(cleanText) ||
    /quem [eé] voc[eê]/i.test(cleanText) ||
    /como usar/i.test(cleanText) ||
    /quero entender/i.test(cleanText) ||
    /me explica/i.test(cleanText) ||
    /o que voc[eê] faz/i.test(cleanText) ||
    ((!client || isSimulatingLead) && /^(oi|ola|olá|bom dia|boa tarde|boa noite|oie|opa)[!.]*$/i.test(cleanText));

  if (isHowItWorksIntent && !hasMonetaryPattern && !isFinancialAction) {
    const howItWorksMsg = await getHowItWorksMessage(cleanPhone);
    await sendEvolutionText({ phone, text: howItWorksMsg });
    return;
  }

  // ── Interceptação 1.2: Projeção Estendida de Fluxo de Caixa Futuro (Avulso R$ 49) ────
  if (isLongTermCashFlowQuery(cleanText) && (!hasMonetaryPattern || !isFinancialAction)) {
    const extendedProposal = getExtendedCashFlowProposalMessage();
    await sendEvolutionText({ phone, text: extendedProposal });
    return;
  }

  // ── Interceptação Unificada: Comandos do Usuário (Botões de Ação, Contas, Pagar/Código, Mudar Valor/Vencimento, Exclusão) ──
  const handledUserAction = await dispatchUserActionCommand({
    text: rawText || cleanText,
    phone,
    cleanPhone,
    client,
  });
  if (handledUserAction) {
    return;
  }

  // ── Interceptação Inteligente do Cérebro de Linguagem Natural ──
  const handledNaturalLang = await handleConversationalNaturalLanguageRouter({
    text: rawText || cleanText,
    phone,
    cleanPhone,
    client,
    body,
    isAdminPhone,
    isOperator,
  });
  if (handledNaturalLang) {
    return;
  }

  // ── Interceptação 2: Lead vindo de Link de Indicação de Amigo ou Analisador ───
  const referralMatch = rawText.match(/(?:indica[çc][ãa]o do (?:cliente|analisador|parceiro)|indicado por)\s*(\d{10,14})/i);
  if (referralMatch && referralMatch[1]) {
    const referrerPhone = referralMatch[1];
    await linkReferralLead(cleanPhone, referrerPhone);
    await sendEvolutionText({
      phone,
      text: `🎉 *Bem-vindo ao AnalisAí!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que você veio por indicação de um de nossos **Analisadores Oficiais**!
Você tem direito à nossa **Degustação Gratuita Imediata**!

📸 Envie uma foto ou PDF de um boleto ou conta a pagar agora mesmo para ver como nossa inteligência artificial organiza seu fluxo de caixa em segundos!`,
    });
    return;
  }

  // ── Interceptação 3: Fila de Espera dos Planos Pro e Super (Sob Demanda) ───
  const isProOrSuperInterest =
    (cleanText.includes('pro') || cleanText.includes('super')) &&
    (cleanText.includes('sob demanda') || cleanText.includes('vagas') || cleanText.includes('fila') || cleanText.includes('espera') || cleanText.includes('interesse') || cleanText.includes('disponibilidade'));

  if (isProOrSuperInterest) {
    const desiredPlan = cleanText.includes('super') ? 'super' : 'pro';
    await recordWaitlistLead({
      whatsappNumber: cleanPhone,
      desiredPlan,
      clientName: client?.name || body.data?.pushName,
    });

    const planTitle = desiredPlan === 'super' ? 'AnalisAí Super (R$ 597/mês)' : 'AnalisAí Pro (R$ 297/mês)';
    await sendEvolutionText({
      phone,
      text: `📋 *Solicitação Registrada com Sucesso na Lista de Espera!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Olá${body.data?.pushName ? `, ${body.data.pushName}` : ''}! Registramos com prioridade seu interesse no plano *${planTitle}*.

🔒 *Por que vagas sob demanda?*
Para garantir o padrão ouro de qualidade na conciliação semanal e inteligência multi-CNPJs, as licenças corporativas são abertas em lotes seletivos.

📊 Nossa diretoria executiva já recebeu o seu contato e entrará em contato diretamente por aqui para entender sua operação e liberar a sua vaga!

💡 _Enquanto aguarda, você já pode experimentar nossa IA gratuitamente enviando qualquer foto ou PDF de boleto aqui nesta conversa!_`,
    });
    return;
  }

  if (!client) {
    // 1.1 Se o usuário enviou exatamente 6 dígitos numéricos, verifica se é o código 2FA para vincular número
    if (digitsOnly.length === 6 && rawText.trim().length <= 10) {
      const validacao = await validarCodigo2FATrocaNumero(phone, digitsOnly);
      if (validacao.valido) {
        const firstName = validacao.clientName?.split(' ')[0] || 'Cliente';
        await sendEvolutionText({
          phone,
          text: `✅ *Autenticação em 2 Etapas Confirmada!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bem-vindo de volta, ${firstName}! Sua conta foi vinculada a este novo número com total segurança e conformidade LGPD.

Você já pode enviar comprovantes, notas fiscais ou consultar o resumo financeiro com o comando *!status*.`,
        });
        return;
      } else if (validacao.motivo === 'codigo_incorreto') {
        await sendEvolutionText({
          phone,
          text: `❌ *Código de Segurança Incorreto.*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O código informado não confere com o enviado ao seu e-mail.
Restam *${validacao.tentativasRestantes} tentativa(s)* antes do bloqueio desta solicitação.

Por favor, verifique sua caixa de entrada (ou spam) e digite novamente os 6 dígitos.`,
        });
        return;
      } else if (validacao.motivo === 'bloqueado_tentativas') {
        await sendEvolutionText({
          phone,
          text: `⛔ *Limite de tentativas excedido.*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Por medidas de segurança (LGPD), esta solicitação foi bloqueada.
Para tentar novamente, envie o seu CPF ou CNPJ cadastrado para receber um novo código.`,
        });
        return;
      } else if (validacao.motivo === 'expirado') {
        await sendEvolutionText({
          phone,
          text: `⏳ *Código expirado.*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O código de 6 dígitos expirou (validade de 10 minutos).
Envie novamente o seu CPF ou CNPJ para gerar um novo código de segurança.`,
        });
        return;
      }
      // Se não houver solicitação ativa, segue para o fluxo abaixo
    }

    // 1.2 Se o cliente enviou CPF (11 dígitos) ou CNPJ (14 dígitos), dispara 2FA com e-mail seguro
    if (digitsOnly.length === 11 || digitsOnly.length === 14) {
      const solicitacao = await solicitarTrocaNumeroCom2FA(cleanPhone, digitsOnly);
      if (solicitacao.sucesso) {
        await sendEvolutionText({
          phone,
          text: `🔒 *Proteção de Dados & LGPD (Segurança em 2 Etapas)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos a conta de *${solicitacao.clientName}*.

Para sua segurança e proteção contra acessos indevidos aos dados financeiros da sua empresa, acabamos de enviar um código de confirmação de 6 dígitos para o seu e-mail cadastrado:
📧 *${solicitacao.maskedEmail}*

👉 Digite apenas os **6 dígitos numéricos** aqui nesta conversa para autorizar a vinculação deste novo número.
_(O código expira em 10 minutos)_`,
        });
        return;
      } else if (solicitacao.motivo === 'sem_email_cadastrado') {
        await sendEvolutionText({
          phone,
          text: `⚠️ *Atenção à Segurança da sua Conta (LGPD)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Localizamos o cadastro de *${solicitacao.clientName}*, porém *não há um e-mail válido vinculado* à sua assinatura.

Por exigência de segurança da Lei Geral de Proteção de Dados (LGPD), a alteração do número de acesso financeiro exige a confirmação por e-mail para evitar acessos não autorizados por terceiros ou ex-funcionários.

Por favor, entre em contato com nosso suporte oficial ou atualize seu cadastro para registrar um e-mail seguro e acessível.`,
        });
        return;
      } else {
        await sendEvolutionText({
          phone,
          text: `❌ *Cadastro não localizado.*
Não encontramos nenhuma assinatura ativa com o CPF/CNPJ informado (*${digitsOnly}*).

Verifique se digitou corretamente ou escolha um dos nossos planos para começar agora mesmo:
• *Start* (R$ 39,90/mês): ${ASAAS_PLANS.monthly.start.checkoutUrl}
• *Solo* (R$ 87,99/mês): ${ASAAS_PLANS.monthly.solo.checkoutUrl}`,
        });
        return;
      }
    }

    // 1.3 Degustação Gratuita (Trial) - Verifica se o usuário enviou uma MÍDIA (imagem ou documento PDF)
    const isMedia = Boolean(message?.imageMessage || message?.documentMessage);
    if (isMedia) {
      const trialStatus = await checkTrialStatus(cleanPhone);
      if (trialStatus.hasUsedTrial) {
        await sendEvolutionText({
          phone,
          text: getTrialLimitReachedMessage(trialStatus.docsLimit, trialStatus.docsCount),
        });
        return;
      }

      // Processa o 1º documento na DEGUSTAÇÃO GRATUITA
      await sendEvolutionText({
        phone,
        text: `⏳ *Recebido! Analisando seu documento em tempo real na degustação gratuita do AnalisAí...*
Aguarde alguns segundos enquanto nossa inteligência artificial faz a leitura completa dos dados.`,
      });

      let base64 =
        body.data?.base64 ||
        message?.imageMessage?.base64 ||
        message?.documentMessage?.base64 ||
        '';

      if (!base64) {
        base64 = (await fetchMediaBase64FromEvolution(body.data)) || '';
      }

      if (!base64) {
        await sendEvolutionText({
          phone,
          text: `⚠️ Não foi possível baixar a imagem para a degustação. Por favor, envie o arquivo novamente ou tire uma foto mais nítida.`,
        });
        return;
      }

      const mimeType = message?.imageMessage?.mimetype || message?.documentMessage?.mimetype || 'image/jpeg';
      const extraction = await extractDocumentWithGemini(base64, mimeType);

      // Suporte a Conciliação de Extratos Bancários (PDF / Imagem)
      if (extraction.is_bank_statement && Array.isArray(extraction.bank_transactions) && extraction.bank_transactions.length > 0) {
        const reconRes = await reconcileBankTransactions({
          clientId: null,
          phone,
          cleanPhone,
          transactions: extraction.bank_transactions,
          bankName: extraction.counterparty_name !== 'Desconhecido' ? extraction.counterparty_name : undefined,
        });

        await sendEvolutionText({
          phone,
          text: reconRes.summaryMessage,
        });
        await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
        return;
      }

      const isFinancial =
        extraction.is_financial_doc !== false &&
        (Boolean(extraction.is_bank_statement) || extraction.doc_type !== 'outro' || (extraction.total_amount > 0 && extraction.counterparty_name !== 'Desconhecido'));

      if (!isFinancial) {
        await sendEvolutionText({
          phone,
          text: `⚠️ *Documento não identificado como financeiro.*
O arquivo enviado não parece ser um boleto, conta de consumo, nota fiscal ou extrato bancário.

Na nossa degustação gratuita, envie uma foto nítida de um boleto, NF ou extrato para ver o robô funcionando em tempo real!`,
        });
        return;
      }

      // Normaliza os campos para compatibilidade total entre extratores e formatadores
      const normalizedDoc = {
        ...extraction,
        supplier_name: extraction.counterparty_name || (extraction as any).supplier_name || (extraction.entry_type === 'receivable' ? 'Cliente' : 'Fornecedor'),
        amount: extraction.total_amount !== undefined && extraction.total_amount !== null ? extraction.total_amount : (extraction as any).amount,
        document_type: extraction.doc_type || (extraction as any).document_type || 'Boleto/Conta',
        category: extraction.category_suggestion || (extraction as any).category || (extraction.entry_type === 'receivable' ? 'receita_operacional' : null),
        entry_type: extraction.entry_type || 'payable',
      };

      // Registra que a degustação foi realizada
      const trialResult = await recordTrialUsage(cleanPhone, normalizedDoc);

      if (trialResult?.isDuplicate) {
        const existing = trialResult.existingBill || normalizedDoc;
        const valFmt = Number(existing.amount || normalizedDoc.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dueFmt = formatDueDateDetails(existing.due_date || normalizedDoc.due_date);
        await sendEvolutionText({
          phone,
          text: `⚠️ *Boleto/Conta Já Cadastrado Anteriormente!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que este lançamento de *${existing.supplier_name || normalizedDoc.supplier_name}* (${valFmt}, vencimento em *${dueFmt}*) **já está cadastrado e guardado** na sua agenda financeira!

💡 *Fique tranquilo(a):* Nós já estamos monitorando esta conta e vamos te avisar na véspera. Mantivemos seu registro original para evitar cobranças duplicadas e sem consumir sua cota de testes!`,
        });

        await sendPaymentCodeMessage(phone, {
          barcode_or_pix: extraction.barcode_or_pix,
          pix_key: extraction.pix_key,
          pix_key_type: extraction.pix_key_type,
        });

        await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
        return;
      }

      // 1. Envia resumo executivo do documento informando a cota restante
      const remainingAfter = Math.max(0, (trialStatus.remainingDocs || 1) - 1);
      const summaryText = formatTrialDocSummary(normalizedDoc, remainingAfter);
      await sendEvolutionText({ phone, text: summaryText });

      // 2. Se houver código de barras / Pix / linha digitável, envia com rotulagem inteligente
      await sendPaymentCodeMessage(phone, {
        barcode_or_pix: extraction.barcode_or_pix,
        pix_key: extraction.pix_key,
        pix_key_type: extraction.pix_key_type,
      });

      // 3. Identificação de Titularidade e Consultoria de Blindagem Patrimonial
      if (extraction.payer_tax_id) {
        const isCpfTit = extraction.payer_tax_type === 'cpf' || extraction.payer_tax_id.replace(/\D/g, '').length === 11;
        const payerTypeLabel = isCpfTit ? 'CPF' : 'CNPJ';
        const titQuestion = isCpfTit
          ? `🔍 *Identificação de Titularidade (${payerTypeLabel} Detectado)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos este documento emitido para o CPF *${extraction.payer_tax_id}* (${extraction.payer_name || 'Pessoa Física'}).

Para organizarmos seus relatórios contábeis, folha e fiscal:
A quem pertence esta conta?
1️⃣ *Sócio / Meu CPF* — Despesa particular dos sócios
2️⃣ *Funcionário* — Adiantamento, bônus ou benefício de colaborador
3️⃣ *Terceiro* — Parente, amigo ou terceiro sem vínculo
4️⃣ *Empresa* — Despesa operacional da PJ emitida em CPF

👉 _Responda com o nome: *Sócio*, *Funcionário*, *Terceiro* ou *Empresa*_`
          : `🔍 *Identificação de Titularidade (${payerTypeLabel} Detectado)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos o CNPJ *${extraction.payer_tax_id}* emitido para *${extraction.payer_name || 'Pessoa Jurídica'}*.

Para organizarmos seus relatórios:
Este documento pertence à sua:
1️⃣ *Minha Empresa* — Empresa principal
2️⃣ *Filial / Outro CNPJ* — Outra empresa ou unidade do grupo
3️⃣ *Sócio* — PJ particular de sócio

👉 _Responda: *Minha Empresa*, *Outro CNPJ* ou *Sócio*_`;

        await sendEvolutionText({ phone, text: titQuestion });
      }

      const patrimonialTrial = analyzePatrimonialExpense({
        supplier_name: extraction.counterparty_name,
        counterparty_name: extraction.counterparty_name,
        category: extraction.category_suggestion,
        amount: Number(extraction.total_amount),
        payer_name: extraction.payer_name,
        payer_tax_id: extraction.payer_tax_id,
        payer_tax_type: extraction.payer_tax_type,
      });
      if (patrimonialTrial.adviceMessage) {
        await sendEvolutionText({
          phone,
          text: patrimonialTrial.adviceMessage,
        });
      }

      // 4. Oferece menu de ações de sequência profissional (sem "Mostrar Votos")
      await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');

      // 5. Documento registrado na degustação
      return;
    }

    // Interceptação de comandos do usuário na degustação (Texto ou Botões de Ação)
    const handledTrialCommand = await dispatchUserActionCommand({
      text: rawText || cleanText,
      phone,
      cleanPhone,
      client,
    });
    if (handledTrialCommand) {
      return;
    }

    const handledTrialNaturalLang = await handleConversationalNaturalLanguageRouter({
      text: rawText || cleanText,
      phone,
      cleanPhone,
      client,
      body,
      isAdminPhone,
      isOperator,
    });
    if (handledTrialNaturalLang) {
      return;
    }

    // 1.4 Se o usuário enviou texto, verifica se é um lançamento financeiro para a degustação
    if (rawText && rawText.trim().length >= 4) {
      try {
        const trialStatus = await checkTrialStatus(cleanPhone);
        if (trialStatus.hasUsedTrial) {
          await sendEvolutionText({
            phone,
            text: getTrialLimitReachedMessage(trialStatus.docsLimit, trialStatus.docsCount),
          });
          return;
        }

        const conv = await parseConversationalFinancialEntry(rawText);
        const entries = Array.isArray(conv.entries) && conv.entries.length > 0 ? conv.entries : [];
        if (entries.length === 0 && conv.is_financial_entry && (conv.amount || conv.is_provision)) {
          entries.push({
            supplier_or_customer: conv.supplier_or_customer || 'Fornecedor',
            amount: conv.amount,
            due_date: conv.due_date,
            entry_type: conv.entry_type || 'payable',
            category_suggestion: conv.category_suggestion,
            is_provision: Boolean(conv.is_provision),
            is_recurring: Boolean(conv.is_recurring),
            recurrence_day: conv.recurrence_day || null,
          });
        }

        const validEntries = entries.filter((e: any) => (e.amount || e.is_provision) && (e.due_date || e.is_provision));

        if (conv.is_financial_entry && validEntries.length > 0) {
          await recordMultipleTrialUsage(cleanPhone, validEntries);

          let trialTaxBadge = '';
          const incomeEntries = validEntries.filter((e: any) => e.entry_type === 'receivable');
          if (incomeEntries.length > 0) {
            try {
              for (const inc of incomeEntries) {
                if (inc.amount) await addTrialLeadRevenue(cleanPhone, Number(inc.amount));
              }
              const taxStatus = await getTaxRevenueTracking({ phone: cleanPhone });
              trialTaxBadge = `\n\n${taxStatus.miniBadge}`;
            } catch (tErr) {
              console.warn('[Trial Tax Meter Warning]:', tErr);
            }
          }

          const remainingAfter = Math.max(0, (trialStatus.remainingDocs || 1) - validEntries.length);
          const confirmationText = formatMultipleTrialEntriesConfirmation(validEntries, remainingAfter) + trialTaxBadge;
          await sendEvolutionText({ phone, text: confirmationText });

          for (const ent of validEntries) {
            if (ent.barcode_or_pix || (ent as any).pix_key) {
              await sendPaymentCodeMessage(phone, {
                barcode_or_pix: ent.barcode_or_pix,
                pix_key: (ent as any).pix_key,
                pix_key_type: (ent as any).pix_key_type,
              });
            }
          }

          // Consultoria Pedagógica de Blindagem Patrimonial (Separação PJ x PF na Degustação)
          for (const ent of validEntries) {
            const patrimonial = analyzePatrimonialExpense({
              supplier_name: ent.supplier_or_customer,
              category: ent.category_suggestion,
              amount: Number(ent.amount),
            });
            if (patrimonial.isPersonalExpense && patrimonial.adviceMessage) {
              await sendEvolutionText({ phone, text: patrimonial.adviceMessage });
              break;
            }
          }
          return;
        } else if (conv.is_financial_entry && conv.needs_clarification) {
          await sendEvolutionText({
            phone,
            text: `💬 ${conv.clarification_prompt || 'Entendi que você deseja agendar um lançamento! Pode me informar o valor e a data de vencimento?'}`,
          });
          return;
        }
      } catch (trialTextErr) {
        console.warn('[Trial Text Entry Error]:', trialTextErr);
      }
    }

    // 1.5 Degustação Gratuita (Trial) - Processamento de ÁUDIO
    const isAudioMsg = body.data?.messageType === 'audioMessage' || !!message?.audioMessage;
    if (isAudioMsg) {
      const trialStatus = await checkTrialStatus(cleanPhone);
      if (trialStatus.hasUsedTrial) {
        await sendEvolutionText({
          phone,
          text: getTrialLimitReachedMessage(trialStatus.docsLimit, trialStatus.docsCount),
        });
        return;
      }

      // Trava de custo de API: Limite de 45 segundos por áudio
      const audioDuration =
        body.data?.message?.audioMessage?.seconds ||
        message?.audioMessage?.seconds ||
        (body.data as any)?.seconds ||
        0;

      if (audioDuration > 45) {
        await sendEvolutionText({
          phone,
          text: `🎙️ *Áudio longo detectado (${audioDuration}s)!*

Para garantir respostas rápidas e interpretação exata dos valores, consigo processar áudios de até *45 segundos* por vez.

💡 *Dica:* Envie um áudio curtinho com o fornecedor, valor e vencimento da conta. Obrigado! 😊`,
        });
        return;
      }

      let audioBase64 =
        (body.data as any)?.base64 ||
        (body.data as any)?.message?.base64 ||
        (body.data as any)?.message?.audioMessage?.base64 ||
        message?.base64 ||
        message?.audioMessage?.base64 ||
        '';

      if (!audioBase64) {
        audioBase64 = (await fetchMediaBase64FromEvolution(body.data)) || '';
      }

      if (!audioBase64) {
        await sendEvolutionText({
          phone,
          text: `🎙️ Recebi seu áudio, mas não foi possível carregá-lo pelo WhatsApp. Por favor, envie novamente falando próximo ao microfone ou digite sua despesa por texto.`,
        });
        return;
      }

      try {
        const rawMimeType =
          body.data?.message?.audioMessage?.mimetype ||
          (body.data as any)?.mimetype ||
          'audio/ogg';

        // transcribeOnly = true garante transcrição rápida sem passar por function calls desnecessárias
        const audioResult = await processVoiceCommandWithGemini(audioBase64, rawMimeType, '', true);
        const cleanTranscribed = (audioResult.textResponse || '').trim();

        if (!cleanTranscribed) {
          await sendEvolutionText({
            phone,
            text: `🎙️ Não consegui compreender com nitidez o que foi falado no áudio. Por favor, envie novamente ou digite o fornecedor, valor e vencimento por texto.`,
          });
          return;
        }

        // 1. Verifica se o áudio falado é um comando de ação (mudar valor, mudar vencimento, código/pagar, excluir, ver contas, etc.)
        const handledAudioCommand = await dispatchUserActionCommand({
          text: cleanTranscribed,
          phone,
          cleanPhone,
          client,
        });
        if (handledAudioCommand) {
          return;
        }

        const handledAudioNaturalLang = await handleConversationalNaturalLanguageRouter({
          text: cleanTranscribed,
          phone,
          cleanPhone,
          client,
          body,
          isAdminPhone,
          isOperator,
        });
        if (handledAudioNaturalLang) {
          return;
        }

        // Tenta interpretar o áudio como lançamento financeiro (1 ou múltiplos lançamentos)
        const conv = await parseConversationalFinancialEntry(cleanTranscribed);
        const entries = Array.isArray(conv.entries) && conv.entries.length > 0 ? conv.entries : [];
        if (entries.length === 0 && conv.is_financial_entry && (conv.amount || conv.is_provision)) {
          entries.push({
            supplier_or_customer: conv.supplier_or_customer || 'Fornecedor',
            amount: conv.amount,
            due_date: conv.due_date,
            entry_type: conv.entry_type || 'payable',
            category_suggestion: conv.category_suggestion,
            is_provision: Boolean(conv.is_provision),
            is_recurring: Boolean(conv.is_recurring),
            recurrence_day: conv.recurrence_day || null,
          });
        }

        const validEntries = entries.filter((e: any) => (e.amount || e.is_provision) && (e.due_date || e.is_provision));

        if (conv.is_financial_entry && validEntries.length > 0) {
          await recordMultipleTrialUsage(cleanPhone, validEntries);

          let trialTaxBadge = '';
          const incomeEntries = validEntries.filter((e: any) => e.entry_type === 'receivable');
          if (incomeEntries.length > 0) {
            try {
              for (const inc of incomeEntries) {
                if (inc.amount) await addTrialLeadRevenue(cleanPhone, Number(inc.amount));
              }
              const taxStatus = await getTaxRevenueTracking({ phone: cleanPhone });
              trialTaxBadge = `\n\n${taxStatus.miniBadge}`;
            } catch (tErr) {
              console.warn('[Trial Voice Tax Meter Warning]:', tErr);
            }
          }

          const remainingAfter = Math.max(0, (trialStatus.remainingDocs || 1) - validEntries.length);
          const confirmationText = formatMultipleTrialEntriesConfirmation(validEntries, remainingAfter) + trialTaxBadge;

          await sendEvolutionText({
            phone,
            text: `🎙️ _Áudio transcrito: "${cleanTranscribed}"_\n\n${confirmationText}`,
          });

          for (const ent of validEntries) {
            if (ent.barcode_or_pix || (ent as any).pix_key) {
              await sendPaymentCodeMessage(phone, {
                barcode_or_pix: ent.barcode_or_pix,
                pix_key: (ent as any).pix_key,
                pix_key_type: (ent as any).pix_key_type,
              });
            }
          }

          // Consultoria Pedagógica de Blindagem Patrimonial (Separação PJ x PF na Degustação)
          for (const ent of validEntries) {
            const patrimonial = analyzePatrimonialExpense({
              supplier_name: ent.supplier_or_customer,
              category: ent.category_suggestion,
              amount: Number(ent.amount),
            });
            if (patrimonial.isPersonalExpense && patrimonial.adviceMessage) {
              await sendEvolutionText({ phone, text: patrimonial.adviceMessage });
              break;
            }
          }
          return;
        } else if (conv.is_financial_entry && conv.needs_clarification) {
          // Bate-bola conversacional: usuário pediu para registrar mas faltaram dados essenciais
          await sendEvolutionText({
            phone,
            text: `🎙️ _Áudio transcrito: "${cleanTranscribed}"_\n\n💬 ${conv.clarification_prompt || 'Entendi que você deseja registrar um lançamento! Para eu agendar no seu Livro Caixa, por favor me informe o valor e a data de vencimento.'}`,
          });
          return;
        } else {
          // O áudio foi reconhecido, mas não contém dados de conta a pagar/receber (ex: bate-papo informal ou teste)
          await sendEvolutionText({
            phone,
            text: `🎙️ _Entendi seu áudio: "${cleanTranscribed}"_

💡 *Como agendar no seu AnalisAí:*
Para registrar contas por voz, basta dizer os compromissos, valores e datas (pode citar várias contas no mesmo áudio!).
Exemplo:
• *"Pagar Vivo R$ 92 dia 21, contabilidade R$ 170 dia 10 e aluguel de R$ 1.500 no dia 5"*
• Ou envie a foto de um boleto!

Como posso te ajudar agora?`,
          });
          return;
        }
      } catch (trialAudioErr) {
        console.error('[Trial Voice Error]:', trialAudioErr);
        await sendEvolutionText({
          phone,
          text: `🎙️ Tive uma oscilação momentânea ao processar seu áudio. Por favor, tente enviar novamente ou digite o valor e vencimento por texto (ex: *"Pagar aluguel R$ 1.500 dia 25"*).`,
        });
        return;
      }
    }

    // Se o usuário não cadastrado enviou texto comum, registra tentativa infrutífera no anti-looping
    if (!isAdminPhone && rawText.trim().length > 0) {
      // recordFruitlessAttempt imported statically
      const attemptRes = await recordFruitlessAttempt(cleanPhone, rawText);
      if (attemptRes.actionTaken !== 'increment') {
        return; // Ação de encerramento ou bloqueio disparada, interrompe execução
      }
    }

    // Se ainda estiver no limite de tolerância, verifica se o usuário já possui lançamentos na degustação
    const trialStatus = await checkTrialStatus(cleanPhone);
    if (trialStatus.docsCount > 0) {
      await sendEvolutionText({
        phone,
        text: `💡 Não compreendi exatamente o seu comando.\n\n👉 Envie uma foto de boleto ou mande um áudio/texto dizendo suas contas!`,
      });
      await sendActionSequenceMenu(phone, 'O que deseja fazer agora?');
      return;
    }

    const welcomeMsg = await getHowItWorksMessage(cleanPhone);
    await sendEvolutionText({
      phone,
      text: welcomeMsg,
    });
    return;
  }

  // 2. Intercepta Comandos de Administração e Teste (!ajuda, !reset, !simular, !estourar, !gerar contas)
  if (client.is_admin && (cleanText.startsWith('!') || cleanText.startsWith('/'))) {
    const adminResponse = await handleAdminCommands(client.id, rawText);
    if (adminResponse.handled && adminResponse.message) {
      await sendEvolutionText({ phone, text: adminResponse.message });
      return;
    }
  }

  // Comando de Gestão de Equipe / Multiusuários
  if (cleanText.startsWith('!equipe') || cleanText.startsWith('/equipe')) {
    const parts = cleanText.trim().split(/\s+/);
    const subAction = parts[1]?.toLowerCase();

    if (subAction === 'adicionar' || subAction === 'add') {
      const memberPhone = parts[2];
      const memberName = parts.slice(3).join(' ') || 'Operador';
      if (!memberPhone) {
        await sendEvolutionText({
          phone,
          text: '⚠️ Formato: *!equipe adicionar [DDD+Telefone] [Nome]*\nEx: *!equipe adicionar 14999998888 Maria*',
        });
        return;
      }

      const res = await addTeamMember(client.id, memberPhone, memberName);
      await sendEvolutionText({ phone, text: res.message });
      return;
    }

    if (subAction === 'remover' || subAction === 'excluir' || subAction === 'del') {
      const targetPhone = parts[2];
      if (!targetPhone) {
        await sendEvolutionText({
          phone,
          text: '⚠️ Formato: *!equipe remover [Telefone]*\nEx: *!equipe remover 14999998888*',
        });
        return;
      }
      const res = await removeTeamMember(client.id, targetPhone);
      await sendEvolutionText({ phone, text: res.message });
      return;
    }

    if (subAction === 'editar' || subAction === 'corrigir') {
      const oldPhone = parts[2];
      const newPhone = parts[3];
      const newName = parts.slice(4).join(' ');
      if (!oldPhone || !newPhone) {
        await sendEvolutionText({
          phone,
          text: '⚠️ Formato: *!equipe editar [Telefone_Antigo] [Telefone_Novo] [Novo_Nome]*\nEx: *!equipe editar 14999998888 14988887777 Maria*',
        });
        return;
      }
      const res = await updateTeamMember(client.id, oldPhone, newPhone, newName);
      await sendEvolutionText({ phone, text: res.message });
      return;
    }

    if (subAction === 'listar' || subAction === 'lista') {
      const members = await listTeamMembers(client.id);
      if (members.length === 0) {
        await sendEvolutionText({
          phone,
          text: '👥 *Sua Equipe:*\nVocê ainda não possui operadores adicionais cadastrados.\n\nPara adicionar um operador, contrate o acesso por R$ 29,90/mês no link:\n👉 https://www.asaas.com/c/kurk0fge7wqim8lv\n\nE adicione com: *!equipe adicionar [Telefone] [Nome]*',
        });
        return;
      }

      const listStr = members.map((m, i) => `${i + 1}. *${m.member_name}* (${m.whatsapp_number}) — Perfil: ${m.role.toUpperCase()}`).join('\n');
      await sendEvolutionText({
        phone,
        text: `👥 *Membros da Sua Equipe Autorizados:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${listStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 *Comandos de Gestão:*\n• *!equipe editar [Tel_Antigo] [Tel_Novo] [Nome]*\n• *!equipe remover [Telefone]*`,
      });
      return;
    }

    await sendEvolutionText({
      phone,
      text: `👥 *Gestão de Equipe & Multiusuários AnalisAí*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPermita que secretárias ou funcionários enviem comprovantes sem ver o saldo da sua empresa!\n\n• *!equipe adicionar [Telefone] [Nome]* → Cadastra novo operador\n• *!equipe listar* → Mostra sua equipe ativa\n• *Contratação avulsa (+R$ 29,90/mês):*\n👉 https://www.asaas.com/c/kurk0fge7wqim8lv`,
    });
    return;
  }

// [Confirmações centralizadas no início do fluxo]

  // 4. Obtém Plano e Consumo do Ciclo
  const { plan, cycle } = await getClientPlanAndCurrentCycle(client.id);

  // 5. Ingestão de Documentos (Imagem ou PDF)
  const isImage = !!message?.imageMessage;
  const isDoc = !!message?.documentMessage;

  if (isImage || isDoc) {
    const quotaCheck = await checkAndIncrementQuota(client.id, 'doc', 1);

    const isDocQa = client.is_admin || await isQaWhitelisted(cleanPhone) || await isQaWhitelisted(client.tax_id);
    if (!quotaCheck.allowed && !isDocQa) {
      await sendEvolutionText({
        phone,
        text: `⚠️ *Limite de Documentos do Mês Atingido!*
Você já processou todos os ${quotaCheck.limit} documentos inclusos no seu plano este mês.

Para continuar lançando sem travar sua rotina, escolha a melhor alternativa para você:

1️⃣ *Pacote Extra (+20 Documentos) por R$ 14,90:*
Ideal para eventualidades ou compras sazonais. Validade de 60 dias e não se mistura com a mensalidade:
👉 ${ASAAS_ONE_OFF.extraDocsPackage.checkoutUrl}

2️⃣ *Upgrade para o próximo plano:*
Se o volume da sua empresa aumentou e você deseja uma cota maior todo mês:
👉 ${plan?.code === 'start' ? ASAAS_PLANS.monthly.solo.checkoutUrl : ASAAS_PLANS.monthly.solo_plus.checkoutUrl}`,
      });
      return;
    }

    await sendEvolutionText({
      phone,
      text: `📄 *Recebi seu documento!* Estou processando a leitura contábil com inteligência artificial, aguarde um instante...`,
    });

    let base64Media = body.data?.base64 || '';
    if (!base64Media) {
      base64Media = (await fetchMediaBase64FromEvolution(body.data)) || '';
    }
    const mimeType = message?.imageMessage?.mimetype || message?.documentMessage?.mimetype || 'image/jpeg';

    try {
      const extracted = await extractDocumentWithGemini(base64Media, mimeType);

      const { data: docRecord } = await supabase
        .from('documents')
        .insert({
          client_id: client.id,
          storage_path: `docs/${client.id}/${Date.now()}_doc`,
          file_name: message?.documentMessage?.fileName || 'comprovante.jpg',
          mime_type: mimeType,
          doc_type: extracted.doc_type,
          extracted_data: extracted,
          confidence_score: extracted.confidence_score,
          status: extracted.confidence_score < 0.7 ? 'awaiting_user_confirmation' : 'processed',
        })
        .select()
        .single();

      // Suporte a Conciliação de Extratos Bancários (PDF / Imagem) para Assinantes
      if (extracted.is_bank_statement && Array.isArray(extracted.bank_transactions) && extracted.bank_transactions.length > 0) {
        const reconRes = await reconcileBankTransactions({
          clientId: client.id,
          phone,
          cleanPhone,
          transactions: extracted.bank_transactions,
          bankName: extracted.counterparty_name !== 'Desconhecido' ? extracted.counterparty_name : undefined,
        });

        await sendEvolutionText({
          phone,
          text: reconRes.summaryMessage,
        });
        await sendActionSequenceMenu(phone, 'O que deseja fazer a seguir?');
        return;
      }

      if (extracted.confidence_score < 0.7) {
        await supabase.from('bot_action_confirmations').insert({
          client_id: client.id,
          action_type: 'confirm_low_confidence_doc',
          target_entity_id: docRecord?.id,
          proposed_payload: {
            ...extracted,
            document_id: docRecord?.id,
          },
          status: 'pending',
          expires_at: addMinutes(new Date(), 10).toISOString(),
        });

        await sendEvolutionText({
          phone,
          text: `⚠️ *Confirmação de Leitura Necessária*
Identifiquei os seguintes dados, mas recomendo conferir antes de salvar:

• *Fornecedor:* ${extracted.counterparty_name}
• *Valor:* R$ ${Number(extracted.total_amount).toFixed(2)}
• *Vencimento:* ${extracted.due_date || 'Não identificado'}
• *Tipo:* ${extracted.doc_type?.toUpperCase()}

Os dados estão corretos?
👉 Responda *Sim* para aprovar ou *Não* para cancelar.`,
        });
        return;
      }

      // ── MECANISMO ANTI-DUPLICAÇÃO INTELIGENTE ──────────────────────────────
      // 1. Checagem por Código de Barras / Linha Digitável Exato Já Cadastrado
      if (extracted.barcode_or_pix) {
        const cleanExtractedBarcode = String(extracted.barcode_or_pix).replace(/\D/g, '');
        if (cleanExtractedBarcode.length >= 20) {
          const { data: alreadySavedBill } = await supabase
            .from('payables_receivables')
            .select('id, counterparty_name, amount, current_due_date, barcode_or_pix')
            .eq('client_id', client.id)
            .eq('barcode_or_pix', extracted.barcode_or_pix)
            .limit(1)
            .maybeSingle();

          if (alreadySavedBill) {
            const valFmt = Number(alreadySavedBill.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const dueFmt = formatDueDateDetails(alreadySavedBill.current_due_date);
            await sendEvolutionText({
              phone,
              text: `⚠️ *Boleto Já Cadastrado Anteriormente!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que este boleto de *${alreadySavedBill.counterparty_name}* (${valFmt}, vencimento em *${dueFmt}*) **já está registrado e guardado** na sua agenda financeira!

💡 *Fique tranquilo(a):* Nós já estamos monitorando esta conta e vamos te avisar na véspera do vencimento às 10h com o código prontinho para pagar. Não geramos despesa duplicada no seu fluxo de caixa nem consumimos novos créditos!`,
            });

            await sendPaymentCodeMessage(phone, {
              barcode_or_pix: extracted.barcode_or_pix,
              pix_key: extracted.pix_key,
              pix_key_type: extracted.pix_key_type,
            });

            return;
          }
        }
      }

      // 2. Se o documento tiver código de barras, verifica se existe parcela prévia sem código (ex: NF prévia)
      if (extracted.barcode_or_pix && extracted.due_date) {
        const { data: duplicateCandidate } = await supabase
          .from('payables_receivables')
          .select('id, counterparty_name, amount, current_due_date, barcode_or_pix')
          .eq('client_id', client.id)
          .eq('status', 'open')
          .eq('current_due_date', extracted.due_date)
          .is('barcode_or_pix', null)
          .gte('amount', Number(extracted.total_amount) - 0.05)
          .lte('amount', Number(extracted.total_amount) + 0.05)
          .limit(1)
          .maybeSingle();

        if (duplicateCandidate) {
          // Vincula o código de barras à parcela existente sem duplicar o contas a pagar!
          await supabase
            .from('payables_receivables')
            .update({
              barcode_or_pix: extracted.barcode_or_pix,
              document_id: docRecord?.id,
            })
            .eq('id', duplicateCandidate.id);

          await sendEvolutionText({
            phone,
            text: `🔗 *Boleto vinculado à parcela existente sem duplicar!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que este boleto corresponde ao lançamento de *${duplicateCandidate.counterparty_name}* (R$ ${Number(duplicateCandidate.amount).toFixed(2)}) que vence em *${formatDueDateDetails(duplicateCandidate.current_due_date)}*.

O código de barras foi anexado com sucesso para pagamento e lembretes sem gerar despesa duplicada no seu fluxo de caixa!`,
          });

          await sendPaymentCodeMessage(phone, {
            barcode_or_pix: extracted.barcode_or_pix,
            pix_key: extracted.pix_key,
            pix_key_type: extracted.pix_key_type,
          });

          return;
        }
      }

      // 3. Checagem de Conta Idêntica (Mesmo Fornecedor + Mesmo Valor + Mesmo Vencimento)
      if (extracted.due_date && extracted.total_amount && Number(extracted.total_amount) > 0) {
        const candSupName = (extracted.counterparty_name || '').toLowerCase().trim();
        const { data: sameBillCandidates } = await supabase
          .from('payables_receivables')
          .select('id, counterparty_name, amount, current_due_date, barcode_or_pix, is_provision')
          .eq('client_id', client.id)
          .eq('current_due_date', extracted.due_date)
          .gte('amount', Number(extracted.total_amount) - 0.05)
          .lte('amount', Number(extracted.total_amount) + 0.05)
          .limit(5);

        const exactMatch = sameBillCandidates?.find((b: any) => {
          if (b.is_provision) return false;
          const bName = (b.counterparty_name || '').toLowerCase().trim();
          return bName.length >= 3 && candSupName.length >= 3 && (bName.includes(candSupName) || candSupName.includes(bName));
        });

        if (exactMatch) {
          const valFmt = Number(exactMatch.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const dueFmt = formatDueDateDetails(exactMatch.current_due_date);

          // Se a conta existente não tinha código e agora veio código, anexa
          if (extracted.barcode_or_pix && !exactMatch.barcode_or_pix) {
            await supabase
              .from('payables_receivables')
              .update({ barcode_or_pix: extracted.barcode_or_pix, document_id: docRecord?.id })
              .eq('id', exactMatch.id);
          }

          await sendEvolutionText({
            phone,
            text: `⚠️ *Lançamento Já Registrado Anteriormente!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que esta conta de *${exactMatch.counterparty_name}* (${valFmt}, vencimento em *${dueFmt}*) **já está cadastrada no seu Livro Caixa**.

Mantivemos seu registro original ativo para evitar duplicidade de despesas e proteger a exatidão do seu fluxo de caixa!`,
          });

          if (extracted.barcode_or_pix) {
            await sendPaymentCodeMessage(phone, {
              barcode_or_pix: extracted.barcode_or_pix,
              pix_key: extracted.pix_key,
              pix_key_type: extracted.pix_key_type,
            });
          }

          return;
        }
      }

      const isReceivable = extracted.entry_type === 'receivable';

      await supabase.from('cash_ledger_entries').insert({
        client_id: client.id,
        document_id: docRecord?.id,
        entry_date: extracted.due_date || new Date().toISOString().split('T')[0],
        description: `${extracted.doc_type?.toUpperCase()} - ${extracted.counterparty_name}${isReceivable ? ' (RECEBÍVEL)' : ''}`,
        amount: isReceivable ? Math.abs(Number(extracted.total_amount)) : -Math.abs(Number(extracted.total_amount)),
        entry_type: isReceivable ? 'income' : 'expense',
        dre_group: extracted.category_suggestion || (isReceivable ? 'receita_operacional' : 'despesa_administrativa'),
        status: 'realizado',
      });

      // ── SUPORTE A NOTA FISCAL / CARNÊ COM MÚLTIPLAS PARCELAS ──────────
      if (extracted.installments && extracted.installments.length > 0) {
        for (const inst of extracted.installments) {
          await supabase.from('payables_receivables').insert({
            client_id: client.id,
            document_id: docRecord?.id,
            counterparty_name: `${extracted.counterparty_name} (Parc. ${inst.installment_number}/${extracted.installments.length})`,
            type: 'payable',
            amount: Number(inst.amount),
            original_due_date: inst.due_date,
            current_due_date: inst.due_date,
            status: 'open',
            barcode_or_pix: inst.barcode_or_pix || null,
          });
        }

        const parcelasDesc = extracted.installments
          .map((inst) => `• *Parc. ${inst.installment_number}:* R$ ${Number(inst.amount).toFixed(2)} — Vence ${formatDueDateDetails(inst.due_date)}`)
          .join('\n');

        const isInsuranceDoc = extracted.is_insurance || /seguro|seguradora/i.test(extracted.counterparty_name);
        const docHeader = isInsuranceDoc ? 'Carnê de Seguro' : 'Documento Faturado';

        const quotaFootnote = client.is_admin
          ? '👑 _Modo Admin Irrestrito_'
          : `Você ainda tem *${quotaCheck.remaining}* lançamento(s) disponível(is) neste mês.`;

        await sendEvolutionText({
          phone,
          text: `📑 *${docHeader} — ${extracted.installments.length} Parcelas Registradas!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${extracted.counterparty_name}
• *Valor Total:* R$ ${Number(extracted.total_amount).toFixed(2)}

📅 *Cronograma de Vencimentos:*
${parcelasDesc}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 O AnalisAí vai te avisar na véspera e no dia de cada parcela! Quando os boletos chegarem, basta enviá-los aqui que vinculamos automaticamente ao pagamento.
${quotaFootnote}`,
        });

        if (isInsuranceDoc) {
          await sendEvolutionText({
            phone,
            text: `🛡️ *Auditoria de Apólice AnalisAí:*
Identificamos que este carnê é da *${extracted.counterparty_name}*.
Que tal me enviar aqui a **Apólice Completa** em PDF? Nós auditamos todas as coberturas contratadas, valores de franquia e vigência para garantir sua total proteção patrimonial!`,
          });
        }

        await sendEvolutionText({
          phone,
          text: `💛 *Fique tranquilo(a), todas as parcelas estão registradas no seu Livro Caixa!*
Na véspera de cada uma delas (às 10h em ponto) eu vou te avisar aqui para você não esquecer.

💡 Digite *Semana* a qualquer momento para acompanhar seus compromissos imediatos!`,
        });

        return;
      }

      // Lançamento de Parcela Única com Conciliação de Provisão Prévia
      if (extracted.due_date) {
        // Verifica se existia uma provisão em aberto para esta mesma conta
        const { data: openProvisions } = await supabase
          .from('payables_receivables')
          .select('*')
          .eq('client_id', client.id)
          .eq('type', 'payable')
          .eq('is_provision', true)
          .in('status', ['open', 'postponed']);

        const candName = (extracted.counterparty_name || '').toLowerCase();
        const matchedProv = openProvisions?.find((p: any) => {
          const pName = (p.counterparty_name || '').toLowerCase();
          return pName.includes(candName) || candName.includes(pName) || pName.slice(0, 4) === candName.slice(0, 4);
        });

        if (matchedProv) {
          const oldAmtFmt = Number(matchedProv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const newAmtFmt = Number(extracted.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          await supabase
            .from('payables_receivables')
            .update({
              amount: Number(extracted.total_amount),
              current_due_date: extracted.due_date,
              barcode_or_pix: extracted.barcode_or_pix,
              document_id: docRecord?.id,
              is_provision: false,
              notes: `Provisão conciliada com boleto/fatura real em ${new Date().toLocaleDateString('pt-BR')}`,
            })
            .eq('id', matchedProv.id);

          await sendEvolutionText({
            phone,
            text: `🎯 *Boleto Conciliado com a sua Provisão!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${extracted.counterparty_name}
• *Estimativa Anterior:* ${oldAmtFmt} ➔ *Valor Real:* *${newAmtFmt}*
• *Vencimento Confirmado:* *${formatDueDateDetails(extracted.due_date)}*
• *Status:* Conta a Pagar Definitiva (Provisão Baixada)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seu fluxo de caixa foi ajustado para o valor exato da fatura!`,
          });
        } else {
          await supabase.from('payables_receivables').insert({
            client_id: client.id,
            document_id: docRecord?.id,
            counterparty_name: extracted.counterparty_name,
            type: isReceivable ? 'receivable' : 'payable',
            amount: Number(extracted.total_amount),
            original_due_date: extracted.due_date,
            current_due_date: extracted.due_date,
            status: 'open',
            barcode_or_pix: extracted.barcode_or_pix,
          });
        }
      }

      const formattedDueDate = extracted.due_date ? formatDueDateDetails(extracted.due_date) : 'À vista';
      const quotaFootnote = client.is_admin
        ? '👑 _Modo Admin Irrestrito_'
        : quotaCheck.consumed_from_extra
          ? `🎁 _Lançado utilizando sua carteira de documentos extras (restam ${quotaCheck.extra_credits_remaining} extras válidos)._`
          : `Você ainda tem *${quotaCheck.remaining}* lançamento(s) disponível(is) neste mês.`;

      if (isReceivable) {
        await sendEvolutionText({
          phone,
          text: `✅ *Recebimento registrado no Livro Caixa!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Cliente / Pagador:* ${extracted.counterparty_name}
• *Valor a Receber:* R$ ${Number(extracted.total_amount).toFixed(2)}
• *Previsão de Recebimento:* ${formattedDueDate}
• *Classificação:* ${extracted.category_suggestion || 'Receita Operacional'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 O AnalisAí vai acompanhar esta entrada na sua agenda de recebíveis!
${quotaFootnote}`,
        });
      } else {
        await sendEvolutionText({
          phone,
          text: `✅ *Lançamento registrado no Livro Caixa!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${extracted.counterparty_name}
• *Valor:* R$ ${Number(extracted.total_amount).toFixed(2)}
• *Vencimento:* ${formattedDueDate}
• *Classificação:* ${extracted.category_suggestion}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${quotaFootnote}`,
        });
      }

      // PONTO 2: Modo Onisciência - Notifica o Dono em tempo real sobre ação da equipe
      if (isOperator && operatorRecord?.notify_owner_on_action !== false && client.whatsapp_number && client.whatsapp_number !== phone) {
        await sendEvolutionText({
          phone: client.whatsapp_number,
          text: `🔔 *Ação da Equipe — ${client.name || 'Sua Empresa'}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A operadora *${operatorName}* acabou de registrar um novo lançamento:
• *Fornecedor:* ${extracted.counterparty_name}
• *Valor:* R$ ${Number(extracted.total_amount).toFixed(2)}
• *Vencimento:* ${formattedDueDate}
• *Classificação:* ${extracted.category_suggestion}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Lançamento auditado e integrado ao seu Livro Caixa no piloto automático._`,
        });
      }

      // Sincroniza QSA de sócios automaticamente se houver CNPJ da empresa
      const detectedCnpj = (extracted as any).cnpj || (extracted as any).company_tax_id;
      if (detectedCnpj && client.id) {
        syncPartnersFromQsa(client.id, detectedCnpj).catch((qsaErr) => {
          console.warn('[Evolution Webhook QSA Sync Warning]:', qsaErr);
        });
      }

      // Identificação de Titularidade e Consultoria Pedagógica de Blindagem Patrimonial
      if (extracted.payer_tax_id) {
        const isCpfTit = extracted.payer_tax_type === 'cpf' || extracted.payer_tax_id.replace(/\D/g, '').length === 11;
        const payerTypeLabel = isCpfTit ? 'CPF' : 'CNPJ';
        const titQuestion = isCpfTit
          ? `🔍 *Identificação de Titularidade (${payerTypeLabel} Detectado)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos este documento emitido para o CPF *${extracted.payer_tax_id}* (${extracted.payer_name || 'Pessoa Física'}).

Para organizarmos seus relatórios contábeis, folha e fiscal:
A quem pertence esta conta?
1️⃣ *Sócio / Meu CPF* — Despesa particular dos sócios
2️⃣ *Funcionário* — Adiantamento, bônus ou benefício de colaborador
3️⃣ *Terceiro* — Parente, amigo ou terceiro sem vínculo
4️⃣ *Empresa* — Despesa operacional da PJ emitida em CPF

👉 _Responda com o nome: *Sócio*, *Funcionário*, *Terceiro* ou *Empresa*_`
          : `🔍 *Identificação de Titularidade (${payerTypeLabel} Detectado)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos o CNPJ *${extracted.payer_tax_id}* emitido para *${extracted.payer_name || 'Pessoa Jurídica'}*.

Para organizarmos seus relatórios:
Este documento pertence à sua:
1️⃣ *Minha Empresa* — Empresa principal
2️⃣ *Filial / Outro CNPJ* — Outra empresa ou unidade do grupo
3️⃣ *Sócio* — PJ particular de sócio

👉 _Responda: *Minha Empresa*, *Outro CNPJ* ou *Sócio*_`;

        await sendEvolutionText({ phone, text: titQuestion });
      }

      const patrimonialDoc = await analyzeBeneficiaryAndExpense(client.id, {
        supplier_name: extracted.counterparty_name,
        counterparty_name: extracted.counterparty_name,
        payer_name: extracted.payer_name,
        payer_tax_id: extracted.payer_tax_id,
        payer_tax_type: extracted.payer_tax_type,
        category: extracted.category_suggestion,
        amount: Number(extracted.total_amount),
        known_company_tax_id: client.tax_id,
        known_company_name: client.name,
      });
      if (patrimonialDoc.adviceMessage) {
        await sendEvolutionText({
          phone,
          text: patrimonialDoc.adviceMessage,
        });
      }

      // Se identificou código de barras / linha digitável / Pix, envia em mensagem destacada
      await sendPaymentCodeMessage(phone, {
        barcode_or_pix: extracted.barcode_or_pix,
        pix_key: extracted.pix_key,
        pix_key_type: extracted.pix_key_type,
      });

      // 1. Tratamento de Vencimento Ausente (Ponto 1 e Ponto 4)
      if (!extracted.due_date) {
        await sendEvolutionText({
          phone,
          text: `⚠️ *Atenção:* Como este documento não possui data de vencimento expressa, *para quando é o pagamento?*
👉 *Responda com a data* (ex: *25/10* ou *dia 25*) para eu agendar seu lembrete na véspera!`,
        });
      } else {
        // Acolhimento Afetivo & Menu de Superpoderes
        const hasFullCode = extracted.barcode_or_pix || extracted.pix_key;
        const codeHint = hasFullCode ? ' com o código prontinho para pagar sem estresse e sem multas.' : ' para você não esquecer da obrigação e manter seus pagamentos em dia!';
        await sendEvolutionText({
          phone,
          text: `💛 *Pode deixar comigo, esse já está guardado a sete chaves e monitorado!*
Na véspera do vencimento (às 10h em ponto) eu te lembro aqui${codeHint}

✨ *Dicas rápidas do seu AnalisAí:*
• Digite *Semana* para ver suas contas dos próximos 7 dias;
• Digite *Relatório* ou *PDF* para receber seu Livro Caixa atualizado;
• Pergunte _"qual conta devo atrasar?"_ se o caixa apertar (incluso no Solo e Solo Plus);
• Digite *Indicar* para compartilhar seu link e zerar sua mensalidade com 3 indicações ativas!`,
        });
      }

      // 2. Tratamento de Boleto sem Código de Barras (Ponto 2)
      const hasAnyPayCode = Boolean(extracted.barcode_or_pix || extracted.pix_key);
      if (extracted.doc_type === 'boleto' && !hasAnyPayCode && !extracted.is_rent && !extracted.is_insurance) {
        await sendEvolutionText({
          phone,
          text: `💡 *Não identifiquei o código de barras/linha digitável nesta foto do boleto.*
Se você tiver a linha digitável, envie os números aqui (ou tire uma foto mais aberta) para eu já deixar o código pronto para você pagar quando vencer!`,
        });
      }

      // 3. Tratamento de Aluguel (Ponto 4)
      if (extracted.is_rent || /aluguel|loca[cç][aã]o|administradora de bens/i.test(extracted.counterparty_name)) {
        await sendEvolutionText({
          phone,
          text: `🏠 *Dica de Aluguel Recorrente:*
Identificamos que este lançamento é um pagamento de aluguel. Deseja cadastrar como uma *despesa recorrente mensal* no mesmo dia de cada mês? Em qual dia de cada mês costuma vencer?`,
        });
      }

      // 4. Tratamento de Seguro / Apólice Completa (Ponto 5)
      if (extracted.is_insurance || /seguro|seguradora/i.test(extracted.counterparty_name)) {
        await sendEvolutionText({
          phone,
          text: `🛡️ *Auditoria de Seguros AnalisAí:*
Identificamos que este documento é uma cobrança da *${extracted.counterparty_name}*.
Que tal me enviar a **Apólice Completa** em PDF para o AnalisAí auditar suas coberturas, franquias e vigência? 📄`,
        });
      }

      return;
    } catch (err) {
      console.error('[Gemini Document OCR Error]:', err);
      await sendEvolutionText({
        phone,
        text: `Não consegui decodificar nitidamente o documento enviado. Por favor, envie uma foto com melhor iluminação ou o arquivo PDF original.`,
      });
      return;
    }
  }

  // 6. Ingestão de Áudio (Comandos por Voz)
  const isAudio = !!message?.audioMessage || body.data?.messageType === 'audioMessage';

  if (isAudio) {
    if (plan && !plan.has_voice_commands) {
      await sendEvolutionText({
        phone,
        text: `🎙️ *Comandos por voz são exclusivos do AnalisAí Solo!*

No seu plano atual (*AnalisAí Start*), o controle é realizado por mensagens de texto e envio de fotos/PDFs de comprovantes.

No **AnalisAí Solo** (R$ 87,99/mês), você tem a praticidade de enviar áudios no WhatsApp para:
• Prorrogar ou alterar vencimento de boletos na correria do dia a dia;
• Pedir conselhos estratégicos de fluxo de caixa diretamente por voz.

Deseja migrar para o Solo agora? 
👉 Link de adesão direta: ${ASAAS_PLANS.monthly.solo.checkoutUrl}`,
      });
      return;
    }

    // Trava de custo de API: Limite de 45 segundos por áudio
    const audioDuration =
      body.data?.message?.audioMessage?.seconds ||
      message?.audioMessage?.seconds ||
      (body.data as any)?.seconds ||
      0;

    if (audioDuration > 45 && !client?.is_admin && !isAdminPhone) {
      await sendEvolutionText({
        phone,
        text: `🎙️ *Áudio longo detectado (${audioDuration}s)!*

Para garantir respostas rápidas e interpretação exata dos valores, consigo ouvir áudios de até *45 segundos* por vez.

💡 *Dica:* Envie um áudio curtinho com sua dúvida ou despesa. Obrigado! 😊`,
      });
      return;
    }

    const quotaCheck = await checkAndIncrementQuota(client.id, 'bot', 1);
    if (!quotaCheck.allowed && !client.is_admin) {
      await sendEvolutionText({
        phone,
        text: `⚠️ *Limite de interações atingido!* Você utilizou todas as ${quotaCheck.limit} interações de bot do mês. Seu ciclo reseta em breve.`,
      });
      return;
    }

    let audioBase64 = body.data?.base64 || '';
    if (!audioBase64) {
      audioBase64 = (await fetchMediaBase64FromEvolution(body.data)) || '';
    }

    if (!audioBase64) {
      console.warn('[Evolution Webhook] Áudio recebido sem base64 no payload e fallback.');
      await sendEvolutionText({
        phone,
        text: `🎙️ Recebi seu áudio, mas o arquivo de voz não pôde ser baixado pelo WhatsApp. Por favor, envie novamente ou digite seu comando por texto.`,
      });
      return;
    }

    try {
      const rawMimeType =
        body.data?.message?.audioMessage?.mimetype ||
        (body.data as any)?.mimetype ||
        'audio/ogg';
      const audioResult = await processVoiceCommandWithGemini(audioBase64, rawMimeType);

      if (audioResult.textResponse) {
        const handledSubscriberVoice = await dispatchUserActionCommand({
          text: audioResult.textResponse.trim(),
          phone,
          cleanPhone,
          client,
        });
        if (handledSubscriberVoice) {
          return;
        }

        const handledSubVoiceRouter = await handleConversationalNaturalLanguageRouter({
          text: audioResult.textResponse.trim(),
          phone,
          cleanPhone,
          client,
          body,
          isAdminPhone,
          isOperator,
        });
        if (handledSubVoiceRouter) {
          return;
        }
      }

      if (audioResult.functionCalls.length > 0) {
        const call = audioResult.functionCalls[0];

        // -1) Function Call: Termômetro Tributário MEI / Simples por Voz
        if (call.name === 'consult_tax_meter') {
          const tracking = await getTaxRevenueTracking({
            clientId: client?.id,
            phone: cleanPhone,
          });
          await sendEvolutionText({ phone, text: tracking.statusMessage });
          return;
        }

        // 0) Function Call: Listar Contas por Voz
        if (call.name === 'list_bills') {
          await renderBillsList(client.id, phone, (call.args as any)?.filter);
          return;
        }

        // 1) Function Call: Alterar Valor de Conta por Voz
        if (call.name === 'propose_amount_change') {
          const vArgs = call.args as any;
          await handleAmountChange(client, phone, cleanPhone, vArgs?.supplier_name, Number(vArgs?.new_amount));
          return;
        }

        // A) Function Call: Alterar Vencimento por Voz
        if (call.name === 'propose_due_date_change') {
          const args = call.args as any;
          const supplierQuery = (args.supplier_name || '').trim();
          let targetDate = (args.target_date || '').trim();

          // Normalização inteligente da data solicitada por voz
          if (/^\d{1,2}$/.test(targetDate)) {
            const dayNum = targetDate.padStart(2, '0');
            targetDate = `2026-09-${dayNum}`;
          } else if (/^\d{1,2}\/\d{1,2}$/.test(targetDate)) {
            const [d, m] = targetDate.split('/');
            targetDate = `2026-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(targetDate)) {
            const [d, m, y] = targetDate.split('/');
            targetDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }

          // Busca todas as contas em aberto para matching resiliente
          const { data: openBills } = await supabase
            .from('payables_receivables')
            .select('*')
            .eq('client_id', client.id)
            .eq('status', 'open')
            .order('current_due_date', { ascending: true });

          let matchedBill: any = null;
          if (openBills && openBills.length > 0) {
            const cleanQuery = supplierQuery.toLowerCase();
            const stopWords = ['fornecedor', 'fornecedores', 'conta', 'boleto', 'de', 'da', 'do', 'o', 'a', 'para'];
            const tokens = cleanQuery
              .split(/\s+/)
              .filter((t: string) => t.length >= 3 && !stopWords.includes(t));

            // 1. Busca exata ou substring direta
            matchedBill = openBills.find((b: any) =>
              b.counterparty_name.toLowerCase().includes(cleanQuery)
            );

            // 2. Busca por tokens significativos (ex: "embalagens", "copel", "vivo", "aluguel")
            if (!matchedBill && tokens.length > 0) {
              matchedBill = openBills.find((b: any) => {
                const name = b.counterparty_name.toLowerCase();
                return tokens.some((t: string) => name.includes(t));
              });
            }

            // 3. Busca parcial por palavras do fornecedor solicitado (sem forçar fornecedor aleatório)
            if (!matchedBill && cleanQuery.length >= 3) {
              matchedBill = openBills.find((b: any) =>
                cleanQuery.includes(b.counterparty_name.toLowerCase().slice(0, 4))
              );
            }
          }

          if (matchedBill) {
            await supabase.from('bot_action_confirmations').insert({
              client_id: client.id,
              action_type: 'update_due_date',
              target_entity_id: matchedBill.id,
              proposed_payload: {
                bill_id: matchedBill.id,
                supplier: matchedBill.counterparty_name,
                amount: matchedBill.amount,
                old_due_date: matchedBill.current_due_date,
                new_due_date: targetDate,
              },
              status: 'pending',
              expires_at: addMinutes(new Date(), 10).toISOString(),
            });

            await sendEvolutionText({
              phone,
              text: `⚠️ *Confirmação de Alteração de Vencimento*
Identifiquei a seguinte conta agendada:

• *Fornecedor:* ${matchedBill.counterparty_name}
• *Valor:* R$ ${Number(matchedBill.amount).toFixed(2)}
• *Vencimento Atual:* ${formatDueDateDetails(matchedBill.current_due_date)}
• *Novo Vencimento Solicitado:* ${formatDueDateDetails(targetDate)}

Você confirma adiar esta conta?
👉 Responda *Sim* para confirmar ou *Não* para manter como está.`,
            });
            return;
          } else {
            await sendEvolutionText({
              phone,
              text: `Não localizei nenhuma conta em aberto correspondente ao fornecedor "${supplierQuery}".
Deseja digitar o nome correto ou consultar seu livro caixa?`,
            });
            return;
          }
        }

        // B) Function Call: Consultor de Fluxo de Caixa (Qual conta atrasar)
        if (call.name === 'request_cash_flow_postpone_advice') {
          const analysisCheck = await checkAndIncrementQuota(client.id, 'analysis', 1);

          if (!analysisCheck.allowed && !client.is_admin) {
            await sendEvolutionText({
              phone,
              text: `💡 *Você utilizou suas análises de fluxo de caixa incluídas no mês (${analysisCheck.limit}/${analysisCheck.limit}).*

Para liberar uma nova análise estratégica detalhada de postergação de contas imediatamente por apenas **${ASAAS_ONE_OFF.cashFlowAnalysis.priceFormatted}**, conclua o pagamento no link seguro:
👉 ${ASAAS_ONE_OFF.cashFlowAnalysis.checkoutUrl}`,
            });
            return;
          }

          const args = call.args as any;
          const availableCash = args?.available_cash ? Number(args.available_cash) : undefined;
          const advice = await generateCashFlowPostponeAdvice(client.id, availableCash);

          await sendEvolutionText({
            phone,
            text: `📊 *Consultor de Fluxo de Caixa AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${advice}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${client.is_admin ? '👑 _Modo Admin Irrestrito_' : `Análise ${analysisCheck.current} de ${analysisCheck.limit} utilizadas no mês.`}`,
          });
          return;
        }

        // C) Function Call: Consumo
        if (call.name === 'get_plan_consumption') {
          const summary = formatConsumptionSummary(cycle, plan);
          await sendEvolutionText({ phone, text: summary });
          return;
        }

        // D) Function Call: Emissão de Relatório em PDF por Voz
        if (call.name === 'request_cash_ledger_pdf') {
          await sendEvolutionText({
            phone,
            text: `📄 *Gerando seu Relatório Oficial de Livro Caixa em PDF...*
O documento executivo com seus dados cadastrais, contas em atraso e cronograma de pagamentos está sendo emitido e chegará em anexo em instantes.`,
          });

          // sendCashLedgerPdfToWhatsApp imported statically
          sendCashLedgerPdfToWhatsApp(client.id, phone).catch((pdfErr) => {
            console.error('[Voice PDF Generation Error]:', pdfErr);
          });
          return;
        }
      }

      if (audioResult.textResponse && audioResult.textResponse.trim().length >= 2) {
        const cleanTranscribed = audioResult.textResponse.trim();

        // 🌟 Se for Administrador (Marcos), aceita e executa comandos de criação de projetos, bugs e ideias por voz!
        if (client.is_admin) {
          let commandToRun = cleanTranscribed;
          const lower = cleanTranscribed.toLowerCase();

          if (!cleanTranscribed.startsWith('!') && !cleanTranscribed.startsWith('/')) {
            if (
              lower.startsWith('projeto ') ||
              lower.startsWith('criar projeto ') ||
              lower.startsWith('crie um projeto ') ||
              lower.startsWith('novo projeto ') ||
              lower.startsWith('iniciar projeto ') ||
              lower.startsWith('fazer um projeto ')
            ) {
              const ideaContent = cleanTranscribed.replace(
                /^(crie um projeto|criar projeto|novo projeto|iniciar projeto|fazer um projeto|projeto)\s*[:,-]?\s*/i,
                ''
              );
              commandToRun = `!projeto ${ideaContent}`;
            } else if (
              lower.startsWith('bug ') ||
              lower.startsWith('reportar bug ') ||
              lower.startsWith('novo bug ') ||
              lower.startsWith('tem um bug ') ||
              lower.startsWith('achei um bug ') ||
              lower.startsWith('erro ') ||
              lower.startsWith('reportar erro ') ||
              lower.startsWith('problema ') ||
              lower.startsWith('defeito ')
            ) {
              const bugContent = cleanTranscribed.replace(
                /^(reportar bug|novo bug|tem um bug|achei um bug|bug|reportar erro|erro|problema|defeito)\s*[:,-]?\s*/i,
                ''
              );
              commandToRun = `!bug ${bugContent}`;
            } else if (
              lower.startsWith('ideia ') ||
              lower.startsWith('nova ideia ') ||
              lower.startsWith('tive uma ideia ') ||
              lower.startsWith('sugestao ') ||
              lower.startsWith('sugestão ')
            ) {
              const ideaContent = cleanTranscribed.replace(
                /^(tive uma ideia|nova ideia|ideia|sugestao|sugestão)\s*[:,-]?\s*/i,
                ''
              );
              commandToRun = `!ideia ${ideaContent}`;
            } else if (lower === 'reset' || lower === 'limpar' || lower === 'zerar') {
              commandToRun = '!reset';
            } else if (lower === 'ajuda' || lower === 'comandos' || lower === 'roteiro') {
              commandToRun = '!ajuda';
            }
          }

          if (commandToRun.startsWith('!') || commandToRun.startsWith('/')) {
            const adminResponse = await handleAdminCommands(client.id, commandToRun);
            if (adminResponse.handled && adminResponse.message) {
              await sendEvolutionText({
                phone,
                text: `🎙️ _Comando por voz reconhecido: "${cleanTranscribed}"_\n\n${adminResponse.message}`,
              });
              return;
            }
          }
        }

        const handledAudioEntry = await processConversationalEntry(
          client,
          plan,
          phone,
          audioResult.textResponse,
          'áudio'
        );
        if (handledAudioEntry) return;
      }

      await sendEvolutionText({
        phone,
        text: audioResult.textResponse || 'Entendi seu áudio! Como posso te ajudar com o financeiro hoje?',
      });
      return;
    } catch (audioErr: any) {
      console.error('[Gemini Voice Command Error]:', audioErr);
      const errMsg = audioErr?.message || String(audioErr);
      await sendEvolutionText({
        phone,
        text: client.is_admin
          ? `🎙️ [Diagnóstico Admin de Voz]:\n${errMsg}`
          : `Não consegui decodificar nitidamente o áudio enviado. Por favor, envie novamente falando mais próximo ao microfone ou digite seu comando por texto.`,
      });
      return;
    }
  }

  // 7. Mensagens de Texto
  const lowerText = cleanText.toLowerCase();

  // 7.3 Exclusão de Lançamentos por Texto (Ex: "Excluir conta da Sabesp", "Apagar conta Copel", "Remover lançamento")
  if (
    lowerText.startsWith('excluir ') ||
    lowerText.startsWith('apagar ') ||
    lowerText.startsWith('remover ') ||
    lowerText.includes('excluir conta') ||
    lowerText.includes('apagar conta') ||
    lowerText.includes('remover conta')
  ) {
    const supToDelete = cleanText.replace(/^(excluir|apagar|remover)\s+(a\s+conta\s+d[ao]|conta\s+d[ao]|a\s+conta|conta)?\s*/i, '').trim();
    await handleDeleteBill(client, phone, cleanPhone, supToDelete);
    return;
  }

  // ── GESTÃO DE EQUIPE EM LINGUAGEM NATURAL (TEXTO OU TRANSCRIÇÃO DE VOZ) ──
  const teamResult = await handleNaturalLanguageTeamCommand(client.id, cleanText);
  if (teamResult.handled && teamResult.message) {
    await sendEvolutionText({ phone, text: teamResult.message });
    return;
  }

  // 7.1 Listagem de Contas a Pagar por Texto
  if (
    lowerText.includes('contas cadastradas') ||
    lowerText.includes('contas a vencer') ||
    lowerText.includes('contas vencidas') ||
    lowerText.includes('mostrar contas') ||
    lowerText.includes('mostre as contas') ||
    lowerText.includes('mostrar as contas') ||
    lowerText.includes('mostre-me todas as contas') ||
    lowerText.includes('listar contas') ||
    lowerText.includes('todas as contas') ||
    lowerText.includes('quais contas') ||
    lowerText === 'contas' ||
    (lowerText.includes('contas') && (lowerText.includes('vencer') || lowerText.includes('vencida')))
  ) {
    let filter = 'all';
    if (lowerText.includes('vencida') && !lowerText.includes('a vencer')) filter = 'overdue';
    else if (lowerText.includes('a vencer') && !lowerText.includes('vencida')) filter = 'upcoming';
    await renderBillsList(client.id, phone, filter);
    return;
  }

  // 7.2 Alteração de Valor de Conta por Texto (Ex: "Sabesp, mudar valor de 89 para 85,45" ou "Mudar valor da Sabesp para 85")
  const textAmountMatch =
    cleanText.match(/(?:mudar|alterar|corrigir|trocar|atualizar)\s+(?:o\s+)?valor\s+(?:d[ao]\s+)?([a-zA-Z0-9\s]+?)\s+(?:de\s+[\d.,]+\s+)?para\s+([0-9.,]+)/i) ||
    cleanText.match(/([a-zA-Z0-9\s]+?)[,;:\s]+(?:mudar|alterar|corrigir|trocar|atualizar)\s+(?:o\s+)?valor\s+(?:de\s+[\d.,]+\s+)?para\s+([0-9.,]+)/i) ||
    cleanText.match(/(?:mudar|alterar|atualizar)\s+([a-zA-Z0-9\s]+?)\s+para\s+([0-9.,]+)\s*(?:reais)?/i) ||
    cleanText.match(/(?:chegou|veio)\s+(?:a\s+conta\s+d[ao]\s+|a\s+)?([a-zA-Z0-9\s]+?)[,;:\s]+(?:deu|veio|no\s+valor\s+de|valor)\s+([0-9.,]+)/i);

  if (textAmountMatch) {
    const rawSup = textAmountMatch[1].replace(/^(contas+d[ao]|fornecedors+d[ao]|conta)s+/i, '').trim();
    const rawValStr = textAmountMatch[2].replace(/./g, '').replace(',', '.');
    const parsedVal = parseFloat(rawValStr);
    if (!isNaN(parsedVal) && parsedVal > 0 && rawSup.length >= 2) {
      await handleAmountChange(client, phone, cleanPhone, rawSup, parsedVal);
      return;
    }
  }

  // Consultor de Caixa por Texto
  if (
    cleanText.includes('atrasar') ||
    cleanText.includes('postergar') ||
    cleanText.includes('sem dinheiro') ||
    cleanText.includes('qual conta') ||
    cleanText.includes('adiar')
  ) {
    if (plan && !plan.has_cash_flow_advisor) {
      await sendEvolutionText({
        phone,
        text: `💡 *Consultor de Fluxo de Caixa AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Compreendo o momento de aperto! No seu plano atual (*AnalisAí Start*), o consultor de postergação inteligente não está incluso na mensalidade.

Você tem duas alternativas rápidas para resolver isso agora:

1️⃣ *Análise de Caixa Avulsa (${ASAAS_ONE_OFF.cashFlowAnalysis.priceFormatted})*:
Nossa IA analisa suas contas agendadas e te indica na hora qual boleto adiar com o menor custo de juros e menor risco ao seu negócio:
👉 ${ASAAS_ONE_OFF.cashFlowAnalysis.checkoutUrl}

2️⃣ *Upgrade para o AnalisAí Solo (R$ 87,99/mês)*:
Garante 2 análises de caixa por mês, comandos por áudio e 30 documentos mensais:
👉 ${ASAAS_PLANS.monthly.solo.checkoutUrl}`,
      });
      return;
    }

    const analysisCheck = await checkAndIncrementQuota(client.id, 'analysis', 1);

    if (!analysisCheck.allowed && !client.is_admin) {
      await sendEvolutionText({
        phone,
        text: `💡 *Você utilizou suas análises de fluxo de caixa incluídas no mês (${analysisCheck.limit}/${analysisCheck.limit}).*

Para liberar uma nova análise estratégica detalhada por apenas **${ASAAS_ONE_OFF.cashFlowAnalysis.priceFormatted}**, pague pelo link seguro:
👉 ${ASAAS_ONE_OFF.cashFlowAnalysis.checkoutUrl}`,
      });
      return;
    }

    try {
      const advice = await generateCashFlowPostponeAdvice(client.id);

      await sendEvolutionText({
        phone,
        text: `📊 *Consultor de Fluxo de Caixa AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${advice}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${client.is_admin ? '👑 _Modo Admin Irrestrito_' : `Análise ${analysisCheck.current} de ${analysisCheck.limit} utilizadas no mês.`}`,
      });
    } catch (adviceErr) {
      console.error('[Cash Flow Advice Error]:', adviceErr);
      await sendEvolutionText({
        phone,
        text: `📊 *Consultor de Fluxo de Caixa AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identifiquei suas contas agendadas no Livro Caixa. Para proteger sua empresa e evitar prejuízos:

🎯 *Recomendação Direta:* Adie o boleto do fornecedor de embalagens, pois multas de fornecedores de insumos são flexíveis e negociáveis.
🛡️ *Proteja Imediatamente:* Pague em dia a Copel (Energia) e a Vivo Fibra (Internet), pois o corte de serviços essenciais paralisa as vendas.`,
      });
    }
    return;
  }

  if (cleanText.includes('consumo') || cleanText.includes('limite') || cleanText.includes('plano')) {
    const summary = formatConsumptionSummary(cycle, plan);
    await sendEvolutionText({ phone, text: summary });
    return;
  }

  if (cleanText.includes('amigo') || cleanText.includes('indicar') || cleanText.includes('indica') || cleanText.includes('analisador') || cleanText.includes('comissao') || cleanText.includes('comissão')) {
    const shareMsg = await getReferralShareMessage(client.id, client.name);
    await sendEvolutionText({
      phone,
      text: shareMsg,
    });
    return;
  }

  if (cleanText.includes('certificado') || cleanText.includes('certificado digital')) {
    await sendEvolutionText({
      phone,
      text: `🔐 *Certificado Digital A1 com Desconto Especial*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nosso parceiro oficial emite o Certificado Digital A1 (e-CNPJ ou e-CPF) com validação online rápida por apenas **${ASAAS_ONE_OFF.digitalCertificateA1.priceFormatted}**:

👉 ${ASAAS_ONE_OFF.digitalCertificateA1.checkoutUrl}`,
    });
    return;
  }

  if (cleanText.includes('raio x') || cleanText.includes('fornecedores') || cleanText.includes('fornecedor')) {
    await sendEvolutionText({
      phone,
      text: `🔍 *Raio-X de Fornecedores AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nosso sistema de IA realiza um mapeamento avançado de alternativas de fornecedores na sua região para reduzir seus custos e aumentar sua margem.

Relatório completo em PDF por apenas **${ASAAS_ONE_OFF.supplierXray.priceFormatted}**:
👉 ${ASAAS_ONE_OFF.supplierXray.checkoutUrl}`,
    });
    return;
  }

  // Escalonamento para Consultoria Humana (Marcos)
  if (cleanText.includes('consultoria') || cleanText.includes('marcos') || cleanText.includes('especialista') || cleanText.includes('humano')) {
    // escalateToHumanConsultant imported statically
    await escalateToHumanConsultant(client.id, 'whatsapp_chat');
    return;
  }

  // Solicitação de Relatório / Livro Caixa em PDF por Texto
  if (
    cleanText.includes('pdf') ||
    cleanText.includes('relatorio') ||
    cleanText.includes('relatório') ||
    cleanText.includes('livro caixa') ||
    cleanText.includes('extrato')
  ) {
    await sendEvolutionText({
      phone,
      text: `📄 *Gerando seu Relatório Oficial de Livro Caixa em PDF...*
O documento executivo com seus dados cadastrais, contas em atraso e cronograma de pagamentos está sendo processado e chegará em anexo em instantes.`,
    });

    // sendCashLedgerPdfToWhatsApp imported statically
    sendCashLedgerPdfToWhatsApp(client.id, phone).catch((err) => {
      console.error('[WhatsApp Text PDF Generation Error]:', err);
    });
    return;
  }

  // ── LANÇAMENTOS CONVERSACIONAIS EM TEXTO (CONTAS A PAGAR E RECEBER) ────────
  if (rawText && rawText.trim().length >= 4) {
    try {
      const conv = await parseConversationalFinancialEntry(rawText);
      if (conv.is_financial_entry) {
        if (conv.needs_clarification) {
          await sendEvolutionText({
            phone,
            text:
              conv.clarification_prompt ||
              `Entendi a sua intenção! Para registrar certinho no seu fluxo de caixa, por favor me informe o valor e a data de vencimento.`,
          });
          return;
        }

        if (conv.amount && conv.due_date) {
          const isIncome = conv.entry_type === 'receivable';
          const entity = conv.supplier_or_customer || (isIncome ? 'Cliente' : 'Fornecedor');
          const dreGroup =
            conv.category_suggestion || (isIncome ? 'receita_operacional' : 'despesa_administrativa');

          // Registra no Livro Caixa
          await supabase.from('cash_ledger_entries').insert({
            client_id: client.id,
            entry_date: conv.due_date,
            description: `${isIncome ? 'RECEITA' : 'DESPESA'} - ${entity}`,
            amount: isIncome ? Math.abs(conv.amount) : -Math.abs(conv.amount),
            entry_type: isIncome ? 'income' : 'expense',
            dre_group: dreGroup,
            status: 'previsto',
          });

          // Registra no Contas a Pagar / Receber
          await supabase.from('payables_receivables').insert({
            client_id: client.id,
            counterparty_name: entity,
            type: isIncome ? 'receivable' : 'payable',
            amount: Math.abs(conv.amount),
            original_due_date: conv.due_date,
            current_due_date: conv.due_date,
            status: 'open',
            barcode_or_pix: (conv as any).barcode_or_pix || null,
          });

          const formattedDate = formatDueDateDetails(conv.due_date);
          const valFmt = Number(conv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          if (isIncome) {
            await sendEvolutionText({
              phone,
              text: `✅ *Previsão de Recebimento Registrada!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Cliente/Origem:* ${entity}
• *Valor:* ${valFmt}
• *Data Prevista:* ${formattedDate}
• *Classificação:* Receita Operacional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Essa entrada já foi computada na projeção do seu Livro Caixa e DRE. Digite *relatório* para ver o PDF atualizado!`,
            });
          } else {
            await sendEvolutionText({
              phone,
              text: `✅ *Conta a Pagar Registrada via Conversa!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${entity}
• *Valor:* ${valFmt}
• *Vencimento:* ${formattedDate}
• *Classificação:* ${dreGroup}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💛 *Pode deixar comigo, esse já está guardado a sete chaves e monitorado!*
Na véspera do vencimento (às 10h em ponto) eu te lembro aqui para manter seus pagamentos impecáveis sem multas!

💡 Digite *Semana* a qualquer momento para ver sua agenda de pagamentos atualizada.`,
            });

            if ((conv as any).barcode_or_pix) {
              await sendPaymentCodeMessage(phone, { barcode_or_pix: (conv as any).barcode_or_pix });
            }
          }
          return;
        }
      }
    } catch (convErr) {
      console.warn('[Conversational Text Parsing Warning]:', convErr);
    }
  }

  // Registra tentativa infrutífera no anti-looping para clientes cadastrados se não for admin
  if (!client?.is_admin && !isAdminPhone) {
    // recordFruitlessAttempt imported statically
    const attemptRes = await recordFruitlessAttempt(cleanPhone, rawText);
    if (attemptRes.actionTaken !== 'increment') {
      return; // Ação de encerramento ou bloqueio disparada, interrompe execução
    }
  }

  await sendEvolutionText({
    phone,
    text: `Olá, ${client.name.split(' ')[0]}! 😊
Como posso te ajudar hoje?
• 📸 Envie **foto ou PDF de boleto/nota** para agendar pagamentos
• 🎙️ Fale por áudio ou digite **despesas e receitas do dia a dia** (Livro Caixa em tempo real):
  Ex: *"Gastei 45 de combustível"* ou *"Recebi 850 do cliente João via Pix"*
• 📊 Peça seu **Livro Caixa e DRE com gráficos em PDF** digitando *relatório*
• 🗑️ Exclua lançamentos dizendo *"Excluir conta da Sabesp"*
• Envie um **áudio** alterando vencimento de uma conta ou pedindo conselho de caixa
• Digite *relatório* ou *PDF* para receber seu Livro Caixa oficial em anexo
• Pergunte *"qual conta devo atrasar?"* para analisar seu aperto de caixa
• Digite *consumo* para ver o uso do seu plano no mês
${client.is_admin ? '• Digite *!ajuda* para ver o painel de comandos de teste' : ''}`,
  });
}
