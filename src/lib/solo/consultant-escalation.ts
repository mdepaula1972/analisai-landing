import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from './evolution';
import { ADMIN_PERSONAL_WHATSAPP } from './constants';

const CONSULTANT_WHATSAPP = process.env.CONSULTANT_ANALISAI_WHATSAPP || ADMIN_PERSONAL_WHATSAPP;

export async function escalateToHumanConsultant(
  clientId: string,
  triggerSource: string = 'client_request'
) {
  const supabase = createServiceRoleClient();

  // 1. Coleta dados do cliente e plano
  const { data: client } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      company_name,
      whatsapp_number,
      tax_id,
      subscriptions (
        status,
        plans (name)
      )
    `)
    .eq('id', clientId)
    .single();

  if (!client) return { success: false, error: 'Cliente não encontrado' };

  // 2. Coleta snapshot financeiro recente (Livro Caixa e Contas)
  const { data: entries } = await supabase
    .from('cash_ledger_entries')
    .select('amount, entry_type')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: openBills } = await supabase
    .from('payables_receivables')
    .select('amount')
    .eq('client_id', clientId)
    .eq('status', 'open');

  const totalDespesas = (entries || [])
    .filter((e) => e.entry_type === 'expense')
    .reduce((acc, e) => acc + Math.abs(Number(e.amount)), 0);

  const totalReceitas = (entries || [])
    .filter((e) => e.entry_type === 'income')
    .reduce((acc, e) => acc + Number(e.amount), 0);

  const totalContasAbertas = (openBills || []).reduce((acc, b) => acc + Number(b.amount), 0);

  const sub = Array.isArray(client.subscriptions) ? client.subscriptions[0] : client.subscriptions;
  const planName = (sub as any)?.plans?.name || 'AnalisAí Solo';

  const financialSummary = {
    total_despesas_recentes: totalDespesas,
    total_receitas_recentes: totalReceitas,
    total_contas_abertas: totalContasAbertas,
    qtd_lancamentos: entries?.length || 0,
  };

  // 3. Registra na tabela escalated_leads para histórico e auditoria
  await supabase.from('escalated_leads').insert({
    client_id: client.id,
    trigger_source: triggerSource,
    financial_summary: financialSummary,
    consultant_whatsapp: CONSULTANT_WHATSAPP,
    status: 'dispatched',
    dispatched_at: new Date().toISOString(),
  });

  const clientDigits = client.whatsapp_number.replace(/\D/g, '');
  const cleanMarcosNumber = CONSULTANT_WHATSAPP.replace(/\D/g, '');

  // 4. Notifica o Marcos via Evolution API
  const marcosNotification = `🔥 *NOVO LEAD QUALIFICADO (AnalisAí Solo)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* ${client.name}
🏢 *Empresa:* ${client.company_name || 'Autônomo / MEI'}
📱 *WhatsApp:* +${clientDigits}
📄 *Documento:* ${client.tax_id}
💼 *Plano Atual:* ${planName}

📊 *Dossiê Financeiro Preliminar (IA):*
• Despesas recentes capturadas: R$ ${totalDespesas.toFixed(2)}
• Contas em aberto a vencer: R$ ${totalContasAbertas.toFixed(2)}
• Origem do Gatilho: ${triggerSource === 'post_xray' ? 'Aceite pós Raio-X de Fornecedores' : 'Solicitação direta no chat'}
💡 *Ancoragem apresentada:* A partir de R$ 247,00

👉 *Iniciar conversa direta com o cliente:*
https://wa.me/${clientDigits}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sendEvolutionText({
    phone: cleanMarcosNumber,
    text: marcosNotification,
  });

  // 5. Responde ao cliente confirmando que o especialista entrará em contato
  await sendEvolutionText({
    phone: client.whatsapp_number,
    text: `🤝 *Perfeito, ${client.name.split(' ')[0]}!*
Já encaminhei seus dados e o resumo financeiro para o nosso consultor especialista **Marcos**.

Ele entrará em contato com você diretamente por aqui em breve para alinhar os detalhes da sua consultoria financeira personalizada!`,
  });

  return { success: true };
}
