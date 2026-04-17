"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Navbar } from "@/components/Navbar";
import { CheckCircle2, XCircle, Loader2, ShieldAlert, Clock, Zap } from "lucide-react";

const ADMINS = ["Autosultan_team", "0xhnfdm"];

interface PendingJob {
  id: string;
  created_at: string;
  type: string;
  title: string;
  description: string;
  is_agent_job: boolean;
  deadline_hours: number;
  client: { twitter_handle: string; display_name: string; avatar_url: string | null } | null;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminPage() {
  const { authenticated, login, user } = usePrivy();

  const twitterHandle =
    ((user?.linkedAccounts ?? []).find((a: any) => a.type === "twitter_oauth") as any)?.username ??
    (user as any)?.twitter?.username ?? "";

  const isAdmin = ADMINS.some((a) => a.toLowerCase() === twitterHandle.toLowerCase());

  const [jobs, setJobs]       = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing]   = useState<string | null>(null); // job id being acted on

  useEffect(() => {
    if (!isAdmin || !twitterHandle) return;
    setLoading(true);
    fetch(`/api/admin/jobs?admin_handle=${twitterHandle}`)
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .finally(() => setLoading(false));
  }, [isAdmin, twitterHandle]);

  async function handleAction(jobId: string, action: "approve" | "reject") {
    setActing(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_handle: twitterHandle, action }),
      });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      }
    } finally {
      setActing(null);
    }
  }

  if (!authenticated) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="card p-10 text-center max-w-sm mx-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Admin Login Required</h2>
            <button onClick={() => login()} className="btn-primary w-full">Connect X</button>
          </div>
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="card p-10 text-center max-w-sm mx-4">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              This page is only accessible to <strong>@Autosultan_team</strong> and <strong>@0xhnfdm</strong>.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-1">
            Admin — Pending Jobs
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Custom jobs waiting for approval. Logged in as <strong>@{twitterHandle}</strong>.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-neutral-400 dark:text-neutral-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="card p-12 text-center text-neutral-400 dark:text-neutral-500">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No pending jobs. All clear!</p>
          </div>
        )}

        {!loading && jobs.length > 0 && (
          <div className="flex flex-col gap-4">
            {jobs.map((job) => (
              <div key={job.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        ⏳ pending
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {timeAgo(job.created_at)}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        @{job.client?.twitter_handle ?? "unknown"}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-neutral-900 dark:text-white text-sm mb-1">{job.title}</h3>

                    {/* Description */}
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(job.id, "approve")}
                      disabled={acting === job.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                    >
                      {acting === job.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(job.id, "reject")}
                      disabled={acting === job.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50"
                    >
                      {acting === job.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <XCircle className="w-3.5 h-3.5" />}
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
