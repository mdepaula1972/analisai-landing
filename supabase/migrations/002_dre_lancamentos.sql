-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 002 — DRE Lançamentos (multitenant)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.dre_lancamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  periodo      TEXT NOT NULL,       -- ex: 'Jan/26'
  conta_dre    TEXT NOT NULL,       -- ex: 'Receita Operacional'
  departamento TEXT NOT NULL DEFAULT 'Geral',
  projeto      TEXT,
  valor        NUMERIC(15, 2) NOT NULL,
  tipo         TEXT NOT NULL
               CHECK (tipo IN ('receita', 'custo', 'despesa', 'investimento')),
  descricao    TEXT,
  status       TEXT NOT NULL DEFAULT 'publicado'
               CHECK (status IN ('rascunho', 'revisao', 'publicado')),
  upload_id    UUID,               -- ref ao arquivo de origem
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dre_tenant_periodo
  ON public.dre_lancamentos(tenant_id, periodo);

CREATE INDEX IF NOT EXISTS idx_dre_status
  ON public.dre_lancamentos(tenant_id, status);

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.dre_lancamentos ENABLE ROW LEVEL SECURITY;

-- Cliente vê apenas lançamentos PUBLICADOS do seu tenant
DROP POLICY IF EXISTS "cliente_view_publicados" ON public.dre_lancamentos;
CREATE POLICY "cliente_view_publicados" ON public.dre_lancamentos
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
    AND status = 'publicado'
  );

-- admin_bpo vê e gerencia tudo (incluindo rascunhos)
DROP POLICY IF EXISTS "admin_all_lancamentos" ON public.dre_lancamentos;
CREATE POLICY "admin_all_lancamentos" ON public.dre_lancamentos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS dre_lancamentos_updated_at ON public.dre_lancamentos;
CREATE TRIGGER dre_lancamentos_updated_at
  BEFORE UPDATE ON public.dre_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

