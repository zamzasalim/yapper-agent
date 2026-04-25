import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { notifyNewJob } from "@/lib/telegram";

const ADMINS = ["Autosultan_team", "0xhnfdm"];

/**
 * POST /api/admin/jobs/[id]/restore?admin_handle=xxx
 * Restore a cancelled job back to open status.
 * Clears: cancel_reason, creator_id, slots_taken, and any stale job_completions rows.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin_handle = req.nextUrl.searchParams.get("admin_handle");
    if (!admin_handle || !ADMINS.some((a) => a.toLowerCase() === admin_handle.toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const db = createServerClient();

    const { data: job } = await db
      .from("jobs")
      .select("id, status, type, title, price_usdc, deadline_hours, is_agent_job")
      .eq("id", id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    if (job.status !== "cancelled") {
      return NextResponse.json({ error: "Job is not cancelled." }, { status: 409 });
    }

    // Custom jobs go back to pending_approval (re-enter approval queue)
    // All other jobs go back to open (re-enter marketplace)
    const restoredStatus = job.type === "custom" ? "pending_approval" : "open";

    // Reset deadline from now so the job doesn't expire immediately
    const newDeadline = new Date(Date.now() + (job.deadline_hours ?? 24) * 3_600_000).toISOString();

    const { error: updateError } = await db
      .from("jobs")
      .update({
        status: restoredStatus,
        cancel_reason: null,
        creator_id: null,
        slots_taken: 0,
        deadline_override: newDeadline,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("id", id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // Clean up any in-flight campaign completions
    await db.from("job_completions").delete().eq("job_id", id);

    // Notify Telegram channel (skip for agent jobs — they poll the API instead)
    if (restoredStatus === "open" && !(job as any).is_agent_job) {
      const messageId = await notifyNewJob({
        id:             job.id,
        title:          (job as any).title,
        type:           job.type,
        price_usdc:     (job as any).price_usdc,
        deadline_hours: job.deadline_hours ?? 24,
      });
      if (messageId) {
        await db.from("jobs").update({ telegram_message_id: String(messageId) }).eq("id", id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
