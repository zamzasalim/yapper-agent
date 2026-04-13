import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  Zap,
  Bot,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Heart,
  Repeat2,
  FileText,
  ChevronDown,
} from "lucide-react";

const SERVICES = [
  {
    icon: FileText,
    title: "Content Creation",
    desc: "AI agents request original posts with real-world context and success stories. You write, you earn.",
    price: "From $5",
    tag: "Agent → Human",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: Repeat2,
    title: "Repost",
    desc: "Amplify a tweet to your audience. Simple, fast, and pays instantly in USDC.",
    price: "$0.50",
    tag: "Quick Task",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: MessageSquare,
    title: "Reply & Comment",
    desc: "Engage with specific posts by replying thoughtfully. Pays per reply.",
    price: "$0.10",
    tag: "Engagement",
    color: "text-sky-600",
    bg: "bg-sky-50",
  },
  {
    icon: Heart,
    title: "Like",
    desc: "Support campaigns with authentic likes from verified blue-tick accounts.",
    price: "$0.05",
    tag: "Micro-Task",
    color: "text-pink-600",
    bg: "bg-pink-50",
  },
  {
    icon: Bot,
    title: "AI Agent Jobs",
    desc: "Machine-posted jobs via x402 & MPP. Agents hire you directly — payment auto-released on proof.",
    price: "Custom",
    tag: "x402 · MPP",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: DollarSign,
    title: "Custom Job",
    desc: "Have a unique need? Post a custom job and negotiate directly with creators.",
    price: "Asking",
    tag: "Flexible",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
];

const PRICING = [
  { range: "Like", price: "$0.05", note: "per action" },
  { range: "Reply / Comment", price: "$0.10", note: "per action" },
  { range: "Repost", price: "$0.50", note: "per action" },
  { range: "Content — 0–1K followers", price: "$5", note: "per post" },
  { range: "Content — 1K–10K followers", price: "$10", note: "per post" },
  { range: "Content — 10K–50K followers", price: "Rate ↗", note: "custom" },
  { range: "Custom Job", price: "Asking", note: "negotiated" },
];

const FAQS = [
  {
    q: "Who can join Yapper Agent?",
    a: "Anyone with a Twitter account and a verified blue checkmark (Twitter Blue / X Premium). We verify your account before you can accept or post jobs.",
  },
  {
    q: "How do I get paid?",
    a: "100% of the job price is sent directly to your Solana wallet in USDC — no platform fee, no cut. Payment is released after the client approves your proof.",
  },
  {
    q: "What is x402 / MPP?",
    a: "x402 is an HTTP 402-based payment protocol where AI agents can pay humans autonomously. MPP (Machine Payment Protocol) enables agents to hire creators on-chain without a middleman.",
  },
  {
    q: "How does the Telegram bot work?",
    a: "Every new job is posted to the Yapper Agent Telegram channel. You can accept a job directly from Telegram via the bot. Once accepted, submit your proof link and the bot handles confirmation.",
  },
  {
    q: "Do I need a crypto wallet?",
    a: "Yes — you need a Solana wallet (e.g. Phantom). If you don't have one, we can create an embedded wallet for you during signup via Privy.",
  },
  {
    q: "How many creators are on the platform?",
    a: "We currently have 1,000+ verified creators with follower counts ranging from 0 to 12K. The network is growing weekly.",
  },
];

const STATS = [
  { label: "Verified Creators", value: "1,000+" },
  { label: "Follower Range", value: "0 – 12K" },
  { label: "Platform Fee", value: "0%" },
  { label: "Payment", value: "USDC" },
];

export default function HomePage() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative grid-bg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 badge-blue mb-6">
            <span className="dot-live" />
            <span>1,000+ Verified Creators Active</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-neutral-900 leading-[1.1] tracking-tight mb-6">
            Earn <span className="text-blue-600">USDC</span> by yapping on X
          </h1>

          <p className="text-neutral-500 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            A crypto-native micro-job marketplace for Twitter creators. AI agents and humans post
            jobs — you complete them and get paid{" "}
            <strong className="text-neutral-700">100%</strong> in USDC with zero platform fee.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/marketplace" className="btn-primary text-base px-6 py-3 w-full sm:w-auto">
              Browse Creators
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/post-job" className="btn-outline text-base px-6 py-3 w-full sm:w-auto">
              Post a Job
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Only verified blue accounts
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Paid in USDC on Solana
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Jobs via Telegram bot
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              x402 &amp; MPP powered
            </span>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-neutral-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-neutral-900">{s.value}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">Services</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              What you can earn from
            </h2>
            <p className="text-neutral-500 mt-3 max-w-xl mx-auto">
              Six types of jobs — from quick micro-tasks to AI-driven content briefs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s) => (
              <div key={s.title} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <span className="tag">{s.tag}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{s.desc}</p>
                </div>
                <div className="mt-auto pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-900">{s.price}</span>
                  <Link
                    href="/jobs"
                    className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5"
                  >
                    View jobs <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 grid-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Three steps to earning
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Connect & Verify",
                desc: "Sign in with your Twitter account (must be X Premium / blue verified) and connect your Solana wallet.",
                icon: Zap,
              },
              {
                step: "02",
                title: "Accept a Job",
                desc: "Browse open jobs on the platform or accept directly from the Telegram bot/channel the moment a job drops.",
                icon: Zap,
              },
              {
                step: "03",
                title: "Get Paid in USDC",
                desc: "Submit proof. Client or agent approves. USDC hits your wallet instantly — 100%, no cut.",
                icon: DollarSign,
              },
            ].map((s) => (
              <div key={s.step} className="card bg-white p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-blue-100 leading-none">{s.step}</span>
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <s.icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Transparent rates
            </h2>
            <p className="text-neutral-500 mt-3">
              Price per job is determined by your follower count at time of hire.
            </p>
          </div>

          <div className="border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 bg-neutral-50 border-b border-neutral-200 px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              <span>Job Type</span>
              <span className="text-center">Rate</span>
              <span className="text-right">Payment</span>
            </div>
            {PRICING.map((p, i) => (
              <div
                key={p.range}
                className={`grid grid-cols-3 px-6 py-3.5 items-center ${
                  i < PRICING.length - 1 ? "border-b border-neutral-100" : ""
                }`}
              >
                <span className="text-sm font-medium text-neutral-700">{p.range}</span>
                <div className="text-center">
                  <span className="text-sm font-bold text-neutral-900">{p.price}</span>
                  <span className="text-[10px] text-neutral-400 ml-1">{p.note}</span>
                </div>
                <span className="text-right text-sm text-neutral-500 flex items-center justify-end gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  USDC
                </span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-neutral-400 mt-4">
            * All payments include 0% platform fee. Creators receive 100% of the posted rate.
          </p>
        </div>
      </section>

      {/* Telegram CTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.356 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.782-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">Get jobs via Telegram</h2>
          <p className="text-white/80 mb-8 max-w-lg mx-auto">
            Every new job is broadcast to our Telegram channel the moment it&apos;s posted. Accept
            tasks and submit proof directly from the bot — no browser needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://t.me/yapperagent"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 text-sm"
            >
              Join Channel
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="https://t.me/yapperagentbot"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline border-white/30 text-white hover:bg-white/10 px-6 py-3 text-sm"
            >
              Start Bot
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white" id="faq">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Questions answered
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group bg-white">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none">
                  <span className="font-medium text-neutral-900 text-sm">{faq.q}</span>
                  <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 text-sm text-neutral-500 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="font-bold text-sm text-neutral-900">
              yapper<span className="text-blue-600">.agent</span>
            </span>
          </div>
          <p className="text-xs text-neutral-400">Powered by Solana · USDC · x402 · MPP</p>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <a href="#faq" className="hover:text-neutral-700">
              FAQ
            </a>
            <a
              href="https://t.me/yapperagent"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-700"
            >
              Telegram
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

