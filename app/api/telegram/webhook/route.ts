import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendMessage, escapeHtml } from "@/lib/telegram";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://yapper-agent.vercel.app";

const TYPE_LABEL: Record<string, string> = {
  content:    "Content",
  like_reply: "Like & Reply",
  campaign:   "Campaign",
  custom:     "Custom",
  repost:     "Repost",
};

function formatJobBrief(description: string): string {
  const cleaned = (description ?? "").replace(/^\[S&K:[^\]]+\]\n\n/, "").trim();
  const [brief, metaRaw] = cleaned.split(/\n\n?---\n/);
  const parts = [brief.trim()];
  if (metaRaw) {
    parts.push("");
    metaRaw.split("\n").filter(Boolean).forEach((line) => parts.push(`• ${line}`));
  }
  return parts.join("\n");
}

function extractProofRequired(description: string): string {
  const afterDash = (description ?? "").split(/\n\n?---\n/)[1] ?? "";
  const line = afterDash.split("\n").find((l) => l.startsWith("Proof required:"));
  return line ? line.replace("Proof required: ", "").trim() : "URL of reply or post";
}

export async function POST(req: NextRequest) {
  const update = await req.json();
  const db = createServerClient();

  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id as number;
  const text   = (message.text ?? "").trim() as string;

  // ── /start ─────────────────────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    const param = text.split(" ")[1] ?? "";

    // No param — welcome
    if (!param) {
      await sendMessage(
        chatId,
        `👋 Hello! I'm <b>Yapper Agent Bot</b>.\n\nTo get started, open the dashboard and click <b>Connect Telegram</b>.\n\n👉 ${APP_URL}/dashboard`
      );
      return NextResponse.json({ ok: true });
    }

    // job_{id} — apply for a job
    if (param.startsWith("job_")) {
      const jobId = param.slice(4);

      const { data: user } = await db
        .from("users")
        .select("id, twitter_handle, telegram_pending_job_id")
        .eq("telegram_chat_id", String(chatId))
        .maybeSingle();

      if (!user) {
        await sendMessage(
          chatId,
          `⚠️ Account not connected.\n\nGo to dashboard → Connect Telegram first.\n👉 ${APP_URL}/dashboard`
        );
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, `⏳ Processing your application...`);

      const acceptRes = await fetch(`${APP_URL}/api/jobs/${jobId}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_handle: user.twitter_handle }),
      });
      const acceptData = await acceptRes.json();

      if (!acceptRes.ok) {
        await sendMessage(chatId, `❌ Failed to accept job:\n${acceptData.error}`);
        return NextResponse.json({ ok: true });
      }

      const job = acceptData.job;

      if (job.type === "repost") {
        await sendMessage(chatId, `✅ Job accepted! Verifying repost...`);
        const verifyRes = await fetch(`${APP_URL}/api/jobs/${jobId}/verify-proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twitter_handle: user.twitter_handle }),
        });
        const verifyData = await verifyRes.json();

        if (verifyRes.ok) {
          await sendMessage(chatId, `🎉 Repost verified! Job completed. Payment will be sent to your wallet.`);
        } else {
          await sendMessage(
            chatId,
            `⚠️ Job accepted, but repost not detected yet.\n\n${verifyData.error}\n\nAfter retweeting, send:\n/verify ${jobId}`
          );
          await db.from("users").update({ telegram_pending_job_id: jobId }).eq("id", user.id);
        }
      } else {
        const brief = escapeHtml(formatJobBrief(job.description ?? ""));
        const proofRequired = extractProofRequired(job.description ?? "");

        let proofPrompt: string;
        if (job.type === "custom") {
          const extras = proofRequired
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && s !== "URL of reply or post");
          proofPrompt = `✏️ Send the URL (your reply or post) as proof.`;
          if (extras.length > 0) {
            proofPrompt += `\n\n📋 <b>Also required:</b> ${escapeHtml(extras.join(", "))}\n<i>Admin will contact you for additional info after your submission.</i>`;
          }
        } else {
          proofPrompt = `✏️ Send the tweet URL as proof of your work:`;
        }

        await sendMessage(
          chatId,
          `✅ Job accepted!\n\n📌 <b>${escapeHtml(job.title)}</b>\nType: ${TYPE_LABEL[job.type] ?? job.type}\n\n${brief}\n\n${proofPrompt}`
        );
        await db.from("users").update({ telegram_pending_job_id: jobId }).eq("id", user.id);
      }

      return NextResponse.json({ ok: true });
    }

    // {token} — connect account
    const now = new Date().toISOString();
    const { data: user } = await db
      .from("users")
      .select("id, twitter_handle, telegram_token_expires_at")
      .eq("telegram_link_token", param)
      .maybeSingle();

    if (!user) {
      await sendMessage(chatId, `⚠️ Invalid link. Please generate a new one from the dashboard.`);
      return NextResponse.json({ ok: true });
    }

    if (user.telegram_token_expires_at && user.telegram_token_expires_at < now) {
      await sendMessage(chatId, `⏰ Link has expired. Generate a new link from the dashboard.`);
      return NextResponse.json({ ok: true });
    }

    const tgUsername = message.from?.username ?? null;

    await db
      .from("users")
      .update({
        telegram_chat_id: String(chatId),
        telegram_username: tgUsername,
        telegram_link_token: null,
        telegram_token_expires_at: null,
      })
      .eq("id", user.id);

    await sendMessage(
      chatId,
      `✅ Account <b>@${escapeHtml(user.twitter_handle)}</b> connected successfully!\n\nYou can now apply for jobs directly from the notification channel. 🎉`
    );
    return NextResponse.json({ ok: true });
  }

  // ── /verify {jobId} — retry repost verification ────────────────────────────
  if (text.startsWith("/verify")) {
    const jobId = text.split(" ")[1]?.trim();
    if (!jobId) {
      await sendMessage(chatId, `Usage: /verify {jobId}`);
      return NextResponse.json({ ok: true });
    }

    const { data: user } = await db
      .from("users")
      .select("id, twitter_handle")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();

    if (!user) {
      await sendMessage(chatId, `⚠️ Account not connected.`);
      return NextResponse.json({ ok: true });
    }

    await sendMessage(chatId, `⏳ Checking repost...`);
    const verifyRes = await fetch(`${APP_URL}/api/jobs/${jobId}/verify-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitter_handle: user.twitter_handle }),
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.ok) {
      await sendMessage(chatId, `🎉 Repost verified! Job completed.`);
      await db.from("users").update({ telegram_pending_job_id: null }).eq("id", user.id);
    } else {
      await sendMessage(chatId, `❌ ${verifyData.error}\n\nTry again after retweeting.`);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Regular text — treat as proof URL if user has a pending job ─────────────
  if (text && !text.startsWith("/")) {
    const { data: user } = await db
      .from("users")
      .select("id, twitter_handle, telegram_pending_job_id")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();

    if (!user?.telegram_pending_job_id) return NextResponse.json({ ok: true });

    if (!text.includes("twitter.com") && !text.includes("x.com")) {
      await sendMessage(chatId, `⚠️ Please send a valid tweet URL (twitter.com or x.com).`);
      return NextResponse.json({ ok: true });
    }

    await sendMessage(chatId, `⏳ Verifying proof...`);
    const verifyRes = await fetch(`${APP_URL}/api/jobs/${user.telegram_pending_job_id}/verify-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitter_handle: user.twitter_handle, proof_url: text }),
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.ok) {
      await sendMessage(chatId, `🎉 Proof accepted! Job completed. Payment will be sent to your wallet.`);
      await db.from("users").update({ telegram_pending_job_id: null }).eq("id", user.id);
    } else {
      await sendMessage(chatId, `❌ Failed: ${verifyData.error}`);
    }
  }

  return NextResponse.json({ ok: true });
}
