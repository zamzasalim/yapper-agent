import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = createServerClient();

    // Multi-creator: pull from job_completions
    const { data: completions } = await db
      .from("job_completions")
      .select("status, proof_url, additional_info, creator:creator_id(twitter_handle, display_name, avatar_url, is_verified_blue)")
      .eq("job_id", id);

    if (completions && completions.length > 0) {
      return NextResponse.json({
        applicants: completions.map((c) => ({
          ...(c.creator as object),
          status: c.status,
          proof_url: c.proof_url ?? null,
          additional_info: c.additional_info ?? null,
        })),
      });
    }

    // Fallback: single-creator job — read from jobs table
    const { data: job } = await db
      .from("jobs")
      .select("creator_id, proof_url, additional_info, status")
      .eq("id", id)
      .maybeSingle();

    if (!job?.creator_id) return NextResponse.json({ applicants: [] });

    const { data: user } = await db
      .from("users")
      .select("twitter_handle, display_name, avatar_url, is_verified_blue")
      .eq("id", job.creator_id)
      .maybeSingle();

    return NextResponse.json({
      applicants: user
        ? [{
            ...user,
            status: job.status,
            proof_url: (job as any).proof_url ?? null,
            additional_info: (job as any).additional_info ?? null,
          }]
        : [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
