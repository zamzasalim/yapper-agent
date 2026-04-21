"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useSearchParams } from "next/navigation";
import {
  FileText, Repeat2, Heart, Flag, HelpCircle,
  Info, ArrowRight, Bot, Users, X, Loader2,
  CheckCircle2, AlertCircle, Hash, Link2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Suspense } from "react";
import { Zap, Copy, Check } from "lucide-react";

const PLATFORM_WALLET_ADDRESS =
  process.env.NEXT_PUBLIC_PLATFORM_WALLET ?? "CzQZDvbjHHZDXxDeGUX2KTorQhiZnJvt6z6V2QtfMDU2";

type JobType = "content" | "repost" | "like_reply" | "campaign" | "custom";
type TxPhase = "idle" | "verifying" | "verified" | "error";

const JOB_TYPES: { type: JobType; icon: React.ElementType; label: string; desc: string }[] = [
  { type: "content",    icon: FileText,   label: "Content",      desc: "Original tweet / thread by creator" },
  { type: "repost",     icon: Repeat2,    label: "Repost",       desc: "Retweet your tweet" },
  { type: "like_reply", icon: Heart,      label: "Like & Reply", desc: "Like + reply on your tweet" },
  { type: "campaign",   icon: Flag,       label: "Campaign",     desc: "Multi-creator campaign / challenge" },
  { type: "custom",     icon: HelpCircle, label: "Custom",       desc: "Any other task, you define it" },
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

// ─── Payment Modal (Manual Transfer + TX Hash Verify) ────────────────────────
interface PaymentModalProps {
  totalUsdc: number; unitPrice: number; numCreators: number; jobType: JobType;
  txHash: string; onTxHashChange: (v: string) => void;
  onVerify: () => Promise<void>; onClose: () => void;
  phase: TxPhase; error: string; copied: boolean; onCopy: () => void;
}

function PaymentModal({
  totalUsdc, unitPrice, numCreators, jobType,
  txHash, onTxHashChange, onVerify, onClose,
  phase, error, copied, onCopy,
}: PaymentModalProps) {
  const busy = phase === "verifying" || phase === "verified";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-neutral-900 dark:text-white">Pay & Post Job</h3>
          {!busy && (
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Amount */}
        <div className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-4 mb-4 text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Send exactly</p>
          <p className="text-3xl font-extrabold text-neutral-900 dark:text-white">
            ${totalUsdc < 1 ? totalUsdc.toFixed(2) : totalUsdc}
            <span className="text-base font-normal text-neutral-400 dark:text-neutral-500 ml-1">USDC</span>
          </p>
          {numCreators > 1 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {numCreators} creators × ${unitPrice < 1 ? unitPrice.toFixed(2) : unitPrice} ({jobType})
            </p>
          )}
        </div>

        {/* Wallet address */}
        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
          Send USDC on Solana to:
        </p>
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl px-3 py-2.5 mb-1">
          <p className="text-[11px] font-mono text-neutral-700 dark:text-neutral-300 flex-1 break-all leading-relaxed">
            {PLATFORM_WALLET_ADDRESS}
          </p>
          <button onClick={onCopy} className="shrink-0 text-neutral-400 hover:text-blue-600 transition-colors ml-1">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-4">
          Open your wallet (Phantom, Backpack, etc.), send exactly the amount above to this address.
        </p>

        {/* TX Hash input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
            Paste Transaction Signature
          </label>
          <input
            className="input-field font-mono text-xs"
            placeholder="e.g. 5J7Xk3m…"
            value={txHash}
            onChange={(e) => onTxHashChange(e.target.value)}
            disabled={busy}
          />
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
            After sending, copy the transaction signature from your wallet history.
          </p>
        </div>

        {phase === "error" && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
        {phase === "verified" && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-400">Payment verified! Saving job…</p>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className="btn-outline flex-1 text-sm">Cancel</button>
          <button
            onClick={onVerify}
            disabled={!txHash.trim() || busy}
            className="btn-primary flex-1 text-sm"
          >
            {phase === "verifying"
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              : phase === "verified"
              ? <><CheckCircle2 className="w-4 h-4" /> Done</>
              : <>Verify & Post <ArrowRight className="w-4 h-4" /></>}
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
  const { open } = useAppKit();
  const { isConnected, embeddedWalletInfo, status } = useAppKitAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isRestoring  = status === "connecting" || status === "reconnecting";
  const authenticated = isConnected;
  const searchParams = useSearchParams();
  const prefilledCreator = searchParams?.get("creator") ?? "";

  // Common
  const [jobType, setJobType]         = useState<JobType>("content");
  const [isAgentJob, setIsAgentJob]   = useState(false);
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline]       = useState("24");
  const [deadlineCustom, setDeadlineCustom] = useState("");
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
  const [rewardType, setRewardType] = useState<"whitelist" | "nft" | "code" | "other">("whitelist");
  const [rewardDescription, setRewardDescription] = useState("");
  const [submittingCustom, setSubmittingCustom] = useState(false);
  const [customError, setCustomError] = useState("");
  // Custom proof options
  const [requireWallet, setRequireWallet]       = useState(false);
  const [walletType, setWalletType]             = useState<"ETH" | "SOL" | "other">("ETH");
  const [walletTypeOther, setWalletTypeOther]   = useState("");
  const [requireEmail, setRequireEmail]         = useState(false);
  const [requireDiscord, setRequireDiscord]     = useState(false);
  const [requireTelegram, setRequireTelegram]   = useState(false);

  // Budget (content / campaign)
  const [selectedTiers, setSelectedTiers] = useState<string[]>(["1000-10000"]);
  const [customPrice, setCustomPrice]   = useState("");
  const [requireCenblue, setRequireCenblue] = useState(false);
  const [minFollowers, setMinFollowers]     = useState(0);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [txPhase, setTxPhase]     = useState<TxPhase>("idle");
  const [txError, setTxError]     = useState("");
  const [txHash, setTxHash]       = useState("");
  const [copied, setCopied]       = useState(false);

  // ── Price calc ──
  const fixedPrice   = FIXED_PRICE[jobType];
  const activeTiers  = CREATOR_TIERS.filter((t) => selectedTiers.includes(t.value));
  const hasMacro     = activeTiers.some((t) => t.price === -1);
  const sumTierPrice = hasMacro ? -1 : activeTiers.reduce((s, t) => s + t.price, 0);

  function toggleTier(value: string) {
    const isMacro = CREATOR_TIERS.find((t) => t.value === value)?.price === -1;
    setSelectedTiers((prev) => {
      if (isMacro) {
        // Macro must be solo — clicking it selects only Macro (or deselects if already solo)
        return prev.length === 1 && prev[0] === value ? prev : [value];
      }
      // Selecting a non-Macro tier clears Macro if active
      const withoutMacro = prev.filter((v) => CREATOR_TIERS.find((t) => t.value === v)?.price !== -1);
      if (withoutMacro.includes(value)) {
        return withoutMacro.length > 1 ? withoutMacro.filter((v) => v !== value) : withoutMacro;
      }
      return [...withoutMacro, value];
    });
  }

  const unitPrice: number = (() => {
    if (fixedPrice !== undefined) return fixedPrice;
    if (jobType === "custom") return parseFloat(customPrice) || 0;
    // content / campaign: sum of selected tier prices
    if (hasMacro) return parseFloat(customPrice) || 0;
    return sumTierPrice;
  })();

  const effectiveCreators = jobType === "campaign" ? Math.max(2, numCreators) : numCreators;
  const totalUsdc = parseFloat((unitPrice * effectiveCreators).toFixed(2));

  const twitterHandle = embeddedWalletInfo?.user?.username ?? "";
  const displayName   = twitterHandle;
  const twitterId     = twitterHandle;

  // ── Save job ──
  async function saveJob(txHashStr?: string) {
    // For content/campaign: derive min followers from selected tiers (use lowest)
    const effectiveMinFollowers =
      showTier ? Math.min(...activeTiers.map((t) => t.min)) : minFollowers;

    const reqParts: string[] = [];
    if (requireCenblue)          reqParts.push("verified only");
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
      const proofParts: string[] = ["URL of reply or post"];
      if (requireWallet) {
        const wt = walletType === "other" ? (walletTypeOther.trim() || "other") : walletType;
        proofParts.push(`wallet address (${wt})`);
      }
      if (requireEmail)    proofParts.push("email address");
      if (requireDiscord)  proofParts.push("discord username");
      if (requireTelegram) proofParts.push("telegram username");
      finalDescription = [
        description,
        `\n---`,
        `Reward: ${rewardLabel}${rewardDescription ? ` — ${rewardDescription}` : ""}`,
        `Proof required: ${proofParts.join(", ")}`,
      ].filter(Boolean).join("\n");
    }

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        twitter_handle: twitterHandle, display_name: displayName,
        twitter_id: twitterId,
        type: jobType, title,
        description: finalDescription,
        price_usdc: jobType === "custom" ? 0 : unitPrice,
        status: jobType === "custom" ? "pending_approval" : "open",
        tx_hash: txHashStr ?? null,
        tweet_url: tweetUrl || null,
        content_brief: null,
        is_agent_job: isAgentJob,
        require_blue: requireCenblue,
        min_followers: effectiveMinFollowers,
        num_creators: effectiveCreators,
        deadline_hours: jobType === "campaign"
          ? parseInt(campaignDuration) * 24
          : deadline === "custom" && deadlineCustom
          ? Math.max(1, Math.round((new Date(deadlineCustom).getTime() - Date.now()) / 3_600_000))
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

  // ── Manual payment verify ──
  async function handleVerifyAndPost() {
    if (!txHash.trim()) return;
    setTxPhase("verifying");
    setTxError("");
    try {
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_hash: txHash.trim(), expected_usdc: totalUsdc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment verification failed");
      setTxPhase("verified");
      await saveJob(txHash.trim());
      setShowModal(false);
      setSubmitted(true);
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : "Verification failed");
      setTxPhase("error");
    }
  }

  function handleCopyWallet() {
    navigator.clipboard.writeText(PLATFORM_WALLET_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Validation ──
  const macroCustomValid = !hasMacro || parseFloat(customPrice) > 25;
  const canSubmit = (() => {
    if (!title.trim()) return false;
    switch (jobType) {
      case "repost":
      case "like_reply": return !!tweetUrl.trim() && totalUsdc > 0;
      case "content":    return !!description.trim() && totalUsdc > 0 && macroCustomValid;
      case "campaign":   return !!description.trim() && !!hashtag.trim() && effectiveCreators >= 2 && totalUsdc > 0 && macroCustomValid;
      case "custom":     return !!description.trim() && (rewardType !== "other" || !!rewardDescription.trim());
    }
  })();

  function openModal() {
    if (!canSubmit || jobType === "custom") return;
    setTxPhase("idle"); setTxError(""); setTxHash(""); setShowModal(true);
  }

  function resetForm() {
    setSubmitted(false); setTitle(""); setDescription(""); setTweetUrl("");
    setNumCreators(1); setHashtag(""); setCustomPrice("");
    setReferenceUrl(""); setRewardDescription(""); setRewardType("whitelist"); setCustomError("");
    setRequireWallet(false); setWalletType("ETH"); setWalletTypeOther("");
    setRequireEmail(false); setRequireDiscord(false); setRequireTelegram(false);
  }

  // ── Auth guard ──
  if (!mounted || isRestoring) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] grid-bg">
        <div className="card p-10 text-center max-w-sm mx-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Connect to post a job</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Sign in with Twitter to post jobs and hire creators.</p>
          <button onClick={() => open()} className="btn-primary w-full">Connect X</button>
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
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Job Posted</h2>
          {jobType === "custom" ? (
            <>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                Your custom job is under review.
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">
                Once approved by our admins, it will go live for creators to accept.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                ${totalUsdc} USDC payment verified. Job is now live for creators to accept.
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
        <PaymentModal
          totalUsdc={totalUsdc} unitPrice={unitPrice} numCreators={effectiveCreators}
          jobType={jobType}
          txHash={txHash} onTxHashChange={setTxHash}
          onVerify={handleVerifyAndPost}
          onClose={() => { if (txPhase !== "verifying" && txPhase !== "verified") setShowModal(false); }}
          phase={txPhase} error={txError}
          copied={copied} onCopy={handleCopyWallet}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-1">Post a Job</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            Hire verified creators - Payment in USDC, locked on post & released on approval
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
                {jobType === "content"  ? "Brief (what to write about) *" :
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
                    Reward Description{" "}
                    {rewardType === "other"
                      ? <span className="text-red-500">*</span>
                      : <span className="font-normal text-neutral-400">(optional)</span>}
                  </label>
                  <input className="input-field"
                    placeholder={
                      rewardType === "other"
                        ? "Required: describe exactly what the reward is"
                        : "e.g. 1x OG Whitelist for MintProject, 1x NFT from collection XYZ"
                    }
                    value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} />
                  {rewardType === "other" && !rewardDescription.trim() && (
                    <p className="text-[10px] text-red-500 mt-1">Please specify the reward for "Other" type.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Number of Winners *
                  </label>
                  <input className="input-field" type="number" min="1"
                    placeholder="1"
                    value={numCreators}
                    onChange={(e) => setNumCreators(Math.max(1, parseInt(e.target.value) || 1))} />
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                    How many creators will receive the reward?
                  </p>
                </div>

                {/* Proof / Deliverable */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                    Proof / Deliverable Required
                  </label>
                  {/* Always required: URL proof */}
                  <div className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Proof of Interaction</p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Creator must submit a URL (e.g. reply or post link)</p>
                    </div>
                    <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-full px-2 py-0.5">Required</span>
                  </div>
                  {/* Optional extras */}
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-2">Additional info to collect <span className="italic">(optional)</span>:</p>
                  <div className="flex flex-col gap-2">
                    {/* Wallet */}
                    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Wallet Address</p>
                        <Toggle on={requireWallet} onToggle={() => setRequireWallet((v) => !v)} />
                      </div>
                      {requireWallet && (
                        <div className="mt-2.5 flex flex-col gap-2">
                          <div className="flex gap-2">
                            {(["ETH", "SOL", "other"] as const).map((wt) => (
                              <button key={wt} onClick={() => setWalletType(wt)}
                                className={cn("text-[11px] px-3 py-1.5 rounded-lg border transition-all font-medium",
                                  walletType === wt
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                                    : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300")}>
                                {wt === "other" ? "Other" : wt}
                              </button>
                            ))}
                          </div>
                          {walletType === "other" && (
                            <input className="input-field text-xs"
                              placeholder="e.g. BTC, MATIC, TRX..."
                              value={walletTypeOther} onChange={(e) => setWalletTypeOther(e.target.value)} />
                          )}
                        </div>
                      )}
                    </div>
                    {/* Email */}
                    <div className="flex items-center justify-between border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Email Address</p>
                      <Toggle on={requireEmail} onToggle={() => setRequireEmail((v) => !v)} />
                    </div>
                    {/* Discord */}
                    <div className="flex items-center justify-between border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Discord Username</p>
                      <Toggle on={requireDiscord} onToggle={() => setRequireDiscord((v) => !v)} />
                    </div>
                    {/* Telegram */}
                    <div className="flex items-center justify-between border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Telegram Username</p>
                      <Toggle on={requireTelegram} onToggle={() => setRequireTelegram((v) => !v)} />
                    </div>
                  </div>
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
                  <option value="custom">Custom date & time…</option>
                </select>
                {deadline === "custom" && (
                  <input
                    type="datetime-local"
                    className="input-field mt-2"
                    value={deadlineCustom}
                    min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
                    onChange={(e) => setDeadlineCustom(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Creator Requirements ── */}
          <div className="card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Creator Requirements</h3>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Mandatory Blue Verified ?</p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Creators must have a Twitter blue tick</p>
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
            {showTier && activeTiers.length > 0 && (
              <div className="flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                <p>Tier <strong className="text-neutral-700 dark:text-neutral-300">{activeTiers.map((t) => t.label).join(" + ")}</strong></p>
                <p className="text-right">automatically sets the follower requirement.</p>
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

            {/* Tier selector — content & campaign (multi-select) */}
            {showTier && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                  Creator Tier <span className="font-normal text-neutral-400">(select one or more — Macro is solo only)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CREATOR_TIERS.map((tier) => {
                    const active  = selectedTiers.includes(tier.value);
                    const isMacro = tier.price === -1;
                    return (
                      <button key={tier.value} onClick={() => toggleTier(tier.value)}
                        className={cn("p-3 rounded-xl border text-left transition-all",
                          active
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700")}>
                        <p className={cn("text-xs font-bold", active ? "text-blue-700 dark:text-blue-400" : "text-neutral-800 dark:text-neutral-200")}>
                          {tier.label} <span className={cn("font-normal", active ? "text-blue-500 dark:text-blue-400" : "text-neutral-400 dark:text-neutral-500")}>({tier.sub})</span>
                        </p>
                        <p className={cn("text-sm font-extrabold mt-1", active ? "text-blue-600" : "text-neutral-900 dark:text-white")}>
                          {isMacro ? "Custom" : `$${tier.price}`}
                        </p>
                        {isMacro && (
                          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-0.5">solo only</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom price input — only when Macro is selected */}
            {showTier && hasMacro && (
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Custom Price per Creator (USDC) *
                </label>
                <input className="input-field" type="number" min="26" placeholder="min. $26"
                  value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
                {customPrice && parseFloat(customPrice) <= 25 && (
                  <p className="text-[10px] text-red-500 mt-1">
                    Macro tier minimum is $26 USDC (above Mid tier at $25).
                  </p>
                )}
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
                Post Job &amp; Pay ${totalUsdc || "—"} USDC
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
                Send USDC manually to our wallet, then paste the TX hash to verify and post your job.
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
