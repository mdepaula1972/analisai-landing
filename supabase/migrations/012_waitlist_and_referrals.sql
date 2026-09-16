-- Migration 012: Lista de Espera dos Planos Pro e Super + Estatísticas no DB + Automação de Indicações

-- 1. Tabela de Lista de Espera dos Planos Corporativos
CREATE TABLE IF NOT EXISTS public.plan_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number VARCHAR(30) NOT NULL,
    client_name VARCHAR(255),
    company_name VARCHAR(255),
    cnpj VARCHAR(30),
    desired_plan VARCHAR(50) NOT NULL CHECK (desired_plan IN ('pro', 'super')),
    monthly_doc_estimate INT,
    status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'contacted', 'released', 'declined')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para plan_waitlist
ALTER TABLE public.plan_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_waitlist_service_role" ON public.plan_waitlist;
CREATE POLICY "plan_waitlist_service_role" ON public.plan_waitlist FOR ALL USING (true);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_plan_waitlist_plan ON public.plan_waitlist(desired_plan, status);
CREATE INDEX IF NOT EXISTS idx_plan_waitlist_phone ON public.plan_waitlist(whatsapp_number);

-- 2. Tabela Agregada de Estatísticas de Demanda no DB
CREATE TABLE IF NOT EXISTS public.plan_waitlist_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(50) UNIQUE NOT NULL, -- 'pro', 'super'
    total_leads_waiting INT DEFAULT 0,
    total_leads_all_time INT DEFAULT 0,
    estimated_monthly_demand_brl NUMERIC(10,2) DEFAULT 0,
    last_lead_at TIMESTAMPTZ,
    last_milestone_alerted INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insere linhas iniciais se não existirem
INSERT INTO public.plan_waitlist_stats (plan_code, total_leads_waiting, total_leads_all_time, estimated_monthly_demand_brl)
VALUES 
    ('pro', 0, 0, 0.00),
    ('super', 0, 0, 0.00)
ON CONFLICT (plan_code) DO NOTHING;

-- 3. Função e Trigger para manter as estatísticas sempre atualizadas em tempo real
CREATE OR REPLACE FUNCTION public.sync_plan_waitlist_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_pro_waiting INT;
    v_pro_total INT;
    v_pro_last TIMESTAMPTZ;
    v_super_waiting INT;
    v_super_total INT;
    v_super_last TIMESTAMPTZ;
BEGIN
    -- Pro
    SELECT 
        COUNT(*) FILTER (WHERE status = 'waiting'),
        COUNT(*),
        MAX(created_at)
    INTO v_pro_waiting, v_pro_total, v_pro_last
    FROM public.plan_waitlist
    WHERE desired_plan = 'pro';

    UPDATE public.plan_waitlist_stats
    SET 
        total_leads_waiting = COALESCE(v_pro_waiting, 0),
        total_leads_all_time = COALESCE(v_pro_total, 0),
        estimated_monthly_demand_brl = COALESCE(v_pro_waiting, 0) * 297.00,
        last_lead_at = v_pro_last,
        updated_at = NOW()
    WHERE plan_code = 'pro';

    -- Super
    SELECT 
        COUNT(*) FILTER (WHERE status = 'waiting'),
        COUNT(*),
        MAX(created_at)
    INTO v_super_waiting, v_super_total, v_super_last
    FROM public.plan_waitlist
    WHERE desired_plan = 'super';

    UPDATE public.plan_waitlist_stats
    SET 
        total_leads_waiting = COALESCE(v_super_waiting, 0),
        total_leads_all_time = COALESCE(v_super_total, 0),
        estimated_monthly_demand_brl = COALESCE(v_super_waiting, 0) * 597.00,
        last_lead_at = v_super_last,
        updated_at = NOW()
    WHERE plan_code = 'super';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_plan_waitlist_stats ON public.plan_waitlist;
CREATE TRIGGER trg_sync_plan_waitlist_stats
AFTER INSERT OR UPDATE OR DELETE ON public.plan_waitlist
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_plan_waitlist_stats();

-- 4. View de Relatório Executivo de Demanda
CREATE OR REPLACE VIEW public.v_plan_waitlist_summary AS
SELECT 
    s.plan_code,
    s.total_leads_waiting,
    s.total_leads_all_time,
    s.estimated_monthly_demand_brl,
    s.last_lead_at,
    s.updated_at
FROM public.plan_waitlist_stats s;

-- 5. Coluna para rastreamento de indicador na tabela trial_leads
ALTER TABLE public.trial_leads
ADD COLUMN IF NOT EXISTS referrer_phone VARCHAR(30) DEFAULT NULL;
