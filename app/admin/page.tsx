"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Navbar } from "@/components/Navbar";
import {
  CheckCircle2, XCircle, Loader2, ShieldAlert, Clock,
  Zap, Download, ExternalLink, Users,
} from "lucide-react";

const ADMINS = ["Autosultan_team", "0xhnfdm"];

// ── Types ──────────────────────────────────────────────────────────────────────
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

interface CompletedJob {
  id: string;
  created_at: string;
  type: string;
  title: string;
  price_usdc: number;
  proof_url: string | null;
  client:  { twitter_handle: string; display_name: string } | null;
  creator: { twitter_handle: string; display_name: string; wallet_address: string } | null;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_LABEL: Record<string, string> = {
  content: "Content", repost: "Repost", like_reply: "Like & Reply",
  campaign: "Campaign", custom: "Custom",
};

// ── Excel export (client-side via SheetJS) ─────────────────────────────────────
async function downloadExcel(jobs: CompletedJob[]) {
  const XLSX = await import("xlsx");
  const rows = jobs.map((j) => ({
    "Job ID":          j.id,
    "Job Type":        TYPE_LABEL[j.type] ?? j.type,
    "Job Title":       j.title,
    "Amount (USDC)":   j.price_usdc,
    "Creator Handle":  j.creator?.twitter_handle ?? "",
    "Creator Name":    j.creator?.display_name   ?? "",
    "SOL Wallet":      j.creator?.wallet_address  ?? "",
    "Proof Link":      j.proof_url ?? "",
    "Client Handle":   j.client?.twitter_handle  ?? "",
    "Completed At":    new Date(j.created_at).toLocaleString(),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  // Column widths
  ws["!cols"] = [
    { wch: 38 }, { wch: 12 }, { wch: 30 }, { wch: 14 },
    { wch: 20 }, { wch: 22 }, { wch: 46 }, { wch: 55 },
    { wch: 20 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Completed Jobs");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `yapper-payout-${date}.xlsx`);
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { authenticated, login, user } = usePrivy();

  const twitterHandle =
    ((user?.linkedAccounts ?? []).find((a: any) => a.type === "twitter_oauth") as any)?.username ??
    (user as any)?.twitter?.username ?? "";

  const isAdmin = ADMINS.some((a) => a.toLowerCase() === twitterHandle.toLowerCase());

  const [tab, setTab]                   = useState<"pending" | "completed">("pending");
  const [pending, setPending]           = useState<PendingJob[]>([]);
  const [completed, setCompleted]       = useState<CompletedJob[]>([]);
  const [loadingPending, setLoadingP]   = useState(false);
  const [loadingCompleted, setLoadingC] = useState(false);
  const [acting, setActing]             = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !twitterHandle) return;
    setLoadingP(true);
    fetch(`/api/admin/jobs?admin_handle=${twitterHandle}`)
      .then((r) => r.json())
      .then((d) => setPending(d.jobs ?? []))
      .finally(() => setLoadingP(false));
  }, [isAdmin, twitterHandle]);

  useEffect(() => {
    if (!isAdmin || !twitterHandle || tab !== "completed") return;
    if (completed.length > 0) return; // already loaded
    setLoadingC(true);
    fetch(`/api/admin/completed-jobs?admin_handle=${twitterHandle}`)
      .then((r) => r.json())
      .then((d) => setCompleted(d.jobs ?? []))
      .finally(() => setLoadingC(false));
  }, [isAdmin, twitterHandle, tab]);

  async function handleAction(jobId: string, action: "approve" | "reject") {
    setActing(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_handle: twitterHandle, action }),
      });
      if (res.ok) setPending((prev) => prev.filter((j) => j.id !== jobId));
    } finally {
      setActing(null);
    }
  }

  // ── Auth guards ──────────────────────────────────────────────────────────────
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

  // ── Main UI ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-1">
              Admin Panel
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Logged in as <strong>@{twitterHandle}</strong>
            </p>
          </div>

          {tab === "completed" && completed.length > 0 && (
            <button
              onClick={() => downloadExcel(completed)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download Excel
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-neutral-100 dark:bg-neutral-900 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab("pending")}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              tab === "pending"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Pending
            {pending.length > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5">
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              tab === "completed"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Completed Jobs
          </button>
        </div>

        {/* ── PENDING TAB ── */}
        {tab === "pending" && (
          <>
            {loadingPending && (
              <div className="flex items-center justify-center py-20 text-neutral-400 dark:text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Loading…</span>
              </div>
            )}
            {!loadingPending && pending.length === 0 && (
              <div className="card p-12 text-center text-neutral-400 dark:text-neutral-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending jobs. All clear!</p>
              </div>
            )}
            {!loadingPending && pending.length > 0 && (
              <div className="flex flex-col gap-4">
                {pending.map((job) => (
                  <div key={job.id} className="card p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
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
                        <h3 className="font-semibold text-neutral-900 dark:text-white text-sm mb-1">{job.title}</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed">
                          {job.description}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleAction(job.id, "approve")}
                          disabled={acting === job.id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                        >
                          {acting === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(job.id, "reject")}
                          disabled={acting === job.id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50"
                        >
                          {acting === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── COMPLETED TAB ── */}
        {tab === "completed" && (
          <>
            {loadingCompleted && (
              <div className="flex items-center justify-center py-20 text-neutral-400 dark:text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Loading…</span>
              </div>
            )}
            {!loadingCompleted && completed.length === 0 && (
              <div className="card p-12 text-center text-neutral-400 dark:text-neutral-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No completed jobs yet.</p>
              </div>
            )}
            {!loadingCompleted && completed.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Creator</th>
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Job</th>
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Amount</th>
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">SOL Wallet</th>
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Proof</th>
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {completed.map((job) => (
                      <tr key={job.id} className="bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            {job.creator?.display_name ?? "—"}
                          </p>
                          <p className="text-neutral-400 dark:text-neutral-500">
                            @{job.creator?.twitter_handle ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">
                            {job.title}
                          </p>
                          <p className="text-neutral-400 dark:text-neutral-500">
                            {TYPE_LABEL[job.type] ?? job.type}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white whitespace-nowrap">
                          ${job.price_usdc} USDC
                        </td>
                        <td className="px-4 py-3">
                          {job.creator?.wallet_address ? (
                            <span className="font-mono text-[10px] text-neutral-600 dark:text-neutral-400 break-all">
                              {job.creator.wallet_address}
                            </span>
                          ) : (
                            <span className="text-neutral-300 dark:text-neutral-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {job.proof_url ? (
                            <a
                              href={job.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[120px]">View</span>
                            </a>
                          ) : (
                            <span className="text-neutral-300 dark:text-neutral-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                          {timeAgo(job.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
