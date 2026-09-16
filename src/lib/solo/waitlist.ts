import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export interface WaitlistEntry {
  whatsappNumber: string;
  clientName?: string;
  companyName?: string;
  cnpj?: string;
  desiredPlan: 'pro' | 'super';
  monthlyDocEstimate?: number;
  notes?: string;
}

const ADMIN_PHONE = '5514930855878';

/**
 * Registra um lead interessado na lista de espera dos planos Pro ou Super
 * e dispara alerta inteligente de demanda para o administrador (Marcos).
 */
export async function recordWaitlistLead(entry: WaitlistEntry): Promise<void> {
  const supabase = createServiceRoleClient();
  const cleanPhone = entry.whatsappNumber.replace(/\D/g, '');

  // 1. Insere o lead na fila de espera
  await supabase.from('plan_waitlist').insert({
    whatsapp_number: cleanPhone,
    client_name: entry.clientName || null,
    company_name: entry.companyName || null,
    cnpj: entry.cnpj ? entry.cnpj.replace(/\D/g, '') : null,
    desired_plan: entry.desiredPlan,
    monthly_doc_estimate: entry.monthlyDocEstimate || null,
    notes: entry.notes || null,
  });

  // 2. Atualiza o trial_leads se existir
  await supabase
    .from('trial_leads')
    .update({ interested_plan: entry.desiredPlan })
    .eq('whatsapp_number', cleanPhone);

  // 3. Lê estatísticas atualizadas no DB (mantidas via trigger SQL)
  const { data: stats } = await supabase
    .from('plan_waitlist_stats')
    .select('*')
    .eq('plan_code', entry.desiredPlan)
    .single();

  const totalWaiting = stats?.total_leads_waiting || 1;
  const estimatedMrr = stats?.estimated_monthly_demand_brl || (entry.desiredPlan === 'pro' ? 297 : 597);
  const planUpper = entry.desiredPlan.toUpperCase();
  const planPrice = entry.desiredPlan === 'pro' ? '297,00' : '597,00';
  const company = entry.companyName || entry.clientName || cleanPhone;

  // 4. Notifica o Marcos no WhatsApp informando o crescimento da demanda
  try {
    const alertMsg = `🚨 *Radar de Demanda AnalisAí — Lista de Espera em Alta!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 *Nova manifestação de interesse:*
• *Plano Desejado:* ${planUpper} (R$ ${planPrice}/mês)
• *Contato/Empresa:* ${company} (${cleanPhone})
${entry.cnpj ? `• *CNPJ:* ${entry.cnpj}\n` : ''}
📊 *Estatísticas Atualizadas no Banco de Dados:*
• Empresas na fila do ${planUpper}: *${totalWaiting} empresa(s)*
• Demanda mensal reprimida: *R$ ${Number(estimatedMrr).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês*

💡 *Dica Estratégica:* A demanda pelo plano ${planUpper} está crescendo! Digite *!waitlist* aqui no WhatsApp a qualquer momento para ver a lista completa e analisar a liberação de vagas seletivas.`;

    await sendEvolutionText({
      phone: ADMIN_PHONE,
      text: alertMsg,
    });
  } catch (err) {
    console.error('[Waitlist] Erro ao notificar admin sobre novo interessado:', err);
  }
}

/**
 * Obtém estatísticas consolidadas da lista de espera para tomada de decisão
 */
export async function getWaitlistSummary(): Promise<{
  total: number;
  proCount: number;
  superCount: number;
  totalEstimatedMrr: number;
  recent: any[];
}> {
  const supabase = createServiceRoleClient();

  const { data: statsRows } = await supabase
    .from('plan_waitlist_stats')
    .select('*');

  const proRow = statsRows?.find((r: any) => r.plan_code === 'pro');
  const superRow = statsRows?.find((r: any) => r.plan_code === 'super');

  const proCount = proRow?.total_leads_waiting || 0;
  const superCount = superRow?.total_leads_waiting || 0;
  const proMrr = Number(proRow?.estimated_monthly_demand_brl || 0);
  const superMrr = Number(superRow?.estimated_monthly_demand_brl || 0);

  const { data: recent } = await supabase
    .from('plan_waitlist')
    .select('id, whatsapp_number, company_name, client_name, desired_plan, created_at, status')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    total: proCount + superCount,
    proCount,
    superCount,
    totalEstimatedMrr: proMrr + superMrr,
    recent: recent || [],
  };
}

/**
 * Gera relatório executivo para o comando !waitlist no WhatsApp do Marcos
 */
export async function getWaitlistAdminReport(): Promise<string> {
  const stats = await getWaitlistSummary();

  let txt = `📊 *Relatório Executivo da Lista de Espera — Planos Corporativos*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `📈 *Demanda Reprimida no Banco de Dados:*\n`;
  txt += `• *Plano Pro (R$ 297/mês):* ${stats.proCount} empresa(s) na fila\n`;
  txt += `• *Plano Super (R$ 597/mês):* ${stats.superCount} empresa(s) na fila\n`;
  txt += `• *Total de Empresas Aguardando:* ${stats.total}\n`;
  txt += `• *Receita Mensal Potencial (MRR):* R$ ${stats.totalEstimatedMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês\n\n`;

  if (stats.recent.length > 0) {
    txt += `🕒 *Últimas Empresas Registradas:*\n`;
    stats.recent.forEach((item, idx) => {
      const dateStr = new Date(item.created_at).toLocaleDateString('pt-BR');
      const name = item.company_name || item.client_name || 'Empresa';
      txt += `${idx + 1}. *${item.desired_plan.toUpperCase()}* — ${name} (${item.whatsapp_number}) [${dateStr}]\n`;
    });
  } else {
    txt += `_Nenhuma empresa aguardando no momento._\n`;
  }

  txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `💡 *Quando decidir liberar vagas:*\n`;
  txt += `Você pode enviar o link de checkout Asaas diretamente para o WhatsApp do interessado ou cadastrá-lo pelo painel!`;

  return txt;
}
