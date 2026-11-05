-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 027 — BPO Multitenant, Escritórios Contábeis e Auditoria Matinal
-- AnalisAí.me — Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabela de Escritórios Contábeis Parceiros
CREATE TABLE IF NOT EXISTS public.accountant_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  crc_number TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 10.00, -- percentual mensal padrão (10%)
  pix_key TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'inactive'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Auditorias Diárias Matinais (Torre de Controle BPO)
CREATE TABLE IF NOT EXISTS public.daily_bpo_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed'
  d0_reminders_expected INT DEFAULT 0,
  d0_reminders_sent INT DEFAULT 0,
  d1_reminders_expected INT DEFAULT 0,
  d1_reminders_sent INT DEFAULT 0,
  documents_pending_review INT DEFAULT 0,
  documents_approved INT DEFAULT 0,
  inconsistencies_flagged INT DEFAULT 0,
  audited_by TEXT, -- identificador do operador/Marcos
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Adição defensiva de colunas em clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS service_tier TEXT DEFAULT 'self_service', -- 'self_service' | 'bpo_gestao' | 'bpo_cfo'
ADD COLUMN IF NOT EXISTS accountant_office_id UUID REFERENCES public.accountant_offices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_operator_id UUID;

-- 4. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_clients_accountant_office ON public.clients(accountant_office_id);
CREATE INDEX IF NOT EXISTS idx_clients_service_tier ON public.clients(service_tier);
CREATE INDEX IF NOT EXISTS idx_daily_bpo_audits_date ON public.daily_bpo_audits(audit_date);
CREATE INDEX IF NOT EXISTS idx_accountant_offices_email ON public.accountant_offices(email);

-- 5. Habilitação de RLS
ALTER TABLE public.accountant_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_bpo_audits ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de RLS para accountant_offices
DROP POLICY IF EXISTS "accountant_offices_admin_all" ON public.accountant_offices;
CREATE POLICY "accountant_offices_admin_all" ON public.accountant_offices
FOR ALL USING (
  -- Service Role tem bypass nativo; para auth.users verifica flag de admin
  COALESCE((auth.jwt() ->> 'role') = 'service_role', false)
  OR EXISTS (
    SELECT 1 FROM public.clients 
    WHERE auth_user_id = auth.uid() AND is_admin = true
  )
);

DROP POLICY IF EXISTS "accountant_offices_self_read" ON public.accountant_offices;
CREATE POLICY "accountant_offices_self_read" ON public.accountant_offices
FOR SELECT USING (
  -- Parceiro autenticado acessa seu próprio escritório por e-mail ou vínculo
  email = (auth.jwt() ->> 'email')
);

-- 7. Políticas de RLS para daily_bpo_audits
DROP POLICY IF EXISTS "daily_bpo_audits_admin_all" ON public.daily_bpo_audits;
CREATE POLICY "daily_bpo_audits_admin_all" ON public.daily_bpo_audits
FOR ALL USING (
  COALESCE((auth.jwt() ->> 'role') = 'service_role', false)
  OR EXISTS (
    SELECT 1 FROM public.clients 
    WHERE auth_user_id = auth.uid() AND is_admin = true
  )
);
