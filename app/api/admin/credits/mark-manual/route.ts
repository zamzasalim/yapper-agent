import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { ADMINS } from "@/lib/admins";

/**
 * POST /api/admin/credits/mark-manual
 * Mark a job/completion as paid without an on-chain transaction.
 * For USDC jobs: sets credited_at + credit_tx.
 * For CC jobs:   sets canton_credited_at + canton_credit_tx.
 *
 * Body: { admin_handle, source_id, source_type: "job" | "completion", currency?: "usdc" | "cc", note?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { admin_handle, source_id, source_type, currency, note } = await req.json();

    if (!ADMINS.some((a) => a.toLowerCase() === (admin_handle ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!source_id || !["job", "completion"].includes(source_type)) {
      return NextResponse.json({ error: "source_id and valid source_type required" }, { status: 400 });
    }

    const db  = createServerClient();
    const now = new Date().toISOString();
    const isCC = currency === "cc";

    const usdcMeta   = { credited_at: now,        credit_tx: note ?? "manual" };
    const ccMeta     = { canton_credited_at: now,  canton_credit_tx: note ?? "manual" };
    const meta       = isCC ? ccMeta : usdcMeta;
    const nullFilter = isCC ? "canton_credited_at" : "credited_at";

    if (source_type === "job") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any).from("jobs").update(meta).eq("id", source_id).is(nullFilter, null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any).from("job_completions").update(meta).eq("id", source_id).is(nullFilter, null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // For USDC completions: if all slots for the parent job are now credited, mark the job too
      if (!isCC) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: parentRow } = await (db as any).from("job_completions").select("job_id").eq("id", source_id).single();
        if (parentRow?.job_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: uncredited } = await (db as any)
            .from("job_completions")
            .select("id")
            .eq("job_id", parentRow.job_id)
            .eq("status", "completed")
            .is("credited_at", null);
          if (!uncredited || uncredited.length === 0) {
            await db.from("jobs").update(usdcMeta).eq("id", parentRow.job_id).is("credited_at", null);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
