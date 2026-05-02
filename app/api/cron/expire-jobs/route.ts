import { NextRequest, NextResponse } from "next/server";
import { runExpireJobs } from "@/lib/expire-jobs";

/**
 * GET /api/cron/expire-jobs
 * Called automatically by Vercel Cron every hour. Protected by CRON_SECRET.
 * Pass 1: open→cancelled, in_progress→completed when job deadline passes.
 * Pass 2: accepted completions→missed when accept-to-submit window passes; slot restored.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runExpireJobs();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
