-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 025 — Refinamento Financeiro, Onboarding Inteligente e Régua D+1
-- AnalisAI.me — Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Campos de Perfil Misto e Saldos Iniciais em Clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS is_mixed_profile BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS initial_bank_balance NUMERIC(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS initial_investments_balance NUMERIC(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS initial_cash_in_hand NUMERIC(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_balance_update_date DATE,
ADD COLUMN IF NOT EXISTS last_balance_prompt_at TIMESTAMPTZ;

-- 2. Campos de Perfil Misto e Saldo Inicial em Trial Leads (Degustação)
ALTER TABLE public.trial_leads
ADD COLUMN IF NOT EXISTS is_mixed_profile BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_balance_prompt_at TIMESTAMPTZ;

-- 3. Campos de Auditoria D+1 e Competência em Contas a Pagar e Receber
ALTER TABLE public.payables_receivables
ADD COLUMN IF NOT EXISTS d1_check_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS competence_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS origin_profile TEXT DEFAULT 'PJ';

-- Ajuste de compatibilidade na restrição de status para incluir 'overdue' e 'pending'
ALTER TABLE public.payables_receivables DROP CONSTRAINT IF EXISTS payables_receivables_status_check;
ALTER TABLE public.payables_receivables ADD CONSTRAINT payables_receivables_status_check 
  CHECK (status IN ('open', 'pending', 'paid', 'postponed', 'canceled', 'overdue', 'atrasado'));

-- 4. Campos de Origem e Natureza no Livro Caixa (Cash Ledger)
ALTER TABLE public.cash_ledger_entries
ADD COLUMN IF NOT EXISTS origin_profile TEXT DEFAULT 'PJ',
ADD COLUMN IF NOT EXISTS entry_nature TEXT DEFAULT 'OPERATIONAL';

-- Ajuste de compatibilidade na restrição de tipo de lançamento
ALTER TABLE public.cash_ledger_entries DROP CONSTRAINT IF EXISTS cash_ledger_entries_entry_type_check;
ALTER TABLE public.cash_ledger_entries ADD CONSTRAINT cash_ledger_entries_entry_type_check 
  CHECK (entry_type IN ('income', 'expense', 'INFLOW', 'OUTFLOW'));
