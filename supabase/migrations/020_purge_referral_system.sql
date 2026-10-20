-- Migration 020: Expurgo Completo do Módulo de Indicação & Afiliados

-- 1. Dropar RPCs associadas a indicações e isenções
DROP FUNCTION IF EXISTS public.evaluate_referral_exemption(UUID);
DROP FUNCTION IF EXISTS public.qualify_referral_on_payment(UUID, TEXT);

-- 2. Remover tabela de indicações e seus índices
DROP TABLE IF EXISTS public.referrals CASCADE;

-- 3. Remover colunas associadas em tabelas de assinaturas e leads
ALTER TABLE public.subscriptions 
DROP COLUMN IF EXISTS is_referral_exempt;

ALTER TABLE public.trial_leads 
DROP COLUMN IF EXISTS referrer_phone;

-- 4. Remover tipos/enums obsoletos (se existirem)
DROP TYPE IF EXISTS referral_status CASCADE;
