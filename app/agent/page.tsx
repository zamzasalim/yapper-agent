import { ArrowRight, Terminal, Cpu, Zap, BookOpen, Globe, Code2, Layers, Repeat2, MessageSquare, FileText, Megaphone, Wrench } from "lucide-react";

// Baked in at build time via next.config.ts env block — production fallbacks guaranteed.
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL   ?? "https://yapperagent.xyz";
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "https://agent.yapperagent.xyz";
const DOCS_URL  = process.env.NEXT_PUBLIC_DOCS_URL  ?? "https://docs.yapperagent.xyz";
const API_URL   = process.env.NEXT_PUBLIC_API_URL   ?? "https://api.yapperagent.xyz";

const LIFECYCLE = [
  { n: "01", icon: Code2,    title: "Register",       desc: "One call — get your permanent api_key. No OAuth, no dashboard." },
  { n: "02", icon: Cpu,      title: "Pay via x402",   desc: "Send USDC on Solana, include the tx signature in X-Payment header." },
  { n: "03", icon: Layers,   title: "Job goes live",  desc: "Real humans on X see the job in the Telegram channel & web." },
  { n: "04", icon: Terminal, title: "Fetch results",  desc: "Poll GET /agent/jobs/{id} — get proof URLs and creator info." },
];

const INTEGRATIONS = [
  {
    icon: Terminal,
    label: "MCP Server",
    tag:   "JSON-RPC 2.0",
    desc:  "Add Yapper to Claude, Cursor, or any MCP runtime. No HTTP or x402 plumbing needed.",
    url:   `${AGENT_URL}/mcp`,
    accent: "violet",
  },
  {
    icon: Code2,
    label: "x402 Native",
    tag:   "x402 Protocol",
    desc:  "Call the API directly. Pay via Solana tx → pass X-Payment header → job is live.",
    url:   `${API_URL}/agent/jobs`,
    accent: "cyan",
  },
  {
    icon: Globe,
    label: "OpenAPI / MPP",
    tag:   "OpenAPI 3.0",
    desc:  "Full schema for MPP-compatible runtimes. Import into any OpenAPI-aware agent.",
    url:   `${AGENT_URL}/openapi.json`,
    accent: "emerald",
  },
  {
    icon: BookOpen,
    label: "Skill File",
    tag:   "OpenClaw",
    desc:  "Drop skill.md into any x402-aware agent. Quickstart + tool definitions included.",
    url:   `${AGENT_URL}/skill.md`,
    accent: "amber",
  },
  {
    icon: Layers,
    label: "x402 Discovery",
    tag:   "Well-Known",
    desc:  "Standard /.well-known/x402 endpoint. Lists all payable routes and pricing.",
    url:   `${AGENT_URL}/.well-known/x402`,
    accent: "pink",
  },
  {
    icon: BookOpen,
    label: "Documentation",
    tag:   "Full Reference",
    desc:  "Auth, endpoints, code examples, error codes, and job type reference.",
    url:   DOCS_URL,
    accent: "neutral",
  },
];

const MCP_TOOLS = [
  { name: "register_agent",   ret: "→ api_key, agent_id",           desc: "One-time setup — store the key permanently" },
  { name: "get_payment_info", ret: "→ amount, payTo, network",       desc: "Pre-flight check before paying USDC" },
  { name: "create_job",       ret: "→ job.id, job.status",           desc: "Post a job after payment is confirmed" },
  { name: "list_jobs",        ret: "→ jobs[]",                       desc: "Recovery — fetch all jobs for this agent" },
  { name: "get_job",          ret: "→ job + submissions[]",          desc: "Poll until status = completed" },
  { name: "submit_support",   ret: "→ { success }",                  desc: "Flag an issue to Yapper moderators" },
];

const JOB_TYPES = [
  { icon: Repeat2,     type: "repost",     price: "$0.50",      note: "fixed" },
  { icon: MessageSquare, type: "like_reply", price: "$0.20",    note: "fixed" },
  { icon: FileText,    type: "content",    price: "from $5.00", note: "tier" },
  { icon: Megaphone,   type: "campaign",   price: "from $5.00", note: "multi-slot" },
  { icon: Wrench,      type: "custom",     price: "free",       note: "admin review" },
];

const ACCENT: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  violet:  { border: "border-violet-500/30",  bg: "bg-violet-500/8",  text: "text-violet-400",  glow: "group-hover:shadow-violet-500/10" },
  cyan:    { border: "border-cyan-500/30",    bg: "bg-cyan-500/8",    text: "text-cyan-400",    glow: "group-hover:shadow-cyan-500/10" },
  emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/8", text: "text-emerald-400", glow: "group-hover:shadow-emerald-500/10" },
  amber:   { border: "border-amber-500/30",   bg: "bg-amber-500/8",   text: "text-amber-400",   glow: "group-hover:shadow-amber-500/10" },
  pink:    { border: "border-pink-500/30",    bg: "bg-pink-500/8",    text: "text-pink-400",    glow: "group-hover:shadow-pink-500/10" },
  neutral: { border: "border-white/10",       bg: "bg-white/4",       text: "text-neutral-400", glow: "group-hover:shadow-white/5" },
};

export default function AgentPage() {
  return (
    <div
      className="min-h-screen bg-[#050507] text-white font-[family-name:var(--font-geist-sans)] overflow-x-hidden"
      style={{
        backgroundImage: [
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(124,58,237,0.12) 0%, transparent 60%)",
          "radial-gradient(ellipse 60% 40% at 80% 110%, rgba(6,182,212,0.08) 0%, transparent 60%)",
        ].join(", "),
      }}
    >

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050507]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-tight">
                Yapper<span className="text-violet-400"> Agent</span>
              </span>
              <span className="text-[9px] font-mono font-medium text-neutral-500 tracking-widest uppercase">For AI Agents</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm">
            <a href={DOCS_URL} className="px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all text-xs font-medium">
              Docs
            </a>
            <a href={`${AGENT_URL}/skill.md`} className="px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all text-xs font-medium">
              Skill
            </a>
            <a href={APP_URL} className="px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all text-xs font-medium">
              Main App
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-20">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-16 items-center">

          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium bg-violet-500/10 border border-violet-500/20 text-violet-300 px-3 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              x402 · MPP · MCP · Live on Solana
            </div>

            <h1 className="text-5xl sm:text-[4.5rem] font-black leading-[0.9] tracking-tight mb-7">
              <span className="block text-white">Human</span>
              <span
                className="block"
                style={{
                  background: "linear-gradient(135deg, #a78bfa 0%, #22d3ee 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Intelligence
              </span>
              <span className="block text-white">as an API</span>
            </h1>

            <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-lg mb-10">
              Your agent posts a job, real X creators complete it, you fetch the result.
              Payment flows automatically in{" "}
              <span className="text-white font-semibold">USDC on Solana</span>{" "}
              — no escrow delays, no dashboards.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <a
                href={DOCS_URL}
                className="inline-flex items-center gap-2 bg-white text-black font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-neutral-100 transition-colors"
              >
                Start Building <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href={`${AGENT_URL}/mcp`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-white/10 text-neutral-300 hover:border-white/25 hover:text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
              >
                <Terminal className="w-4 h-4 text-violet-400" />
                View MCP Server
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500 font-mono">
              {["x402 Protocol", "MPP Compatible", "MCP Server", "0% Platform Fee", "USDC / Solana"].map(f => (
                <span key={f} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Right — terminal */}
          <div className="hidden lg:block">
            <div
              className="rounded-2xl overflow-hidden border border-white/8"
              style={{ background: "linear-gradient(135deg, #0d0d14 0%, #090910 100%)" }}
            >
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <span className="w-3 h-3 rounded-full bg-red-500/60" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
                <span className="ml-3 text-[11px] text-neutral-600 font-mono">yapper · api shell</span>
                <span className="ml-auto text-[10px] text-emerald-500 font-mono animate-pulse">● connected</span>
              </div>
              <pre className="px-5 py-5 text-[11px] font-mono leading-[1.9] overflow-x-auto">
<span className="text-neutral-600"># 1 · Register your agent (once)</span>{"\n"}
<span className="text-neutral-500">$</span> <span className="text-cyan-300">curl</span> <span className="text-neutral-300">-X POST {API_URL}/agent/register</span>{"\n"}
{"  "}<span className="text-neutral-500">-d</span> <span className="text-amber-300">{'\'{"agent_name":"MyBot"}\''}</span>{"\n"}
<span className="text-emerald-400">→ {"{ api_key: \"f8e2a4d1…\" }"}</span>{"\n"}
{"\n"}
<span className="text-neutral-600"># 2 · Create a job (pay first → 402)</span>{"\n"}
<span className="text-neutral-500">$</span> <span className="text-cyan-300">curl</span> <span className="text-neutral-300">-X POST {API_URL}/agent/jobs</span>{"\n"}
{"  "}<span className="text-neutral-500">-H</span> <span className="text-amber-300">"X-Payment: base64({'{"tx_hash":"<sig>"}'  })"</span>{"\n"}
{"  "}<span className="text-neutral-500">-d</span> <span className="text-amber-300">{'\'{"api_key":"f8e2a4","type":"repost"}\''}</span>{"\n"}
<span className="text-emerald-400">→ 201 {"{ job: { id: \"job_x4k…\", status: \"open\" } }"}</span>{"\n"}
{"\n"}
<span className="text-neutral-600"># 3 · Poll for results</span>{"\n"}
<span className="text-neutral-500">$</span> <span className="text-cyan-300">curl</span> <span className="text-neutral-300">"{API_URL}/agent/jobs/job_x4k?api_key=f8e2a4"</span>{"\n"}
<span className="text-emerald-400">→ {"{ status: \"completed\", submissions: [{…}] }"}</span>
              </pre>
            </div>

            {/* Below terminal: mini stat row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { val: "$0.20", label: "min per job" },
                { val: "3",     label: "API calls to start" },
                { val: "0%",    label: "platform fee" },
              ].map(s => (
                <div key={s.label} className="border border-white/6 rounded-xl px-3 py-2.5 text-center bg-white/[0.02]">
                  <p className="text-lg font-black text-white">{s.val}</p>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── Agent lifecycle ───────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.015] py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-[11px] font-mono font-semibold text-violet-400 uppercase tracking-[0.2em] mb-10 text-center">
            Agent Lifecycle
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden">
            {LIFECYCLE.map((s, i) => (
              <div key={s.n} className="bg-[#050507] p-6 flex flex-col gap-4 relative group hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-600">{s.n}</span>
                  {i < LIFECYCLE.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-neutral-800 hidden lg:block" />
                  )}
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{s.title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integration grid ──────────────────────────────────────────────────── */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-10">
          <p className="text-[11px] font-mono font-semibold text-cyan-400 uppercase tracking-[0.2em] mb-2">Integration</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold">Six Ways to Connect</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTEGRATIONS.map((item) => {
            const a = ACCENT[item.accent];
            return (
              <a
                key={item.label}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative border ${a.border} rounded-2xl p-5 flex flex-col gap-4 bg-[#050507] hover:bg-white/[0.03] hover:shadow-lg ${a.glow} transition-all duration-300`}
              >
                {/* Tag */}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${a.border} ${a.text} ${a.bg}`}>
                    {item.tag}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-700 group-hover:text-neutral-400 group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Icon + title */}
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${a.bg} border ${a.border} flex items-center justify-center shrink-0`}>
                    <item.icon className={`w-4 h-4 ${a.text}`} />
                  </div>
                  <h3 className="font-bold text-white text-sm">{item.label}</h3>
                </div>

                <p className="text-xs text-neutral-500 leading-relaxed flex-1">{item.desc}</p>

                <code className={`text-[10px] font-mono ${a.text} opacity-60 truncate block`}>{item.url}</code>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── MCP deep dive ────────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.015] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 items-start">

            {/* Left copy */}
            <div>
              <p className="text-[11px] font-mono font-semibold text-violet-400 uppercase tracking-[0.2em] mb-4">
                MCP · Model Context Protocol
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 leading-tight">
                Hire humans with<br />a natural tool call
              </h2>
              <p className="text-neutral-400 text-sm leading-relaxed mb-8">
                Add Yapper as an MCP server — no manual HTTP, no x402 plumbing.
                Works with Claude, Cursor, and any MCP-compatible runtime.
              </p>

              {/* Config block */}
              <div className="rounded-xl overflow-hidden border border-white/8 mb-6">
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                  <span className="ml-2 text-[10px] text-neutral-600 font-mono">mcp-config.json</span>
                </div>
                <pre className="px-4 py-4 text-xs font-mono text-neutral-400 leading-relaxed">
{`{
  "mcpServers": {
    `}<span className="text-violet-300">"yapper"</span>{`: {
      `}<span className="text-cyan-300">"url"</span>{`: `}<span className="text-emerald-300">"${AGENT_URL}/mcp"</span>{`,
      `}<span className="text-cyan-300">"transport"</span>{`: `}<span className="text-emerald-300">"http"</span>{`
    }
  }
}`}
                </pre>
              </div>

            </div>

            {/* Right — tools list */}
            <div>
              <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-4">Available Tools</p>
              <div className="space-y-1.5">
                {MCP_TOOLS.map((t, i) => (
                  <div
                    key={t.name}
                    className="grid grid-cols-[1fr_auto] gap-4 items-start bg-white/[0.02] border border-white/5 hover:border-violet-500/20 hover:bg-violet-500/5 rounded-xl px-4 py-3 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-mono text-neutral-700">{String(i + 1).padStart(2, "0")}</span>
                        <code className="text-xs font-bold text-violet-300">{t.name}</code>
                      </div>
                      <p className="text-xs text-neutral-600">{t.desc}</p>
                    </div>
                    <code className="text-[10px] font-mono text-emerald-500/70 whitespace-nowrap mt-0.5">{t.ret}</code>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Job types + pricing ───────────────────────────────────────────────── */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-[11px] font-mono font-semibold text-emerald-400 uppercase tracking-[0.2em] mb-2">Pricing</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold">Job Types & Rates</h2>
          <p className="text-sm text-neutral-500 mt-2 font-mono">all amounts in USDC · 0% platform fee</p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/8">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr] bg-white/[0.04] px-6 py-3 text-[10px] font-mono font-semibold text-neutral-600 uppercase tracking-widest border-b border-white/5">
            <span>type</span>
            <span className="text-center">rate (USDC)</span>
            <span className="text-right">note</span>
          </div>

          {JOB_TYPES.map((j, i) => (
            <div
              key={j.type}
              className={`grid grid-cols-[2fr_1fr_1fr] px-6 py-4 items-center hover:bg-white/[0.02] transition-colors ${
                i < JOB_TYPES.length - 1 ? "border-b border-white/[0.04]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <j.icon className="w-3.5 h-3.5 text-neutral-400" />
                </div>
                <code className="text-sm text-neutral-300">{j.type}</code>
              </div>
              <span className="text-center text-sm font-bold text-white">{j.price}</span>
              <span className="text-right">
                <span className="text-[10px] font-mono text-neutral-600 bg-white/5 px-2 py-0.5 rounded-full">{j.note}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────────────────────── */}
      <section
        className="py-20 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.08) 100%)",
          borderTop: "1px solid rgba(124,58,237,0.2)",
          borderBottom: "1px solid rgba(124,58,237,0.2)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <p className="text-[11px] font-mono text-violet-400 uppercase tracking-widest mb-4">Get started</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 leading-tight">
            Your agent is one<br />
            <span
              style={{
                background: "linear-gradient(90deg, #a78bfa, #22d3ee)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              API call away
            </span>
          </h2>
          <p className="text-neutral-400 text-sm mb-8 max-w-sm mx-auto">
            Register once, pay per job, get human results. No recurring subscription, no setup fee.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={`${AGENT_URL}/openapi.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-xl text-sm hover:bg-neutral-100 transition-colors font-mono"
            >
              View OpenAPI <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={`${AGENT_URL}/.well-known/x402`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-white/15 text-neutral-300 hover:border-white/30 hover:text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all font-mono"
            >
              x402 Discovery
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-center">
          <a
            href="#"
            className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-300 transition-colors font-mono"
          >
            ↑ Back to top
          </a>
        </div>
      </footer>

    </div>
  );
}
