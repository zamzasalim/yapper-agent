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

  const hasTweet   = (job.type === "repost" || job.type === "like_reply") && job.tweetUrl;
  const isAutoVerify = job.type === "repost";

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
      setPhase("proof");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept");
      setPhase("error_accept");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitProof() {
    if (!isAutoVerify && !proofUrl.trim()) {
      setError("Please paste the link to your tweet/post.");
      return;
    }
    setPhase("verifying");
    setError("");
    try {
      const res = await fetch(`/api/jobs/${job.id}/verify-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twitter_handle: twitterHandle,
          proof_url: isAutoVerify ? undefined : proofUrl.trim(),
        }),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card p-6 max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-neutral-900 dark:text-white">
            {(phase === "confirm" || phase === "error_accept") && "Accept Job?"}
            {(phase === "proof"   || phase === "error_proof")  && "Submit Proof"}
            {phase === "verifying" && (isAutoVerify ? "Verifying…" : "Submitting…")}
            {phase === "done"      && "All Done!"}
          </h3>
          {canClose && (
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ── CONFIRM phase ── */}
        {(phase === "confirm" || phase === "error_accept") && (
          <>
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", TYPE_COLOR[job.type])}>
                  {TYPE_ICON[job.type]} {TYPE_LABEL[job.type]}
                </span>
              </div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">{job.title}</p>
              <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-bold text-neutral-900 dark:text-white">
                  ${job.priceUsdc < 1 ? job.priceUsdc.toFixed(2) : job.priceUsdc} USDC
                </span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.deadline} deadline</span>
              </div>
            </div>

            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
              {TYPE_TASK[job.type]}:
            </p>

            {hasTweet ? (
              <a
                href={job.tweetUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate flex-1">{job.tweetUrl}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ) : (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed bg-neutral-50 dark:bg-neutral-900 rounded-xl px-4 py-3 mb-4 line-clamp-4">
                {job.description}
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} disabled={loading} className="btn-outline flex-1 text-sm">
                Cancel
              </button>
              <button onClick={handleAccept} disabled={loading} className="btn-primary flex-1 text-sm">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Accepting…</>
                  : <>Accept & Start <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </>
        )}

        {/* ── PROOF phase ── */}
        {(phase === "proof" || phase === "error_proof") && (
          <>
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-4 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
              Job accepted! Complete the task then submit proof below.
            </div>

            {/* Target tweet link (for repost / like_reply) */}
            {hasTweet && (
              <>
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                  {TYPE_TASK[job.type]}:
                </p>
                <a
                  href={job.tweetUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors group"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{job.tweetUrl}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </>
            )}

            {/* Manual proof URL input (non-repost) */}
            {!isAutoVerify && (
              <div className="mb-4">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1.5">
                  Paste your tweet / post link:
                </label>
                <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 bg-white dark:bg-neutral-900 focus-within:ring-2 focus-within:ring-violet-400">
                  <Link className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="url"
                    value={proofUrl}
                    onChange={(e) => { setProofUrl(e.target.value); setError(""); }}
                    placeholder={PROOF_PLACEHOLDER[job.type]}
                    className="flex-1 text-xs bg-transparent outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <button onClick={handleSubmitProof} className="btn-primary w-full text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {isAutoVerify ? "Verify Repost" : "Submit Proof"}
            </button>
          </>
        )}

        {/* ── VERIFYING / SUBMITTING phase ── */}
        {phase === "verifying" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {isAutoVerify ? "Verifying your repost on Twitter…" : "Submitting proof…"}
            </p>
            {isAutoVerify && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500">This may take a few seconds</p>
            )}
          </div>
        )}

        {/* ── DONE phase ── */}
        {phase === "done" && (
          <>
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {isAutoVerify ? "Repost Verified!" : "Proof Submitted!"}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                {isAutoVerify
                  ? "Great job! Your payment will be processed shortly."
                  : "Our team will review your proof and process payment shortly."}
              </p>
            </div>
            <button onClick={onClose} className="btn-primary w-full text-sm">
              Close
            </button>
          </>
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

  const showFollowers = (job.type === "repost" || job.type === "like_reply") && !!job.minFollowers && job.minFollowers > 0;
  const hasTweetBadge = (job.type === "repost" || job.type === "like_reply") && job.tweetUrl;
  const showRequireBlue = (job.type === "repost" || job.type === "like_reply") && job.requireBlue;

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

      <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn("tag text-[10px] px-2 py-0.5", TYPE_COLOR[job.type])}>
              {TYPE_ICON[job.type]} {TYPE_LABEL[job.type]}
            </span>

            {job.isAgentJob ? (
              <span className="tag text-[10px] px-2 py-0.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                <Bot className="w-3 h-3" /> Agent Job
              </span>
            ) : (
              <span className="tag text-[10px] px-2 py-0.5 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                <Users className="w-3 h-3" /> Human
              </span>
            )}

            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{job.postedAt}</span>
          </div>

          <h3 className="font-semibold text-neutral-900 dark:text-white text-sm mb-1 truncate">{job.title}</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">{job.description}</p>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {showRequireBlue && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified Only
              </span>
            )}
            {showFollowers && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 flex items-center gap-1">
                <Users className="w-3 h-3" /> Min. {job.minFollowers!.toLocaleString()} followers
              </span>
            )}
            <span className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {job.deadline} deadline
            </span>
            {hasTweetBadge && (
              <a
                href={job.tweetUrl!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> View Tweet
              </a>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xl font-extrabold text-neutral-900 dark:text-white">
              ${job.priceUsdc < 1 ? job.priceUsdc.toFixed(2) : job.priceUsdc}
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">USDC</p>
          </div>

          {done ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 px-4 py-2.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Done!
            </div>
          ) : job.status === "in_progress" ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5">
              <Loader2 className="w-3.5 h-3.5" /> In Progress
            </div>
          ) : (
            <button onClick={handleOpenModal} className="btn-primary text-xs px-4 py-2.5">
              {job.isAgentJob
                ? <><Zap className="w-3.5 h-3.5" /> Accept</>
                : <>Accept <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
