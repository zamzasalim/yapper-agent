"use client";

import { Navbar } from "@/components/Navbar";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  Briefcase,
  Loader2,
  Star,
} from "lucide-react";

type JobStatus = "open" | "in_progress" | "completed" | "cancelled";

const ALL_NICHES = [
  "Crypto", "Web3", "DeFi", "NFT", "Airdrop", "Trading", "Blockchain", "GameFi",
  "Gaming", "Tech", "AI", "Developer", "Finance", "Business", "Marketing",
  "Art", "Music", "Sports", "Fitness", "Fashion", "Lifestyle", "Travel",
  "Food", "Education", "News", "Entertainment", "Politics", "Meme", "Content Creator",
];

interface UserRecord {
  id: string;
  wallet_address: string;
  twitter_handle: string;
  display_name: string;
  twitter_followers: number;
  is_verified_blue: boolean;
  total_earned_usdc: number;
  jobs_completed: number;
  rating: number;
  avatar_url: string | null;
  niches: string[] | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
}

interface JobRecord {
  id: string;
  created_at: string;
  type: string;
  title: string;
  price_usdc: number;
  status: JobStatus;
}

interface ClientJobRecord {
  id: string;
  created_at: string;
  type: string;
  title: string;
  price_usdc: number;
  status: JobStatus;
  creator_id: string | null;
  rating: number | null;
}

const STATUS_STYLE: Record<string, string> = {
  completed:   "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400",
  in_progress: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  open:        "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  cancelled:   "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400",
};

function isValidSolanaAddress(addr: string): boolean {
  try { new PublicKey(addr); return true; } catch { return false; }
}

export default function DashboardPage() {
  const { authenticated, login, logout, user } = usePrivy();

  const [profile, setProfile]           = useState<UserRecord | null>(null);
  const [jobs, setJobs]                 = useState<JobRecord[]>([]);
  const [clientJobs, setClientJobs]     = useState<ClientJobRecord[]>([]);
  const [loading, setLoading]           = useState(false);
  const [registering, setRegistering]   = useState(false);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [savingNiches, setSavingNiches]     = useState(false);
  const [nichesSaved, setNichesSaved]       = useState(false);
  const [editingNiches, setEditingNiches]   = useState(false);
  const [ratingJobId, setRatingJobId]   = useState<string | null>(null);
  const [ratingValue, setRatingValue]   = useState(0);
  const [ratingHover, setRatingHover]   = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const [walletInput, setWalletInput]   = useState("");
  const [walletError, setWalletError]   = useState("");
  const [savingWallet, setSavingWallet] = useState(false);
  const [editingWallet, setEditingWallet] = useState(false);
  const [copied, setCopied]             = useState(false);

  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const [awaitingTelegram, setAwaitingTelegram]     = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive twitter info from Privy
  const twitterAccount = (user?.linkedAccounts ?? []).find((a: any) => a.type === "twitter_oauth") as any;
  const twitterHandle = (user as any)?.twitter?.username
    ?? twitterAccount?.username
    ?? twitterAccount?.handle
    ?? "";
  const displayName = (user as any)?.twitter?.name ?? twitterHandle;
  const twitterId   = (user as any)?.twitter?.subject ?? twitterHandle;
  // Profile picture URL from Privy Twitter OAuth
  const privyAvatarUrl: string | null =
    (user as any)?.twitter?.profilePictureUrl
    ?? twitterAccount?.profilePictureUrl
    ?? null;
  // Use higher-res version (replace _normal with _bigger)
  const avatarUrl = privyAvatarUrl
    ? privyAvatarUrl.replace("_normal", "_bigger")
    : (profile?.avatar_url ?? null);

  // ── Auto-register + load profile on login ──────────────────────────────
  useEffect(() => {
    if (!authenticated || !twitterHandle) return;

    async function init() {
      setLoading(true);
      try {
        // Upsert user (creates record if first login, returns existing if not)
        setRegistering(true);
        const res = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twitter_handle: twitterHandle, twitter_id: twitterId, display_name: displayName, privy_did: user?.id, avatar_url: privyAvatarUrl?.replace("_normal", "_bigger") ?? null }),
        });
        setRegistering(false);

        if (!res.ok) return;
        const { user: userRecord } = await res.json();
        setProfile(userRecord);
        setSelectedNiches(userRecord?.niches ?? []);

        // Set wallet input from saved record
        if (userRecord?.wallet_address && userRecord.wallet_address !== "pending") {
          // stored — no need to show input
        }

        // Load their jobs
        const jobsRes = await fetch(`/api/user?handle=${twitterHandle}`);
        if (jobsRes.ok) {
          const { jobs: j, clientJobs: cj } = await jobsRes.json();
          setJobs(j ?? []);
          setClientJobs(cj ?? []);
        }
      } finally {
        setLoading(false);
      }
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, twitterHandle]);

  // ── Auto-sync Telegram username if connected but username not stored ────
  useEffect(() => {
    if (!profile?.telegram_chat_id || profile.telegram_username || !twitterHandle) return;
    fetch(`/api/telegram/sync-username?handle=${encodeURIComponent(twitterHandle)}`)
      .then((r) => r.json())
      .then(({ username }) => {
        if (username) setProfile((p) => p ? { ...p, telegram_username: username } : p);
      })
      .catch(() => {});
  }, [profile?.telegram_chat_id, profile?.telegram_username, twitterHandle]);

  // ── Save wallet to Supabase ─────────────────────────────────────────────
  async function handleSaveWallet() {
    const trimmed = walletInput.trim();
    if (!trimmed) { setWalletError("Please enter a wallet address."); return; }
    if (!isValidSolanaAddress(trimmed)) { setWalletError("Invalid Solana address."); return; }

    setSavingWallet(true);
    setWalletError("");
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_handle: twitterHandle, wallet_address: trimmed, privy_did: user?.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");
      setProfile(json.user);
      setWalletInput("");
      setEditingWallet(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setWalletError(`Error: ${msg}`);
    } finally {
      setSavingWallet(false);
    }
  }

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) => {
      if (prev.includes(niche)) return prev.filter((n) => n !== niche);
      if (prev.length >= 3) return prev;
      return [...prev, niche];
    });
  }

  async function handleSaveNiches() {
    setSavingNiches(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_handle: twitterHandle, niches: selectedNiches }),
      });
      if (res.ok) {
        setNichesSaved(true);
        setTimeout(() => setNichesSaved(false), 2000);
      }
    } finally {
      setSavingNiches(false);
    }
  }

  async function handleSubmitRating(jobId: string) {
    if (!ratingValue) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_handle: twitterHandle, rating: ratingValue }),
      });
      if (res.ok) {
        setClientJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, rating: ratingValue } : j))
        );
        setRatingJobId(null);
        setRatingValue(0);
      }
    } finally {
      setSubmittingRating(false);
    }
  }

  function handleCopy() {
    if (!profile?.wallet_address || profile.wallet_address === "pending") return;
    navigator.clipboard.writeText(profile.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleConnectTelegram() {
    if (!twitterHandle) return;
    setConnectingTelegram(true);
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_handle: twitterHandle }),
      });
      const data = await res.json();
      if (data.already_connected) {
        setProfile((p) => p ? { ...p, telegram_chat_id: "connected" } : p);
        return;
      }
      if (!data.link) return;
      window.open(data.link, "_blank");

      // Poll every 3s until bot confirms connection (max 2 min)
      setAwaitingTelegram(true);
      if (pollRef.current) clearInterval(pollRef.current);
      const deadline = Date.now() + 120_000;
      pollRef.current = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(pollRef.current!);
          setAwaitingTelegram(false);
          return;
        }
        try {
          const r = await fetch(`/api/user?handle=${encodeURIComponent(twitterHandle)}`);
          const { user } = await r.json();
          if (user?.telegram_chat_id) {
            setProfile((p) => p ? { ...p, telegram_chat_id: user.telegram_chat_id, telegram_username: user.telegram_username ?? null } : p);
            clearInterval(pollRef.current!);
            setAwaitingTelegram(false);
          }
        } catch { /* ignore */ }
      }, 3000);
    } finally {
      setConnectingTelegram(false);
    }
  }

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleDisconnectTelegram() {
    if (!twitterHandle) return;
    setConnectingTelegram(true);
    try {
      await fetch("/api/telegram/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_handle: twitterHandle }),
      });
      setProfile((p) => p ? { ...p, telegram_chat_id: null, telegram_username: null } : p);
    } finally {
      setConnectingTelegram(false);
    }
  }

  // ── Not authenticated ───────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center min-h-[60vh] grid-bg">
          <div className="card p-10 text-center max-w-sm mx-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Connect to view dashboard
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
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

  const walletAddress = profile?.wallet_address && profile.wallet_address !== "pending"
    ? profile.wallet_address
    : null;
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 5)}...${walletAddress.slice(-4)}`
    : null;

  const totalEarned = profile?.total_earned_usdc ?? 0;
  const completed   = profile?.jobs_completed ?? 0;
  const active      = jobs.filter((j) => j.status === "in_progress").length;

  return (
    <>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Profile header ─────────────────────────────────────── */}
        <div className="card p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={twitterHandle}
              className="w-14 h-14 rounded-full object-cover shrink-0 border-2 border-neutral-200 dark:border-neutral-700"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {(twitterHandle || "?").slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
                @{twitterHandle}
              </h1>
              {profile?.is_verified_blue && (
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
              )}
              {registering && (
                <span className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Registering…
                </span>
              )}
              {profile && !registering && (
                <span className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                  Creator
                </span>
              )}
            </div>

            {/* Wallet + Telegram rows — consistent gap-1 */}
            <div className="flex flex-col gap-1 mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              {/* Wallet */}
              {walletAddress ? (
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono">{shortWallet}</span>
                  <button onClick={handleCopy} title="Copy" className="hover:text-blue-500 transition-colors">
                    <Copy className="w-3 h-3" />
                  </button>
                  {copied && <span className="text-green-500">Copied!</span>}
                  <button
                    onClick={() => { setEditingWallet(true); setWalletInput(walletAddress); }}
                    className="text-blue-500 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-amber-500">Wallet not set</span>
                  <button onClick={() => setEditingWallet(true)} className="text-blue-500 hover:underline font-medium">
                    + Add Wallet
                  </button>
                </div>
              )}

              {/* Telegram */}
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.356 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.782-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                {profile?.telegram_chat_id ? (
                  <>
                    <span className="font-mono">
                      {profile.telegram_username ? `@${profile.telegram_username}` : "Connected"}
                    </span>
                    <button
                      onClick={handleDisconnectTelegram}
                      disabled={connectingTelegram}
                      className="text-red-400 hover:text-red-600 hover:underline transition-colors"
                    >
                      {connectingTelegram ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Disconnect"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleConnectTelegram}
                    disabled={connectingTelegram || awaitingTelegram}
                    className="hover:text-blue-500 transition-colors flex items-center gap-1"
                  >
                    {awaitingTelegram
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Waiting for bot…</>
                      : connectingTelegram
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : "Connect Telegram"
                    }
                  </button>
                )}
              </div>
            </div>

          </div>

          <div className="shrink-0">
            <button
              onClick={() => logout()}
              className="btn-outline text-xs px-4 py-2"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* ── Wallet input card ──────────────────────────────────── */}
        {(!walletAddress || editingWallet) && authenticated && (
          <div className="card p-5 mb-6 border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/20">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
              {editingWallet ? "Update Solana Wallet" : "Add Your Solana Wallet"}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              Enter your Solana wallet address. All USDC earnings will be sent here (0% fee). Saved permanently to your account.
            </p>
            <div className="flex gap-2">
              <input
                className="input-field font-mono text-xs"
                placeholder="e.g. 7xKX...9mZD"
                value={walletInput}
                onChange={(e) => { setWalletInput(e.target.value); setWalletError(""); }}
              />
              <button
                onClick={handleSaveWallet}
                disabled={savingWallet}
                className="btn-primary text-xs px-4 shrink-0"
              >
                {savingWallet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingWallet ? "Saving…" : "Save"}
              </button>
              {editingWallet && (
                <button
                  onClick={() => { setEditingWallet(false); setWalletError(""); }}
                  className="btn-outline text-xs px-3 shrink-0"
                >
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

        {/* ── Niche selector ────────────────────────────────────── */}
        {profile && (
          <div className="card p-5 mb-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Your Niches</h3>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Pick up to 3. Shown on your creator card.</p>
              </div>
              {!editingNiches ? (
                <button
                  onClick={() => setEditingNiches(true)}
                  className="btn-outline text-xs px-4 py-1.5 shrink-0"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingNiches(false)}
                    className="btn-outline text-xs px-3 py-1.5 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => { await handleSaveNiches(); setEditingNiches(false); }}
                    disabled={savingNiches}
                    className="btn-primary text-xs px-4 py-1.5 shrink-0"
                  >
                    {savingNiches ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : nichesSaved ? "Saved!" : <><Save className="w-3.5 h-3.5" /> Save</>}
                  </button>
                </div>
              )}
            </div>

            {/* Selected niches preview (collapsed state) */}
            {!editingNiches && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedNiches.length > 0 ? selectedNiches.map((niche) => (
                  <span key={niche} className="inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-full border border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600">
                    {niche}
                  </span>
                )) : (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">No niches selected yet.</p>
                )}
              </div>
            )}

            {/* Full picker (editing state) */}
            {editingNiches && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3 w-full">
                {ALL_NICHES.map((niche) => {
                  const isActive = selectedNiches.includes(niche);
                  const disabled = !isActive && selectedNiches.length >= 3;
                  return (
                    <button
                      key={niche}
                      onClick={() => toggleNiche(niche)}
                      disabled={disabled}
                      className={`w-full text-center text-xs font-medium px-2 py-1.5 rounded-full border transition-colors truncate ${
                        isActive
                          ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600"
                          : disabled
                          ? "border-neutral-200 dark:border-neutral-800 text-neutral-300 dark:text-neutral-600 bg-transparent cursor-not-allowed"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-transparent hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400 cursor-pointer"
                      }`}
                    >
                      {niche}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Loading skeleton ───────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-neutral-400 dark:text-neutral-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Loading your profile…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Stats ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Earned",   value: `$${totalEarned.toFixed(2)} USDC`, icon: TrendingUp,  color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950"   },
                { label: "Jobs Completed", value: completed.toString(),               icon: CheckCircle2, color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950"     },
                { label: "Active Jobs",    value: active.toString(),                  icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950"   },
                { label: "Platform Fee",   value: "0%",                               icon: Zap,          color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950"  },
              ].map((s) => (
                <div key={s.label} className="card p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1.5">{s.label}</p>
                    <p className="text-base font-bold text-neutral-900 dark:text-white leading-none truncate">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Job history ───────────────────────────────────────── */}
            <div className="card overflow-hidden mb-6">
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="font-semibold text-neutral-900 dark:text-white">Your Jobs</h2>
                <Link href="/jobs" className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                  Browse open jobs <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {jobs.length > 0 ? (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {jobs.map((job) => (
                    <div key={job.id} className="px-5 py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                          {job.title}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {job.type} · {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[job.status]}`}>
                        {job.status.replace("_", " ")}
                      </span>
                      <span className="text-sm font-bold text-neutral-900 dark:text-white shrink-0">
                        ${job.price_usdc < 1 ? job.price_usdc.toFixed(2) : job.price_usdc}
                      </span>
                      <button className="shrink-0 text-neutral-400 dark:text-neutral-500">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-400 dark:text-neutral-500">
                  <Briefcase className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No jobs yet.</p>
                  <p className="text-xs mt-1">
                    <Link href="/jobs" className="text-blue-500 hover:underline">Browse open jobs</Link> to start earning.
                  </p>
                </div>
              )}
            </div>

            {/* ── Jobs You Posted ───────────────────────────────────── */}
            {clientJobs.length > 0 && (
              <div className="card overflow-hidden mb-6">
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
                  <h2 className="font-semibold text-neutral-900 dark:text-white">Jobs You Posted</h2>
                  <Link href="/post-job" className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                    Post new <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {clientJobs.map((job) => (
                    <div key={job.id} className="px-5 py-4 flex flex-col gap-2">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                            {job.title}
                          </p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                            {job.type} · {new Date(job.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[job.status]}`}>
                          {job.status.replace("_", " ")}
                        </span>
                        <span className="text-sm font-bold text-neutral-900 dark:text-white shrink-0">
                          ${job.price_usdc < 1 ? job.price_usdc.toFixed(2) : job.price_usdc}
                        </span>
                      </div>

                      {/* Rating section */}
                      {job.status === "completed" && job.creator_id && (
                        job.rating !== null ? (
                          <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                            <span>Your rating:</span>
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={`w-3.5 h-3.5 ${s <= job.rating! ? "text-amber-400 fill-amber-400" : "text-neutral-300 dark:text-neutral-600"}`} />
                            ))}
                          </div>
                        ) : ratingJobId === job.id ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map((s) => (
                                <button
                                  key={s}
                                  onMouseEnter={() => setRatingHover(s)}
                                  onMouseLeave={() => setRatingHover(0)}
                                  onClick={() => setRatingValue(s)}
                                  className="p-0.5"
                                >
                                  <Star className={`w-5 h-5 transition-colors ${s <= (ratingHover || ratingValue) ? "text-amber-400 fill-amber-400" : "text-neutral-300 dark:text-neutral-600"}`} />
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => handleSubmitRating(job.id)}
                              disabled={!ratingValue || submittingRating}
                              className="btn-primary text-xs px-3 py-1.5"
                            >
                              {submittingRating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Submit"}
                            </button>
                            <button
                              onClick={() => { setRatingJobId(null); setRatingValue(0); setRatingHover(0); }}
                              className="text-xs text-neutral-400 hover:text-neutral-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setRatingJobId(job.id); setRatingValue(0); setRatingHover(0); }}
                            className="text-xs text-blue-500 hover:underline self-start flex items-center gap-1"
                          >
                            <Star className="w-3 h-3" /> Rate this creator
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </>
  );
}
