"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { usePrivy } from "@privy-io/react-auth";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Repeat2,
  MessageSquare,
  Heart,
  Zap,
  HelpCircle,
  Info,
  ArrowRight,
  Bot,
  Users,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Suspense } from "react";
import { buildUsdcTransfer, connection, PLATFORM_WALLET } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";

type JobType = "content" | "repost" | "reply" | "like" | "custom";
type TxPhase = "idle" | "loading" | "success" | "error";

const JOB_TYPES: { type: JobType; icon: React.ElementType; label: string; desc: string }[] = [
  { type: "content", icon: FileText,      label: "Content", desc: "Write original tweets / threads" },
  { type: "repost",  icon: Repeat2,       label: "Repost",  desc: "Retweet to your audience" },
  { type: "reply",   icon: MessageSquare, label: "Reply",   desc: "Reply to a specific tweet" },
  { type: "like",    icon: Heart,         label: "Like",    desc: "Like a specific tweet" },
  { type: "custom",  icon: HelpCircle,    label: "Custom",  desc: "Describe your own task" },
];

const ACTION_PRICES: Record<string, number | null> = {
  like:    0.05,
  reply:   0.10,
  repost:  0.50,
  content: null,
  custom:  null,
};

const FOLLOWER_TIERS = [
  { label: "Content — 0–1K followers",    value: "0-1000",      price: 5  },
  { label: "Content — 1K–10K followers",  value: "1000-10000",  price: 10 },
  { label: "Content — 10K–50K followers", value: "10000-50000", price: -1 },
  { label: "Custom / Any",               value: "0-99999",     price: -1 },
];

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Transaction Modal ───────────────────────────────────────────────────────

interface ModalProps {
  totalUsdc: number;
  unitPrice: number;
  numCreators: number;
  jobType: JobType;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  phase: TxPhase;
  error: string;
}

function TxModal({ totalUsdc, unitPrice, numCreators, jobType, onConfirm, onClose, phase, error }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card p-6 max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-neutral-900 dark:text-white">Confirm & Lock USDC</h3>
          {phase !== "loading" && (
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Amount */}
        <div className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-5 mb-4 text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Total locked in escrow</p>
          <p className="text-4xl font-extrabold text-neutral-900 dark:text-white">
            ${totalUsdc < 1 ? totalUsdc.toFixed(2) : totalUsdc}
            <span className="text-base font-normal text-neutral-400 dark:text-neutral-500 ml-1">USDC</span>
          </p>
          {numCreators > 1 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              {numCreators} creators × ${unitPrice < 1 ? unitPrice.toFixed(2) : unitPrice} USDC each ({jobType})
            </p>
          )}
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 mb-4">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            USDC is sent to the platform escrow wallet via Phantom. Released to creators only after you approve their proof.
          </p>
        </div>

        {/* Phantom hint */}
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4 text-center">
          Phantom wallet required. Make sure it&apos;s installed and connected.
        </p>

        {/* Error */}
        {phase === "error" && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Success */}
        {phase === "success" && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-400">Transaction confirmed! Saving job…</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={phase === "loading" || phase === "success"}
            className="btn-outline flex-1 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={phase === "loading" || phase === "success"}
            className="btn-primary flex-1 text-sm"
          >
            {phase === "loading" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
            ) : phase === "success" ? (
              <><CheckCircle2 className="w-4 h-4" /> Done</>
            ) : (
              <>Confirm & Send <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Form ───────────────────────────────────────────────────────────────

function PostJobForm() {
  const { authenticated, login, user } = usePrivy();
  const searchParams = useSearchParams();
  const prefilledCreator = searchParams?.get("creator") ?? "";

  const [jobType, setJobType]           = useState<JobType>("content");
  const [isAgentJob, setIsAgentJob]     = useState(false);
  const [followerTier, setFollowerTier] = useState("1000-10000");
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [tweetUrl, setTweetUrl]         = useState("");
  const [deadline, setDeadline]         = useState("24");
  const [customPrice, setCustomPrice]   = useState("");
  const [numCreators, setNumCreators]   = useState(1);
  const [submitted, setSubmitted]       = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [txPhase, setTxPhase]     = useState<TxPhase>("idle");
  const [txError, setTxError]     = useState("");

  const actionPrice   = ACTION_PRICES[jobType];
  const selectedTier  = FOLLOWER_TIERS.find((t) => t.value === followerTier);
  const unitPrice: number =
    actionPrice !== null
      ? actionPrice
      : selectedTier?.price === -1
        ? parseFloat(customPrice) || 0
        : (selectedTier?.price ?? 0);

  const totalUsdc = parseFloat((unitPrice * numCreators).toFixed(2));

  const twitterHandle = (user as any)?.twitter?.username ?? "";
  const displayName   = (user as any)?.twitter?.name ?? twitterHandle;
  const twitterId     = (user as any)?.twitter?.subject ?? twitterHandle;

  // ── Save job to Supabase after USDC confirmed ──
  async function saveJob() {
    const body = {
      twitter_handle: twitterHandle,
      display_name:   displayName,
      twitter_id:     twitterId,
      privy_did:      user?.id,
      type:           jobType,
      title,
      description:
        numCreators > 1
          ? `[Campaign: ${numCreators} creators]\n\n${description}`
          : description,
      price_usdc:    unitPrice,
      tweet_url:     tweetUrl || null,
      content_brief: null,
      is_agent_job:  isAgentJob,
      deadline_hours: parseInt(deadline),
    };

    const res  = await fetch("/api/jobs", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to save job");
  }

  // ── USDC transfer via Phantom then save ──
  async function handleConfirm() {
    setTxPhase("loading");
    setTxError("");

    try {
      const solana = (window as any).solana;
      if (!solana?.isPhantom) {
        throw new Error(
          "Phantom wallet not detected. Please install the Phantom extension and try again."
        );
      }

      await solana.connect();
      const senderPubkey = new PublicKey(solana.publicKey.toString());

      const tx = await buildUsdcTransfer(senderPubkey, PLATFORM_WALLET, totalUsdc);
      const signed = await solana.signTransaction(tx);
      const sig    = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxPhase("success");
      await saveJob();
      setShowModal(false);
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxError(msg);
      setTxPhase("error");
    }
  }

  function openModal() {
    if (!title.trim() || !description.trim()) return;
    if ((jobType === "repost" || jobType === "reply" || jobType === "like") && !tweetUrl.trim()) return;
    if (totalUsdc <= 0) return;
    setTxPhase("idle");
    setTxError("");
    setShowModal(true);
  }

  // ── Not authenticated ──
  if (!authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] grid-bg">
        <div className="card p-10 text-center max-w-sm mx-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Connect to post a job</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            Sign in with Twitter to post jobs and hire creators.
          </p>
          <button onClick={() => login()} className="btn-primary w-full">
            Connect X
          </button>
        </div>
      </div>
    );
  }

  // ── Submitted ──
  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="card p-10 text-center max-w-sm mx-4">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎉</span>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Job posted!</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
            ${totalUsdc} USDC locked in escrow. Job is now live for creators to accept.
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">
            Job has been broadcast to the Yapper Agent Telegram channel.
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={() => { setSubmitted(false); setTitle(""); setDescription(""); setTweetUrl(""); setNumCreators(1); }} className="btn-outline text-sm">
              Post Another Job
            </button>
            <a href="/jobs" className="btn-primary text-sm">
              View All Jobs <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const canSubmit =
    title.trim() &&
    description.trim() &&
    totalUsdc > 0 &&
    (["content", "custom"].includes(jobType) || tweetUrl.trim());

  return (
    <>
      {showModal && (
        <TxModal
          totalUsdc={totalUsdc}
          unitPrice={unitPrice}
          numCreators={numCreators}
          jobType={jobType}
          onConfirm={handleConfirm}
          onClose={() => { if (txPhase !== "loading") setShowModal(false); }}
          phase={txPhase}
          error={txError}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-1">
            Post a Job
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            Hire verified blue-tick creators. Payment in USDC — locked on post, released on approval.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Job Posted By */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-3">Job Posted By</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: false, icon: Users, label: "Human",    desc: "You're posting directly" },
                { val: true,  icon: Bot,   label: "AI Agent", desc: "x402 / MPP agent flow"  },
              ].map((opt) => (
                <button
                  key={String(opt.val)}
                  onClick={() => setIsAgentJob(opt.val)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                    isAgentJob === opt.val
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  <opt.icon className={cn("w-5 h-5", isAgentJob === opt.val ? "text-blue-600" : "text-neutral-400 dark:text-neutral-500")} />
                  <div>
                    <p className={cn("text-sm font-semibold", isAgentJob === opt.val ? "text-blue-700 dark:text-blue-400" : "text-neutral-700 dark:text-neutral-300")}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Job Type */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-3">Job Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {JOB_TYPES.map((jt) => (
                <button
                  key={jt.type}
                  onClick={() => setJobType(jt.type)}
                  className={cn(
                    "flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all",
                    jobType === jt.type
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  <jt.icon className={cn("w-4 h-4", jobType === jt.type ? "text-blue-600" : "text-neutral-400 dark:text-neutral-500")} />
                  <p className={cn("text-xs font-semibold", jobType === jt.type ? "text-blue-700 dark:text-blue-400" : "text-neutral-700 dark:text-neutral-300")}>
                    {jt.label}
                  </p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{jt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Job Details */}
          <div className="card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Job Details</h3>

            {prefilledCreator && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
                <Info className="w-4 h-4 shrink-0" />
                Hiring <strong>@{prefilledCreator}</strong> directly
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Job Title *</label>
              <input
                className="input-field"
                placeholder="e.g. Repost our Solana launch tweet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                Description / Brief *
              </label>
              <textarea
                className="input-field min-h-[100px] resize-none"
                placeholder="Describe exactly what the creator should do. Be specific about tone, content, and any URLs."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {(jobType === "repost" || jobType === "reply" || jobType === "like") && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Tweet URL *
                </label>
                <input
                  className="input-field"
                  placeholder="https://x.com/username/status/..."
                  value={tweetUrl}
                  onChange={(e) => setTweetUrl(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Deadline</label>
              <select className="input-field" value={deadline} onChange={(e) => setDeadline(e.target.value)}>
                <option value="3">3 hours</option>
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
              </select>
            </div>
          </div>

          {/* Creator Tier & Budget */}
          <div className="card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Creator Tier & Budget</h3>

            {actionPrice !== null ? (
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Fixed rate for <strong>{jobType}</strong>:{" "}
                  <strong>${actionPrice.toFixed(2)} USDC</strong> per action per creator.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {FOLLOWER_TIERS.map((tier) => (
                  <button
                    key={tier.value}
                    onClick={() => setFollowerTier(tier.value)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      followerTier === tier.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                    )}
                  >
                    <p className={cn("text-xs font-semibold", followerTier === tier.value ? "text-blue-700 dark:text-blue-400" : "text-neutral-700 dark:text-neutral-300")}>
                      {tier.label}
                    </p>
                    <p className={cn("text-sm font-bold mt-0.5", followerTier === tier.value ? "text-blue-600" : "text-neutral-900 dark:text-white")}>
                      {tier.price === -1 ? "Custom price" : `$${tier.price} USDC`}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {actionPrice === null && selectedTier?.price === -1 && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Custom Price per Creator (USDC) *
                </label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  placeholder="e.g. 25"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
              </div>
            )}

            {/* Campaign size */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                Number of Creators for this Campaign
              </label>
              <input
                className="input-field"
                type="number"
                min="1"
                max="10000"
                value={numCreators}
                onChange={(e) => setNumCreators(Math.max(1, parseInt(e.target.value) || 1))}
              />
              {numCreators > 1 && unitPrice > 0 && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">
                  {numCreators} creators × ${unitPrice < 1 ? unitPrice.toFixed(2) : unitPrice} = ${totalUsdc} USDC total locked
                </p>
              )}
            </div>

            {/* Summary */}
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">You lock in escrow</p>
                <p className="text-xl font-extrabold text-neutral-900 dark:text-white">
                  {totalUsdc ? `$${totalUsdc < 1 ? totalUsdc.toFixed(2) : totalUsdc}` : "—"}{" "}
                  <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">USDC</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Per creator receives</p>
                <p className="text-lg font-bold text-green-600">
                  {unitPrice ? `$${unitPrice < 1 ? unitPrice.toFixed(2) : unitPrice}` : "—"}{" "}
                  <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">USDC</span>
                </p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">0% platform fee</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            className={cn("btn-primary text-sm py-3 w-full", !canSubmit && "opacity-50 cursor-not-allowed")}
            onClick={openModal}
            disabled={!canSubmit}
          >
            Post Job &amp; Lock ${totalUsdc || "—"} USDC
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
            USDC is held in escrow via Phantom wallet and released when you approve the creator&apos;s proof.
            Job will be broadcast to the Telegram channel instantly.
          </p>
        </div>
      </div>
    </>
  );
}

export default function PostJobPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <PostJobForm />
      </Suspense>
    </>
  );
}
