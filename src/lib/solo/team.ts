import { createServiceRoleClient } from '@/lib/supabase-server';

export interface TeamMemberRecord {
  id: string;
  client_id: string;
  whatsapp_number: string;
  member_name: string;
  role: 'operator' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface ResolvedUserContext {
  client: any;
  isTeamMember: boolean;
  isOperator: boolean;
  memberName?: string;
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
    };
  }

  return null;
}

/**
 * Adiciona um novo membro à equipe da empresa
 */
export async function addTeamMember(
  clientId: string,
  rawPhone: string,
  memberName: string,
  role: 'operator' | 'admin' = 'operator'
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
  });

  if (error) {
    console.error('[AddTeamMember Error]:', error);
    return { success: false, message: 'Erro ao cadastrar membro de equipe no banco de dados.' };
  }

  return { success: true, message: `Membro da equipe *${memberName.trim()}* cadastrado com sucesso!` };
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

  const { error } = await supabase
    .from('client_team_members')
    .delete()
    .eq('id', member.id);

  if (error) {
    return { success: false, message: 'Erro ao remover operador da equipe.' };
  }

  return { success: true, message: `Membro *${member.member_name}* (${member.whatsapp_number}) foi removido da sua equipe.` };
}

/**
 * Atualiza / Corrige número ou nome de um membro da equipe caso digitado errado
 */
export async function updateTeamMember(
  clientId: string,
  oldPhoneRaw: string,
  newPhoneRaw: string,
  newName?: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const oldPhone = oldPhoneRaw.replace(/\D/g, '');
  const newPhone = newPhoneRaw.replace(/\D/g, '');

  const { data: member } = await supabase
    .from('client_team_members')
    .select('*')
    .eq('client_id', clientId)
    .ilike('whatsapp_number', `%${oldPhone.slice(-8)}%`)
    .maybeSingle();

  if (!member) {
    return { success: false, message: `Não localizei nenhum operador com o telefone final ${oldPhone.slice(-4)} para editar.` };
  }

  const updates: any = {};
  if (newPhone && newPhone.length >= 10) updates.whatsapp_number = newPhone;
  if (newName && newName.trim().length >= 2) updates.member_name = newName.trim();

  const { error } = await supabase
    .from('client_team_members')
    .update(updates)
    .eq('id', member.id);

  if (error) {
    return { success: false, message: 'Erro ao atualizar dados do operador.' };
  }

  return {
    success: true,
    message: `Operador atualizado com sucesso!\n• Nome: *${updates.member_name || member.member_name}*\n• Telefone: *${updates.whatsapp_number || member.whatsapp_number}*`,
  };
}

/**
 * Processa comandos de gestão de equipe em LINGUAGEM NATURAL pura (texto e voz)
 * Exemplos:
 * - "Adiciona a Maria 14 99999-8888 na equipe"
 * - "Tira o João da equipe"
 * - "Errei o número da Maria, o novo é 14 98888-7777"
 * - "Quem está na minha equipe?"
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

    const listStr = members.map((m, i) => `${i + 1}. *${m.member_name}* (${m.whatsapp_number})`).join('\n');
    return {
      handled: true,
      message: `👥 *Membros da Sua Equipe Autorizados:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${listStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 *Comandos fáceis em conversa:*\n• *"Adiciona o João [Telefone]"*\n• *"Trocar número da Maria para [Novo Telefone]"*\n• *"Remover o João da equipe"*`,
    };
  }

  // 2. Correção / Edição de Número em Linguagem Natural
  // Ex: "errei o número da Maria, o novo é 14 98888-7777" ou "mudar telefone da Maria para 14 98888 7777"
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
    // Extrai o novo número (sequência de dígitos com pelo menos 10 dígitos)
    const phoneMatches = rawText.match(/(?:\(?d{2}\)?s*)?9?d{4}[-s]?d{4}/g);
    const cleanDigits = phoneMatches ? phoneMatches[phoneMatches.length - 1].replace(/\D/g, '') : '';

    // Extrai o nome do membro (ex: "da Maria", "do João")
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

  // 3. Remoção / Exclusão de Membro em Linguagem Natural
  // Ex: "remover a Maria da equipe", "tira o João da equipe", "excluir a secretária Ana"
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

  // 4. Adicionar Membro da Equipe em Linguagem Natural
  // Ex: "Adiciona a Maria 14 99999-8888 na equipe" ou "Cadastrar operador João 14988887777"
  if (
    lower.includes('adiciona') ||
    lower.includes('adicionar') ||
    lower.includes('cadastrar') ||
    lower.includes('colocar') ||
    lower.includes('incluir')
  ) {
    if (lower.includes('equipe') || lower.includes('operador') || lower.includes('secretária') || lower.includes('secretaria') || lower.includes('membro') || lower.includes('ajudante') || lower.includes('sócio') || lower.includes('socio')) {
      // Extrai número de telefone (10 a 13 dígitos)
      const phoneMatches = rawText.match(/(?:\(?d{2}\)?s*)?9?d{4}[-s]?d{4}/g);
      const cleanPhone = phoneMatches ? phoneMatches[0].replace(/\D/g, '') : '';

      // Extrai o nome da pessoa
      const nameMatch = rawText.match(/(?:adiciona|adicionar|cadastrar|colocar|incluir)\s+(?:a|o|operador[a]?|secret[aá]ria)?\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
      let memberName = nameMatch ? nameMatch[1].trim() : 'Operador';
      if (['na', 'no', 'equipe', 'operador', 'secretaria', 'secretária'].includes(memberName.toLowerCase())) {
        memberName = 'Operador';
      }

      if (cleanPhone && cleanPhone.length >= 10) {
        const fullPhone = cleanPhone.length <= 11 && !cleanPhone.startsWith('55') ? `55${cleanPhone}` : cleanPhone;
        const res = await addTeamMember(clientId, fullPhone, memberName);
        if (res.success) {
          return {
            handled: true,
            message: `✅ *Prontinho! Adicionei ${memberName} à sua equipe!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• *Nome:* ${memberName}\n• *WhatsApp:* ${fullPhone}\n• *Permissão:* Enviar fotos de boletos, notas e despesas avulsas\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👉 *Passo seguinte:* Peça para ${memberName} salvar este contato e mandar um simples *"Oi"* aqui no WhatsApp. O robô a reconhecerá automaticamente!\n\n💡 _Taxa do operador adicional (+R$ 29,90/mês):_\nhttps://www.asaas.com/c/kurk0fge7wqim8lv`,
          };
        } else {
          return { handled: true, message: res.message };
        }
      }
    }
  }

  return { handled: false };
}
