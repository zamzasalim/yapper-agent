import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

const ADMINS = ["Autosultan_team", "0xhnfdm"];

/**
 * POST /api/admin/expire-jobs?admin_handle=xxx
 * Scans all open/in_progress jobs and expires those past their deadline:
 *   - open       → cancelled  (no creator accepted before deadline)
 *   - in_progress → completed  (creator accepted but deadline passed)
 * Returns counts of affected rows.
 */
export async function POST(req: NextRequest) {
  try {
    const admin_handle = req.nextUrl.searchParams.get("admin_handle");
    if (!admin_handle) {
      return NextResponse.json({ error: "admin_handle required" }, { status: 400 });
    }
    const isAdmin = ADMINS.some((a) => a.toLowerCase() === admin_handle.toLowerCase());
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const db = createServerClient();

    const { data: activeJobs, error: fetchErr } = await db
      .from("jobs")
      .select("id, status, created_at, deadline_hours")
      .in("status", ["open", "in_progress"]);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const now = Date.now();
    const toCancel: string[]   = [];
    const toComplete: string[] = [];

    for (const job of activeJobs ?? []) {
      const expiresAt = new Date(job.created_at).getTime() + (job.deadline_hours ?? 48) * 3_600_000;
      if (expiresAt > now) continue;
      if (job.status === "open")        toCancel.push(job.id);
      if (job.status === "in_progress") toComplete.push(job.id);
    }

    if (toCancel.length) {
      await db.from("jobs").update({ status: "cancelled", cancel_reason: "expired_no_creator" }).in("id", toCancel);
    }
    if (toComplete.length) {
      await db.from("jobs").update({ status: "completed", completed_at: new Date().toISOString() }).in("id", toComplete);
    }

    return NextResponse.json({
      cancelled: toCancel.length,
      completed: toComplete.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
