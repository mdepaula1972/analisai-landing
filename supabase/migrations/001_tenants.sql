-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 001 — Core Multitenant: tenants + tenant_users
-- AnalisAI.me BPO Portal — Supabase (novo projeto)
-- ═══════════════════════════════════════════════════════════════

-- Tabela de tenants (clientes BPO)
CREATE TABLE IF NOT EXISTS public.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  razao_social  TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj          TEXT,
  plano         TEXT NOT NULL DEFAULT 'essencial'
                CHECK (plano IN ('essencial', 'gestao', 'estrategico')),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vínculo usuário ↔ tenant + roles
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('admin_bpo', 'gestor', 'viewer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Tenant vê apenas seus próprios dados
DROP POLICY IF EXISTS "tenant_self_select" ON public.tenants;
CREATE POLICY "tenant_self_select" ON public.tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- admin_bpo vê e gerencia TODOS os tenants
DROP POLICY IF EXISTS "admin_bpo_all_tenants" ON public.tenants;
CREATE POLICY "admin_bpo_all_tenants" ON public.tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );

-- Usuário vê apenas seus próprios vínculos
DROP POLICY IF EXISTS "tu_self_select" ON public.tenant_users;
CREATE POLICY "tu_self_select" ON public.tenant_users
  FOR SELECT USING (user_id = auth.uid());

-- admin_bpo gerencia todos os vínculos
DROP POLICY IF EXISTS "tu_admin_all" ON public.tenant_users;
CREATE POLICY "tu_admin_all" ON public.tenant_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );

-- ── Trigger: updated_at automático ───────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── Helper: função para buscar tenant_id do usuário logado ───────
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = auth.uid()
  AND role != 'admin_bpo'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
