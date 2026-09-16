-- Migration 013: Quadro de Sócios (QSA) e Blindagem do Programa de Indicação

-- 1. Tabela de Sócios Vinculados ao Cliente
CREATE TABLE IF NOT EXISTS public.client_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    partner_name VARCHAR(255) NOT NULL,
    partner_cpf VARCHAR(14) NOT NULL,
    qualification VARCHAR(100) DEFAULT 'Sócio',
    is_managing_partner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_client_partner UNIQUE (client_id, partner_cpf)
);

ALTER TABLE public.client_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_partners_all" ON public.client_partners;
CREATE POLICY "client_partners_all" ON public.client_partners FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_client_partners_client ON public.client_partners(client_id);
CREATE INDEX IF NOT EXISTS idx_client_partners_cpf ON public.client_partners(partner_cpf);

-- 2. Atualização da RPC de Indicação com Blindagem de Caixa:
-- O indicador DEVE ter pago no mínimo 1 mensalidade (asaas_payment_id IS NOT NULL) para ser elegível à isenção
CREATE OR REPLACE FUNCTION public.evaluate_referral_exemption(p_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_referrer_plan_price INT;
    v_has_paid_subscription BOOLEAN;
    v_active_qualified_count INT;
BEGIN
    -- 1. Verifica se o indicador tem assinatura ativa E com pagamento confirmado no Asaas (asaas_payment_id OBRIGATÓRIO)
    SELECT 
        p.monthly_price_cents,
        (s.asaas_payment_id IS NOT NULL AND s.status = 'active')
    INTO v_referrer_plan_price, v_has_paid_subscription
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.client_id = p_client_id AND s.status = 'active';

    -- Se o indicador nunca pagou a 1ª mensalidade ou não tem plano ativo, NUNCA concede isenção
    IF v_referrer_plan_price IS NULL OR v_has_paid_subscription IS NOT TRUE THEN
        UPDATE public.subscriptions 
        SET is_referral_exempt = FALSE 
        WHERE client_id = p_client_id;
        RETURN FALSE;
    END IF;

    -- 2. Conta quantos indicados ativos estão pagando em plano igual ou superior
    SELECT COUNT(DISTINCT r.referred_client_id) INTO v_active_qualified_count
    FROM public.referrals r
    JOIN public.subscriptions sub ON sub.client_id = r.referred_client_id
    JOIN public.plans ref_plan ON ref_plan.id = sub.plan_id
    WHERE r.referrer_client_id = p_client_id
      AND r.status = 'qualified_active'
      AND sub.status = 'active'
      AND sub.asaas_payment_id IS NOT NULL -- Indicado também deve ter pago
      AND ref_plan.monthly_price_cents >= v_referrer_plan_price;

    -- 3. Concede isenção a partir da próxima renovação se tiver 3 ou mais ativos
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
