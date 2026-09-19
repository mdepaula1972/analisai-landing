import { createServiceRoleClient } from '@/lib/supabase-server';

export interface RecordAuditParams {
  clientId: string;
  actorPhone: string;
  action:
    | 'CREATE_BILL'
    | 'UPDATE_DUE_DATE'
    | 'UPDATE_AMOUNT'
    | 'DELETE_BILL'
    | 'ADD_TEAM_MEMBER'
    | 'REMOVE_TEAM_MEMBER'
    | 'UPDATE_TEAM_MEMBER';
  entityType: 'payables_receivables' | 'cash_ledger_entries' | 'client_team_members';
  entityId?: string;
  details: Record<string, any>;
  source?: string;
}

/**
 * Registra um evento de auditoria imutável na tabela audit_logs
 * para fins de segurança jurídica, fé pericial e rastreabilidade total.
 */
export async function recordAuditLog({
  clientId,
  actorPhone,
  action,
  entityType,
  entityId,
  details,
  source = 'whatsapp',
}: RecordAuditParams): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await supabase.from('audit_logs').insert({
      client_id: clientId,
      actor_phone: actorPhone.replace(/\D/g, ''),
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details,
      user_agent_or_source: source,
    });
  } catch (err) {
    console.error('[Audit Log Error]: Falha ao registrar log de auditoria:', err);
  }
}
