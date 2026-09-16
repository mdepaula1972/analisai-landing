import { createServiceRoleClient } from '@/lib/supabase-server';

/**
 * Consulta se determinado CPF, CNPJ ou telefone está na Whitelist de QA
 */
export async function isQaWhitelisted(rawIdentifier?: string | null): Promise<boolean> {
  if (!rawIdentifier) return false;
  const clean = rawIdentifier.replace(/\D/g, '');
  if (!clean) return false;

  const supabase = createServiceRoleClient();

  // 1. Tenta pela função RPC do PostgreSQL
  try {
    const { data } = await supabase.rpc('check_is_qa', { p_identifier: clean });
    if (data === true) return true;
  } catch (err) {
    // Fallback para query direta
  }

  // 2. Query direta na tabela qa_whitelist
  const { data: row } = await supabase
    .from('qa_whitelist')
    .select('id')
    .eq('identifier', clean)
    .eq('is_active', true)
    .maybeSingle();

  return Boolean(row);
}

/**
 * Adiciona um CPF, CNPJ ou telefone à Whitelist de QA
 */
export async function addQaWhitelist(
  rawIdentifier: string,
  description?: string,
  createdBy: string = 'admin'
): Promise<{ success: boolean; message: string }> {
  const clean = rawIdentifier.replace(/\D/g, '');
  if (!clean || clean.length < 8) {
    return { success: false, message: 'Identificador inválido (informe um CPF, CNPJ ou telefone válido).' };
  }

  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('qa_whitelist')
    .upsert(
      {
        identifier: clean,
        description: description || 'QA Liberado pelo Administrador',
        is_active: true,
        created_by: createdBy,
      },
      { onConflict: 'identifier' }
    );

  if (error) {
    console.error('[QA Whitelist] Erro ao adicionar:', error);
    return { success: false, message: `Erro no banco de dados: ${error.message}` };
  }

  return {
    success: true,
    message: `✅ *QA Liberado com Sucesso!*\nO identificador *${clean}* (${description || 'QA'}) agora pode navegar livremente no AnalisAí sem bloqueios de cota ou cobranças.`,
  };
}

/**
 * Remove ou inativa um CPF, CNPJ ou telefone da Whitelist de QA
 */
export async function removeQaWhitelist(rawIdentifier: string): Promise<{ success: boolean; message: string }> {
  const clean = rawIdentifier.replace(/\D/g, '');
  if (!clean) {
    return { success: false, message: 'Identificador inválido.' };
  }

  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('qa_whitelist')
    .update({ is_active: false })
    .eq('identifier', clean);

  if (error) {
    return { success: false, message: `Erro ao remover: ${error.message}` };
  }

  return {
    success: true,
    message: `🔒 *QA Revogado:* O identificador *${clean}* voltou às regras normais de limite e cota.`,
  };
}

/**
 * Lista todos os identificadores ativos na Whitelist de QA
 */
export async function listQaWhitelist(): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('qa_whitelist')
    .select('identifier, description, created_at, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return '📋 *Lista de QA Vazia:* Nenhum CPF, CNPJ ou telefone está atualmente na whitelist de QA.';
  }

  let txt = `🧪 *Whitelist de QA Ativa (${data.length} cadastrados)*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `Identificadores autorizados a operar livremente sem bloqueios:\n\n`;

  data.forEach((item, idx) => {
    txt += `${idx + 1}. *${item.identifier}* — ${item.description || 'Sem descrição'}\n`;
  });

  txt += `\n💡 *Comandos do Administrador:*\n`;
  txt += `• \`!qa add <cpf/cnpj/tel> [descrição]\`\n`;
  txt += `• \`!qa remove <cpf/cnpj/tel>\`\n`;

  return txt;
}
