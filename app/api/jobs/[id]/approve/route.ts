import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { notifyNewJob } from "@/lib/telegram";

const ADMINS = ["Autosultan_team", "0xhnfdm"];

/**
 * PATCH /api/jobs/[id]/approve
 * Approve a pending_approval job. Admin only.
 * Body: { admin_handle: string }
 *
 * PATCH /api/jobs/[id]/approve  (with body action: "reject")
 * Reject (cancel) a pending job.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin_handle, action = "approve" } = await req.json();

    if (!admin_handle) {
      return NextResponse.json({ error: "admin_handle required" }, { status: 400 });
    }

    const isAdmin = ADMINS.some(
      (a) => a.toLowerCase() === admin_handle.toLowerCase()
    );
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized. Admin only." }, { status: 403 });
    }

    const db = createServerClient();

    const { data: job } = await db
      .from("jobs")
      .select("id, status, type")
      .eq("id", id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.status !== "pending_approval") {
      return NextResponse.json({ error: "Job is not pending approval." }, { status: 409 });
    }

    const newStatus = action === "reject" ? "cancelled" : "open";

    const { data: updated, error } = await db
      .from("jobs")
      .update({ status: newStatus })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (newStatus === "open") {
      await notifyNewJob(updated);
    }

    return NextResponse.json({ job: updated, action: newStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
