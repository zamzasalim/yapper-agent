-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- This reflects the current production Supabase schema.

CREATE TABLE public.job_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  job_id uuid,
  creator_id uuid,
  proof_url text,
  status text DEFAULT 'accepted'::text,
  additional_info jsonb,
  rating smallint CHECK (rating >= 1 AND rating <= 5),
  credited_at timestamp with time zone,
  credit_tx text,
  CONSTRAINT job_completions_pkey PRIMARY KEY (id),
  CONSTRAINT job_completions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_completions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id)
);

CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  client_id uuid NOT NULL,
  creator_id uuid,
  type USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'open'::job_status,
  title text NOT NULL,
  description text NOT NULL,
  content_brief text,
  tweet_url text,
  price_usdc numeric NOT NULL CHECK (price_usdc >= 0::numeric),
  is_agent_job boolean NOT NULL DEFAULT false,
  min_followers integer NOT NULL DEFAULT 0,
  max_followers integer NOT NULL DEFAULT 999999,
  deadline_hours integer NOT NULL DEFAULT 24,
  proof_url text,
  telegram_message_id text,
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone,
  rating smallint CHECK (rating >= 1 AND rating <= 5),
  tx_hash text UNIQUE,
  require_blue boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  is_paid boolean DEFAULT false,
  max_creators integer DEFAULT 1,
  slots_taken integer DEFAULT 0,
  additional_info jsonb,
  cancel_reason text,
  deadline_override timestamp with time zone,
  is_refunded boolean DEFAULT false,
  credited_at timestamp with time zone,
  credit_tx text,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id),
  CONSTRAINT jobs_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT notifications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);

CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  job_id uuid NOT NULL,
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  amount_usdc numeric NOT NULL,
  tx_signature text NOT NULL UNIQUE,
  confirmed boolean NOT NULL DEFAULT false,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id)
);

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  privy_did text NOT NULL UNIQUE,
  wallet_address text,
  twitter_id text UNIQUE,
  twitter_handle text UNIQUE,
  display_name text,
  avatar_url text,
  twitter_followers integer NOT NULL DEFAULT 0,
  is_verified_blue boolean NOT NULL DEFAULT false,
  bio text,
  role USER-DEFINED NOT NULL DEFAULT 'creator'::user_role,
  telegram_chat_id text,
  total_earned_usdc numeric NOT NULL DEFAULT 0,
  jobs_completed integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 5.0,
  niches ARRAY DEFAULT '{}'::text[],
  telegram_link_token text,
  telegram_token_expires_at timestamp with time zone,
  telegram_pending_job_id text,
  telegram_username text,
  agent_api_key text UNIQUE,
  custom_content_rate boolean,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
