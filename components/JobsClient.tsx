"use client";

import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { JobCard } from "./JobCard";
import { cn } from "@/lib/cn";

type JobType   = "content" | "repost" | "reply" | "like" | "custom";
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
  minFollowers?: number;
  maxFollowers?: number;
  deadline: string;
  postedAt: string;
}

const TYPE_FILTERS = ["All", "Content", "Repost", "Reply", "Like", "Custom", "Agent Jobs"];

export function JobsClient({ jobs }: { jobs: Job[] }) {
  const [query, setQuery]               = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return jobs.filter((j) => {
      const matchesQuery =
        !q ||
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.clientHandle.toLowerCase().includes(q);
      const matchesType =
        activeFilter === "All" ||
        (activeFilter === "Agent Jobs"
          ? j.isAgentJob
          : j.type === activeFilter.toLowerCase());
      return matchesQuery && matchesType;
    });
  }, [jobs, query, activeFilter]);

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          <input
            type="text"
            aria-label="Search jobs"
            placeholder="Search jobs..."
            className="input-field"
            style={{ paddingLeft: "2.25rem" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "tag cursor-pointer transition-colors text-xs",
                activeFilter === f
                  ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                  : "hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              )}
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

      {/* Job list */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-neutral-400 dark:text-neutral-500">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No jobs match your search.</p>
          <button
            onClick={() => { setQuery(""); setActiveFilter("All"); }}
            className="text-xs text-blue-500 hover:underline mt-2 block mx-auto"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
