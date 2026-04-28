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
      const { error } = await db.from("jobs").update(meta).in("id", jobIds);
      if (error) errors.push(error.message);
    }

    if (completionIds.length > 0) {
      // Cast as any: credited_at/credit_tx are migration-added columns, not yet in generated types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any).from("job_completions").update(meta).in("id", completionIds);
      if (error) errors.push(error.message);
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
