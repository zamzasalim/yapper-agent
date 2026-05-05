# Yapper Agent

A Web3 creator marketplace where clients post social media jobs (tweets, threads, retweets, campaigns) and verified X (Twitter) creators get paid in USDC on Solana or CC (Amulet) on Canton Network.

## Overview

Clients post jobs and pay into escrow. Creators complete tasks through the marketplace or Telegram bot and submit proof. Admins verify and credit creators. Creators claim their rewards at any time.

AI agents can post jobs autonomously via the x402 payment protocol (USDC or CC) or MCP.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth + Wallet | Reown AppKit — X OAuth + embedded Solana wallet |
| Database | Supabase (PostgreSQL) |
| Payments (USDC) | USDC on Solana — Anchor escrow program |
| Payments (CC) | Amulet (CC) on Canton Network — DAML JobEscrow contract |
| Agent API | x402 protocol, MCP (JSON-RPC 2.0), OpenAPI 3.0 |
| Notifications | In-app bell + Telegram bot |
| Scraping | ScrapeBadger API (followers, blue tick, name, avatar) |
| Styling | Tailwind CSS |

## Job Types & Pricing

| Type | Price |
|---|---|
| Repost | $0.50 USDC (or CC equivalent) |
| Like & Reply | $0.20 USDC (or CC equivalent) |
| Content — Nano CT (0–1K followers) | $5 USDC |
| Content — Small CT (1K–10K followers) | $25 USDC |
| Content — Big CT (10K–50K followers) | $50 USDC |
| Content — Super CT (50K+ followers) | Custom (min $51) |
| Campaign | Same tier pricing × number of creators |
| Custom | Free-form, no payment, requires admin approval |

CC amounts are computed at posting time from the live CC/USD price (CoinMarketCap, 10-min cache), ceiling-rounded to 0.1 CC.

## Escrow Flows

### USDC (Solana)

1. **Client posts job** → pays USDC into vault PDA on Solana. TX hash verified on-chain before job goes live.
2. **Creator accepts & completes** → submits proof URL. Repost auto-verified via ScrapeBadger; others checked by admin.
3. **Admin batch-credits** → Credits tab groups pending completions. Admin signs a batch transaction via Phantom that writes ClaimRecord PDAs (`credit_creator` instruction).
4. **Creator claims** → Claimable Balance card in dashboard. One-click claim transfers USDC from vault PDA to creator wallet.

### CC / Canton Network

1. **Client posts job** → pays CC (Amulet) to Yapper's Canton party ID via cantonloop.com or Loop SDK. Canton TX hash verified via Lighthouse scan API.
2. **Server creates DAML JobEscrow contract** on the Canton ledger (best-effort, non-blocking).
3. **Creator completes job** → admin approves → server exercises `ClaimReward` on the JobEscrow contract, transferring CC to creator's canton_party_id via validator wallet transfer offer.
4. **Admin marks credited** → `canton_credited_at` set in DB.

## Key Features

- **Dual payment** — USDC on Solana and CC (Amulet) on Canton Network, selectable per job
- **Creator Marketplace** — browse and filter creators by tier, tags, followers, and rating
- **Direct Hire** — hire a specific creator; tier auto-selected and locked based on follower count
- **Notification Bell** — in-app bell on dashboard navbar; job rejections, direct hire requests, etc.
- **Solana Escrow** — Anchor program (devnet: `72PiBn2fvzj7iYDS5qxhgcTWVkyvwpxTj2e8sZKBgd6E`)
- **Canton Escrow** — DAML JobEscrow contract; `ClaimReward` / `CancelEscrow` exercised server-side
- **Loop Wallet Integration** — CC payment via Loop SDK on post-job page (devnet: connect to connect wallet, manual hash paste fallback)
- **Telegram Bot** — creators accept jobs and submit proof from Telegram; 2-min connect timeout with retry
- **Admin Panel** — Pending, Active, Completed, Credits (USDC + CC), Cancelled tabs
- **AI Agent API** — x402 / MCP / OpenAPI. USDC lane: `/agent/jobs`. CC lane: `/agent/canton-jobs`.
- **Restore Flow** — restoring a cancelled job resets `deadline_override = now + deadline_hours`

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | Creator dashboard — claimable balance, Telegram connect, Canton wallet connect |
| `/jobs` | Public job marketplace |
| `/marketplace` | Creator marketplace — browse and hire creators |
| `/post-job` | Post a new job (USDC or CC) |
| `/profile` | Creator public profile |
| `/admin` | Admin panel (restricted) |
| `/agent` | Agent hub — x402, MCP, OpenAPI docs |
| `/docs` | API documentation (also served at docs.yapperagent.xyz) |

## API Routes

### Core

| Route | Method | Description |
|---|---|---|
| `/api/user` | POST | Upsert user, sync wallet, refresh profile |
| `/api/user/canton-wallet` | POST / DELETE | Save / clear Canton party ID |
| `/api/user/claimable` | GET | Fetch on-chain claimable USDC for creator |
| `/api/cc-price` | GET | Live CC/USD price (CoinMarketCap, 10-min cache) |
| `/api/jobs` | GET / POST | List open jobs / create job |
| `/api/jobs/[id]/accept` | PATCH | Creator accepts a job |
| `/api/jobs/[id]/verify-proof` | POST | Submit and verify proof |
| `/api/jobs/[id]/rate` | POST | Client rates completed job |
| `/api/jobs/[id]/approve` | POST | Admin approve/reject pending job |
| `/api/verify-payment` | POST | Verify USDC TX to vault PDA on Solana |
| `/api/notifications` | GET / POST | Fetch / create notifications |
| `/api/notifications/[id]` | PATCH | Mark notification as read |
| `/api/telegram/connect` | POST / DELETE | Generate / revoke Telegram link token |

### Admin

| Route | Method | Description |
|---|---|---|
| `/api/admin/jobs/[id]` | PATCH | Admin edit job fields |
| `/api/admin/jobs/[id]/restore` | POST | Restore cancelled job |
| `/api/admin/cancelled-jobs` | GET | Fetch cancelled jobs with refund info |
| `/api/admin/completed-jobs` | GET | Fetch completed jobs for Credits/Completed tabs |
| `/api/admin/credits/pending` | GET | Completed jobs/slots not yet credited (USDC + CC) |
| `/api/admin/credits/confirm` | POST | Mark items as credited after on-chain tx |
| `/api/admin/expire-jobs` | POST | Manually trigger job expiry check |
| `/api/cron/expire-jobs` | GET | Cron-triggered expiry (CRON_SECRET protected) |

### Agent (x402 / MCP)

| Route | Method | Description |
|---|---|---|
| `/api/agent/register` | POST | Register AI agent, get permanent api_key |
| `/api/agent/jobs` | GET / POST | List / create jobs (x402 USDC payment gate) |
| `/api/agent/jobs/[id]` | GET | Get job + submissions for polling |
| `/api/agent/canton-jobs` | POST | Create jobs paid with CC (x402 Canton gate) |
| `/api/agent/support` | POST | Report a job issue to admins |
| `/.well-known/x402` | GET | x402 protocol discovery (USDC + CC pricing) |
| `/openapi.json` | GET | OpenAPI 3.0 spec |
| `/skill.md` | GET | Skill file for x402-compatible agents |
| `/mcp` | POST | MCP JSON-RPC 2.0 endpoint |

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Anchor Escrow Setup

```bash
# In WSL/Linux with Solana + Anchor CLI
cd anchor
anchor build
anchor deploy --provider.cluster devnet
# Copy new Program ID to NEXT_PUBLIC_ESCROW_PROGRAM_ID
```

### Canton DAML Setup

The DAML `JobEscrow` contract lives in `daml/` (if present). Deploy to the Canton ledger, set `CANTON_PACKAGE_ID` to the deployed package hash, and configure the Ledger API credentials. The server auto-refreshes the JWT token via Keycloak if `CANTON_KEYCLOAK_USER` + `CANTON_KEYCLOAK_PASS` are set.
