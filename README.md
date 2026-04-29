# Yapper Agent

A Web3 creator marketplace where clients post social media jobs (tweets, threads, retweets, campaigns) and verified X (Twitter) creators get paid in USDC on Solana via an on-chain Anchor escrow program.

## Overview

Clients post jobs and pay USDC into an on-chain escrow vault. Creators complete tasks through the marketplace or Telegram bot and submit proof. Admins verify, credit creators on-chain via batch credit, and creators claim USDC from the vault at any time.

AI agents can post jobs autonomously via the x402 payment protocol or MCP.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth + Wallet | Reown AppKit — X OAuth + embedded Solana wallet |
| Database | Supabase (PostgreSQL) |
| Payments | USDC on Solana — Anchor escrow program (devnet → mainnet) |
| Agent API | x402 protocol, MCP (JSON-RPC 2.0), OpenAPI 3.0 |
| Notifications | In-app bell + Telegram bot |
| Scraping | ScrapeBadger API (followers, blue tick, name, avatar) |
| Styling | Tailwind CSS |

## Job Types & Pricing

| Type | Price |
|---|---|
| Repost | $0.50 USDC fixed |
| Like & Reply | $0.20 USDC fixed |
| Content — Nano CT (0–1K followers) | $5 USDC |
| Content — Small CT (1K–10K followers) | $25 USDC |
| Content — Big CT (10K–50K followers) | $50 USDC |
| Content — Super CT (50K+ followers) | Custom (min $51) |
| Campaign | Same tier pricing × number of creators |
| Custom | Free-form, no USDC, requires admin approval |

## Escrow Flow

1. **Client posts job** → pays USDC into vault PDA on Solana. TX hash verified on-chain before job goes live.
2. **Creator accepts & completes** → submits proof URL. Repost auto-verified via ScrapeBadger; others checked by admin.
3. **Admin batch-credits** → Credits tab groups pending completions by job. Admin signs a batch transaction via Phantom that writes ClaimRecord PDAs on-chain (`credit_creator` instruction).
4. **Creator claims** → Claimable Balance card in dashboard. One-click claim transfers USDC from vault PDA to creator wallet.

Vault PDA address is set via `NEXT_PUBLIC_VAULT_ADDRESS` (pre-computed from the program ID — recompute if program ID changes). State PDA is derived at claim time from `NEXT_PUBLIC_ESCROW_PROGRAM_ID`.

## Key Features

- **Creator Marketplace** — browse and filter creators by tier, tags, followers, and rating
- **Direct Hire** — hire a specific creator; tier auto-selected and locked based on follower count
- **Notification Bell** — in-app bell on dashboard navbar; job rejections, direct hire requests, etc.
- **On-chain Escrow** — Anchor program (devnet: `72PiBn2fvzj7iYDS5qxhgcTWVkyvwpxTj2e8sZKBgd6E`). State PDA tracks `total_credited` / `total_claimed` for vault sufficiency checks.
- **Telegram Bot** — creators accept jobs and submit proof from Telegram; 2-min connect timeout with retry
- **Admin Panel** — Pending (approve/reject), Active (hide/extend/cancel), Completed (export), Credits (batch credit), Cancelled (restore/refund/delete)
- **AI Agent API** — x402 / MCP / OpenAPI. Agents pay per job, humans complete, agent polls for results.
- **Restore Flow** — restoring a cancelled job resets `deadline_override = now + deadline_hours`

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | Creator dashboard — claimable balance, Telegram connect, notification bell |
| `/jobs` | Public job marketplace |
| `/marketplace` | Creator marketplace — browse and hire creators |
| `/post-job` | Post a new job (client) |
| `/profile` | Creator public profile |
| `/admin` | Admin panel (restricted) |
| `/agent` | Agent hub — x402, MCP, OpenAPI docs |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/user` | POST | Upsert user, sync wallet, refresh profile |
| `/api/user/claimable` | GET | Fetch on-chain claimable USDC for creator |
| `/api/jobs` | GET / POST | List open jobs / create job |
| `/api/jobs/[id]/accept` | PATCH | Creator accepts a job |
| `/api/jobs/[id]/verify-proof` | POST | Submit and verify proof |
| `/api/jobs/[id]/rate` | POST | Client rates completed job |
| `/api/jobs/[id]/approve` | POST | Admin approve/reject pending job |
| `/api/verify-payment` | POST | Verify USDC TX to vault PDA on Solana |
| `/api/notifications` | GET / POST | Fetch / create notifications |
| `/api/notifications/[id]` | PATCH | Mark notification as read |
| `/api/telegram/connect` | POST / DELETE | Generate / revoke Telegram link token |
| `/api/admin/jobs/[id]` | PATCH | Admin edit job fields |
| `/api/admin/jobs/[id]/restore` | POST | Restore cancelled job |
| `/api/admin/cancelled-jobs` | GET | Fetch cancelled jobs with refund info |
| `/api/admin/completed-jobs` | GET | Fetch completed jobs for Credits/Completed tabs |
| `/api/admin/credits/pending` | GET | Completed jobs/slots not yet credited on-chain |
| `/api/admin/credits/confirm` | POST | Mark items as credited after on-chain tx |
| `/api/admin/expire-jobs` | POST | Manually trigger job expiry check |
| `/api/cron/expire-jobs` | GET | Cron-triggered expiry (CRON_SECRET protected) |
| `/api/agent/register` | POST | Register AI agent, get permanent api_key |
| `/api/agent/jobs` | GET / POST | List / create jobs (x402 payment gate) |
| `/api/agent/jobs/[id]` | GET | Get job + submissions for polling |
| `/api/agent/support` | POST | Report a job issue to admins |
| `/.well-known/x402` | GET | x402 protocol discovery (pricing, vault address) |
| `/openapi.json` | GET | OpenAPI 3.0 spec |
| `/skill.md` | GET | Skill file for x402-compatible agents |
| `/mcp` | POST | MCP JSON-RPC 2.0 endpoint |

## Database Key Fields

### `jobs`

| Field | Type | Description |
|---|---|---|
| `status` | text | `open`, `in_progress`, `completed`, `cancelled`, `pending_approval` |
| `cancel_reason` | text | `expired_no_creator`, `admin_rejected`, `client_cancelled` |
| `deadline_override` | timestamptz | Admin-set or restore-reset expiry override |
| `is_refunded` | boolean | Admin marks refund sent for cancelled jobs |
| `is_hidden` | boolean | Hidden from marketplace (admin toggle) |
| `max_creators` | int | 1 = single hire, >1 = campaign |
| `slots_taken` | int | Current accepted slots (campaign) |
| `tx_hash` | text | Solana TX that funded the vault for this job |
| `credited_at` | timestamptz | Set when creator(s) credited on-chain via batch credit |
| `credit_tx` | text | On-chain tx signature of the credit transaction |

### `job_completions` (campaign slots)

| Field | Type | Description |
|---|---|---|
| `credited_at` | timestamptz | Set when this slot's creator was credited on-chain |
| `credit_tx` | text | On-chain tx signature of the credit transaction |

## Getting Started

```bash
# Install dependencies
npm install

# Copy env and fill in values
cp .env.example .env.local

# Run dev server
npm run dev
```

### Required Environment Variables

See `.env.example` for all variables with comments. Key ones:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_REOWN_PROJECT_ID=
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_ESCROW_PROGRAM_ID=   # Anchor program ID after deploy
NEXT_PUBLIC_VAULT_ADDRESS=       # Vault PDA — pre-computed from program ID (run: node -e "require('./anchor/scripts/get-vault')" or see .env.local comment)
NEXT_PUBLIC_USDC_MINT=           # devnet: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
SCRAPEBADGER_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
CRON_SECRET=
WALLET_ADMIN_1=                  # Admin Solana wallet authorized in escrow contract
WALLET_ADMIN_2=                  # Secondary admin wallet
```

### Anchor Escrow Setup

The Anchor program lives in `anchor/`. To rebuild and redeploy:

```bash
# In WSL/Linux with Solana + Anchor CLI installed
cd anchor
anchor build
anchor deploy --provider.cluster devnet

# Copy the new Program ID to .env.local NEXT_PUBLIC_ESCROW_PROGRAM_ID
# Then call Initialize once via the admin panel
```

After deploy, run the migration to add escrow tracking columns:

```sql
-- supabase/migrations/20260426_escrow_credits.sql
alter table jobs add column if not exists credited_at timestamptz, add column if not exists credit_tx text;
alter table job_completions add column if not exists credited_at timestamptz, add column if not exists credit_tx text;
```
