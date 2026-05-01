"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { JobCard } from "./JobCard";
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

const TYPE_FILTERS = ["All", "Content", "Retweet", "Like & Reply", "Campaign", "Custom", "Agent Jobs"];
const STATUS_TABS: { label: string; value: "all" | "open" | "in_progress" }[] = [
  { label: "All",         value: "all"         },
  { label: "Available",   value: "open"        },
  { label: "In Progress", value: "in_progress" },
];

export function JobsClient({ jobs }: { jobs: Job[] }) {
  const [query, setQuery]               = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [statusTab, setStatusTab]       = useState<"all" | "open" | "in_progress">("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return jobs.filter((j) => {
      const matchesStatus = statusTab === "all" || j.status === statusTab;
      const matchesQuery  =
        !q ||
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q);
      const filterToType: Record<string, string> = { "Like & Reply": "like_reply" };
      const matchesType =
        activeFilter === "All" ||
        (activeFilter === "Agent Jobs"
          ? j.isAgentJob
          : j.type === (filterToType[activeFilter] ?? activeFilter.toLowerCase()));
      return matchesStatus && matchesQuery && matchesType;
    });
  }, [jobs, query, activeFilter, statusTab]);

  const openCount       = jobs.filter((j) => j.status === "open").length;
  const inProgressCount = jobs.filter((j) => j.status === "in_progress").length;

  return (
    <>
      {/* Row 1: Search + Status tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          <input
            type="text"
            aria-label="Search jobs"
            placeholder="Search jobs..."
            className="input-field text-sm"
            style={{ paddingLeft: "2rem", height: "36px" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900 rounded-xl p-1 overflow-x-auto scrollbar-none shrink-0">
          {STATUS_TABS.map((t) => {
            const count = t.value === "open" ? openCount : t.value === "in_progress" ? inProgressCount : jobs.length;
            return (
              <button
                key={t.value}
                onClick={() => setStatusTab(t.value)}
                className={cn(
                  "text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1",
                  statusTab === t.value
                    ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {t.label}
                <span className={cn(
                  "text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none",
                  statusTab === t.value
                    ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                    : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Type filter pills (scrollable) */}
      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-none w-full">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "inline-flex items-center shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer",
              activeFilter === f
                ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600"
                : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-transparent hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Job grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-neutral-400 dark:text-neutral-500">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No jobs match your filters.</p>
          <button
            onClick={() => { setQuery(""); setActiveFilter("All"); setStatusTab("all"); }}
            className="text-xs text-blue-500 hover:underline mt-2 block mx-auto"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
