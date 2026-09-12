-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 009 — Suporte a Administrador Master e Bypass de Testes
-- AnalisAI.me — Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Adiciona coluna is_admin em clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Atualiza a RPC check_and_increment_usage com bypass irrestrito para Admin
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
    p_client_id UUID,
    p_metric VARCHAR(50),
    p_increment INT DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
    v_client public.clients%ROWTYPE;
    v_cycle public.usage_cycles%ROWTYPE;
    v_plan public.plans%ROWTYPE;
    v_limit INT := 0;
    v_current INT := 0;
    v_allowed BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
    IF v_client.is_admin THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'current', 0,
            'limit', 999999,
            'remaining', 999999,
            'is_admin', true
        );
    END IF;

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
        'remaining', GREATEST(0, v_limit - (v_current + CASE WHEN v_allowed THEN p_increment ELSE 0 END)),
        'is_admin', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
