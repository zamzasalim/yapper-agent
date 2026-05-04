import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { fetchTwitterUserStats } from "@/lib/scrapebadger";

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
      await db
        .from("users")
        .update({ twitter_followers: followers, is_verified_blue: isBlueVerified })
        .eq("id", creator.id);
    }

    // ── 3. Fetch job ───────────────────────────────────────────────────────
    const { data: job } = await db
      .from("jobs")
      .select("id, status, description, max_creators, slots_taken, require_blue, min_followers, type, client_id, title")
      .eq("id", id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.status !== "open") {
      return NextResponse.json({ error: "This job is no longer available." }, { status: 409 });
    }

    const maxCreators  = job.max_creators  ?? 1;
    const slotsTaken   = job.slots_taken   ?? 0;

    // Custom jobs are open competitions — no slot cap on accept.
    // Anyone who meets requirements can join; winners are chosen manually by admin.
    // Non-custom jobs enforce the slot cap as before.
    if (job.type !== "custom" && slotsTaken >= maxCreators) {
      return NextResponse.json({ error: "All slots for this job are taken." }, { status: 409 });
    }

    // ── 4. Validate requirements from DB columns ───────────────────────────
    const requireCenblue = job.require_blue ?? false;
    const minFollowers   = job.min_followers ?? 0;

    if (requireCenblue && !isBlueVerified) {
      return NextResponse.json(
        { error: "This job requires a verified (blue tick) account." },
        { status: 403 }
      );
    }
    if (minFollowers > 0 && followers < minFollowers) {
      return NextResponse.json(
        { error: `This job requires at least ${minFollowers.toLocaleString()} followers. Your account has ${followers.toLocaleString()}.` },
        { status: 403 }
      );
    }

    // ── 5. Accept the job ──────────────────────────────────────────────────
    const newSlotsTaken = slotsTaken + 1;

    if (maxCreators === 1) {
      // Single-creator: lock job to this creator
      const { data: updated, error } = await db
        .from("jobs")
        .update({ status: "in_progress", creator_id: creator.id, slots_taken: 1 })
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Notify client their job was accepted
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientId = (job as any).client_id as string | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobTitle = (job as any).title as string;
      if (clientId) {
        void db.from("notifications").insert({
          user_id: clientId,
          job_id: id,
          message: `@${twitter_handle} accepted your job "${jobTitle}"!`,
        });
      }

      return NextResponse.json({ job: updated });
    }

    // Multi-creator: check if already applied
    const { data: existing } = await db
      .from("job_completions")
      .select("id")
      .eq("job_id", id)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "You have already accepted this job." }, { status: 409 });
    }

    // Insert per-creator completion record
    await db.from("job_completions").insert({
      job_id: id,
      creator_id: creator.id,
      status: "accepted",
    });

    // Custom jobs stay open until deadline — slots_taken tracks participation count only.
    // Non-custom: flip to in_progress when all slots filled.
    const newStatus = job.type !== "custom" && newSlotsTaken >= maxCreators ? "in_progress" : "open";
    await db
      .from("jobs")
      .update({ slots_taken: newSlotsTaken, status: newStatus })
      .eq("id", id);

    // Notify client a creator joined their campaign
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientId = (job as any).client_id as string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobTitle = (job as any).title as string;
    if (clientId) {
      void db.from("notifications").insert({
        user_id: clientId,
        job_id: id,
        message: `@${twitter_handle} joined your campaign "${jobTitle}" (slot ${newSlotsTaken}/${maxCreators}).`,
      });
    }

    const { data: updated } = await db.from("jobs").select().eq("id", id).single();
    return NextResponse.json({ job: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
