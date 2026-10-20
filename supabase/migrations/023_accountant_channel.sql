-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 023 — Pacote de Fechamento Contábil & Canal do Contador
-- AnalisAI.me — Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Dados do contador vinculado na tabela de clientes
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS accountant_name TEXT,
ADD COLUMN IF NOT EXISTS accountant_email TEXT,
ADD COLUMN IF NOT EXISTS accountant_phone TEXT,
ADD COLUMN IF NOT EXISTS auto_send_monthly_closing BOOLEAN DEFAULT FALSE;

-- 2. Tabela de histórico de fechamentos mensais gerados
CREATE TABLE IF NOT EXISTS public.monthly_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    competence_period TEXT NOT NULL, -- ex: "09/2026"
    total_inflow NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_outflow NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    net_result NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    documents_count INT NOT NULL DEFAULT 0,
    csv_storage_path TEXT,
    zip_storage_path TEXT,
    sent_to_accountant_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_closings_client_period 
ON public.monthly_closings(client_id, competence_period);
