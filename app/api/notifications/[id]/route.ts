import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/** PATCH /api/notifications/[id] — mark notification as read */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = createServerClient();
    const { error } = await db
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
