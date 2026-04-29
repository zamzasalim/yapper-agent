"use client";

import { Navbar } from "@/components/Navbar";
import { useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Wallet,
  CheckCircle2,
  Clock,
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { MarqueeName } from "@/components/MarqueeName";

const PAGE_SIZE = 5;

type JobStatus = "open" | "in_progress" | "completed" | "cancelled" | "pending_approval";

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
  credited_at?: string | null;
  is_agent_job?: boolean;
}

interface ApplicantRecord {
  twitter_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified_blue: boolean;
  status: string;
  proof_url: string | null;
  additional_info: { wallet?: string; email?: string; discord?: string; telegram?: string } | null;
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

const TYPE_LABEL: Record<string, string> = {
  repost:     "Retweet",
  like_reply: "Like & Reply",
  content:    "Content",
  custom:     "Custom",
  campaign:   "Campaign",
};
function fmtType(t: string) { return TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1); }

const TYPE_PREFIX: Record<string, string> = {
  custom:     "X",
  like_reply: "L",
  repost:     "R",
  content:    "C",
  campaign:   "E",
};
function fmtJobId(type: string, id: string, isAgent?: boolean) {
  const prefix = TYPE_PREFIX[type] ?? "X";
  return `${prefix}${isAgent ? "A" : "H"}${id.slice(0, 8).toUpperCase()}`;
}

const STATUS_STYLE: Record<string, string> = {
  completed:        "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400",
  in_progress:      "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  open:             "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400",
  cancelled:        "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400",
  pending_approval: "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-400",
  missed:           "bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400",
};

const STATUS_TEXT: Record<string, string> = {
  completed:        "text-green-600 dark:text-green-400",
  in_progress:      "text-blue-600 dark:text-blue-400",
  open:             "text-teal-600 dark:text-teal-400",
  cancelled:        "text-red-600 dark:text-red-400",
  pending_approval: "text-violet-600 dark:text-violet-400",
  missed:           "text-orange-600 dark:text-orange-400",
};
const STATUS_LABEL: Record<string, string> = {
  completed:        "Completed",
  in_progress:      "In Progress",
  open:             "Open",
  cancelled:        "Cancelled",
  pending_approval: "Pending Approval",
  missed:           "Missed",
};
function fmtStatus(s: string) { return STATUS_LABEL[s] ?? s; }


export default function DashboardPage() {
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { isConnected, embeddedWalletInfo, address: reownAddress, status } = useAppKitAccount();

  const [mounted, setMounted]           = useState(false);
  const [profile, setProfile]           = useState<UserRecord | null>(null);
  const [jobs, setJobs]                 = useState<JobRecord[]>([]);
  const [clientJobs, setClientJobs]     = useState<ClientJobRecord[]>([]);
  const [loading, setLoading]           = useState(false);
  const [registering, setRegistering]   = useState(false);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [savingNiches, setSavingNiches]     = useState(false);
  const [nichesSaved, setNichesSaved]       = useState(false);
  const [editingNiches, setEditingNiches]   = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileNameInput, setProfileNameInput]     = useState("");
  const [profileAvatarInput, setProfileAvatarInput] = useState("");
  const [savingProfile, setSavingProfile]   = useState(false);
  const [ratingHandle, setRatingHandle]         = useState<string | null>(null);
  const [ratingValue, setRatingValue]           = useState(0);
  const [ratingHover, setRatingHover]           = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const [copied, setCopied]             = useState(false);

  const [jobsPage, setJobsPage]             = useState(0);
  const [clientJobsPage, setClientJobsPage] = useState(0);
  const [jobsFilter, setJobsFilter]                 = useState<JobStatus | null>(null);
  const [jobsTypeFilter, setJobsTypeFilter]         = useState<string | null>(null);
  const [clientJobsFilter, setClientJobsFilter]     = useState<JobStatus | null>(null);
  const [clientJobsTypeFilter, setClientJobsTypeFilter] = useState<string | null>(null);

  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const [awaitingTelegram, setAwaitingTelegram]     = useState(false);
  const [telegramTimedOut, setTelegramTimedOut]     = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [claimable, setClaimable]               = useState<number | null>(null);
  const [pendingBalance, setPendingBalance]     = useState<number | null>(null);
  const [claiming, setClaiming]                 = useState(false);
  const [claimTx, setClaimTx]                   = useState<string | null>(null);

  const { walletProvider } = useAppKitProvider<Provider>("solana");

  const [applicantsModal, setApplicantsModal]     = useState<{ jobId: string; jobTitle: string; jobType: string; jobStatus: JobStatus; jobRating: number | null } | null>(null);
  const [applicants, setApplicants]               = useState<ApplicantRecord[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [applicantsPage, setApplicantsPage]       = useState(0);
  const APPL_PAGE_SIZE = 10;

  // Derive twitter info from Reown social login
  const reownHandle   = embeddedWalletInfo?.user?.username ?? "";
  const isTwitterAuth = embeddedWalletInfo?.authProvider === "x";
  // After profile loads, use DB as source of truth so handle persists even if wallet connect changes the active connection
  const twitterHandle  = profile?.twitter_handle ?? reownHandle;
  const authenticated  = isConnected;
  const isRestoring    = status === "connecting" || status === "reconnecting";
  // Display name and avatar come from DB profile (user sets manually)
  const avatarUrl = profile?.avatar_url ?? null;

  // ── Auto-register + load profile on login ──────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // Auto-save embedded wallet address from Reown whenever it differs from DB
  useEffect(() => {
    if (!reownAddress || !profile?.twitter_handle) return;
    if (reownAddress === profile.wallet_address) return;
    fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitter_handle: profile.twitter_handle, wallet_address: reownAddress }),
    })
      .then((r) => r.json())
      .then(({ user }) => { if (user) setProfile(user); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reownAddress, profile?.twitter_handle, profile?.wallet_address]);

  useEffect(() => {
    if (!isConnected || !reownHandle) return;

    async function init() {
      setLoading(true);
      try {
        setRegistering(true);
        const res = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twitter_handle: reownHandle }),
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
  }, [isConnected, reownHandle]);

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

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) => {
      if (prev.includes(niche)) return prev.filter((n) => n !== niche);
      if (prev.length >= 3) return prev;
      return [...prev, niche];
    });
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twitter_handle: twitterHandle,
          ...(profileNameInput.trim() && { display_name: profileNameInput.trim() }),
          ...(profileAvatarInput.trim() && { avatar_url: profileAvatarInput.trim() }),
        }),
      });
      if (res.ok) {
        const { user } = await res.json();
        if (user) setProfile(user);
        setEditingProfile(false);
      }
    } finally {
      setSavingProfile(false);
    }
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

  async function handleSubmitRating() {
    if (!ratingValue || !applicantsModal) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/jobs/${applicantsModal.jobId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_handle: twitterHandle, rating: ratingValue, creator_handle: ratingHandle }),
      });
      if (res.ok) {
        setClientJobs((prev) =>
          prev.map((j) => (j.id === applicantsModal.jobId ? { ...j, rating: ratingValue } : j))
        );
        setApplicantsModal((m) => m ? { ...m, jobRating: ratingValue } : m);
        setRatingHandle(null);
        setRatingValue(0);
      }
    } finally {
      setSubmittingRating(false);
    }
  }

  // Fetch claimable (on-chain) and pending (not yet credited) balances
  useEffect(() => {
    const wallet = profile?.wallet_address || reownAddress;
    if (!wallet || wallet === "pending") return;
    fetch(`/api/user/claimable?wallet=${encodeURIComponent(wallet)}`)
      .then((r) => r.json())
      .then((d) => setClaimable(d.claimable_usdc ?? 0))
      .catch(() => {});
  }, [profile?.wallet_address, reownAddress]);

  useEffect(() => {
    if (!twitterHandle) return;
    fetch(`/api/user/pending-balance?handle=${encodeURIComponent(twitterHandle)}`)
      .then((r) => r.json())
      .then((d) => setPendingBalance(d.pending_usdc ?? 0))
      .catch(() => {});
  }, [twitterHandle]);

  async function handleClaim() {
    const wallet = profile?.wallet_address || reownAddress;
    if (!wallet || !walletProvider) return;
    setClaiming(true);
    setClaimTx(null);
    try {
      const [{ PublicKey }, { buildClaimTx }, { connection: conn }] = await Promise.all([
        import("@solana/web3.js"),
        import("@/lib/contract"),
        import("@/lib/solana"),
      ]);
      const creatorPubkey = new PublicKey(wallet);
      const tx = await buildClaimTx(creatorPubkey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signed = await (walletProvider as any).signTransaction(tx);
      const sig = await conn.sendRawTransaction(signed.serialize());
      await conn.confirmTransaction(sig, "confirmed");
      setClaimTx(sig);
      setClaimable(0);
      setTimeout(() => setClaimTx(null), 10_000);
    } catch (e) {
      console.error("claim failed", e);
      alert("Claim failed. Check console for details.");
    } finally {
      setClaiming(false);
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
    setTelegramTimedOut(false);
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
          setTelegramTimedOut(true);
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
      }, 5000);
    } finally {
      setConnectingTelegram(false);
    }
  }

  async function handleOpenApplicants(job: ClientJobRecord) {
    setApplicantsModal({ jobId: job.id, jobTitle: job.title, jobType: job.type, jobStatus: job.status, jobRating: job.rating ?? null });
    setApplicants([]);
    setApplicantsPage(0);
    setRatingHandle(null);
    setRatingValue(0);
    setLoadingApplicants(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/applicants`);
      const { applicants: data } = await res.json();
      setApplicants(data ?? []);
    } finally {
      setLoadingApplicants(false);
    }
  }

  function handleExportApplicants() {
    if (!applicants.length) return;
    const rows = [
      ["handle", "display_name", "verified", "status", "proof_url", "wallet", "email", "discord", "telegram"],
      ...applicants.map((a) => [
        a.twitter_handle,
        a.display_name ?? "",
        a.is_verified_blue ? "yes" : "no",
        a.status,
        a.proof_url ?? "",
        a.additional_info?.wallet ?? "",
        a.additional_info?.email ?? "",
        a.additional_info?.discord ?? "",
        a.additional_info?.telegram ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `creators-${applicantsModal?.jobId ?? "job"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  // ── Not mounted yet or restoring session ──────────────────────────────
  if (!mounted || isRestoring) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      </>
    );
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
            <button onClick={() => open()} className="btn-primary w-full">
              Connect X
            </button>
          </div>
        </div>
      </>
    );
  }

  const walletAddress = profile?.wallet_address || reownAddress || null;
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 5)}...${walletAddress.slice(-4)}`
    : null;

  const totalEarned  = profile?.total_earned_usdc ?? 0;
  const active       = jobs.filter((j) => j.status === "in_progress").length;
  const underReview  = jobs.filter((j) => j.status === "completed" && !j.credited_at).length;
  const completed    = jobs.filter((j) => j.status === "completed" && !!j.credited_at).length;

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
            {/* Row 1: Display name + blue tick + role badges */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {profile?.display_name && (
                <div className="overflow-hidden max-w-[200px]">
                  <MarqueeName
                    name={profile.display_name}
                    className="text-lg font-bold text-neutral-900 dark:text-white"
                  />
                </div>
              )}
              {profile?.is_verified_blue && (
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
              )}
              {registering && (
                <span className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Registering…
                </span>
              )}
              {profile && !registering && (
                <span className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                  Creator
                </span>
              )}
              {clientJobs.length > 0 && (
                <span className="text-xs bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">
                  Client
                </span>
              )}
            </div>
            {/* Row 2: Twitter icon + @handle + blue tick */}
            {/* Row 2: X icon + @handle + blue tick */}
            <div className="flex flex-col gap-1.5 mt-1 text-xs text-neutral-400 dark:text-neutral-500">

              {/* Wallet */}
              {walletAddress ? (
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono">{shortWallet}</span>
                  <button onClick={handleCopy} title="Copy" className="hover:text-blue-500 transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copied && <span className="text-green-500">Copied!</span>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-amber-500">Syncing wallet…</span>
                </div>
              )}

              {/* Telegram */}
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.356 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.782-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                {profile?.telegram_chat_id ? (
                  <>
                    <span>{profile.telegram_username ?? "Connected"}</span>
                    <button
                      onClick={handleDisconnectTelegram}
                      disabled={connectingTelegram}
                      title="Disconnect Telegram"
                      className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      {connectingTelegram
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <X className="w-3.5 h-3.5" />}
                    </button>
                  </>
                ) : telegramTimedOut ? (
                  <button
                    onClick={() => { setTelegramTimedOut(false); handleConnectTelegram(); }}
                    className="text-amber-500 hover:text-amber-600 transition-colors flex items-center gap-1.5"
                  >
                    Timed out — Retry
                  </button>
                ) : (
                  <button
                    onClick={handleConnectTelegram}
                    disabled={connectingTelegram || awaitingTelegram}
                    className="hover:text-blue-500 transition-colors flex items-center gap-1.5"
                  >
                    {awaitingTelegram
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for bot…</>
                      : connectingTelegram
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : "Connect Telegram"}
                  </button>
                )}
              </div>
            </div>

          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => {
                setProfileNameInput(profile?.display_name ?? twitterHandle ?? "");
                setProfileAvatarInput(profile?.avatar_url ?? "");
                setEditingProfile(true);
              }}
              className="btn-outline text-xs px-4 py-2"
            >
              Edit Profile
            </button>
            <button
              onClick={() => open()}
              className="btn-outline text-xs px-4 py-2"
            >
              Wallet
            </button>
            <button
              onClick={() => disconnect()}
              className="btn-outline text-xs px-4 py-2"
              style={{ color: "rgb(239 68 68)" }}
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* ── Niche selector ────────────────────────────────────── */}
        {profile && (
          <div className="card p-5 mb-6 overflow-hidden">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white shrink-0">Your Niches</h3>

              {/* Selected pills inline with title (view mode only) */}
              {!editingNiches && (
                selectedNiches.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNiches.map((niche) => (
                      <span key={niche} className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600">
                        {niche}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">No niches selected yet.</span>
                )
              )}

              {/* Actions */}
              {!editingNiches ? (
                <button
                  onClick={() => setEditingNiches(true)}
                  className="btn-outline text-xs px-4 py-1.5 shrink-0 ml-auto"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2 ml-auto">
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
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Pick up to 3. Shown on your creator card.</p>

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

        {/* ── Edit Profile Modal ────────────────────────────────── */}
        {editingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="card p-6 w-full max-w-sm flex flex-col gap-4">
              <h2 className="font-bold text-neutral-900 dark:text-white text-base">Edit Profile</h2>

              {/* Avatar preview */}
              <div className="flex items-center gap-3">
                {profileAvatarInput ? (
                  <img src={profileAvatarInput} alt="preview" className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold shrink-0">
                    {(twitterHandle || "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">Avatar URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={profileAvatarInput}
                    onChange={(e) => setProfileAvatarInput(e.target.value)}
                    className="input-field text-sm w-full"
                  />
                </div>
              </div>

              {/* Display name */}
              <div>
                <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">Display Name</label>
                <input
                  type="text"
                  placeholder={twitterHandle}
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  maxLength={50}
                  className="input-field text-sm w-full"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setEditingProfile(false)} className="btn-outline text-xs px-4 py-2">
                  Cancel
                </button>
                <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary text-xs px-4 py-2">
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                </button>
              </div>
            </div>
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
            <div className="grid grid-cols-3 gap-4 mb-8">

              {/* Earnings card — 2/3 */}
              <div className="card p-5 col-span-2">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider font-semibold">Earnings</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-extrabold text-neutral-900 dark:text-white leading-none">${totalEarned.toFixed(2)}</p>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">USDC</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Pending</span>
                    </div>
                    <span className="text-xs font-semibold text-orange-500 tabular-nums">
                      {pendingBalance === null ? "—" : `$${pendingBalance.toFixed(2)}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Claimable</span>
                      {claimTx && (
                        <a
                          href={`https://solscan.io/tx/${claimTx}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-600 transition-colors"
                        >
                          <span className="text-neutral-500 dark:text-neutral-400">(</span>
                          <ExternalLink className="w-3 h-3" />
                          Tx Confirmed
                          <span className="text-neutral-500 dark:text-neutral-400">)</span>
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleClaim}
                        disabled={claiming || !claimable}
                        className="inline-flex items-center justify-center border border-neutral-200 dark:border-neutral-700 bg-transparent rounded-lg font-semibold transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 whitespace-nowrap text-[11px] px-2 py-0.5 text-green-600 dark:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {claiming ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Claim"}
                      </button>
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400 tabular-nums">
                        {claimable === null ? "—" : `$${claimable.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Jobs card — 1/3 */}
              <div className="card p-5 col-span-1">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider font-semibold">Jobs</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-extrabold text-neutral-900 dark:text-white leading-none">{completed}</p>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">done</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Active</span>
                    </div>
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400 tabular-nums">{active}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Under Review</span>
                    </div>
                    <span className="text-xs font-semibold text-orange-500 tabular-nums">{underReview}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ── Job history ───────────────────────────────────────── */}
            {(() => {
              const filtered = jobs.filter((j) =>
                (!jobsFilter || j.status === jobsFilter) &&
                (!jobsTypeFilter || j.type === jobsTypeFilter)
              );
              const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
              const paged = filtered.slice(jobsPage * PAGE_SIZE, (jobsPage + 1) * PAGE_SIZE);
              const statuses = Array.from(new Set(jobs.map((j) => j.status))) as JobStatus[];
              const types    = Array.from(new Set(jobs.map((j) => j.type)));
              return (
                <div className="card overflow-hidden mb-6">
                  <div className="flex flex-col px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 gap-2">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-neutral-900 dark:text-white">Your Jobs</h2>
                      <Link href="/jobs" className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 shrink-0">
                        Browse open jobs <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    {jobs.length > 0 && (statuses.length > 1 || types.length > 1) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {statuses.length > 1 && (
                          <>
                            <button onClick={() => { setJobsFilter(null); setJobsPage(0); }} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${!jobsFilter ? "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300"}`}>All</button>
                            {statuses.map((s) => (
                              <button key={s} onClick={() => { setJobsFilter(s); setJobsPage(0); }} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${jobsFilter === s ? "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300"}`}>{fmtStatus(s)}</button>
                            ))}
                          </>
                        )}
                        {statuses.length > 1 && types.length > 1 && (
                          <span className="text-neutral-300 dark:text-neutral-700 select-none">|</span>
                        )}
                        {types.length > 1 && (
                          <>
                            <button onClick={() => { setJobsTypeFilter(null); setJobsPage(0); }} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${!jobsTypeFilter ? "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300"}`}>All</button>
                            {types.map((t) => (
                              <button key={t} onClick={() => { setJobsTypeFilter(t); setJobsPage(0); }} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${jobsTypeFilter === t ? "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300"}`}>{fmtType(t)}</button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {filtered.length > 0 ? (
                    <>
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {paged.map((job) => (
                          <div key={job.id} className="px-5 py-4 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                {job.title}
                              </p>
                              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                                <span className="font-mono">{fmtJobId(job.type, job.id, job.is_agent_job)}</span> · {fmtType(job.type)} · <span className={STATUS_TEXT[job.status]}>{fmtStatus(job.status)}</span> · {new Date(job.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-neutral-900 dark:text-white shrink-0">
                              ${job.price_usdc.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 dark:border-neutral-800">
                          <span className="text-xs text-neutral-400 dark:text-neutral-500">
                            {jobsPage * PAGE_SIZE + 1}–{Math.min((jobsPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setJobsPage((p) => p - 1)}
                              disabled={jobsPage === 0}
                              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs text-neutral-500 px-1">{jobsPage + 1} / {totalPages}</span>
                            <button
                              onClick={() => setJobsPage((p) => p + 1)}
                              disabled={jobsPage >= totalPages - 1}
                              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-neutral-400 dark:text-neutral-500">
                      <Briefcase className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">{jobsFilter ? `No "${fmtStatus(jobsFilter)}" jobs.` : "No jobs yet."}</p>
                      {!jobsFilter && (
                        <p className="text-xs mt-1">
                          <Link href="/jobs" className="text-blue-500 hover:underline">Browse open jobs</Link> to start earning.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Jobs You Posted ───────────────────────────────────── */}
            {clientJobs.length > 0 && (() => {
              const filteredCJ = clientJobs.filter((j) =>
                (!clientJobsFilter || j.status === clientJobsFilter) &&
                (!clientJobsTypeFilter || j.type === clientJobsTypeFilter)
              );
              const totalPages = Math.ceil(filteredCJ.length / PAGE_SIZE);
              const paged = filteredCJ.slice(clientJobsPage * PAGE_SIZE, (clientJobsPage + 1) * PAGE_SIZE);
              const statusesCJ = Array.from(new Set(clientJobs.map((j) => j.status))) as JobStatus[];
              const typesCJ    = Array.from(new Set(clientJobs.map((j) => j.type)));
              return (
                <div className="card overflow-hidden mb-6">
                  <div className="flex flex-col px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 gap-2">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-neutral-900 dark:text-white">Jobs You Posted</h2>
                      <Link href="/post-job" className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 shrink-0">
                        Post new <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    {(statusesCJ.length > 1 || typesCJ.length > 1) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusesCJ.length > 1 && (
                          <>
                            <button onClick={() => { setClientJobsFilter(null); setClientJobsPage(0); }} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${!clientJobsFilter ? "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300"}`}>All</button>
                            {statusesCJ.map((s) => (
                              <button key={s} onClick={() => { setClientJobsFilter(s); setClientJobsPage(0); }} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${clientJobsFilter === s ? "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300"}`}>{fmtStatus(s)}</button>
                            ))}
                          </>
                        )}
                        {statusesCJ.length > 1 && typesCJ.length > 1 && (
                          <span className="text-neutral-300 dark:text-neutral-700 select-none">|</span>
                        )}
                        {typesCJ.length > 1 && (
                          <>
                            <button onClick={() => { setClientJobsTypeFilter(null); setClientJobsPage(0); }} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${!clientJobsTypeFilter ? "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300"}`}>All</button>
                            {typesCJ.map((t) => (
                              <button key={t} onClick={() => { setClientJobsTypeFilter(t); setClientJobsPage(0); }} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${clientJobsTypeFilter === t ? "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300"}`}>{fmtType(t)}</button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {paged.map((job) => (
                      <div key={job.id} className="px-5 py-4 flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                              {job.title}
                            </p>
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                              <span className="font-mono">{fmtJobId(job.type, job.id, job.is_agent_job)}</span> · {fmtType(job.type)} · <span className={STATUS_TEXT[job.status]}>{fmtStatus(job.status)}</span> · {new Date(job.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleOpenApplicants(job)}
                            className="text-xs px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 transition-colors shrink-0"
                          >
                            Data
                          </button>
                          <span className="text-sm font-bold text-neutral-900 dark:text-white shrink-0">
                            ${job.price_usdc.toFixed(1)}
                          </span>
                        </div>

                      </div>
                    ))}
                  </div>
                  {paged.length === 0 && (
                    <div className="text-center py-10 text-neutral-400 dark:text-neutral-500">
                      <Briefcase className="w-7 h-7 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{clientJobsFilter ? `No "${clientJobsFilter.replace("_", " ")}" jobs.` : "No jobs posted."}</p>
                    </div>
                  )}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 dark:border-neutral-800">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {clientJobsPage * PAGE_SIZE + 1}–{Math.min((clientJobsPage + 1) * PAGE_SIZE, filteredCJ.length)} of {filteredCJ.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setClientJobsPage((p) => p - 1)}
                          disabled={clientJobsPage === 0}
                          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-neutral-500 px-1">{clientJobsPage + 1} / {totalPages}</span>
                        <button
                          onClick={() => setClientJobsPage((p) => p + 1)}
                          disabled={clientJobsPage >= totalPages - 1}
                          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </>
        )}
      </div>

      {/* ── Applicants Modal ──────────────────────────────────── */}
      {applicantsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setApplicantsModal(null)}
        >
          <div
            className="card w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-900 dark:text-white truncate">Creators</h2>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5">{applicantsModal.jobTitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={handleExportApplicants}
                  disabled={applicants.length === 0}
                  className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => setApplicantsModal(null)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {loadingApplicants ? (
                <div className="flex items-center justify-center py-16 gap-2 text-neutral-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : applicants.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 dark:text-neutral-500">
                  <p className="text-sm">No creators have joined this job yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {applicants.slice(applicantsPage * APPL_PAGE_SIZE, (applicantsPage + 1) * APPL_PAGE_SIZE).map((a) => (
                    <div key={a.twitter_handle} className="px-5 py-3 flex items-start gap-3">
                      {/* Avatar */}
                      {a.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatar_url} alt={a.twitter_handle} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                          {a.twitter_handle.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">@{a.twitter_handle}</span>
                          {a.is_verified_blue && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${STATUS_STYLE[a.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                            {a.status}
                          </span>
                        </div>

                        {/* Proof + Rate button row */}
                        {(a.proof_url || a.status === "completed") && (
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {a.proof_url && (
                              <a href={a.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                {applicantsModal.jobType === "repost" ? "Retweeted post" : "Proof link"}
                              </a>
                            )}
                            {a.status === "completed" && (
                              applicantsModal?.jobRating !== null ? (
                                <div className="flex items-center gap-0.5">
                                  {[1,2,3,4,5].map((s) => (
                                    <Star key={s} className={`w-3.5 h-3.5 ${s <= (applicantsModal?.jobRating ?? 0) ? "text-amber-400 fill-amber-400" : "text-neutral-300 dark:text-neutral-600"}`} />
                                  ))}
                                </div>
                              ) : ratingHandle !== a.twitter_handle ? (
                                <button onClick={() => { setRatingHandle(a.twitter_handle); setRatingValue(0); setRatingHover(0); }} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                  <Star className="w-3 h-3" /> Rate this creator
                                </button>
                              ) : null
                            )}
                          </div>
                        )}

                        {/* Star picker — expands inline when rating active */}
                        {a.status === "completed" && applicantsModal?.jobRating === null && ratingHandle === a.twitter_handle && (
                          <div className="flex items-center gap-2 flex-wrap mt-1.5">
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map((s) => (
                                <button key={s} onMouseEnter={() => setRatingHover(s)} onMouseLeave={() => setRatingHover(0)} onClick={() => setRatingValue(s)} className="p-0.5">
                                  <Star className={`w-5 h-5 transition-colors ${s <= (ratingHover || ratingValue) ? "text-amber-400 fill-amber-400" : "text-neutral-300 dark:text-neutral-600"}`} />
                                </button>
                              ))}
                            </div>
                            <button onClick={handleSubmitRating} disabled={!ratingValue || submittingRating} className="btn-primary text-xs px-3 py-1.5">
                              {submittingRating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Submit"}
                            </button>
                            <button onClick={() => { setRatingHandle(null); setRatingValue(0); setRatingHover(0); }} className="text-xs text-neutral-400 hover:text-neutral-600">
                              Cancel
                            </button>
                          </div>
                        )}

                        {/* Additional info */}
                        {a.additional_info && Object.keys(a.additional_info).length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            {a.additional_info.wallet   && <span className="text-xs text-neutral-400">wallet: <span className="text-neutral-600 dark:text-neutral-300 font-mono">{a.additional_info.wallet}</span></span>}
                            {a.additional_info.email    && <span className="text-xs text-neutral-400">email: <span className="text-neutral-600 dark:text-neutral-300">{a.additional_info.email}</span></span>}
                            {a.additional_info.discord  && <span className="text-xs text-neutral-400">discord: <span className="text-neutral-600 dark:text-neutral-300">{a.additional_info.discord}</span></span>}
                            {a.additional_info.telegram && <span className="text-xs text-neutral-400">telegram: <span className="text-neutral-600 dark:text-neutral-300">{a.additional_info.telegram}</span></span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer pagination */}
            {applicants.length > APPL_PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
                <span className="text-xs text-neutral-400">
                  {applicantsPage * APPL_PAGE_SIZE + 1}–{Math.min((applicantsPage + 1) * APPL_PAGE_SIZE, applicants.length)} of {applicants.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setApplicantsPage((p) => p - 1)}
                    disabled={applicantsPage === 0}
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-neutral-500 px-1">
                    {applicantsPage + 1} / {Math.ceil(applicants.length / APPL_PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setApplicantsPage((p) => p + 1)}
                    disabled={(applicantsPage + 1) * APPL_PAGE_SIZE >= applicants.length}
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
