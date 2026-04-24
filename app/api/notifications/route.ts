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

/** POST /api/notifications — create a notification.
 *  Accepts { user_id, job_id?, message } OR { handle, job_id?, message }
 */
export async function POST(req: NextRequest) {
  try {
    const { user_id, handle, job_id, message } = await req.json();
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

    const db = createServerClient();
    let resolvedUserId = user_id as string | undefined;

    if (!resolvedUserId && handle) {
      const { data: user } = await db
        .from("users")
        .select("id")
        .eq("twitter_handle", (handle as string).replace(/^@/, ""))
        .maybeSingle();
      if (!user) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
      resolvedUserId = user.id;
    }

    if (!resolvedUserId) return NextResponse.json({ error: "user_id or handle required" }, { status: 400 });

    const { data, error } = await db
      .from("notifications")
      .insert({ user_id: resolvedUserId, job_id: job_id ?? null, message })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notification: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
