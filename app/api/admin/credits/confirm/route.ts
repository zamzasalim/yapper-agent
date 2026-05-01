import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { ADMINS } from "@/lib/admins";

/**
 * POST /api/admin/credits/confirm
 * Called after admin signs & confirms the batch_credit transaction on-chain.
 * Marks the credited jobs/completions with credited_at timestamp.
 *
 * Body: {
 *   admin_handle: string,
 *   tx_signature: string,           // on-chain tx sig for audit trail
 *   items: Array<{ source_id: string, source_type: "job" | "completion" }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { admin_handle, tx_signature, items } = await req.json();

    if (!ADMINS.some((a) => a.toLowerCase() === (admin_handle ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    const db       = createServerClient();
    const now      = new Date().toISOString();
    const meta     = { credited_at: now, credit_tx: tx_signature ?? null };

    const jobIds        = items.filter((i) => i.source_type === "job").map((i) => i.source_id);
    const completionIds = items.filter((i) => i.source_type === "completion").map((i) => i.source_id);

    const errors: string[] = [];

    if (jobIds.length > 0) {
      // is("credited_at", null) prevents double-crediting if endpoint called twice
      const { error } = await db.from("jobs").update(meta).in("id", jobIds).is("credited_at", null);
      if (error) errors.push(error.message);
    }

    if (completionIds.length > 0) {
      // Cast as any: credited_at/credit_tx are migration-added columns, not yet in generated types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any).from("job_completions").update(meta).in("id", completionIds).is("credited_at", null);
      if (error) {
        errors.push(error.message);
      } else {
        // Determine which parent jobs now have ALL completions credited → set jobs.credited_at too
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: parentRows } = await (db as any)
          .from("job_completions")
          .select("job_id")
          .in("id", completionIds);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const affectedJobIds = [...new Set(((parentRows ?? []) as any[]).map((r) => r.job_id as string))];
        if (affectedJobIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: uncredited } = await (db as any)
            .from("job_completions")
            .select("job_id")
            .in("job_id", affectedJobIds)
            .is("credited_at", null);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stillPending = new Set(((uncredited ?? []) as any[]).map((r) => r.job_id as string));
          const fullyPaid = affectedJobIds.filter((id) => !stillPending.has(id));
          if (fullyPaid.length > 0) {
            await db.from("jobs").update(meta).in("id", fullyPaid).is("credited_at", null);
          }
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
    }

    return NextResponse.json({ confirmed: items.length, tx: tx_signature });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
