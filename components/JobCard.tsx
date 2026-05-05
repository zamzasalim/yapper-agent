"use client";

import { useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import {
  Bot, Users, Clock, CheckCircle2, ArrowRight, Zap,
  Loader2, ExternalLink, X, AlertCircle, Link, TrendingUp, Layers, DollarSign, Trophy,
} from "lucide-react";
import { cn } from "@/lib/cn";

type JobType   = "content" | "repost" | "like_reply" | "campaign" | "custom";
type JobStatus = "open" | "in_progress" | "completed" | "cancelled";

interface Job {
  id: string;
  type: JobType;
  title: string;
  description: string;
  priceUsdc: number;
  priceCC?: number | null;
  currency?: "usdc" | "cc";
  tweetUrl?: string | null;
  status: JobStatus;
  isAgentJob: boolean;
  clientHandle: string;
  requireBlue?: boolean;
  minFollowers?: number;
  maxCreators?: number;
  slotsTaken?: number;
  deadline: string;
  postedAt: string;
}

const TYPE_ICON: Record<JobType, string> = {
  content:    "✍️",
  repost:     "🔁",
  like_reply: "❤️",
  campaign:   "🏆",
  custom:     "⚡",
};

const TYPE_LABEL: Record<JobType, string> = {
  content:    "Content",
  repost:     "Retweet",
  like_reply: "Like & Reply",
  campaign:   "Campaign",
  custom:     "Custom",
};

const TYPE_COLOR: Record<JobType, string> = {
  content:    "text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400",
  repost:     "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400",
  like_reply: "text-pink-600 bg-pink-50 dark:bg-pink-950 dark:text-pink-400",
  campaign:   "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400",
  custom:     "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400",
};

const TYPE_TASK: Record<JobType, string> = {
  repost:     "Retweet this tweet",
  like_reply: "Like & reply to this tweet",
  content:    "Create original content",
  campaign:   "Join this campaign",
  custom:     "Complete this task",
};

const PROOF_PLACEHOLDER: Record<JobType, string> = {
  repost:     "",
  like_reply: "https://x.com/yourhandle/status/...",
  content:    "https://x.com/yourhandle/status/...",
  campaign:   "https://x.com/yourhandle/status/...",
  custom:     "https://x.com/yourhandle/status/...",
};

function deriveTierLabel(minFollowers: number): string {
  if (minFollowers >= 50000) return "Super CT";
  if (minFollowers >= 10000) return "Big CT";
  if (minFollowers >= 1000)  return "Small CT";
  return "Nano CT";
}

function parseRewardType(description: string): string | null {
  const afterDash = (description ?? "").split(/\n\n?---\n/)[1] ?? "";
  const line = afterDash.split("\n").find((l) => l.startsWith("Reward:"));
  if (!line) return null;
  const value = line.replace("Reward: ", "").trim();
  if (value.startsWith("Other — ")) return value.slice("Other — ".length);
  return value.split(" — ")[0].trim();
}

function parseJobDescription(description: string) {
  const cleaned = description.replace(/^\[S&K:[^\]]+\]\n\n/, "").trim();
  const [brief, metaRaw] = cleaned.split(/\n\n?---\n/);
  const meta = (metaRaw ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(": ");
      return idx > -1
        ? { label: line.slice(0, idx), value: line.slice(idx + 2) }
        : null;
    })
    .filter(Boolean) as { label: string; value: string }[];
  return { brief: brief.trim(), meta };
}

function parseProofExtras(description: string) {
  const afterDash = (description ?? "").split(/\n\n?---\n/)[1] ?? "";
  const proofLine = afterDash.split("\n").find((l) => l.startsWith("Proof required:"));
  if (!proofLine) return { wallet: null as string | null, email: false, discord: false, telegram: false };
  const parts = proofLine.replace("Proof required: ", "").split(", ");
  const walletPart = parts.find((p) => p.startsWith("wallet address"));
  const walletType = walletPart ? walletPart.match(/\(([^)]+)\)/)?.[1] ?? "crypto" : null;
  return {
    wallet:   walletType,
    email:    parts.some((p) => p === "email address"),
    discord:  parts.some((p) => p === "discord username"),
    telegram: parts.some((p) => p === "telegram username"),
  };
}

// ─── Modal phases ─────────────────────────────────────────────────────────────
type ModalPhase = "confirm" | "proof" | "verifying" | "done" | "additional_info" | "error_accept" | "error_proof";

interface AcceptModalProps {
  job: Job;
  twitterHandle: string;
  onClose: () => void;
  onDone: () => void;
}

function AcceptModal({ job, twitterHandle, onClose, onDone }: AcceptModalProps) {
  const [phase, setPhase]       = useState<ModalPhase>("confirm");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [extraWallet, setExtraWallet]   = useState("");
  const [extraEmail, setExtraEmail]     = useState("");
  const [extraDiscord, setExtraDiscord] = useState("");
  const [extraTelegram, setExtraTelegram] = useState("");

  const hasTweet      = (job.type === "repost" || job.type === "like_reply") && job.tweetUrl;
  const isAutoVerify  = job.type === "repost";
  const parsedDesc    = !hasTweet ? parseJobDescription(job.description) : null;
  const extras        = job.type === "custom" ? parseProofExtras(job.description) : null;
  const hasExtras     = !!(extras?.wallet || extras?.email || extras?.discord || extras?.telegram);

  // Repost: accept + auto-verify in one shot, skip proof phase
  async function handleAccept() {
    setLoading(true);
    setError("");
    try {
      if (!accepted) {
        const res = await fetch(`/api/jobs/${job.id}/accept`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twitter_handle: twitterHandle }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            const msg: string = data.error ?? "";
            // Already accepted but proof not yet submitted — skip to proof form
            if (msg.includes("submit your proof")) {
              setAccepted(true);
              // fall through to proof/auto-verify logic below
            }
            // Already submitted proof — treat as done
            else if (msg.includes("already submitted proof")) {
              setPhase("done");
              onDone();
              return;
            }
            // Submission rejected — show proof form with rejection notice
            else if (msg.includes("rejected")) {
              setAccepted(true);
              setError(msg);
              setPhase("error_proof");
              return;
            }
            else {
              throw new Error(msg || "Failed to accept job");
            }
          } else {
            throw new Error(data.error ?? "Failed to accept job");
          }
        } else {
          setAccepted(true);
        }
      }

      if (isAutoVerify) {
        setPhase("verifying");
        const vRes = await fetch(`/api/jobs/${job.id}/verify-proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twitter_handle: twitterHandle }),
        });
        const vData = await vRes.json();
        if (!vRes.ok) throw new Error(vData.error ?? "Verification failed");
        setPhase("done");
        onDone();
      } else {
        setPhase("proof");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
      setPhase("error_accept");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitProof() {
    if (!proofUrl.trim()) {
      setError("Please paste the link to your tweet/post.");
      return;
    }
    setPhase("verifying");
    setError("");
    try {
      const res = await fetch(`/api/jobs/${job.id}/verify-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_handle: twitterHandle, proof_url: proofUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      if (hasExtras) {
        setPhase("additional_info");
        onDone();
      } else {
        setPhase("done");
        onDone();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setPhase("error_proof");
    }
  }

  async function handleSubmitExtras() {
    setLoading(true);
    try {
      await fetch(`/api/jobs/${job.id}/submit-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator_handle: twitterHandle,
          wallet:   extras?.wallet   ? extraWallet   : undefined,
          email:    extras?.email    ? extraEmail     : undefined,
          discord:  extras?.discord  ? extraDiscord   : undefined,
          telegram: extras?.telegram ? extraTelegram  : undefined,
        }),
      });
    } catch {}
    setPhase("done");
    setLoading(false);
  }

  const canClose = !loading && phase !== "verifying";
  const price = job.priceUsdc < 1 ? job.priceUsdc.toFixed(2) : job.priceUsdc;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card p-5 max-w-sm w-full">

        {/* ── CONFIRM ── */}
        {(phase === "confirm" || phase === "error_accept") && (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className={cn("tag text-[10px] px-2 py-0.5", TYPE_COLOR[job.type])}>
                {TYPE_ICON[job.type]} {TYPE_LABEL[job.type]}
              </span>
              {canClose && (
                <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <h3 className="font-bold text-base text-neutral-900 dark:text-white leading-snug mb-3">
              {job.title}
            </h3>

            <div className="flex items-center gap-2 mb-4">
              {job.type === "custom" ? (
                <span className="tag text-[10px] px-2.5 py-1 font-semibold">
                  {parseRewardType(job.description) ?? "Reward"}
                </span>
              ) : job.currency === "cc" ? (
                <span className="tag text-[10px] px-2.5 py-1 font-bold bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800" style={{ color: "#f4ff97" }}>
                  ${price} CC
                </span>
              ) : (
                <span className="tag text-[10px] px-2.5 py-1 font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  ${price} USDC
                </span>
              )}
              <span className="tag text-[10px] px-2.5 py-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {job.deadline}
              </span>
            </div>

            {hasTweet ? (
              <a
                href={job.tweetUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 mb-4 text-xs text-blue-600 dark:text-blue-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate flex-1">{job.tweetUrl}</span>
              </a>
            ) : parsedDesc && (
              <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-3 mb-4 max-h-44 overflow-y-auto">
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                  {parsedDesc.brief}
                </p>
                {parsedDesc.meta.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-neutral-200 dark:border-neutral-700 flex flex-col gap-1.5">
                    {parsedDesc.meta.map(({ label, value }) => (
                      <div key={label} className="flex items-start gap-2 text-[11px]">
                        <span className="text-neutral-400 dark:text-neutral-500 shrink-0 w-16">{label}</span>
                        <span className="text-neutral-600 dark:text-neutral-300">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 mb-4">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} disabled={loading} className="btn-outline flex-1 text-sm">Cancel</button>
              <button onClick={handleAccept} disabled={loading} className="btn-primary flex-1 text-sm">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {accepted ? "Verifying…" : "Accepting…"}</>
                  : accepted && isAutoVerify
                    ? <>Retry Verify <ArrowRight className="w-3.5 h-3.5" /></>
                    : isAutoVerify
                      ? <>Accept & Verify <ArrowRight className="w-3.5 h-3.5" /></>
                      : <>Accept <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </>
        )}

        {/* ── PROOF ── */}
        {(phase === "proof" || phase === "error_proof") && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">Submit Proof</h3>
              {canClose && (
                <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              {TYPE_TASK[job.type]}
              {hasTweet && (
                <a href={job.tweetUrl!} target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5">
                  <ExternalLink className="w-3 h-3" /> View tweet
                </a>
              )}
            </p>

            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
              Your tweet link
            </label>
            <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 bg-white dark:bg-neutral-900 focus-within:ring-2 focus-within:ring-blue-400 mb-4">
              <Link className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="url"
                autoFocus
                value={proofUrl}
                onChange={(e) => { setProofUrl(e.target.value); setError(""); }}
                placeholder={PROOF_PLACEHOLDER[job.type]}
                className="flex-1 text-xs bg-transparent outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 mb-4">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <button onClick={handleSubmitProof} className="btn-primary w-full text-sm">
              Submit Proof
            </button>
          </>
        )}

        {/* ── VERIFYING ── */}
        {phase === "verifying" && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {isAutoVerify ? "Verifying your retweet…" : "Submitting proof…"}
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">This may take a few seconds</p>
          </div>
        )}

        {/* ── ADDITIONAL INFO ── */}
        {phase === "additional_info" && extras && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">Additional Info</h3>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Proof submitted! Please provide the following to receive your reward:
            </p>
            <div className="flex flex-col gap-3 mb-4">
              {extras.wallet && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Wallet Address ({extras.wallet.toUpperCase()}) *
                  </label>
                  <input className="input-field text-xs"
                    placeholder={`Your ${extras.wallet.toUpperCase()} wallet address`}
                    value={extraWallet} onChange={(e) => setExtraWallet(e.target.value)} />
                </div>
              )}
              {extras.email && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Email Address *</label>
                  <input className="input-field text-xs" type="email" placeholder="your@email.com"
                    value={extraEmail} onChange={(e) => setExtraEmail(e.target.value)} />
                </div>
              )}
              {extras.discord && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Discord Username *</label>
                  <input className="input-field text-xs" placeholder="yourname"
                    value={extraDiscord} onChange={(e) => setExtraDiscord(e.target.value)} />
                </div>
              )}
              {extras.telegram && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Telegram Username *</label>
                  <input className="input-field text-xs" placeholder="@yourhandle"
                    value={extraTelegram} onChange={(e) => setExtraTelegram(e.target.value)} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} disabled={loading} className="btn-outline flex-1 text-sm">Skip</button>
              <button onClick={handleSubmitExtras} disabled={loading} className="btn-primary flex-1 text-sm">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Submit <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-base font-bold text-neutral-900 dark:text-white">
              {isAutoVerify ? "Retweet verified!" : "Proof submitted!"}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
              Payment will be processed shortly.
            </p>
            <button onClick={onClose} className="btn-primary w-full text-sm mt-1">Close</button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
export function JobCard({ job }: { job: Job }) {
  const { open } = useAppKit();
  const { isConnected, embeddedWalletInfo } = useAppKitAccount();
  const twitterHandle = embeddedWalletInfo?.user?.username ?? "";
  const authenticated = isConnected && twitterHandle !== "";

  const [showModal, setShowModal] = useState(false);
  const [done, setDone]           = useState(false);

  function handleOpenModal() {
    if (!authenticated) { open(); return; }
    setShowModal(true);
  }

  const isCustom        = job.type === "custom";
  const rewardType      = isCustom ? parseRewardType(job.description) : null;
  const isEngagementJob = job.type === "repost" || job.type === "like_reply";
  const hasTierJob      = job.type === "content" || job.type === "campaign";
  const hasTweetBadge   = isEngagementJob && job.tweetUrl;
  const showRequireBlue = !!job.requireBlue;
  const showFollowers   = (isEngagementJob || isCustom) && job.minFollowers != null;
  const tierLabel       = hasTierJob ? deriveTierLabel(job.minFollowers ?? 0) : null;
  const maxCreators     = job.maxCreators ?? 1;
  const slotsLeft       = Math.max(0, maxCreators - (job.slotsTaken ?? 0));
  const isMulti         = maxCreators > 1;

  return (
    <>
      {showModal && (
        <AcceptModal
          job={job}
          twitterHandle={twitterHandle}
          onClose={() => setShowModal(false)}
          onDone={() => setDone(true)}
        />
      )}


      <div className="card p-5 flex flex-col gap-3">
        {/* Top: type badge + time */}
        <div className="flex items-center justify-between">
          <span className={cn("tag text-[10px] px-2 py-0.5", TYPE_COLOR[job.type])}>
            {TYPE_ICON[job.type]} {TYPE_LABEL[job.type]}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{job.postedAt}</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm text-neutral-900 dark:text-white line-clamp-2 leading-snug">
          {job.title}
        </h3>

        {/* Stats */}
        <div className="flex items-center bg-neutral-50 dark:bg-neutral-900 rounded-xl px-3 py-2.5">
          <div className="flex-1 text-center">
            <p className="font-bold text-sm text-neutral-900 dark:text-white flex items-center justify-center gap-0.5">
              {isCustom
                ? <>{rewardType ?? "Reward"}</>
                : job.currency === "cc"
                  ? <><DollarSign className="w-3 h-3" />{job.priceUsdc < 1 ? job.priceUsdc.toFixed(2) : job.priceUsdc} <span className="text-xs font-bold ml-0.5" style={{ color: "#f4ff97" }}>CC</span></>
                  : <><DollarSign className="w-3 h-3" />{job.priceUsdc < 1 ? job.priceUsdc.toFixed(2) : job.priceUsdc}</>}
            </p>
          </div>
          <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
          <div className="flex-1 text-center">
            <p className="font-bold text-sm text-neutral-900 dark:text-white flex items-center justify-center gap-0.5">
              <Clock className="w-3 h-3" /> {job.deadline}
            </p>
          </div>
        </div>

        {/* Requirement badges — always 1 access badge + optional tier/followers + optional slots */}
        <div className="flex items-center justify-between gap-1.5">
          {/* Badge 1: access */}
          {showRequireBlue ? (
            <span className="tag text-[10px] px-2 py-0.5 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-blue-500" />
              <span className="!text-blue-600 dark:!text-blue-400">Verified Only</span>
            </span>
          ) : (
            <span className="tag text-[10px] px-2 py-0.5 flex items-center gap-1">
              <Users className="w-3 h-3" /> Everyone
            </span>
          )}

          {/* Badge 2: tier (content/campaign) or followers (engagement) */}
          {tierLabel && (
            <span className="tag text-[10px] px-2 py-0.5 flex items-center gap-1">
              <Zap className="w-3 h-3" /> {tierLabel}
            </span>
          )}
          {showFollowers && (
            <span className="tag text-[10px] px-2 py-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {job.minFollowers === 0 ? "Any" : job.minFollowers! >= 1000 ? `${(job.minFollowers! / 1000).toFixed(0)}K+` : `${job.minFollowers}+`}
            </span>
          )}

          {/* Badge 3: slots left (multi-creator) or winners count (custom) */}
          {isCustom ? (
            <span className="tag text-[10px] px-2 py-0.5 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> {maxCreators} {maxCreators === 1 ? "Winner" : "Winners"}
            </span>
          ) : isMulti ? (
            <span className="tag text-[10px] px-2 py-0.5 flex items-center gap-1">
              <Layers className="w-3 h-3" /> {slotsLeft} Left
            </span>
          ) : null}

          {/* Agent badge — appended when applicable */}
          {job.isAgentJob && (
            <span className="tag text-[10px] px-2 py-0.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <Bot className="w-3 h-3" /> Agent
            </span>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 mt-auto">
          {hasTweetBadge && (
            <a
              href={job.tweetUrl!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn-outline text-xs px-3 py-2 flex items-center gap-1 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Tweet
            </a>
          )}
          {done ? (
            <div className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Done!
            </div>
          ) : isCustom ? (
            <button onClick={handleOpenModal} className="btn-primary text-xs px-3 py-2 flex-1 !bg-emerald-500 hover:!bg-emerald-600 !border-emerald-500 hover:!border-emerald-600">
              Accept <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : job.status === "in_progress" ? (
            <div className="btn-outline flex-1 text-xs !text-amber-500 !border-amber-400 dark:!border-amber-600 cursor-default">
              In Progress
            </div>
          ) : (
            <button onClick={handleOpenModal} className="btn-primary text-xs px-3 py-2 flex-1">
              Accept <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
