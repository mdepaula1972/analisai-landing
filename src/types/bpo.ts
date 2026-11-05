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

export interface BpoPortalData {
  client: {
    id: string;
    name: string;
    companyName: string;
    cnpjCpf: string;
    serviceTier: ServiceTier;
    accountantOfficeName?: string | null;
    operatorName?: string;
    whatsappNumber?: string;
  };
  card1_reconciledBalance: {
    currentBalance: number;
    lastConciliatedAt: string;
    status: 'up_to_date' | 'pending_receipts';
    todayInflow: number;
    todayOutflow: number;
  };
  card2_weekPayables: {
    totalPayable: number;
    count: number;
    overdueCount: number;
    overdueAmount: number;
    bills: Array<{
      id: string;
      counterpartyName: string;
      amount: number;
      dueDate: string;
      status: 'open' | 'overdue' | 'paid';
      barcodeOrPix?: string | null;
      daysUntilDue: number;
      humanDueDate: string;
    }>;
  };
  card3_profitSummary: {
    months: Array<{
      monthKey: string;
      monthLabel: string;
      revenue: number;
      expenses: number;
      netProfit: number;
      marginPercent: number;
      isProfitable: boolean;
    }>;
    averageMonthlyProfit: number;
  };
  cfoStrategy: {
    avoidedInterest: number;
    avoidedInterestRoiText: string;
    personalExpenseLeakAmount: number;
    personalExpensePercent: number;
    cashTightnessRisk: 'healthy' | 'tight' | 'critical';
    cashTightnessAlert: string | null;
  };
  support: {
    whatsappNumber: string;
    whatsappLink: string;
    operatorName: string;
  };
}


