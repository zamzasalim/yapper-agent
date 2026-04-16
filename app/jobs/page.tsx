export const revalidate = 60; // ISR: cache page for 60 seconds

import { Navbar } from "@/components/Navbar";
import { JobsClient } from "@/components/JobsClient";
import { Bot, Users, Briefcase } from "lucide-react";
import { createServerClient } from "@/lib/supabase";

type JobType = "content" | "repost" | "like_reply" | "campaign" | "custom";

interface RawJob {
  id: string;
  created_at: string;
  type: JobType;
  status: string;
  title: string;
  description: string;
  price_usdc: number;
  tweet_url: string | null;
  is_agent_job: boolean;
  deadline_hours: number;
  client: { twitter_handle: string; display_name: string } | null;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function getJobs(): Promise<RawJob[] | null> {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("jobs")
      .select(
        `id, created_at, type, status, title, description,
         price_usdc, tweet_url, is_agent_job, deadline_hours,
         client:users!client_id(twitter_handle, display_name)`
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return null;
    return (data as unknown as RawJob[]) ?? null;
  } catch {
    return null;
  }
}

export default async function JobsPage() {
  const rawJobs = await getJobs();
  const jobs = (rawJobs ?? []).map((j) => ({
    id: j.id,
    type: j.type,
    title: j.title,
    description: j.description,
    priceUsdc: j.price_usdc,
    status: j.status as "open",
    isAgentJob: j.is_agent_job,
    clientHandle: j.client?.twitter_handle ?? "unknown",
    deadline: `${j.deadline_hours}h`,
    postedAt: timeAgo(j.created_at),
  }));

  const agentCount = jobs.filter((j) => j.isAgentJob).length;
  const humanCount = jobs.filter((j) => !j.isAgentJob).length;
  const isLive = rawJobs !== null;

  // ── Empty state: full-page centered ─────────────────────────────────────
  if (jobs.length === 0) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
          <Briefcase className="w-14 h-14 mb-5 text-neutral-300 dark:text-neutral-700" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2">
            Open Jobs
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">No open jobs yet</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-8">
            Be the first to post a job and hire verified creators.
          </p>
          <a href="/post-job" className="btn-primary text-sm px-8">
            Post a Job
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-1">
              Open Jobs
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm flex items-center gap-2">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""} available
              {isLive && (
                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                  <span className="dot-live" /> Live
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2">
            <Bot className="w-3.5 h-3.5 text-emerald-500" />
            <span>Agent: {agentCount}</span>
            <span className="w-px h-3.5 bg-neutral-200 dark:bg-neutral-700" />
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span>Human: {humanCount}</span>
          </div>
        </div>

        <JobsClient jobs={jobs} />
      </div>
    </>
  );
}
