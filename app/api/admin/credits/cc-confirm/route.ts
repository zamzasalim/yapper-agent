import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { ADMINS } from "@/lib/admins";
import { exerciseBatchClaim, transferCC, ClaimInput, ClaimResult } from "@/lib/canton";

/**
 * POST /api/admin/credits/cc-confirm
 * Exercise ClaimReward on each CC job's DAML JobEscrow contract.
 * Marks canton_credited_at on the job/completion rows.
 *
 * Body: {
 *   admin_handle: string,
 *   items: Array<{
 *     source_id:        string,              // job.id or job_completion.id
 *     source_type:      "job" | "completion",
 *     contract_id:      string,              // canton_contract_id from jobs
 *     creator_party_id: string,              // canton_party_id from users
 *     amount_cc:        number,              // CC to pay this creator
 *   }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { admin_handle, items } = await req.json();

    if (!ADMINS.some((a) => a.toLowerCase() === (admin_handle ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    // ── Categorise items ──────────────────────────────────────────────────────
    // trueSkipped  : missing creator_party_id or amount_cc → cannot pay at all
    // payable      : has party_id + amount_cc (contract_id may be null → skip DAML only)
    // DAML claims  : deduplicated by contract_id (ClaimReward is a consuming choice)
    const trueSkipped: string[] = [];
    const claims: ClaimInput[] = [];
    const seenContracts = new Set<string>();
    // Maps contract_id → ClaimResult for per-item updateId lookup after batch
    let resultByContractId = new Map<string, ClaimResult>();

    for (const item of items) {
      if (!item.creator_party_id || !item.amount_cc) {
        trueSkipped.push(item.source_id);
        continue;
      }
      if (item.contract_id && !seenContracts.has(item.contract_id)) {
        seenContracts.add(item.contract_id);
        claims.push({
          contractId:     item.contract_id,
          creatorPartyId: item.creator_party_id,
          amount:         item.amount_cc,
        });
      }
    }

    if (items.length === trueSkipped.length) {
      return NextResponse.json(
        { error: "No payable items (all missing creator_party_id or amount_cc)", trueSkipped },
        { status: 400 },
      );
    }

    // ── Exercise ClaimReward (fault-tolerant — errors recorded, never throws) ─
    const claimResults = claims.length > 0 ? await exerciseBatchClaim(claims) : [];
    resultByContractId = new Map(claimResults.map((r) => [r.contractId, r]));
    const claimErrors = claimResults.filter((r) => r.error).map((r) => `${r.contractId}: ${r.error}`);

    // ── Transfer CC to each payable creator (best-effort) ────────────────────
    const transferTxIds: (string | null)[] = [];
    for (const item of items) {
      if (trueSkipped.includes(item.source_id)) {
        transferTxIds.push(null);
        continue;
      }
      const txId = await transferCC(
        item.creator_party_id,
        item.amount_cc,
        `Yapper job reward ${item.source_id}`,
      );
      transferTxIds.push(txId);
    }

    // ── Mark credited in DB ───────────────────────────────────────────────────
    const db  = createServerClient();
    const now = new Date().toISOString();
    const dbErrors: string[] = [];

    for (const item of items) {
      if (trueSkipped.includes(item.source_id)) continue;
      const claimResult = item.contract_id ? resultByContractId.get(item.contract_id) : null;
      const updateId = claimResult?.updateId ?? null;
      const table = item.source_type === "job" ? "jobs" : "job_completions";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any)
        .from(table)
        .update({ canton_credited_at: now, canton_credit_tx: updateId })
        .eq("id", item.source_id)
        .is("canton_credited_at", null);
      if (error) dbErrors.push(error.message);
    }

    if (dbErrors.length > 0) {
      return NextResponse.json({ error: dbErrors.join("; "), claimErrors }, { status: 500 });
    }

    return NextResponse.json({
      confirmed:       items.length - trueSkipped.length,
      trueSkipped,
      claimErrors,     // DAML errors — payment still went through for these
      transferTxIds,
      transferPending: transferTxIds.filter((t) => t === null).length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
