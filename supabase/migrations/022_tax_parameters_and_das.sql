-- ==============================================================================
-- Migration 022: Parametrização Tributária e Suporte a DAS-MEI
-- ==============================================================================

-- 1. Tabela de parâmetros fiscais e limites anuais (Editável sem novo deploy)
CREATE TABLE IF NOT EXISTS public.tax_regime_limits (
    regime TEXT PRIMARY KEY, -- 'MEI', 'SIMPLES_ME', 'SIMPLES_EPP'
    annual_limit NUMERIC(15,2) NOT NULL,
    tolerance_limit NUMERIC(15,2) NOT NULL,
    max_employees INT NOT NULL DEFAULT 1,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserção de valores padrão parametrizados
-- Configurado com suporte imediato a atualizações de teto (ex: 140k/144k)
INSERT INTO public.tax_regime_limits (regime, annual_limit, tolerance_limit, max_employees, description)
VALUES 
    ('MEI', 140000.00, 168000.00, 2, 'Limite MEI parametrizado'),
    ('SIMPLES_ME', 360000.00, 432000.00, 999, 'Microempresa Simples Nacional'),
    ('SIMPLES_EPP', 4800000.00, 5760000.00, 999, 'Empresa de Pequeno Porte')
ON CONFLICT (regime) DO UPDATE 
SET annual_limit = EXCLUDED.annual_limit,
    tolerance_limit = EXCLUDED.tolerance_limit,
    max_employees = EXCLUDED.max_employees;

-- 2. Colunas de discriminação tributária e competência em payables_receivables
ALTER TABLE public.payables_receivables
ADD COLUMN IF NOT EXISTS tax_competence TEXT,       -- ex: "05/2026"
ADD COLUMN IF NOT EXISTS is_government_tax BOOLEAN DEFAULT FALSE;
