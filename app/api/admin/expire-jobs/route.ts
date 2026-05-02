import { NextRequest, NextResponse } from "next/server";
import { ADMINS } from "@/lib/admins";
import { runExpireJobs } from "@/lib/expire-jobs";

/**
 * POST /api/admin/expire-jobs?admin_handle=xxx
 * Manual trigger (called on Active tab load).
 * Pass 1: open→cancelled, in_progress→completed when job deadline passes.
 * Pass 2: accepted completions→missed when accept-to-submit window passes; slot restored.
 */
export async function POST(req: NextRequest) {
  try {
    const admin_handle = req.nextUrl.searchParams.get("admin_handle");
    if (!admin_handle) {
      return NextResponse.json({ error: "admin_handle required" }, { status: 400 });
    }
    if (!ADMINS.some((a) => a.toLowerCase() === admin_handle.toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await runExpireJobs();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
