-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 006 — Diagnóstico Financeiro: Pedidos e Identificação Pix
-- AnalisAI.me — Supabase
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.diagnostico_pedidos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_pagador      TEXT NOT NULL,
  email             TEXT NOT NULL,
  whatsapp          TEXT NOT NULL,
  metodo_pagamento  TEXT NOT NULL DEFAULT 'pix'
                    CHECK (metodo_pagamento IN ('pix', 'stripe_cartao')),
  valor             NUMERIC(10, 2) NOT NULL DEFAULT 197.00,
  status            TEXT NOT NULL DEFAULT 'pendente_confirmacao'
                    CHECK (status IN ('pendente_confirmacao', 'confirmado', 'entregue', 'cancelado')),
  comprovante_url   TEXT,
  session_id        TEXT,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public.diagnostico_pedidos ENABLE ROW LEVEL SECURITY;

-- Permitir que visitantes criem novos pedidos de diagnóstico
DROP POLICY IF EXISTS "diagnostico_pedidos_insert_anon" ON public.diagnostico_pedidos;
CREATE POLICY "diagnostico_pedidos_insert_anon" ON public.diagnostico_pedidos
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Leitura pública ou via service role
DROP POLICY IF EXISTS "diagnostico_pedidos_select_admin" ON public.diagnostico_pedidos;
CREATE POLICY "diagnostico_pedidos_select_admin" ON public.diagnostico_pedidos
  FOR SELECT TO authenticated, service_role
  USING (true);
