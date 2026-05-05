-- Migration: Canton Network (CC) support
-- Phase 1 — Foundation columns for parallel CC payment layer alongside USDC/Solana

-- ── users: Loop wallet party ID ───────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS canton_party_id TEXT;

COMMENT ON COLUMN public.users.canton_party_id IS
  'Canton Network party ID from Loop wallet (e.g. Alice::1220ab...). NULL = not connected.';

-- ── jobs: CC payment fields ───────────────────────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS currency           TEXT    NOT NULL DEFAULT 'usdc',
  ADD COLUMN IF NOT EXISTS price_cc           NUMERIC NOT NULL DEFAULT 0 CHECK (price_cc >= 0),
  ADD COLUMN IF NOT EXISTS canton_tx_hash     TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS canton_contract_id TEXT,
  ADD COLUMN IF NOT EXISTS canton_credited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canton_credit_tx   TEXT;

COMMENT ON COLUMN public.jobs.currency         IS '''usdc'' (default, Solana) or ''cc'' (Canton Network)';
COMMENT ON COLUMN public.jobs.price_cc         IS 'CC amount for canton jobs; 0 for usdc jobs';
COMMENT ON COLUMN public.jobs.canton_tx_hash     IS 'CC payment proof submitted by client/agent — verified via Lighthouse API';
COMMENT ON COLUMN public.jobs.canton_contract_id  IS 'DAML JobEscrow contractId on Canton ledger — populated after job creation';
COMMENT ON COLUMN public.jobs.canton_credited_at  IS 'Set when admin credits CC to creator via DAML ClaimReward choice';
COMMENT ON COLUMN public.jobs.canton_credit_tx    IS 'Canton ledger transaction ID for the CC credit exercise';

-- ── job_completions: CC credit tracking per slot ──────────────────────────────
ALTER TABLE public.job_completions
  ADD COLUMN IF NOT EXISTS canton_credited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canton_credit_tx   TEXT;

COMMENT ON COLUMN public.job_completions.canton_credited_at IS 'Set when CC is credited for this specific campaign slot';
COMMENT ON COLUMN public.job_completions.canton_credit_tx   IS 'Canton ledger tx ID for this slot credit';
