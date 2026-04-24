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
      .select("id, status, created_at, deadline_hours, deadline_override, client_id, title, is_agent_job")
      .in("status", ["open", "in_progress"]);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const now = Date.now();
    const toCancel: string[]   = [];
    const toComplete: string[] = [];

    for (const job of activeJobs ?? []) {
      const expiresAt = (job as any).deadline_override
        ? new Date((job as any).deadline_override).getTime()
        : new Date(job.created_at).getTime() + (job.deadline_hours ?? 48) * 3_600_000;
      if (expiresAt > now) continue;
      if (job.status === "open")        toCancel.push(job.id);
      if (job.status === "in_progress") toComplete.push(job.id);
    }

    if (toCancel.length) {
      await db.from("jobs").update({ status: "cancelled", cancel_reason: "expired_no_creator" }).in("id", toCancel);

      // Notify clients their job expired without a creator
      const notifInserts = (activeJobs ?? [])
        .filter((j) => toCancel.includes(j.id) && (j as any).client_id && !(j as any).is_agent_job)
        .map((j) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          user_id: (j as any).client_id as string,
          job_id: j.id,
          message: `Your job "${(j as any).title}" expired — no creator accepted in time.`,
        }));
      if (notifInserts.length) {
        try { await db.from("notifications").insert(notifInserts); } catch {}
      }
    }
    if (toComplete.length) {
      const completedAt = new Date().toISOString();
      await db.from("jobs").update({ status: "completed", completed_at: completedAt }).in("id", toComplete);
      // Mark campaign slots that were accepted but never submitted proof before the deadline
      await db
        .from("job_completions")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ status: "missed" } as any)
        .in("job_id", toComplete)
        .eq("status", "accepted");

      // Notify clients their in_progress job was force-completed at deadline
      const completeNotifs = (activeJobs ?? [])
        .filter((j) => toComplete.includes(j.id) && (j as any).client_id && !(j as any).is_agent_job)
        .map((j) => ({
          user_id: (j as any).client_id as string,
          job_id: j.id,
          message: `Your job "${(j as any).title}" reached its deadline and has been marked completed.`,
        }));
      if (completeNotifs.length) {
        try { await db.from("notifications").insert(completeNotifs); } catch {}
      }
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
