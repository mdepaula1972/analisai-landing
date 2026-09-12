import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { extractDocumentWithGemini, processVoiceCommandWithGemini } from '@/lib/solo/gemini';
import { checkAndIncrementQuota, getClientPlanAndCurrentCycle, formatConsumptionSummary } from '@/lib/solo/quota';
import { INFINITE_PAY_PLANS, INFINITE_PAY_ONE_OFF } from '@/lib/solo/constants';
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvolutionWebhookBody;

    if (body.data?.key?.fromMe) {
      return NextResponse.json({ ignored: true, reason: 'from_me' }, { status: 200 });
    }

    const remoteJid = body.data?.key?.remoteJid || '';
    const phone = remoteJid.replace('@s.whatsapp.net', '');

    if (!phone) {
      return NextResponse.json({ ignored: true, reason: 'no_phone' }, { status: 200 });
    }

    // Processa a mensagem de forma desacoplada para responder em <1s à Evolution API
    processMessageAsync(phone, body).catch((err) => {
      console.error('[Evolution Webhook] Erro no processamento assíncrono:', err);
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    console.error('[Evolution Webhook] Erro ao decodificar webhook:', error);
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
}

async function processMessageAsync(phone: string, body: EvolutionWebhookBody) {
  const supabase = createServiceRoleClient();

  // 1. Localiza cliente pelo número de WhatsApp
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number, status')
    .or(`whatsapp_number.eq.${phone},whatsapp_number.eq.55${phone}`)
    .single();

  if (!client) {
    await sendEvolutionText({
      phone,
      text: `Olá! 👋 Bem-vindo ao *AnalisAí*.
Não encontramos uma assinatura ativa vinculada a este número de WhatsApp.

Escolha seu plano e ative seu assistente contábil self-service agora mesmo:
• *AnalisAí Start* (R$ 39,90/mês): ${INFINITE_PAY_PLANS.monthly.start.checkoutUrl}
• *AnalisAí Solo* (R$ 87,99/mês): ${INFINITE_PAY_PLANS.monthly.solo.checkoutUrl}
• *AnalisAí Solo Plus* (R$ 157,99/mês): ${INFINITE_PAY_PLANS.monthly.solo_plus.checkoutUrl}`,
    });
    return;
  }

  const message = body.data?.message;
  const rawText = message?.conversation || message?.extendedTextMessage?.text || '';
  const cleanText = rawText.trim().toLowerCase();

  // 2. Verifica se o cliente possui uma ação pendente de confirmação (TTL 10 min)
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
    const isAffirmative = /^(sim|s|confirmo|pode|correto|ok|positivo)/i.test(cleanText);
    const isNegative = /^(não|nao|n|cancela|cancelar|errado|incorreto)/i.test(cleanText);

    if (isAffirmative) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'confirmed' })
        .eq('id', pendingAction.id);

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
      }

      return;
    } else if (isNegative) {
      await supabase
        .from('bot_action_confirmations')
        .update({ status: 'rejected' })
        .eq('id', pendingAction.id);

      await sendEvolutionText({
        phone,
        text: `🚫 *Ação cancelada.* Os dados não foram salvos no seu Livro Caixa. Você pode reenviar uma foto mais nítida a qualquer momento.`,
      });
      return;
    }
  }

  // 3. Obtém Plano e Consumo do Ciclo
  const { plan, cycle } = await getClientPlanAndCurrentCycle(client.id);

  // 4. Ingestão de Documentos (Imagem ou PDF)
  const isImage = !!message?.imageMessage;
  const isDoc = !!message?.documentMessage;

  if (isImage || isDoc) {
    const quotaCheck = await checkAndIncrementQuota(client.id, 'doc', 1);

    if (!quotaCheck.allowed) {
      await sendEvolutionText({
        phone,
        text: `⚠️ *Limite de Documentos Atingido!*
Você já processou todos os ${quotaCheck.limit} documentos inclusos no seu ciclo deste mês.

Para continuar lançando sem interrupções, faça o upgrade para o **AnalisAí Solo Plus** (60 documentos/mês):
👉 ${INFINITE_PAY_PLANS.monthly.solo_plus.checkoutUrl}`,
      });
      return;
    }

    await sendEvolutionText({
      phone,
      text: `📄 *Recebi seu documento!* Estou processando a leitura contábil com inteligência artificial, aguarde um instante...`,
    });

    const base64Media = body.data?.base64 || '';
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

      await sendEvolutionText({
        phone,
        text: `✅ *Documento registrado no Livro Caixa!*
━━━━━━━━━━━━━━━━━━━━
• *Fornecedor:* ${extracted.counterparty_name}
• *Valor:* R$ ${Number(extracted.total_amount).toFixed(2)}
• *Vencimento:* ${extracted.due_date || 'À vista'}
• *Classificação:* ${extracted.category_suggestion}
━━━━━━━━━━━━━━━━━━━━
Você ainda tem *${quotaCheck.remaining}* documentos disponíveis neste mês.`,
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

  // 5. Ingestão de Áudio (Comandos por Voz)
  const isAudio = !!message?.audioMessage;

  if (isAudio) {
    if (plan && !plan.has_voice_commands) {
      await sendEvolutionText({
        phone,
        text: `🎙️ *Comandos por voz são exclusivos do AnalisAí Solo!*

No seu plano atual (*AnalisAí Start*), você gerencia suas finanças por texto e envio de documentos. 
No plano **AnalisAí Solo** (R$ 87,99/mês), você pode:
• Gravar áudios para adiar vencimentos de contas;
• Pedir conselhos de fluxo de caixa quando o dinheiro apertar.

Deseja migrar para o Solo agora? 
👉 Link de adesão direta: ${INFINITE_PAY_PLANS.monthly.solo.checkoutUrl}`,
      });
      return;
    }

    const quotaCheck = await checkAndIncrementQuota(client.id, 'bot', 1);
    if (!quotaCheck.allowed) {
      await sendEvolutionText({
        phone,
        text: `⚠️ *Limite de interações atingido!* Você utilizou todas as ${quotaCheck.limit} interações de bot do mês. Seu ciclo reseta em breve.`,
      });
      return;
    }

    const audioBase64 = body.data?.base64 || '';
    const audioResult = await processVoiceCommandWithGemini(audioBase64);

    if (audioResult.functionCalls.length > 0) {
      const call = audioResult.functionCalls[0];

      if (call.name === 'get_plan_consumption') {
        const summary = formatConsumptionSummary(cycle, plan);
        await sendEvolutionText({ phone, text: summary });
        return;
      }

      if (call.name === 'request_cash_flow_postpone_advice') {
        // Valida cota de análise de caixa
        const analysisCheck = await checkAndIncrementQuota(client.id, 'analysis', 1);

        if (!analysisCheck.allowed) {
          await sendEvolutionText({
            phone,
            text: `💡 *Você utilizou suas análises de fluxo de caixa incluídas no mês (${analysisCheck.limit}/${analysisCheck.limit}).*

Para liberar uma nova análise estratégica detalhada de postergação de contas imediatamente por apenas **R$ 14,90**, conclua o pagamento no link seguro:
👉 ${INFINITE_PAY_ONE_OFF.cashFlowAnalysis.checkoutUrl}`,
          });
          return;
        }

        await sendEvolutionText({
          phone,
          text: `📊 *Consultor de Caixa (Análise ${analysisCheck.current} de ${analysisCheck.limit}):*
Analisando suas contas em aberto:
1. **Prioridade Máxima:** Serviços essenciais (energia, internet) não devem ser atrasados para não suspender a operação.
2. **Recomendação de Postergação:** Renegociar o boleto de maior valor com prazo flexível junto ao fornecedor comercial para preservar o caixa imediato.`,
        });
        return;
      }
    }

    await sendEvolutionText({
      phone,
      text: audioResult.textResponse || 'Entendi seu áudio! Como posso te ajudar com o financeiro hoje?',
    });
    return;
  }

  // 6. Mensagens de Texto
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
Nosso parceiro oficial emite o Certificado Digital A1 (e-CNPJ ou e-CPF) com validação online rápida por apenas **${INFINITE_PAY_ONE_OFF.digitalCertificateA1.priceFormatted}**:

👉 ${INFINITE_PAY_ONE_OFF.digitalCertificateA1.checkoutUrl}`,
    });
    return;
  }

  if (cleanText.includes('raio x') || cleanText.includes('fornecedores') || cleanText.includes('fornecedor')) {
    await sendEvolutionText({
      phone,
      text: `🔍 *Raio-X de Fornecedores AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nosso sistema de IA realiza um mapeamento avançado de alternativas de fornecedores na sua região para reduzir seus custos e aumentar sua margem.

Relatório completo em PDF por apenas **${INFINITE_PAY_ONE_OFF.supplierXray.priceFormatted}**:
👉 ${INFINITE_PAY_ONE_OFF.supplierXray.checkoutUrl}`,
    });
    return;
  }

  // Se cliente do Start perguntar sobre qual conta atrasar
  if (cleanText.includes('atrasar') || cleanText.includes('postergar') || cleanText.includes('sem dinheiro')) {
    if (plan && !plan.has_cash_flow_advisor) {
      await sendEvolutionText({
        phone,
        text: `💡 *O Consultor de Fluxo de Caixa é exclusivo dos planos AnalisAí Solo e Solo Plus!*

No **AnalisAí Solo**, nossa IA analisa suas contas e te recomenda exatamente qual boleto postergar com o menor risco operacional.

Migre para o Solo por R$ 87,99/mês:
👉 ${INFINITE_PAY_PLANS.monthly.solo.checkoutUrl}`,
      });
      return;
    }
  }

  await sendEvolutionText({
    phone,
    text: `Olá, ${client.name.split(' ')[0]}! 😊
Como posso te ajudar hoje?
• Envie uma **foto ou PDF de boleto/nota** para eu lançar no seu Livro Caixa
• Digite *consumo* para ver o uso do seu plano no mês
• Digite *raio x* para contratar uma consultoria de fornecedores (${INFINITE_PAY_ONE_OFF.supplierXray.priceFormatted})
• Digite *indicar* para conhecer o programa de indicação com mensalidade grátis`,
  });
}
