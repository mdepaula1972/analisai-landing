import { createServiceRoleClient } from '@/lib/supabase-server';
import { PlanCode } from '@/types/solo';
import { executeAndSendSupplierXRay } from './supplier-xray';
import { escalateToHumanConsultant } from './consultant-escalation';
import { formatDueDateDetails } from './date-utils';
import { getEveReminderMessage, getDueReminderMessage } from './trial';
import { getWaitlistAdminReport } from './waitlist';
import {
  getReferralShareMessage,
  solicitarAlteracaoPix,
  confirmarAlteracaoPix,
  cancelarAlteracaoPix,
  getReferralStatus,
} from './referral';
import { getMonthlyDividendTracking } from './dividend-tracker';
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

  // ── !marcos / !testes / !roteiro ──────────────────────────────────────────
  if (action === 'marcos' || action === 'testes' || action === 'roteiro') {
    return {
      handled: true,
      message: `👑 *Guia Executivo de Testes do Marcos (AnalisAí Solo)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use estes códigos para navegar e testar cada nível na prática:

📋 *1. TESTE DA DEGUSTAÇÃO (TRIALS)*
• *!reset* → Zera seu perfil para testar como se fosse um cliente novo
• Envie foto/PDF de boleto ou digite: *"Pagar Fornecedor R$ 250 dia 28"*
• Teste *Semana* para ver a listagem dos próximos 7 dias
• Teste *Mês* para ver a recusa educada e a oferta de R$ 49

🚀 *2. TESTE DOS PLANOS PAGOS (NÍVEIS 1 A 4)*
• *!simular start* → Ativa o plano **Start** (15 lançamentos, sem áudio e sem consultor nativo)
• *!simular solo* → Ativa o plano **Solo** (30 lançamentos, áudio liberado e 2 análises de caixa)
• *!simular plus* → Ativa o **Solo Plus** (60 lançamentos, 4 análises e separação PJ x PF)
• *!gerar contas teste* → Cria 4 contas fictícias no seu Livro Caixa para testar o consultor
• Pergunte: *"Qual conta devo atrasar?"* para ver a IA contábil orientando

⛔ *3. TESTE DE BLOQUEIOS E LIMITES CONTRATUAIS*
• *!estourar lancamento* → Simula estouro da cota mensal (oferece Pacote Extra +20 por R$ 14,90 ou upgrade)
• *!estourar analise* → Simula estouro do consultor de caixa (oferece R$ 49 avulso ou upgrade)

👥 *4. GESTÃO DE USUÁRIOS QA (AMIGOS E FAMILIARES)*
• *!qa add 13978122222 João Amigo* (aceita com ou sem máscara: '(13) 97812-2222' ou '5513...') → Acesso livre QA
• *!qa list* → Lista todos os contatos que você já liberou como QA
• *!qa remove 13978122222* → Remove do modo QA
• *!feedbacks* → Vê todas as sugestões e críticas enviadas pelos testadores

📊 *5. PRODUTOS AVULSOS E AUDITORIA*
• *!pdf* ou *!relatorio* → Gera seu Livro Caixa em PDF na hora
• *!raio-x* → Emite e entrega o Raio-X de Fornecedores em PDF
• *!waitlist* → Vê a demanda acumulada dos planos Pro e Super
• *!bypass on* / *!bypass off* → Liga ou desliga modo irrestrito

🤖 *6. PILOTO AUTOMÁTICO DA IA & QA REMOTO*
• *!projeto <nome> <ideia>* → Cria novo repositório no GitHub, código base e sobe na Vercel
• *!ideia <texto>* → Envia uma ideia pelo WhatsApp para o backlog da IA
• *!bug <descrição>* → Relata uma falha presenciada no teste para a IA corrigir na hora
• *!erro <descrição>* → Sinônimo de !bug
• *!fix <id>* → Autoriza a IA a corrigir autonomamente um bug relatado
• *!fila* → Exibe todas as tarefas e status no backlog da IA

🌡️ *7. TERMÔMETRO TRIBUTÁRIO & AGRUPAMENTO INTELIGENTE (IDEIA #55)*
• *!termometro* → Régua visual de faturamento, margem segura e risco da Receita Federal
• *!regime mei* ou *!regime simples* → Configura regime fiscal
• *!faturamento [valor]* → Ajusta o faturamento acumulado fora do AnalisAí
• *!simular lembrete grupo* → Simula na hora o lembrete de múltiplas contas agrupadas (CPFL + Sabesp)
• *!simular termometro* → Simula o relatório completo de conformidade fiscal

🛡️ *7. PROTEÇÃO ANTI-LOOPING DE ROBÔS*
• *!bloqueios* → Lista números suspensos ou recursos de desbloqueio pendentes
• *!desbloquear <tel>* → Desbloqueia o número e reinicia a escada para o Nível 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Dica: Digite *!marcos* a qualquer momento para rever este guia!_`,
    };
  }

  // ── !ajuda / !help ──────────────────────────────────────────────────────────
  if (action === 'help' || action === 'ajuda') {
    return {
      handled: true,
      message: `🛠️ *Painel de Controle Admin (Acesso Irrestrito)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Comandos disponíveis para você testar todas as opções:

• *!status* → Exibe seu plano atual, limites consumidos e status
• *!reset* → Zera todos os contadores do seu ciclo para testar do início
• *!projeto <nome> <ideia>* → Cria novo SaaS/App do zero (GitHub + Vercel + DB)
• *!ideia <texto>* → Envia nova ideia pelo WhatsApp para o backlog da IA
• *!bug <descrição>* → Relata falha no teste para a IA resolver (direto do bar/rua)
• *!fila* → Lista tarefas e status em execução pela IA
• *!simular start* → Muda seu plano para **Start** (15 lançamentos, bloqueio de voz e upsell)
• *!simular solo* → Muda seu plano para **Solo** (30 lançamentos, 2 análises de caixa e áudio)
• *!simular plus* → Muda seu plano para **Solo Plus** (60 lançamentos, 4 análises de caixa)
• *!simular pro* → Muda seu plano para **Pro** (500 lançamentos, 2 CNPJs, conciliação semanal)
• *!simular super* → Muda seu plano para **Super** (1.000 lançamentos, 4 CNPJs, conciliação contínua)
• *!estourar lancamento* → Simula que você estourou a cota de lançamentos do mês
• *!estourar analise* → Simula que você gastou todas análises de caixa
• *!gerar contas teste* → Cria 4 contas a pagar fictícias para testar o consultor
• *!simular lembrete vespera* → Dispara o aviso de véspera da degustação (10h)
• *!simular lembrete vencimento* → Dispara o aviso com análise de caixa (10h)
• *!waitlist* ou *!demanda* → Exibe estatísticas de demanda da lista de espera (Pro/Super)
• *!analisador* ou *!indicar* → Painel do Analisador Oficial, saldo no Pix e meta de gratuidade Solo
• *!pix [chave]* → Cadastra ou consulta a chave Pix para repasse mensal de comissões
• *!qa add <cpf/cnpj/tel> [desc]* → Libera CPF/CNPJ/Tel para atuar livremente no app como QA
• *!qa remove <cpf/cnpj/tel>* → Revoga privilégios de QA do identificador
• *!qa list* → Lista todos os identificadores em modo QA
• *!feedbacks* → Consulta os últimos feedbacks e sugestões recebidos dos clientes
• *!raio-x* → Dispara a geração e envio imediato do **Raio-X de Fornecedores em PDF**
• *!pdf* ou *!relatorio* → Emite e envia o **Livro Caixa oficial em PDF**
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
    const dividendStatus = await getMonthlyDividendTracking(clientId);

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
• Lançamentos: ${cycle?.docs_processed_count || 0} / ${plan?.doc_limit || 0} (Estourou: ${cycle?.hit_doc_limit ? 'Sim' : 'Não'})
• Interações Bot: ${cycle?.bot_interactions_count || 0} / ${plan?.bot_interaction_limit || 0}
• Análises de Caixa: ${cycle?.cash_flow_analyses_count || 0} / ${plan?.cash_flow_analysis_limit || 0} (Estourou: ${cycle?.hit_analysis_limit ? 'Sim' : 'Não'})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dividendStatus.summaryMessage}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    };
  }

  // ── !reset / !apagar / !limpar ──────────────────────────────────────────────
  if (action === 'reset' || action === 'limpar' || action === 'zerar' || action === 'apagar') {
    // 1. Zera limites e contadores de uso mensal
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

    // 2. Limpa contas a pagar/receber de testes do usuário
    await supabase
      .from('payables_receivables')
      .delete()
      .eq('client_id', clientId);

    // 2.1 Limpa dados de degustação (trial) se houver
    if (client.whatsapp_number) {
      await supabase
        .from('trial_leads')
        .delete()
        .eq('whatsapp_number', client.whatsapp_number);
    }

    // 3. Limpa lançamentos do livro caixa de testes
    await supabase
      .from('cash_ledger_entries')
      .delete()
      .eq('client_id', clientId);

    // 4. Limpa confirmações pendentes
    await supabase
      .from('bot_action_confirmations')
      .update({ status: 'rejected' })
      .eq('client_id', clientId)
      .eq('status', 'pending');

    return {
      handled: true,
      message: `🔄 *Reset Completo Realizado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *Contadores zerados:* 0/30 documentos, 0 análises
🗑️ *Contas e Livro Caixa limpos:* Todas as contas a pagar, receber e lançamentos anteriores foram removidos.
🧹 *Confirmações pendentes limpas:* Nenhuma ação anterior está aguardando.

Seu perfil está 100% limpo, exatamente como o de um cliente que acabou de se cadastrar!
💡 Para recriar o cenário de testes com 5 contas demonstrativas a qualquer momento, digite: *!gerar contas*`,
    };
  }

  // ── !simular [start|solo|plus|lembrete|termometro] ──────────────────────────
  if (action === 'simular') {
    if (arg1 === 'lembrete') {
      const subType = parts[2] || 'vencimento';
      const mockLead = {
        supplier_name: 'Distribuidora de Embalagens Vale',
        amount: 1450.00,
        barcode_or_pix: '34191090080000123456789012345678901234567890',
      };

      if (subType === 'grupo' || subType === 'agrupado') {
        const mockGroup = [
          { supplier_name: 'CPFL Energia', amount: 99.00, barcode_or_pix: '83600000001099000138' },
          { supplier_name: 'Sabesp Saneamento', amount: 80.00, barcode_or_pix: '83650000000800000142' },
        ];
        return {
          handled: true,
          message: getDueReminderMessage(mockGroup),
        };
      } else if (subType === 'vespera' || subType === 'véspera') {
        return {
          handled: true,
          message: getEveReminderMessage(mockLead),
        };
      } else {
        return {
          handled: true,
          message: getDueReminderMessage(mockLead),
        };
      }
    }

    if (arg1 === 'termometro' || arg1 === 'tributos' || arg1 === 'mei') {
      const tracking = await getTaxRevenueTracking({ clientId });
      return {
        handled: true,
        message: tracking.statusMessage,
      };
    }

    let targetCode: PlanCode = 'solo_plus';
    if (arg1 === 'start') targetCode = 'start';
    else if (arg1 === 'solo') targetCode = 'solo';
    else if (arg1 === 'plus' || arg1 === 'solo_plus') targetCode = 'solo_plus';
    else if (arg1 === 'pro') targetCode = 'pro';
    else if (arg1 === 'super') targetCode = 'super';
    else {
      return {
        handled: true,
        message:
          'Informe a simulação desejada:\n• `!simular start` (15 lançamentos)\n• `!simular solo` (30 lançamentos)\n• `!simular plus` (60 lançamentos)\n• `!simular pro` (500 lançamentos)\n• `!simular super` (1.000 lançamentos)\n• `!simular lembrete grupo` (CPFL + Sabesp unificadas)\n• `!simular lembrete vespera`\n• `!simular lembrete vencimento`\n• `!simular termometro` (Régua Fiscal MEI/Simples)',
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

      let detailMsg = '';
      if (targetCode === 'start') {
        detailMsg = `• 📑 *Lançamentos:* Até 15 lançamentos por mês (por foto, PDF ou texto)
• 💬 *WhatsApp:* Registro contábil e lembretes diários
• 🎙️ *Comandos por Voz:* Indisponíveis (gera convite de upgrade para o Solo)
• 💡 *Consultor de Caixa:* Indisponível (oferece análise avulsa por R$ 14,90 ou upgrade para o Solo)`;
      } else if (targetCode === 'solo') {
        detailMsg = `• 📑 *Lançamentos:* Até 30 lançamentos por mês
• 🎙️ *Comandos por Voz:* 100% Liberados (altere vencimentos e envie áudios)
• 💡 *Consultor de Caixa:* 2 análises estratégicas inclusas por mês
• 📊 *Livro Caixa & DRE:* Automatizados
• 🏦 *Conciliação Bancária:* Mensal (1 conta inclusa)

💡 *Próximos testes recomendados:*
1. Envie foto/PDF de boleto ou texto *"Pagar fornecedor 350 dia 25"*.
2. Pergunte *"estou sem dinheiro, qual conta devo atrasar?"*`;
      } else if (targetCode === 'solo_plus') {
        detailMsg = `• 📑 *Lançamentos:* Até 60 lançamentos por mês (o dobro do Solo)
• 💬 *Interações de Bot:* Até 100 por mês
• 💡 *Consultor de Caixa:* 4 análises estratégicas inclusas por mês
• 🎙️ *Voz & IA:* Ilimitados com suporte prioritário
• 🏦 *Conciliação Bancária:* Mensal (1 conta inclusa)`;
      } else if (targetCode === 'pro') {
        detailMsg = `• 📑 *Lançamentos:* Até 500 lançamentos por mês
• 🏢 *Multi-CNPJ:* Gestão integrada de até 2 empresas/CNPJs
• 🏦 *Conciliação Bancária:* Semanal (até 2 contas bancárias)
• 💡 *Consultoria & DRE:* Painel consolidado e relatórios executivos`;
      } else if (targetCode === 'super') {
        detailMsg = `• 📑 *Lançamentos:* Até 1.000 lançamentos por mês
• 🏢 *Multi-CNPJ:* Gestão corporativa de até 4 empresas/CNPJs
• 🏦 *Conciliação Bancária:* Semanal contínua (até 4 contas bancárias)
• 🚀 *Potência Máxima:* Análises e consultor de caixa ilimitados`;
      }

      return {
        handled: true,
        message: `🎭 *Simulação Ativada:* Seu perfil agora está operando sob as regras do plano *${plan.name}*.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${detailMsg}`,
      };
    }
  }

  // ── !estourar [lancamento|doc|analise|bot] ─────────────────────────────────────────────
  if (action === 'estourar') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plans(*)')
      .eq('client_id', clientId)
      .single();

    const plan = sub?.plans as any;

    if (arg1 === 'doc' || arg1 === 'lancamento' || arg1 === 'lancamentos') {
      await supabase
        .from('usage_cycles')
        .update({
          docs_processed_count: plan?.doc_limit || 30,
          hit_doc_limit: true,
        })
        .eq('client_id', clientId);

      return {
        handled: true,
        message: `💥 *Cota de Lançamentos Estourada!* Agora, envie uma mensagem de texto (ex: *"Pagar fornecedor 250 dia 25"*), áudio ou foto de boleto para testar a resposta de bloqueio com link do Pacote Extra (+20 Lançamentos por R$ 14,90) e sugestão de upgrade.`,
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
        message: `💥 *Cota de Análises de Caixa Estourada!* Agora, envie uma mensagem ou áudio perguntando *"qual conta devo adiar?"* para testar a oferta de R$ 14,90 do Asaas.`,
      };
    }
  }

  // ── !gerar contas teste ─────────────────────────────────────────────────────
  if (action === 'gerar' && (arg1 === 'contas' || arg1 === 'teste')) {
    const today = new Date();
    const contasFicticias = [
      {
        client_id: clientId,
        counterparty_name: 'Gráfica & Rótulos Express',
        type: 'payable',
        amount: 820.0,
        original_due_date: addDays(today, -4).toISOString().split('T')[0],
        current_due_date: addDays(today, -4).toISOString().split('T')[0],
        status: 'open',
        criticality_score: 3,
        barcode_or_pix: '23793381286000008200012345678901234567',
        notes: 'Vencida há 4 dias — Juros e multa de mora acumulando',
      },
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

    // Limpa contas anteriores do cliente para não duplicar
    await supabase.from('payables_receivables').delete().eq('client_id', clientId);
    await supabase.from('payables_receivables').insert(contasFicticias);

    return {
      handled: true,
      message: `🧾 *5 Contas a Pagar Fictícias Criadas (Incluindo 1 Atrasada)!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. ⚠️ *Gráfica & Rótulos* (R$ 820,00)
   📅 Vencimento: ${formatDueDateDetails(contasFicticias[0].current_due_date)} (*VENCIDA há 4 dias*)
1. *Copel* (R$ 348,50) 
   📅 Vencimento: ${formatDueDateDetails(contasFicticias[1].current_due_date)} (Luz - Não adiar)
2. *Vivo Fibra* (R$ 129,90) 
   📅 Vencimento: ${formatDueDateDetails(contasFicticias[2].current_due_date)} (Internet - Não adiar)
3. *Fornecedor Embalagens* (R$ 1.850,00) 
   📅 Vencimento: ${formatDueDateDetails(contasFicticias[3].current_due_date)} (Flexível - Recomendado adiar)
4. *Aluguel Comercial* (R$ 2.500,00) 
   📅 Vencimento: ${formatDueDateDetails(contasFicticias[4].current_due_date)} (Multa 10%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Experimente agora:
• Digite *!pdf* ou *"me manda o relatório em PDF"*
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

  // ── !pdf / !relatorio ───────────────────────────────────────────────────────
  if (action === 'pdf' || action === 'relatorio' || action === 'relatório') {
    const { data: client } = await supabase.from('clients').select('whatsapp_number').eq('id', clientId).single();
    if (client?.whatsapp_number) {
      const { sendCashLedgerPdfToWhatsApp } = await import('@/lib/solo/cash-ledger-pdf');
      sendCashLedgerPdfToWhatsApp(clientId, client.whatsapp_number).catch((err) => {
        console.error('[Admin PDF Generation Error]:', err);
      });
    }

    return {
      handled: true,
      message: `📄 *Gerando seu Relatório Oficial de Livro Caixa em PDF...*
O arquivo completo com suas contas agendadas, contas vencidas e parecer de caixa será enviado aqui em anexo em instantes!`,
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

  // ── !waitlist / !demanda ───────────────────────────────────────────────────
  if (action === 'waitlist' || action === 'demanda') {
    const report = await getWaitlistAdminReport();
    return {
      handled: true,
      message: report,
    };
  }

  // ── !analisador / !indicar / !comissao / !pix ────────────────────────────────
  if (
    action === 'analisador' ||
    action === 'analisar' ||
    action === 'indicar' ||
    action === 'indicacao' ||
    action === 'indicação' ||
    action === 'comissao' ||
    action === 'comissão' ||
    action === 'parceiro'
  ) {
    const shareMsg = await getReferralShareMessage(clientId, client.name);
    return {
      handled: true,
      message: shareMsg,
    };
  }

  if (action === 'confirmarpix') {
    const rawCode = commandText.replace(/^[!/](confirmarpix)\s*/i, '').trim();
    const result = await confirmarAlteracaoPix(clientId, rawCode);
    return {
      handled: true,
      message: result.message,
    };
  }

  if (action === 'cancelarpix') {
    const cancelMsg = await cancelarAlteracaoPix(clientId);
    return {
      handled: true,
      message: cancelMsg,
    };
  }

  if (action === 'pix') {
    const rawPix = commandText.replace(/^[!/](pix)\s*/i, '').trim();
    if (!rawPix) {
      const status = await getReferralStatus(clientId);
      if (status.pixKey) {
        return {
          handled: true,
          message: `🔑 *Sua Chave Pix para Repasses de Analisador:*
👉 \`${status.pixKey}\` ${status.isDocumentPixKey ? '🛡️ *(CNPJ/CPF Oficial do Titular)*' : '✅'}

🛡️ *Segurança Ativa (Abordagem 2):*
Qualquer alteração para chaves alternativas requer validação obrigatória por código de segurança (2FA) enviado ao seu e-mail cadastrado.

Para alterar sua chave Pix, envie:
👉 *!pix nova_chave*`,
        };
      } else {
        return {
          handled: true,
          message: `⚠️ *Nenhuma Chave Pix Cadastrada!*

Para receber suas comissões mensais como Analisador direto no Pix, cadastre sua chave agora enviando:
👉 *!pix sua_chave*
_(Ex: !pix 12.345.678/0001-90 ou !pix financeiro@empresa.com)_`,
        };
      }
    }

    const result = await solicitarAlteracaoPix(clientId, rawPix);
    return {
      handled: true,
      message: result.message,
    };
  }

  // ── !dividendos / !lucros ───────────────────────────────────────────────────
  if (action === 'dividendos' || action === 'lucros' || action === 'dividendo' || action === 'prolabore' || action === 'pró-labore') {
    const tracking = await getMonthlyDividendTracking(clientId);
    return {
      handled: true,
      message: tracking.summaryMessage,
    };
  }

  // ── !qa add / remove / list ───────────────────────────────────────────────
  if (action === 'qa') {
    const subAction = arg1;

    if (subAction === 'add') {
      const rawAfter = commandText.replace(/^[!/](qa)\s+add\s+/i, '').trim();
      let rawTarget = '';
      let description = '';

      // Tenta separar telefone/identificador com pontuações do nome
      const match = rawAfter.match(/^([+0-9()\s.\/-]+?)(?:\s+([a-zA-ZÀ-ÿ].*))?$/);
      if (match) {
        rawTarget = match[1].trim();
        description = match[2] ? match[2].trim() : '';
      } else {
        const p = rawAfter.split(/\s+/);
        rawTarget = p[0] || '';
        description = p.slice(1).join(' ');
      }

      if (rawTarget) {
        const { addQaWhitelist } = await import('@/lib/solo/qa-whitelist');
        const res = await addQaWhitelist(rawTarget, description || 'QA Liberado pelo Admin', client.name);
        return { handled: true, message: res.message };
      }
    } else if (subAction === 'remove') {
      const rawTarget = commandText.replace(/^[!/](qa)\s+remove\s+/i, '').trim();
      if (rawTarget) {
        const { removeQaWhitelist } = await import('@/lib/solo/qa-whitelist');
        const res = await removeQaWhitelist(rawTarget);
        return { handled: true, message: res.message };
      }
    } else if (subAction === 'list' || !subAction) {
      const { listQaWhitelist } = await import('@/lib/solo/qa-whitelist');
      const txt = await listQaWhitelist();
      return { handled: true, message: txt };
    }

    return {
      handled: true,
      message: `🧪 *Uso dos Comandos de QA:*\n• \`!qa add <telefone/cpf> [descrição]\`\n  ↳ _Exemplos aceitos:_\n    • \`!qa add 13978122222 João Amigo\`\n    • \`!qa add (13) 97812-2222 João Amigo\`\n    • \`!qa add +55 13 97812-2222 João Amigo\`\n• \`!qa remove <telefone/cpf>\`\n• \`!qa list\``,
    };
  }

  // ── !feedbacks / !feedback ──────────────────────────────────────────────────
  if (action === 'feedbacks' || action === 'feedback') {
    const { data: feedbacks } = await supabase
      .from('client_feedbacks')
      .select('id, whatsapp_number, client_name, feedback_type, message, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!feedbacks || feedbacks.length === 0) {
      return { handled: true, message: '📭 Nenhum feedback registrado até o momento.' };
    }

    let txt = `📬 *Últimos Feedbacks e Sugestões (${feedbacks.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const fb of feedbacks) {
      txt += `• *${fb.feedback_type.toUpperCase()}* (${fb.client_name || fb.whatsapp_number}):\n"${fb.message}"\n\n`;
    }
    return { handled: true, message: txt };
  }

  // ── !fix <id> (Aprovação de Correção pela IA Autônoma) ───────────────────────
  if (action === 'fix') {
    const taskIdNum = parseInt(arg1, 10);
    if (!arg1 || isNaN(taskIdNum)) {
      return {
        handled: true,
        message: '⚠️ Informe o número da tarefa a ser corrigida pela IA.\nExemplo: `!fix 1` ou `!fix 15`\nConsulte os IDs ativos digitando `!fila`.',
      };
    }

    const { data: task } = await supabase
      .from('ai_agent_tasks')
      .select('id, title, description, task_type, status, creator_name')
      .eq('id', taskIdNum)
      .maybeSingle();

    if (!task) {
      return {
        handled: true,
        message: `❌ Tarefa #${taskIdNum} não encontrada na fila da IA. Digite \`!fila\` para listar as tarefas disponíveis.`,
      };
    }

    await supabase
      .from('ai_agent_tasks')
      .update({
        status: 'approved_by_marcos',
        approved_at: new Date().toISOString(),
      })
      .eq('id', taskIdNum);

    return {
      handled: true,
      message: `🤖 *Tarefa #${taskIdNum} Aprovada para a IA!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Título:* ${task.title}
👤 *Origem:* ${task.creator_name || 'Usuário'}
📝 *Descrição:* "${task.description}"
⚡ *Status:* Aprovado por Marcos (Fila de Execução)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A IA no seu computador foi acionada. Ela irá:
1️⃣ Diagnosticar o código fonte
2️⃣ Aplicar a correção e rodar os testes
3️⃣ Realizar o deploy na Vercel
Você receberá uma mensagem aqui assim que o código estiver no ar!`,
    };
  }

  // ── !bug / !erro / !problema / !defeito (Reporte Direto de Falhas via WhatsApp) ─
  if (action === 'bug' || action === 'erro' || action === 'problema' || action === 'defeito') {
    const bugText = commandText.replace(/^[!/](bug|erro|problema|defeito)\s*/i, '').trim();
    if (!bugText) {
      return {
        handled: true,
        message: `⚠️ *Como relatar um problema pelo WhatsApp:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Basta digitar \`!bug\` ou \`!erro\` seguido do que você presenciou no teste.

📝 *Exemplo:*
\`!bug Enviei um áudio de conta da CPFL, ele só transcreveu e não fez o lançamento nem respondeu\``,
      };
    }

    const shortTitle = bugText.length > 50 ? bugText.slice(0, 50) + '...' : bugText;

    const { data: newTask, error: insertError } = await supabase
      .from('ai_agent_tasks')
      .insert({
        task_type: 'bug',
        title: `🚨 [Bug QA] ${shortTitle}`,
        description: bugText,
        source: 'whatsapp_admin_qa',
        creator_phone: client.whatsapp_number,
        creator_name: client.name || 'Marcos Fundador',
        status: 'approved_by_marcos',
        approved_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Admin Bug] Erro ao salvar bug na fila da IA:', insertError);
      return { handled: true, message: '❌ Ocorreu um erro ao registrar o bug no banco de dados.' };
    }

    return {
      handled: true,
      message: `🚨 *Bug Reportado com Sucesso! (#${newTask?.id})*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 *Relato:* "${bugText}"
⚡ *Status:* Enviado com prioridade máxima para a IA!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍻 *Pode continuar aproveitando sua cerveja gelada!*
A IA no seu computador já recebeu essa notificação, vai analisar o código fonte, aplicar a correção e rodar os testes. Assim que a correção estiver no ar na Vercel, te aviso aqui no WhatsApp!`,
    };
  }

  // ── !ideia / !tarefa / !feature (Criação Remota de Projetos via WhatsApp) ───
  if (action === 'ideia' || action === 'tarefa' || action === 'feature') {
    const ideaText = commandText.replace(/^[!/](ideia|tarefa|feature)\s*/i, '').trim();
    if (!ideaText) {
      return {
        handled: true,
        message: '💡 Digite sua ideia ou nova funcionalidade após o comando.\nExemplo: `!ideia Criar botão de exportar relatório em Excel`',
      };
    }

    const shortTitle = ideaText.length > 50 ? ideaText.slice(0, 50) + '...' : ideaText;

    const { data: newTask, error: insertError } = await supabase
      .from('ai_agent_tasks')
      .insert({
        task_type: 'idea',
        title: `💡 [Nova Ideia] ${shortTitle}`,
        description: ideaText,
        source: 'whatsapp_admin',
        creator_phone: client.whatsapp_number,
        creator_name: client.name || 'Marcos Fundador',
        status: 'approved_by_marcos',
        approved_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Admin Idea] Erro ao salvar ideia:', insertError);
      return { handled: true, message: '❌ Ocorreu um erro ao registrar sua ideia no banco de dados.' };
    }

    return {
      handled: true,
      message: `💡 *Nova Ideia Registrada com Sucesso! (#${newTask?.id})*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 *Ideia:* "${ideaText}"
⚡ *Status:* Aprovada e Agendada na Fila da IA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mesmo longe do computador, sua ideia já está no backlog do projeto! A IA no Antigravity analisará a viabilidade e preparará a estrutura de implementação.`,
    };
  }

  // ── !projeto <nome> <ideia> (Criação Autônoma de Novo Projeto: GitHub + Vercel + DB) ──
  if (action === 'projeto' || action === 'novoprojeto' || action === 'novo-projeto') {
    const cleanInput = commandText.replace(/^[!/](projeto|novoprojeto|novo-projeto)\s*/i, '').trim();
    if (!cleanInput) {
      return {
        handled: true,
        message: `🏗️ *Como criar um projeto novo pelo WhatsApp:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digite \`!projeto <NomeDoProjeto> <descrição da ideia>\`

📝 *Exemplo:*
\`!projeto BarbeariaApp Plataforma de agendamentos e pagamentos para barbearias\``,
      };
    }

    const firstSpace = cleanInput.indexOf(' ');
    const rawName = firstSpace > -1 ? cleanInput.slice(0, firstSpace) : cleanInput;
    const projectIdea = firstSpace > -1 ? cleanInput.slice(firstSpace + 1).trim() : 'Novo projeto concebido via WhatsApp';

    const { data: newTask, error: insertError } = await supabase
      .from('ai_agent_tasks')
      .insert({
        task_type: 'create_project',
        title: `🚀 [Novo Projeto] ${rawName}`,
        description: projectIdea,
        source: 'whatsapp_admin',
        creator_phone: client.whatsapp_number,
        creator_name: client.name || 'Marcos Fundador',
        status: 'approved_by_marcos',
        approved_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Admin Project] Erro ao registrar projeto:', insertError);
      return { handled: true, message: '❌ Ocorreu um erro ao agendar a criação do projeto.' };
    }

    return {
      handled: true,
      message: `🏗️ *Criação de Projeto Iniciada! (#${newTask?.id})*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *Nome:* ${rawName}
📝 *Ideia:* "${projectIdea}"
⚡ *Status:* Provisionando GitHub, Vercel e Supabase...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍺 *Pode dar mais um gole na gelada!*
Em menos de 1 minuto o robô te envia o link oficial da Vercel no ar aqui nesta conversa!`,
    };
  }

  // ── !fila / !tarefas (Visualizar Fila da IA) ────────────────────────────────
  if (action === 'fila' || action === 'tarefas') {
    const { data: tasks } = await supabase
      .from('ai_agent_tasks')
      .select('id, title, task_type, status, created_at')
      .order('id', { ascending: false })
      .limit(6);

    if (!tasks || tasks.length === 0) {
      return { handled: true, message: '📭 Fila da IA vazia! Nenhuma tarefa registrada no momento.' };
    }

    const statusEmoji: Record<string, string> = {
      pending_review: '⏳ Aguardando Aprovação',
      approved_by_marcos: '🚀 Aprovado (Fila de Execução)',
      in_progress: '⚙️ Em Execução pela IA',
      completed: '✅ Concluído & No Ar',
      failed: '❌ Falha / Requer Ajuste',
    };

    let msg = `🤖 *Fila de Tarefas da IA (${tasks.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const t of tasks) {
      const st = statusEmoji[t.status] || t.status;
      msg += `• *#${t.id}* [${t.task_type.toUpperCase()}]: ${t.title}\n  ↳ Status: ${st}\n`;
      if (t.status === 'pending_review') {
        msg += `  👉 Para aprovar: \`!fix ${t.id}\`\n`;
      }
    }
    return { handled: true, message: msg };
  }

  // ── !desbloquear <tel> (Desbloqueio Soberano de Anti-Looping pelo Admin) ─────
  if (action === 'desbloquear' || action === 'unblock') {
    const targetPhone = arg1;
    if (!targetPhone) {
      return {
        handled: true,
        message: '⚠️ Informe o telefone para desbloquear.\nExemplo: `!desbloquear 11999998888`\nConsulte números suspensos com `!bloqueios`.',
      };
    }
    const { unblockNumberByAdmin } = await import('@/lib/solo/anti-loop');
    const res = await unblockNumberByAdmin(targetPhone);
    return { handled: true, message: res.message };
  }

  // ── !bloqueios (Relatório de Números Suspensos) ──────────────────────────────
  if (action === 'bloqueios' || action === 'bloqueio') {
    const { listActiveBotBlocks } = await import('@/lib/solo/anti-loop');
    const report = await listActiveBotBlocks();
    return { handled: true, message: report };
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
