import { createServiceRoleClient } from '@/lib/supabase-server';
import { formatIdentifierDisplay, getIdentifierVariations } from './qa-whitelist';

export interface ReceivableItem {
  id: string;
  customerName: string;
  amount: number;
  dueDate: string;
  debtorPhone?: string | null;
  status: 'open' | 'paid';
  description?: string;
  source: 'database' | 'trial_list';
}

export interface FriendlyCollectionResult {
  success: boolean;
  message: string;
  actionUrl?: string;
  isUpsellBlock?: boolean;
}

const MAX_FREE_COLLECTIONS_TRIAL = 2;

/**
 * Normaliza número de telefone para o padrão WhatsApp wa.me (DDI 55 + DDD + Número)
 */
export function normalizePhoneForWaMe(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const clean = rawPhone.replace(/\D/g, '');
  if (!clean || clean.length < 10) return null;

  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }
  return clean;
}

/**
 * Obtém a chave Pix cadastrada ou fallback inteligente do empresário
 */
export async function getOwnerPixKey(phoneOrClientId: string): Promise<{ pixKey: string; ownerName: string }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = phoneOrClientId.replace(/\D/g, '');

  // 1. Tenta buscar em clients
  const { data: client } = await supabase
    .from('clients')
    .select('name, pix_key, tax_id, whatsapp_number')
    .or(`id.eq.${phoneOrClientId},whatsapp_number.ilike.%${cleanPhone.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  if (client) {
    const key = client.pix_key || client.tax_id || client.whatsapp_number || '';
    return {
      pixKey: key,
      ownerName: client.name || 'Empresa',
    };
  }

  // 2. Tenta em trial_leads
  const { data: lead } = await supabase
    .from('trial_leads')
    .select('pix_key, whatsapp_number')
    .ilike('whatsapp_number', `%${cleanPhone.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  return {
    pixKey: lead?.pix_key || lead?.whatsapp_number || cleanPhone,
    ownerName: 'Empresa',
  };
}

/**
 * Formata a mensagem educada de cobrança amigável para envio ao cliente final
 */
export function buildFriendlyCollectionText(params: {
  customerName: string;
  amount: number;
  dueDate: string;
  serviceDescription?: string;
  pixKey?: string;
  ownerName?: string;
}): string {
  const formattedAmount = params.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const dueParts = params.dueDate.split('-');
  const formattedDueDate =
    dueParts.length === 3 ? `${dueParts[2]}/${dueParts[1]}/${dueParts[0]}` : params.dueDate;

  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = params.dueDate < todayStr;
  const desc = params.serviceDescription ? `referente a ${params.serviceDescription} ` : '';

  const pixKeyLine = params.pixKey
    ? `🔑 *Chave Pix:* \`${params.pixKey}\`${params.ownerName ? ` (${params.ownerName})` : ''}`
    : `🔑 *Chave Pix:* _(Solicite a chave ao responder esta mensagem)_`;

  if (isOverdue) {
    // Tom amigável pós-vencimento (compreensivo e sem atrito)
    return `Olá, ${params.customerName}! Tudo bem por aí? 😊

Passando só para ver se deu tudo certo com o combinado ${desc}(no valor de *${formattedAmount}*), com vencimento que era para o dia *${formattedDueDate}*. Sei bem como a rotina é corrida!

Seguem os dados do Pix para facilitar:
${pixKeyLine}

Assim que conseguir efetuar, pode me mandar o comprovante por aqui. Muito obrigado pela parceria e confiança! 🙏`;
  }

  // Tom amigável no dia ou véspera
  return `Olá, ${params.customerName}! Tudo bem por aí? 😊

Passando para te lembrar do nosso combinado ${desc}(no valor de *${formattedAmount}*), com vencimento para *${formattedDueDate}*.

Para facilitar, você pode transferir direto via Pix:
${pixKeyLine}

Assim que efetuar, pode me enviar o comprovante por aqui. Muito obrigado pela preferência e parceria! 🙏`;
}

/**
 * Gera o link wa.me pronto para o empresário tocar e enviar ao devedor
 */
export function buildWaMeUrl(debtorPhone: string | null | undefined, messageText: string): string {
  const cleanPhone = normalizePhoneForWaMe(debtorPhone);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  }
  // Se não tiver o telefone cadastrado, abre o seletor do WhatsApp para encaminhar
  return `https://wa.me/?text=${encodeURIComponent(messageText)}`;
}

/**
 * Consulta todas as contas a receber em aberto de um cliente/lead
 */
export async function getOpenReceivables(phoneOrClientId: string): Promise<ReceivableItem[]> {
  const supabase = createServiceRoleClient();
  const cleanDigits = phoneOrClientId.replace(/\D/g, '');
  const items: ReceivableItem[] = [];

  // 1. Busca cliente
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .or(`id.eq.${phoneOrClientId},whatsapp_number.ilike.%${cleanDigits.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  if (client?.id) {
    const { data: rows } = await supabase
      .from('payables_receivables')
      .select('id, counterparty_name, amount, current_due_date, status, notes, barcode_or_pix')
      .eq('client_id', client.id)
      .eq('type', 'receivable')
      .eq('status', 'open')
      .order('current_due_date', { ascending: true });

    if (rows && rows.length > 0) {
      for (const r of rows) {
        // Tenta extrair telefone do campo notes ou barcode_or_pix se houver
        let phoneMatch: string | null = null;
        if (r.barcode_or_pix && /\d{10,13}/.test(r.barcode_or_pix)) {
          phoneMatch = r.barcode_or_pix.replace(/\D/g, '');
        } else if (r.notes) {
          const m = r.notes.match(/(?:tel|cel|whats|telefone)[:\s]*([0-9\s()-]{10,15})/i);
          if (m) phoneMatch = m[1].replace(/\D/g, '');
        }

        items.push({
          id: r.id,
          customerName: r.counterparty_name || 'Cliente',
          amount: Number(r.amount) || 0,
          dueDate: r.current_due_date,
          debtorPhone: phoneMatch,
          status: 'open',
          description: r.notes || undefined,
          source: 'database',
        });
      }
    }
  }

  // 2. Busca também em trial_leads (caso seja degustação ou tenha contas lá)
  const { data: lead } = await supabase
    .from('trial_leads')
    .select('bills_list')
    .ilike('whatsapp_number', `%${cleanDigits.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  if (lead && Array.isArray(lead.bills_list)) {
    for (const b of lead.bills_list) {
      if (b.entry_type === 'receivable' && !b.reconciled_at && b.supplier_name) {
        // Evita duplicar se já foi trazido do banco
        const alreadyExists = items.some(
          (it) => it.customerName.toLowerCase() === b.supplier_name.toLowerCase() && it.amount === b.amount
        );
        if (!alreadyExists) {
          items.push({
            id: b.id || `bill_${Math.random()}`,
            customerName: b.supplier_name,
            amount: Number(b.amount) || 0,
            dueDate: b.due_date || new Date().toISOString().split('T')[0],
            debtorPhone: b.debtor_phone || null,
            status: 'open',
            description: b.notes || undefined,
            source: 'trial_list',
          });
        }
      }
    }
  }

  return items;
}

/**
 * Verifica e incrementa a cota de cobranças cortesia para leads de degustação (Monetização)
 */
export async function checkAndIncrementTrialCollectionUsage(phone: string): Promise<{ canUse: boolean; usedCount: number }> {
  const supabase = createServiceRoleClient();
  const cleanDigits = phone.replace(/\D/g, '');

  // 1. Verifica se é assinante ativo em subscriptions (assinantes têm cobrança ILIMITADA)
  const { data: client } = await supabase
    .from('clients')
    .select('id, subscriptions(status)')
    .ilike('whatsapp_number', `%${cleanDigits.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  const isSubActive = (client?.subscriptions as any[])?.some((s) => s.status === 'active');
  if (isSubActive) {
    return { canUse: true, usedCount: 999 };
  }

  // 2. Se for lead em trial, checa cota em trial_leads
  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, doc_data')
    .ilike('whatsapp_number', `%${cleanDigits.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  if (!lead) {
    return { canUse: true, usedCount: 0 };
  }

  const docData = (lead.doc_data as any) || {};
  const currentCount = Number(docData.friendly_collections_count) || 0;

  if (currentCount >= MAX_FREE_COLLECTIONS_TRIAL) {
    return { canUse: false, usedCount: currentCount };
  }

  // Incrementa uso cortesia
  const nextCount = currentCount + 1;
  await supabase
    .from('trial_leads')
    .update({
      doc_data: {
        ...docData,
        friendly_collections_count: nextCount,
      },
    })
    .eq('id', lead.id);

  return { canUse: true, usedCount: nextCount };
}

/**
 * Processa a solicitação do empresário para gerar a cobrança amigável de um cliente específico
 */
export async function handleGenerateFriendlyCollection(
  userPhone: string,
  targetQuery?: string
): Promise<FriendlyCollectionResult> {
  const openReceivables = await getOpenReceivables(userPhone);

  if (openReceivables.length === 0) {
    return {
      success: true,
      message: `📋 *Nenhum Valor a Receber em Aberto!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você não possui nenhum recebimento agendado pendente no momento.

💡 *Para cadastrar um recebimento e gerar a cobrança amigável, basta enviar:*
👉 *"Vendi pro Marcelo R$ 350 para o dia 15, telefone 14999998888"*
Ou um áudio rápido: *"Anote 200 a receber da Maria na sexta"*.`,
    };
  }

  // 1. Localiza a conta solicitada (se o usuário informou um nome)
  let targetItem = openReceivables[0];
  if (targetQuery && targetQuery.trim()) {
    const q = targetQuery.trim().toLowerCase();
    const matched = openReceivables.find(
      (r) => r.customerName.toLowerCase().includes(q) || (r.debtorPhone && r.debtorPhone.includes(q))
    );
    if (matched) {
      targetItem = matched;
    }
  }

  // 2. Checa cota de uso e monetização
  const usage = await checkAndIncrementTrialCollectionUsage(userPhone);
  if (!usage.canUse) {
    return {
      success: false,
      isUpsellBlock: true,
      message: `🔒 *Limite de Cobranças Cortesia Atingido!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você já utilizou suas **${MAX_FREE_COLLECTIONS_TRIAL} mensagens de cobrança amigável** gratuitas na degustação! 🚀

💡 *Recuperar um único calote paga mais de 1 ano de AnalisAí!*
No plano *AnalisAí Solo* (apenas R$ 49/mês), você tem:
✅ Cobranças Amigáveis Ilimitadas com 1 toque
✅ Lembretes automáticos para você no dia do vencimento
✅ Sem risco de banimento de WhatsApp
✅ Livro Caixa e Consultor de Caixa completos

👉 Para desbloquear cobranças ilimitadas agora:
https://analisai.me/assinar`,
    };
  }

  // 3. Monta texto de cobrança e link wa.me de 1 toque
  const ownerPix = await getOwnerPixKey(userPhone);
  const friendlyMsg = buildFriendlyCollectionText({
    customerName: targetItem.customerName,
    amount: targetItem.amount,
    dueDate: targetItem.dueDate,
    serviceDescription: targetItem.description,
    pixKey: ownerPix.pixKey,
    ownerName: ownerPix.ownerName,
  });

  const waUrl = buildWaMeUrl(targetItem.debtorPhone, friendlyMsg);
  const formattedVal = targetItem.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const phoneDisplay = targetItem.debtorPhone ? formatIdentifierDisplay(targetItem.debtorPhone) : 'Não informado';

  return {
    success: true,
    actionUrl: waUrl,
    message: `🔔 *Cobrança Amigável Pronta!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* ${targetItem.customerName}
💰 *Valor:* ${formattedVal}
📅 *Vencimento:* ${targetItem.dueDate}
📱 *WhatsApp do Cliente:* ${phoneDisplay}

Sua mensagem educada com chave Pix já foi gerada com **zero risco de banimento**!
Basta tocar no link abaixo para abrir a conversa no seu WhatsApp com o texto prontinho para enviar:

📲 👉 [**TOQUE AQUI PARA ENVIAR AO ${targetItem.customerName.toUpperCase()}**](${waUrl})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Quando ele efetuar o pagamento, basta me enviar: *"${targetItem.customerName} pagou"* para eu dar baixa no seu Livro Caixa!_`,
  };
}

/**
 * Dá baixa em uma conta a receber quando o cliente efetuar o pagamento
 */
export async function markReceivableAsPaid(
  userPhone: string,
  customerQuery: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const cleanDigits = userPhone.replace(/\D/g, '');
  const q = customerQuery.trim().toLowerCase();

  // 1. Tenta baixar em payables_receivables
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .ilike('whatsapp_number', `%${cleanDigits.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  if (client?.id) {
    const { data: rows } = await supabase
      .from('payables_receivables')
      .select('id, counterparty_name, amount')
      .eq('client_id', client.id)
      .eq('type', 'receivable')
      .eq('status', 'open')
      .ilike('counterparty_name', `%${q}%`)
      .limit(1);

    if (rows && rows.length > 0) {
      const match = rows[0];
      await supabase
        .from('payables_receivables')
        .update({ status: 'paid' })
        .eq('id', match.id);

      // Registra entrada no Livro Caixa
      await supabase.from('cash_ledger_entries').insert({
        client_id: client.id,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Recebimento de ${match.counterparty_name}`,
        amount: Math.abs(match.amount),
        entry_type: 'income',
        dre_group: 'receita_operacional',
        status: 'realizado',
      });

      const formattedVal = Number(match.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return {
        success: true,
        message: `🎉 *RECEBIMENTO CONFIRMADO!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ O valor de *${formattedVal}* de *${match.counterparty_name}* foi baixado como **PAGO**.
📈 Entrada registrada com sucesso no seu Livro Caixa! Saldo atualizado.`,
      };
    }
  }

  // 2. Tenta em trial_leads (bills_list)
  const { data: lead } = await supabase
    .from('trial_leads')
    .select('id, bills_list')
    .ilike('whatsapp_number', `%${cleanDigits.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  if (lead && Array.isArray(lead.bills_list)) {
    let updated = false;
    let foundName = customerQuery;
    let foundAmount = 0;

    const newList = lead.bills_list.map((b: any) => {
      if (
        b.entry_type === 'receivable' &&
        !b.reconciled_at &&
        b.supplier_name &&
        b.supplier_name.toLowerCase().includes(q)
      ) {
        updated = true;
        foundName = b.supplier_name;
        foundAmount = Number(b.amount) || 0;
        return {
          ...b,
          reconciled_at: new Date().toISOString(),
          is_paid: true,
        };
      }
      return b;
    });

    if (updated) {
      await supabase
        .from('trial_leads')
        .update({ bills_list: newList })
        .eq('id', lead.id);

      const formattedVal = foundAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return {
        success: true,
        message: `🎉 *RECEBIMENTO CONFIRMADO!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ O valor de *${formattedVal}* de *${foundName}* foi marcado como **PAGO**!
📈 Seu Livro Caixa da degustação foi atualizado com essa receita.`,
      };
    }
  }

  return {
    success: false,
    message: `⚠️ Não encontrei nenhum recebimento pendente com o nome *"${customerQuery}"*. Para ver suas contas a receber abertas, envie *!cobrar*.`,
  };
}
