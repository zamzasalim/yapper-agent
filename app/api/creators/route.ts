import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/creators?offset=0&limit=30
 * Paginated creator list ordered by followers descending.
 */
export async function GET(req: NextRequest) {
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0"));
  const limit  = Math.min(30, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "30")));

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("users")
      .select("id, twitter_handle, display_name, twitter_followers, avatar_url, rating, jobs_completed, is_verified_blue, niches, custom_content_rate")
      .eq("role", "creator")
      .order("twitter_followers", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ creators: [] });
    return NextResponse.json({ creators: data ?? [] });
  } catch {
    return NextResponse.json({ creators: [] });
  }
}
