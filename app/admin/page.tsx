"use client";

import { useEffect, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { Navbar } from "@/components/Navbar";
import {
  CheckCircle2, XCircle, Loader2, ShieldAlert, Clock,
  Zap, Download, ExternalLink, Users, Trash2, EyeOff, Eye,
  X, Copy, Check, Search, ChevronLeft, ChevronRight, CalendarDays, Link2,
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
  deadline_hours: number;
  deadline_override?: string | null;
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
  completed_at?: string | null;
  type: string;
  title: string;
  price_usdc: number;
  proof_url: string | null;
  is_paid: boolean;
  additional_info: AdditionalInfo | null;
  client:  { twitter_handle: string; display_name: string } | null;
  creator: { twitter_handle: string; display_name: string; wallet_address: string } | null;
}

interface CancelledJob {
  id: string;
  created_at: string;
  type: string;
  title: string;
  description: string;
  price_usdc: number;
  deadline_hours: number;
  tweet_url: string | null;
  require_blue: boolean;
  min_followers: number;
  max_creators: number;
  is_agent_job: boolean;
  creator_id: string | null;
  cancel_reason: string | null;
  is_refunded: boolean;
  tx_hash: string | null;
  client: { twitter_handle: string; display_name: string; wallet_address: string } | null;
}

const CANCEL_REASON_LABEL: Record<string, { label: string; color: string }> = {
  expired_no_creator: { label: "Expired (No Creator)", color: "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700" },
  admin_rejected:     { label: "Admin Rejected",       color: "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800" },
  client_cancelled:   { label: "Client Cancelled",     color: "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
};

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
  content: "Content", repost: "Retweet", like_reply: "Like & Reply",
  campaign: "Campaign", custom: "Custom",
};

const TYPE_PREFIX: Record<string, string> = {
  custom: "X", like_reply: "L", repost: "R", content: "C", campaign: "E",
};

function fmtJobId(type: string, id: string) {
  return `${TYPE_PREFIX[type] ?? "X"}H${id.slice(0, 8).toUpperCase()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDeadline(createdAt: string, deadlineHours: number, deadlineOverride?: string | null) {
  const expires = deadlineOverride
    ? new Date(deadlineOverride)
    : new Date(new Date(createdAt).getTime() + deadlineHours * 3_600_000);
  const now = Date.now();
  const diff = (expires.getTime() - now) / 1000;
  const expiresStr = fmtDate(expires.toISOString());
  if (diff <= 0) return { label: `Exp ${expiresStr}`, expired: true };
  if (diff < 86400) return { label: `${Math.floor(diff / 3600)}h left`, expired: false };
  return { label: `${Math.floor(diff / 86400)}d left`, expired: false };
}

const ADMIN_PAGE_SIZE = 20;

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
  const { isConnected, embeddedWalletInfo, status } = useAppKitAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isRestoring = status === "connecting" || status === "reconnecting";
  const authenticated = isConnected;
  const twitterHandle = embeddedWalletInfo?.user?.username ?? "";

  const isAdmin = ADMINS.some((a) => a.toLowerCase() === twitterHandle.toLowerCase());

  const [tab, setTab]                   = useState<"pending" | "active" | "completed" | "cancelled">("pending");
  const [pending, setPending]           = useState<PendingJob[]>([]);
  const [active, setActive]             = useState<ActiveJob[]>([]);
  const [completed, setCompleted]       = useState<CompletedJob[]>([]);
  const [cancelled, setCancelled]       = useState<CancelledJob[]>([]);
  const [loadingPending, setLoadingP]   = useState(false);
  const [loadingActive, setLoadingA]    = useState(false);
  const [loadingCompleted, setLoadingC] = useState(false);
  const [loadingCancelled, setLoadingX] = useState(false);
  const [acting, setActing]             = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [toggling, setToggling]         = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter]       = useState("all");
  const [activeStatusFilter, setActiveStatusFilter]   = useState("all");
  const [completedTypeFilter, setCompletedTypeFilter] = useState("all");
  const [completedPaidFilter, setCompletedPaidFilter] = useState("all");
  const [detailModal, setDetailModal]           = useState<CompletedJob | null>(null);
  const [detailPage, setDetailPage]             = useState(0);
  const [copiedWallet, setCopiedWallet]         = useState<string | null>(null);
  const [markingPaid, setMarkingPaid]           = useState<string | null>(null);
  const [activeSearch, setActiveSearch]         = useState("");
  const [activePage, setActivePage]             = useState(0);
  const [completedSearch, setCompletedSearch]   = useState("");
  const [completedPage, setCompletedPage]       = useState(0);
  const [cancelledTypeFilter, setCancelledTypeFilter] = useState("all");
  const [cancelledSearch, setCancelledSearch]         = useState("");
  const [cancelledPage, setCancelledPage]             = useState(0);
  const [restoring, setRestoring]                     = useState<string | null>(null);
  const [refunding, setRefunding]                     = useState<string | null>(null);
  const [copiedRefundWallet, setCopiedRefundWallet]   = useState<string | null>(null);
  const [cancelling, setCancelling]                   = useState<string | null>(null);
  const [cancelDetailModal, setCancelDetailModal]     = useState<CancelledJob | null>(null);
  const [pendingSearch, setPendingSearch]             = useState("");
  const [pendingPage, setPendingPage]                 = useState(0);
  const [pendingTypeFilter, setPendingTypeFilter]     = useState("all");
  const [pendingDetailModal, setPendingDetailModal]   = useState<PendingJob | null>(null);
  const [extendModal, setExtendModal]                 = useState<{ id: string; currentDeadline: Date } | null>(null);
  const [extendDateValue, setExtendDateValue]         = useState("");
  const [extending, setExtending]                     = useState(false);

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
    // Auto-expire before loading: open→cancelled, in_progress→completed
    fetch(`/api/admin/expire-jobs?admin_handle=${twitterHandle}`, { method: "POST" })
      .finally(() => {
        fetch(`/api/admin/jobs?admin_handle=${twitterHandle}&status=active`)
          .then((r) => r.json())
          .then((d) => setActive(d.jobs ?? []))
          .finally(() => setLoadingA(false));
      });
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

  useEffect(() => {
    if (!isAdmin || !twitterHandle || tab !== "cancelled") return;
    if (cancelled.length > 0) return;
    setLoadingX(true);
    fetch(`/api/admin/cancelled-jobs?admin_handle=${twitterHandle}`)
      .then((r) => r.json())
      .then((d) => setCancelled(d.jobs ?? []))
      .finally(() => setLoadingX(false));
  }, [isAdmin, twitterHandle, tab]);

  useEffect(() => { setPendingPage(0); }, [pendingTypeFilter, pendingSearch]);
  useEffect(() => { setActivePage(0); }, [activeTypeFilter, activeStatusFilter, activeSearch]);
  useEffect(() => { setCompletedPage(0); }, [completedTypeFilter, completedPaidFilter, completedSearch]);
  useEffect(() => { setCancelledPage(0); }, [cancelledTypeFilter, cancelledSearch]);

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
        setCancelled((prev) => prev.filter((j) => j.id !== jobId));
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleCancelActive(jobId: string) {
    if (!confirm("Cancel this job? It will move to the Cancelled tab.")) return;
    setCancelling(jobId);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}?admin_handle=${twitterHandle}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", cancel_reason: "admin_rejected" }),
      });
      if (res.ok) setActive((prev) => prev.filter((j) => j.id !== jobId));
    } finally {
      setCancelling(null);
    }
  }

  async function handleRestore(jobId: string) {
    setRestoring(jobId);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/restore?admin_handle=${twitterHandle}`, {
        method: "POST",
      });
      if (res.ok) {
        setCancelled((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Restore failed: ${data.error ?? res.statusText}`);
      }
    } catch {
      alert("Restore failed: network error");
    } finally {
      setRestoring(null);
    }
  }

  async function handleMarkRefunded(jobId: string) {
    setRefunding(jobId);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}?admin_handle=${twitterHandle}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_refunded: true }),
      });
      if (res.ok) {
        setCancelled((prev) => prev.map((j) => j.id === jobId ? { ...j, is_refunded: true } : j));
      }
    } finally {
      setRefunding(null);
    }
  }

  function copyRefundWallet(wallet: string, jobId: string) {
    navigator.clipboard.writeText(wallet);
    setCopiedRefundWallet(jobId);
    setTimeout(() => setCopiedRefundWallet(null), 1500);
  }

  async function handleExtendDeadline() {
    if (!extendModal || !extendDateValue) return;
    setExtending(true);
    try {
      const iso = new Date(extendDateValue).toISOString();
      const res = await fetch(`/api/admin/jobs/${extendModal.id}?admin_handle=${twitterHandle}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline_override: iso }),
      });
      if (res.ok) {
        setActive((prev) =>
          prev.map((j) => j.id === extendModal.id ? { ...j, deadline_override: iso } : j)
        );
        setExtendModal(null);
      }
    } finally {
      setExtending(false);
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
  if (!mounted || isRestoring) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      </>
    );
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
            Active
            {tab === "active" && active.length > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-green-500 text-white rounded-full px-1.5 py-0.5">
                {active.length}
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
            Completed
            {tab === "completed" && completed.length > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                {completed.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("cancelled")}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              tab === "cancelled"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Cancelled
            {tab === "cancelled" && cancelled.length > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">
                {cancelled.length}
              </span>
            )}
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
              <div className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-12 text-center text-neutral-400 dark:text-neutral-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending jobs. All clear!</p>
              </div>
            )}
            {!loadingPending && pending.length > 0 && (() => {
              const q = pendingSearch.toLowerCase();
              const filtered = pending.filter((j) => {
                const matchType = pendingTypeFilter === "all" || j.type === pendingTypeFilter;
                const matchSearch = !q ||
                  fmtJobId(j.type, j.id).toLowerCase().includes(q) ||
                  j.title.toLowerCase().includes(q) ||
                  (j.client?.twitter_handle ?? "").toLowerCase().includes(q);
                return matchType && matchSearch;
              });
              const totalPages = Math.ceil(filtered.length / ADMIN_PAGE_SIZE);
              const page = Math.min(pendingPage, Math.max(0, totalPages - 1));
              const pageData = filtered.slice(page * ADMIN_PAGE_SIZE, (page + 1) * ADMIN_PAGE_SIZE);
              return (
                <>
                  {/* Search + Filter */}
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                        <input
                          value={pendingSearch}
                          onChange={(e) => setPendingSearch(e.target.value)}
                          placeholder="Search by ID, title, or @handle…"
                          className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
                      {["all", "repost", "like_reply", "content", "campaign", "custom"].map((t) => (
                        <button key={t} onClick={() => setPendingTypeFilter(t)}
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${pendingTypeFilter === t ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"}`}>
                          {t === "all" ? "All" : TYPE_LABEL[t] ?? t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Job</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Client</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Posted</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Deadline</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {pageData.map((job) => (
                          <tr key={job.id} className="bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">{job.title}</p>
                              <p className="text-neutral-400 dark:text-neutral-500 font-mono">{fmtJobId(job.type, job.id)} · {TYPE_LABEL[job.type] ?? job.type}</p>
                            </td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">@{job.client?.twitter_handle ?? "—"}</td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{fmtDate(job.created_at)}</td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{job.deadline_hours}h</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => setPendingDetailModal(job)} title="View Details"
                                  className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleAction(job.id, "approve")} disabled={acting?.id === job.id} title="Approve"
                                  className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950 transition-colors disabled:opacity-40">
                                  {acting?.id === job.id && acting.action === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => handleAction(job.id, "reject")} disabled={acting?.id === job.id} title="Reject"
                                  className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40">
                                  {acting?.id === job.id && acting.action === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => handleDelete(job.id)} disabled={deleting === job.id} title="Delete"
                                  className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40">
                                  {deleting === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {page * ADMIN_PAGE_SIZE + 1}–{Math.min((page + 1) * ADMIN_PAGE_SIZE, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPendingPage(page - 1)} disabled={page === 0}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 px-2">{page + 1} / {totalPages}</span>
                        <button onClick={() => setPendingPage(page + 1)} disabled={page >= totalPages - 1}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
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
              <div className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-12 text-center text-neutral-400 dark:text-neutral-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active jobs.</p>
              </div>
            )}
            {!loadingActive && active.length > 0 && (() => {
              const q = activeSearch.toLowerCase();
              const filtered = active.filter((j) => {
                const matchType = activeTypeFilter === "all" || j.type === activeTypeFilter;
                const matchStatus =
                  activeStatusFilter === "all" ||
                  (activeStatusFilter === "hidden"      &&  j.is_hidden) ||
                  (activeStatusFilter === "open"        && !j.is_hidden && j.status === "open") ||
                  (activeStatusFilter === "in_progress" && !j.is_hidden && j.status === "in_progress");
                const matchSearch = !q ||
                  fmtJobId(j.type, j.id).toLowerCase().includes(q) ||
                  j.title.toLowerCase().includes(q) ||
                  (j.client?.twitter_handle ?? "").toLowerCase().includes(q);
                return matchType && matchStatus && matchSearch;
              });
              const totalPages = Math.ceil(filtered.length / ADMIN_PAGE_SIZE);
              const page = Math.min(activePage, Math.max(0, totalPages - 1));
              const pageData = filtered.slice(page * ADMIN_PAGE_SIZE, (page + 1) * ADMIN_PAGE_SIZE);
              return (
                <>
                  {/* Search + Filter */}
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                      <input
                        value={activeSearch}
                        onChange={(e) => setActiveSearch(e.target.value)}
                        placeholder="Search by ID, title, or @handle…"
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
                      {["all", "repost", "like_reply", "content", "campaign", "custom"].map((t) => (
                        <button key={t} onClick={() => setActiveTypeFilter(t)}
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${activeTypeFilter === t ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"}`}>
                          {t === "all" ? "All" : TYPE_LABEL[t] ?? t}
                        </button>
                      ))}
                      <span className="text-neutral-300 dark:text-neutral-700 text-xs select-none">|</span>
                      {[
                        { val: "all", label: "All Status" }, { val: "open", label: "Open" },
                        { val: "in_progress", label: "In Progress" }, { val: "hidden", label: "Hidden" },
                      ].map(({ val, label }) => (
                        <button key={val} onClick={() => setActiveStatusFilter(val)}
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${activeStatusFilter === val ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Job</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Client</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Posted</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Deadline</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Status</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Amount</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {pageData.map((job) => {
                          const dl = fmtDeadline(job.created_at, job.deadline_hours ?? 48, job.deadline_override);
                          return (
                            <tr key={job.id} className={`bg-white dark:bg-neutral-950 transition-colors ${job.is_hidden ? "opacity-50" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">{job.title}</p>
                                <p className="text-neutral-400 dark:text-neutral-500 font-mono">{fmtJobId(job.type, job.id)} · {TYPE_LABEL[job.type] ?? job.type}</p>
                              </td>
                              <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">@{job.client?.twitter_handle ?? "—"}</td>
                              <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{fmtDate(job.created_at)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`text-[10px] font-semibold ${dl.expired ? "text-amber-500 dark:text-amber-400" : "text-neutral-400 dark:text-neutral-500"}`}>{dl.label}</span>
                                {job.deadline_override && (
                                  <span className="ml-1 text-[9px] font-medium text-blue-400 dark:text-blue-500">ext</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  job.is_hidden ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700"
                                  : job.status === "in_progress" ? "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                  : "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                                }`}>
                                  {job.is_hidden ? <><EyeOff className="w-2.5 h-2.5" /> Hidden</> : job.status === "in_progress" ? "In Progress" : "Open"}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white whitespace-nowrap">${job.price_usdc.toFixed(1)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => handleToggleHidden(job.id, job.is_hidden)} disabled={toggling === job.id} title={job.is_hidden ? "Show" : "Hide"}
                                    className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40">
                                    {toggling === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : job.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => {
                                      const base = job.deadline_override
                                        ? new Date(job.deadline_override)
                                        : new Date(new Date(job.created_at).getTime() + (job.deadline_hours ?? 48) * 3_600_000);
                                      setExtendModal({ id: job.id, currentDeadline: base });
                                      setExtendDateValue(base.toISOString().slice(0, 16));
                                    }}
                                    title="Extend Deadline"
                                    className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleCancelActive(job.id)} disabled={cancelling === job.id} title="Cancel Job"
                                    className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40">
                                    {cancelling === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {page * ADMIN_PAGE_SIZE + 1}–{Math.min((page + 1) * ADMIN_PAGE_SIZE, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setActivePage(page - 1)} disabled={page === 0}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 px-2">{page + 1} / {totalPages}</span>
                        <button onClick={() => setActivePage(page + 1)} disabled={page >= totalPages - 1}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
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
              <div className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-12 text-center text-neutral-400 dark:text-neutral-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No completed jobs yet.</p>
              </div>
            )}
            {!loadingCompleted && completed.length > 0 && (() => {
              const q = completedSearch.toLowerCase();
              const filtered = completed.filter((j) => {
                const matchType = completedTypeFilter === "all" || j.type === completedTypeFilter;
                const matchPaid =
                  completedPaidFilter === "all" ||
                  (completedPaidFilter === "paid"   &&  j.is_paid) ||
                  (completedPaidFilter === "unpaid" && !j.is_paid);
                const matchSearch = !q ||
                  fmtJobId(j.type, j.id).toLowerCase().includes(q) ||
                  j.title.toLowerCase().includes(q) ||
                  (j.client?.twitter_handle ?? "").toLowerCase().includes(q) ||
                  (j.creator?.twitter_handle ?? "").toLowerCase().includes(q);
                return matchType && matchPaid && matchSearch;
              });
              const totalPages = Math.ceil(filtered.length / ADMIN_PAGE_SIZE);
              const page = Math.min(completedPage, Math.max(0, totalPages - 1));
              const pageData = filtered.slice(page * ADMIN_PAGE_SIZE, (page + 1) * ADMIN_PAGE_SIZE);
              const unpaidTotal = filtered.filter((j) => !j.is_paid).reduce((s, j) => s + j.price_usdc, 0);

              async function handleBulkExport() {
                const XLSX = await import("xlsx");
                const rows = filtered.map((j) => ({
                  "Job ID":         fmtJobId(j.type, j.id),
                  "Full ID":        j.id,
                  "Job Type":       TYPE_LABEL[j.type] ?? j.type,
                  "Job Title":      j.title,
                  "Amount (USDC)":  j.price_usdc.toFixed(1),
                  "Creator Handle": j.creator?.twitter_handle ?? "",
                  "Creator Name":   j.creator?.display_name   ?? "",
                  "SOL Wallet":     j.creator?.wallet_address  ?? "",
                  "Proof Link":     j.proof_url ?? "",
                  "Client Handle":  j.client?.twitter_handle  ?? "",
                  "Posted At":      fmtDate(j.created_at),
                  "Completed At":   j.completed_at ? fmtDate(j.completed_at) : "—",
                  "Paid":           j.is_paid ? "Yes" : "No",
                  ...(j.additional_info?.wallet   ? { "Extra Wallet":   j.additional_info.wallet }   : {}),
                  ...(j.additional_info?.email    ? { "Email":          j.additional_info.email }    : {}),
                  ...(j.additional_info?.discord  ? { "Discord":        j.additional_info.discord }  : {}),
                  ...(j.additional_info?.telegram ? { "Telegram":       j.additional_info.telegram } : {}),
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Completed");
                XLSX.writeFile(wb, `completed-jobs-${new Date().toISOString().slice(0, 10)}.xlsx`);
              }

              return (
                <>
                  {/* Search + Filter + Bulk Export */}
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                        <input
                          value={completedSearch}
                          onChange={(e) => setCompletedSearch(e.target.value)}
                          placeholder="Search by ID, title, or @handle…"
                          className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <button onClick={handleBulkExport} title="Export all filtered results"
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-green-600 dark:hover:text-green-400 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors whitespace-nowrap">
                        <Download className="w-3.5 h-3.5" /> Export All
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
                      {["all", "repost", "like_reply", "content", "campaign", "custom"].map((t) => (
                        <button key={t} onClick={() => setCompletedTypeFilter(t)}
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${completedTypeFilter === t ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"}`}>
                          {t === "all" ? "All" : TYPE_LABEL[t] ?? t}
                        </button>
                      ))}
                      <span className="text-neutral-300 dark:text-neutral-700 text-xs select-none">|</span>
                      {[{ val: "all", label: "All" }, { val: "paid", label: "Paid" }, { val: "unpaid", label: "Unpaid" }].map(({ val, label }) => (
                        <button key={val} onClick={() => setCompletedPaidFilter(val)}
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${completedPaidFilter === val ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"}`}>
                          {label}
                        </button>
                      ))}
                      {unpaidTotal > 0 && (
                        <>
                          <span className="text-neutral-300 dark:text-neutral-700 text-xs select-none">|</span>
                          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold whitespace-nowrap shrink-0">
                            <Clock className="w-3 h-3" /> Unpaid: ${unpaidTotal.toFixed(1)} USDC
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Job</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Client</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Posted</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Completed</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Amount</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Paid</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {pageData.map((job) => (
                          <tr key={job.id} className="bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">{job.title}</p>
                              <p className="text-neutral-400 dark:text-neutral-500 font-mono">{fmtJobId(job.type, job.id)} · {TYPE_LABEL[job.type] ?? job.type}</p>
                            </td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">@{job.client?.twitter_handle ?? "—"}</td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{fmtDate(job.created_at)}</td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                              {job.completed_at ? fmtDate(job.completed_at) : <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                            </td>
                            <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white whitespace-nowrap">${job.price_usdc.toFixed(1)}</td>
                            <td className="px-4 py-3">
                              {job.is_paid
                                ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">Paid</span>
                                : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700">Unpaid</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => handleTogglePaid(job)} disabled={markingPaid === job.id} title={job.is_paid ? "Mark Unpaid" : "Mark Paid"}
                                  className={`p-1.5 rounded-lg transition-colors ${job.is_paid ? "text-green-500 hover:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" : "text-neutral-300 dark:text-neutral-700 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950"}`}>
                                  {markingPaid === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => job.creator?.wallet_address && copyAllWallets(job.id, job.creator.wallet_address)} disabled={!job.creator?.wallet_address} title="Copy Wallet"
                                  className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                                  {copiedWallet === `all-${job.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => { setDetailModal(job); setDetailPage(0); }} title="View Details"
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => downloadJobExcel(job)} title="Export Excel"
                                  className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors">
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDelete(job.id)} disabled={deleting === job.id} title="Delete"
                                  className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40">
                                  {deleting === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {page * ADMIN_PAGE_SIZE + 1}–{Math.min((page + 1) * ADMIN_PAGE_SIZE, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCompletedPage(page - 1)} disabled={page === 0}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 px-2">{page + 1} / {totalPages}</span>
                        <button onClick={() => setCompletedPage(page + 1)} disabled={page >= totalPages - 1}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
        {/* ── CANCELLED TAB ── */}
        {tab === "cancelled" && (
          <>
            {loadingCancelled && (
              <div className="flex items-center justify-center py-20 text-neutral-400 dark:text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Loading…</span>
              </div>
            )}
            {!loadingCancelled && cancelled.length === 0 && (
              <div className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-12 text-center text-neutral-400 dark:text-neutral-500">
                <XCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No cancelled jobs.</p>
              </div>
            )}
            {!loadingCancelled && cancelled.length > 0 && (() => {
              const q = cancelledSearch.toLowerCase();
              const filtered = cancelled.filter((j) => {
                const matchType = cancelledTypeFilter === "all" || j.type === cancelledTypeFilter;
                const matchSearch = !q ||
                  fmtJobId(j.type, j.id).toLowerCase().includes(q) ||
                  j.title.toLowerCase().includes(q) ||
                  (j.client?.twitter_handle ?? "").toLowerCase().includes(q);
                return matchType && matchSearch;
              });
              const totalPages = Math.ceil(filtered.length / ADMIN_PAGE_SIZE);
              const page = Math.min(cancelledPage, Math.max(0, totalPages - 1));
              const pageData = filtered.slice(page * ADMIN_PAGE_SIZE, (page + 1) * ADMIN_PAGE_SIZE);
              return (
                <>
                  {/* Search + Type filter */}
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                      <input
                        value={cancelledSearch}
                        onChange={(e) => setCancelledSearch(e.target.value)}
                        placeholder="Search by ID, title, or @handle…"
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
                      {["all", "repost", "like_reply", "content", "campaign", "custom"].map((t) => (
                        <button key={t} onClick={() => setCancelledTypeFilter(t)}
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${cancelledTypeFilter === t ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"}`}>
                          {t === "all" ? "All" : TYPE_LABEL[t] ?? t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Job</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Client</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Posted</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Reason</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Amount</th>
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Refund</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {pageData.map((job) => {
                          const reasonKey = job.cancel_reason ?? "expired_no_creator";
                          const reasonMeta = CANCEL_REASON_LABEL[reasonKey] ?? { label: reasonKey, color: "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700" };
                          return (
                            <tr key={job.id} className="bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors opacity-75">
                              <td className="px-4 py-3">
                                <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">{job.title}</p>
                                <p className="text-neutral-400 dark:text-neutral-500 font-mono">{fmtJobId(job.type, job.id)} · {TYPE_LABEL[job.type] ?? job.type}</p>
                              </td>
                              <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">@{job.client?.twitter_handle ?? "—"}</td>
                              <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{fmtDate(job.created_at)}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${reasonMeta.color}`}>
                                  {reasonMeta.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white whitespace-nowrap">${job.price_usdc.toFixed(1)}</td>
                              <td className="px-4 py-3">
                                {job.is_refunded
                                  ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">Yay</span>
                                  : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700">Nay</span>
                                }
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                  {/* Mark refunded toggle */}
                                  <button
                                    onClick={() => handleMarkRefunded(job.id)}
                                    disabled={refunding === job.id || job.is_refunded}
                                    title={job.is_refunded ? "Already refunded" : "Mark Refunded"}
                                    className={`p-1.5 rounded-lg transition-colors ${job.is_refunded ? "text-green-500" : "text-neutral-300 dark:text-neutral-700 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950"}`}
                                  >
                                    {refunding === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </button>
                                  {/* Copy client wallet */}
                                  {job.client?.wallet_address && (
                                    <button
                                      onClick={() => copyRefundWallet(job.client!.wallet_address, job.id)}
                                      title="Copy Client Wallet"
                                      className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                                    >
                                      {copiedRefundWallet === job.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                  {/* Solscan tx link */}
                                  {job.tx_hash && (
                                    <a
                                      href={`https://solscan.io/tx/${job.tx_hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="View payment on Solscan"
                                      className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors"
                                    >
                                      <Link2 className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  {/* View Details */}
                                  <button onClick={() => setCancelDetailModal(job)} title="View Details"
                                    className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRestore(job.id)}
                                    disabled={restoring === job.id}
                                    title="Restore to Open"
                                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors disabled:opacity-40"
                                  >
                                    {restoring === job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                    
                                  </button>
                                  <button onClick={() => handleDelete(job.id)} disabled={deleting === job.id} title="Delete"
                                    className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40">
                                    {deleting === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {page * ADMIN_PAGE_SIZE + 1}–{Math.min((page + 1) * ADMIN_PAGE_SIZE, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCancelledPage(page - 1)} disabled={page === 0}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 px-2">{page + 1} / {totalPages}</span>
                        <button onClick={() => setCancelledPage(page + 1)} disabled={page >= totalPages - 1}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      {/* ── Pending Job Detail Modal ── */}
      {pendingDetailModal && (() => {
        const job = pendingDetailModal;
        const { brief, meta } = parseDesc(job.description ?? "");
        const reward    = meta.find((m) => m.label === "Reward");
        const proof     = meta.find((m) => m.label === "Proof required");
        const access    = job.require_blue ? "Blue Verified only" : "Everyone";
        const followers = job.min_followers > 0
          ? job.min_followers >= 1000
            ? `${(job.min_followers / 1000).toFixed(0)}K+ followers`
            : `${job.min_followers}+ followers`
          : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
                <div>
                  <p className="font-semibold text-sm text-neutral-900 dark:text-white truncate max-w-[300px]">{job.title}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">{fmtJobId(job.type, job.id)} · {TYPE_LABEL[job.type] ?? job.type}</p>
                </div>
                <button onClick={() => setPendingDetailModal(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 dark:text-neutral-500">Client</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">@{job.client?.twitter_handle ?? "—"}</span>
                </div>
                <div className="border-t border-neutral-100 dark:border-neutral-800" />
                {brief && (
                  <>
                    <div>
                      <p className="text-neutral-400 dark:text-neutral-500 mb-1">Brief</p>
                      <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">{brief}</p>
                    </div>
                    <div className="border-t border-neutral-100 dark:border-neutral-800" />
                  </>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 dark:text-neutral-500">Deadline</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{job.deadline_hours}h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 dark:text-neutral-500">Creator access</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{access}{followers ? `, ${followers}` : ""}</span>
                  </div>
                  {reward && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 dark:text-neutral-500">Reward</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{reward.value}</span>
                    </div>
                  )}
                  {proof && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 dark:text-neutral-500">Proof required</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{proof.value}</span>
                    </div>
                  )}
                  {meta.filter((m) => m.label !== "Reward" && m.label !== "Proof required").map((m) => (
                    <div key={m.label} className="flex items-start justify-between gap-4">
                      <span className="text-neutral-400 dark:text-neutral-500 shrink-0">{m.label}</span>
                      <span className="text-neutral-700 dark:text-neutral-300 text-right">{m.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 dark:text-neutral-500">Posted</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{fmtDate(job.created_at)}</span>
                  </div>
                </div>
                <div className="border-t border-neutral-100 dark:border-neutral-800" />
                <div className="flex gap-2">
                  <button onClick={() => { setPendingDetailModal(null); handleAction(job.id, "approve"); }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-colors">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => { setPendingDetailModal(null); handleAction(job.id, "reject"); }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Cancelled Job Detail Modal ── */}
      {cancelDetailModal && (() => {
        const job = cancelDetailModal;
        const { brief, meta } = parseDesc(job.description ?? "");
        const reward    = meta.find((m) => m.label === "Reward");
        const proof     = meta.find((m) => m.label === "Proof required");
        const access    = job.require_blue ? "Blue Verified only" : "Everyone";
        const followers = job.min_followers > 0
          ? job.min_followers >= 1000
            ? `${(job.min_followers / 1000).toFixed(0)}K+ followers`
            : `${job.min_followers}+ followers`
          : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
                <div>
                  <p className="font-semibold text-sm text-neutral-900 dark:text-white truncate max-w-[300px]">{job.title}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">{fmtJobId(job.type, job.id)} · {TYPE_LABEL[job.type] ?? job.type}</p>
                </div>
                <button onClick={() => setCancelDetailModal(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3 text-xs">
                {/* Client */}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 dark:text-neutral-500">Client</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">@{job.client?.twitter_handle ?? "—"}</span>
                </div>
                <div className="border-t border-neutral-100 dark:border-neutral-800" />

                {/* Brief */}
                {brief && (
                  <>
                    <div>
                      <p className="text-neutral-400 dark:text-neutral-500 mb-1">Brief</p>
                      <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">{brief}</p>
                    </div>
                    <div className="border-t border-neutral-100 dark:border-neutral-800" />
                  </>
                )}

                {/* Meta rows */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 dark:text-neutral-500">Amount</span>
                    <span className="font-bold text-neutral-900 dark:text-white">${job.price_usdc.toFixed(1)} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 dark:text-neutral-500">Deadline</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{job.deadline_hours}h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 dark:text-neutral-500">Creator access</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{access}{followers ? `, ${followers}` : ""}</span>
                  </div>
                  {job.max_creators > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 dark:text-neutral-500">Slots</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{job.max_creators}</span>
                    </div>
                  )}
                  {job.tweet_url && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 dark:text-neutral-500">Tweet URL</span>
                      <a href={job.tweet_url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    </div>
                  )}
                  {reward && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 dark:text-neutral-500">Reward</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{reward.value}</span>
                    </div>
                  )}
                  {proof && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 dark:text-neutral-500">Proof required</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{proof.value}</span>
                    </div>
                  )}
                  {meta.filter((m) => m.label !== "Reward" && m.label !== "Proof required").map((m) => (
                    <div key={m.label} className="flex items-start justify-between gap-4">
                      <span className="text-neutral-400 dark:text-neutral-500 shrink-0">{m.label}</span>
                      <span className="text-neutral-700 dark:text-neutral-300 text-right">{m.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 dark:text-neutral-500">Posted</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{fmtDate(job.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Extend Deadline Modal ── */}
      {extendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-sm text-neutral-900 dark:text-white">Extend Deadline</span>
              </div>
              <button onClick={() => setExtendModal(null)} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1">Current deadline</p>
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {extendModal.currentDeadline.toLocaleString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1.5">New deadline</p>
                <input
                  type="datetime-local"
                  value={extendDateValue}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setExtendDateValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExtendDeadline}
                  disabled={!extendDateValue || extending}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-40">
                  {extending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button onClick={() => setExtendModal(null)} className="px-4 py-2 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailModal && (() => {
        const job = detailModal;
        const entries = job.creator ? [{ handle: job.creator.twitter_handle, proof_url: job.proof_url, wallet: job.creator.wallet_address, additional_info: job.additional_info }] : [];
        const DETAIL_PAGE = 20;
        const totalDetailPages = Math.ceil(entries.length / DETAIL_PAGE);
        const pageEntries = entries.slice(detailPage * DETAIL_PAGE, (detailPage + 1) * DETAIL_PAGE);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
                <div>
                  <p className="font-semibold text-sm text-neutral-900 dark:text-white truncate max-w-[320px]">{job.title}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">{fmtJobId(job.type, job.id)}</p>
                </div>
                <button onClick={() => setDetailModal(null)} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body — table */}
              <div className="flex-1 overflow-auto">
                {pageEntries.length === 0 ? (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-10">No creator data available.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400 whitespace-nowrap">#</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Handle</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Proof</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Wallet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {pageEntries.map((entry, i) => {
                        const rowNum = detailPage * DETAIL_PAGE + i + 1;
                        return (
                          <tr key={i} className="bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                            <td className="px-4 py-2.5 text-neutral-400 dark:text-neutral-500">{rowNum}</td>
                            <td className="px-4 py-2.5 font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">@{entry.handle}</td>
                            <td className="px-4 py-2.5">
                              {entry.proof_url ? (
                                <a href={entry.proof_url} target="_blank" rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline flex items-center gap-1 whitespace-nowrap">
                                  <ExternalLink className="w-3 h-3" /> Proof
                                </a>
                              ) : <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              {entry.wallet ? (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono text-[10px] text-neutral-600 dark:text-neutral-400 truncate max-w-[180px]">{entry.wallet}</span>
                                  <button onClick={() => copyWallet(entry.wallet!, `modal-${i}`)} className="shrink-0 text-neutral-400 hover:text-blue-500 transition-colors">
                                    {copiedWallet === `modal-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer pagination */}
              {totalDetailPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
                  <span className="text-xs text-neutral-400">{detailPage * DETAIL_PAGE + 1}–{Math.min((detailPage + 1) * DETAIL_PAGE, entries.length)} of {entries.length}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setDetailPage(detailPage - 1)} disabled={detailPage === 0}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 disabled:opacity-30 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs px-2">{detailPage + 1}/{totalDetailPages}</span>
                    <button onClick={() => setDetailPage(detailPage + 1)} disabled={detailPage >= totalDetailPages - 1}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 disabled:opacity-30 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
