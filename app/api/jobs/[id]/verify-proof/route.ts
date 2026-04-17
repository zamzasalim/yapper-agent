import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { checkRetweeted } from "@/lib/scrapebadger";

function extractTweetId(url: string): string | null {
  return url.match(/\/status\/(\d+)/)?.[1] ?? null;
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
      .select("id, type, status, tweet_url, creator_id")
      .eq("id", id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (job.status !== "in_progress") {
      return NextResponse.json({ error: "Job is not in progress" }, { status: 409 });
    }

    // Verify creator matches
    const { data: creator } = await db
      .from("users")
      .select("id")
      .eq("twitter_handle", twitter_handle)
      .maybeSingle();

    if (!creator || creator.id !== job.creator_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let finalProofUrl: string = proof_url ?? "";

    if (job.type === "repost") {
      // Auto-verify via ScrapeBadger
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
          { error: "Repost not found yet. Make sure you've retweeted and try again." },
          { status: 422 }
        );
      }
      finalProofUrl = job.tweet_url;
    } else {
      // Manual proof: like_reply, content, campaign, custom — require proof_url from user
      if (!proof_url || !proof_url.trim()) {
        return NextResponse.json({ error: "proof_url required for this job type" }, { status: 400 });
      }
    }

    const { data: updated, error } = await db
      .from("jobs")
      .update({ status: "completed", proof_url: finalProofUrl })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
