-- Migration 010: Idempotencia de Lembretes Diarios
ALTER TABLE public.payables_receivables ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
