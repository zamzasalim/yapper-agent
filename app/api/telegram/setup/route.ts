import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN ?? "";
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? "";
const SETUP_SECRET = process.env.TELEGRAM_SETUP_SECRET ?? "";

/** GET /api/telegram/setup?secret=xxx
 *  One-time call to register the webhook URL with Telegram.
 *  Set TELEGRAM_SETUP_SECRET in env to protect this endpoint. */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (SETUP_SECRET && secret !== SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  const webhookUrl = `${APP_URL}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const json = await res.json();

  return NextResponse.json({ webhook_url: webhookUrl, telegram_response: json });
}
