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

    const { data, error } = await db
      .from("jobs")
      .select(
        `id, created_at, type, status, title, description, price_usdc,
         is_agent_job, deadline_hours,
         client:users!client_id(twitter_handle, display_name, avatar_url)`
      )
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ jobs: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
