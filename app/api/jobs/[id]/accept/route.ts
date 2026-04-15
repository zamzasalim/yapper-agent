import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * PATCH /api/jobs/[id]/accept
 * Accept an open job as a creator.
 * Body: { twitter_handle: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { twitter_handle } = await req.json();
    if (!twitter_handle) {
      return NextResponse.json({ error: "twitter_handle required" }, { status: 400 });
    }

    const db = createServerClient();

    // Look up creator by handle
    const { data: creator } = await db
      .from("users")
      .select("id")
      .eq("twitter_handle", twitter_handle)
      .maybeSingle();

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found. Please register first via the dashboard." },
        { status: 404 }
      );
    }

    // Check job exists and is still open
    const { data: job } = await db
      .from("jobs")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.status !== "open") {
      return NextResponse.json({ error: "This job is no longer available." }, { status: 409 });
    }

    // Accept the job
    const { data: updated, error } = await db
      .from("jobs")
      .update({ status: "in_progress", creator_id: creator.id })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ job: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
