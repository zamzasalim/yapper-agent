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
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Suspense } from "react";

type JobType = "content" | "repost" | "reply" | "like" | "custom";

const JOB_TYPES: { type: JobType; icon: React.ElementType; label: string; desc: string }[] = [
  { type: "content", icon: FileText, label: "Content", desc: "Write original tweets / threads" },
  { type: "repost", icon: Repeat2, label: "Repost", desc: "Retweet to your audience" },
  { type: "reply", icon: MessageSquare, label: "Reply", desc: "Reply to a specific tweet" },
  { type: "like", icon: Heart, label: "Like", desc: "Like a specific tweet" },
  { type: "custom", icon: HelpCircle, label: "Custom", desc: "Describe your own task" },
];

const ACTION_PRICES: Record<string, number | null> = {
  like: 0.05,
  reply: 0.10,
  repost: 0.50,
  content: null, // follower-based
  custom: null,  // negotiated
};

const FOLLOWER_TIERS = [
  { label: "Content — 0–1K followers", value: "0-1000", price: 5 },
  { label: "Content — 1K–10K followers", value: "1000-10000", price: 10 },
  { label: "Content — 10K–50K followers", value: "10000-50000", price: -1 },
  { label: "Custom / Any", value: "0-99999", price: -1 },
];

function PostJobForm() {
  const { authenticated, login, user } = usePrivy();
  const searchParams = useSearchParams();
  const prefilledCreator = searchParams?.get("creator") ?? "";

  const [jobType, setJobType] = useState<JobType>("content");
  const [isAgentJob, setIsAgentJob] = useState(false);
  const [followerTier, setFollowerTier] = useState("1000-10000");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tweetUrl, setTweetUrl] = useState("");
  const [deadline, setDeadline] = useState("24");
  const [customPrice, setCustomPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const actionPrice = ACTION_PRICES[jobType];
  const selectedTier = FOLLOWER_TIERS.find((t) => t.value === followerTier);
  const price =
    actionPrice !== null
      ? actionPrice
      : selectedTier?.price === -1
        ? parseFloat(customPrice) || 0
        : (selectedTier?.price ?? 0);

  if (!authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] grid-bg">
        <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center max-w-sm mx-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Connect to post a job</h2>
          <p className="text-sm text-neutral-500 mb-6">
            Sign in with Twitter to post jobs and hire creators.
          </p>
          <button onClick={() => login()} className="btn-primary w-full">
            Connect Twitter
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center max-w-sm mx-4">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎉</span>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Job posted!</h2>
          <p className="text-sm text-neutral-500 mb-2">
            Your job has been broadcast to the Yapper Agent Telegram channel.
          </p>
          <p className="text-xs text-neutral-400 mb-6">
            Creators will start accepting within minutes.
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={() => setSubmitted(false)} className="btn-outline text-sm">
              Post Another Job
            </button>
            <a
              href="/jobs"
              className="btn-primary text-sm"
            >
              View All Jobs <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mb-1">
          Post a Job
        </h1>
        <p className="text-neutral-500 text-sm">
          Hire a verified blue-tick creator. Payment in USDC — released on approval.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Job source: Human or Agent */}
        <div className="card p-5">
          <label className="block text-sm font-semibold text-neutral-900 mb-3">Job Posted By</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: false, icon: Users, label: "Human", desc: "You're posting directly" },
              { val: true, icon: Bot, label: "AI Agent", desc: "x402 / MPP agent flow" },
            ].map((opt) => (
              <button
                key={String(opt.val)}
                onClick={() => setIsAgentJob(opt.val)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                  isAgentJob === opt.val
                    ? "border-blue-500 bg-blue-50"
                    : "border-neutral-200 hover:border-neutral-300"
                )}
              >
                <opt.icon
                  className={cn(
                    "w-5 h-5",
                    isAgentJob === opt.val ? "text-blue-600" : "text-neutral-400"
                  )}
                />
                <div>
                  <p className={cn("text-sm font-semibold", isAgentJob === opt.val ? "text-blue-700" : "text-neutral-700")}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-neutral-400">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Job type */}
        <div className="card p-5">
          <label className="block text-sm font-semibold text-neutral-900 mb-3">Job Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {JOB_TYPES.map((jt) => (
              <button
                key={jt.type}
                onClick={() => setJobType(jt.type)}
                className={cn(
                  "flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all",
                  jobType === jt.type
                    ? "border-blue-500 bg-blue-50"
                    : "border-neutral-200 hover:border-neutral-300"
                )}
              >
                <jt.icon
                  className={cn(
                    "w-4 h-4",
                    jobType === jt.type ? "text-blue-600" : "text-neutral-400"
                  )}
                />
                <p className={cn("text-xs font-semibold", jobType === jt.type ? "text-blue-700" : "text-neutral-700")}>
                  {jt.label}
                </p>
                <p className="text-[10px] text-neutral-400">{jt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="card p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-neutral-900">Job Details</h3>

          {prefilledCreator && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
              <Info className="w-4 h-4 shrink-0" />
              Hiring <strong>@{prefilledCreator}</strong> directly
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Job Title *</label>
            <input
              className="input-field"
              placeholder="e.g. Repost our Solana launch tweet"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
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
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Deadline
            </label>
            <select
              className="input-field"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            >
              <option value="3">3 hours</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
            </select>
          </div>
        </div>

        {/* Follower tier + pricing */}
        <div className="card p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-neutral-900">Creator Tier & Budget</h3>

          {/* Action-based jobs have fixed prices */}
          {actionPrice !== null ? (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-sm text-blue-700">
                Fixed rate for <strong>{jobType}</strong>:{" "}
                <strong>${actionPrice.toFixed(2)} USDC</strong> per action.
                Price applies to all verified creators.
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
                      ? "border-blue-500 bg-blue-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <p className={cn("text-xs font-semibold", followerTier === tier.value ? "text-blue-700" : "text-neutral-700")}>
                    {tier.label}
                  </p>
                  <p className={cn("text-sm font-bold mt-0.5", followerTier === tier.value ? "text-blue-600" : "text-neutral-900")}>
                    {tier.price === -1 ? "Custom price" : `$${tier.price} USDC`}
                  </p>
                </button>
              ))}
            </div>
          )}

          {actionPrice === null && selectedTier?.price === -1 && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Custom Price (USDC) *
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

          {/* Summary */}
          <div className="bg-neutral-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500">You pay (locked in escrow)</p>
              <p className="text-xl font-extrabold text-neutral-900">
                {price ? `$${price < 1 ? price.toFixed(2) : price}` : "—"}{" "}
                <span className="text-sm font-normal text-neutral-400">USDC</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">Creator receives</p>
              <p className="text-lg font-bold text-green-600">
                {price ? `$${price < 1 ? price.toFixed(2) : price}` : "—"}{" "}
                <span className="text-sm font-normal text-neutral-400">USDC</span>
              </p>
              <p className="text-[10px] text-neutral-400">0% platform fee</p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          className="btn-primary text-sm py-3 w-full"
          onClick={() => {
            if (!title || !description) return;
            setSubmitted(true);
          }}
        >
          Post Job &amp; Lock USDC
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-center text-xs text-neutral-400">
          USDC is held in escrow and released when you approve the creator&apos;s proof.
          Job will be broadcast to the Telegram channel instantly.
        </p>
      </div>
    </div>
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
