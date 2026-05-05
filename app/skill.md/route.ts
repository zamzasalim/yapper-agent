import { NextResponse } from "next/server";

const API_URL   = process.env.NEXT_PUBLIC_API_URL   ?? "https://api.yapperagent.xyz";
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "https://agent.yapperagent.xyz";

/** GET /skill.md — Agent skill file for x402/MCP-compatible AI agents */
export async function GET() {
  const md = `# Yapper Agent Skill

## Description
Yapper lets your AI agent hire real humans on X (Twitter) for social engagement tasks.
Agents can post retweets, like & reply, content creation, campaigns, or custom tasks.
Payment is done via USDC on Solana using the x402 protocol.

## Base URL
${API_URL}

## Authentication
1. Register once: \`POST /agent/register\` → get \`api_key\`
2. Pass \`api_key\` in every request body (POST) or query param (GET)

---

## Tools

### register_agent
Register your agent and get a permanent API key.
- **Endpoint:** \`POST /agent/register\`
- **Input:** \`{ agent_name: string, wallet_address?: string }\`
- **Output:** \`{ agent_id, agent_name, api_key }\`

---

### get_payment_info
Get x402 payment details before creating a job.
- **Endpoint:** \`GET /.well-known/x402\`
- **Output:** pricing per job type, Solana wallet to pay, asset (USDC)

---

### create_job
Post a job for humans to complete. Requires USDC payment on Solana first.
- **Endpoint:** \`POST /agent/jobs\`
- **Headers:** \`X-Payment: <base64({"tx_hash":"<solana_sig>"})>\`
- **Input:**
  \`\`\`json
  {
    "api_key": "string",
    "type": "repost | like_reply | content | campaign | custom",
    "title": "string",
    "description": "string",
    "tweet_url": "string (repost/like_reply only)",
    "price_usdc": "number (content/campaign — default: repost $0.50, like_reply $0.20, content/campaign $5.00)",
    "deadline_hours": "number (default: 24)",
    "num_creators": "number (campaign — default: 1)",
    "require_blue": "boolean",
    "min_followers": "number"
  }
  \`\`\`
- **Payment flow:**
  1. Call this endpoint WITHOUT \`X-Payment\` header → receive \`402\` with payment details
  2. Send USDC to \`payTo\` wallet on Solana
  3. Retry with \`X-Payment: <base64({"tx_hash":"<tx_sig>"})>\` header
- **Output:** \`{ job: { id, status, type, title, price_usdc, ... } }\`

---

### list_jobs
List all jobs created by this agent (recovery endpoint).
- **Endpoint:** \`GET /agent/jobs?api_key=<key>\`
- **Output:** \`{ jobs: [{ id, status, type, title, slots_taken, completed_at, ... }] }\`

---

### get_job
Fetch a single job and all its human submissions.
- **Endpoint:** \`GET /agent/jobs/{id}?api_key=<key>\`
- **Output:**
  \`\`\`json
  {
    "job": { "id", "status", "type", "title", "slots_taken", "max_creators", ... },
    "submissions": [
      {
        "status": "completed",
        "proof_url": "https://x.com/user/status/...",
        "creator": { "twitter_handle", "display_name", "wallet_address" }
      }
    ]
  }
  \`\`\`

---

### submit_support
Report an issue on a job. Notifies Yapper moderators.
- **Endpoint:** \`POST /agent/support\`
- **Input:** \`{ api_key, job_id, issue: string }\`
- **Output:** \`{ success: true, message }\`

---

## Job Types & Pricing

| Type        | Price       | Description                          |
|-------------|-------------|--------------------------------------|
| \`repost\`    | $0.50 USDC  | Retweet a tweet. Verified on-chain.  |
| \`like_reply\`| $0.20 USDC  | Like and reply to a tweet.           |
| \`content\`   | from $5.00  | Creator writes an original post.     |
| \`campaign\`  | from $5.00  | Multiple creators, set \`num_creators\`.|
| \`custom\`    | free        | Custom task. Goes to admin review.   |

---

### get_cc_payment_info
Get Canton CC (Amulet) payment details before creating a CC-paid job.
- **Endpoint:** \`GET /.well-known/x402\` (canton-jobs section)
- **Output:** Canton party ID, CC amount required, live CC/USD price

---

### create_cc_job
Post a job paid with CC on Canton Network. Requires Amulet payment first.
- **Endpoint:** \`POST /agent/canton-jobs\`
- **Headers:** \`X-Payment: <base64({"canton_tx_hash":"<hash>"})>\`
- **Input:**
  \`\`\`json
  {
    "api_key": "string",
    "type": "repost | like_reply | content | campaign | custom",
    "title": "string",
    "description": "string",
    "tweet_url": "string (repost/like_reply only)",
    "price_usdc": "number (USDC-equivalent — CC amount derived at request time)",
    "deadline_hours": "number (default: 24)",
    "num_creators": "number (campaign — default: 1)"
  }
  \`\`\`
- **Payment flow:**
  1. Call WITHOUT \`X-Payment\` → receive \`402\` with Canton party ID + live CC amount
  2. Send CC (Amulet) to \`payTo\` party via cantonloop.com or Loop SDK
  3. Get the transaction hash from Lighthouse
  4. Retry with \`X-Payment: <base64({"canton_tx_hash":"<hash>"})>\`
- **Output:** \`{ job: { id, status, type, title, price_cc, currency: "cc", ... } }\`

---

## Job Types & Pricing (CC / Canton)

Same pricing as USDC, converted at request time:

| Type         | USDC Equivalent | CC Amount         |
|--------------|-----------------|-------------------|
| \`repost\`     | $0.50           | live CC/USD price |
| \`like_reply\` | $0.20           | live CC/USD price |
| \`content\`    | from $5.00      | live CC/USD price |
| \`campaign\`   | from $5.00      | live CC/USD price |
| \`custom\`     | free            | no CC required    |

CC amount is ceiling-rounded to 0.1 CC. Price fetched from CoinMarketCap (10-min cache).

---

## Quick Start
\`\`\`bash
# 1. Register
curl -X POST ${API_URL}/agent/register \\
  -H "Content-Type: application/json" \\
  -d '{"agent_name":"MyBot","wallet_address":"<solana_wallet>"}'
# → { "api_key": "abc123..." }

# 2. Create job (no payment → get 402 with payment info)
curl -X POST ${API_URL}/agent/jobs \\
  -H "Content-Type: application/json" \\
  -d '{"api_key":"abc123","type":"repost","title":"RT this","tweet_url":"https://x.com/user/status/..."}'
# → 402 { accepts: [{ payTo, maxAmountRequired, network }] }

# 3. Pay USDC on Solana, retry with tx sig
curl -X POST ${API_URL}/agent/jobs \\
  -H "Content-Type: application/json" \\
  -H "X-Payment: $(echo -n '{"tx_hash":"<sig>"}' | base64)" \\
  -d '{"api_key":"abc123","type":"repost","title":"RT this","tweet_url":"..."}'
# → 201 { job: { id, status: "open", ... } }

# 4. Poll for results
curl "${API_URL}/agent/jobs/<id>?api_key=abc123"
# → { job: { status: "completed" }, submissions: [{ proof_url, creator }] }
\`\`\`

---

## MCP
Connect via Model Context Protocol:
\`${AGENT_URL}/mcp\`

## x402 Discovery
\`${AGENT_URL}/.well-known/x402\`

## OpenAPI Spec
\`${AGENT_URL}/openapi.json\`
`;

  return new NextResponse(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
