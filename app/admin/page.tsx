"use client";

import { useEffect, useState } from "react";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { Navbar } from "@/components/Navbar";
import {
  CheckCircle2, XCircle, Loader2, ShieldAlert, Clock,
  Zap, Download, ExternalLink, Users, Trash2, EyeOff, Eye,
  X, Copy, Check, Search, ChevronLeft, ChevronRight, CalendarDays, Link2,
  Coins, Wallet2, ArrowRight,
} from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { buildCreditCreatorTx, buildInitializeTx, buildSendUsdcTx, buildSetAdmin2Tx, buildWithdrawTx, getVaultPDA } from "@/lib/contract";

import { ADMINS } from "@/lib/admins";

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
  max_creators?: number | null;
  slots_taken?: number | null;
  client: { twitter_handle: string; display_name: string } | null;
}

interface ActiveCreator {
  twitter_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified_blue: boolean;
  status: string;
  proof_url: string | null;
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
  credited_at: string | null;
  additional_info: AdditionalInfo | null;
  client:  { twitter_handle: string; display_name: string } | null;
  creator: { twitter_handle: string; display_name: string; wallet_address: string } | null;
}

interface CreditItem {
  source_id:      string;
  source_type:    "job" | "completion";
  job_id:         string;
  title:          string;
  type:           string;
  creator_handle: string;
  creator_name:   string;
  wallet:         string;
  amount_usdc:    number;
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
  const { isConnected, embeddedWalletInfo, status, address: walletAddress } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isRestoring = status === "connecting" || status === "reconnecting";
  const authenticated = isConnected;
  const twitterHandle = embeddedWalletInfo?.user?.username ?? "";

  const isAdmin = ADMINS.some((a) => a.toLowerCase() === twitterHandle.toLowerCase());

  const [tab, setTab]                   = useState<"pending" | "active" | "completed" | "cancelled" | "credits">("pending");
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
  const [completedCreditedFilter, setCompletedCreditedFilter] = useState("all");
  const [detailModal, setDetailModal]           = useState<CompletedJob | null>(null);
  const [detailPage, setDetailPage]             = useState(0);
  const [copiedWallet, setCopiedWallet]         = useState<string | null>(null);
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
  const [activeDetailModal, setActiveDetailModal]     = useState<ActiveJob | null>(null);
  const [activeModalCreators, setActiveModalCreators] = useState<ActiveCreator[]>([]);
  const [loadingActiveCreators, setLoadingActiveCreators] = useState(false);

  // ── Credits tab state ──────────────────────────────────────────────────────
  const [creditItems, setCreditItems]       = useState<CreditItem[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [selectedCredits, setSelectedCredits] = useState<Set<string>>(new Set());
  const [crediting, setCrediting]           = useState(false);
  const [creditResult, setCreditResult]     = useState<{ ok: number; fail: number; errors?: string[] } | null>(null);
  const [creditTypeFilter, setCreditTypeFilter] = useState("all");
  const [vaultBalance, setVaultBalance]         = useState<number | null>(null);
  const [withdrawAmount, setWithdrawAmount]     = useState("");
  const [withdrawing, setWithdrawing]           = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawResult, setWithdrawResult]     = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes]         = useState<Set<string>>(new Set());
  const [creditJobPage, setCreditJobPage]         = useState(0);
  const [creditCreatorPages, setCreditCreatorPages] = useState<Record<string, number>>({});
  const [initializing, setInitializing]     = useState(false);
  const [initResult, setInitResult]         = useState<string | null>(null);
  const [admin2Input, setAdmin2Input]       = useState("");
  // "loading" = checking on-chain | "none" = not init | "old" = needs set_admin2 | "new" = fully initialized
  const [initState, setInitState]           = useState<"loading" | "none" | "old" | "new">("loading");
  const [settingAdmin2, setSettingAdmin2]   = useState(false);
  const [setAdmin2Result, setSetAdmin2Result] = useState<string | null>(null);
  const [onChainAdmin, setOnChainAdmin]     = useState<string | null>(null);
  const [onChainAdmin2, setOnChainAdmin2]   = useState<string | null>(null);
  const [sendRecipient, setSendRecipient]   = useState("");
  const [sendAmount, setSendAmount]         = useState("");
  const [sending, setSending]               = useState(false);
  const [sendResult, setSendResult]         = useState<string | null>(null);

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

  async function handleInitialize() {
    if (!walletAddress || !walletProvider) return;
    setInitializing(true);
    setInitResult(null);
    try {
      const adminPubkey  = new PublicKey(walletAddress);
      const admin2Pubkey = new PublicKey(admin2Input.trim());
      const tx = await buildInitializeTx(adminPubkey, admin2Pubkey);
      const signed = await walletProvider.signTransaction(tx);
      const { connection: conn } = await import("@/lib/solana");
      const sig = await conn.sendRawTransaction(signed.serialize());
      const latestBlockhash = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, ...latestBlockhash }, "confirmed");
      setInitResult(`✓ Initialized. admin=${walletAddress.slice(0,6)}… admin2=${admin2Input.slice(0,6)}…`);
      setInitState("new");
    } catch (e: unknown) {
      setInitResult(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
    setInitializing(false);
  }

  async function handleSetAdmin2() {
    if (!walletAddress || !walletProvider) return;
    setSettingAdmin2(true);
    setSetAdmin2Result(null);
    try {
      const adminPubkey  = new PublicKey(walletAddress);
      const admin2Pubkey = new PublicKey(admin2Input.trim());
      const tx = await buildSetAdmin2Tx(adminPubkey, admin2Pubkey);
      const signed = await walletProvider.signTransaction(tx);
      const { connection: conn } = await import("@/lib/solana");
      const sig = await conn.sendRawTransaction(signed.serialize());
      const latestBlockhash = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, ...latestBlockhash }, "confirmed");
      setSetAdmin2Result(`✓ Admin2 set to ${admin2Input.slice(0,6)}…`);
      setInitState("new");
    } catch (e: unknown) {
      setSetAdmin2Result(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
    setSettingAdmin2(false);
  }

  async function fetchVaultBalance() {
    try {
      const { connection: conn } = await import("@/lib/solana");
      const vault = getVaultPDA();
      const bal = await conn.getTokenAccountBalance(vault);
      setVaultBalance(Number(bal.value.uiAmount ?? 0));
    } catch {
      setVaultBalance(null);
    }
  }

  function getWithdrawAmount(): number {
    const parsed = parseFloat(withdrawAmount);
    return withdrawAmount && !isNaN(parsed) && parsed > 0 ? parsed : (vaultBalance ?? 0);
  }

  async function handleWithdraw() {
    if (!walletAddress || !walletProvider || !vaultBalance || vaultBalance <= 0) return;
    const amount = getWithdrawAmount();
    if (amount <= 0) return;
    setWithdrawing(true);
    setWithdrawResult(null);
    try {
      const adminPubkey = new PublicKey(walletAddress);
      const tx = await buildWithdrawTx(adminPubkey, amount);
      const signed = await walletProvider.signTransaction(tx);
      const { connection: conn } = await import("@/lib/solana");
      const sig = await conn.sendRawTransaction(signed.serialize());
      const latestBlockhash = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, ...latestBlockhash }, "confirmed");
      setWithdrawResult(`✓ Withdrawn $${amount.toFixed(2)} USDC`);
      setWithdrawAmount("");
      fetchVaultBalance();
    } catch (e: unknown) {
      setWithdrawResult(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
    setWithdrawing(false);
  }

  async function handleSendUsdc() {
    if (!walletAddress || !walletProvider || !sendRecipient.trim() || !sendAmount) return;
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) return;
    setSending(true);
    setSendResult(null);
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const fromPubkey = new PublicKey(walletAddress);
      const toPubkey   = new PublicKey(sendRecipient.trim());
      const tx = await buildSendUsdcTx(fromPubkey, toPubkey, amount);
      const signed = await walletProvider.signTransaction(tx);
      const { connection: conn } = await import("@/lib/solana");
      const sig = await conn.sendRawTransaction(signed.serialize());
      const latestBlockhash = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, ...latestBlockhash }, "confirmed");
      setSendResult(`✓ Sent $${amount.toFixed(2)} USDC — sig: ${sig.slice(0,12)}…`);
      setSendAmount("");
    } catch (e: unknown) {
      setSendResult(`✗ ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`);
    }
    setSending(false);
  }

  async function handleBatchCredit() {
    if (selectedCredits.size === 0 || !walletProvider) return;

    setCrediting(true);
    setCreditResult(null);

    // Group selected items by creator wallet — accumulate amounts
    const selected = creditItems.filter((c) => selectedCredits.has(c.source_id));
    const byWallet = new Map<string, { items: CreditItem[]; total: number }>();
    for (const item of selected) {
      const existing = byWallet.get(item.wallet);
      if (existing) {
        existing.items.push(item);
        existing.total += item.amount_usdc;
      } else {
        byWallet.set(item.wallet, { items: [item], total: item.amount_usdc });
      }
    }

    let ok = 0; let fail = 0;
    const confirmedItems: { source_id: string; source_type: string }[] = [];
    const failErrors: string[] = [];
    const adminPubkey = new PublicKey(walletAddress!);

    for (const [wallet, { items, total }] of byWallet.entries()) {
      try {
        const creatorPubkey = new PublicKey(wallet);
        const tx = await buildCreditCreatorTx(adminPubkey, creatorPubkey, total);
        const signed = await walletProvider.signTransaction(tx);
        const { connection: conn } = await import("@/lib/solana");
        const sig = await conn.sendRawTransaction(signed.serialize());
        const latestBlockhash = await conn.getLatestBlockhash();
        await conn.confirmTransaction({ signature: sig, ...latestBlockhash }, "confirmed");
        items.forEach((i) => confirmedItems.push({ source_id: i.source_id, source_type: i.source_type }));
        ok++;
      } catch (e) {
        console.error("credit_creator failed for wallet", wallet, e);
        const msg = e instanceof Error ? e.message : String(e);
        const isUnauthorized = msg.includes("Unauthorized") || msg.includes("6000");
        failErrors.push(isUnauthorized
          ? `Wallet ${wallet.slice(0,6)}… — Unauthorized: connected wallet is not admin/admin2 on-chain`
          : `Wallet ${wallet.slice(0,6)}… — ${msg.slice(0, 120)}`
        );
        fail++;
      }
    }

    // Mark as credited in DB
    if (confirmedItems.length > 0) {
      await fetch("/api/admin/credits/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_handle: twitterHandle, items: confirmedItems }),
      });
      // Remove credited items from UI list
      const doneIds = new Set(confirmedItems.map((i) => i.source_id));
      setCreditItems((prev) => prev.filter((c) => !doneIds.has(c.source_id)));
      setSelectedCredits(new Set());
    }

    setCrediting(false);
    setCreditResult({ ok, fail, errors: failErrors.length > 0 ? failErrors : undefined });
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

  useEffect(() => {
    if (!isAdmin || !twitterHandle || tab !== "credits") return;
    setLoadingCredits(true);
    fetch(`/api/admin/credits/pending?admin_handle=${twitterHandle}`)
      .then((r) => r.json())
      .then((d) => setCreditItems(d.pending ?? []))
      .finally(() => setLoadingCredits(false));
    // Check on-chain state: none=not present, old=74 bytes (no admin2), new=106+ bytes
    // State layout: 8 disc | 32 admin | 32 usdc_mint | 1 bump | 1 vault_bump | 32 admin2 | ...
    import("@/lib/solana").then(({ connection }) => {
      import("@/lib/contract").then(({ getStatePDA }) => {
        import("@solana/web3.js").then(({ PublicKey }) => {
          connection.getAccountInfo(getStatePDA()).then((info) => {
            if (!info) {
              setInitState("none");
            } else if (info.data.length >= 106) {
              setInitState("new");
              setOnChainAdmin(new PublicKey(info.data.slice(8, 40)).toBase58());
              setOnChainAdmin2(new PublicKey(info.data.slice(74, 106)).toBase58());
            } else {
              setInitState("old");
              if (info.data.length >= 40) {
                setOnChainAdmin(new PublicKey(info.data.slice(8, 40)).toBase58());
              }
            }
          }).catch(() => setInitState("none"));
        });
      });
    });
    // Fetch vault USDC balance
    fetchVaultBalance();
  }, [isAdmin, twitterHandle, tab]);

  useEffect(() => { setPendingPage(0); }, [pendingTypeFilter, pendingSearch]);
  useEffect(() => { setActivePage(0); }, [activeTypeFilter, activeStatusFilter, activeSearch]);
  useEffect(() => { setCompletedPage(0); }, [completedTypeFilter, completedCreditedFilter, completedSearch]);
  useEffect(() => { setCancelledPage(0); }, [cancelledTypeFilter, cancelledSearch]);
  useEffect(() => { setCreditJobPage(0); }, [creditTypeFilter]);

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

  async function handleOpenActiveDetail(job: ActiveJob) {
    setActiveDetailModal(job);
    setActiveModalCreators([]);
    setLoadingActiveCreators(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/applicants`);
      const { applicants } = await res.json();
      setActiveModalCreators(applicants ?? []);
    } finally {
      setLoadingActiveCreators(false);
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
              This page is only accessible to {ADMINS.map((a, i) => (
                <span key={a}>{i > 0 && " and "}<strong>@{a}</strong></span>
              ))}.
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
          <button
            onClick={() => setTab("credits")}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              tab === "credits"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Credits
            {creditItems.length > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-purple-500 text-white rounded-full px-1.5 py-0.5">
                {creditItems.length}
              </span>
            )}
          </button>
        </div>

        {/* ── CREDITS TAB ── */}
        {tab === "credits" && (
          <div className="space-y-4">
            {/* Vault balance + withdraw cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vault balance */}
              <div className="card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 tracking-wide font-semibold">Vault Balance</p>
                    <a
                      href={`https://solscan.io/account/${getVaultPDA().toBase58()}?cluster=devnet`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-sm font-bold text-neutral-900 dark:text-white hover:text-blue-500 transition-colors"
                    >
                      {vaultBalance === null ? "—" : `${vaultBalance.toFixed(2)} USDC`}
                    </a>
                  </div>
                </div>
                <button onClick={fetchVaultBalance} className="btn-outline text-xs px-2 py-1">Refresh</button>
              </div>

              {/* Withdraw */}
              <div className="card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="text-[10px] text-neutral-400 tracking-wide font-semibold">Withdraw Vault</p>
                      <span className="text-[10px] text-neutral-400">
                        (<span className={
                          withdrawResult
                            ? withdrawResult.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-red-500"
                            : "text-orange-500"
                        }>
                          {withdrawResult ? withdrawResult : "LEAVE BLANK = ALL"}
                        </span>)
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={withdrawAmount}
                        onChange={e => { setWithdrawAmount(e.target.value); setWithdrawResult(null); }}
                        placeholder="0.00"
                        disabled={withdrawing}
                        className="text-sm font-bold bg-transparent border-b border-neutral-300 dark:border-neutral-700 outline-none p-0 w-16 text-neutral-900 dark:text-white placeholder-neutral-300 dark:placeholder-neutral-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm font-bold text-neutral-900 dark:text-white">USDC</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowWithdrawConfirm(true)}
                  disabled={withdrawing || !walletAddress || !vaultBalance || vaultBalance <= 0}
                  className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50 !text-white !bg-orange-500 hover:!bg-orange-600 !border-orange-500 whitespace-nowrap flex items-center gap-1 shrink-0"
                >
                  {withdrawing && <Loader2 className="w-3 h-3 animate-spin" />}
                  {withdrawing ? "Withdrawing…" : "Withdraw"}
                </button>
              </div>
            </div>

            {/* Send USDC (devnet helper) */}
            <details className="card p-4 text-xs">
              <summary className="cursor-pointer select-none font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                Send USDC (devnet helper)
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  Transfer USDC directly from the connected wallet to any address. Useful for funding test wallets.
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    value={sendRecipient}
                    onChange={(e) => { setSendRecipient(e.target.value); setSendResult(null); }}
                    placeholder="Recipient wallet address (base58)"
                    disabled={sending}
                    className="input text-xs font-mono w-full"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sendAmount}
                      onChange={(e) => { setSendAmount(e.target.value); setSendResult(null); }}
                      placeholder="Amount USDC"
                      disabled={sending}
                      className="input text-xs w-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={handleSendUsdc}
                      disabled={sending || !walletAddress || !sendRecipient.trim() || !sendAmount || parseFloat(sendAmount) <= 0}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                  {sendResult && (
                    <p className={`text-[11px] font-medium break-all ${sendResult.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {sendResult}
                    </p>
                  )}
                </div>
              </div>
            </details>

            {/* Batch action bar */}
            <div className="card p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Wallet2 className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="text-xs font-mono text-neutral-600 dark:text-neutral-300">
                    {walletAddress
                      ? <>Signing wallet: <span className="text-purple-400">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span></>
                      : <span className="text-neutral-500 dark:text-neutral-400">No wallet connected</span>
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">{selectedCredits.size} selected</span>
                  <button
                    onClick={handleBatchCredit}
                    disabled={crediting || selectedCredits.size === 0}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {crediting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                    {crediting ? "Signing…" : "Batch Credit"}
                  </button>
                </div>
              </div>
              {/* On-chain admin info */}
              {(onChainAdmin || initState === "loading") && (
                <div className="border-t border-neutral-100 dark:border-neutral-800 pt-2.5 flex flex-col gap-1">
                  {onChainAdmin && (
                    <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                      On-chain admin1: <span className={walletAddress?.toLowerCase() === onChainAdmin.toLowerCase() ? "text-green-600 dark:text-green-400 font-semibold" : "text-neutral-400"}>{onChainAdmin.slice(0,6)}…{onChainAdmin.slice(-4)}</span>
                      {walletAddress?.toLowerCase() === onChainAdmin.toLowerCase() && <span className="ml-1 text-green-600 dark:text-green-400">✓ connected</span>}
                    </p>
                  )}
                  {onChainAdmin2 && (
                    <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                      On-chain admin2: <span className={walletAddress?.toLowerCase() === onChainAdmin2.toLowerCase() ? "text-green-600 dark:text-green-400 font-semibold" : "text-neutral-400"}>{onChainAdmin2.slice(0,6)}…{onChainAdmin2.slice(-4)}</span>
                      {walletAddress?.toLowerCase() === onChainAdmin2.toLowerCase() && <span className="ml-1 text-green-600 dark:text-green-400">✓ connected</span>}
                    </p>
                  )}
                  {walletAddress && onChainAdmin && walletAddress.toLowerCase() !== onChainAdmin.toLowerCase() && (!onChainAdmin2 || walletAddress.toLowerCase() !== onChainAdmin2.toLowerCase()) && (
                    <p className="text-[11px] text-red-500 font-semibold">
                      ⚠ Connected wallet does not match admin1{onChainAdmin2 ? " or admin2" : ""} — batch credit will fail.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Initialize program (one-time setup) */}
            {initState === "none" && (
              <details className="card p-4 text-xs text-neutral-500 dark:text-neutral-400">
                <summary className="cursor-pointer select-none font-medium">⚙ Initialize escrow program (one-time)</summary>
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-neutral-400 dark:text-neutral-500">Connect admin wallet (admin1), enter admin2 wallet address, then Initialize. Both wallets can sign Batch Credit.</p>
                  <div className="flex flex-col gap-2">
                    <input
                      value={admin2Input}
                      onChange={(e) => setAdmin2Input(e.target.value)}
                      placeholder="Admin2 wallet address (base58)"
                      className="input text-xs font-mono w-full"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleInitialize}
                        disabled={initializing || !walletAddress || !admin2Input.trim()}
                        className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        {initializing ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                        {initializing ? "Initializing…" : "Initialize"}
                      </button>
                      {initResult && <span className={initResult.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-red-500"}>{initResult}</span>}
                    </div>
                  </div>
                </div>
              </details>
            )}

            {/* Upgrade old single-admin state to multi-admin */}
            {initState === "old" && (
              <details className="card p-4 text-xs text-neutral-500 dark:text-neutral-400">
                <summary className="cursor-pointer select-none font-medium">⚙ Upgrade escrow: set admin2</summary>
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-neutral-400 dark:text-neutral-500">Program is initialized (single-admin). Connect admin1 wallet and enter admin2 address to enable dual-admin signing.</p>
                  <div className="flex flex-col gap-2">
                    <input
                      value={admin2Input}
                      onChange={(e) => setAdmin2Input(e.target.value)}
                      placeholder="Admin2 wallet address (base58)"
                      className="input text-xs font-mono w-full"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSetAdmin2}
                        disabled={settingAdmin2 || !walletAddress || !admin2Input.trim()}
                        className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        {settingAdmin2 ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                        {settingAdmin2 ? "Upgrading…" : "Set Admin2"}
                      </button>
                      {setAdmin2Result && <span className={setAdmin2Result.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-red-500"}>{setAdmin2Result}</span>}
                    </div>
                  </div>
                </div>
              </details>
            )}

            {creditResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium space-y-1 ${creditResult.fail === 0 ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"}`}>
                <p>{creditResult.ok} creator(s) credited on-chain.{creditResult.fail > 0 && ` ${creditResult.fail} failed.`}</p>
                {creditResult.errors?.map((err, i) => (
                  <p key={i} className="text-[11px] font-normal opacity-80 break-all">• {err}</p>
                ))}
                {creditResult.errors?.some(e => e.includes("Unauthorized")) && (
                  <p className="text-[11px] font-semibold mt-1">
                    ⚠ Make sure the wallet connected above is the admin or admin2 wallet registered on-chain.
                  </p>
                )}
              </div>
            )}

            {loadingCredits && (
              <div className="flex items-center justify-center py-20 text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Loading…</span>
              </div>
            )}

            {!loadingCredits && creditItems.length === 0 && (
              <div className="card p-12 text-center text-neutral-400 dark:text-neutral-500">
                <Coins className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending credits. All creators have been paid on-chain.</p>
              </div>
            )}

            {/* Type filter pills */}
            {!loadingCredits && creditItems.length > 0 && (() => {
              const creditTypes = ["all", ...Array.from(new Set(creditItems.map((c) => c.type)))];
              if (creditTypes.length <= 2) return null;
              return (
                <div className="flex flex-wrap gap-1.5">
                  {creditTypes.map((t) => (
                    <button key={t} onClick={() => setCreditTypeFilter(t)}
                      className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${creditTypeFilter === t ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"}`}>
                      {t === "all" ? "All" : TYPE_LABEL[t] ?? t}
                    </button>
                  ))}
                </div>
              );
            })()}

            {!loadingCredits && creditItems.length > 0 && (() => {
              const displayedCreditItems = creditTypeFilter === "all"
                ? creditItems
                : creditItems.filter((c) => c.type === creditTypeFilter);

              // Group by job_id, preserve insertion order (API returns newest first)
              const groups: Record<string, CreditItem[]> = {};
              for (const item of displayedCreditItems) {
                (groups[item.job_id] ??= []).push(item);
              }
              const jobKeys = Object.keys(groups);

              if (jobKeys.length === 0) {
                return (
                  <div className="card p-8 text-center text-neutral-400 dark:text-neutral-500">
                    <p className="text-sm">No pending credits match this filter.</p>
                  </div>
                );
              }

              function toggleJob(jobId: string) {
                setExpandedTypes((prev) => {
                  const next = new Set(prev);
                  next.has(jobId) ? next.delete(jobId) : next.add(jobId);
                  return next;
                });
              }
              function toggleGroupSelect(_jobId: string, items: CreditItem[]) {
                const ids = items.map((i) => i.source_id);
                const allSelected = ids.every((id) => selectedCredits.has(id));
                setSelectedCredits((prev) => {
                  const next = new Set(prev);
                  ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
                  return next;
                });
              }

              const CREDIT_PAGE_SIZE = 20;
              const jobTotalPages = Math.ceil(jobKeys.length / CREDIT_PAGE_SIZE);
              const jobPage = Math.min(creditJobPage, Math.max(0, jobTotalPages - 1));
              const jobPageKeys = jobKeys.slice(jobPage * CREDIT_PAGE_SIZE, (jobPage + 1) * CREDIT_PAGE_SIZE);

              return (
                <>
                <div className="card overflow-hidden">
                  {/* Select all */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                    <input
                      type="checkbox"
                      checked={selectedCredits.size === displayedCreditItems.length && displayedCreditItems.length > 0}
                      onChange={(e) => setSelectedCredits(e.target.checked ? new Set(displayedCreditItems.map((c) => c.source_id)) : new Set())}
                      className="rounded"
                    />
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                      Select all ({displayedCreditItems.length}{creditTypeFilter !== "all" ? ` of ${creditItems.length}` : ""})
                    </span>
                    {selectedCredits.size > 0 && (
                      <span className="text-xs text-purple-500 font-semibold ml-auto">
                        Total: ${creditItems.filter((c) => selectedCredits.has(c.source_id)).reduce((s, c) => s + c.amount_usdc, 0).toFixed(2)} USDC
                      </span>
                    )}
                  </div>

                  {/* Per-job groups (paginated) */}
                  {jobPageKeys.map((jobId) => {
                    const items = groups[jobId];
                    const rep = items[0];
                    const isOpen = expandedTypes.has(jobId);
                    const groupIds = items.map((i) => i.source_id);
                    const allGroupSelected = groupIds.every((id) => selectedCredits.has(id));
                    const someGroupSelected = groupIds.some((id) => selectedCredits.has(id));
                    const groupTotal = items.reduce((s, c) => s + c.amount_usdc, 0);

                    const creatorPage = creditCreatorPages[jobId] ?? 0;
                    const creatorTotalPages = Math.ceil(items.length / CREDIT_PAGE_SIZE);
                    const creatorPageSafe = Math.min(creatorPage, Math.max(0, creatorTotalPages - 1));
                    const pageItems = items.slice(creatorPageSafe * CREDIT_PAGE_SIZE, (creatorPageSafe + 1) * CREDIT_PAGE_SIZE);

                    return (
                      <div key={jobId} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                        {/* Group header */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 cursor-pointer select-none"
                          onClick={() => toggleJob(jobId)}>
                          <input
                            type="checkbox"
                            checked={allGroupSelected}
                            ref={(el) => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleGroupSelect(jobId, items)}
                            className="rounded shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono font-bold text-neutral-500 dark:text-neutral-400 shrink-0">
                                {fmtJobId(rep.type, rep.job_id)}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 shrink-0">
                                {TYPE_LABEL[rep.type] ?? rep.type}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[260px]">
                              {rep.title}
                            </p>
                          </div>
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-full px-1.5 py-0.5 font-semibold shrink-0">
                            {items.length} creator{items.length > 1 ? "s" : ""}
                          </span>
                          <span className="text-xs text-green-600 dark:text-green-400 font-semibold shrink-0">
                            ${groupTotal.toFixed(2)}
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-neutral-400 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                        </div>

                        {/* Expanded table */}
                        {isOpen && (
                          <>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] text-neutral-400 uppercase tracking-wide">
                                <th className="w-8 px-4 py-2 text-left" />
                                <th className="px-3 py-2 text-left">Creator</th>
                                <th className="px-3 py-2 text-left">Wallet</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                              {pageItems.map((item) => (
                                <tr key={item.source_id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                                  <td className="px-4 py-2.5">
                                    <input
                                      type="checkbox"
                                      checked={selectedCredits.has(item.source_id)}
                                      onChange={(e) => {
                                        const next = new Set(selectedCredits);
                                        e.target.checked ? next.add(item.source_id) : next.delete(item.source_id);
                                        setSelectedCredits(next);
                                      }}
                                      className="rounded"
                                    />
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <p className="font-semibold text-neutral-900 dark:text-white">@{item.creator_handle}</p>
                                    <p className="text-[10px] text-neutral-400">{item.creator_name}</p>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono text-neutral-400">{item.wallet.slice(0, 6)}…{item.wallet.slice(-4)}</td>
                                  <td className="px-3 py-2.5 text-right font-bold text-green-600 dark:text-green-400">${item.amount_usdc.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* Inner pagination */}
                          {creatorTotalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                              <span className="text-[10px] text-neutral-400">
                                {creatorPageSafe * CREDIT_PAGE_SIZE + 1}–{Math.min((creatorPageSafe + 1) * CREDIT_PAGE_SIZE, items.length)} of {items.length}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setCreditCreatorPages((p) => ({ ...p, [jobId]: creatorPageSafe - 1 }))}
                                  disabled={creatorPageSafe === 0}
                                  className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[10px] font-medium text-neutral-500 px-1">{creatorPageSafe + 1}/{creatorTotalPages}</span>
                                <button
                                  onClick={() => setCreditCreatorPages((p) => ({ ...p, [jobId]: creatorPageSafe + 1 }))}
                                  disabled={creatorPageSafe >= creatorTotalPages - 1}
                                  className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Outer pagination */}
                {jobTotalPages > 1 && (
                  <div className="flex items-center justify-between px-1 mt-3">
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {jobPage * CREDIT_PAGE_SIZE + 1}–{Math.min((jobPage + 1) * CREDIT_PAGE_SIZE, jobKeys.length)} of {jobKeys.length} jobs
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCreditJobPage(jobPage - 1)}
                        disabled={jobPage === 0}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 px-2">{jobPage + 1} / {jobTotalPages}</span>
                      <button
                        onClick={() => setCreditJobPage(jobPage + 1)}
                        disabled={jobPage >= jobTotalPages - 1}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── Withdraw Confirm Modal ── */}
        {showWithdrawConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowWithdrawConfirm(false)} />
            <div className="relative card p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Confirm Withdraw?</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {withdrawAmount && parseFloat(withdrawAmount) > 0
                      ? `Withdraw $${parseFloat(withdrawAmount).toFixed(2)} USDC from escrow vault.`
                      : "This will move ALL USDC from the escrow vault to your connected wallet."
                    }
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-4 py-3 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Amount</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{getWithdrawAmount().toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Destination</span>
                  <span className="font-mono text-neutral-600 dark:text-neutral-300">
                    {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Source</span>
                  <span className="font-mono text-neutral-600 dark:text-neutral-300">Escrow Vault</span>
                </div>
              </div>

              {(!withdrawAmount || !(parseFloat(withdrawAmount) > 0)) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  ⚠ Creators with pending claims will not be able to claim until vault is REFUNDED
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowWithdrawConfirm(false)}
                  className="btn-outline text-xs px-4 py-2 flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowWithdrawConfirm(false); handleWithdraw(); }}
                  className="btn-primary text-xs px-4 py-2 flex-1 !bg-red-600 hover:!bg-red-700 !border-red-600"
                >
                  Confirm Withdraw
                </button>
              </div>
            </div>
          </div>
        )}

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
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Slots</th>
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
                              <td className="px-4 py-3 whitespace-nowrap">
                                {(() => {
                                  const max = job.max_creators ?? 1;
                                  const taken = job.slots_taken ?? 0;
                                  const remaining = max - taken;
                                  if (max <= 1) {
                                    return taken === 1
                                      ? <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">1 / 1</span>
                                      : <span className="text-neutral-300 dark:text-neutral-600 text-[10px]">0 / 1</span>;
                                  }
                                  return (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">{taken} / {max}</span>
                                      {remaining > 0 && (
                                        <span className="text-[9px] text-green-600 dark:text-green-400 font-medium">{remaining} left</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white whitespace-nowrap">${job.price_usdc.toFixed(1)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => handleOpenActiveDetail(job)} title="View Creators"
                                    className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                                    <Users className="w-3.5 h-3.5" />
                                  </button>
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
                const isCredited = j.credited_at !== null;
                const matchCredited =
                  completedCreditedFilter === "all" ||
                  (completedCreditedFilter === "credited" &&  isCredited) ||
                  (completedCreditedFilter === "pending"  && !isCredited);
                const matchSearch = !q ||
                  fmtJobId(j.type, j.id).toLowerCase().includes(q) ||
                  j.title.toLowerCase().includes(q) ||
                  (j.client?.twitter_handle ?? "").toLowerCase().includes(q) ||
                  (j.creator?.twitter_handle ?? "").toLowerCase().includes(q);
                return matchType && matchCredited && matchSearch;
              });
              const totalPages = Math.ceil(filtered.length / ADMIN_PAGE_SIZE);
              const page = Math.min(completedPage, Math.max(0, totalPages - 1));
              const pageData = filtered.slice(page * ADMIN_PAGE_SIZE, (page + 1) * ADMIN_PAGE_SIZE);
              const pendingCreditTotal = filtered.filter((j) => !j.credited_at).reduce((s, j) => s + j.price_usdc, 0);

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
                  "Credited":       j.credited_at ? fmtDate(j.credited_at) : "No",
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
                      {[{ val: "all", label: "All" }, { val: "credited", label: "Credited" }, { val: "pending", label: "Pending" }].map(({ val, label }) => (
                        <button key={val} onClick={() => setCompletedCreditedFilter(val)}
                          className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${completedCreditedFilter === val ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600"}`}>
                          {label}
                        </button>
                      ))}
                      {pendingCreditTotal > 0 && (
                        <>
                          <span className="text-neutral-300 dark:text-neutral-700 text-xs select-none">|</span>
                          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold whitespace-nowrap shrink-0">
                            <Clock className="w-3 h-3" /> Pending: ${pendingCreditTotal.toFixed(1)} USDC
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
                          <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Credit</th>
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
                              {job.credited_at
                                ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">Credited</span>
                                : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Pending</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
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

      {/* ── Active Job Creators Modal ── */}
      {activeDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setActiveDetailModal(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-neutral-900 dark:text-white truncate max-w-[320px]">{activeDetailModal.title}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
                  {fmtJobId(activeDetailModal.type, activeDetailModal.id)} · {TYPE_LABEL[activeDetailModal.type] ?? activeDetailModal.type}
                  {(activeDetailModal.max_creators ?? 1) > 1 && (
                    <span className="ml-2 text-neutral-500 dark:text-neutral-400">
                      · {activeDetailModal.slots_taken ?? 0}/{activeDetailModal.max_creators} slots
                      {((activeDetailModal.max_creators ?? 1) - (activeDetailModal.slots_taken ?? 0)) > 0 && (
                        <span className="ml-1 text-green-600 dark:text-green-400">
                          ({(activeDetailModal.max_creators ?? 1) - (activeDetailModal.slots_taken ?? 0)} remaining)
                        </span>
                      )}
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => setActiveDetailModal(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto">
              {loadingActiveCreators ? (
                <div className="flex items-center justify-center py-16 gap-2 text-neutral-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : activeModalCreators.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 dark:text-neutral-500">
                  <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No creators have accepted this job yet.</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400">#</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400">Handle</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400">Status</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-neutral-600 dark:text-neutral-400">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {activeModalCreators.map((creator, i) => (
                      <tr key={creator.twitter_handle} className="bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                        <td className="px-4 py-2.5 text-neutral-400 dark:text-neutral-500">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">@{creator.twitter_handle}</span>
                            {creator.is_verified_blue && <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />}
                          </div>
                          {creator.display_name && (
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate max-w-[140px]">{creator.display_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            creator.status === "completed"   ? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                            : creator.status === "in_progress" ? "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                            : creator.status === "missed"      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700"
                            : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                          }`}>
                            {creator.status === "in_progress" ? "Working" : creator.status === "accepted" ? "Accepted" : creator.status === "completed" ? "Done" : creator.status === "missed" ? "Missed" : creator.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {creator.proof_url ? (
                            <a href={creator.proof_url} target="_blank" rel="noopener noreferrer"
                              className="text-blue-500 hover:underline flex items-center gap-1 whitespace-nowrap">
                              <ExternalLink className="w-3 h-3" /> Proof
                            </a>
                          ) : <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

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
