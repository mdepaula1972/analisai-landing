export type PlanCode = 'start' | 'solo' | 'solo_plus';

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  monthly_price_cents: number;
  annual_price_cents: number;
  doc_limit: number;
  bot_interaction_limit: number;
  cash_flow_analysis_limit: number;
  has_voice_commands: boolean;
  has_cash_flow_advisor: boolean;
  infinitepay_monthly_slug?: string | null;
  infinitepay_annual_slug?: string | null;
  features_config?: Record<string, unknown>;
  is_active: boolean;
}

export interface Client {
  id: string;
  auth_user_id?: string | null;
  name: string;
  company_name?: string | null;
  tax_id: string;
  tax_type: 'CPF' | 'CNPJ';
  whatsapp_number: string;
  is_admin: boolean;
  status: 'active' | 'suspended' | 'canceled';
  created_at: string;
}

export interface Subscription {
  id: string;
  client_id: string;
  plan_id: string;
  billing_period: 'monthly' | 'annual';
  status: 'active' | 'past_due' | 'grace_period' | 'canceled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  infinitepay_subscription_id?: string | null;
  infinitepay_last_payment_id?: string | null;
  is_referral_exempt: boolean;
  auto_renew: boolean;
}

export interface UsageCycle {
  id: string;
  client_id: string;
  subscription_id: string;
  cycle_start: string;
  cycle_end: string;
  docs_processed_count: number;
  bot_interactions_count: number;
  cash_flow_analyses_count: number;
  hit_doc_limit: boolean;
  hit_bot_limit: boolean;
  hit_analysis_limit: boolean;
  upsell_suggested_at?: string | null;
  upsell_declined_at?: string | null;
  upsell_status: 'none' | 'suggested' | 'accepted' | 'declined';
}

export interface ExtractedDocumentData {
  is_financial_doc?: boolean;
  doc_type: 'nfe' | 'nfse' | 'boleto' | 'recibo' | 'cupom' | 'outro';
  counterparty_name: string;
  tax_id?: string | null;
  total_amount: number;
  due_date?: string | null;
  issue_date?: string | null;
  barcode_or_pix?: string | null;
  category_suggestion: string;
  criticality_hint: number;
  confidence_score: number;
}

export interface CashLedgerEntry {
  id?: string;
  client_id: string;
  document_id?: string | null;
  entry_date: string;
  description: string;
  amount: number;
  entry_type: 'income' | 'expense';
  dre_group:
    | 'receita_operacional'
    | 'custo_mercadoria_servico'
    | 'despesa_administrativa'
    | 'despesa_comercial'
    | 'despesas_financeiras_tributos'
    | 'retirada_pro_labore'
    | 'outros';
  status: 'previsto' | 'realizado';
}

export interface BotActionConfirmation {
  id?: string;
  client_id: string;
  action_type: 'update_due_date' | 'confirm_low_confidence_doc' | 'confirm_postpone';
  target_entity_id?: string | null;
  proposed_payload: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  expires_at: string;
}
