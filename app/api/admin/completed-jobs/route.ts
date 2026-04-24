import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

const ADMINS = ["Autosultan_team", "0xhnfdm"];

/**
 * GET /api/admin/completed-jobs?admin_handle=xxx
 * Returns all completed jobs with creator info for the payout export.
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
        `id, created_at, completed_at, type, title, price_usdc, proof_url, is_paid, additional_info, max_creators,
         client:users!client_id(twitter_handle, display_name),
         creator:users!creator_id(twitter_handle, display_name, wallet_address)`
      )
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // For campaign jobs (creator_id is null), fetch per-slot completions with creator wallet info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const campaignIds = (data ?? []).filter((j: any) => !j.creator).map((j: any) => j.id as string);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let completionsMap: Record<string, any[]> = {};

    if (campaignIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: completions } = await (db as any)
        .from("job_completions")
        .select("job_id, status, proof_url, additional_info, rating, creator:creator_id(twitter_handle, display_name, wallet_address)")
        .in("job_id", campaignIds)
        .eq("status", "completed");

      for (const c of completions ?? []) {
        if (!completionsMap[c.job_id]) completionsMap[c.job_id] = [];
        completionsMap[c.job_id].push(c);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobs = (data ?? []).map((j: any) => ({
      ...j,
      completions: completionsMap[j.id] ?? null,
    }));

    return NextResponse.json({ jobs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
