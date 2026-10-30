-- ============================================================
-- Migration 026: Alinhamento de Cotas de Planos e Limite MEI (v1.5.2)
-- Alinha public.plans com os limites comerciais oficiais de constants.ts
-- e unifica o teto anual base do MEI em R$ 81.000,00 (tolerância 20% = R$ 97.200,00)
-- ============================================================

UPDATE public.plans SET doc_limit = 30, bot_interaction_limit = 200 WHERE code = 'start';
UPDATE public.plans SET doc_limit = 80, bot_interaction_limit = 502 WHERE code = 'solo';
UPDATE public.plans SET doc_limit = 200, bot_interaction_limit = 1004 WHERE code = 'solo_plus';

UPDATE public.tax_regime_limits
SET annual_limit = 81000.00,
    tolerance_limit = 97200.00,
    updated_at = NOW()
WHERE regime = 'MEI';

