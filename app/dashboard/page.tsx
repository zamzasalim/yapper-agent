"use client";

import { Navbar } from "@/components/Navbar";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import {
  Wallet,
  CheckCircle2,
  Clock,
  TrendingUp,
  Zap,
  ArrowRight,
  Copy,
  ExternalLink,
} from "lucide-react";

// Mock data — replace with Supabase fetch
const MOCK_JOBS = [
  {
    id: "j1",
    type: "repost",
    title: "Repost our Solana launch announcement",
    price: 10,
    status: "completed",
    client: "solana_dao",
    date: "2025-04-11",
  },
  {
    id: "j2",
    type: "content",
    title: "Write a thread about DeFi yield strategies",
    price: 10,
    status: "in_progress",
    client: "defi_agent_01",
    date: "2025-04-12",
  },
  {
    id: "j3",
    type: "reply",
    title: "Reply to our product launch tweet",
    price: 5,
    status: "open",
    client: "web3startup",
    date: "2025-04-13",
  },
];

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  in_progress: "bg-blue-50 text-blue-700",
  open: "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-700",
};

export default function DashboardPage() {
  const { authenticated, login, user } = usePrivy();

  if (!authenticated) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center min-h-[60vh] grid-bg">
          <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center max-w-sm mx-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Connect to view dashboard</h2>
            <p className="text-sm text-neutral-500 mb-6">
              Sign in with your Twitter account to manage jobs and track earnings.
            </p>
            <button onClick={() => login()} className="btn-primary w-full">
              Connect Twitter
            </button>
          </div>
        </div>
      </>
    );
  }

  const twitterHandle =
    // @ts-ignore
    user?.twitter?.username ?? "creator";
  const walletAddress = user?.wallet?.address;
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "Not connected";

  const totalEarned = MOCK_JOBS.filter((j) => j.status === "completed").reduce(
    (acc, j) => acc + j.price,
    0
  );
  const completed = MOCK_JOBS.filter((j) => j.status === "completed").length;
  const active = MOCK_JOBS.filter((j) => j.status === "in_progress").length;

  return (
    <>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Profile header */}
        <div className="card p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {twitterHandle.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-bold text-neutral-900">@{twitterHandle}</h1>
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Wallet className="w-3.5 h-3.5" />
              <span>{shortWallet}</span>
              <button className="hover:text-neutral-700" title="Copy address">
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>

          <Link href="/post-job" className="btn-primary text-xs px-4 py-2.5 shrink-0">
            Post a Job <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Earned", value: `$${totalEarned} USDC`, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
            { label: "Jobs Completed", value: completed.toString(), icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Active Jobs", value: active.toString(), icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Platform Fee", value: "0%", icon: Zap, color: "text-violet-600", bg: "bg-violet-50" },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex flex-col gap-2">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-xl font-extrabold text-neutral-900">{s.value}</p>
              <p className="text-xs text-neutral-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Job history */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <h2 className="font-semibold text-neutral-900">Your Jobs</h2>
            <Link href="/jobs" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Browse open jobs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-neutral-100">
            {MOCK_JOBS.map((job) => (
              <div key={job.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{job.title}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Client: @{job.client} · {job.date}
                  </p>
                </div>

                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[job.status]}`}
                >
                  {job.status.replace("_", " ")}
                </span>

                <span className="text-sm font-bold text-neutral-900 shrink-0">
                  ${job.price}
                </span>

                <button className="text-neutral-400 hover:text-neutral-700 shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Telegram link */}
        <div className="mt-6 card p-5 flex items-center gap-4 bg-blue-50 border-blue-200">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.356 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.782-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">Connect your Telegram</p>
            <p className="text-xs text-blue-700">Get job alerts & accept tasks from the bot</p>
          </div>
          <a
            href="https://t.me/yapperagentbot?start=connect"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs px-4 py-2 bg-blue-600 shrink-0"
          >
            Connect
          </a>
        </div>
      </div>
    </>
  );
}
