-- Migration 024: Tokens de Autenticação Segura para PWA Dashboard via Magic Link WhatsApp
-- Tabela para gerenciar sessões sem senha/cadastro para microempreendedores

CREATE TABLE IF NOT EXISTS public.dashboard_auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin', -- 'admin' ou 'operator'
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 DAYS'),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de alta performance para busca e expiração
CREATE INDEX IF NOT EXISTS idx_dashboard_auth_tokens_hash ON public.dashboard_auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_dashboard_auth_tokens_client ON public.dashboard_auth_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_auth_tokens_phone ON public.dashboard_auth_tokens(phone_number);
CREATE INDEX IF NOT EXISTS idx_dashboard_auth_tokens_expires ON public.dashboard_auth_tokens(expires_at);

-- Comentários explicativos da tabela
COMMENT ON TABLE public.dashboard_auth_tokens IS 'Tokens criptografados para acesso seguro sem senha (Magic Link) ao PWA Dashboard do AnalisAí';
COMMENT ON COLUMN public.dashboard_auth_tokens.token_hash IS 'Hash SHA-256 do token único gerado para o cliente';
COMMENT ON COLUMN public.dashboard_auth_tokens.expires_at IS 'Data de expiração do link (padrão de 7 dias a partir da criação)';
