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
