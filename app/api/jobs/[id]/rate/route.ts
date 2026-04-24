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
    const { client_handle, creator_handle, rating } = await req.json();

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
    // ── Campaign (multi-creator) path ─────────────────────────────────────
    if (!job.creator_id) {
      if (!creator_handle) {
        return NextResponse.json({ error: "creator_handle required for campaign jobs." }, { status: 400 });
      }

      const { data: targetCreator } = await db
        .from("users")
        .select("id")
        .eq("twitter_handle", creator_handle)
        .maybeSingle();
      if (!targetCreator) {
        return NextResponse.json({ error: "Creator not found." }, { status: 404 });
      }

      const { data: completion } = await db
        .from("job_completions")
        .select("id, status, rating")
        .eq("job_id", id)
        .eq("creator_id", targetCreator.id)
        .maybeSingle();
      if (!completion || completion.status !== "completed") {
        return NextResponse.json({ error: "Creator has not completed this campaign." }, { status: 409 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((completion as any).rating !== null && (completion as any).rating !== undefined) {
        return NextResponse.json({ error: "This campaign slot has already been rated." }, { status: 409 });
      }

      // Persist rating on the completion row
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from("job_completions").update({ rating }).eq("id", completion.id);

      // Recalculate avg: single-creator rated jobs + all rated campaign completions
      const { data: singleRated } = await db
        .from("jobs")
        .select("rating")
        .eq("creator_id", targetCreator.id)
        .not("rating", "is", null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: campaignRated } = await (db as any)
        .from("job_completions")
        .select("rating")
        .eq("creator_id", targetCreator.id)
        .not("rating", "is", null);
      const allRatings = [
        ...(singleRated ?? []).map((j: { rating: number }) => j.rating),
        ...(campaignRated ?? []).map((c: { rating: number }) => c.rating),
      ];
      const avgRating = allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length;
      await db
        .from("users")
        .update({ rating: Math.round(avgRating * 10) / 10 })
        .eq("id", targetCreator.id);

      return NextResponse.json({ success: true, rating, new_avg: avgRating });
    }

    // ── Single-creator path ────────────────────────────────────────────────
    if (job.rating !== null) {
      return NextResponse.json({ error: "This job has already been rated." }, { status: 409 });
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
