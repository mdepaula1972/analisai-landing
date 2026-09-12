import { createServiceRoleClient } from '@/lib/supabase-server';
import { PlanCode } from '@/types/solo';
import { executeAndSendSupplierXRay } from './supplier-xray';
import { escalateToHumanConsultant } from './consultant-escalation';
import { addDays } from 'date-fns';

export interface AdminCommandResult {
  handled: boolean;
  message?: string;
}

/**
 * Processador de Comandos Administrativos e de Teste do AnalisAí Solo
 * Permite ao Marcos e administradores testar todas as ramificações de planos,
 * cotas, bloqueios e fluxos diretamente pelo WhatsApp em tempo real.
 */
export async function handleAdminCommands(
  clientId: string,
  commandText: string
): Promise<AdminCommandResult> {
  const clean = commandText.trim().toLowerCase();

  // Verifica se o texto inicia com prefixo de comando administrativo: ! ou /
  if (!clean.startsWith('!') && !clean.startsWith('/')) {
    return { handled: false };
  }

  const supabase = createServiceRoleClient();

  // 1. Valida se o cliente é de fato Administrador
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, is_admin, whatsapp_number')
    .eq('id', clientId)
    .single();

  if (!client || !client.is_admin) {
    return { handled: false };
  }

  const parts = clean.replace(/^[!/]/, '').split(' ');
  const action = parts[0];
  const arg1 = parts[1];

  // ── !ajuda / !help ──────────────────────────────────────────────────────────
  if (action === 'help' || action === 'ajuda') {
    return {
      handled: true,
      message: `🛠️ *Painel de Controle Admin (Acesso Irrestrito)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Comandos disponíveis para você testar todas as opções:

• *!status* → Exibe seu plano atual, limites consumidos e status
• *!reset* → Zera todos os contadores do seu ciclo para testar do início
• *!simular start* → Muda seu plano para **Start** (testa bloqueio de voz e upsell)
• *!simular solo* → Muda seu plano para **Solo** (testa 2 análises de caixa e áudio)
• *!simular plus* → Muda seu plano para **Solo Plus** (o dobro de limites)
• *!estourar doc* → Simula que você estourou a cota de documentos
• *!estourar analise* → Simula que você gastou todas análises de caixa
• *!gerar contas teste* → Cria 4 contas a pagar fictícias para testar o consultor
• *!raio-x* → Dispara a geração e envio imediato do **Raio-X de Fornecedores em PDF**
• *!escalar* → Simula o **Escalonamento Humano**, disparando o lead no seu WhatsApp
• *!bypass on* → Ativa modo sem limites (tudo liberado)
• *!bypass off* → Desativa bypass (vivencia a experiência de cliente normal)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    };
  }

  // ── !status ─────────────────────────────────────────────────────────────────
  if (action === 'status') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, billing_period, plans(*)')
      .eq('client_id', clientId)
      .single();

    const { data: cycle } = await supabase
      .from('usage_cycles')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const plan = sub?.plans as any;

    return {
      handled: true,
      message: `🔍 *Diagnóstico de Conta Admin*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Nome:* ${client.name}
📱 *WhatsApp:* ${client.whatsapp_number}
👑 *Status Admin:* ATIVO (Acesso Irrestrito)
📦 *Plano Ativo:* ${plan?.name || 'Nenhum'} (${sub?.billing_period})
🎙️ *Comandos Voz:* ${plan?.has_voice_commands ? '✅ Habilitado' : '❌ Desabilitado'}
💡 *Consultor Caixa:* ${plan?.has_cash_flow_advisor ? '✅ Habilitado' : '❌ Desabilitado'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Contadores do Ciclo:*
• Documentos: ${cycle?.docs_processed_count || 0} / ${plan?.doc_limit || 0} (Estourou: ${cycle?.hit_doc_limit ? 'Sim' : 'Não'})
• Interações Bot: ${cycle?.bot_interactions_count || 0} / ${plan?.bot_interaction_limit || 0}
• Análises de Caixa: ${cycle?.cash_flow_analyses_count || 0} / ${plan?.cash_flow_analysis_limit || 0} (Estourou: ${cycle?.hit_analysis_limit ? 'Sim' : 'Não'})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    };
  }

  // ── !reset ──────────────────────────────────────────────────────────────────
  if (action === 'reset') {
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
        upsell_suggested_at: null,
        upsell_declined_at: null,
      })
      .eq('client_id', clientId);

    return {
      handled: true,
      message: `🔄 *Contadores Resetados com Sucesso!*
Todos os seus limites deste mês foram zerados para testes. Você pode começar novos testes agora.`,
    };
  }

  // ── !simular [start|solo|plus] ──────────────────────────────────────────────
  if (action === 'simular') {
    let targetCode: PlanCode = 'solo_plus';
    if (arg1 === 'start') targetCode = 'start';
    else if (arg1 === 'solo') targetCode = 'solo';
    else if (arg1 === 'plus' || arg1 === 'solo_plus') targetCode = 'solo_plus';
    else {
      return {
        handled: true,
        message: 'Informe o plano a simular: `!simular start`, `!simular solo` ou `!simular plus`.',
      };
    }

    const { data: plan } = await supabase
      .from('plans')
      .select('id, name')
      .eq('code', targetCode)
      .single();

    if (plan) {
      await supabase
        .from('subscriptions')
        .update({ plan_id: plan.id })
        .eq('client_id', clientId);

      return {
        handled: true,
        message: `🎭 *Simulação Ativada:* Seu perfil agora está operando sob as regras do plano *${plan.name}*.
• Se testar voz no Start: receberá o gatilho de upsell.
• Se testar análise de caixa no Start: receberá o convite para o Solo.`,
      };
    }
  }

  // ── !estourar [doc|analise|bot] ─────────────────────────────────────────────
  if (action === 'estourar') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plans(*)')
      .eq('client_id', clientId)
      .single();

    const plan = sub?.plans as any;

    if (arg1 === 'doc') {
      await supabase
        .from('usage_cycles')
        .update({
          docs_processed_count: plan?.doc_limit || 30,
          hit_doc_limit: true,
        })
        .eq('client_id', clientId);

      return {
        handled: true,
        message: `💥 *Cota de Documentos Estourada!* Agora, envie qualquer foto ou PDF para testar a resposta de bloqueio e sugestão de upgrade para o Solo Plus.`,
      };
    }

    if (arg1 === 'analise' || arg1 === 'caixa') {
      await supabase
        .from('usage_cycles')
        .update({
          cash_flow_analyses_count: plan?.cash_flow_analysis_limit || 2,
          hit_analysis_limit: true,
        })
        .eq('client_id', clientId);

      return {
        handled: true,
        message: `💥 *Cota de Análises de Caixa Estourada!* Agora, envie uma mensagem ou áudio perguntando *"qual conta devo adiar?"* para testar a oferta de R$ 14,90 da InfinitePay.`,
      };
    }
  }

  // ── !gerar contas teste ─────────────────────────────────────────────────────
  if (action === 'gerar' && (arg1 === 'contas' || arg1 === 'teste')) {
    const today = new Date();
    const contasFicticias = [
      {
        client_id: clientId,
        counterparty_name: 'Copel Energia Elétrica',
        type: 'payable',
        amount: 348.5,
        original_due_date: addDays(today, 1).toISOString().split('T')[0],
        current_due_date: addDays(today, 1).toISOString().split('T')[0],
        status: 'open',
        criticality_score: 5,
        barcode_or_pix: '84600000003485000109011234567890123456',
        notes: 'Serviço essencial com aviso de corte em 15 dias',
      },
      {
        client_id: clientId,
        counterparty_name: 'Vivo Fibra Internet Empresarial',
        type: 'payable',
        amount: 129.9,
        original_due_date: addDays(today, 2).toISOString().split('T')[0],
        current_due_date: addDays(today, 2).toISOString().split('T')[0],
        status: 'open',
        criticality_score: 5,
        barcode_or_pix: '84610000001299000209012345678901234567',
        notes: 'Internet do escritório',
      },
      {
        client_id: clientId,
        counterparty_name: 'Distribuidora de Embalagens Silva',
        type: 'payable',
        amount: 1850.0,
        original_due_date: addDays(today, 3).toISOString().split('T')[0],
        current_due_date: addDays(today, 3).toISOString().split('T')[0],
        status: 'open',
        criticality_score: 2,
        barcode_or_pix: '23793381286000018500012345678901234567',
        notes: 'Fornecedor parceiro com prazo flexível de 10 dias sem juros',
      },
      {
        client_id: clientId,
        counterparty_name: 'Imobiliária Central (Aluguel do Ponto)',
        type: 'payable',
        amount: 2500.0,
        original_due_date: addDays(today, 5).toISOString().split('T')[0],
        current_due_date: addDays(today, 5).toISOString().split('T')[0],
        status: 'open',
        criticality_score: 4,
        barcode_or_pix: '34191750000250000123456789012345678901',
        notes: 'Multa de 10% após o 5º dia de atraso',
      },
    ];

    await supabase.from('payables_receivables').insert(contasFicticias);

    return {
      handled: true,
      message: `🧾 *4 Contas a Pagar Fictícias Criadas!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Copel (R$ 348,50) - Vence amanhã (Luz - Não adiar)
2. Vivo Fibra (R$ 129,90) - Vence em 2 dias (Internet - Não adiar)
3. Fornecedor Embalagens (R$ 1.850,00) - Vence em 3 dias (Flexível - Recomendado adiar)
4. Aluguel Comercial (R$ 2.500,00) - Vence em 5 dias (Multa 10%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Experimente agora:
• Pergunte *"qual conta devo adiar?"*
• Grave um áudio: *"mude o vencimento do fornecedor de embalagens para dia 25"*`,
    };
  }

  // ── !raio-x / !testar raio-x ───────────────────────────────────────────────
  if (action === 'raio-x' || action === 'raiox') {
    executeAndSendSupplierXRay(clientId).catch((err) => {
      console.error('[Admin Raio-X Test Error]:', err);
    });

    return {
      handled: true,
      message: `🚀 *Iniciando Geração de Teste do Raio-X de Fornecedores!*
O Gemini está realizando a pesquisa via Google Search Grounding e gerando o PDF com a marca AnalisAí. O arquivo será enviado aqui no seu WhatsApp em instantes!`,
    };
  }

  // ── !escalar / !testar consultoria ─────────────────────────────────────────
  if (action === 'escalar' || action === 'consultoria') {
    escalateToHumanConsultant(clientId, 'admin_test').catch((err) => {
      console.error('[Admin Escalate Test Error]:', err);
    });

    return {
      handled: true,
      message: `📲 *Testando Escalonamento para Consultoria Humana!*
A ficha estruturada do lead qualificado está sendo despachada agora para o seu WhatsApp (+551331500987).`,
    };
  }

  // ── !bypass on / !bypass off ────────────────────────────────────────────────
  if (action === 'bypass') {
    const isBypass = arg1 === 'on';
    await supabase
      .from('clients')
      .update({ is_admin: isBypass })
      .eq('id', clientId);

    return {
      handled: true,
      message: isBypass
        ? '🔓 *Bypass Ativado:* Você tem acesso irrestrito e ilimitado a todas as ferramentas.'
        : '🔒 *Bypass Desativado:* Seu perfil agora respeitará limites normais para você simular bloqueios reais.',
    };
  }

  return {
    handled: true,
    message: 'Comando admin não reconhecido. Digite `!ajuda` para listar todos os comandos.',
  };
}
