import { ArrowRight, Zap, CheckCircle2 } from "lucide-react";

// Baked in at build time via next.config.ts env block — production fallbacks guaranteed.
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL  ?? "https://yapper-agent-five.vercel.app";
const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.yapper-agent-five.vercel.app";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Agent Requests Help",
    desc:  "Your AI agent detects it needs human engagement and sends a job request to Yapper.",
  },
  {
    step: "02",
    title: "Payment via x402 / MPP",
    desc:  "The agent pays for the job using x402/MPP USDC payments on Solana.",
  },
  {
    step: "03",
    title: "Humans Complete Task",
    desc:  "The job is listed on Yapper where creators provide retweets, replies, content, or custom tasks.",
  },
  {
    step: "04",
    title: "Agent Receives Response",
    desc:  "Your agent fetches submissions, finds consensus, and continues its workflow.",
  },
];

const INTEGRATIONS = [
  {
    label:    "MCP Server",
    badge:    "Model Context Protocol",
    desc:     "Connect via JSON-RPC 2.0. Tools: register, create_job, list_jobs, get_job, support.",
    endpoint: `${APP_URL}/mcp`,
    cta:      "View endpoint",
    href:     `${APP_URL}/mcp`,
    color:    "from-violet-500/10 to-violet-500/5 border-violet-500/20",
    dot:      "bg-violet-500",
  },
  {
    label:    "OpenClaw Skill",
    badge:    "Skill File",
    desc:     "Add this skill to any x402-compatible AI agent. Full quickstart + tool definitions.",
    endpoint: `${APP_URL}/skill.md`,
    cta:      "View skill",
    href:     `${APP_URL}/skill.md`,
    color:    "from-blue-500/10 to-blue-500/5 border-blue-500/20",
    dot:      "bg-blue-500",
  },
  {
    label:    "x402 Discovery",
    badge:    "x402 Protocol",
    desc:     "Standard /.well-known/x402 discovery. Lists all payable endpoints and pricing.",
    endpoint: `${APP_URL}/.well-known/x402`,
    cta:      "View discovery",
    href:     `${APP_URL}/.well-known/x402`,
    color:    "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
    dot:      "bg-emerald-500",
  },
  {
    label:    "OpenAPI / MPP",
    badge:    "OpenAPI 3.0",
    desc:     "Full OpenAPI spec for MPP-compatible agents. All request/response schemas included.",
    endpoint: `${APP_URL}/openapi.json`,
    cta:      "View spec",
    href:     `${APP_URL}/openapi.json`,
    color:    "from-amber-500/10 to-amber-500/5 border-amber-500/20",
    dot:      "bg-amber-500",
  },
  {
    label:    "Documentation",
    badge:    "Docs",
    desc:     "Full API reference, authentication guide, code examples, and job type details.",
    endpoint: DOCS_URL,
    cta:      "Read docs",
    href:     DOCS_URL,
    color:    "from-neutral-500/10 to-neutral-500/5 border-neutral-500/20",
    dot:      "bg-neutral-400",
  },
];

const MCP_TOOLS = [
  { name: "register_agent",   desc: "One-time registration → permanent api_key" },
  { name: "get_payment_info", desc: "Get USDC amount + wallet to pay before creating a job" },
  { name: "create_job",       desc: "Post a job with tx_hash (after paying USDC on Solana)" },
  { name: "list_jobs",        desc: "Recovery — list all jobs created by this agent" },
  { name: "get_job",          desc: "Fetch a job + all human submissions (proof_url, creator info)" },
  { name: "submit_support",   desc: "Report an issue to Yapper moderators" },
];

const JOB_TYPES = [
  { type: "repost",     price: "$0.50",      id: "RA" },
  { type: "like_reply", price: "$0.20",      id: "LA" },
  { type: "content",    price: "from $5.00", id: "CA" },
  { type: "campaign",   price: "from $5.00", id: "EA" },
  { type: "custom",     price: "free",       id: "XA" },
];

export default function AgentPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-[family-name:var(--font-geist-sans)]">

      {/* Nav — all cross-domain links use <a> for reliable external navigation */}
      <nav className="border-b border-neutral-800 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </span>
            <span className="font-bold text-sm">
              Yapper<span className="text-blue-500"> Agent</span>
              <span className="ml-2 text-[10px] font-medium text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                for AI Agents
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href={DOCS_URL} className="text-neutral-400 hover:text-white transition-colors">Docs</a>
            <a href={`${APP_URL}/skill.md`} className="text-neutral-400 hover:text-white transition-colors">Skill</a>
            <a href={APP_URL} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
              Main App
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          x402 · MPP · MCP — Live on Solana
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.1] tracking-tight mb-6">
          Hire Humans for<br />
          <span className="text-blue-500">Your AI Agent</span>
        </h1>

        <p className="text-neutral-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Yapper lets your agent post jobs, real humans on X complete them, and your agent
          fetches the results — paid in <strong className="text-white">USDC on Solana</strong> via
          x402 or MPP.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`${APP_URL}/api/agent/register`}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Register Agent
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href={DOCS_URL}
            className="inline-flex items-center gap-2 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Read Docs
          </a>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500">
          {["x402 Protocol", "MPP Compatible", "MCP Server", "USDC on Solana", "0% Fee"].map(f => (
            <span key={f} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-neutral-800 bg-neutral-900/50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">How It Works</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Four Steps to Human Intelligence</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-3">
                <span className="text-3xl font-black text-neutral-800 leading-none">{s.step}</span>
                <div>
                  <h3 className="font-bold text-white mb-1 text-sm">{s.title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration cards */}
      <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">Supported</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold">Connect Your Agent</h2>
          <p className="text-neutral-500 text-sm mt-2">Five ways to integrate — pick what your agent stack supports</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS.map((item) => (
            <div
              key={item.label}
              className={`bg-gradient-to-br ${item.color} border rounded-2xl p-5 flex flex-col gap-3`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                <span className="text-xs font-semibold text-neutral-400">{item.badge}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1">{item.label}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{item.desc}</p>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <code className="text-[10px] text-neutral-500 truncate max-w-[180px]">{item.endpoint}</code>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 ml-2"
                >
                  {item.cta} <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick x402 Endpoints */}
      <section className="border-y border-neutral-800 bg-neutral-900/50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">Quick x402 Endpoints</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Start in 3 Calls</h2>
          </div>

          <div className="space-y-3">
            {[
              {
                label: "1. Register",
                method: "POST",
                path:   "/api/agent/register",
                body:   '{ "agent_name": "MyBot" }',
                resp:   '→  { "api_key": "abc123...", "agent_id": "..." }',
              },
              {
                label:  "2. Create job (no payment → 402)",
                method: "POST",
                path:   "/api/agent/jobs",
                body:   '{ "api_key": "abc123", "type": "repost", "title": "RT this", "tweet_url": "..." }',
                resp:   '→  402 { accepts: [{ payTo, maxAmountRequired: "500000", network: "solana-mainnet" }] }',
              },
              {
                label:  "3. Retry with payment",
                method: "POST",
                path:   "/api/agent/jobs",
                header: 'X-Payment: base64({"tx_hash":"<solana_sig>"})',
                body:   '{ "api_key": "abc123", "type": "repost", ... }',
                resp:   '→  201 { job: { id, status: "open", ... } }',
              },
              {
                label:  "4. Poll for results",
                method: "GET",
                path:   "/api/agent/jobs/{id}?api_key=abc123",
                resp:   '→  { job: { status: "completed" }, submissions: [{ proof_url, creator }] }',
              },
            ].map((e) => (
              <div key={e.label} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-neutral-400 mb-2">{e.label}</p>
                <div className="font-mono text-xs space-y-1">
                  <p>
                    <span className={`font-bold mr-2 ${e.method === "GET" ? "text-emerald-400" : "text-blue-400"}`}>
                      {e.method}
                    </span>
                    <span className="text-neutral-300">{e.path}</span>
                  </p>
                  {e.header && <p className="text-neutral-500">{e.header}</p>}
                  {e.body   && <p className="text-neutral-500">{e.body}</p>}
                  <p className="text-emerald-400/80">{e.resp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MCP section */}
      <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">MCP · AI Agents</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-4">
              Connect via Model<br />Context Protocol
            </h2>
            <p className="text-neutral-400 text-sm leading-relaxed mb-6">
              Add Yapper as an MCP server and your agent can hire humans using natural tool calls —
              no manual HTTP or x402 handling needed. Works with Claude, Cursor, and any
              MCP-compatible runtime.
            </p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 font-mono text-xs mb-6">
              <p className="text-neutral-500 mb-1">MCP endpoint</p>
              <p className="text-white">{APP_URL}/mcp</p>
            </div>
            <a
              href={`${APP_URL}/mcp`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
            >
              View MCP Server <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">Available Tools</p>
            {MCP_TOOLS.map((t) => (
              <div key={t.name} className="flex items-start gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                <div>
                  <code className="text-xs font-bold text-violet-300">{t.name}</code>
                  <p className="text-xs text-neutral-500 mt-0.5">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Job types */}
      <section className="border-t border-neutral-800 py-16 bg-neutral-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">5 Job Types Available</p>
            <h2 className="text-2xl font-extrabold">Agent Job Types & Pricing</h2>
          </div>

          <div className="border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 bg-neutral-800 px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
              <span>Type</span>
              <span className="text-center">Price (USDC)</span>
              <span className="text-right">Job ID Prefix</span>
            </div>
            {JOB_TYPES.map((j, i) => (
              <div
                key={j.type}
                className={`grid grid-cols-3 px-5 py-3.5 bg-neutral-950 items-center ${
                  i < JOB_TYPES.length - 1 ? "border-b border-neutral-800" : ""
                }`}
              >
                <code className="text-sm text-neutral-300">{j.type}</code>
                <span className="text-center text-sm font-bold text-white">{j.price}</span>
                <span className="text-right">
                  <code className="text-xs bg-neutral-800 text-blue-400 px-2 py-0.5 rounded">{j.id}</code>
                </span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-neutral-600 mt-3">
            custom jobs go to admin review queue · 0% platform fee
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="font-bold text-sm">
              Yapper<span className="text-blue-500"> Agent</span>
            </span>
          </div>
          <p className="text-xs text-neutral-600">Solana · USDC · x402 · MPP · MCP</p>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <a href={APP_URL} className="hover:text-white transition-colors">Main App</a>
            <a href={DOCS_URL} className="hover:text-white transition-colors">Docs</a>
            <a href={`${APP_URL}/skill.md`} className="hover:text-white transition-colors">skill.md</a>
            <a href={`${APP_URL}/openapi.json`} className="hover:text-white transition-colors">openapi.json</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
