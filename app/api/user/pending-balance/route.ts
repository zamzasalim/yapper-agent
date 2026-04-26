import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/user/pending-balance?handle=xxx
 * Returns the sum of completed jobs not yet credited on-chain (credited_at IS NULL).
 * This is money the creator has earned but admin hasn't batch_credited yet.
 */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

  const db = createServerClient();

  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("twitter_handle", handle)
    .maybeSingle();

  if (!user) return NextResponse.json({ pending_usdc: 0 });

  // Single-creator completed jobs not yet credited
  const { data: singleJobs } = await db
    .from("jobs")
    .select("price_usdc")
    .eq("creator_id", user.id)
    .eq("status", "completed")
    .is("credited_at", null);

  // Campaign slots completed not yet credited
  const { data: completions } = await db
    .from("job_completions")
    .select("jobs ( price_usdc )")
    .eq("creator_id", user.id)
    .eq("status", "completed")
    .is("credited_at", null);

  const fromSingle = (singleJobs ?? []).reduce((s, j) => s + (j.price_usdc ?? 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromCampaign = (completions ?? []).reduce((s, c) => s + ((c as any).jobs?.price_usdc ?? 0), 0);

  return NextResponse.json({ pending_usdc: fromSingle + fromCampaign });
}
