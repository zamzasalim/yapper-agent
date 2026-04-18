import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "yapper_agent_bot";

/** DELETE /api/telegram/connect  body: { twitter_handle }
 *  Disconnects the Telegram account from the user. */
export async function DELETE(req: NextRequest) {
  try {
    const { twitter_handle } = await req.json();
    if (!twitter_handle) {
      return NextResponse.json({ error: "twitter_handle required" }, { status: 400 });
    }

    const db = createServerClient();

    const { error } = await db
      .from("users")
      .update({
        telegram_chat_id: null,
        telegram_link_token: null,
        telegram_token_expires_at: null,
        telegram_pending_job_id: null,
      })
      .eq("twitter_handle", twitter_handle);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/telegram/connect  body: { twitter_handle }
 *  Generates a one-time link token (15 min TTL) and returns a t.me deep-link. */
export async function POST(req: NextRequest) {
  try {
    const { twitter_handle } = await req.json();
    if (!twitter_handle) {
      return NextResponse.json({ error: "twitter_handle required" }, { status: 400 });
    }

    const db = createServerClient();

    const { data: user } = await db
      .from("users")
      .select("id, telegram_chat_id")
      .eq("twitter_handle", twitter_handle)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Already connected
    if (user.telegram_chat_id) {
      return NextResponse.json({ already_connected: true });
    }

    // 24-char hex token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db
      .from("users")
      .update({ telegram_link_token: token, telegram_token_expires_at: expiresAt })
      .eq("id", user.id);

    return NextResponse.json({
      link: `https://t.me/${BOT_USERNAME}?start=${token}`,
      expires_at: expiresAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
