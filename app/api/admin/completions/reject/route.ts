import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { ADMINS } from "@/lib/admins";

/**
 * POST /api/admin/completions/reject
 * Body: { source_id, source_type: "completion"|"job", admin_handle }
 *
 * Rejects a pending credit item:
 *   - completion: sets status="rejected", decrements job.slots_taken, reopens slot
 *   - job (single-creator): resets job back to "open"
 */
export async function POST(req: NextRequest) {
  try {
    const { source_id, source_type, admin_handle } = await req.json();

    if (!ADMINS.some((a) => a.toLowerCase() === (admin_handle ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!source_id || !source_type) {
      return NextResponse.json({ error: "source_id and source_type required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServerClient() as any;

    if (source_type === "completion") {
      const { data: completion } = await db
        .from("job_completions")
        .select("id, job_id, creator_id")
        .eq("id", source_id)
        .maybeSingle();

      if (!completion) return NextResponse.json({ error: "Completion not found" }, { status: 404 });

      await db.from("job_completions").update({ status: "rejected" }).eq("id", source_id);

      // Restore the job slot
      const { data: job } = await db
        .from("jobs")
        .select("slots_taken, max_creators, status, title")
        .eq("id", completion.job_id)
        .maybeSingle();

      if (job) {
        const newSlots = Math.max(0, (job.slots_taken ?? 1) - 1);
        // If the job was already closed because all slots were "done", re-open it
        const newStatus =
          job.status === "completed"
            ? "in_progress"
            : job.status === "in_progress" && newSlots < (job.max_creators ?? 1)
              ? "open"
              : job.status;
        await db
          .from("jobs")
          .update({ slots_taken: newSlots, status: newStatus })
          .eq("id", completion.job_id);
      }

      // Notify creator their submission was rejected
      void db.from("notifications").insert({
        user_id: completion.creator_id,
        job_id:  completion.job_id,
        message: `Your submission for "${job?.title ?? "a job"}" was rejected by the admin. The slot is now open for others.`,
      });
    } else if (source_type === "job") {
      // Single-creator job: reset to open so another creator can take it
      const { data: job } = await db
        .from("jobs")
        .select("creator_id, title")
        .eq("id", source_id)
        .maybeSingle();

      await db
        .from("jobs")
        .update({ status: "open", creator_id: null, proof_url: null, completed_at: null })
        .eq("id", source_id);

      // Notify creator their submission was rejected
      if (job?.creator_id) {
        void db.from("notifications").insert({
          user_id: job.creator_id,
          job_id:  source_id,
          message: `Your submission for "${job.title ?? "a job"}" was rejected by the admin. The job is now open for another creator.`,
        });
      }
    } else {
      return NextResponse.json({ error: "Invalid source_type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
