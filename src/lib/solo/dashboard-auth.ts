import { createServiceRoleClient } from '@/lib/supabase-server';
import crypto from 'crypto';

export interface DashboardAuthResult {
  valid: boolean;
  clientId?: string | null;
  phoneNumber?: string;
  role?: 'admin' | 'operator';
  client?: any;
  isTrial?: boolean;
  reason?: string;
}

/**
 * Gera hash SHA-256 do token bruto para armazenamento seguro
 */
export function hashDashboardToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Gera um Magic Link com token criptografado para o PWA Dashboard (validade de 7 dias)
 */
export async function generateDashboardAccessLink(params: {
  clientId?: string | null;
  phoneNumber: string;
  role?: 'admin' | 'operator';
}): Promise<{ magicUrl: string; token: string; expiresAt: string }> {
  const supabase = createServiceRoleClient();
  const cleanPhone = params.phoneNumber.replace(/\D/g, '');
  const role = params.role || 'admin';

  // Gera token seguro com alta entropia (48 caracteres URL-safe)
  const rawToken = crypto.randomBytes(36).toString('base64url');
  const tokenHash = hashDashboardToken(rawToken);

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + 7);
  const expiresAt = expiresDate.toISOString();

  // Invalida tokens muito antigos do mesmo cliente para evitar acúmulo
  await supabase
    .from('dashboard_auth_tokens')
    .delete()
    .eq('phone_number', cleanPhone)
    .lt('expires_at', new Date().toISOString());

  // Grava o novo token
  const { error } = await supabase.from('dashboard_auth_tokens').insert({
    client_id: params.clientId || null,
    phone_number: cleanPhone,
    token_hash: tokenHash,
    role: role,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('[DashboardAuth] Erro ao gravar token:', error);
  }

  // Domínio base (produção padrão https://analisai.me)
  const rawBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://analisai.me');
  const baseUrl = rawBase.replace(/\/+$/, '');

  const magicUrl = `${baseUrl}/painel?token=${rawToken}`;

  return {
    magicUrl,
    token: rawToken,
    expiresAt,
  };
}

/**
 * Valida o token do dashboard (verificando hash, expiração e buscando dados do cliente)
 */
export async function validateDashboardToken(rawToken?: string | null): Promise<DashboardAuthResult> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
    return { valid: false, reason: 'Token ausente ou formato inválido' };
  }

  const supabase = createServiceRoleClient();
  const tokenHash = hashDashboardToken(rawToken);
  const nowIso = new Date().toISOString();

  const { data: record, error } = await supabase
    .from('dashboard_auth_tokens')
    .select('id, client_id, phone_number, role, expires_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', nowIso)
    .maybeSingle();

  if (error || !record) {
    return { valid: false, reason: 'Token expirado ou não encontrado' };
  }

  // Atualiza last_used_at de forma assíncrona
  supabase
    .from('dashboard_auth_tokens')
    .update({ last_used_at: nowIso })
    .eq('id', record.id)
    .then();

  let clientData = null;
  if (record.client_id) {
    const { data: cl } = await supabase
      .from('clients')
      .select('id, name, whatsapp_number, tax_id, tax_type, status, is_admin')
      .eq('id', record.client_id)
      .maybeSingle();
    clientData = cl;
  }

  return {
    valid: true,
    clientId: record.client_id,
    phoneNumber: record.phone_number,
    role: (record.role as 'admin' | 'operator') || 'admin',
    client: clientData,
    isTrial: !record.client_id,
  };
}
