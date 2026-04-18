import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { fetchTwitterUserStats, parseJobRequirements } from "@/lib/scrapebadger";

/**
 * PATCH /api/jobs/[id]/accept
 * Accept an open job as a creator.
 * Body: { twitter_handle: string }
 *
 * Flow:
 *  1. Look up creator in DB → get current stats
 *  2. Refresh stats from ScrapeBadger and persist to DB
 *  3. Parse S&K requirements from job description
 *  4. Validate creator meets requirements (cenblue, min followers)
 *  5. Accept the job
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

    // ── 1. Look up creator ─────────────────────────────────────────────────
    const { data: creator } = await db
      .from("users")
      .select("id, twitter_followers, is_verified_blue")
      .eq("twitter_handle", twitter_handle)
      .maybeSingle();

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found. Please register first via the dashboard." },
        { status: 404 }
      );
    }

    // ── 2. Refresh stats from ScrapeBadger + persist ───────────────────────
    let followers      = creator.twitter_followers ?? 0;
    let isBlueVerified = creator.is_verified_blue  ?? false;

    const fresh = await fetchTwitterUserStats(twitter_handle);
    if (fresh) {
      followers      = fresh.followers;
      isBlueVerified = fresh.is_verified_blue;
      // persist updated stats (non-blocking path — ignore error)
      await db
        .from("users")
        .update({ twitter_followers: followers, is_verified_blue: isBlueVerified })
        .eq("id", creator.id);
    }

    // ── 3. Fetch job ───────────────────────────────────────────────────────
    const { data: job } = await db
      .from("jobs")
      .select("id, status, description")
      .eq("id", id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.status !== "open") {
      return NextResponse.json({ error: "This job is no longer available." }, { status: 409 });
    }

    // ── 4. Validate S&K requirements ──────────────────────────────────────
    const { requireCenblue, minFollowers } = parseJobRequirements(job.description ?? "");

    if (requireCenblue && !isBlueVerified) {
      return NextResponse.json(
        { error: "This job requires a verified (blue tick) account." },
        { status: 403 }
      );
    }
    if (minFollowers > 0 && followers < minFollowers) {
      return NextResponse.json(
        {
          error: `This job requires at least ${minFollowers.toLocaleString()} followers. Your account has ${followers.toLocaleString()}.`,
        },
        { status: 403 }
      );
    }

    // ── 5. Accept the job ──────────────────────────────────────────────────
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
