import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { extractDocumentWithGemini, processVoiceCommandWithGemini } from '@/lib/solo/gemini';
import { checkAndIncrementQuota, getClientPlanAndCurrentCycle, formatConsumptionSummary } from '@/lib/solo/quota';
import { handleAdminCommands } from '@/lib/solo/admin';
import { generateCashFlowPostponeAdvice } from '@/lib/solo/cash-flow-advisor';
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

    // Processamento desacoplado assíncrono para responder em <1s à Evolution API
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
    .select('id, name, whatsapp_number, status, is_admin')
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

  // 2. Intercepta Comandos de Administração e Teste (!ajuda, !reset, !simular, !estourar, !gerar contas)
  if (client.is_admin && (cleanText.startsWith('!') || cleanText.startsWith('/'))) {
    const adminResponse = await handleAdminCommands(client.id, rawText);
    if (adminResponse.handled && adminResponse.message) {
      await sendEvolutionText({ phone, text: adminResponse.message });
      return;
    }
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
    const isAffirmative = /^(sim|s|confirmo|pode|correto|ok|positivo)/i.test(cleanText);
    const isNegative = /^(não|nao|n|cancela|cancelar|errado|incorreto)/i.test(cleanText);

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

        await sendEvolutionText({
          phone,
          text: `✅ *Vencimento Alterado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Conta: *${payload.supplier}*
• Valor: *R$ ${Number(payload.amount).toFixed(2)}*
• Nova data de vencimento: *${payload.new_due_date}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seus relatórios e lembretes diários já foram sincronizados com a nova data.`,
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

    if (!quotaCheck.allowed && !client.is_admin) {
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
${client.is_admin ? '👑 _Modo Admin Irrestrito_' : `Você ainda tem *${quotaCheck.remaining}* documentos disponíveis neste mês.`}`,
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
  const isAudio = !!message?.audioMessage;

  if (isAudio) {
    if (plan && !plan.has_voice_commands && !client.is_admin) {
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
    if (!quotaCheck.allowed && !client.is_admin) {
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

      // A) Function Call: Alterar Vencimento por Voz
      if (call.name === 'propose_due_date_change') {
        const args = call.args as any;
        const supplierQuery = args.supplier_name || '';
        const targetDate = args.target_date;

        // Busca conta em aberto compatível
        const { data: matchedBill } = await supabase
          .from('payables_receivables')
          .select('*')
          .eq('client_id', client.id)
          .eq('status', 'open')
          .ilike('counterparty_name', `%${supplierQuery}%`)
          .order('current_due_date', { ascending: true })
          .limit(1)
          .single();

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
• *Vencimento Atual:* ${matchedBill.current_due_date}
• *Novo Vencimento Solicitado:* ${targetDate}

Você confirma adiar esta conta?
👉 Responda *Sim* para confirmar ou *Não* para manter como está.`,
          });
          return;
        } else {
          await sendEvolutionText({
            phone,
            text: `Não localizei nenhuma conta em aberto com o fornecedor "${supplierQuery}".
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

Para liberar uma nova análise estratégica detalhada de postergação de contas imediatamente por apenas **R$ 14,90**, conclua o pagamento no link seguro:
👉 ${INFINITE_PAY_ONE_OFF.cashFlowAnalysis.checkoutUrl}`,
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
    }

    await sendEvolutionText({
      phone,
      text: audioResult.textResponse || 'Entendi seu áudio! Como posso te ajudar com o financeiro hoje?',
    });
    return;
  }

  // 7. Mensagens de Texto

  // Consultor de Caixa por Texto
  if (cleanText.includes('atrasar') || cleanText.includes('postergar') || cleanText.includes('sem dinheiro') || cleanText.includes('qual conta')) {
    if (plan && !plan.has_cash_flow_advisor && !client.is_admin) {
      await sendEvolutionText({
        phone,
        text: `💡 *O Consultor de Fluxo de Caixa é exclusivo dos planos AnalisAí Solo e Solo Plus!*

No **AnalisAí Solo**, nossa IA analisa suas contas e te recomenda exatamente qual boleto postergar com o menor risco operacional.

Migre para o Solo por R$ 87,99/mês:
👉 ${INFINITE_PAY_PLANS.monthly.solo.checkoutUrl}`,
      });
      return;
    }

    const analysisCheck = await checkAndIncrementQuota(client.id, 'analysis', 1);

    if (!analysisCheck.allowed && !client.is_admin) {
      await sendEvolutionText({
        phone,
        text: `💡 *Você utilizou suas análises de fluxo de caixa incluídas no mês (${analysisCheck.limit}/${analysisCheck.limit}).*

Para liberar uma nova análise estratégica detalhada por apenas **R$ 14,90**, pague pelo link seguro:
👉 ${INFINITE_PAY_ONE_OFF.cashFlowAnalysis.checkoutUrl}`,
      });
      return;
    }

    const advice = await generateCashFlowPostponeAdvice(client.id);

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

  await sendEvolutionText({
    phone,
    text: `Olá, ${client.name.split(' ')[0]}! 😊
Como posso te ajudar hoje?
• Envie uma **foto ou PDF de boleto/nota** para eu lançar no seu Livro Caixa
• Envie um **áudio** alterando vencimento de uma conta ou pedindo conselho de caixa
• Pergunte *"qual conta devo atrasar?"* para analisar seu aperto de caixa
• Digite *consumo* para ver o uso do seu plano no mês
${client.is_admin ? '• Digite *!ajuda* para ver o painel de comandos de teste' : ''}`,
  });
}
