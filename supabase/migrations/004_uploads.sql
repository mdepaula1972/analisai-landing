-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 004 — Uploads + Supabase Storage
-- ═══════════════════════════════════════════════════════════════

-- Registro de arquivos enviados pela equipe BPO
CREATE TABLE IF NOT EXISTS public.uploads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL
                 CHECK (tipo IN ('imagem', 'audio', 'pdf', 'planilha')),
  storage_path   TEXT NOT NULL,    -- caminho no bucket Supabase Storage
  nome_original  TEXT,
  tamanho_bytes  BIGINT,
  status         TEXT NOT NULL DEFAULT 'processando'
                 CHECK (status IN ('processando', 'revisao', 'concluido', 'erro')),
  ia_extracao    JSONB,            -- JSON com campos extraídos pela IA
  ia_confianca   NUMERIC(4, 2),   -- 0.00 a 1.00
  erro_msg       TEXT,
  uploaded_by    UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploads_tenant
  ON public.uploads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_status
  ON public.uploads(tenant_id, status);

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- admin_bpo: acesso total
DROP POLICY IF EXISTS "upload_admin_all" ON public.uploads;
CREATE POLICY "upload_admin_all" ON public.uploads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );

-- Cliente: apenas leitura (ver de onde veio o dado)
DROP POLICY IF EXISTS "upload_client_view" ON public.uploads;
CREATE POLICY "upload_client_view" ON public.uploads
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
    AND status = 'concluido'
  );

DROP TRIGGER IF EXISTS uploads_updated_at ON public.uploads;
CREATE TRIGGER uploads_updated_at
  BEFORE UPDATE ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── STORAGE BUCKET ────────────────────────────────────────────
-- Execute no Supabase Dashboard > Storage > New Bucket
-- Nome: 'bpo-uploads' | Private: true
-- Ou via SQL:

INSERT INTO storage.buckets (id, name, public)
VALUES ('bpo-uploads', 'bpo-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: apenas admin_bpo faz upload
DROP POLICY IF EXISTS "storage_admin_upload" ON storage.objects;
CREATE POLICY "storage_admin_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bpo-uploads'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid() AND role = 'admin_bpo'
    )
  );

DROP POLICY IF EXISTS "storage_tenant_read" ON storage.objects;
CREATE POLICY "storage_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bpo-uploads'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

