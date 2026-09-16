-- ============================================================================
-- Migration 014: Feedbacks & Sugestões de Clientes + Whitelist de QA
-- ============================================================================

-- 1. Tabela de Feedbacks e Sugestões dos Clientes
CREATE TABLE IF NOT EXISTS public.client_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    whatsapp_number VARCHAR(30) NOT NULL,
    client_name VARCHAR(150),
    feedback_type VARCHAR(50) NOT NULL DEFAULT 'sugestao' CHECK (feedback_type IN ('sugestao', 'critica', 'elogio', 'outro')),
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_feedbacks_whatsapp ON public.client_feedbacks(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_client_feedbacks_status ON public.client_feedbacks(status);

-- 2. Tabela de Whitelist de QA (CPFs, CNPJs ou Telefones com Acesso Livre)
CREATE TABLE IF NOT EXISTS public.qa_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_whitelist_identifier ON public.qa_whitelist(identifier);

-- 3. Função para Checagem Rápida de QA
CREATE OR REPLACE FUNCTION public.check_is_qa(p_identifier TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_clean TEXT := regexp_replace(p_identifier, '\D', '', 'g');
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.qa_whitelist
        WHERE identifier = v_clean AND is_active = TRUE
    ) INTO v_exists;
    RETURN COALESCE(v_exists, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
