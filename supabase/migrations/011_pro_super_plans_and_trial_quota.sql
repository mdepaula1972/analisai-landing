-- ==============================================================================
-- Migration 011: Planos Pro e Super + Quota de Degustação Expandida (trial_leads)
-- Versão: v2.4.0
-- ==============================================================================

-- 1. Inserir ou atualizar os novos planos na tabela 'plans'
INSERT INTO plans (
  code,
  name,
  monthly_price_cents,
  annual_price_cents,
  doc_limit,
  bot_interaction_limit,
  cash_flow_analysis_limit,
  has_voice_commands,
  has_cash_flow_advisor,
  features_config,
  is_active
) VALUES 
(
  'pro',
  'AnalisAí Pro',
  29700,
  285120,
  500,
  500,
  10,
  true,
  true,
  '{"cnpjs_limit": 2, "trial_docs": 10, "bank_accounts_limit": 2, "bank_reconciliation_frequency": "semanal"}'::jsonb,
  true
),
(
  'super',
  'AnalisAí Super',
  59700,
  573120,
  1000,
  1000,
  20,
  true,
  true,
  '{"cnpjs_limit": 4, "trial_docs": 50, "bank_accounts_limit": 4, "bank_reconciliation_frequency": "semanal_continua"}'::jsonb,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  annual_price_cents = EXCLUDED.annual_price_cents,
  doc_limit = EXCLUDED.doc_limit,
  bot_interaction_limit = EXCLUDED.bot_interaction_limit,
  cash_flow_analysis_limit = EXCLUDED.cash_flow_analysis_limit,
  has_voice_commands = EXCLUDED.has_voice_commands,
  has_cash_flow_advisor = EXCLUDED.has_cash_flow_advisor,
  features_config = EXCLUDED.features_config,
  is_active = EXCLUDED.is_active;

-- 2. Expandir trial_leads com controle progressivo de cotas de degustação
ALTER TABLE trial_leads 
ADD COLUMN IF NOT EXISTS trial_docs_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_docs_limit INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS interested_plan VARCHAR(50) DEFAULT NULL;
