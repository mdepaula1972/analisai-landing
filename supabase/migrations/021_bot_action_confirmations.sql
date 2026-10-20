-- Migration 021: Confirmação Prévia Anti-Alucinação e Opt-in Legal

-- 1. Colunas de Opt-in Legal (Termos de Uso e Responsabilidade)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE public.trial_leads 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- 2. Garantir estrutura e colunas de bot_action_confirmations
ALTER TABLE public.bot_action_confirmations 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);

ALTER TABLE public.bot_action_confirmations 
ADD COLUMN IF NOT EXISTS extracted_payload JSONB;

-- Sincroniza extracted_payload com proposed_payload se este existir
UPDATE public.bot_action_confirmations 
SET extracted_payload = proposed_payload 
WHERE extracted_payload IS NULL AND proposed_payload IS NOT NULL;

-- Garante que client_id seja anulável para comportar leads da degustação
ALTER TABLE public.bot_action_confirmations 
ALTER COLUMN client_id DROP NOT NULL;

-- 3. Índices de busca rápida para a máquina de estados no webhook
CREATE INDEX IF NOT EXISTS idx_bot_confirmations_phone_status 
ON public.bot_action_confirmations(phone_number, status);

CREATE INDEX IF NOT EXISTS idx_bot_confirmations_expires 
ON public.bot_action_confirmations(expires_at);
