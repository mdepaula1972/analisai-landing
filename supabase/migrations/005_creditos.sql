-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 005 — Sistema de Créditos (Soft-Limit + Upsell)
-- ═══════════════════════════════════════════════════════════════

-- Limites por plano (referência)
-- essencial:   50 lançamentos/mês
-- gestao:      200 lançamentos/mês
-- estrategico: 9999 (ilimitado prático)

CREATE TABLE IF NOT EXISTS public.tenant_creditos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  plano           TEXT NOT NULL,
  limite_mensal   INT NOT NULL DEFAULT 50,
  creditos_extra  INT NOT NULL DEFAULT 0,
  uso_mes_atual   INT NOT NULL DEFAULT 0,
  mes_referencia  TEXT NOT NULL DEFAULT TO_CHAR(now(), 'YYYY-MM'), -- ex: '2026-08'
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Histórico de transações de crédito
CREATE TABLE IF NOT EXISTS public.credito_transacoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL
                      CHECK (tipo IN ('uso', 'compra', 'reset_mensal', 'bonus')),
  quantidade          INT NOT NULL,
  descricao           TEXT,
  stripe_payment_id   TEXT,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ct_tenant
  ON public.credito_transacoes(tenant_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.tenant_creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credito_transacoes ENABLE ROW LEVEL SECURITY;

-- Tenant vê apenas seus créditos
DROP POLICY IF EXISTS "cred_tenant_select" ON public.tenant_creditos;
CREATE POLICY "cred_tenant_select" ON public.tenant_creditos
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cred_admin_all" ON public.tenant_creditos;
CREATE POLICY "cred_admin_all" ON public.tenant_creditos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );

DROP POLICY IF EXISTS "ct_tenant_select" ON public.credito_transacoes;
CREATE POLICY "ct_tenant_select" ON public.credito_transacoes
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ct_admin_all" ON public.credito_transacoes;
CREATE POLICY "ct_admin_all" ON public.credito_transacoes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );


-- ── Funções de crédito ────────────────────────────────────────

-- Inicializa créditos ao criar tenant
CREATE OR REPLACE FUNCTION public.init_tenant_creditos(
  p_tenant_id UUID,
  p_plano TEXT
)
RETURNS void AS $$
DECLARE
  v_limite INT;
BEGIN
  v_limite := CASE p_plano
    WHEN 'essencial'   THEN 50
    WHEN 'gestao'      THEN 200
    WHEN 'estrategico' THEN 9999
    ELSE 50
  END;

  INSERT INTO public.tenant_creditos
    (tenant_id, plano, limite_mensal, creditos_extra, uso_mes_atual, mes_referencia)
  VALUES
    (p_tenant_id, p_plano, v_limite, 0, 0, TO_CHAR(now(), 'YYYY-MM'))
  ON CONFLICT (tenant_id) DO UPDATE
    SET plano = p_plano, limite_mensal = v_limite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica e debita crédito (retorna: 'ok' | 'soft_limit' | 'sem_credito')
CREATE OR REPLACE FUNCTION public.debitar_credito(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_cred RECORD;
  v_mes_atual TEXT;
  v_disponivel INT;
BEGIN
  v_mes_atual := TO_CHAR(now(), 'YYYY-MM');

  SELECT * INTO v_cred FROM public.tenant_creditos
  WHERE tenant_id = p_tenant_id;

  -- Reset mensal automático
  IF v_cred.mes_referencia != v_mes_atual THEN
    UPDATE public.tenant_creditos
    SET uso_mes_atual = 0, mes_referencia = v_mes_atual, updated_at = now()
    WHERE tenant_id = p_tenant_id;

    INSERT INTO public.credito_transacoes
      (tenant_id, tipo, quantidade, descricao)
    VALUES
      (p_tenant_id, 'reset_mensal', 0, 'Reset automático de créditos mensais');

    v_cred.uso_mes_atual := 0;
  END IF;

  v_disponivel := v_cred.limite_mensal + v_cred.creditos_extra - v_cred.uso_mes_atual;

  IF v_disponivel <= 0 THEN
    -- Soft-limit: permite mas avisa (sem_credito = precisa comprar créditos)
    UPDATE public.tenant_creditos
    SET uso_mes_atual = uso_mes_atual + 1, updated_at = now()
    WHERE tenant_id = p_tenant_id;

    INSERT INTO public.credito_transacoes
      (tenant_id, tipo, quantidade, descricao)
    VALUES
      (p_tenant_id, 'uso', 1, 'Uso além do limite — crédito extra');

    RETURN 'soft_limit';
  END IF;

  UPDATE public.tenant_creditos
  SET uso_mes_atual = uso_mes_atual + 1, updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.credito_transacoes
    (tenant_id, tipo, quantidade, descricao)
  VALUES
    (p_tenant_id, 'uso', 1, 'Lançamento registrado');

  -- Aviso preventivo: 80% do limite
  IF (v_cred.uso_mes_atual + 1) >= (v_cred.limite_mensal * 0.8) THEN
    RETURN 'soft_limit';
  END IF;

  RETURN 'ok';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adiciona créditos extras após compra (Stripe webhook)
CREATE OR REPLACE FUNCTION public.adicionar_creditos_extra(
  p_tenant_id UUID,
  p_quantidade INT,
  p_stripe_payment_id TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.tenant_creditos
  SET creditos_extra = creditos_extra + p_quantidade, updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.credito_transacoes
    (tenant_id, tipo, quantidade, descricao, stripe_payment_id)
  VALUES
    (p_tenant_id, 'compra', p_quantidade,
     'Compra de créditos extras', p_stripe_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
