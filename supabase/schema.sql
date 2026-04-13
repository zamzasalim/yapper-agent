-- ─────────────────────────────────────────────────────────────────────────────
-- Yapper Agent — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────────────
create type job_type as enum ('content', 'repost', 'reply', 'like', 'custom');
create type job_status as enum ('open', 'in_progress', 'completed', 'cancelled');
create type user_role as enum ('creator', 'client', 'agent');

-- ── Users ─────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),

  -- Auth
  privy_did           text unique not null,             -- Privy DID
  wallet_address      text,                             -- Solana wallet pubkey

  -- Twitter / X
  twitter_id          text unique,
  twitter_handle      text unique,
  display_name        text,
  avatar_url          text,
  twitter_followers   integer not null default 0,
  is_verified_blue    boolean not null default false,   -- must be true to work

  -- Profile
  bio                 text,
  role                user_role not null default 'creator',
  telegram_chat_id    text,                             -- for bot DMs

  -- Stats (denormalized for speed)
  total_earned_usdc   numeric(18, 6) not null default 0,
  jobs_completed      integer not null default 0,
  rating              numeric(3, 2) not null default 5.0
);

-- Only verified blue accounts can transact
alter table public.users enable row level security;

create policy "Users can read all profiles" on public.users
  for select using (true);

create policy "Users can update own profile" on public.users
  for update using (auth.uid()::text = privy_did);

-- ── Jobs ──────────────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),

  client_id           uuid not null references public.users(id) on delete cascade,
  creator_id          uuid references public.users(id) on delete set null,

  type                job_type not null,
  status              job_status not null default 'open',

  title               text not null,
  description         text not null,
  content_brief       text,                             -- for content jobs
  tweet_url           text,                             -- for repost/reply/like

  price_usdc          numeric(18, 6) not null,          -- 0% fee — all to creator
  is_agent_job        boolean not null default false,   -- posted via x402/MPP

  min_followers       integer not null default 0,
  max_followers       integer not null default 999999,

  deadline_hours      integer not null default 24,
  proof_url           text,                             -- creator's proof tweet

  -- Telegram
  telegram_message_id text,                             -- TG channel msg id for updates

  accepted_at         timestamptz,
  completed_at        timestamptz,

  constraint price_positive check (price_usdc > 0)
);

alter table public.jobs enable row level security;

create policy "Anyone can view open jobs" on public.jobs
  for select using (status = 'open' or client_id = auth.uid()::uuid or creator_id = auth.uid()::uuid);

create policy "Authenticated users can create jobs" on public.jobs
  for insert with check (auth.uid() is not null);

create policy "Creator or client can update" on public.jobs
  for update using (client_id = auth.uid()::uuid or creator_id = auth.uid()::uuid);

-- ── Transactions ──────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),

  job_id          uuid not null references public.jobs(id) on delete restrict,
  from_wallet     text not null,
  to_wallet       text not null,
  amount_usdc     numeric(18, 6) not null,
  tx_signature    text unique not null,                 -- Solana tx hash
  confirmed       boolean not null default false
);

alter table public.transactions enable row level security;

create policy "Parties can view their transactions" on public.transactions
  for select using (
    from_wallet = (select wallet_address from public.users where privy_did = auth.uid()::text)
    or
    to_wallet   = (select wallet_address from public.users where privy_did = auth.uid()::text)
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index on public.users (twitter_handle);
create index on public.users (wallet_address);
create index on public.jobs (status);
create index on public.jobs (client_id);
create index on public.jobs (creator_id);
create index on public.jobs (is_agent_job);
create index on public.jobs (created_at desc);
create index on public.transactions (job_id);
create index on public.transactions (tx_signature);

-- ── Helper: update user stats on job completion ───────────────────────────────
create or replace function public.on_job_completed()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status != 'completed' and new.creator_id is not null then
    update public.users
    set
      jobs_completed    = jobs_completed + 1,
      total_earned_usdc = total_earned_usdc + new.price_usdc
    where id = new.creator_id;
  end if;
  return new;
end;
$$;

create trigger job_completed_trigger
  after update on public.jobs
  for each row execute function public.on_job_completed();

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable realtime for jobs so the UI updates live
alter publication supabase_realtime add table public.jobs;
