# Yapper Agent

A Web3 creator marketplace where clients post social media jobs (tweets, threads, retweets, campaigns) and verified Twitter/X creators get paid in USDC on Solana.

## Overview

Clients post jobs, pay upfront in USDC, and creators complete tasks through the marketplace or Telegram bot. Admins handle approvals, payouts, and dispute resolution. All payment verification is on-chain via Solana RPC.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth + Wallet | Reown AppKit — Twitter OAuth + embedded Solana wallet |
| Database | Supabase (PostgreSQL) |
| Payments | USDC on Solana — manual transfer + TX hash verify |
| Notifications | In-app bell + Telegram bot |
| Scraping | ScrapeBadger API (followers, blue tick, name, avatar) |
| Styling | Tailwind CSS |

## Job Types & Pricing

| Type | Price |
|---|---|
| Retweet | $0.50 USDC fixed |
| Like & Reply | $0.20 USDC fixed |
| Content — Nano CT (0–1K followers) | $5 USDC |
| Content — Small CT (1K–10K followers) | $25 USDC |
| Content — Big CT (10K–50K followers) | $50 USDC |
| Content — Super CT (50K+ followers) | Custom (min $51) |
| Campaign | Same tier pricing × number of creators |
| Custom | Free-form, no USDC, requires admin approval |

## Key Features

- **Creator Marketplace** — browse and filter creators by tier, tags, followers, and rating
- **Direct Hire** — hire a specific creator from the marketplace; tier auto-selected and locked based on their follower count, campaign type hidden (single hire only)
- **Notification Bell** — in-app bell on the dashboard navbar; shows unread notifications (job rejections, direct hire requests, etc.)
- **Payment Escrow** — client sends USDC to platform wallet, pastes TX hash, server verifies on-chain before job goes live
- **Telegram Bot** — creators can accept jobs and submit proof directly from Telegram; Telegram connect has a 2-min timeout with retry flow
- **Admin Panel** — tabs: Pending (approve/reject custom jobs), Active (hide/extend/cancel), Completed (manual payout + export), Cancelled (restore/refund/delete)
- **Restore Flow** — restoring a cancelled job resets `deadline_override = now + deadline_hours` so it doesn't expire immediately; custom jobs re-enter the approval queue

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | Creator dashboard — Telegram connect, job list, earnings, notification bell |
| `/jobs` | Public job marketplace |
| `/marketplace` | Creator marketplace — browse and hire creators |
| `/post-job` | Post a new job (client) |
| `/profile` | Creator public profile |
| `/admin` | Admin panel (restricted) |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/user` | POST | Upsert user, sync wallet, refresh profile |
| `/api/jobs` | GET / POST | List open jobs / create job |
| `/api/jobs/[id]/accept` | PATCH | Creator accepts a job |
| `/api/jobs/[id]/verify-proof` | POST | Submit and verify proof |
| `/api/jobs/[id]/rate` | POST | Client rates completed job |
| `/api/jobs/[id]/approve` | POST | Admin approve/reject pending job |
| `/api/verify-payment` | POST | Verify USDC TX on Solana |
| `/api/notifications` | GET / POST | Fetch / create notifications |
| `/api/notifications/[id]` | PATCH | Mark notification as read |
| `/api/telegram/connect` | POST | Generate Telegram link token |
| `/api/admin/jobs/[id]` | PATCH | Admin edit job fields |
| `/api/admin/jobs/[id]/restore` | POST | Restore cancelled job |
| `/api/admin/cancelled-jobs` | GET | Fetch cancelled jobs with refund info |
| `/api/admin/expire-jobs` | POST | Manually trigger job expiry check |
| `/api/cron/expire-jobs` | GET | Cron-triggered expiry (CRON_SECRET protected) |

## Database Key Fields (`jobs`)

| Field | Type | Description |
|---|---|---|
| `status` | text | `open`, `in_progress`, `completed`, `cancelled`, `pending_approval` |
| `cancel_reason` | text | `expired_no_creator`, `admin_rejected`, `client_cancelled` |
| `deadline_override` | timestamptz | Admin-set or restore-reset expiry override |
| `is_refunded` | boolean | Admin marks refund sent for cancelled jobs |
| `is_hidden` | boolean | Hidden from marketplace (admin toggle) |
| `max_creators` | int | 1 = single hire, >1 = campaign |
| `slots_taken` | int | Current accepted slots (campaign) |

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

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_REOWN_PROJECT_ID=
NEXT_PUBLIC_PLATFORM_WALLET=
SCRAPE_BADGER_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
CRON_SECRET=
SOLANA_RPC_URL=
```
