/**
 * Tipos e Modelos para a Arquitetura BPO Multitenant,
 * Escritórios Contábeis e Auditoria Matinal (AnalisAí.me).
 */

export type ServiceTier = 'self_service' | 'bpo_gestao' | 'bpo_cfo';

export interface AccountantOffice {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  crc_number?: string | null;
  commission_rate: number; // Percentual mensal padrão (ex: 10.00)
  pix_key?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface DailyBpoAudit {
  id: string;
  audit_date: string;
  status: 'pending' | 'completed';
  d0_reminders_expected: number;
  d0_reminders_sent: number;
  d1_reminders_expected: number;
  d1_reminders_sent: number;
  documents_pending_review: number;
  documents_approved: number;
  inconsistencies_flagged: number;
  audited_by?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface BpoClientOverview {
  clientId: string;
  companyName: string;
  phone: string;
  serviceTier: ServiceTier;
  accountantOfficeName?: string | null;
  monthlyFee: number;
  pendingDocumentsCount: number;
  todayPayablesCount: number;
  todayPayablesAmount: number;
  lastConciliationDate?: string | null;
  status: 'up_to_date' | 'attention_required' | 'critical';
}

export interface AuditDailyOpsSummary {
  audit: DailyBpoAudit;
  d0PayablesList: Array<{
    id: string;
    clientId: string;
    clientName: string;
    counterparty: string;
    amount: number;
    currentDueDate: string;
    type: 'payable' | 'receivable';
    phone: string;
    isSentToday: boolean;
  }>;
  d1PayablesList: Array<{
    id: string;
    clientId: string;
    clientName: string;
    counterparty: string;
    amount: number;
    currentDueDate: string;
    type: 'payable' | 'receivable';
    phone: string;
    isSentToday: boolean;
  }>;
  pendingReviewDocuments: Array<{
    id: string;
    clientId: string;
    clientName: string;
    fileName: string;
    mimeType: string;
    docType?: string;
    createdAt: string;
    extractedData?: any;
  }>;
  inconsistenciesList: Array<{
    id: string;
    clientId: string;
    clientName: string;
    description: string;
    amount?: number;
    reason: string;
  }>;
  clientsList?: BpoClientOverview[];
}

