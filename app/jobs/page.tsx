import { Navbar } from "@/components/Navbar";
import { JobCard } from "@/components/JobCard";
import { Search, Bot, Users, Filter, Briefcase } from "lucide-react";
import { createServerClient } from "@/lib/supabase";

type JobType = "content" | "repost" | "reply" | "like" | "custom";

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

const TYPE_FILTERS = ["All", "Content", "Repost", "Reply", "Like", "Custom", "Agent Jobs"];

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
              {jobs.length > 0
                ? `${jobs.length} job${jobs.length !== 1 ? "s" : ""} available`
                : "No open jobs yet"}
              {isLive && (
                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                  <span className="dot-live" /> Live
                </span>
              )}
            </p>
          </div>

          {jobs.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2">
              <Bot className="w-3.5 h-3.5 text-emerald-500" />
              <span>Agent: {agentCount}</span>
              <span className="w-px h-3.5 bg-neutral-200 dark:bg-neutral-700" />
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span>Human: {humanCount}</span>
            </div>
          )}
        </div>

        {/* Filter bar */}
        {jobs.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
              <input
                type="text"
                placeholder="Search jobs..."
                className="input-field pl-9"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f}
                  className="tag cursor-pointer hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors text-xs"
                >
                  {f}
                </button>
              ))}
              <button className="btn-outline text-xs px-3 py-2 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Filter
              </button>
            </div>
          </div>
        )}

        {/* Job list */}
        {jobs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="text-center py-28 text-neutral-400 dark:text-neutral-500">
            <Briefcase className="w-10 h-10 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium mb-1">No open jobs yet</p>
            <p className="text-xs mb-6">Be the first to post a job and hire verified creators.</p>
            <a href="/post-job" className="btn-primary text-sm px-6">
              Post a Job
            </a>
          </div>
        )}
      </div>
    </>
  );
}
