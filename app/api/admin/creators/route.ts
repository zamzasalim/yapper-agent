import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { ADMINS } from "@/lib/admins";

function isAdmin(handle: string) {
  return ADMINS.some((a) => a.toLowerCase() === handle.toLowerCase());
}

/** GET /api/admin/creators?admin_handle=xxx — list all creators with custom rate */
export async function GET(req: NextRequest) {
  const admin_handle = req.nextUrl.searchParams.get("admin_handle") ?? "";
  if (!isAdmin(admin_handle))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const db = createServerClient();
  const { data, error } = await db
    .from("users")
    .select("id, twitter_handle, display_name, avatar_url, twitter_followers, custom_content_rate")
    .eq("role", "creator")
    .order("twitter_followers", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ creators: data ?? [] });
}

/** PATCH /api/admin/creators?admin_handle=xxx — set/clear custom_content_rate */
export async function PATCH(req: NextRequest) {
  const admin_handle = req.nextUrl.searchParams.get("admin_handle") ?? "";
  if (!isAdmin(admin_handle))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json() as { handle: string; rate: boolean | null };
  if (!body.handle)
    return NextResponse.json({ error: "handle required" }, { status: 400 });

  const db = createServerClient();
  const { error } = await db
    .from("users")
    .update({ custom_content_rate: body.rate })
    .eq("twitter_handle", body.handle)
    .eq("role", "creator");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
