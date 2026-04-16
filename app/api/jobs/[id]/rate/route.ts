import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/jobs/[id]/rate
 * Rate a creator after a completed job. Only the client who posted the job can rate.
 * Body: { client_handle: string, rating: number (1-5) }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { client_handle, rating } = await req.json();

    if (!client_handle) {
      return NextResponse.json({ error: "client_handle required" }, { status: 400 });
    }
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be between 1 and 5" }, { status: 400 });
    }

    const db = createServerClient();

    // Look up client user
    const { data: client } = await db
      .from("users")
      .select("id")
      .eq("twitter_handle", client_handle)
      .maybeSingle();

    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    // Fetch job
    const { data: job } = await db
      .from("jobs")
      .select("id, status, client_id, creator_id, rating")
      .eq("id", id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.client_id !== client.id) {
      return NextResponse.json({ error: "Only the job poster can rate this job." }, { status: 403 });
    }
    if (job.status !== "completed") {
      return NextResponse.json({ error: "Can only rate completed jobs." }, { status: 409 });
    }
    if (job.rating !== null) {
      return NextResponse.json({ error: "This job has already been rated." }, { status: 409 });
    }
    if (!job.creator_id) {
      return NextResponse.json({ error: "No creator assigned to this job." }, { status: 409 });
    }

    // Save rating on the job
    await db.from("jobs").update({ rating }).eq("id", id);

    // Recalculate creator's average rating from all rated jobs
    const { data: ratedJobs } = await db
      .from("jobs")
      .select("rating")
      .eq("creator_id", job.creator_id)
      .not("rating", "is", null);

    const allRatings = [...(ratedJobs ?? []).map((j) => j.rating as number), rating];
    const avgRating  = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

    await db
      .from("users")
      .update({ rating: Math.round(avgRating * 10) / 10 })
      .eq("id", job.creator_id);

    return NextResponse.json({ success: true, rating, new_avg: avgRating });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
