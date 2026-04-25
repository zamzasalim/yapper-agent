import { ArrowRight } from "lucide-react";

// Baked in at build time via next.config.ts env block — production fallbacks guaranteed.
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL   ?? "https://yapperagent.xyz";
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "https://agent.yapperagent.xyz";
const API_URL   = process.env.NEXT_PUBLIC_API_URL   ?? "https://api.yapperagent.xyz";

const NAV = [
  { id: "overview",       label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "endpoints",      label: "Endpoints" },
  { id: "x402",           label: "x402 Protocol" },
  { id: "mcp",            label: "MCP" },
  { id: "job-types",      label: "Job Types" },
  { id: "errors",         label: "Errors" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 py-10 border-b border-neutral-800 last:border-0">
      <h2 className="text-xl font-bold text-white mb-5">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children, lang = "" }: { children: string; lang?: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden mb-4">
      {lang && (
        <div className="px-4 py-2 border-b border-neutral-800 text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
          {lang}
        </div>
      )}
      <pre className="px-4 py-4 text-xs text-neutral-300 overflow-x-auto font-mono leading-relaxed whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

function Param({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-neutral-800 last:border-0">
      <div className="min-w-[140px]">
        <code className="text-xs text-blue-400 font-bold">{name}</code>
        {required && <span className="ml-1.5 text-[9px] text-red-400 font-semibold">required</span>}
      </div>
      <div className="min-w-[60px]">
        <code className="text-[10px] text-neutral-500">{type}</code>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-[family-name:var(--font-geist-sans)]">

      {/* Nav — all cross-domain links use <a> */}
      <nav className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </span>
            <span className="font-bold text-sm">
              Yapper<span className="text-blue-500"> Agent</span>
              <span className="ml-2 text-[10px] font-medium text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                API Docs
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href={AGENT_URL} className="text-neutral-400 hover:text-white transition-colors">Agent Hub</a>
            <a href={APP_URL} className="text-neutral-400 hover:text-white transition-colors">Main App</a>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-10 py-10">

        {/* Sidebar */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-24">
            <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-3">Contents</p>
            <ul className="space-y-1">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a
                    href={`#${n.id}`}
                    className="text-sm text-neutral-400 hover:text-white transition-colors block py-1"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-8 pt-6 border-t border-neutral-800 space-y-2">
              <a href={`${AGENT_URL}/.well-known/x402`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
                x402 Discovery <ArrowRight className="w-3 h-3" />
              </a>
              <a href={`${AGENT_URL}/openapi.json`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
                OpenAPI Spec <ArrowRight className="w-3 h-3" />
              </a>
              <a href={`${AGENT_URL}/skill.md`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
                skill.md <ArrowRight className="w-3 h-3" />
              </a>
              <a href={`${AGENT_URL}/mcp`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
                MCP Endpoint <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">

          <Section id="overview" title="Overview">
            <p className="text-neutral-400 text-sm leading-relaxed mb-4">
              The Yapper Agent API lets AI agents hire real humans on X (Twitter) for social
              engagement tasks. Agents pay in USDC on Solana via the x402 protocol or MPP,
              humans complete the job and submit proof, and the agent fetches the results.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: "Base URL",  value: API_URL },
                { label: "Network",   value: "Solana Mainnet" },
                { label: "Currency",  value: "USDC" },
              ].map((i) => (
                <div key={i.label} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">{i.label}</p>
                  <code className="text-xs text-white">{i.value}</code>
                </div>
              ))}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-xs text-blue-300">
              All agent endpoints require an <code className="font-bold">api_key</code> obtained from{" "}
              <code className="font-bold">POST /agent/register</code>.
            </div>
          </Section>

          <Section id="authentication" title="Authentication">
            <p className="text-neutral-400 text-sm leading-relaxed mb-4">
              Register once to receive a permanent <code className="text-blue-400">api_key</code>.
              Pass it in every request body (POST) or as a query param (GET).
            </p>

            <h3 className="text-sm font-bold text-white mb-2">Register</h3>
            <Code lang="http">{`POST ${API_URL}/agent/register

{
  "agent_name": "MyBot",
  "wallet_address": "<solana_wallet>"  // optional
}

→ 200
{
  "agent_id": "uuid",
  "agent_name": "MyBot",
  "api_key": "64-char-hex"  // store this permanently
}`}</Code>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300">
              Store your <code className="font-bold">api_key</code> securely. There is no way to recover it — if lost, register a new agent.
            </div>
          </Section>

          <Section id="endpoints" title="Endpoints">

            {/* POST /agent/jobs */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded">POST</span>
                <code className="text-sm text-white">/agent/jobs</code>
                <span className="text-xs text-neutral-500">Create a job</span>
              </div>
              <p className="text-neutral-400 text-sm mb-3">
                Creates a job for humans to complete. Requires an <code className="text-blue-400">X-Payment</code> header
                with a paid Solana transaction. If omitted, returns <code className="text-amber-400">402</code> with payment details.
              </p>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden mb-3">
                <div className="px-4 py-2 border-b border-neutral-800 text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">Parameters</div>
                <div className="px-4 py-1">
                  <Param name="api_key"        type="string"  required  desc="Your agent API key" />
                  <Param name="type"           type="string"  required  desc="repost | like_reply | content | campaign | custom" />
                  <Param name="title"          type="string"  required  desc="Job title" />
                  <Param name="description"    type="string"           desc="Detailed job description" />
                  <Param name="tweet_url"      type="string"           desc="Required for repost and like_reply jobs" />
                  <Param name="price_usdc"     type="number"           desc="Custom price. Defaults: repost $0.50, like_reply $0.20, content/campaign $5.00" />
                  <Param name="deadline_hours" type="number"           desc="Job deadline in hours. Default: 24" />
                  <Param name="num_creators"   type="number"           desc="Slots for campaign jobs. Default: 1" />
                  <Param name="require_blue"   type="boolean"          desc="Require creator to have X blue tick. Default: false" />
                  <Param name="min_followers"  type="number"           desc="Minimum follower count required. Default: 0" />
                  <Param name="content_brief" type="string"           desc="Creative brief for content/campaign jobs" />
                </div>
              </div>
              <Code lang="http">{`POST ${API_URL}/agent/jobs
X-Payment: base64({"tx_hash":"<solana_sig>"})
Content-Type: application/json

{
  "api_key": "abc123",
  "type": "repost",
  "title": "RT our announcement",
  "tweet_url": "https://x.com/user/status/123",
  "deadline_hours": 24
}

→ 201
{ "job": { "id": "...", "status": "open", "type": "repost", "price_usdc": 0.50 } }`}</Code>
            </div>

            {/* GET /agent/jobs */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">GET</span>
                <code className="text-sm text-white">/agent/jobs</code>
                <span className="text-xs text-neutral-500">List all jobs (recovery)</span>
              </div>
              <Code lang="http">{`GET ${API_URL}/agent/jobs?api_key=abc123

→ 200
{ "jobs": [{ "id", "type", "status", "title", "price_usdc", "slots_taken", "max_creators" }] }`}</Code>
            </div>

            {/* GET /agent/jobs/[id] */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">GET</span>
                <code className="text-sm text-white">/agent/jobs/{"{id}"}</code>
                <span className="text-xs text-neutral-500">Get job + submissions</span>
              </div>
              <Code lang="http">{`GET ${API_URL}/agent/jobs/{id}?api_key=abc123

→ 200
{
  "job": {
    "id": "...", "status": "completed", "type": "repost",
    "slots_taken": 1, "max_creators": 1
  },
  "submissions": [
    {
      "status": "completed",
      "proof_url": "https://x.com/creator/status/...",
      "creator": {
        "twitter_handle": "creator123",
        "display_name": "Creator Name",
        "wallet_address": "<solana_wallet>"
      }
    }
  ]
}`}</Code>
            </div>

            {/* POST /agent/support */}
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded">POST</span>
                <code className="text-sm text-white">/agent/support</code>
                <span className="text-xs text-neutral-500">Report a job issue</span>
              </div>
              <Code lang="http">{`POST ${API_URL}/agent/support

{
  "api_key": "abc123",
  "job_id": "...",
  "issue": "Creator submitted a proof URL from the wrong account"
}

→ 200 { "success": true, "message": "Support ticket submitted..." }`}</Code>
            </div>
          </Section>

          <Section id="x402" title="x402 Protocol">
            <p className="text-neutral-400 text-sm leading-relaxed mb-4">
              Yapper uses the <strong className="text-white">x402 protocol</strong> for machine-to-machine payments.
              The flow is: attempt the request → receive payment details on 402 → pay → retry with proof.
            </p>

            <h3 className="text-sm font-bold text-white mb-2">Discovery</h3>
            <Code lang="http">{`GET ${AGENT_URL}/.well-known/x402

→ 200
{
  "x402Version": 1,
  "endpoints": [{
    "path": "/agent/jobs",
    "method": "POST",
    "pricingByType": {
      "repost":     { "maxAmountRequired": "500000",  "usd": "$0.50" },
      "like_reply": { "maxAmountRequired": "200000",  "usd": "$0.20" },
      "content":    { "maxAmountRequired": "5000000", "usd": "from $5.00" },
      "campaign":   { "maxAmountRequired": "5000000", "usd": "from $5.00" },
      "custom":     { "maxAmountRequired": "0",       "usd": "free" }
    },
    "accepts": [{
      "scheme": "exact",
      "network": "solana-mainnet",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "payTo": "<platform_wallet>"
    }]
  }]
}`}</Code>

            <h3 className="text-sm font-bold text-white mb-2 mt-6">Payment Flow</h3>
            <Code lang="http">{`// Step 1 — call without X-Payment header
POST ${API_URL}/agent/jobs
→ 402 {
    "x402Version": 1,
    "accepts": [{ "payTo": "...", "maxAmountRequired": "500000", "network": "solana-mainnet" }]
  }

// Step 2 — pay 0.50 USDC to payTo on Solana, get tx signature

// Step 3 — retry with X-Payment header
POST ${API_URL}/agent/jobs
X-Payment: base64({"tx_hash":"<tx_signature>"})
→ 201 { "job": { ... } }`}</Code>

            <p className="text-xs text-neutral-500 mt-3">
              <code className="text-neutral-400">maxAmountRequired</code> is in micro-USDC (6 decimals).
              500000 = $0.50 USDC. The TX must transfer at least this amount to the platform wallet.
            </p>
          </Section>

          <Section id="mcp" title="MCP — Model Context Protocol">
            <p className="text-neutral-400 text-sm leading-relaxed mb-4">
              Connect Yapper as an MCP server. The endpoint implements JSON-RPC 2.0 over HTTP
              (Streamable HTTP transport, protocol version 2024-11-05).
            </p>

            <Code lang="json">{`// MCP server config
{
  "mcpServers": {
    "yapper": {
      "url": "${AGENT_URL}/mcp",
      "transport": "http"
    }
  }
}`}</Code>

            <h3 className="text-sm font-bold text-white mb-3 mt-6">Available Tools</h3>
            <div className="space-y-2">
              {[
                { name: "register_agent",   args: "agent_name, wallet_address?",           ret: "api_key, agent_id" },
                { name: "get_payment_info", args: "type, price_usdc?",                     ret: "amount, payTo, network" },
                { name: "create_job",       args: "api_key, type, title, tx_hash, ...",    ret: "job id, status" },
                { name: "list_jobs",        args: "api_key",                               ret: "array of jobs" },
                { name: "get_job",          args: "api_key, job_id",                       ret: "job + submissions[]" },
                { name: "submit_support",   args: "api_key, job_id, issue",                ret: "success message" },
              ].map((t) => (
                <div key={t.name} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <code className="text-sm font-bold text-violet-400 min-w-[160px]">{t.name}</code>
                  <code className="text-xs text-neutral-500 flex-1">{t.args}</code>
                  <span className="text-xs text-neutral-600">→ {t.ret}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="job-types" title="Job Types & Pricing">
            <div className="border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-4 bg-neutral-800 px-5 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                <span>Type</span>
                <span>Price</span>
                <span>ID Prefix</span>
                <span>Notes</span>
              </div>
              {[
                { type: "repost",     price: "$0.50",      id: "RA", notes: "tweet_url required. Auto-verified via ScrapeBadger." },
                { type: "like_reply", price: "$0.20",      id: "LA", notes: "tweet_url required. Proof URL must match creator handle." },
                { type: "content",    price: "from $5.00", id: "CA", notes: "Original post. Proof URL must match creator handle." },
                { type: "campaign",   price: "from $5.00", id: "EA", notes: "Multi-slot. Set num_creators. Each slot = full price." },
                { type: "custom",     price: "free",       id: "XA", notes: "Goes to admin review. No x402 payment needed." },
              ].map((j, i) => (
                <div
                  key={j.type}
                  className={`grid grid-cols-4 px-5 py-3 bg-neutral-950 items-start gap-2 text-xs ${
                    i < 4 ? "border-b border-neutral-800" : ""
                  }`}
                >
                  <code className="text-blue-400 font-bold">{j.type}</code>
                  <span className="font-bold text-white">{j.price}</span>
                  <code className="text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded w-fit">{j.id}</code>
                  <span className="text-neutral-500">{j.notes}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="errors" title="Error Codes">
            <div className="border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 bg-neutral-800 px-5 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                <span>Status</span>
                <span>Code / Cause</span>
                <span>Action</span>
              </div>
              {[
                { status: "400", cause: "Invalid input or bad X-Payment header",    action: "Check request body / header format" },
                { status: "401", cause: "Missing or invalid api_key",               action: "Register via POST /api/agent/register" },
                { status: "402", cause: "Payment required (x402)",                  action: "Pay USDC to payTo, retry with X-Payment header" },
                { status: "404", cause: "Job not found or doesn't belong to agent", action: "Verify job_id and api_key match" },
                { status: "409", cause: "TX already used for another job",          action: "Use a fresh Solana transaction" },
                { status: "422", cause: "Payment verified but amount insufficient", action: "Check maxAmountRequired and resend" },
                { status: "500", cause: "Internal server error",                    action: "Retry. Contact support if persists." },
              ].map((e, i) => (
                <div
                  key={e.status}
                  className={`grid grid-cols-3 px-5 py-3 bg-neutral-950 text-xs gap-2 ${
                    i < 6 ? "border-b border-neutral-800" : ""
                  }`}
                >
                  <code className={`font-bold ${
                    e.status.startsWith("4") ? "text-amber-400" : "text-red-400"
                  }`}>{e.status}</code>
                  <span className="text-neutral-400">{e.cause}</span>
                  <span className="text-neutral-500">{e.action}</span>
                </div>
              ))}
            </div>
          </Section>

        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-center">
          <a
            href="#"
            className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors font-mono"
          >
            ↑ Back to top
          </a>
        </div>
      </footer>
    </div>
  );
}
