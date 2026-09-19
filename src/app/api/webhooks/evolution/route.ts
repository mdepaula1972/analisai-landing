import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText, sendEvolutionPoll, fetchMediaBase64FromEvolution } from '@/lib/solo/evolution';
import {
  extractDocumentWithGemini,
  processVoiceCommandWithGemini,
  parseConversationalFinancialEntry,
} from '@/lib/solo/gemini';
import { recordAuditLog } from '@/lib/solo/audit';
import { resolveUserAndClient, addTeamMember, listTeamMembers, removeTeamMember, updateTeamMember, handleNaturalLanguageTeamCommand } from '@/lib/solo/team';
import { checkAndIncrementQuota, getClientPlanAndCurrentCycle, formatConsumptionSummary } from '@/lib/solo/quota';
import { handleAdminCommands } from '@/lib/solo/admin';
import { generateCashFlowPostponeAdvice } from '@/lib/solo/cash-flow-advisor';
import { ASAAS_PLANS, ASAAS_ONE_OFF } from '@/lib/solo/constants';
import { formatDueDateDetails } from '@/lib/solo/date-utils';
import { solicitarTrocaNumeroCom2FA, validarCodigo2FATrocaNumero } from '@/lib/solo/phone-change';
import {
  checkTrialStatus,
  recordTrialUsage,
  getTrialWelcomeMessage,
  getTrialLimitReachedMessage,
  formatTrialDocSummary,
  getTrialConversionMenu,
  BANK_SAFETY_NOTICE,
} from '@/lib/solo/trial';
import { recordWaitlistLead } from '@/lib/solo/waitlist';
import { linkReferralLead, getReferralShareMessage } from '@/lib/solo/referral';
import { analyzePatrimonialExpense, analyzeBeneficiaryAndExpense, syncPartnersFromQsa } from '@/lib/solo/patrimonial-advisor';
import { getMonthlyDividendTracking } from '@/lib/solo/dividend-tracker';
import { isQaWhitelisted } from '@/lib/solo/qa-whitelist';
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

      await supabase.from('payables_receivables').insert({
        client_id: client.id,
        counterparty_name: entity,
        type: isIncome ? 'receivable' : 'payable',
        amount: Math.abs(conv.amount),
        original_due_date: conv.due_date,
        current_due_date: conv.due_date,
        status: 'open',
      });

      const formattedDate = formatDueDateDetails(conv.due_date);
      const valFmt = Number(conv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const quotaFootnote = client.is_admin
        ? '👑 _Modo Admin Irrestrito_'
        : quotaCheck.consumed_from_extra
          ? `🎁 _Lançado utilizando sua carteira de lançamentos extras (restam ${quotaCheck.extra_credits_remaining} extras válidos)._`
          : `Você ainda tem *${quotaCheck.remaining}* lançamento(s) disponível(is) neste mês.`;

      if (isIncome) {
        await sendEvolutionText({
          phone,
          text: `✅ *Previsão de Recebimento Registrada (via ${origin})!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Cliente/Origem:* ${entity}
• *Valor:* ${valFmt}
• *Data Prevista:* ${formattedDate}
• *Classificação:* Receita Operacional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${quotaFootnote}
Essa entrada já foi computada na projeção do seu Livro Caixa e DRE. Digite *relatório* para ver o PDF atualizado!`,
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
  let totalOverdue = 0;
  let totalUpcoming = 0;

  for (const b of bills) {
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

  let text = '📋 *Painel de Contas a Pagar Cadastradas*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

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

  const grandTotal = (totalOverdue + totalUpcoming).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total Geral a Pagar:* *${grandTotal}*\n\n💡 *Dica:* Para alterar valor ou data de qualquer conta, fale ou digite:\nEx: _"Mudar valor da Sabesp para 85,00"_ ou _"Adiar Copel para dia 25"_`;

  await sendEvolutionText({ phone, text });
}

async function handleAmountChange(clientId: string, phone: string, supplierQuery: string, newAmount: number) {
  const supabase = createServiceRoleClient();
  if (!supplierQuery || isNaN(newAmount) || newAmount <= 0) {
    await sendEvolutionText({
      phone,
      text: '⚠️ Não consegui identificar o fornecedor ou o novo valor. Por favor, envie no formato:\n*"Mudar valor da Sabesp para 85,00"*',
    });
    return;
  }

  const { data: openBills } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .eq('type', 'payable')
    .in('status', ['open', 'postponed'])
    .order('current_due_date', { ascending: true });

  if (!openBills || openBills.length === 0) {
    await sendEvolutionText({
      phone,
      text: 'Não localizei contas a pagar cadastradas em aberto no seu Livro Caixa.',
    });
    return;
  }

  const cleanQuery = supplierQuery.toLowerCase().trim();
  const stopWords = ['conta', 'fornecedor', 'boleto', 'de', 'da', 'do', 'o', 'a', 'valor', 'reais'];
  const tokens = cleanQuery.split(/\s+/).filter((t: string) => t.length >= 3 && !stopWords.includes(t));

  let matchedBill = openBills.find((b: any) =>
    b.counterparty_name.toLowerCase().includes(cleanQuery)
  );

  if (!matchedBill && tokens.length > 0) {
    matchedBill = openBills.find((b: any) =>
      tokens.some((t: string) => b.counterparty_name.toLowerCase().includes(t))
    );
  }

  if (!matchedBill) {
    const listStr = openBills
      .map((b: any) => `• *${b.counterparty_name}* (R$ ${Number(b.amount).toFixed(2)})`)
      .join('\n');
    await sendEvolutionText({
      phone,
      text: `Não localizei nenhuma conta correspondente a "${supplierQuery}".\n\nSuas contas cadastradas são:\n${listStr}\n\nEnvie o nome correto da conta que deseja alterar.`,
    });
    return;
  }

  const oldAmount = Number(matchedBill.amount);

  await supabase
    .from('payables_receivables')
    .update({
      amount: newAmount,
      notes: `Valor alterado de R$ ${oldAmount.toFixed(2)} para R$ ${newAmount.toFixed(2)} em ${new Date().toLocaleDateString('pt-BR')}`,
    })
    .eq('client_id', clientId)
    .ilike('counterparty_name', `%${matchedBill.counterparty_name}%`)
    .in('status', ['open', 'postponed']);

  if (matchedBill.document_id) {
    await supabase
      .from('cash_ledger_entries')
      .update({ amount: -Math.abs(newAmount) })
      .eq('document_id', matchedBill.document_id);
  }

  const oldFmt = oldAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const newFmt = newAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dueFmt = formatDueDateDetails(matchedBill.current_due_date);

  await sendEvolutionText({
    phone,
    text: `✅ *Valor de Conta Atualizado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${matchedBill.counterparty_name}
• *Valor Anterior:* ${oldFmt}
• *Novo Valor Corrigido:* *${newFmt}*
• *Vencimento:* ${dueFmt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seus relatórios, fluxo de caixa e lembretes já foram sincronizados com o novo valor de ${newFmt}.`,
  });
}


async function handleDeleteBill(clientId: string, phone: string, supplierQuery: string) {
  const supabase = createServiceRoleClient();
  const { data: bills } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['open', 'postponed'])
    .order('created_at', { ascending: false });

  if (!bills || bills.length === 0) {
    await sendEvolutionText({
      phone,
      text: 'Não localizei contas em aberto cadastradas no seu Livro Caixa para exclusão.',
    });
    return;
  }

  let matchedBill: any = null;
  const cleanQuery = supplierQuery ? supplierQuery.toLowerCase().trim() : '';

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

  if (!matchedBill) {
    const listStr = bills.map((b: any) => `• *${b.counterparty_name}* (R$ ${Number(b.amount).toFixed(2)})`).join('\n');
    await sendEvolutionText({
      phone,
      text: `Não localizei a conta correspondente a "${supplierQuery}".\n\nSuas contas cadastradas são:\n${listStr}\n\nEnvie o nome exato da conta que deseja excluir.`,
    });
    return;
  }

  await supabase.from('bot_action_confirmations').insert({
    client_id: clientId,
    action_type: 'delete_bill',
    target_entity_id: matchedBill.id,
    proposed_payload: {
      bill_id: matchedBill.id,
      supplier: matchedBill.counterparty_name,
      amount: matchedBill.amount,
      due_date: matchedBill.current_due_date,
      document_id: matchedBill.document_id,
    },
    status: 'pending',
    expires_at: addMinutes(new Date(), 10).toISOString(),
  });

  const dueFmt = formatDueDateDetails(matchedBill.current_due_date);
  const amtFmt = Number(matchedBill.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  await sendEvolutionPoll({
    phone,
    question: `🗑️ *Confirmação de Exclusão de Lançamento*\n\n• Fornecedor: *${matchedBill.counterparty_name}*\n• Valor: *${amtFmt}*\n• Vencimento: *${dueFmt}*\n\nDeseja realmente excluir esta conta do seu Livro Caixa?`,
    options: ['Sim, confirmar exclusão', 'Não, cancelar'],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvolutionWebhookBody;

    const message = body.data?.message;
    const rawText = message?.conversation || message?.extendedTextMessage?.text || '';
    const isCommand = rawText.trim().startsWith('!') || rawText.trim().startsWith('/');
    const isAudio = body.data?.messageType === 'audioMessage' || !!message?.audioMessage;

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

    // Ignora fromMe apenas se NÃO for o Marcos Administrador testando, NÃO for comando e NÃO for áudio
    if (body.data?.key?.fromMe && !isAdminTester && !isCommand && !isAudio) {
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

  const message = body.data?.message;
  const rawText = message?.conversation || message?.extendedTextMessage?.text || '';
  const cleanText = rawText.trim().toLowerCase();
  const digitsOnly = rawText.replace(/\D/g, '');

  // ── Interceptação Operador de Equipe: Primeiro Contato / Saudação Inbound ──
  if (isOperator) {
    const isGreeting = /^(oi|ola|olá|bom dia|boa tarde|boa noite|oii|oie|opa|começar|iniciar|ativar|teste)[!.]*$/i.test(cleanText);
    if (isGreeting) {
      // PONTO 3: Notificar o Dono na ativação formal do operador para permitir cobrança de omissões
      if (operatorRecord && !operatorRecord.activated_at) {
        const { markTeamMemberActivated } = await import('@/lib/solo/team');
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
    const { checkAntiLoopStatus } = await import('@/lib/solo/anti-loop');
    const loopStatus = await checkAntiLoopStatus(cleanPhone, rawText);
    if (!loopStatus.allowed) {
      return; // Silêncio absoluto para quebrar loop ou recurso já processado
    }
  }

  // ── Interceptação 0: Feedbacks, Críticas e Sugestões dos Clientes ──────────
  const { isFeedbackMessage, recordClientFeedback } = await import('@/lib/solo/feedback');
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

  // ── Interceptação 0.1: Comandos de Administração Diretos (!qa, !feedbacks, !ajuda, etc.) ──
  if (client?.is_admin && (cleanText.startsWith('!') || cleanText.startsWith('/'))) {
    const adminResponse = await handleAdminCommands(client.id, rawText);
    if (adminResponse.handled && adminResponse.message) {
      await sendEvolutionText({ phone, text: adminResponse.message });
      return;
    }
  }

  // ── Interceptação 1: Comando de Indicação (!indicar ou indicar) & Pioneiros VIP ───
  if (
    cleanText === '!indicar' || cleanText === 'indicar' ||
    cleanText === '!indicação' || cleanText === 'indicação' || cleanText === '/indicar' ||
    cleanText === '!vip' || cleanText === 'vip' ||
    cleanText === '!pioneiro' || cleanText === 'pioneiro'
  ) {
    const { getPioneerShareMessage } = await import('@/lib/solo/trial');
    const shareMsg = getPioneerShareMessage(cleanPhone);
    await sendEvolutionText({ phone, text: shareMsg });
    return;
  }

  if (false) {
    if (client) {
      const shareMsg = await getReferralShareMessage(client.id, client.whatsapp_number);
      await sendEvolutionText({ phone, text: shareMsg });
      return;
    } else {
      await sendEvolutionText({
        phone,
        text: `🎁 *Programa de Indicação AnalisAí — Mensalidade 100% Grátis!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Assine um de nossos planos e indique 3 amigos ou parceiros empresariais no mesmo plano ou superior para **zerar sua fatura** enquanto eles continuarem ativos!

👉 Para começar agora mesmo, envie uma foto ou PDF de boleto para testar nossa degustação gratuita!`,
      });
      return;
    }
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

  // ── Interceptação 1.2: Projeção Estendida de Fluxo de Caixa (> 7 dias / Mês) ────
  // Se o cliente ou lead solicitar prazo maior que uma semana, recusa educadamente
  // e apresenta o Relatório de Fluxo de Caixa Futuro avulso (R$ 49,00)
  const {
    isLongTermCashFlowQuery,
    isWeeklyBillsQuery,
    getExtendedCashFlowProposalMessage,
    getUpcomingBillsSummary,
  } = await import('@/lib/solo/cash-flow-advisor');

  const hasMonetaryPattern = /(?:r\$\s*|reais|\b\d+[,.]\d{2}\b)/i.test(rawText);
  const isFinancialAction = /(?:pagar|receber|comprei|gastei|transferir|lance|lançar)/i.test(cleanText);

  if (isLongTermCashFlowQuery(cleanText) && (!hasMonetaryPattern || !isFinancialAction)) {
    const extendedProposal = getExtendedCashFlowProposalMessage();
    await sendEvolutionText({ phone, text: extendedProposal });
    return;
  }

  // ── Interceptação 1.3: Agenda de Contas da Semana (Até 7 dias) ───────────────
  if (isWeeklyBillsQuery(cleanText) && (!hasMonetaryPattern || !isFinancialAction)) {
    const weeklySummary = await getUpcomingBillsSummary(client?.id || null, cleanPhone);
    await sendEvolutionText({ phone, text: weeklySummary });
    return;
  }

  // ── Interceptação 2: Lead vindo de Link de Indicação de Amigo ───────────────
  const referralMatch = rawText.match(/(?:indica[çc][ãa]o do cliente|indicado por)\s*(\d{10,14})/i);
  if (referralMatch && referralMatch[1]) {
    const referrerPhone = referralMatch[1];
    await linkReferralLead(cleanPhone, referrerPhone);
    await sendEvolutionText({
      phone,
      text: `🎉 *Bem-vindo ao AnalisAí!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que você veio por indicação de um de nossos parceiros!
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
      const isFinancial =
        extraction.is_financial_doc !== false &&
        (extraction.doc_type !== 'outro' || (extraction.total_amount > 0 && extraction.counterparty_name !== 'Desconhecido'));

      if (!isFinancial) {
        await sendEvolutionText({
          phone,
          text: `⚠️ *Documento não identificado como financeiro.*
O arquivo enviado não parece ser um boleto, conta de consumo ou nota fiscal.

Na nossa degustação gratuita, envie uma foto nítida de um boleto ou NF para ver o robô funcionando em tempo real!`,
        });
        return;
      }

      // Registra que a degustação foi realizada
      await recordTrialUsage(cleanPhone, extraction);

      // 1. Envia resumo executivo do documento informando a cota restante
      const remainingAfter = Math.max(0, (trialStatus.remainingDocs || 1) - 1);
      const summaryText = formatTrialDocSummary(extraction, remainingAfter);
      await sendEvolutionText({ phone, text: summaryText });

      // 2. Se houver código de barras / Pix / linha digitável, envia separado para cópia rápida
      if (extraction.barcode_or_pix) {
        await sendEvolutionText({
          phone,
          text: `📋 *Código de Barras / Linha Digitável (toque para copiar):*
${extraction.barcode_or_pix.trim()}

${BANK_SAFETY_NOTICE}`,
        });
      }

      // 3. Envia Demonstrativo Contábil em PDF para causar forte impressão profissional (Fisgar o lead)
      try {
        const { sendTrialPdfToWhatsApp } = await import('@/lib/solo/cash-ledger-pdf');
        await sendTrialPdfToWhatsApp(cleanPhone, extraction);
      } catch (trialPdfErr) {
        console.warn('[Trial PDF Generation Warning]:', trialPdfErr);
      }

      // 4. Envia o Menu de Assinatura com Links Diretos do Asaas
      await sendEvolutionText({
        phone,
        text: getTrialConversionMenu(),
      });
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
        if (conv.is_financial_entry && conv.amount && conv.due_date) {
          const isIncome = conv.entry_type === 'receivable';
          const entity = conv.supplier_or_customer || (isIncome ? 'Cliente' : 'Fornecedor');
          const mockExtracted = {
            is_financial_doc: true,
            supplier_name: entity,
            counterparty_name: entity,
            total_amount: Number(conv.amount),
            amount: Number(conv.amount),
            due_date: conv.due_date,
            document_type: isIncome ? 'Recebimento' : 'Conta a Pagar',
            category: conv.category_suggestion || (isIncome ? 'Receita Operacional' : 'Despesa Administrativa'),
            barcode_or_pix: null,
          };

          await recordTrialUsage(cleanPhone, mockExtracted);

          const remainingAfter = Math.max(0, (trialStatus.remainingDocs || 1) - 1);
          const summaryText = formatTrialDocSummary(mockExtracted, remainingAfter);
          await sendEvolutionText({ phone, text: summaryText });

          try {
            const { sendTrialPdfToWhatsApp } = await import('@/lib/solo/cash-ledger-pdf');
            await sendTrialPdfToWhatsApp(cleanPhone, mockExtracted);
          } catch (trialPdfErr) {
            console.warn('[Trial Text PDF Generation Warning]:', trialPdfErr);
          }

          await sendEvolutionText({
            phone,
            text: getTrialConversionMenu(),
          });
          return;
        }
      } catch (trialTextErr) {
        console.warn('[Trial Text Entry Error]:', trialTextErr);
      }
    }

    // Se o usuário não cadastrado enviou texto comum, registra tentativa infrutífera no anti-looping
    if (!isAdminPhone) {
      const { recordFruitlessAttempt } = await import('@/lib/solo/anti-loop');
      const attemptRes = await recordFruitlessAttempt(cleanPhone, rawText);
      if (attemptRes.actionTaken !== 'increment') {
        return; // Ação de encerramento ou bloqueio disparada, interrompe execução
      }
    }

    // Se ainda estiver no limite de tolerância, apresenta a mensagem de boas-vindas da Degustação
    await sendEvolutionText({
      phone,
      text: getTrialWelcomeMessage(),
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

  // 3. Verifica se o cliente possui uma ação pendente de confirmação (TTL 10 min)
  const { data: pendingAction } = await supabase
    .from('bot_action_confirmations')
    .select('*')
    .eq('client_id', client.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (pendingAction && rawText) {
    const trimmed = cleanText.trim().toLowerCase();
    const isAffirmative = /^(sim\b|s\b|confirmo\b|pode\b|correto\b|ok\b|positivo\b|com\s*certeza\b)/i.test(trimmed) && trimmed.length <= 20;
    const isNegative = /^(n[aã]o\b|n\b|cancela\b|cancelar\b|errado\b|incorreto\b|deixa\b)/i.test(trimmed) && trimmed.length <= 20;
    

    if (isAffirmative) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'confirmed' })
        .eq('id', pendingAction.id);

      // Confirmação de Leitura de Documento com Baixa Certeza
      if (pendingAction.action_type === 'confirm_low_confidence_doc') {
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
O valor de *R$ ${Number(payload.total_amount).toFixed(2)}* referente a *${payload.counterparty_name}* já foi registrado no seu Livro Caixa.`,
        });
        return;
      }

      // Confirmação de Alteração de Vencimento
      if (pendingAction.action_type === 'update_due_date') {
        const payload = pendingAction.proposed_payload as any;

        await supabase
          .from('payables_receivables')
          .update({
            current_due_date: payload.new_due_date,
            status: 'postponed',
            notes: `Vencimento prorrogado de ${payload.old_due_date} para ${payload.new_due_date} via comando de voz em ${new Date().toLocaleDateString('pt-BR')}`,
          })
          .eq('id', payload.bill_id);

        await recordAuditLog({
          clientId: client.id,
          actorPhone: phone,
          action: 'UPDATE_DUE_DATE',
          entityType: 'payables_receivables',
          entityId: payload.bill_id,
          details: {
            supplier: payload.supplier,
            amount: payload.amount,
            old_due_date: payload.old_due_date,
            new_due_date: payload.new_due_date,
          },
        });

        await sendEvolutionText({
          phone,
          text: `✅ *Vencimento Alterado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Conta: *${payload.supplier}*
• Valor: *R$ ${Number(payload.amount).toFixed(2)}*
• Nova data de vencimento: *${formatDueDateDetails(payload.new_due_date)}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seus relatórios e lembretes diários já foram sincronizados com a nova data.`,
        });
        return;
      }

      // Confirmação de Exclusão de Conta
      if (pendingAction.action_type === 'delete_bill') {
        const payload = pendingAction.proposed_payload as any;

        // Exclusão Lógica com fé pericial forense (preserva a prova no banco)
        await supabase
          .from('payables_receivables')
          .update({
            status: 'canceled',
            notes: `Conta cancelada/excluída expressamente via confirmação WhatsApp por ${phone} em ${new Date().toISOString()}`,
          })
          .eq('id', payload.bill_id);

        await recordAuditLog({
          clientId: client.id,
          actorPhone: phone,
          action: 'DELETE_BILL',
          entityType: 'payables_receivables',
          entityId: payload.bill_id,
          details: {
            supplier: payload.supplier,
            amount: payload.amount,
            due_date: payload.due_date,
            confirmation_type: isAffirmative ? 'user_confirmed' : 'unknown',
          },
        });

        if (payload.document_id) {
          await supabase
            .from('cash_ledger_entries')
            .delete()
            .eq('document_id', payload.document_id);
        }

        await sendEvolutionText({
          phone,
          text: `🗑️ *Conta Excluída com Sucesso!*\n\nO lançamento referente a *${payload.supplier}* (R$ ${Number(payload.amount).toFixed(2)}) foi removido do seu Livro Caixa e da sua agenda de pagamentos.`,
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
        text: `🚫 *Ação cancelada.* Nenhuma alteração foi realizada nos seus registros.`,
      });
      return;
    }
  }

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

      await supabase.from('cash_ledger_entries').insert({
        client_id: client.id,
        document_id: docRecord?.id,
        entry_date: extracted.due_date || new Date().toISOString().split('T')[0],
        description: `${extracted.doc_type?.toUpperCase()} - ${extracted.counterparty_name}`,
        amount: -Math.abs(Number(extracted.total_amount)),
        entry_type: 'expense',
        dre_group: extracted.category_suggestion || 'despesa_administrativa',
        status: 'realizado',
      });

      // ── MECANISMO ANTI-DUPLICAÇÃO INTELIGENTE ──────────────────────────────
      // Se o documento tiver código de barras, verifica se já existe uma parcela em aberto
      // cadastrada anteriormente sem código de barras (ex: via Nota Fiscal prévia)
      let duplicateMatched = false;
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

          duplicateMatched = true;

          await sendEvolutionText({
            phone,
            text: `🔗 *Boleto vinculado à parcela existente sem duplicar!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos que este boleto corresponde ao lançamento de *${duplicateCandidate.counterparty_name}* (R$ ${Number(duplicateCandidate.amount).toFixed(2)}) que vence em *${formatDueDateDetails(duplicateCandidate.current_due_date)}*.

O código de barras foi anexado com sucesso para pagamento e lembretes sem gerar despesa duplicada no seu fluxo de caixa!`,
          });

          await sendEvolutionText({
            phone,
            text: `📋 *Código de Barras / Linha Digitável (toque para copiar):*
${extracted.barcode_or_pix.trim()}

${BANK_SAFETY_NOTICE}`,
          });

          return;
        }
      }

      // ── SUPORTE A NOTA FISCAL COM MÚLTIPLAS PARCELAS / DUPLICATAS ──────────
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

        const quotaFootnote = client.is_admin
          ? '👑 _Modo Admin Irrestrito_'
          : `Você ainda tem *${quotaCheck.remaining}* lançamento(s) disponível(is) neste mês.`;

        await sendEvolutionText({
          phone,
          text: `📑 *Nota Fiscal Faturada — ${extracted.installments.length} Parcelas Registradas!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${extracted.counterparty_name}
• *Valor Total:* R$ ${Number(extracted.total_amount).toFixed(2)}

📅 *Cronograma de Vencimentos:*
${parcelasDesc}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 O AnalisAí vai te avisar na véspera e no dia de cada parcela! Quando os boletos chegarem, basta enviá-los aqui que vinculamos automaticamente ao pagamento.
${quotaFootnote}`,
        });

        await sendEvolutionText({
          phone,
          text: `💛 *Fique tranquilo(a), todas as parcelas estão registradas no seu Livro Caixa!*
Na véspera de cada uma delas (às 10h em ponto) eu vou te avisar aqui para você não esquecer.

💡 Digite *Semana* a qualquer momento para acompanhar seus compromissos imediatos!`,
        });

        return;
      }

      // Lançamento de Parcela Única
      if (extracted.due_date) {
        await supabase.from('payables_receivables').insert({
          client_id: client.id,
          document_id: docRecord?.id,
          counterparty_name: extracted.counterparty_name,
          type: 'payable',
          amount: Number(extracted.total_amount),
          original_due_date: extracted.due_date,
          current_due_date: extracted.due_date,
          status: 'open',
          barcode_or_pix: extracted.barcode_or_pix,
        });
      }

      const formattedDueDate = extracted.due_date ? formatDueDateDetails(extracted.due_date) : 'À vista';
      const quotaFootnote = client.is_admin
        ? '👑 _Modo Admin Irrestrito_'
        : quotaCheck.consumed_from_extra
          ? `🎁 _Lançado utilizando sua carteira de documentos extras (restam ${quotaCheck.extra_credits_remaining} extras válidos)._`
          : `Você ainda tem *${quotaCheck.remaining}* lançamento(s) disponível(is) neste mês.`;

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

      // Consultoria Pedagógica de Blindagem Patrimonial (Separação PJ x PF e Sócio vs Terceiro)
      const patrimonialDoc = await analyzeBeneficiaryAndExpense(client.id, {
        supplier_name: extracted.counterparty_name,
        counterparty_name: extracted.counterparty_name,
        payer_name: (extracted as any).payer_name,
        payer_tax_id: (extracted as any).payer_tax_id,
        category: extracted.category_suggestion,
        amount: Number(extracted.total_amount),
      });
      if (patrimonialDoc.isPersonalExpense && patrimonialDoc.adviceMessage) {
        await sendEvolutionText({
          phone,
          text: patrimonialDoc.adviceMessage,
        });
      }

      // Se identificou código de barras / linha digitável / Pix, envia em mensagem separada para cópia imediata
      if (extracted.barcode_or_pix && extracted.barcode_or_pix.length >= 20) {
        await sendEvolutionText({
          phone,
          text: `📋 *Código de Barras / Linha Digitável (toque para copiar):*
${extracted.barcode_or_pix.trim()}

${BANK_SAFETY_NOTICE}`,
        });
      }

      // Acolhimento Afetivo & Menu de Superpoderes (Eliminando o Vazio Pós-Boleto)
      await sendEvolutionText({
        phone,
        text: `💛 *Pode deixar comigo, esse já está guardado a sete chaves e monitorado!*
Na véspera do vencimento (às 10h em ponto) eu te lembro aqui com o código de barras prontinho para pagar sem estresse e sem multas.

✨ *Dicas rápidas do seu AnalisAí:*
• Digite *Semana* para ver suas contas dos próximos 7 dias;
• Digite *Relatório* ou *PDF* para receber seu Livro Caixa atualizado;
• Pergunte _"qual conta devo atrasar?"_ se o caixa apertar (incluso no Solo e Solo Plus);
• Digite *Indicar* para compartilhar seu link e zerar sua mensalidade com 3 indicações ativas!`,
      });

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
        body.data?.mimetype ||
        'audio/ogg';
      const audioResult = await processVoiceCommandWithGemini(audioBase64, rawMimeType);

      if (audioResult.functionCalls.length > 0) {
        const call = audioResult.functionCalls[0];

        // 0) Function Call: Listar Contas por Voz
        if (call.name === 'list_bills') {
          await renderBillsList(client.id, phone, (call.args as any)?.filter);
          return;
        }

        // 1) Function Call: Alterar Valor de Conta por Voz
        if (call.name === 'propose_amount_change') {
          const vArgs = call.args as any;
          await handleAmountChange(client.id, phone, vArgs?.supplier_name, Number(vArgs?.new_amount));
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

          const { sendCashLedgerPdfToWhatsApp } = await import('@/lib/solo/cash-ledger-pdf');
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
    await handleDeleteBill(client.id, phone, supToDelete);
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
    cleanText.match(/(?:mudar|alterar|corrigir|trocar)s+(?:os+)?valors+(?:d[ao]s+)?([a-zA-Z0-9s]+?)s+(?:des+[d.,]+s+)?paras+([0-9.,]+)/i) ||
    cleanText.match(/([a-zA-Z0-9s]+?)[,;:s]+(?:mudar|alterar|corrigir|trocar)s+(?:os+)?valors+(?:des+[d.,]+s+)?paras+([0-9.,]+)/i) ||
    cleanText.match(/(?:mudar|alterar)s+([a-zA-Z0-9s]+?)s+paras+([0-9.,]+)s+reais/i);

  if (textAmountMatch) {
    const rawSup = textAmountMatch[1].replace(/^(contas+d[ao]|fornecedors+d[ao]|conta)s+/i, '').trim();
    const rawValStr = textAmountMatch[2].replace(/./g, '').replace(',', '.');
    const parsedVal = parseFloat(rawValStr);
    if (!isNaN(parsedVal) && parsedVal > 0 && rawSup.length >= 2) {
      await handleAmountChange(client.id, phone, rawSup, parsedVal);
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

  if (cleanText.includes('amigo') || cleanText.includes('indicar') || cleanText.includes('indica')) {
    await sendEvolutionText({
      phone,
      text: `🎁 *Programa de Indicação AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Indique 3 amigos que se tornem clientes pagantes do mesmo plano que você (ou superior) e sua **mensalidade fica 100% gratuita** enquanto os 3 estiverem ativos!

Seu link exclusivo de indicação:
👉 https://analisai.me/assinar?ref=${client.id}`,
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
    const { escalateToHumanConsultant } = await import('@/lib/solo/consultant-escalation');
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

    const { sendCashLedgerPdfToWhatsApp } = await import('@/lib/solo/cash-ledger-pdf');
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
    const { recordFruitlessAttempt } = await import('@/lib/solo/anti-loop');
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
