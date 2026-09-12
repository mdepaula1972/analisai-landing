-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 008 — Camada AnalisAí Solo & Solo Plus (Self-Service)
-- AnalisAI.me — Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Catálogo de Planos, Limites e Feature Flags Parametrizáveis
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- 'start', 'solo', 'solo_plus'
    name VARCHAR(100) NOT NULL,
    monthly_price_cents INT NOT NULL, -- 3990, 8799, 15799
    annual_price_cents INT NOT NULL,  -- 38304, 84470, 151670 (20% desc parcela única)
    doc_limit INT NOT NULL,           -- 15, 30, 60
    bot_interaction_limit INT NOT NULL,-- 20, 50, 100
    cash_flow_analysis_limit INT NOT NULL, -- 0, 2, 4
    has_voice_commands BOOLEAN DEFAULT FALSE, -- FALSE para Start, TRUE para Solo e Plus
    has_cash_flow_advisor BOOLEAN DEFAULT FALSE, -- FALSE para Start, TRUE para Solo e Plus
    features_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserção dos 3 planos padrão se não existirem
INSERT INTO public.plans (code, name, monthly_price_cents, annual_price_cents, doc_limit, bot_interaction_limit, cash_flow_analysis_limit, has_voice_commands, has_cash_flow_advisor)
VALUES
    ('start', 'AnalisAí Start', 3990, 38304, 15, 20, 0, FALSE, FALSE),
    ('solo', 'AnalisAí Solo', 8799, 84470, 30, 50, 2, TRUE, TRUE),
    ('solo_plus', 'AnalisAí Solo Plus', 15799, 151670, 60, 100, 4, TRUE, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    annual_price_cents = EXCLUDED.annual_price_cents,
    doc_limit = EXCLUDED.doc_limit,
    bot_interaction_limit = EXCLUDED.bot_interaction_limit,
    cash_flow_analysis_limit = EXCLUDED.cash_flow_analysis_limit,
    has_voice_commands = EXCLUDED.has_voice_commands,
    has_cash_flow_advisor = EXCLUDED.has_cash_flow_advisor;

-- 2. Clientes / Empresas Self-Service
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    tax_id VARCHAR(20) UNIQUE NOT NULL, -- CPF ou CNPJ limpo
    tax_type VARCHAR(4) NOT NULL CHECK (tax_type IN ('CPF', 'CNPJ')),
    whatsapp_number VARCHAR(30) UNIQUE NOT NULL, -- E.164 (ex: 5511999999999)
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'canceled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Assinaturas e Controle de Ciclos
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    billing_period VARCHAR(20) NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'grace_period', 'canceled', 'expired')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    infinitepay_subscription_id VARCHAR(150),
    infinitepay_last_payment_id VARCHAR(150),
    is_referral_exempt BOOLEAN DEFAULT FALSE,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Contadores de Consumo por Ciclo (Fonte Única de Verdade)
CREATE TABLE IF NOT EXISTS public.usage_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    cycle_start DATE NOT NULL,
    cycle_end DATE NOT NULL,
    docs_processed_count INT DEFAULT 0,
    bot_interactions_count INT DEFAULT 0,
    cash_flow_analyses_count INT DEFAULT 0,
    hit_doc_limit BOOLEAN DEFAULT FALSE,
    hit_bot_limit BOOLEAN DEFAULT FALSE,
    hit_analysis_limit BOOLEAN DEFAULT FALSE,
    upsell_suggested_at TIMESTAMPTZ,
    upsell_declined_at TIMESTAMPTZ,
    upsell_status VARCHAR(50) DEFAULT 'none' CHECK (upsell_status IN ('none', 'suggested', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, cycle_start, cycle_end)
);

-- 5. Documentos Capturados (OCR / Visão Gemini)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INT,
    doc_type VARCHAR(50) CHECK (doc_type IN ('nfe', 'nfse', 'boleto', 'recibo', 'cupom', 'outro')),
    extracted_data JSONB,
    confidence_score NUMERIC(3, 2) DEFAULT 1.0,
    status VARCHAR(50) DEFAULT 'processed' CHECK (status IN ('pending', 'awaiting_user_confirmation', 'processed', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Livro Caixa (Registro Cronológico Transparente)
CREATE TABLE IF NOT EXISTS public.cash_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('income', 'expense')),
    dre_group VARCHAR(100) NOT NULL CHECK (dre_group IN (
        'receita_operacional',
        'custo_mercadoria_servico',
        'despesa_administrativa',
        'despesa_comercial',
        'despesas_financeiras_tributos',
        'retirada_pro_labore',
        'outros'
    )),
    status VARCHAR(20) DEFAULT 'realizado' CHECK (status IN ('previsto', 'realizado')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Contas a Pagar e Receber
CREATE TABLE IF NOT EXISTS public.payables_receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    counterparty_name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('payable', 'receivable')),
    amount NUMERIC(12, 2) NOT NULL,
    original_due_date DATE NOT NULL,
    current_due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'paid', 'postponed', 'canceled')),
    criticality_score INT DEFAULT 3 CHECK (criticality_score BETWEEN 1 AND 5),
    barcode_or_pix TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Fila de Confirmação de Ações / Ambiguidades
CREATE TABLE IF NOT EXISTS public.bot_action_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL CHECK (action_type IN ('update_due_date', 'confirm_low_confidence_doc', 'confirm_postpone')),
    target_entity_id UUID,
    proposed_payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Pedidos de Itens Avulsos (InfinitePay)
CREATE TABLE IF NOT EXISTS public.one_off_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('cash_flow_extra', 'supplier_xray')),
    amount_cents INT NOT NULL,
    infinitepay_payment_link TEXT,
    infinitepay_order_id VARCHAR(150),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'expired', 'failed')),
    delivery_status VARCHAR(50) DEFAULT 'waiting_payment' CHECK (delivery_status IN ('waiting_payment', 'processing', 'delivered')),
    result_report_url TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Catálogo Genérico de Produtos de Parceiros (Avulsos com Comissão)
CREATE TABLE IF NOT EXISTS public.partner_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_price_cents INT NOT NULL,
    redirect_url TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    trigger_context VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Semeando o Certificado Digital A1 padrão
INSERT INTO public.partner_products (code, name, display_price_cents, redirect_url, category, trigger_context)
VALUES (
    'certificado_digital_a1',
    'Certificado Digital A1 (e-CNPJ / e-CPF)',
    17000,
    'https://parceiro.analisai.me/certificado-a1',
    'fiscal',
    'missing_nf_cert'
) ON CONFLICT (code) DO NOTHING;

-- 11. Programa de Indicação
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    referred_client_id UUID UNIQUE NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'qualified_active', 'canceled', 'disqualified')),
    first_paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_referral CHECK (referrer_client_id <> referred_client_id)
);

-- 12. Leads Escalonados para Consultoria Humana (Marcos: +551331500987)
CREATE TABLE IF NOT EXISTS public.escalated_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    trigger_source VARCHAR(50) NOT NULL,
    financial_summary JSONB NOT NULL,
    consultant_whatsapp VARCHAR(30) NOT NULL DEFAULT '+551331500987',
    status VARCHAR(50) DEFAULT 'dispatched' CHECK (status IN ('dispatched', 'contacted', 'converted', 'rejected')),
    dispatched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY (RLS) ───────────────────────────────────

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_action_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_off_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_products ENABLE ROW LEVEL SECURITY;

-- Catálogo de planos e parceiros: leitura pública
DROP POLICY IF EXISTS "plans_public_read" ON public.plans;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "partner_products_public_read" ON public.partner_products;
CREATE POLICY "partner_products_public_read" ON public.partner_products FOR SELECT USING (is_active = true);

-- Políticas com base em auth_user_id
DROP POLICY IF EXISTS "clients_self_manage" ON public.clients;
CREATE POLICY "clients_self_manage" ON public.clients
FOR ALL USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "subscriptions_self_read" ON public.subscriptions;
CREATE POLICY "subscriptions_self_read" ON public.subscriptions
FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "usage_cycles_self_read" ON public.usage_cycles;
CREATE POLICY "usage_cycles_self_read" ON public.usage_cycles
FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "documents_self_manage" ON public.documents;
CREATE POLICY "documents_self_manage" ON public.documents
FOR ALL USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "cash_ledger_self_manage" ON public.cash_ledger_entries;
CREATE POLICY "cash_ledger_self_manage" ON public.cash_ledger_entries
FOR ALL USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "payables_receivables_self_manage" ON public.payables_receivables;
CREATE POLICY "payables_receivables_self_manage" ON public.payables_receivables
FOR ALL USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "referrals_self_read" ON public.referrals;
CREATE POLICY "referrals_self_read" ON public.referrals
FOR SELECT USING (referrer_client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- ── RPCS ATÔMICAS ──────────────────────────────────────────────

-- RPC 1: Verificação e incremento atômico de cotas
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
    p_client_id UUID,
    p_metric VARCHAR(50), -- 'doc', 'bot', 'analysis'
    p_increment INT DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
    v_cycle public.usage_cycles%ROWTYPE;
    v_plan public.plans%ROWTYPE;
    v_limit INT := 0;
    v_current INT := 0;
    v_allowed BOOLEAN := FALSE;
BEGIN
    -- Localiza e trava o ciclo de faturamento ativo
    SELECT uc.* INTO v_cycle
    FROM public.usage_cycles uc
    WHERE uc.client_id = p_client_id 
      AND CURRENT_DATE BETWEEN uc.cycle_start AND uc.cycle_end
    FOR UPDATE;

    SELECT p.* INTO v_plan
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.client_id = p_client_id AND s.status IN ('active', 'grace_period');

    IF v_plan.id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'inactive_subscription');
    END IF;

    -- Se o ciclo não existir ainda para a data atual, cria automaticamente
    IF v_cycle.id IS NULL THEN
        INSERT INTO public.usage_cycles (client_id, subscription_id, cycle_start, cycle_end)
        SELECT s.client_id, s.id, CURRENT_DATE, (CURRENT_DATE + INTERVAL '30 days')::DATE
        FROM public.subscriptions s
        WHERE s.client_id = p_client_id AND s.status IN ('active', 'grace_period')
        RETURNING * INTO v_cycle;
    END IF;

    IF p_metric = 'doc' THEN
        v_limit := v_plan.doc_limit;
        v_current := v_cycle.docs_processed_count;
        IF (v_current + p_increment) <= v_limit THEN
            v_allowed := TRUE;
            UPDATE public.usage_cycles 
            SET docs_processed_count = docs_processed_count + p_increment,
                hit_doc_limit = (docs_processed_count + p_increment >= v_limit)
            WHERE id = v_cycle.id;
        END IF;
    ELSIF p_metric = 'bot' THEN
        v_limit := v_plan.bot_interaction_limit;
        v_current := v_cycle.bot_interactions_count;
        IF (v_current + p_increment) <= v_limit THEN
            v_allowed := TRUE;
            UPDATE public.usage_cycles 
            SET bot_interactions_count = bot_interactions_count + p_increment,
                hit_bot_limit = (bot_interactions_count + p_increment >= v_limit)
            WHERE id = v_cycle.id;
        END IF;
    ELSIF p_metric = 'analysis' THEN
        v_limit := v_plan.cash_flow_analysis_limit;
        v_current := v_cycle.cash_flow_analyses_count;
        IF (v_current + p_increment) <= v_limit THEN
            v_allowed := TRUE;
            UPDATE public.usage_cycles 
            SET cash_flow_analyses_count = cash_flow_analyses_count + p_increment,
                hit_analysis_limit = (cash_flow_analyses_count + p_increment >= v_limit)
            WHERE id = v_cycle.id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'current', v_current + CASE WHEN v_allowed THEN p_increment ELSE 0 END,
        'limit', v_limit,
        'remaining', GREATEST(0, v_limit - (v_current + CASE WHEN v_allowed THEN p_increment ELSE 0 END))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: Apuração do Programa de Indicação (3 Ativos = Isento)
CREATE OR REPLACE FUNCTION public.evaluate_referral_exemption(p_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_referrer_plan_price INT;
    v_active_qualified_count INT;
BEGIN
    SELECT p.monthly_price_cents INTO v_referrer_plan_price
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.client_id = p_client_id AND s.status = 'active';

    IF v_referrer_plan_price IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT COUNT(DISTINCT r.referred_client_id) INTO v_active_qualified_count
    FROM public.referrals r
    JOIN public.subscriptions sub ON sub.client_id = r.referred_client_id
    JOIN public.plans ref_plan ON ref_plan.id = sub.plan_id
    WHERE r.referrer_client_id = p_client_id
      AND r.status = 'qualified_active'
      AND sub.status = 'active'
      AND ref_plan.monthly_price_cents >= v_referrer_plan_price;

    IF v_active_qualified_count >= 3 THEN
        UPDATE public.subscriptions 
        SET is_referral_exempt = TRUE 
        WHERE client_id = p_client_id;
        RETURN TRUE;
    ELSE
        UPDATE public.subscriptions 
        SET is_referral_exempt = FALSE 
        WHERE client_id = p_client_id;
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
