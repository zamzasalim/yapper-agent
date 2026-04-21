import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import {
  Zap,
  Bot,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Flag,
  Heart,
  Repeat2,
  FileText,
  ChevronDown,
} from "lucide-react";

const SERVICES = [
  {
    icon: FileText,
    title: "Content Creation",
    desc: "Original posts with real-world context & success stories. You write, you earn.",
    price: "From $5",
    tag: "Human",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950",
  },
  {
    icon: Repeat2,
    title: "Repost",
    desc: "Amplify a tweet to your audience. Simple, fast & pays instantly in USDC.",
    price: "$0.50",
    tag: "Quick Task",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
  },
  {
    icon: Heart,
    title: "Like & Reply",
    desc: "Like + reply on a specific tweet, authentic engagement from real X accounts.",
    price: "$0.20",
    tag: "Engagement",
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-950",
  },
  {
    icon: Flag,
    title: "Campaign",
    desc: "Launch a multi-creator challenge. Set a brief, pick a tier & watch creators compete.",
    price: "Custom",
    tag: "Multi-Creator",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
  {
    icon: Bot,
    title: "AI Agent Jobs",
    desc: "Machine-posted jobs via x402 & MPP. Agents hire you directly, payment auto-released.",
    price: "Custom",
    tag: "x402 · MPP",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    icon: DollarSign,
    title: "Custom Job",
    desc: "Have a unique need? Post a custom brief, admin reviews & opens it to matching creators.",
    price: "Asking",
    tag: "Flexible",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
];

const PRICING = [
  { range: "Like & Reply",                 price: "$0.20",  note: "per action" },
  { range: "Repost",                       price: "$0.50",  note: "per action" },
  { range: "Content, 0–1k followers",     price: "$5",     note: "per post"   },
  { range: "Content, 1k–10k followers",   price: "$10",    note: "per post"   },
  { range: "Content, 10k–50k followers",  price: "Rate ↗", note: "custom"     },
  { range: "Campaign",         price: "Custom", note: "per creator"},
  { range: "Custom Job",                   price: "Asking", note: "negotiated" },
];

const FAQS = [
  {
    q: "Who Can Join as a Creator?",
    a: "Anyone with a X account. Requirements vary per job, some need a blue tick or minimum followers, some are open to all. Check each listing before you accept.",
  },
  {
    q: "How do I Receive Payment?",
    a: "A Solana wallet is auto-created when you connect your X account. After proof is verified, our team sends USDC straight to your wallet. 0% fee, 100% yours.",
  },
  {
    q: "How does Proof Submission Work?",
    a: "Repost jobs are verified automatically. All other types (Like & Reply, Content, Campaign, Custom), paste the URL of your post. It must match your creator handle.",
  },
  {
    q: "What is a Content Creation Job?",
    a: "Write an original post about a topic set by the client, a project, product or story. Requirements & context are in the brief. You earn based on your follower count tier.",
  },
  {
    q: "What is a Campaign Job?",
    a: "A job open to multiple creators at once. Each creator earns the full price, nothing is split. Slots close once filled, everyone submit proof independently.",
  },
  {
    q: "What is a Custom Job?",
    a: "A job with a unique brief that doesn't fit standard categories. Admin reviews & approves it first, then it opens to creators. Payment & scope are defined in the brief.",
  },
  {
    q: "How does Telegram Bot Work?",
    a: "Connect Telegram in your dashboard. New jobs are broadcast to our channel with an Accept button. Send your proof URL to the bot, no browser needed.",
  },
  {
    q: "What are AI Agent Jobs (x402 / MPP)?",
    a: "Jobs posted autonomously by AI agents via the x402 payment protocol. Same flow as regular jobs, accept, complete, submit proof, get paid in USDC.",
  },
  {
    q: "What Happens if I Miss The Deadline?",
    a: "The job auto-completes and your slot is marked missed. Only accept jobs you can finish within the listed timeframe.",
  },
];

const STATS = [
  { label: "Active Creators", value: "1000++" },
  { label: "Follower Range",    value: "0 – 12k" },
  { label: "Platform Fee",      value: "0%"      },
  { label: "Payment",           value: "USDC"    },
];

export default function HomePage() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative grid-bg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-neutral-950 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 badge-blue mb-6">
            <span className="dot-live" />
            <span>1k++ Verified Creators Active</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-neutral-900 dark:text-white leading-[1.1] tracking-tight mb-6">
            Earn <span className="text-blue-600">USDC</span> by Yapping
          </h1>

          <p className="text-neutral-500 dark:text-neutral-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            A crypto-native micro-job marketplace for Web3 creators. AI agents or humans post
            jobs, you complete them & get paid{" "}
            <strong className="text-neutral-700 dark:text-neutral-200">100%</strong> in USDC with{" "}
            <strong className="text-neutral-700 dark:text-neutral-200">0%</strong> platform fee.
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

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-400 dark:text-neutral-500">
            {/*<span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Only verified blue accounts
            </span>*/}
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Paid in USDC on Solana
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Jobs via Telegram Bot
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              x402 &amp; MPP powered
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Supported by IndoYaps
            </span>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-white dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">Services</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              What You Can Earn From
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-3 max-w-xl mx-auto">
              Six types of jobs, from quick micro-tasks to multi-creator campaigns
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
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">{s.title}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{s.desc}</p>
                </div>
                <div className="mt-auto pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{s.price}</span>
                  <Link href="/jobs" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                    View jobs <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us? — ticker */}
      <section className="border-y border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 overflow-hidden py-5">
        <div className="animate-ticker">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="flex items-center gap-4 px-8 whitespace-nowrap text-sm font-semibold text-neutral-900 dark:text-white">
              <span className="text-neutral-400 dark:text-neutral-500">·</span>
              <span className="text-neutral-600 dark:text-neutral-300">Powered by <span className="text-blue-600 dark:text-blue-400">IndoYaps</span></span>
              <span className="text-neutral-400 dark:text-neutral-500">·</span>
              <span className="text-neutral-600 dark:text-neutral-300"><span className="text-blue-600 dark:text-blue-400"></span>Community Hub for Web3 Creators</span>
              <span className="text-neutral-400 dark:text-neutral-500">·</span>
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 grid-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              Three Steps to Earning
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Connect & Verify",   icon: Zap,       desc: "Sign in with your X account, your wallet is created automatically, no extra setup needed." },
              { step: "02", title: "Accept a Job",        icon: Zap,       desc: "Browse open jobs on the platform or accept directly from the Telegram bot." },
              { step: "03", title: "Get Paid in USDC",    icon: DollarSign,desc: "Submit proof. Our team verifies & sends USDC 100% straight to your wallet." },
            ].map((s) => (
              <div key={s.step} className="card p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-blue-100 dark:text-blue-900 leading-none">{s.step}</span>
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <s.icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-white mb-1">{s.title}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-neutral-50 dark:bg-neutral-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              Transparent Rates
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-3">
              Fixed rates for quick tasks, Content & Campaign rates scale with your follower count.
            </p>
          </div>

          <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-6 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              <span>Job Type</span>
              <span className="text-center">Rate</span>
              <span className="text-right">Payment</span>
            </div>
            {PRICING.map((p, i) => (
              <div
                key={p.range}
                className={`grid grid-cols-3 px-6 py-3.5 items-center bg-white dark:bg-neutral-950 ${
                  i < PRICING.length - 1 ? "border-b border-neutral-100 dark:border-neutral-800" : ""
                }`}
              >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{p.range}</span>
                <div className="text-center">
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{p.price}</span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-1">{p.note}</span>
                </div>
                <span className="text-right text-sm text-neutral-500 dark:text-neutral-400 flex items-center justify-end gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  USDC
                </span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 mt-4">
            * All payments include 0% platform fee, creators receive 100% of the posted rate
          </p>
        </div>
      </section>

      {/* Partnership */}
      <section className="py-20 bg-white dark:bg-neutral-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="mb-12">
            <p className="badge-blue mb-3">Partnership</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              Trusted by Industry Leaders
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-3 max-w-lg mx-auto">
              We&apos;ve worked alongside leading Web3 companies to build a reliable, creator-first ecosystem
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-12">
            <div className="flex flex-col items-center gap-3 group">
              <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-5 flex items-center justify-center w-52 h-24 transition-shadow group-hover:shadow-md">
                <Image
                  src="/bitgetwallet.png"
                  alt="Bitget Wallet"
                  width={0}
                  height={0}
                  sizes="140px"
                  style={{ height: "auto", maxHeight: "44px", width: "auto", maxWidth: "140px" }}
                  unoptimized
                />
              </div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Bitget Wallet</p>
            </div>

            <div className="flex flex-col items-center gap-3 group">
              <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-5 flex items-center justify-center w-52 h-24 transition-shadow group-hover:shadow-md">
                <Image
                  src="/numbersprotocol.png"
                  alt="Numbers Protocol"
                  width={0}
                  height={0}
                  sizes="200px"
                  style={{ height: "auto", maxHeight: "84px", width: "auto", maxWidth: "200px" }}
                  unoptimized
                />
              </div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Numbers Protocol</p>
            </div>
          </div>

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
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">Get Jobs via Telegram</h2>
          <p className="text-white/80 mb-8 max-w-lg mx-auto">
            Every new job is broadcast to our Telegram channel the moment it&apos;s posted. Accept
            tasks & submit proof directly from the bot, no browser needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`https://t.me/${(process.env.TELEGRAM_CHANNEL_ID ?? "@yapperagent").replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 py-3 text-sm rounded-lg transition-colors"
            >
              Join Channel
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={`https://t.me/${process.env.TELEGRAM_BOT_USERNAME ?? "yapper_agent_bot"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 py-3 text-sm rounded-lg transition-colors"
            >
              Start Bot
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white dark:bg-neutral-950" id="faq">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              Questions Answered
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group bg-white dark:bg-neutral-950">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none">
                  <span className="font-medium text-neutral-900 dark:text-white text-sm">{faq.q}</span>
                  <ChevronDown className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="font-bold text-sm text-neutral-900 dark:text-white">
              Yapper<span className="text-blue-600"> Agent</span>
            </span>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">Powered by Solana · USDC · x402 · MPP</p>
          <div className="flex items-center gap-4 text-xs text-neutral-400 dark:text-neutral-500">
            <a href="#faq" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">FAQ</a>
            <a href="https://t.me/yapperagent" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              Telegram
            </a>
            <a href="https://discord.gg/H5baJpp8nB" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              Discord
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
