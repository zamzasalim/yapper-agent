"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Bot, Users, Clock, CheckCircle2, ArrowRight, Zap,
  Loader2, ExternalLink, X, AlertCircle, Link,
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
  tweetUrl?: string | null;
  status: JobStatus;
  isAgentJob: boolean;
  clientHandle: string;
  requireBlue?: boolean;
  minFollowers?: number;
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
  repost:     "Repost",
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
  repost:     "Repost this tweet",
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

function formatFollowerRange(min: number, max: number) {
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toString());
  if (max >= 99999) return `${fmt(min)}+`;
  return `${fmt(min)} – ${fmt(max)}`;
}

// ─── Modal phases ─────────────────────────────────────────────────────────────
type ModalPhase = "confirm" | "proof" | "verifying" | "done" | "error_accept" | "error_proof";

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

  const hasTweet     = (job.type === "repost" || job.type === "like_reply") && job.tweetUrl;
  const isAutoVerify = job.type === "repost";

  // Repost: accept + auto-verify in one shot, skip proof phase
  async function handleAccept() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${job.id}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_handle: twitterHandle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to accept job");

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
      setPhase("done");
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setPhase("error_proof");
    }
  }

  const canClose = !loading && phase !== "verifying";
  const price = job.priceUsdc < 1 ? job.priceUsdc.toFixed(2) : job.priceUsdc;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card p-6 max-w-sm w-full">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-0.5">
              {phase === "confirm" || phase === "error_accept" ? TYPE_LABEL[job.type] : ""}
              {phase === "proof"   || phase === "error_proof"  ? "Submit Proof" : ""}
              {phase === "verifying" ? "Please wait…" : ""}
              {phase === "done"      ? "All done!" : ""}
            </p>
            <h3 className="font-bold text-neutral-900 dark:text-white text-sm leading-snug">
              {(phase === "confirm" || phase === "error_accept") && job.title}
              {(phase === "proof"   || phase === "error_proof")  && "Paste your proof link"}
              {phase === "verifying" && (isAutoVerify ? "Verifying repost…" : "Submitting proof…")}
              {phase === "done"      && (isAutoVerify ? "Repost verified!" : "Proof submitted!")}
            </h3>
          </div>
          {canClose && (
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 shrink-0 ml-3 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── CONFIRM ── */}
        {(phase === "confirm" || phase === "error_accept") && (
          <>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              ${price} USDC · {job.deadline} deadline
            </p>

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
            ) : (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 rounded-xl px-3 py-2.5 mb-4 line-clamp-3 leading-relaxed">
                {job.description}
              </p>
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
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Accepting…</>
                  : isAutoVerify
                    ? <>Accept & Verify <ArrowRight className="w-3.5 h-3.5" /></>
                    : <>Accept <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </>
        )}

        {/* ── PROOF (non-repost only) ── */}
        {(phase === "proof" || phase === "error_proof") && (
          <>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              {TYPE_TASK[job.type]}
              {hasTweet && (
                <a href={job.tweetUrl!} target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5">
                  <ExternalLink className="w-3 h-3" /> View tweet
                </a>
              )}
            </p>

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
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {isAutoVerify ? "Checking your repost on Twitter…" : "Submitting…"}
            </p>
          </div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-11 h-11 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
              {isAutoVerify ? "Payment will be processed shortly." : "Our team will review and process payment shortly."}
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
  const { authenticated, login, user } = usePrivy();

  const [showModal, setShowModal] = useState(false);
  const [done, setDone]           = useState(false);

  const twitterHandle =
    ((user?.linkedAccounts ?? []).find((a) => a.type === "twitter_oauth") as any)?.username ??
    (user as any)?.twitter?.username ??
    "";

  function handleOpenModal() {
    if (!authenticated) { login(); return; }
    setShowModal(true);
  }

  const isEngagementJob = job.type === "repost" || job.type === "like_reply";
  const showFollowers   = isEngagementJob && !!job.minFollowers && job.minFollowers > 0;
  const hasTweetBadge   = isEngagementJob && job.tweetUrl;
  const showRequireBlue = isEngagementJob && job.requireBlue;
  const showEveryone    = isEngagementJob && !job.requireBlue;

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
        <div className="grid grid-cols-2 gap-2 text-center bg-neutral-50 dark:bg-neutral-900 rounded-xl px-3 py-2.5">
          <div>
            <p className="font-bold text-sm text-neutral-900 dark:text-white">
              ${job.priceUsdc < 1 ? job.priceUsdc.toFixed(2) : job.priceUsdc}
            </p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">USDC</p>
          </div>
          <div>
            <p className="font-bold text-xs text-neutral-900 dark:text-white flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> {job.deadline}
            </p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">deadline</p>
          </div>
        </div>

        {/* Requirement badges */}
        {(showRequireBlue || showEveryone || showFollowers || job.isAgentJob) && (
          <div className="flex flex-wrap gap-1.5">
            {job.isAgentJob && (
              <span className="tag text-[10px] px-2 py-0.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                <Bot className="w-3 h-3" /> Agent
              </span>
            )}
            {showRequireBlue && (
              <span className="tag text-[10px] px-2 py-0.5 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 flex items-center gap-0.5 font-semibold">
                <CheckCircle2 className="w-3 h-3 text-blue-500" /> <span className="text-blue-600 dark:text-blue-400">Verified Only</span>
              </span>
            )}
            {showEveryone && (
              <span className="tag text-[10px] px-2 py-0.5 flex items-center gap-0.5">
                <Users className="w-3 h-3" /> Everyone
              </span>
            )}
            {showFollowers && (
              <span className="tag text-[10px] px-2 py-0.5 flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {job.minFollowers! >= 1000 ? `${(job.minFollowers! / 1000).toFixed(0)}K` : job.minFollowers}+ followers
              </span>
            )}
          </div>
        )}

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
