"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
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
  TrendingUp,
  Award,
  Clock,
  Users,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const CHART_BARS = [
  { day: "Mon", pct: 38 },
  { day: "Tue", pct: 52 },
  { day: "Wed", pct: 65 },
  { day: "Thu", pct: 55 },
  { day: "Fri", pct: 72 },
  { day: "Sat", pct: 80 },
  { day: "Sun", pct: 100, highlight: true },
];

const TWEET_CARDS = [
  {
    handle: "ranimth07",
    name: "Ranim",
    statusId: "1947266104461504938",
    text: "Baru aja cair $8 USDC dari Yapper Agent! Content creation job gampang banget, langsung ke wallet Solana 🔥 #Web3 #YapperAgent",
    likes: 31,
    retweets: 14,
    time: "3h",
    color: "from-blue-400 to-violet-500",
  },
  {
    handle: "Starsfivejkt",
    name: "Stars Five",
    statusId: "2005910844744581540",
    text: "Finally a Web3 platform that actually pays! Just completed my first retweet job on @yapperagent and got USDC instantly 💰",
    likes: 18,
    retweets: 8,
    time: "5h",
    color: "from-pink-400 to-rose-500",
  },
  {
    handle: "bozzxyz",
    name: "Bozz",
    statusId: "2022153428999471157",
    text: "Yapper Agent is the real deal. No BS fees, instant USDC payout on Solana. Already did 5 jobs this week 🚀",
    likes: 45,
    retweets: 22,
    time: "1d",
    color: "from-emerald-400 to-teal-500",
  },
  {
    handle: "MunchMunc_21",
    name: "Munch Munc",
    statusId: "1948599261546860664",
    text: "Completed 3 jobs on @yapperagent today! Love how transparent everything is — progress bar, deadlines, auto-payment 🙌",
    likes: 27,
    retweets: 11,
    time: "2d",
    color: "from-amber-400 to-orange-500",
  },
  {
    handle: "Autosultan_team",
    name: "Autosultan",
    statusId: "1978485387015438680",
    text: "For creators looking to monetize in Web3 — @yapperagent is a no-brainer. 0% fee, USDC payment, and legit jobs 💎",
    likes: 52,
    retweets: 28,
    time: "4h",
    color: "from-violet-400 to-purple-600",
  },
];

function HeroCards() {
  const [secs, setSecs] = useState(23 * 3600 + 59 * 60 + 41);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(Math.floor(secs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm mx-auto lg:mx-0 lg:max-w-none">
      {/* Earnings card — slight left tilt */}
      <div className="card p-4 shadow-md -rotate-1 hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">Earnings This Week</span>
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <p className="text-lg font-extrabold text-neutral-900 dark:text-white mb-3">
          $134.2 <span className="text-xs font-normal text-neutral-400">USDC</span>
        </p>
        {/* Bars */}
        <div className="flex items-end gap-1 h-9">
          {CHART_BARS.map((b) => (
            <div
              key={b.day}
              className={`flex-1 rounded-t-sm ${b.highlight ? "bg-emerald-500" : "bg-emerald-200 dark:bg-emerald-800/60"}`}
              style={{ height: `${b.pct}%` }}
            />
          ))}
        </div>
        {/* Labels */}
        <div className="flex gap-1 mt-1">
          {CHART_BARS.map((b) => (
            <span key={b.day} className="flex-1 text-center text-[8px] text-neutral-400">{b.day}</span>
          ))}
        </div>
      </div>

      {/* Retweet card — slight right tilt */}
      <div className="card p-4 shadow-md rotate-2 hover:rotate-0 transition-transform duration-300 translate-x-2">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
            <Repeat2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">Retweet</span>
          <span className="text-[10px] text-neutral-400">2m ago</span>
          <span className="ml-auto text-[10px] text-neutral-400">13 / 20 filled</span>
        </div>
        <p className="font-semibold text-sm text-neutral-900 dark:text-white mb-3 leading-snug">
          Retweet Token Launch Announcement
        </p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-neutral-900 dark:text-white">$0.50</span>
        </div>
        <div className="w-full h-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: "65%" }} />
        </div>
      </div>

      {/* Giveaway card — slight left tilt */}
      <div className="card p-4 shadow-md -rotate-1 hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center shrink-0">
            <Award className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded">Giveaway</span>
          <span className="text-[10px] text-neutral-400">just now</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-neutral-400">
            <Users className="w-3 h-3" />10 winners
          </span>
        </div>
        <p className="font-semibold text-sm text-neutral-900 dark:text-white mb-1 leading-snug">
          Giveaway 50 USDC for 10 Lucky Winners
        </p>
        <p className="text-sm font-bold text-neutral-900 dark:text-white mb-2">$50</p>
        <div className="w-full h-1.5 bg-violet-100 dark:bg-violet-900/40 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: "33%" }} />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Closes in</span>
          <span className="font-mono font-bold text-violet-500">{hh}</span>
          <span className="text-violet-400">:</span>
          <span className="font-mono font-bold text-violet-500">{mm}</span>
          <span className="text-violet-400">:</span>
          <span className="font-mono font-bold text-violet-500">{ss}</span>
          <span className="ml-auto text-neutral-400">max 24h</span>
        </div>
      </div>
    </div>
  );
}

const SERVICE_VISUALS = [
  { icon: FileText, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950" },
  { icon: Repeat2,  color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950"   },
  { icon: Heart,    color: "text-pink-600",   bg: "bg-pink-50 dark:bg-pink-950"   },
  { icon: Flag,     color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950" },
  { icon: Bot,      color: "text-emerald-600",bg: "bg-emerald-50 dark:bg-emerald-950" },
  { icon: DollarSign,color:"text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950" },
];

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative grid-bg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-neutral-950 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 sm:pt-18 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12 items-center">

            {/* Left: text — 2/3 */}
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 badge-blue mb-6">
                <span className="dot-live" />
                <span>{t.hero.badge}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-neutral-900 dark:text-white leading-[1.1] tracking-tight mb-6">
                {t.hero.pre}<span className="text-blue-600">{t.hero.blue}</span>{t.hero.post}
              </h1>

              <p className="text-neutral-500 dark:text-neutral-400 text-lg max-w-xl mb-10 leading-relaxed">
                {t.hero.subtitle}{" "}
                <strong className="text-neutral-700 dark:text-neutral-200">{t.hero.subtitleBold1}</strong>
                {t.hero.subtitleMid}
                <strong className="text-neutral-700 dark:text-neutral-200">{t.hero.subtitleBold2}</strong>
                {t.hero.subtitleEnd}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link href="/marketplace" className="btn-primary text-base px-6 py-3 w-full sm:w-auto text-center">
                  {t.hero.browseCreators}
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-5 text-sm text-neutral-400 dark:text-neutral-500">
                {t.hero.features.map((f) => (
                  <span key={f} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: preview cards */}
            <HeroCards />
          </div>
        </div>
      </section>

      {/* Tweet Testimonials Marquee */}
      <section className="border-y border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden py-5">
        <div
          className="flex w-max"
          style={{ animation: "ticker-ltr 40s linear infinite", willChange: "transform" }}
        >
          {[...TWEET_CARDS, ...TWEET_CARDS].map((tw, i) => (
            <a
              key={i}
              href={`https://x.com/${tw.handle}/status/${tw.statusId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-3 w-64 shrink-0 card p-3.5 flex flex-col gap-2 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${tw.color} flex items-center justify-center shrink-0 text-white font-bold text-xs`}>
                    {tw.handle.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-neutral-900 dark:text-white leading-none">{tw.name}</p>
                    <p className="text-[10px] text-neutral-400">@{tw.handle}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed line-clamp-3">{tw.text}</p>
              <div className="flex items-center gap-3 text-[10px] text-neutral-400 dark:text-neutral-500 mt-auto">
                <span>♥ {tw.likes}</span>
                <span>↩ {tw.retweets}</span>
                <span className="ml-auto">{tw.time}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-white dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">{t.services.badge}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              {t.services.title}
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-3 max-w-xl mx-auto">
              {t.services.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.serviceItems.map((s, i) => {
              const v = SERVICE_VISUALS[i];
              return (
                <div key={s.title} className="card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl ${v.bg} flex items-center justify-center`}>
                      <v.icon className={`w-5 h-5 ${v.color}`} />
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
                      {t.services.viewJobs} <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ticker */}
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
            <p className="badge-blue mb-3">{t.howItWorks.badge}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              {t.howItWorks.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {t.howItWorks.steps.map((s, i) => (
              <div key={s.step} className="card p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-blue-100 dark:text-blue-900 leading-none">{s.step}</span>
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    {i === 2 ? <DollarSign className="w-4 h-4 text-white" /> : <Zap className="w-4 h-4 text-white" />}
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

      {/* Partnership */}
      <section className="py-20 bg-white dark:bg-neutral-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="mb-12">
            <p className="badge-blue mb-3">{t.partnership.badge}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              {t.partnership.title}
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-3 max-w-lg mx-auto">
              {t.partnership.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-12">
            <div className="flex flex-col items-center gap-3 group">
              <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-5 flex items-center justify-center w-52 h-24 transition-shadow group-hover:shadow-md">
                <Image src="/bitgetwallet.png" alt="Bitget Wallet" width={0} height={0} sizes="140px"
                  style={{ height: "auto", maxHeight: "44px", width: "auto", maxWidth: "140px" }} unoptimized />
              </div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Bitget Wallet</p>
            </div>
            <div className="flex flex-col items-center gap-3 group">
              <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-5 flex items-center justify-center w-52 h-24 transition-shadow group-hover:shadow-md">
                <Image src="/numbersprotocol.png" alt="Numbers Protocol" width={0} height={0} sizes="200px"
                  style={{ height: "auto", maxHeight: "84px", width: "auto", maxWidth: "200px" }} unoptimized />
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
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">{t.telegram.title}</h2>
          <p className="text-white/80 mb-8 max-w-lg mx-auto">{t.telegram.subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://t.me/yapperagent"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 py-3 text-sm rounded-lg transition-colors"
            >
              {t.telegram.joinChannel}
            </a>
            <a
              href="https://t.me/yapper_agent_bot"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 py-3 text-sm rounded-lg transition-colors"
            >
              {t.telegram.startBot}
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white dark:bg-neutral-950" id="faq">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="badge-blue mb-3">{t.faq.badge}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              {t.faq.title}
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            {t.faq.items.map((faq) => (
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Yapper Agent" className="w-6 h-6" />
            <span className="font-bold text-sm text-neutral-900 dark:text-white">
              Yapper<span className="text-blue-600"> Agent</span>
            </span>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">Solana · USDC · x402 · MPP</p>
          <div className="flex items-center gap-4 text-neutral-400 dark:text-neutral-500">
            <a href="mailto:contact@yapperagent.xyz" aria-label="Email" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </a>
            <a href="https://x.com/yapperagent" target="_blank" rel="noopener noreferrer" aria-label="Twitter / X" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://t.me/yapperagent" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.356 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.782-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
            <a href="https://discord.gg/H5baJpp8nB" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
