"use client";

import { Bot, Users, Clock, CheckCircle2, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/cn";

type JobType = "content" | "repost" | "reply" | "like" | "custom";
type JobStatus = "open" | "in_progress" | "completed" | "cancelled";

interface Job {
  id: string;
  type: JobType;
  title: string;
  description: string;
  priceUsdc: number;
  status: JobStatus;
  isAgentJob: boolean;
  clientHandle: string;
  minFollowers: number;
  maxFollowers: number;
  deadline: string;
  postedAt: string;
}

const TYPE_ICON: Record<JobType, string> = {
  content: "✍️",
  repost: "🔁",
  reply: "💬",
  like: "❤️",
  custom: "⚡",
};

const TYPE_COLOR: Record<JobType, string> = {
  content: "text-violet-600 bg-violet-50",
  repost: "text-blue-600 bg-blue-50",
  reply: "text-sky-600 bg-sky-50",
  like: "text-pink-600 bg-pink-50",
  custom: "text-amber-600 bg-amber-50",
};

function formatFollowerRange(min: number, max: number) {
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toString());
  if (max >= 99999) return `${fmt(min)}+`;
  return `${fmt(min)} – ${fmt(max)}`;
}

export function JobCard({ job }: { job: Job }) {
  return (
    <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-5">
      {/* Left */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={cn("tag text-[10px] px-2 py-0.5", TYPE_COLOR[job.type])}>
            {TYPE_ICON[job.type]} {job.type}
          </span>

          {job.isAgentJob ? (
            <span className="tag text-[10px] px-2 py-0.5 text-emerald-700 bg-emerald-50 border-emerald-200 flex items-center gap-0.5">
              <Bot className="w-3 h-3" /> Agent Job
            </span>
          ) : (
            <span className="tag text-[10px] px-2 py-0.5 text-blue-700 bg-blue-50 border-blue-200 flex items-center gap-0.5">
              <Users className="w-3 h-3" /> Human
            </span>
          )}

          <span className="text-[10px] text-neutral-400">@{job.clientHandle}</span>
          <span className="text-[10px] text-neutral-400">{job.postedAt}</span>
        </div>

        <h3 className="font-semibold text-neutral-900 text-sm mb-1 truncate">{job.title}</h3>
        <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{job.description}</p>

        <div className="flex items-center gap-4 mt-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-400" />
            {formatFollowerRange(job.minFollowers, job.maxFollowers)} followers
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {job.deadline} deadline
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
        <div className="text-right">
          <p className="text-xl font-extrabold text-neutral-900">
            ${job.priceUsdc < 1 ? job.priceUsdc.toFixed(2) : job.priceUsdc}
          </p>
          <p className="text-xs text-neutral-400">USDC</p>
        </div>

        <button className="btn-primary text-xs px-4 py-2.5">
          {job.isAgentJob ? (
            <>
              <Zap className="w-3.5 h-3.5" /> Accept
            </>
          ) : (
            <>
              Accept <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
