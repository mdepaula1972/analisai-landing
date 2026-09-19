import { createServiceRoleClient } from '@/lib/supabase-server';

export interface TeamMemberRecord {
  id: string;
  client_id: string;
  whatsapp_number: string;
  member_name: string;
  role: 'operator' | 'admin';
  is_active: boolean;
  created_at: string;
  notify_owner_on_action?: boolean;
  activated_at?: string | null;
}

export interface ResolvedUserContext {
  client: any;
  isTeamMember: boolean;
  isOperator: boolean;
  memberName?: string;
  teamMember?: TeamMemberRecord;
}

/**
 * Resolve se o número de WhatsApp pertence diretamente a um cliente Dono
 * ou a um Membro de Equipe (Operador) vinculado à empresa.
 */
export async function resolveUserAndClient(cleanPhone: string): Promise<ResolvedUserContext | null> {
  const supabase = createServiceRoleClient();

  let altPhone = cleanPhone;
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
  } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    altPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
  }

  // 1. Busca se é o cliente titular (Dono)
  const { data: directClient } = await supabase
    .from('clients')
    .select('*')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .maybeSingle();

  if (directClient) {
    return {
      client: directClient,
      isTeamMember: false,
      isOperator: false,
      memberName: directClient.name,
    };
  }

  // 2. Busca se é um membro de equipe (Operador)
  const { data: teamMember } = await supabase
    .from('client_team_members')
    .select('*, client:clients(*)')
    .or(`whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${altPhone}`)
    .eq('is_active', true)
    .maybeSingle();

  if (teamMember && teamMember.client) {
    return {
      client: teamMember.client,
      isTeamMember: true,
      isOperator: teamMember.role === 'operator',
      memberName: teamMember.member_name,
      teamMember: teamMember as TeamMemberRecord,
    };
  }

  return null;
}

/**
 * Marca a data e hora em que a operadora ativou formalmente seu acesso enviando mensagem
 */
export async function markTeamMemberActivated(memberId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from('client_team_members')
    .update({ activated_at: new Date().toISOString() })
    .eq('id', memberId);
}

/**
 * Liga ou desliga as notificações em tempo real para o Dono sobre as ações de um operador
 */
export async function toggleTeamMemberNotification(
  clientId: string,
  targetNameOrPhone: string,
  notify: boolean
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const cleanDigits = targetNameOrPhone.replace(/\D/g, '');

  let query = supabase
    .from('client_team_members')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true);

  if (cleanDigits.length >= 8) {
    query = query.ilike('whatsapp_number', `%${cleanDigits.slice(-8)}%`);
  } else {
    query = query.ilike('member_name', `%${targetNameOrPhone.trim()}%`);
  }

  const { data: member } = await query.maybeSingle();
  if (!member) {
    return {
      success: false,
      message: `Não localizei nenhum membro de equipe ativo com o identificador "${targetNameOrPhone}".`,
    };
  }

  await supabase
    .from('client_team_members')
    .update({ notify_owner_on_action: notify })
    .eq('id', member.id);

  if (notify) {
    return {
      success: true,
      message: `🔔 *Modo Onisciência Ativado para ${member.member_name}!*\nVocê receberá uma notificação em tempo real a cada nota, boleto ou despesa que ela lançar.`,
    };
  } else {
    return {
      success: true,
      message: `🔕 *Notificações Silenciadas para ${member.member_name}!*\nVocê não receberá avisos a cada lançamento individual dela. As despesas continuarão sendo registradas normalmente no seu Livro Caixa e DRE.`,
    };
  }
}

/**
 * Adiciona um novo membro à equipe da empresa com Modo Onisciência ativado por padrão
 */
export async function addTeamMember(
  clientId: string,
  rawPhone: string,
  memberName: string,
  role: 'operator' | 'admin' = 'operator',
  notifyOwner: boolean = true
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = rawPhone.replace(/\D/g, '');

  if (cleanPhone.length < 10) {
    return { success: false, message: 'Número de telefone inválido. Informe DDD + Número (ex: 14999998888).' };
  }

  // Verifica se o telefone já está vinculado a outro cliente
  const existing = await resolveUserAndClient(cleanPhone);
  if (existing) {
    return { success: false, message: `O telefone informado já está cadastrado no sistema (vinculado a ${existing.client.company_name || existing.client.name}).` };
  }

  const { error } = await supabase.from('client_team_members').insert({
    client_id: clientId,
    whatsapp_number: cleanPhone,
    member_name: memberName.trim(),
    role,
    is_active: true,
    notify_owner_on_action: notifyOwner,
  });

  if (error) {
    console.error('[AddTeamMember Error]:', error);
    return { success: false, message: 'Erro ao cadastrar membro de equipe no banco de dados.' };
  }

  return {
    success: true,
    message: `✅ *${memberName.trim()}* cadastrada com sucesso como Operadora da sua empresa!

🔔 *Modo Onisciência Ativo:* Você receberá uma notificação em tempo real no seu WhatsApp a cada nota ou despesa que ela lançar (para desligar, basta dizer: _'silenciar avisos da ${memberName.trim()}'_).

👉 *Para ativar:* Peça para ${memberName.trim()} salvar nosso contato e nos enviar um simples *"Oi"* aqui no WhatsApp.`,
  };
}

/**
 * Lista todos os membros de equipe vinculados à empresa
 */
export async function listTeamMembers(clientId: string): Promise<TeamMemberRecord[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('client_team_members')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  return data || [];
}

/**
 * Remove / Desvincula um membro da equipe
 */
export async function removeTeamMember(
  clientId: string,
  rawPhone: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = rawPhone.replace(/\D/g, '');

  const { data: member } = await supabase
    .from('client_team_members')
    .select('*')
    .eq('client_id', clientId)
    .ilike('whatsapp_number', `%${cleanPhone.slice(-8)}%`)
    .maybeSingle();

  if (!member) {
    return { success: false, message: `Não localizei nenhum membro de equipe com o telefone final ${cleanPhone.slice(-4)}.` };
  }

  await supabase
    .from('client_team_members')
    .delete()
    .eq('id', member.id);

  return { success: true, message: `Membro da equipe *${member.member_name}* removido com sucesso!` };
}

/**
 * Interpreta comandos de equipe em linguagem natural falada ou escrita:
 */
export async function handleNaturalLanguageTeamCommand(
  clientId: string,
  rawText: string
): Promise<{ handled: boolean; message?: string }> {
  const lower = rawText.toLowerCase().trim();

  // 1. Consulta / Listagem de Equipe em Linguagem Natural
  if (
    lower.includes('quem está na minha equipe') ||
    lower.includes('quem esta na minha equipe') ||
    lower.includes('mostrar equipe') ||
    lower.includes('ver equipe') ||
    lower.includes('minha equipe') ||
    lower.includes('quais operadores') ||
    lower.includes('membros da equipe') ||
    lower === 'equipe'
  ) {
    const members = await listTeamMembers(clientId);
    if (members.length === 0) {
      return {
        handled: true,
        message: `👥 *Sua Equipe:*\nVocê ainda não possui operadores adicionais cadastrados.\n\nPara adicionar alguém da sua equipe, basta me dizer ou digitar:\n👉 *"Adiciona a Maria 14 99999-8888 na equipe"*\n\n💡 Cada operador adicional tem uma taxa de apenas R$ 29,90/mês no link:\nhttps://www.asaas.com/c/kurk0fge7wqim8lv`,
      };
    }

    const listStr = members.map((m, i) => {
      const statusAtiv = m.activated_at ? '✅ Ativa' : '⏳ Aguardando 1º Oi';
      const onisc = m.notify_owner_on_action !== false ? '🔔 Avisos Ativos' : '🔕 Silenciada';
      return `${i + 1}. *${m.member_name}* (${m.whatsapp_number}) — ${statusAtiv} | ${onisc}`;
    }).join('\n');

    return {
      handled: true,
      message: `👥 *Membros da Sua Equipe Autorizados:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${listStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 *Comandos rápidos:*\n• *"Adiciona o João [Telefone]"*\n• *"Silenciar avisos da Maria"*\n• *"Trocar número da Maria para [Novo Telefone]"*\n• *"Remover o João da equipe"*`,
    };
  }

  // 2. Ligar / Desligar Modo Onisciência (Notificação de Ações)
  if (
    lower.includes('silenciar aviso') ||
    lower.includes('silenciar avisos') ||
    lower.includes('desativar aviso') ||
    lower.includes('desativar avisos') ||
    lower.includes('desativar notifica') ||
    lower.includes('não me notificar') ||
    lower.includes('nao me notificar') ||
    lower.includes('parar de notificar')
  ) {
    const nameMatch = rawText.match(/(?:d[ao]|membro|operador[a]?)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
    const targetName = nameMatch ? nameMatch[1].trim() : '';
    if (targetName) {
      const res = await toggleTeamMemberNotification(clientId, targetName, false);
      return { handled: true, message: res.message };
    }
  }

  if (
    lower.includes('ativar aviso') ||
    lower.includes('ativar avisos') ||
    lower.includes('ativar notifica') ||
    lower.includes('quero receber aviso') ||
    lower.includes('me notificar sobre') ||
    lower.includes('modo onisciencia') ||
    lower.includes('modo onisciência')
  ) {
    const nameMatch = rawText.match(/(?:d[ao]|membro|operador[a]?)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
    const targetName = nameMatch ? nameMatch[1].trim() : '';
    if (targetName) {
      const res = await toggleTeamMemberNotification(clientId, targetName, true);
      return { handled: true, message: res.message };
    }
  }

  // 3. Correção / Edição de Número em Linguagem Natural
  if (
    lower.includes('errei o número') ||
    lower.includes('errei o numero') ||
    lower.includes('mudar telefone') ||
    lower.includes('mudar o telefone') ||
    lower.includes('mudar o número') ||
    lower.includes('mudar o numero') ||
    lower.includes('alterar telefone') ||
    lower.includes('corrigir telefone') ||
    lower.includes('trocar número') ||
    lower.includes('trocar o número')
  ) {
    const phoneMatches = rawText.match(/(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g);
    const cleanDigits = phoneMatches ? phoneMatches[phoneMatches.length - 1].replace(/\D/g, '') : '';
    const nameMatch = rawText.match(/(?:d[ao]|membro|operador[a]?)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
    const memberName = nameMatch ? nameMatch[1].trim() : '';

    if (cleanDigits && cleanDigits.length >= 10 && memberName) {
      const supabase = createServiceRoleClient();
      const { data: member } = await supabase
        .from('client_team_members')
        .select('*')
        .eq('client_id', clientId)
        .ilike('member_name', `%${memberName}%`)
        .maybeSingle();

      if (member) {
        const fullPhone = cleanDigits.length <= 11 && !cleanDigits.startsWith('55') ? `55${cleanDigits}` : cleanDigits;
        await supabase
          .from('client_team_members')
          .update({ whatsapp_number: fullPhone })
          .eq('id', member.id);

        return {
          handled: true,
          message: `✅ *Telefone Corrigido com Sucesso!*\nAtualizei o WhatsApp da *${member.member_name}* para *${fullPhone}*.\n\nPeça para ela salvar nosso contato e nos enviar um *"Oi"* para começar!`,
        };
      }
    }
  }

  // 4. Remoção / Exclusão de Membro em Linguagem Natural
  if (
    lower.includes('remover') ||
    lower.includes('tirar') ||
    lower.includes('excluir') ||
    lower.includes('apagar') ||
    lower.includes('deletar')
  ) {
    if (lower.includes('equipe') || lower.includes('operador') || lower.includes('secretária') || lower.includes('secretaria') || lower.includes('membro')) {
      const nameMatch = rawText.match(/(?:remover|tirar|excluir|apagar|deletar)\s+(?:a|o|operador[a]?|secret[aá]ria)?\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
      const targetName = nameMatch ? nameMatch[1].trim() : '';

      if (targetName && targetName.length >= 2 && !['conta', 'boleto', 'lançamento', 'lancamento'].includes(targetName.toLowerCase())) {
        const supabase = createServiceRoleClient();
        const { data: member } = await supabase
          .from('client_team_members')
          .select('*')
          .eq('client_id', clientId)
          .ilike('member_name', `%${targetName}%`)
          .maybeSingle();

        if (member) {
          await supabase
            .from('client_team_members')
            .delete()
            .eq('id', member.id);

          return {
            handled: true,
            message: `🗑️ *Membro Removido com Sucesso!*\n*${member.member_name}* foi removido(a) da sua equipe e não poderá mais enviar despesas para a sua empresa.`,
          };
        }
      }
    }
  }

  // 5. Adicionar Membro da Equipe em Linguagem Natural
  if (
    lower.includes('adiciona') ||
    lower.includes('adicionar') ||
    lower.includes('cadastrar') ||
    lower.includes('colocar') ||
    lower.includes('incluir')
  ) {
    if (lower.includes('equipe') || lower.includes('operador') || lower.includes('secretária') || lower.includes('secretaria') || lower.includes('membro') || lower.includes('ajudante') || lower.includes('sócio') || lower.includes('socio')) {
      const phoneMatches = rawText.match(/(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g);
      const cleanPhone = phoneMatches ? phoneMatches[0].replace(/\D/g, '') : '';

      const nameMatch = rawText.match(/(?:adiciona|adicionar|cadastrar|colocar|incluir)\s+(?:a|o|operador[a]?|secret[aá]ria)?\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
      let memberName = nameMatch ? nameMatch[1].trim() : 'Operador';
      if (['na', 'no', 'equipe', 'operador', 'secretaria', 'secretária'].includes(memberName.toLowerCase())) {
        memberName = 'Operador';
      }

      if (cleanPhone && cleanPhone.length >= 10) {
        const fullPhone = cleanPhone.length <= 11 && !cleanPhone.startsWith('55') ? `55${cleanPhone}` : cleanPhone;
        const res = await addTeamMember(clientId, fullPhone, memberName);
        return { handled: true, message: res.message };
      }
    }
  }

  return { handled: false };
}
