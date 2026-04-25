import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

import { ADMINS } from "@/lib/admins";

/**
 * POST /api/agent/support
 * Agent reports an issue on a job. Notifies all admins via the notifications table.
 * Body: { api_key, job_id, issue }
 */
export async function POST(req: NextRequest) {
  try {
    const { api_key, job_id, issue } = await req.json();

    if (!api_key) return NextResponse.json({ error: "api_key required" }, { status: 400 });
    if (!job_id)  return NextResponse.json({ error: "job_id required" }, { status: 400 });
    if (!issue)   return NextResponse.json({ error: "issue required" }, { status: 400 });

    const db = createServerClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agent } = await (db as any)
      .from("users")
      .select("id, display_name")
      .eq("agent_api_key", api_key)
      .maybeSingle() as { data: { id: string; display_name: string } | null };

    if (!agent) return NextResponse.json({ error: "Invalid api_key" }, { status: 401 });

    // Verify the job belongs to this agent
    const { data: job } = await db
      .from("jobs")
      .select("id, title")
      .eq("id", job_id)
      .eq("client_id", agent.id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    // Resolve admin user IDs and notify all of them
    const adminResults = await Promise.all(
      ADMINS.map(handle =>
        db.from("users").select("id").eq("twitter_handle", handle).maybeSingle()
      )
    );

    const notifs = adminResults
      .map(r => r.data)
      .filter(Boolean)
      .map(admin => ({
        user_id: admin!.id,
        job_id,
        message: `[Agent Support] "${agent.display_name}" reported an issue on job "${job.title}": ${issue}`,
      }));

    if (notifs.length) {
      await db.from("notifications").insert(notifs);
    }

    return NextResponse.json({
      success: true,
      message: "Support ticket submitted. Our moderators will review it shortly.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
