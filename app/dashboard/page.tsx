"use client";

import { Navbar } from "@/components/Navbar";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [ratingJobId, setRatingJobId]   = useState<string | null>(null);
  const [ratingValue, setRatingValue]   = useState(0);
  const [ratingHover, setRatingHover]   = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const [walletInput, setWalletInput]   = useState("");
  const [walletError, setWalletError]   = useState("");
  const [savingWallet, setSavingWallet] = useState(false);
  const [editingWallet, setEditingWallet] = useState(false);
  const [copied, setCopied]             = useState(false);

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

            {/* Wallet status */}
            {walletAddress ? (
              <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
                <Wallet className="w-3.5 h-3.5" />
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
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-amber-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Wallet not set
                </p>
                <button
                  onClick={() => setEditingWallet(true)}
                  className="text-xs text-blue-500 hover:underline font-medium"
                >
                  + Add Wallet
                </button>
              </div>
            )}

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
                { label: "Total Earned",   value: `$${totalEarned.toFixed(2)} USDC`, icon: TrendingUp,  color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950"  },
                { label: "Jobs Completed", value: completed.toString(),              icon: CheckCircle2, color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950"    },
                { label: "Active Jobs",    value: active.toString(),                 icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950"  },
                { label: "Platform Fee",   value: "0%",                              icon: Zap,          color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950" },
              ].map((s) => (
                <div key={s.label} className="card p-4 flex flex-col gap-2">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="text-xl font-extrabold text-neutral-900 dark:text-white">{s.value}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{s.label}</p>
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

            {/* ── Telegram ──────────────────────────────────────────── */}
            <div className="card p-5 flex items-center gap-4 bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
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
          </>
        )}
      </div>
    </>
  );
}
