"use client";

import { useEffect, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { Navbar } from "@/components/Navbar";
import {
  CheckCircle2, XCircle, Loader2, ShieldAlert, Clock,
  Zap, Download, ExternalLink, Users, Trash2, EyeOff, Eye,
  ChevronDown, ChevronUp, Copy, Check,
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
  require_blue: boolean;
  min_followers: number;
  client: { twitter_handle: string; display_name: string; avatar_url: string | null } | null;
}

interface ActiveJob {
  id: string;
  created_at: string;
  type: string;
  status: string;
  title: string;
  price_usdc: number;
  is_hidden: boolean;
  client: { twitter_handle: string; display_name: string } | null;
}

interface AdditionalInfo {
  wallet?: string;
  email?: string;
  discord?: string;
  telegram?: string;
}

interface CompletedJob {
  id: string;
  created_at: string;
  type: string;
  title: string;
  price_usdc: number;
  proof_url: string | null;
  is_paid: boolean;
  additional_info: AdditionalInfo | null;
  client:  { twitter_handle: string; display_name: string } | null;
  creator: { twitter_handle: string; display_name: string; wallet_address: string } | null;
}

function parseDesc(description: string) {
  const cleaned = (description ?? "").replace(/^\[S&K:[^\]]+\]\n\n/, "").trim();
  const [brief, metaRaw] = cleaned.split(/\n\n?---\n/);
  const meta = (metaRaw ?? "").split("\n").filter(Boolean).map((line) => {
    const idx = line.indexOf(": ");
    return idx > -1 ? { label: line.slice(0, idx), value: line.slice(idx + 2) } : null;
  }).filter(Boolean) as { label: string; value: string }[];
  return { brief: brief?.trim() ?? "", meta };
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

// ── Excel export per job ───────────────────────────────────────────────────────
async function downloadJobExcel(job: CompletedJob) {
  const XLSX = await import("xlsx");
  const info = job.additional_info ?? {};
  const rows = [{
    "Job ID":         job.id,
    "Job Type":       TYPE_LABEL[job.type] ?? job.type,
    "Job Title":      job.title,
    "Amount (USDC)":  job.price_usdc,
    "Creator Handle": job.creator?.twitter_handle ?? "",
    "Creator Name":   job.creator?.display_name   ?? "",
    "SOL Wallet":     job.creator?.wallet_address  ?? "",
    "Proof Link":     job.proof_url ?? "",
    "Client Handle":  job.client?.twitter_handle  ?? "",
    "Completed At":   new Date(job.created_at).toLocaleString(),
    ...(info.wallet   ? { "Wallet (additional)": info.wallet }   : {}),
    ...(info.email    ? { "Email":               info.email }    : {}),
    ...(info.discord  ? { "Discord":             info.discord }  : {}),
    ...(info.telegram ? { "Telegram":            info.telegram } : {}),
  }];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 38 }, { wch: 12 }, { wch: 30 }, { wch: 14 },
    { wch: 20 }, { wch: 22 }, { wch: 46 }, { wch: 55 },
    { wch: 20 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payout");
  XLSX.writeFile(wb, `payout-${job.id.slice(0, 8)}.xlsx`);
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { open } = useAppKit();
  const { isConnected, embeddedWalletInfo } = useAppKitAccount();
  const authenticated = isConnected && embeddedWalletInfo?.authProvider === "x";
  const twitterHandle = embeddedWalletInfo?.user?.username ?? "";

  const isAdmin = ADMINS.some((a) => a.toLowerCase() === twitterHandle.toLowerCase());

  const [tab, setTab]                   = useState<"pending" | "active" | "completed">("pending");
  const [pending, setPending]           = useState<PendingJob[]>([]);
  const [active, setActive]             = useState<ActiveJob[]>([]);
  const [completed, setCompleted]       = useState<CompletedJob[]>([]);
  const [loadingPending, setLoadingP]   = useState(false);
  const [loadingActive, setLoadingA]    = useState(false);
  const [loadingCompleted, setLoadingC] = useState(false);
  const [acting, setActing]             = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [toggling, setToggling]         = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState("all");
  const [expandedJobs, setExpandedJobs]         = useState<Set<string>>(new Set());
  const [copiedWallet, setCopiedWallet]         = useState<string | null>(null);
  const [markingPaid, setMarkingPaid]           = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function copyWallet(address: string, jobId: string) {
    navigator.clipboard.writeText(address);
    setCopiedWallet(jobId);
    setTimeout(() => setCopiedWallet(null), 1500);
  }

  function copyAllWallets(jobId: string, wallet: string) {
    navigator.clipboard.writeText(wallet);
    setCopiedWallet(`all-${jobId}`);
    setTimeout(() => setCopiedWallet(null), 1500);
  }

  async function handleTogglePaid(job: CompletedJob) {
    setMarkingPaid(job.id);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}?admin_handle=${twitterHandle}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paid: !job.is_paid }),
      });
      if (res.ok) {
        setCompleted((prev) =>
          prev.map((j) => j.id === job.id ? { ...j, is_paid: !job.is_paid } : j)
        );
      }
    } finally {
      setMarkingPaid(null);
    }
  }

  useEffect(() => {
    if (!isAdmin || !twitterHandle) return;
    setLoadingP(true);
    fetch(`/api/admin/jobs?admin_handle=${twitterHandle}`)
      .then((r) => r.json())
      .then((d) => setPending(d.jobs ?? []))
      .finally(() => setLoadingP(false));
  }, [isAdmin, twitterHandle]);

  useEffect(() => {
    if (!isAdmin || !twitterHandle || tab !== "active") return;
    setLoadingA(true);
    fetch(`/api/admin/jobs?admin_handle=${twitterHandle}&status=active`)
      .then((r) => r.json())
      .then((d) => setActive(d.jobs ?? []))
      .finally(() => setLoadingA(false));
  }, [isAdmin, twitterHandle, tab]);

  useEffect(() => {
    if (!isAdmin || !twitterHandle || tab !== "completed") return;
    if (completed.length > 0) return; // already loaded
    setLoadingC(true);
    fetch(`/api/admin/completed-jobs?admin_handle=${twitterHandle}`)
      .then((r) => r.json())
      .then((d) => setCompleted(d.jobs ?? []))
      .finally(() => setLoadingC(false));
  }, [isAdmin, twitterHandle, tab]);

  async function handleToggleHidden(jobId: string, currentHidden: boolean) {
    setToggling(jobId);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}?admin_handle=${twitterHandle}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !currentHidden }),
      });
      if (res.ok) {
        setActive((prev) =>
          prev.map((j) => j.id === jobId ? { ...j, is_hidden: !currentHidden } : j)
        );
      }
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm("Delete this job permanently?")) return;
    setDeleting(jobId);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}?admin_handle=${twitterHandle}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPending((prev) => prev.filter((j) => j.id !== jobId));
        setCompleted((prev) => prev.filter((j) => j.id !== jobId));
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleAction(jobId: string, action: "approve" | "reject") {
    setActing({ id: jobId, action });
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
            <button onClick={() => open()} className="btn-primary w-full">Connect X</button>
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
            onClick={() => setTab("active")}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              tab === "active"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Active Jobs
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
                        {(() => {
                          const { brief, meta } = parseDesc(job.description);
                          const reward    = meta.find((m) => m.label === "Reward");
                          const proof     = meta.find((m) => m.label === "Proof required");
                          const access    = job.require_blue ? "Blue Verified only" : "Everyone";
                          const followers = job.min_followers > 0
                            ? job.min_followers >= 1000
                              ? `${(job.min_followers / 1000).toFixed(0)}K+ followers`
                              : `${job.min_followers}+ followers`
                            : null;
                          return (
                            <div className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 flex flex-col gap-1">
                              <p>Title: <span className="text-neutral-700 dark:text-neutral-200">{job.title}</span></p>
                              <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
                              <p>Brief: <span className="text-neutral-700 dark:text-neutral-200">{brief}</span></p>
                              {reward  && <p>Reward: <span className="text-neutral-700 dark:text-neutral-200">{reward.value}</span></p>}
                              {proof   && <p>Proof: <span className="text-neutral-700 dark:text-neutral-200">{proof.value}</span></p>}
                              <p>Creator: <span className="text-neutral-700 dark:text-neutral-200">{access}{followers ? `, ${followers}` : ""}</span></p>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleAction(job.id, "approve")}
                          disabled={acting?.id === job.id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                        >
                          {acting?.id === job.id && acting.action === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(job.id, "reject")}
                          disabled={acting?.id === job.id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50"
                        >
                          {acting?.id === job.id && acting.action === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Reject
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          disabled={deleting === job.id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-950 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 border border-neutral-200 dark:border-neutral-700 transition-colors disabled:opacity-50"
                        >
                          {deleting === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ACTIVE JOBS TAB ── */}
        {tab === "active" && (
          <>
            {loadingActive && (
              <div className="flex items-center justify-center py-20 text-neutral-400 dark:text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Loading…</span>
              </div>
            )}
            {!loadingActive && active.length === 0 && (
              <div className="card p-12 text-center text-neutral-400 dark:text-neutral-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active jobs.</p>
              </div>
            )}
            {!loadingActive && active.length > 0 && (
              <>
                {/* Type filter */}
                <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
                  {["all", "repost", "like_reply", "content", "campaign", "custom"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTypeFilter(t)}
                      className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                        activeTypeFilter === t
                          ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"
                      }`}
                    >
                      {t === "all" ? "All" : TYPE_LABEL[t] ?? t}
                    </button>
                  ))}
                </div>

              <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Job</th>
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Client</th>
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Amount</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {active.filter((j) => activeTypeFilter === "all" || j.type === activeTypeFilter).map((job) => (
                      <tr key={job.id} className={`bg-white dark:bg-neutral-950 transition-colors ${job.is_hidden ? "opacity-50" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">{job.title}</p>
                          <p className="text-neutral-400 dark:text-neutral-500">{TYPE_LABEL[job.type] ?? job.type}</p>
                        </td>
                        <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                          @{job.client?.twitter_handle ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            job.is_hidden
                              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700"
                              : job.status === "in_progress"
                              ? "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                              : "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                          }`}>
                            {job.is_hidden ? <><EyeOff className="w-2.5 h-2.5" /> Hidden</> : job.status === "in_progress" ? "In Progress" : "Open"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white whitespace-nowrap">
                          ${job.price_usdc} USDC
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => handleToggleHidden(job.id, job.is_hidden)}
                              disabled={toggling === job.id}
                              title={job.is_hidden ? "Show" : "Hide"}
                              className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
                            >
                              {toggling === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : job.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleDelete(job.id)}
                              disabled={deleting === job.id}
                              title="Delete"
                              className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40"
                            >
                              {deleting === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
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
              <>
              <div className="flex flex-col gap-3">
                {completed.map((job) => {
                  const isOpen = expandedJobs.has(job.id);
                  return (
                    <div key={job.id} className="card overflow-hidden">
                      {/* Job header */}
                      <div className="flex items-center gap-3 px-5 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-sm text-neutral-900 dark:text-white truncate">{job.title}</p>
                            {job.is_paid && (
                              <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                                Paid
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">
                            {TYPE_LABEL[job.type] ?? job.type} · ${job.price_usdc} USDC · @{job.client?.twitter_handle ?? "—"} · {timeAgo(job.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleTogglePaid(job)}
                          disabled={markingPaid === job.id}
                          title={job.is_paid ? "Mark as Unpaid" : "Mark as Paid"}
                          className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                            job.is_paid
                              ? "text-green-500 hover:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              : "text-neutral-300 dark:text-neutral-700 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950"
                          }`}
                        >
                          {markingPaid === job.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => job.creator?.wallet_address && copyAllWallets(job.id, job.creator.wallet_address)}
                          disabled={!job.creator?.wallet_address}
                          title="Copy Wallet"
                          className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors shrink-0"
                        >
                          {copiedWallet === `all-${job.id}`
                            ? <Check className="w-4 h-4 text-green-500" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => downloadJobExcel(job)}
                          title="Export Excel"
                          className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors shrink-0"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          disabled={deleting === job.id}
                          title="Delete"
                          className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40 shrink-0"
                        >
                          {deleting === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => toggleExpand(job.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Creator details (expanded) */}
                      {isOpen && (
                        <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                          {job.creator ? (
                            <>
                              {/* Additional info (wallet/email/discord/telegram) if present */}
                              {job.additional_info && Object.keys(job.additional_info).length > 0 && (
                                <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-2.5 text-xs border-b border-neutral-100 dark:border-neutral-800">
                                  {job.additional_info.wallet   && <span className="text-neutral-500 dark:text-neutral-400">💳 <span className="font-mono text-neutral-700 dark:text-neutral-200">{job.additional_info.wallet}</span></span>}
                                  {job.additional_info.email    && <span className="text-neutral-500 dark:text-neutral-400">📧 <span className="text-neutral-700 dark:text-neutral-200">{job.additional_info.email}</span></span>}
                                  {job.additional_info.discord  && <span className="text-neutral-500 dark:text-neutral-400">🎮 <span className="text-neutral-700 dark:text-neutral-200">{job.additional_info.discord}</span></span>}
                                  {job.additional_info.telegram && <span className="text-neutral-500 dark:text-neutral-400">✈️ <span className="text-neutral-700 dark:text-neutral-200">{job.additional_info.telegram}</span></span>}
                                </div>
                              )}
                              {/* Single row: creator · proof · wallet */}
                              <div className="flex items-center gap-3 px-5 py-3 text-xs">
                                <span className="font-medium text-neutral-800 dark:text-neutral-200 shrink-0">
                                  @{job.creator.twitter_handle}
                                </span>
                                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                                {job.proof_url ? (
                                  <a href={job.proof_url} target="_blank" rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline flex items-center gap-1 shrink-0">
                                    <ExternalLink className="w-3 h-3" /> Proof
                                  </a>
                                ) : (
                                  <span className="text-neutral-300 dark:text-neutral-700 shrink-0">No proof</span>
                                )}
                                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                                {job.creator.wallet_address ? (
                                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-600 dark:text-neutral-400 min-w-0">
                                    <span className="truncate">{job.creator.wallet_address}</span>
                                    <button
                                      onClick={() => copyWallet(job.creator!.wallet_address, job.id)}
                                      className="shrink-0 text-neutral-400 hover:text-blue-500 transition-colors"
                                    >
                                      {copiedWallet === job.id
                                        ? <Check className="w-3 h-3 text-green-500" />
                                        : <Copy className="w-3 h-3" />}
                                    </button>
                                  </span>
                                ) : (
                                  <span className="text-neutral-300 dark:text-neutral-700 text-[10px]">No wallet</span>
                                )}
                              </div>
                              {/* Total */}
                              <div className="flex justify-end px-5 py-2 border-t border-neutral-100 dark:border-neutral-800">
                                <span className="text-xs text-neutral-400 dark:text-neutral-500 mr-2">Total to pay</span>
                                <span className="text-xs font-bold text-neutral-900 dark:text-white">${job.price_usdc} USDC</span>
                              </div>
                            </>
                          ) : (
                            <p className="px-5 py-3 text-xs text-neutral-400 dark:text-neutral-500">No creator data.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
