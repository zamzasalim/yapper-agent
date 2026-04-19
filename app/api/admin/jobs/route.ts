import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

const ADMINS = ["Autosultan_team", "0xhnfdm"];

/**
 * GET /api/admin/jobs?admin_handle=xxx
 * Returns all pending_approval jobs. Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin_handle = req.nextUrl.searchParams.get("admin_handle");
    if (!admin_handle) {
      return NextResponse.json({ error: "admin_handle required" }, { status: 400 });
    }

    const isAdmin = ADMINS.some(
      (a) => a.toLowerCase() === admin_handle.toLowerCase()
    );
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const db = createServerClient();

    const statusFilter = req.nextUrl.searchParams.get("status") ?? "pending_approval";

    let query = db
      .from("jobs")
      .select(
        `id, created_at, type, status, title, description, price_usdc,
         is_agent_job, is_hidden, deadline_hours, require_blue, min_followers,
         client:users!client_id(twitter_handle, display_name, avatar_url)`
      )
      .order("created_at", { ascending: false });

    if (statusFilter === "active") {
      query = query.in("status", ["open", "in_progress"]);
    } else {
      query = query.eq("status", statusFilter as "pending_approval");
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ jobs: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
