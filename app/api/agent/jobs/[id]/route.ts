import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/agent/jobs/[id]?api_key=xxx
 * Fetch a single job and all its submissions.
 * Only the owning agent can access this.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const apiKey = req.nextUrl.searchParams.get("api_key");
    if (!apiKey) return NextResponse.json({ error: "api_key required" }, { status: 401 });

    const db = createServerClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agent } = await (db as any)
      .from("users")
      .select("id")
      .eq("agent_api_key", apiKey)
      .maybeSingle() as { data: { id: string } | null };

    if (!agent) return NextResponse.json({ error: "Invalid api_key" }, { status: 401 });

    const { data: job, error } = await db
      .from("jobs")
      .select("id, created_at, type, status, title, description, price_usdc, max_creators, slots_taken, proof_url, completed_at, deadline_hours, require_blue, min_followers")
      .eq("id", id)
      .eq("client_id", agent.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!job)  return NextResponse.json({ error: "Job not found." }, { status: 404 });

    // Fetch submissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let submissions: any[] = [];

    if ((job.max_creators ?? 1) > 1) {
      // Campaign — submissions from job_completions
      const { data: completions } = await db
        .from("job_completions")
        .select("status, proof_url, additional_info, creator:creator_id(twitter_handle, display_name, wallet_address)")
        .eq("job_id", id);
      submissions = completions ?? [];
    } else if (job.proof_url) {
      // Single-creator — join creator from jobs
      const { data: creatorRow } = await db
        .from("jobs")
        .select("additional_info, creator:creator_id(twitter_handle, display_name, wallet_address)")
        .eq("id", id)
        .maybeSingle();
      submissions = [{
        status:          job.status,
        proof_url:       job.proof_url,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        additional_info: (creatorRow as any)?.additional_info ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        creator:         (creatorRow as any)?.creator ?? null,
      }];
    }

    return NextResponse.json({ job, submissions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
