import { createServiceRoleClient } from '@/lib/supabase-server';
import { formatDueDateDetails } from '@/lib/solo/date-utils';
import { updateTrialBill, getTrialBills } from '@/lib/solo/trial';

export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
}

export interface ReconciliationResult {
  reconciledPayables: Array<{
    billId: string;
    counterparty: string;
    amount: number;
    dueDate: string;
    txDate: string;
    txDesc: string;
  }>;
  reconciledReceivables: Array<{
    billId: string;
    counterparty: string;
    amount: number;
    dueDate: string;
    txDate: string;
    txDesc: string;
  }>;
  unmatchedDebits: BankTransaction[];
  unmatchedCredits: BankTransaction[];
  unreconciledBills: Array<{
    id: string;
    counterparty: string;
    amount: number;
    dueDate: string;
    type: 'payable' | 'receivable';
    status: string;
  }>;
  summaryMessage: string;
  isPj: boolean;
}

/**
 * Executa a conciliação bancária completa cruzando lançamentos do extrato com
 * contas a pagar e contas a receber do cliente/lead.
 */
export async function reconcileBankTransactions(params: {
  clientId: string | null;
  phone: string;
  cleanPhone: string;
  transactions: BankTransaction[];
  bankName?: string;
}): Promise<ReconciliationResult> {
  const { clientId, phone, cleanPhone, transactions, bankName } = params;
  const supabase = createServiceRoleClient();

  // 1. Identifica se é Pessoa Jurídica (PJ)
  let isPj = false;
  let clientName = 'Empresa';

  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, tax_id, company_name')
      .eq('id', clientId)
      .maybeSingle();

    if (client) {
      clientName = client.company_name || client.name || 'Empresa';
      const cleanTax = (client.tax_id || '').replace(/\D/g, '');
      if (cleanTax.length === 14) {
        isPj = true;
      } else if (/ltda|me|epp|s\/a|sa|eireli|serviços|comercio|comércio/i.test(client.name || '')) {
        isPj = true;
      }
    }
  } else {
    // Lead degustação
    const { data: lead } = await supabase
      .from('trial_leads')
      .select('*')
      .eq('whatsapp_number', cleanPhone)
      .maybeSingle();

    if (lead) {
      clientName = lead.name || 'Sua Empresa';
      const leadCnpj = lead.cnpj || lead.doc_data?.payer_tax_id || lead.doc_data?.tax_id;
      if (leadCnpj && String(leadCnpj).replace(/\D/g, '').length === 14) {
        isPj = true;
      }
    }
  }

  const reconciledPayables: ReconciliationResult['reconciledPayables'] = [];
  const reconciledReceivables: ReconciliationResult['reconciledReceivables'] = [];
  const unmatchedDebits: BankTransaction[] = [];
  const unmatchedCredits: BankTransaction[] = [];

  // 2. Busca títulos em aberto
  let openBills: any[] = [];

  if (clientId) {
    const { data: dbBills } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['open', 'postponed']);
    openBills = dbBills || [];
  } else {
    const trialBills = await getTrialBills(cleanPhone);
    openBills = (trialBills || []).filter((b: any) => b.status !== 'paid' && b.status !== 'canceled');
  }

  const matchedBillIds = new Set<string>();

  // 3. Processa cada movimentação bancária
  for (const tx of transactions) {
    const txAmount = Math.abs(Number(tx.amount || 0));
    if (txAmount <= 0) continue;

    const txDesc = (tx.description || '').toLowerCase();

    if (tx.transaction_type === 'debit') {
      // Procura em títulos a pagar abertos
      const matchCandidate = openBills.find((b: any) => {
        if (matchedBillIds.has(b.id)) return false;
        const bType = b.type || (b.entry_type === 'receivable' ? 'receivable' : 'payable');
        if (bType === 'receivable') return false;

        const bAmount = Math.abs(Number(b.amount || 0));
        const amountDiff = Math.abs(bAmount - txAmount);
        const nameCandidate = (b.counterparty_name || b.supplier_name || '').toLowerCase();

        // Match perfeito de valor (tolerância de R$ 0.05 para tarifas/arredondamentos)
        if (amountDiff <= 0.05) return true;

        // Se o nome tiver alta aderência e o valor for próximo (até R$ 5,00 de juros/multa)
        if (nameCandidate.length >= 3 && txDesc.includes(nameCandidate) && amountDiff <= 5.0) return true;

        return false;
      });

      if (matchCandidate) {
        matchedBillIds.add(matchCandidate.id);

        // Dá baixa no título
        if (clientId) {
          await supabase
            .from('payables_receivables')
            .update({
              status: 'paid',
              notes: `Baixa automática via conciliação de extrato bancário em ${tx.date} (${tx.description})`,
            })
            .eq('id', matchCandidate.id);

          // Atualiza ou insere em cash_ledger_entries
          if (matchCandidate.document_id) {
            await supabase
              .from('cash_ledger_entries')
              .update({
                status: 'realizado',
                entry_date: tx.date || new Date().toISOString().split('T')[0],
              })
              .eq('document_id', matchCandidate.document_id);
          } else {
            await supabase.from('cash_ledger_entries').insert({
              client_id: clientId,
              entry_date: tx.date || new Date().toISOString().split('T')[0],
              description: `PAGAMENTO CONCILIADO - ${matchCandidate.counterparty_name} (${tx.description})`,
              amount: -txAmount,
              entry_type: 'expense',
              dre_group: matchCandidate.category || 'despesa_administrativa',
              status: 'realizado',
            });
          }
        } else {
          // Atualiza lead trial
          await updateTrialBill(cleanPhone, matchCandidate.supplier_name || matchCandidate.counterparty_name, {
            status: 'paid',
            notes: `Baixa automática via conciliação de extrato bancário em ${tx.date}`,
          });
        }

        reconciledPayables.push({
          billId: matchCandidate.id,
          counterparty: matchCandidate.counterparty_name || matchCandidate.supplier_name || 'Fornecedor',
          amount: txAmount,
          dueDate: matchCandidate.current_due_date || matchCandidate.due_date,
          txDate: tx.date,
          txDesc: tx.description,
        });
      } else {
        unmatchedDebits.push(tx);
      }
    } else if (tx.transaction_type === 'credit') {
      // Procura em títulos a receber abertos
      const matchCandidate = openBills.find((b: any) => {
        if (matchedBillIds.has(b.id)) return false;
        const bType = b.type || (b.entry_type === 'receivable' ? 'receivable' : 'payable');
        if (bType !== 'receivable') return false;

        const bAmount = Math.abs(Number(b.amount || 0));
        const amountDiff = Math.abs(bAmount - txAmount);
        const nameCandidate = (b.counterparty_name || b.supplier_name || '').toLowerCase();

        if (amountDiff <= 0.05) return true;
        if (nameCandidate.length >= 3 && txDesc.includes(nameCandidate) && amountDiff <= 5.0) return true;

        return false;
      });

      if (matchCandidate) {
        matchedBillIds.add(matchCandidate.id);

        if (clientId) {
          await supabase
            .from('payables_receivables')
            .update({
              status: 'paid',
              notes: `Recebimento liquidado via conciliação bancária em ${tx.date} (${tx.description})`,
            })
            .eq('id', matchCandidate.id);

          if (matchCandidate.document_id) {
            await supabase
              .from('cash_ledger_entries')
              .update({
                status: 'realizado',
                entry_date: tx.date || new Date().toISOString().split('T')[0],
              })
              .eq('document_id', matchCandidate.document_id);
          } else {
            await supabase.from('cash_ledger_entries').insert({
              client_id: clientId,
              entry_date: tx.date || new Date().toISOString().split('T')[0],
              description: `RECEBIMENTO CONCILIADO - ${matchCandidate.counterparty_name} (${tx.description})`,
              amount: txAmount,
              entry_type: 'income',
              dre_group: matchCandidate.category || 'receita_operacional',
              status: 'realizado',
            });
          }
        } else {
          await updateTrialBill(cleanPhone, matchCandidate.supplier_name || matchCandidate.counterparty_name, {
            status: 'paid',
            notes: `Recebimento liquidado via conciliação bancária em ${tx.date}`,
          });
        }

        reconciledReceivables.push({
          billId: matchCandidate.id,
          counterparty: matchCandidate.counterparty_name || matchCandidate.supplier_name || 'Cliente',
          amount: txAmount,
          dueDate: matchCandidate.current_due_date || matchCandidate.due_date,
          txDate: tx.date,
          txDesc: tx.description,
        });
      } else {
        unmatchedCredits.push(tx);
      }
    }
  }

  // 4. Identifica contas agendadas que NÃO foram encontradas no extrato
  const unreconciledBills = openBills
    .filter((b: any) => !matchedBillIds.has(b.id))
    .map((b: any) => ({
      id: b.id,
      counterparty: b.counterparty_name || b.supplier_name || 'Conta',
      amount: Number(b.amount || 0),
      dueDate: b.current_due_date || b.due_date,
      type: (b.type || (b.entry_type === 'receivable' ? 'receivable' : 'payable')) as 'payable' | 'receivable',
      status: b.status || 'open',
    }));

  // 5. Montagem da Mensagem Executiva e Interativa para WhatsApp
  const bankHeader = bankName ? ` (${bankName})` : '';
  let summary = `🏦 *Conciliação Bancária Concluída!*${bankHeader}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `Analisamos *${transactions.length} movimentação(ões)* do seu extrato bancário com inteligência artificial.\n\n`;

  // Seção 1: Contas Pagas Baixadas
  if (reconciledPayables.length > 0) {
    const totalPaid = reconciledPayables.reduce((acc, p) => acc + p.amount, 0);
    summary += `✅ *Contas Baixadas como Pagas (${reconciledPayables.length}):*\n`;
    for (const p of reconciledPayables) {
      const amtFmt = p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      summary += `• *${p.counterparty}*: ${amtFmt} (Pago em ${formatDueDateDetails(p.txDate)})\n`;
    }
    summary += `↳ Total baixado: *${totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n`;
  }

  // Seção 2: Recebimentos Baixados
  if (reconciledReceivables.length > 0) {
    const totalRec = reconciledReceivables.reduce((acc, r) => acc + r.amount, 0);
    summary += `🟢 *Recebimentos Confirmados e Liquidados (${reconciledReceivables.length}):*\n`;
    for (const r of reconciledReceivables) {
      const amtFmt = r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      summary += `• *${r.counterparty}*: ${amtFmt} (Recebido em ${formatDueDateDetails(r.txDate)})\n`;
    }
    summary += `↳ Total recebido: *${totalRec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n`;
  }

  // Seção 3: Inconsistências - Saídas no extrato não previstas
  if (unmatchedDebits.length > 0) {
    const totalUnmatchedDebits = unmatchedDebits.reduce((acc, d) => acc + d.amount, 0);
    summary += `⚠️ *Inconsistências — Saídas no Extrato Não Previstas (${unmatchedDebits.length}):*\n`;
    for (const d of unmatchedDebits.slice(0, 8)) {
      const amtFmt = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      summary += `• ${d.date ? formatDueDateDetails(d.date) : 'Data n/d'}: *${d.description}* (${amtFmt})\n`;
    }
    if (unmatchedDebits.length > 8) {
      summary += `_... e mais ${unmatchedDebits.length - 8} saída(s) pendente(s)._\n`;
    }
    summary += `↳ Total de saídas não cadastradas: *${totalUnmatchedDebits.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n`;
  }

  // Seção 4: Inconsistências - Entradas no extrato não previstas
  if (unmatchedCredits.length > 0) {
    const totalUnmatchedCredits = unmatchedCredits.reduce((acc, c) => acc + c.amount, 0);
    summary += `📥 *Inconsistências — Entradas no Extrato Não Agendadas (${unmatchedCredits.length}):*\n`;
    for (const c of unmatchedCredits.slice(0, 8)) {
      const amtFmt = c.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      summary += `• ${c.date ? formatDueDateDetails(c.date) : 'Data n/d'}: *${c.description}* (${amtFmt})\n`;
    }
    if (unmatchedCredits.length > 8) {
      summary += `_... e mais ${unmatchedCredits.length - 8} entrada(s) pendente(s)._\n`;
    }
    summary += `↳ Total de entradas não cadastradas: *${totalUnmatchedCredits.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n`;
  }

  // Seção 5: Alerta Educativo Tributário e Blindagem Fiscal para PJ (Art. 61 Lei 8.981/95)
  if (isPj && unmatchedDebits.length > 0) {
    summary += `🛡️ *ALERTA FISCAL & BLINDAGEM TRIBUTÁRIA PARA PJ:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identificamos *${unmatchedDebits.length} saída(s) bancária(s)* que não possuem Nota Fiscal ou comprovante vinculado ao seu CNPJ.

⚠️ *Riscos Contábeis e Fiscais (Art. 61 da Lei nº 8.981/95):*
• Pagamentos efetuados pela conta bancária de Pessoa Jurídica sem documentação idônea que comprove a causa e o beneficiário são caracterizados pelo Fisco como *Pagamentos sem Causa*.
• Essa infração pode sujeitar a empresa a uma autuação com **35% de Imposto de Renda Retido na Fonte (IRRF punitivo)** sobre o valor total pago, além de multa de ofício de até 75% e juros SELIC!
• _(Nota: Esta exigência e risco fiscal aplicam-se estritamente à Pessoa Jurídica; para Pessoas Físicas não há incidência desse dispositivo)._

💡 *Como agir:*
Envie aqui uma foto ou PDF da Nota Fiscal, Recibo ou Contrato de cada um desses débitos para mantermos seu Livro Caixa 100% blindado contra o Leão!\n\n`;
  }

  // Seção 6: Auditoria de Contas que Venceram e Não Constam no Extrato
  const todayYMD = new Date().toISOString().split('T')[0];
  const pastUnreconciled = unreconciledBills.filter((b) => b.dueDate && b.dueDate <= todayYMD);

  if (pastUnreconciled.length > 0) {
    summary += `🔍 *Auditoria de Baixa — Contas que Venceram sem Baixa:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Constatamos que a(s) seguinte(s) conta(s) agendada(s) venceram e **não constam quitadas** no extrato enviado:
`;
    for (const b of pastUnreconciled.slice(0, 5)) {
      const amtFmt = b.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const dueFmt = formatDueDateDetails(b.dueDate);
      const tag = b.type === 'receivable' ? 'Receita a receber' : 'Conta a pagar';
      summary += `• *${b.counterparty}* (${amtFmt} - Vencimento ${dueFmt}) [${tag}]\n`;
    }

    summary += `
❓ *Como deseja que o AnalisAí considere esta(s) conta(s)?*
1️⃣ *Paga / Recebida* — Se pagou por outro banco/dinheiro (dar baixa manual)
2️⃣ *Atrasada* — Continuar monitorando no painel de cobrança/lembretes
3️⃣ *Postergada* — Adiar vencimento (informe: *"Adiar [conta] para dia [dia]"*)
4️⃣ *Cancelada* — Excluir do fluxo de caixa (informe: *"Cancelar conta [conta]"*)
`;
  } else if (unmatchedDebits.length === 0 && unmatchedCredits.length === 0) {
    summary += `✨ *Perfeito!* Todas as movimentações do extrato bateram perfeitamente com o seu planejamento financeiro. Seu Livro Caixa está 100% conciliado! 🚀`;
  } else {
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 *Para atualizar os lançamentos que não constavam:* Basta me enviar um áudio ou texto dizendo a que se referem as entradas ou saídas (ex: *"A saída de 250 foi material de escritório"* ou *"A entrada de 1.200 foi serviço do cliente Beta"*).`;
  }

  return {
    reconciledPayables,
    reconciledReceivables,
    unmatchedDebits,
    unmatchedCredits,
    unreconciledBills,
    summaryMessage: summary,
    isPj,
  };
}
