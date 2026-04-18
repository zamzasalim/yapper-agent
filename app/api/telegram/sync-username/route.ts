import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

/** GET /api/telegram/sync-username?handle=xxx
 *  Fetches the Telegram username from Bot API using stored chat_id and saves it. */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");
  if (!handle || !BOT_TOKEN) return NextResponse.json({ username: null });

  const db = createServerClient();

  const { data: user } = await db
    .from("users")
    .select("id, telegram_chat_id, telegram_username")
    .eq("twitter_handle", handle)
    .maybeSingle();

  if (!user?.telegram_chat_id) return NextResponse.json({ username: null });
  if (user.telegram_username) return NextResponse.json({ username: user.telegram_username });

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${user.telegram_chat_id}`
    );
    const json = await res.json();
    const username: string | null = json.result?.username ?? null;

    if (username) {
      await db.from("users").update({ telegram_username: username }).eq("id", user.id);
    }

    return NextResponse.json({ username });
  } catch {
    return NextResponse.json({ username: null });
  }
}
