-- Escrow credit tracking columns
-- Run this in Supabase SQL Editor before using the Credits tab

-- jobs table: track when single-creator jobs were credited on-chain
alter table jobs
  add column if not exists credited_at  timestamptz default null,
  add column if not exists credit_tx    text        default null;

-- job_completions table: track when each campaign slot was credited on-chain
alter table job_completions
  add column if not exists credited_at  timestamptz default null,
  add column if not exists credit_tx    text        default null;

-- Index for fast "pending credits" queries
create index if not exists idx_jobs_credited_at          on jobs (credited_at)           where credited_at is null and status = 'completed';
create index if not exists idx_completions_credited_at   on job_completions (credited_at) where credited_at is null and status = 'completed';
