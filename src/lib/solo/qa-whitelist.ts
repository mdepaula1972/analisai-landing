import { createServiceRoleClient } from '@/lib/supabase-server';

/**
 * Gera todas as representações equivalentes de um identificador / telefone brasileiro:
 * - Com DDI (55) e sem DDI (55)
 * - Com nono dígito e sem nono dígito
 * - Formato limpo sem caracteres especiais
 */
export function getIdentifierVariations(rawIdentifier: string): string[] {
  const clean = (rawIdentifier || '').replace(/\D/g, '');
  if (!clean) return [];

  const variations = new Set<string>();
  variations.add(clean);

  // Se tiver tamanho de telefone brasileiro (10 a 13 dígitos)
  if (clean.length >= 10 && clean.length <= 13) {
    let local = clean;
    if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
      local = clean.slice(2); // Remove DDI 55 temporariamente para normalização
    }

    const ddd = local.slice(0, 2);
    const rest = local.slice(2);

    if (rest.length === 9 && rest.startsWith('9')) {
      const rest8 = rest.slice(1);
      variations.add(`55${ddd}${rest}`);  // 5513978122222
      variations.add(`55${ddd}${rest8}`); // 551378122222
      variations.add(`${ddd}${rest}`);    // 13978122222
      variations.add(`${ddd}${rest8}`);   // 1378122222
    } else if (rest.length === 8) {
      const rest9 = '9' + rest;
      variations.add(`55${ddd}${rest9}`);  // 5513978122222
      variations.add(`55${ddd}${rest}`);   // 551378122222
      variations.add(`${ddd}${rest9}`);    // 13978122222
      variations.add(`${ddd}${rest}`);     // 1378122222
    }
  }

  return Array.from(variations);
}

/**
 * Formata um telefone ou identificador para exibição amigável
 */
export function formatIdentifierDisplay(cleanId: string): string {
  if (cleanId.length === 13 && cleanId.startsWith('55')) {
    const ddd = cleanId.slice(2, 4);
    const part1 = cleanId.slice(4, 9);
    const part2 = cleanId.slice(9);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  if (cleanId.length === 11) {
    const ddd = cleanId.slice(0, 2);
    const part1 = cleanId.slice(2, 7);
    const part2 = cleanId.slice(7);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (cleanId.length === 14) {
    // CNPJ
    return cleanId.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (cleanId.length === 11) {
    // CPF
    return cleanId.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return cleanId;
}

/**
 * Consulta se determinado CPF, CNPJ ou telefone está na Whitelist de QA
 * Tolera qualquer formato com ou sem DDI 55, máscaras, parênteses e nono dígito
 */
export async function isQaWhitelisted(rawIdentifier?: string | null): Promise<boolean> {
  if (!rawIdentifier) return false;
  const clean = rawIdentifier.replace(/\D/g, '');
  if (!clean) return false;

  const variations = getIdentifierVariations(clean);
  const supabase = createServiceRoleClient();

  // 1. Tenta pela função RPC do PostgreSQL para cada variação
  try {
    for (const v of variations) {
      const { data } = await supabase.rpc('check_is_qa', { p_identifier: v });
      if (data === true) return true;
    }
  } catch (err) {
    // Fallback silencioso para consulta direta
  }

  // 2. Query direta na tabela qa_whitelist casando qualquer variação
  const { data: rows } = await supabase
    .from('qa_whitelist')
    .select('id')
    .in('identifier', variations)
    .eq('is_active', true)
    .limit(1);

  return Boolean(rows && rows.length > 0);
}

/**
 * Adiciona um CPF, CNPJ ou telefone à Whitelist de QA
 * Normaliza automaticamente o telefone brasileiro com e sem 55 para garantir compatibilidade total
 */
export async function addQaWhitelist(
  rawIdentifier: string,
  description?: string,
  createdBy: string = 'admin'
): Promise<{ success: boolean; message: string }> {
  const clean = rawIdentifier.replace(/\D/g, '');
  if (!clean || clean.length < 8) {
    return {
      success: false,
      message: '❌ *Identificador inválido!*\nInforme um telefone com DDD (ex: `13978122222`), CPF ou CNPJ.',
    };
  }

  const variations = getIdentifierVariations(clean);
  const supabase = createServiceRoleClient();

  // Salva a variação canônica principal e todas as variantes de DDD/DDI
  const recordsToInsert = variations.map((idVariant) => ({
    identifier: idVariant,
    description: description || 'QA Liberado pelo Administrador',
    is_active: true,
    created_by: createdBy,
  }));

  const { error } = await supabase
    .from('qa_whitelist')
    .upsert(recordsToInsert, { onConflict: 'identifier' });

  if (error) {
    console.error('[QA Whitelist] Erro ao adicionar:', error);
    return { success: false, message: `Erro no banco de dados: ${error.message}` };
  }

  const display = formatIdentifierDisplay(clean);

  return {
    success: true,
    message: `🧪 *Novo Usuário QA Habilitado com Sucesso!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Identificador:* ${display}
📝 *Descrição:* ${description || 'Acesso Livre QA'}
🛡️ *Formatos Vinculados:* ${variations.slice(0, 3).join(', ')}
⚡ *Status:* **Acesso Irrestrito Liberado!**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Este número agora pode cadastrar contas, pedir relatórios, simular planos e usar comandos de áudio e texto sem travas de cota ou cobranças!_`,
  };
}

/**
 * Remove ou inativa um CPF, CNPJ ou telefone da Whitelist de QA
 */
export async function removeQaWhitelist(rawIdentifier: string): Promise<{ success: boolean; message: string }> {
  const clean = rawIdentifier.replace(/\D/g, '');
  if (!clean) {
    return { success: false, message: '❌ Identificador inválido.' };
  }

  const variations = getIdentifierVariations(clean);
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('qa_whitelist')
    .update({ is_active: false })
    .in('identifier', variations);

  if (error) {
    return { success: false, message: `Erro ao remover: ${error.message}` };
  }

  return {
    success: true,
    message: `🔒 *QA Revogado:* O identificador *${formatIdentifierDisplay(clean)}* voltou às regras normais de limite e cota.`,
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

  // Agrupa variações do mesmo número para não duplicar visualmente na listagem
  const seenBases = new Set<string>();
  const uniqueItems: any[] = [];

  for (const item of data) {
    const rawDigits = item.identifier.replace(/\D/g, '');
    const base = rawDigits.length >= 12 && rawDigits.startsWith('55') ? rawDigits.slice(2) : rawDigits;
    if (!seenBases.has(base)) {
      seenBases.add(base);
      uniqueItems.push(item);
    }
  }

  let txt = `🧪 *Whitelist de QA Ativa (${uniqueItems.length} contatos liberados)*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `Identificadores com acesso ilimitado sem bloqueios:\n\n`;

  uniqueItems.forEach((item, idx) => {
    const display = formatIdentifierDisplay(item.identifier);
    txt += `${idx + 1}. *${display}* — ${item.description || 'Sem descrição'}\n`;
  });

  txt += `\n💡 *Comandos do Administrador:*\n`;
  txt += `• \`!qa add <telefone/cpf> [nome]\`\n`;
  txt += `  ↳ Ex: \`!qa add (13) 97812-2222 João Amigo\`\n`;
  txt += `• \`!qa remove <telefone/cpf>\`\n`;

  return txt;
}
