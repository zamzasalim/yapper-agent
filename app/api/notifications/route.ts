import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/** GET /api/notifications?handle=xxx — fetch unread notifications for user */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

  const db = createServerClient();
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("twitter_handle", handle)
    .maybeSingle();

  if (!user) return NextResponse.json({ notifications: [] });

  const { data, error } = await db
    .from("notifications")
    .select("id, message, job_id, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

/** POST /api/notifications — internal: create a notification for a user */
export async function POST(req: NextRequest) {
  try {
    const { user_id, job_id, message } = await req.json();
    if (!user_id || !message) {
      return NextResponse.json({ error: "user_id and message required" }, { status: 400 });
    }

    const db = createServerClient();
    const { data, error } = await db
      .from("notifications")
      .insert({ user_id, job_id: job_id ?? null, message })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notification: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
