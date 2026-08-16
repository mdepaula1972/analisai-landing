-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 003 — Contas a Pagar e Contas a Receber
-- ═══════════════════════════════════════════════════════════════

-- ── CONTAS A PAGAR ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,
  fornecedor       TEXT,
  valor            NUMERIC(15, 2) NOT NULL,
  data_vencimento  DATE NOT NULL,
  data_pagamento   DATE,
  status           TEXT NOT NULL DEFAULT 'aberto'
                   CHECK (status IN ('aberto', 'pago', 'atrasado', 'cancelado')),
  categoria        TEXT,
  observacoes      TEXT,
  upload_id        UUID,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_tenant_venc
  ON public.contas_pagar(tenant_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cp_status
  ON public.contas_pagar(tenant_id, status);

-- ── CONTAS A RECEBER ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contas_receber (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,
  cliente_nome     TEXT,
  valor            NUMERIC(15, 2) NOT NULL,
  data_vencimento  DATE NOT NULL,
  data_recebimento DATE,
  status           TEXT NOT NULL DEFAULT 'aberto'
                   CHECK (status IN ('aberto', 'recebido', 'atrasado', 'cancelado')),
  categoria        TEXT,
  observacoes      TEXT,
  upload_id        UUID,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cr_tenant_venc
  ON public.contas_receber(tenant_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_status
  ON public.contas_receber(tenant_id, status);

-- ── RLS — CONTAS A PAGAR ──────────────────────────────────────

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cp_tenant_select" ON public.contas_pagar;
CREATE POLICY "cp_tenant_select" ON public.contas_pagar
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cp_admin_all" ON public.contas_pagar;
CREATE POLICY "cp_admin_all" ON public.contas_pagar
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );

-- ── RLS — CONTAS A RECEBER ────────────────────────────────────

ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cr_tenant_select" ON public.contas_receber;
CREATE POLICY "cr_tenant_select" ON public.contas_receber
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cr_admin_all" ON public.contas_receber;
CREATE POLICY "cr_admin_all" ON public.contas_receber
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );

-- ── Triggers updated_at ───────────────────────────────────────

DROP TRIGGER IF EXISTS cp_updated_at ON public.contas_pagar;
CREATE TRIGGER cp_updated_at
  BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS cr_updated_at ON public.contas_receber;
CREATE TRIGGER cr_updated_at
  BEFORE UPDATE ON public.contas_receber
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── Função: atualizar status de atrasado automaticamente ──────
-- Pode ser chamada por um cron job (pg_cron) ou na leitura

CREATE OR REPLACE FUNCTION public.atualizar_status_atrasados()
RETURNS void AS $$
BEGIN
  UPDATE public.contas_pagar
  SET status = 'atrasado'
  WHERE status = 'aberto'
    AND data_vencimento < CURRENT_DATE;

  UPDATE public.contas_receber
  SET status = 'atrasado'
  WHERE status = 'aberto'
    AND data_vencimento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
