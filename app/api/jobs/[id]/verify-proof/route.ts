import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { checkRetweeted } from "@/lib/scrapebadger";

function extractTweetId(url: string): string | null {
  return url.match(/\/status\/(\d+)/)?.[1] ?? null;
}

/** Returns true if the proof URL belongs to the given twitter handle. */
function proofUrlMatchesHandle(url: string, handle: string): boolean {
  const u = url.toLowerCase().replace("https://", "").replace("http://", "");
  const h = handle.toLowerCase();
  return (
    (u.startsWith("x.com/") || u.startsWith("twitter.com/")) &&
    (u.startsWith(`x.com/${h}/`) || u.startsWith(`twitter.com/${h}/`))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { twitter_handle, proof_url } = await req.json();
    if (!twitter_handle) {
      return NextResponse.json({ error: "twitter_handle required" }, { status: 400 });
    }

    const db = createServerClient();

    const { data: job } = await db
      .from("jobs")
      .select("id, type, status, tweet_url, creator_id, max_creators, slots_taken, price_usdc")
      .eq("id", id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const maxCreators = job.max_creators ?? 1;

    if (maxCreators === 1 && job.status !== "in_progress") {
      return NextResponse.json({ error: "Job is not in progress" }, { status: 409 });
    }
    if (maxCreators > 1 && !["open", "in_progress"].includes(job.status)) {
      return NextResponse.json({ error: "Job is not accepting submissions" }, { status: 409 });
    }

    const { data: creator } = await db
      .from("users")
      .select("id")
      .eq("twitter_handle", twitter_handle)
      .maybeSingle();

    if (!creator) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Auth check
    if (maxCreators === 1) {
      if (creator.id !== job.creator_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    } else {
      const { data: completion } = await db
        .from("job_completions")
        .select("id, status")
        .eq("job_id", id)
        .eq("creator_id", creator.id)
        .maybeSingle();

      if (!completion) {
        return NextResponse.json({ error: "You haven't accepted this job" }, { status: 403 });
      }
      if (completion.status === "completed") {
        return NextResponse.json({ error: "You have already submitted proof for this job" }, { status: 409 });
      }
    }

    // ── Verify proof ───────────────────────────────────────────────────────
    let finalProofUrl: string = proof_url ?? "";

    if (job.type === "repost") {
      if (!job.tweet_url) {
        return NextResponse.json({ error: "No tweet URL on this job" }, { status: 400 });
      }
      const tweetId = extractTweetId(job.tweet_url);
      if (!tweetId) {
        return NextResponse.json({ error: "Could not parse tweet ID from URL" }, { status: 400 });
      }
      const verified = await checkRetweeted(tweetId, twitter_handle);
      if (!verified) {
        return NextResponse.json(
          { error: "Retweet not found yet. Make sure you've retweeted and try again." },
          { status: 422 }
        );
      }
      finalProofUrl = job.tweet_url;
    } else {
      if (!proof_url?.trim()) {
        return NextResponse.json({ error: "proof_url required for this job type" }, { status: 400 });
      }
      // Auto-verify: proof URL must belong to the creator's own account
      if (!proofUrlMatchesHandle(proof_url.trim(), twitter_handle)) {
        return NextResponse.json(
          { error: `Proof URL must be a tweet from your own account (@${twitter_handle}). Example: https://x.com/${twitter_handle}/status/...` },
          { status: 422 }
        );
      }
    }

    // ── Save & complete ────────────────────────────────────────────────────
    if (maxCreators === 1) {
      const { data: updated, error } = await db
        .from("jobs")
        .update({ status: "completed", proof_url: finalProofUrl, completed_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Update creator stats
      try { await (db as any).rpc("increment_creator_stats", { user_id: creator.id, amount: job.price_usdc ?? 0 }); } catch {}

      return NextResponse.json({ job: updated });
    }

    // Multi-creator: mark this creator's slot as completed
    await db
      .from("job_completions")
      .update({ proof_url: finalProofUrl, status: "completed" })
      .eq("job_id", id)
      .eq("creator_id", creator.id);

    const { count } = await db
      .from("job_completions")
      .select("id", { count: "exact", head: true })
      .eq("job_id", id)
      .eq("status", "completed");

    const allDone = (count ?? 0) >= maxCreators;
    if (allDone) {
      await db.from("jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
    }

    return NextResponse.json({ job: { id, type: job.type, proof_url: finalProofUrl } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
