import { createServiceRoleClient } from '../src/lib/supabase-server';
import { sendEvolutionText } from '../src/lib/solo/evolution';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

interface LeadToReengage {
  phone: string;
  name?: string;
  onboarding_step: string;
  historySummary?: string;
  customMessage: string;
}

export async function runReengagement(sendMessages: boolean = false) {
  const supabase = createServiceRoleClient();

  console.log('======================================================');
  console.log(`🚀 RADAR DE REENGAJAMENTO INTELIGENTE DE LEADS (ANALISAÍ)`);
  console.log(`Modo: ${sendMessages ? 'DISPARO REAL (EVOLUTION API)' : 'SIMULAÇÃO (DRY RUN)'}`);
  console.log('======================================================\n');

  // Busca leads na degustação que interagiram mas não têm documentos enviados
  const { data: leads, error } = await supabase
    .from('trial_leads')
    .select('id, whatsapp_number, onboarding_step, profile_type, trial_docs_count, bills_list, created_at')
    .eq('converted_to_client', false)
    .order('created_at', { ascending: false });

  if (error || !leads) {
    console.error('Erro ao buscar leads:', error);
    return;
  }

  const ignoreList = ['5513999999999', '551331500987_test_archived', '5514930855878'];

  const candidateLeads = leads.filter((l: any) => {
    if (ignoreList.includes(l.whatsapp_number)) return false;
    if (l.whatsapp_number.includes('_test')) return false;
    const docsCount = Number(l.trial_docs_count || 0);
    const billsCount = Array.isArray(l.bills_list) ? l.bills_list.length : 0;
    return docsCount === 0 && billsCount === 0;
  });

  console.log(`Encontrados ${candidateLeads.length} leads qualificados para reengajamento:\n`);

  const queue: LeadToReengage[] = [];

  for (const lead of candidateLeads) {
    // Busca as últimas mensagens/insights do lead
    const { data: insights } = await supabase
      .from('user_interaction_insights')
      .select('raw_message, detected_intent, event_type, created_at')
      .eq('whatsapp_number', lead.whatsapp_number)
      .order('created_at', { ascending: false })
      .limit(10);

    const validInsights = (insights || []).filter((i: any) => i.raw_message && i.raw_message.trim().length > 0);
    const fullText = validInsights.map((i: any) => i.raw_message).join(' | ');
    const cleanFull = fullText.toLowerCase();

    let customMessage = '';

    // 1. Se mencionou que não tem funcionários ou trabalha sozinho
    if (cleanFull.includes('funcionário') || cleanFull.includes('funcionario') || cleanFull.includes('sozinho') || cleanFull.includes('autônomo') || cleanFull.includes('autonomo')) {
      customMessage = `Olá! Tudo bem? 😊

Passando para responder à sua dúvida: o AnalisAí foi feito *exatamente para quem toca o negócio sozinho ou não tem funcionários*!

Mais de 80% dos nossos clientes são autônomos, MEIs e pequenas empresas que não têm tempo para planilhas complicadas.

O robô funciona como seu *assistente financeiro pessoal no WhatsApp*:
📸 Você manda a foto de um boleto ou nota, e ele agenda o vencimento.
🎙️ Você manda um áudio dizendo *"Paguei 50 no combustível"* e ele anota na hora.
⏰ Às 10h da manhã no dia do vencimento, ele te manda o código de barras ou chave Pix pronto para pagar.

💡 *Sobre os valores:*
Você tem **30 dias de Degustação VIP 100% gratuita** (sem cartão de crédito)! Após o teste, nossos planos começam em apenas **R$ 39,90/mês**.

👉 *Quer ver funcionando na prática?*
Envie a foto de uma conta ou mande um áudio com um gasto do dia para testar agora mesmo! 🚀`;
    }
    // 2. Lead perguntou sobre custos, preços ou planos
    else if (cleanFull.includes('custo') || cleanFull.includes('preço') || cleanFull.includes('preco') || cleanFull.includes('valor') || cleanFull.includes('plano')) {
      customMessage = `Olá! Tudo bem? 😊

Vi que você nos perguntou sobre os *custos e planos* do AnalisAí!

💡 *Você tem 30 dias de Degustação VIP 100% gratuita:*
Você não precisa cadastrar cartão de crédito e não tem fidelidade nenhuma. Durante esse mês de teste você pode enviar fotos de boletos, faturas, notas, extratos e receber os lembretes com código de barras/Pix direto aqui no seu WhatsApp!

Após os 30 dias, cada plano é desenhado para o seu estágio:
• 🟢 *Start (R$ 39,90/mês):* 30 lançamentos/mês via texto e lembretes diários.
• ⭐ *Solo (R$ 87,99/mês):* 80 lançamentos/mês, comandos por voz/áudio, Livro Caixa em PDF e conciliação mensal.
• 🚀 *Solo Plus (R$ 157,99/mês):* 200 lançamentos/mês, integração PJ + PF e 4 análises de caixa.
• 💼 *Pro (R$ 297,00/mês):* 500 lançamentos/mês, até 2 CNPJs e conciliação semanal.

👉 *Que tal fazer um teste rápido agora sem compromisso?*
Envie a foto ou PDF de um boleto ou conta de consumo (luz, água, aluguel) aqui para você ver a nossa inteligência artificial lendo os dados em tempo real! 🚀`;
    }
    // 3. Lead perguntou como funciona pelo Zap
    else if (cleanFull.includes('como funciona') || cleanFull.includes('pelo zap')) {
      customMessage = `Olá! Tudo bem? 😊

Você perguntou como funciona o controle financeiro pelo Zap e quero te mostrar como é simples e prático:

Você não precisa baixar nenhum aplicativo nem preencher planilhas. Tudo acontece aqui pelo WhatsApp:
1️⃣ *Envie fotos ou PDFs:* Boletos, faturas, notas ou extratos bancários. A IA lê valor, vencimento e favorecido em 3 segundos.
2️⃣ *Lançamentos por voz:* Mande um áudio dizendo o que pagou ou recebeu e seu caixa é atualizado na hora.
3️⃣ *Lembretes pontuais:* Avisamos às 10h nos dias de vencimento com a linha digitável pronta para você copiar e pagar sem atraso.
4️⃣ *Relatórios instantâneos:* Pergunte *"saldo"*, *"o que tenho a pagar"* ou *"relatório do mês"* quando quiser.

🎁 *Você tem 30 dias de Degustação VIP gratuita, sem precisar de cartão!*
Que tal experimentar agora? É só me enviar a foto de um boleto ou conta para ver funcionando na hora! 🚀`;
    }
    // 4. Lead pediu mais informações gerais
    else {
      customMessage = `Olá! Tudo bem? 😊

Passando para te dar as boas-vindas ao AnalisAí!

O AnalisAí é o seu assistente de gestão financeira inteligente que funciona 100% pelo WhatsApp:
• 📸 Leitura automática de boletos, notas fiscais e extratos bancários por foto ou PDF.
• 🎙️ Registro de despesas e receitas por mensagens de áudio ou texto.
• ⏰ Lembretes matinais automáticos com o código de barras e Pix para pagar sem multas.
• 📊 Relatórios de fluxo de caixa e saldo em tempo real.

🎁 Liberamos para você **30 dias de Degustação VIP 100% gratuita**, sem compromisso e sem precisar cadastrar cartão de crédito!

👉 *Para ver a mágica acontecer:* envie uma foto de qualquer boleto ou conta de consumo aqui no chat!`;
    }

    queue.push({
      phone: lead.whatsapp_number,
      onboarding_step: lead.onboarding_step,
      historySummary: fullText,
      customMessage,
    });
  }

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    console.log(`[${i + 1}/${queue.length}] Lead: ${item.phone}`);
    console.log(`   Histórico de mensagens: "${item.historySummary || '(sem mensagens anteriores)'}"`);
    console.log(`   Mensagem personalizada a enviar:\n   ${item.customMessage.replace(/\n/g, '\n   ')}\n`);

    if (sendMessages) {
      try {
        await sendEvolutionText({
          phone: item.phone,
          text: item.customMessage,
        });
        console.log(`   ✅ Mensagem enviada com sucesso para ${item.phone}!`);

        // Registra o reengajamento no banco
        await supabase.from('user_interaction_insights').insert({
          whatsapp_number: item.phone,
          event_type: 'reengagement_sent',
          category: 'marketing',
          raw_message: item.customMessage.slice(0, 100),
          detected_intent: 'Reengajamento inteligente proativo',
          resolved: true,
        });

        // Pausa de 2.5s entre envios para respeitar a taxa do WhatsApp
        await new Promise((res) => setTimeout(res, 2500));
      } catch (err: any) {
        console.error(`   ❌ Falha ao enviar para ${item.phone}:`, err?.message || err);
      }
    }
  }

  console.log('======================================================');
  console.log(`🏁 Concluído! Total de leads processados: ${queue.length}`);
  console.log('======================================================\n');
}

// Execução direta pela linha de comando
if (require.main === module) {
  const isSend = process.argv.includes('--send');
  runReengagement(isSend)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erro na execução do reengajamento:', err);
      process.exit(1);
    });
}
