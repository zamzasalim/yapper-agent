"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { usePrivy } from "@privy-io/react-auth";
import { useSearchParams } from "next/navigation";
import {
  FileText, Repeat2, Heart, Flag, HelpCircle,
  Info, ArrowRight, Bot, Users, X, Loader2,
  CheckCircle2, AlertCircle, Hash, Link2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Suspense } from "react";
import { buildUsdcTransfer, connection, PLATFORM_WALLET } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";
import { Zap } from "lucide-react";

type JobType = "content" | "repost" | "like_reply" | "campaign" | "custom";
type TxPhase = "idle" | "loading" | "success" | "error";

const JOB_TYPES: { type: JobType; icon: React.ElementType; label: string; desc: string }[] = [
  { type: "content",    icon: FileText,   label: "Content",      desc: "Original tweet / thread by creator" },
  { type: "repost",     icon: Repeat2,    label: "Repost",       desc: "Retweet your tweet · $0.50/creator" },
  { type: "like_reply", icon: Heart,      label: "Like & Reply", desc: "Like + reply on your tweet · $0.20/creator" },
  { type: "campaign",   icon: Flag,       label: "Campaign",     desc: "Multi-creator hashtag challenge / event" },
  { type: "custom",     icon: HelpCircle, label: "Custom",       desc: "Any other task — you define it" },
];

// Fixed price for simple actions
const FIXED_PRICE: Partial<Record<JobType, number>> = {
  repost:     0.50,
  like_reply: 0.20,
};

// Tiers for content & campaign — min is used as the S&K requirement automatically
const CREATOR_TIERS = [
  { label: "Nano",  sub: "0–1K followers",    value: "0-1000",      price: 5,  min: 0     },
  { label: "Micro", sub: "1K–10K followers",  value: "1000-10000",  price: 10, min: 1000  },
  { label: "Mid",   sub: "10K–50K followers", value: "10000-50000", price: 25, min: 10000 },
  { label: "Macro", sub: "50K+ followers",    value: "50000-99999", price: -1, min: 50000 },
];

// ─── Transaction Modal ───────────────────────────────────────────────────────
interface ModalProps {
  totalUsdc: number; unitPrice: number; numCreators: number; jobType: JobType;
  onConfirm: () => Promise<void>; onClose: () => void; phase: TxPhase; error: string;
}

function TxModal({ totalUsdc, unitPrice, numCreators, jobType, onConfirm, onClose, phase, error }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-neutral-900 dark:text-white">Confirm & Lock USDC</h3>
          {phase !== "loading" && (
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
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
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 mb-4">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            USDC is sent to the platform escrow wallet via Phantom. Released to creators only after you approve their proof.
          </p>
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4 text-center">
          Phantom wallet required. Make sure it&apos;s installed and connected.
        </p>
        {phase === "error" && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
        {phase === "success" && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-400">Transaction confirmed! Saving job…</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} disabled={phase === "loading" || phase === "success"} className="btn-outline flex-1 text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={phase === "loading" || phase === "success"} className="btn-primary flex-1 text-sm">
            {phase === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              : phase === "success" ? <><CheckCircle2 className="w-4 h-4" /> Done</>
              : <>Confirm & Send <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="relative shrink-0"
      style={{ width: "2.5rem", height: "1.25rem", borderRadius: "9999px",
        backgroundColor: on ? "#3b82f6" : "#d1d5db", transition: "background-color 0.2s" }}>
      <span className="absolute rounded-full bg-white shadow"
        style={{ width: "1rem", height: "1rem", top: "0.125rem",
          left: on ? "1.375rem" : "0.125rem", transition: "left 0.2s" }} />
    </button>
  );
}

// ─── Main Form ───────────────────────────────────────────────────────────────
function PostJobForm() {
  const { authenticated, login, user } = usePrivy();
  const searchParams = useSearchParams();
  const prefilledCreator = searchParams?.get("creator") ?? "";

  // Common
  const [jobType, setJobType]         = useState<JobType>("content");
  const [isAgentJob, setIsAgentJob]   = useState(false);
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline]       = useState("24");
  const [numCreators, setNumCreators] = useState(1);
  const [submitted, setSubmitted]     = useState(false);

  // Repost / Like&Reply
  const [tweetUrl, setTweetUrl] = useState("");

  // Content specific
  const [contentFormat, setContentFormat] = useState<"tweet" | "thread" | "quote_rt">("tweet");
  const [language, setLanguage]           = useState<"id" | "en" | "both">("id");
  const [referenceUrl, setReferenceUrl]   = useState("");

  // Campaign specific
  const [hashtag, setHashtag]                 = useState("");
  const [campaignFormat, setCampaignFormat]   = useState<"tweet" | "thread" | "any">("tweet");
  const [campaignDuration, setCampaignDuration] = useState("7");

  // Custom specific
  const [proofRequirement, setProofRequirement] = useState("");
  const [rewardType, setRewardType] = useState<"whitelist" | "nft" | "code" | "other">("whitelist");
  const [rewardDescription, setRewardDescription] = useState("");
  const [submittingCustom, setSubmittingCustom] = useState(false);
  const [customError, setCustomError] = useState("");

  // Budget (content / campaign)
  const [creatorTier, setCreatorTier]   = useState("1000-10000");
  const [customPrice, setCustomPrice]   = useState("");
  const [requireCenblue, setRequireCenblue] = useState(false);
  const [minFollowers, setMinFollowers]     = useState(0);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [txPhase, setTxPhase]     = useState<TxPhase>("idle");
  const [txError, setTxError]     = useState("");

  // ── Price calc ──
  const fixedPrice   = FIXED_PRICE[jobType];
  const selectedTier = CREATOR_TIERS.find((t) => t.value === creatorTier);

  const unitPrice: number = (() => {
    if (fixedPrice !== undefined) return fixedPrice;
    if (jobType === "custom") return parseFloat(customPrice) || 0;
    // content / campaign
    if (selectedTier?.price === -1) return parseFloat(customPrice) || 0;
    return selectedTier?.price ?? 0;
  })();

  const effectiveCreators = jobType === "campaign" ? Math.max(2, numCreators) : numCreators;
  const totalUsdc = parseFloat((unitPrice * effectiveCreators).toFixed(2));

  const twitterHandle = (user as any)?.twitter?.username ?? "";
  const displayName   = (user as any)?.twitter?.name    ?? twitterHandle;
  const twitterId     = (user as any)?.twitter?.subject ?? twitterHandle;

  // ── Save job ──
  async function saveJob() {
    // For content/campaign: derive min followers from selected tier automatically
    const effectiveMinFollowers =
      showTier ? (selectedTier?.min ?? 0) : minFollowers;

    const reqParts: string[] = [];
    if (requireCenblue)          reqParts.push("cenblue wajib");
    if (effectiveMinFollowers > 0) reqParts.push(`min. ${effectiveMinFollowers.toLocaleString()} followers`);
    const reqPrefix = reqParts.length > 0 ? `[S&K: ${reqParts.join(", ")}]\n\n` : "";

    let finalDescription = description;

    if (jobType === "content") {
      const formatLabel = { tweet: "Tweet", thread: "Thread", quote_rt: "Quote RT" }[contentFormat];
      const langLabel   = { id: "Indonesian", en: "English", both: "Bilingual" }[language];
      finalDescription  = [
        reqPrefix + description,
        `\n---`,
        `Format: ${formatLabel}`,
        `Language: ${langLabel}`,
        referenceUrl ? `Reference: ${referenceUrl}` : "",
      ].filter(Boolean).join("\n");
    }

    if (jobType === "campaign") {
      const fmtLabel = { tweet: "Tweet", thread: "Thread", any: "Any format" }[campaignFormat];
      finalDescription = [
        reqPrefix + description,
        `\n---`,
        `Hashtag: #${hashtag.replace(/^#/, "")}`,
        `Format: ${fmtLabel}`,
        `Duration: ${campaignDuration} days`,
        `Target creators: ${effectiveCreators}`,
      ].filter(Boolean).join("\n");
    }

    if (jobType === "custom") {
      const rewardLabel = { whitelist: "Whitelist", nft: "NFT", code: "Access Code", other: "Other" }[rewardType];
      finalDescription = [
        description,
        `\n---`,
        `Reward: ${rewardLabel}${rewardDescription ? ` — ${rewardDescription}` : ""}`,
        `Proof required: ${proofRequirement}`,
      ].filter(Boolean).join("\n");
    }

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        twitter_handle: twitterHandle, display_name: displayName,
        twitter_id: twitterId, privy_did: user?.id,
        type: jobType, title,
        description: finalDescription,
        price_usdc: jobType === "custom" ? 0 : unitPrice,
        status: jobType === "custom" ? "pending_approval" : "open",
        tweet_url: tweetUrl || null,
        content_brief: null,
        is_agent_job: isAgentJob,
        deadline_hours: jobType === "campaign"
          ? parseInt(campaignDuration) * 24
          : parseInt(deadline),
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to save job");
  }

  // ── Direct submit for custom (no USDC) ──
  async function handleCustomSubmit() {
    setSubmittingCustom(true);
    setCustomError("");
    try {
      await saveJob();
      setSubmitted(true);
    } catch (err: unknown) {
      setCustomError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmittingCustom(false);
    }
  }

  // ── Phantom payment ──
  async function handleConfirm() {
    setTxPhase("loading");
    setTxError("");
    try {
      const solana = (window as any).solana;
      if (!solana?.isPhantom) throw new Error("Phantom wallet not detected. Please install the Phantom extension.");
      await solana.connect();
      const senderPubkey = new PublicKey(solana.publicKey.toString());
      const tx     = await buildUsdcTransfer(senderPubkey, PLATFORM_WALLET, totalUsdc);
      const signed = await solana.signTransaction(tx);
      const sig    = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      setTxPhase("success");
      await saveJob();
      setShowModal(false);
      setSubmitted(true);
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : "Transaction failed");
      setTxPhase("error");
    }
  }

  // ── Validation ──
  const canSubmit = (() => {
    if (!title.trim()) return false;
    switch (jobType) {
      case "repost":
      case "like_reply": return !!tweetUrl.trim() && totalUsdc > 0;
      case "content":    return !!description.trim() && totalUsdc > 0;
      case "campaign":   return !!description.trim() && !!hashtag.trim() && effectiveCreators >= 2 && totalUsdc > 0;
      case "custom":     return !!description.trim() && !!proofRequirement.trim();
    }
  })();

  function openModal() {
    if (!canSubmit || jobType === "custom") return;
    setTxPhase("idle"); setTxError(""); setShowModal(true);
  }

  function resetForm() {
    setSubmitted(false); setTitle(""); setDescription(""); setTweetUrl("");
    setNumCreators(1); setHashtag(""); setProofRequirement(""); setCustomPrice("");
    setReferenceUrl(""); setRewardDescription(""); setRewardType("whitelist"); setCustomError("");
  }

  // ── Auth guard ──
  if (!authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] grid-bg">
        <div className="card p-10 text-center max-w-sm mx-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Connect to post a job</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Sign in with Twitter to post jobs and hire creators.</p>
          <button onClick={() => login()} className="btn-primary w-full">Connect X</button>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="card p-10 text-center max-w-sm mx-4">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎉</span>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Job posted!</h2>
          {jobType === "custom" ? (
            <>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                Your custom job is under review by our admins.
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">
                Once approved by <strong>@Autosultan_team</strong> or <strong>@0xhnfdm</strong>, it will go live for creators to accept.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                ${totalUsdc} USDC locked in escrow. Job is now live for creators to accept.
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">
                Job has been broadcast to the Yapper Agent Telegram channel.
              </p>
            </>
          )}
          <div className="flex flex-col gap-2">
            <button onClick={resetForm} className="btn-outline text-sm">Post Another Job</button>
            <a href="/jobs" className="btn-primary text-sm">View All Jobs <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      </div>
    );
  }

  // ── Shared: Tier selector for content/campaign ──
  const showTier = jobType === "content" || jobType === "campaign";

  return (
    <>
      {showModal && (
        <TxModal totalUsdc={totalUsdc} unitPrice={unitPrice} numCreators={effectiveCreators}
          jobType={jobType} onConfirm={handleConfirm}
          onClose={() => { if (txPhase !== "loading") setShowModal(false); }}
          phase={txPhase} error={txError} />
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-1">Post a Job</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            Hire verified creators. Payment in USDC — locked on post, released on approval.
          </p>
        </div>

        <div className="flex flex-col gap-6">

          {/* ── Job Posted By ── */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-3">Job Posted By</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: false, icon: Users, label: "Human",    desc: "You're posting directly" },
                { val: true,  icon: Bot,   label: "AI Agent", desc: "x402 / MPP agent flow"  },
              ].map((opt) => (
                <button key={String(opt.val)} onClick={() => setIsAgentJob(opt.val)}
                  className={cn("flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                    isAgentJob === opt.val
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700")}>
                  <opt.icon className={cn("w-5 h-5", isAgentJob === opt.val ? "text-blue-600" : "text-neutral-400 dark:text-neutral-500")} />
                  <div>
                    <p className={cn("text-sm font-semibold", isAgentJob === opt.val ? "text-blue-700 dark:text-blue-400" : "text-neutral-700 dark:text-neutral-300")}>{opt.label}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Job Type ── */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-3">Job Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {JOB_TYPES.map((jt) => (
                <button key={jt.type} onClick={() => setJobType(jt.type)}
                  className={cn("flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all",
                    jobType === jt.type
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700")}>
                  <jt.icon className={cn("w-4 h-4", jobType === jt.type ? "text-blue-600" : "text-neutral-400 dark:text-neutral-500")} />
                  <p className={cn("text-xs font-semibold", jobType === jt.type ? "text-blue-700 dark:text-blue-400" : "text-neutral-700 dark:text-neutral-300")}>{jt.label}</p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{jt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Job Details (dynamic per type) ── */}
          <div className="card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {jobType === "campaign" ? "Campaign Details" : jobType === "custom" ? "Task Details" : "Job Details"}
            </h3>

            {prefilledCreator && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
                <Info className="w-4 h-4 shrink-0" />
                Hiring <strong>@{prefilledCreator}</strong> directly
              </div>
            )}

            {/* Title — always */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                {jobType === "campaign" ? "Campaign Name *" : "Job Title *"}
              </label>
              <input className="input-field"
                placeholder={
                  jobType === "content"  ? "e.g. Write a thread about our DeFi protocol" :
                  jobType === "campaign" ? "e.g. #YapperMay Challenge" :
                  jobType === "custom"   ? "e.g. Translate our whitepaper to Bahasa" :
                  "e.g. Repost our Solana launch tweet"}
                value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {/* Tweet URL — repost / like_reply */}
            {(jobType === "repost" || jobType === "like_reply") && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Tweet URL *</label>
                <input className="input-field" placeholder="https://x.com/username/status/..."
                  value={tweetUrl} onChange={(e) => setTweetUrl(e.target.value)} />
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                {jobType === "content"  ? "Brief — what to write about *" :
                 jobType === "campaign" ? "Campaign description & rules *" :
                 jobType === "custom"   ? "Task description *" :
                 "Additional instructions"}
              </label>
              <textarea className="input-field min-h-[100px] resize-none"
                placeholder={
                  jobType === "content"  ? "Explain the topic, key points to include, tone, and any specific info the creator needs." :
                  jobType === "campaign" ? "What should creators post? What are the rules? What's the prize or reward structure?" :
                  jobType === "custom"   ? "Describe the task in detail. What exactly needs to be done?" :
                  "Any extra instructions for the creator."}
                value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Content-specific: Format + Language + Reference */}
            {jobType === "content" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Content Format</label>
                    <div className="flex flex-col gap-1.5">
                      {([["tweet", "Single Tweet"], ["thread", "Thread"], ["quote_rt", "Quote RT"]] as const).map(([val, lbl]) => (
                        <button key={val} onClick={() => setContentFormat(val)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            contentFormat === val
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-semibold"
                              : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300")}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Language</label>
                    <div className="flex flex-col gap-1.5">
                      {([["id", "Indonesian"], ["en", "English"], ["both", "Bilingual"]] as const).map(([val, lbl]) => (
                        <button key={val} onClick={() => setLanguage(val)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            language === val
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-semibold"
                              : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300")}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> Reference / Inspiration URL <span className="font-normal text-neutral-400">(optional)</span></span>
                  </label>
                  <input className="input-field" placeholder="https://x.com/... or any reference link"
                    value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} />
                </div>
              </>
            )}

            {/* Campaign-specific: Hashtag + Format + Duration */}
            {jobType === "campaign" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Required Hashtag *</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">#</span>
                    <input className="input-field" style={{ paddingLeft: "1.5rem" }}
                      placeholder="YapperMay"
                      value={hashtag.replace(/^#/, "")} onChange={(e) => setHashtag(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Content Format</label>
                  <div className="flex gap-2 flex-wrap">
                    {([["tweet", "Tweet"], ["thread", "Thread"], ["any", "Any"]] as const).map(([val, lbl]) => (
                      <button key={val} onClick={() => setCampaignFormat(val)}
                        className={cn("text-xs px-4 py-2 rounded-lg border transition-all",
                          campaignFormat === val
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-semibold"
                            : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300")}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Campaign Duration</label>
                  <select className="input-field" value={campaignDuration} onChange={(e) => setCampaignDuration(e.target.value)}>
                    {["1","2","3","5","7","14","30"].map((d) => (
                      <option key={d} value={d}>{d} day{+d > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Custom-specific: Reward type + Proof */}
            {jobType === "custom" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">Reward Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["whitelist", "🎟️ Whitelist"],
                      ["nft",       "🖼️ NFT"],
                      ["code",      "🔑 Access Code"],
                      ["other",     "🎁 Other"],
                    ] as const).map(([val, lbl]) => (
                      <button key={val} onClick={() => setRewardType(val)}
                        className={cn("text-xs px-3 py-2.5 rounded-xl border text-left transition-all font-medium",
                          rewardType === val
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                            : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300")}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Reward Description <span className="font-normal text-neutral-400">(optional)</span>
                  </label>
                  <input className="input-field"
                    placeholder="e.g. 1x OG Whitelist for MintProject, 1x NFT from collection XYZ"
                    value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Proof / Deliverable Required *
                  </label>
                  <input className="input-field"
                    placeholder="e.g. Screenshot of posted tweet, Google Doc link, wallet address"
                    value={proofRequirement} onChange={(e) => setProofRequirement(e.target.value)} />
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                    What must the creator submit as proof of completion?
                  </p>
                </div>
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Custom jobs require admin review before going live. Our admins will approve within 24 hours.
                  </p>
                </div>
              </>
            )}

            {/* Deadline — not shown for campaign (uses duration instead) */}
            {jobType !== "campaign" && (
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
            )}
          </div>

          {/* ── Creator Requirements ── */}
          <div className="card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Creator Requirements</h3>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Wajib Verified Blue (Cenblue)</p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Creator harus memiliki centang biru Twitter</p>
              </div>
              <Toggle on={requireCenblue} onToggle={() => setRequireCenblue((v) => !v)} />
            </div>
            {/* Min followers — hidden for content/campaign (derived from tier) */}
            {!showTier && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Minimum Followers <span className="font-normal text-neutral-400">(0 = no minimum)</span>
                </label>
                <input className="input-field" type="number" min="0" step="500" placeholder="0"
                  value={minFollowers || ""} onChange={(e) => setMinFollowers(Math.max(0, parseInt(e.target.value) || 0))} />
              </div>
            )}
            {/* For content/campaign: show info that tier drives the min followers */}
            {showTier && selectedTier && (
              <div className="flex items-start gap-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Creator tier <strong className="text-neutral-700 dark:text-neutral-300">{selectedTier.label} ({selectedTier.sub})</strong> automatically sets the follower requirement. No separate input needed.
              </div>
            )}
          </div>

          {/* ── Budget (not shown for custom) ── */}
          {jobType !== "custom" && <div className="card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Budget</h3>

            {/* Fixed price */}
            {fixedPrice !== undefined && (
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Fixed rate: <strong>${fixedPrice.toFixed(2)} USDC</strong> per creator.
                </p>
              </div>
            )}

            {/* Tier selector — content & campaign */}
            {showTier && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">Creator Tier (by followers)</label>
                <div className="grid grid-cols-2 gap-2">
                  {CREATOR_TIERS.map((tier) => (
                    <button key={tier.value} onClick={() => setCreatorTier(tier.value)}
                      className={cn("p-3 rounded-xl border text-left transition-all",
                        creatorTier === tier.value
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700")}>
                      <p className={cn("text-xs font-bold", creatorTier === tier.value ? "text-blue-700 dark:text-blue-400" : "text-neutral-800 dark:text-neutral-200")}>
                        {tier.label}
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{tier.sub}</p>
                      <p className={cn("text-sm font-extrabold mt-1", creatorTier === tier.value ? "text-blue-600" : "text-neutral-900 dark:text-white")}>
                        {tier.price === -1 ? "Custom" : `$${tier.price}`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom price input — only when tier is -1 (Macro) */}
            {showTier && selectedTier?.price === -1 && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Custom Price per Creator (USDC) *
                </label>
                <input className="input-field" type="number" min="1" placeholder="e.g. 50"
                  value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
              </div>
            )}

            {/* Number of creators */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                {jobType === "campaign" ? "Number of Creators (min. 2) *" : "Number of Creators"}
              </label>
              <input className="input-field" type="number" min={jobType === "campaign" ? "2" : "1"} max="10000"
                value={jobType === "campaign" ? effectiveCreators : numCreators}
                onChange={(e) => setNumCreators(Math.max(jobType === "campaign" ? 2 : 1, parseInt(e.target.value) || 1))} />
            </div>

            {/* Cost summary */}
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">You lock in escrow</p>
                <p className="text-xl font-extrabold text-neutral-900 dark:text-white">
                  {totalUsdc ? `$${totalUsdc < 1 ? totalUsdc.toFixed(2) : totalUsdc}` : "—"}{" "}
                  <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">USDC</span>
                </p>
                {effectiveCreators > 1 && unitPrice > 0 && (
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {effectiveCreators} creators × ${unitPrice < 1 ? unitPrice.toFixed(2) : unitPrice}
                  </p>
                )}
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
          </div>}

          {/* ── Submit ── */}
          {jobType === "custom" ? (
            <>
              {customError && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400">{customError}</p>
                </div>
              )}
              <button
                className={cn("btn-primary text-sm py-3 w-full", (!canSubmit || submittingCustom) && "opacity-50 cursor-not-allowed")}
                onClick={handleCustomSubmit}
                disabled={!canSubmit || submittingCustom}
              >
                {submittingCustom ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Submit for Admin Review <ArrowRight className="w-4 h-4" /></>}
              </button>
              <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
                No USDC required. Admin will review and approve before the job goes live.
              </p>
            </>
          ) : (
            <>
              <button className={cn("btn-primary text-sm py-3 w-full", !canSubmit && "opacity-50 cursor-not-allowed")}
                onClick={openModal} disabled={!canSubmit}>
                Post Job &amp; Lock ${totalUsdc || "—"} USDC
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
                USDC is held in escrow via Phantom wallet and released when you approve the creator&apos;s proof.
              </p>
            </>
          )}
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
