"use client";

import { Navbar } from "@/components/Navbar";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  Wallet,
  CheckCircle2,
  Clock,
  TrendingUp,
  Zap,
  ArrowRight,
  Copy,
  ExternalLink,
  AlertCircle,
  Save,
  X,
} from "lucide-react";

const MOCK_JOBS = [
  { id: "j1", type: "repost", title: "Repost our Solana launch announcement", price: 0.5,  status: "completed",  client: "solana_dao",   date: "2025-04-11" },
  { id: "j2", type: "content", title: "Write a thread about DeFi yield strategies",  price: 10,   status: "in_progress", client: "defi_agent_01", date: "2025-04-12" },
  { id: "j3", type: "reply",   title: "Reply to our product launch tweet",           price: 0.1,  status: "open",        client: "web3startup",  date: "2025-04-13" },
];

const STATUS_STYLE: Record<string, string> = {
  completed:   "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400",
  in_progress: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  open:        "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  cancelled:   "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400",
};

function isValidSolanaAddress(addr: string): boolean {
  try {
    new PublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

export default function DashboardPage() {
  const { authenticated, login, user } = usePrivy();

  const [walletInput, setWalletInput]   = useState("");
  const [savedWallet, setSavedWallet]   = useState<string | null>(null);
  const [walletError, setWalletError]   = useState("");
  const [editingWallet, setEditingWallet] = useState(false);
  const [copied, setCopied]             = useState(false);

  const wallet = savedWallet;
  const shortWallet = wallet
    ? `${wallet.slice(0, 5)}...${wallet.slice(-4)}`
    : null;

  function handleSaveWallet() {
    const trimmed = walletInput.trim();
    if (!trimmed) { setWalletError("Please enter a wallet address."); return; }
    if (!isValidSolanaAddress(trimmed)) { setWalletError("Invalid Solana address."); return; }
    setSavedWallet(trimmed);
    setWalletInput("");
    setWalletError("");
    setEditingWallet(false);
    // TODO: save to Supabase — db.from("users").update({ wallet_address: trimmed })
  }

  function handleCopy() {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!authenticated) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center min-h-[60vh] grid-bg">
          <div className="card p-10 text-center max-w-sm mx-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-1)" }}>
              Connect to view dashboard
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-2)" }}>
              Sign in with your X account to manage jobs and track earnings.
            </p>
            <button onClick={() => login()} className="btn-primary w-full">
              Connect X
            </button>
          </div>
        </div>
      </>
    );
  }

  const twitterHandle = (user?.linkedAccounts ?? [])
    .find((a) => a.type === "twitter_oauth")
    // @ts-ignore
    ?.username ?? "creator";

  const totalEarned = MOCK_JOBS.filter((j) => j.status === "completed").reduce((a, j) => a + j.price, 0);
  const completed   = MOCK_JOBS.filter((j) => j.status === "completed").length;
  const active      = MOCK_JOBS.filter((j) => j.status === "in_progress").length;

  return (
    <>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Profile header ────────────────────────────────────────── */}
        <div className="card p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {twitterHandle.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold" style={{ color: "var(--text-1)" }}>
                @{twitterHandle}
              </h1>
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            </div>

            {/* Wallet status */}
            {wallet ? (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
                <Wallet className="w-3.5 h-3.5" />
                <span className="font-mono">{shortWallet}</span>
                <button onClick={handleCopy} title="Copy address" className="hover:text-blue-500 transition-colors">
                  <Copy className="w-3 h-3" />
                </button>
                {copied && <span className="text-green-500">Copied!</span>}
                <button
                  onClick={() => { setEditingWallet(true); setWalletInput(wallet); }}
                  className="text-blue-500 hover:underline"
                >
                  Edit
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Wallet not set — add below to receive payments
              </p>
            )}
          </div>

          <Link href="/post-job" className="btn-primary text-xs px-4 py-2.5 shrink-0">
            Post a Job <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ── Wallet input card ─────────────────────────────────────── */}
        {(!wallet || editingWallet) && (
          <div className="card p-5 mb-6 border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/20">
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-1)" }}>
              {editingWallet ? "Update Solana Wallet" : "Add Your Solana Wallet"}
            </h3>
            <p className="text-xs mb-3" style={{ color: "var(--text-2)" }}>
              Enter your Solana wallet address. All USDC earnings will be sent here (0% fee).
            </p>
            <div className="flex gap-2">
              <input
                className="input-field font-mono text-xs"
                placeholder="e.g. 7xKX...9mZD"
                value={walletInput}
                onChange={(e) => { setWalletInput(e.target.value); setWalletError(""); }}
              />
              <button onClick={handleSaveWallet} className="btn-primary text-xs px-4 shrink-0">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              {editingWallet && (
                <button onClick={() => { setEditingWallet(false); setWalletError(""); }} className="btn-outline text-xs px-3 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {walletError && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {walletError}
              </p>
            )}
          </div>
        )}

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Earned",    value: `$${totalEarned.toFixed(2)} USDC`, icon: TrendingUp,  color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
            { label: "Jobs Completed",  value: completed.toString(),               icon: CheckCircle2, color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-950"  },
            { label: "Active Jobs",     value: active.toString(),                  icon: Clock,        color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" },
            { label: "Platform Fee",    value: "0%",                               icon: Zap,          color: "text-violet-600",bg: "bg-violet-50 dark:bg-violet-950"},
          ].map((s) => (
            <div key={s.label} className="card p-4 flex flex-col gap-2">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-xl font-extrabold" style={{ color: "var(--text-1)" }}>{s.value}</p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Job history ───────────────────────────────────────────── */}
        <div className="card overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-semibold" style={{ color: "var(--text-1)" }}>Your Jobs</h2>
            <Link href="/jobs" className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
              Browse open jobs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}>
            {MOCK_JOBS.map((job) => (
              <div key={job.id} className="px-5 py-4 flex items-center gap-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>
                    {job.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                    @{job.client} · {job.date}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[job.status]}`}>
                  {job.status.replace("_", " ")}
                </span>
                <span className="text-sm font-bold shrink-0" style={{ color: "var(--text-1)" }}>
                  ${job.price < 1 ? job.price.toFixed(2) : job.price}
                </span>
                <button className="shrink-0" style={{ color: "var(--text-3)" }}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Telegram ──────────────────────────────────────────────── */}
        <div className="card p-5 flex items-center gap-4" style={{ background: "var(--brand-muted)", borderColor: "#93c5fd" }}>
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.356 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.782-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">Connect your Telegram</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">Get job alerts & accept tasks from the bot</p>
          </div>
          <a
            href="https://t.me/yapperagentbot?start=connect"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs px-4 py-2 shrink-0"
          >
            Connect
          </a>
        </div>
      </div>
    </>
  );
}
