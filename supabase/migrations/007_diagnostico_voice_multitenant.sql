-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 007 — Coleta Voice-First e Multitenancy
-- AnalisAI.me — Supabase
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.diagnostico_coletas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id         UUID REFERENCES public.diagnostico_pedidos(id) ON DELETE SET NULL,
  tenant_id         UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  nome_cliente      TEXT,
  email_cliente     TEXT,
  whatsapp_cliente  TEXT,
  mensagens         JSONB NOT NULL DEFAULT '[]'::jsonb,
  dados_extraidos   JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'em_andamento'
                    CHECK (status IN ('em_andamento', 'concluido', 'processando_relatorio')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public.diagnostico_coletas ENABLE ROW LEVEL SECURITY;

-- Permitir inserção e atualização de coletas públicas ou vinculadas
DROP POLICY IF EXISTS "diagnostico_coletas_insert" ON public.diagnostico_coletas;
CREATE POLICY "diagnostico_coletas_insert" ON public.diagnostico_coletas
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "diagnostico_coletas_select" ON public.diagnostico_coletas;
CREATE POLICY "diagnostico_coletas_select" ON public.diagnostico_coletas
  FOR SELECT TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "diagnostico_coletas_update" ON public.diagnostico_coletas;
CREATE POLICY "diagnostico_coletas_update" ON public.diagnostico_coletas
  FOR UPDATE TO anon, authenticated, service_role
  USING (true);
