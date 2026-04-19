import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendMessage, escapeHtml } from "@/lib/telegram";

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID ?? "@yapperagent";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { creator_handle, wallet, email, discord, telegram } = await req.json();

    const db = createServerClient();
    const { data: job } = await db
      .from("jobs")
      .select("title")
      .eq("id", id)
      .maybeSingle();

    const lines = [
      `📋 <b>Additional Info Submitted</b>`,
      ``,
      `Job: <b>${escapeHtml(job?.title ?? id)}</b>`,
      `Creator: @${escapeHtml(creator_handle ?? "unknown")}`,
      ``,
    ];
    if (wallet)   lines.push(`💳 Wallet: <code>${escapeHtml(wallet)}</code>`);
    if (email)    lines.push(`📧 Email: ${escapeHtml(email)}`);
    if (discord)  lines.push(`🎮 Discord: ${escapeHtml(discord)}`);
    if (telegram) lines.push(`✈️ Telegram: ${escapeHtml(telegram)}`);

    await sendMessage(CHANNEL_ID, lines.join("\n"));

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
