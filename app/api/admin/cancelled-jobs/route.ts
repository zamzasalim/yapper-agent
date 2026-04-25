import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

import { ADMINS } from "@/lib/admins";

/**
 * GET /api/admin/cancelled-jobs?admin_handle=xxx
 * Returns all cancelled jobs with client info.
 */
export async function GET(req: NextRequest) {
  try {
    const admin_handle = req.nextUrl.searchParams.get("admin_handle");
    if (!admin_handle) {
      return NextResponse.json({ error: "admin_handle required" }, { status: 400 });
    }
    const isAdmin = ADMINS.some((a) => a.toLowerCase() === admin_handle.toLowerCase());
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const db = createServerClient();

    const { data, error } = await db
      .from("jobs")
      .select(
        `id, created_at, type, title, description, price_usdc, deadline_hours, tweet_url,
         require_blue, min_followers, max_creators, is_agent_job, creator_id, cancel_reason, is_refunded, tx_hash,
         client:users!client_id(twitter_handle, display_name, wallet_address)`
      )
      .eq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ jobs: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
