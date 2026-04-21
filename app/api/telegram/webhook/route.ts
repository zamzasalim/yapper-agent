import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendMessage, escapeHtml } from "@/lib/telegram";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://yapper-agent.vercel.app";

const TYPE_LABEL: Record<string, string> = {
  content:    "Content",
  like_reply: "Like & Reply",
  campaign:   "Campaign",
  custom:     "Custom",
  repost:     "Retweet",
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

interface CustomExtras {
  wallet: boolean;
  walletType: string | null;
  email: boolean;
  discord: boolean;
  telegram: boolean;
}

function extractCustomExtras(description: string): CustomExtras {
  const proofStr = extractProofRequired(description);
  const parts = proofStr.split(",").map((s) => s.trim().toLowerCase());
  const walletPart = parts.find((p) => p.includes("wallet address"));
  const walletTypeMatch = walletPart?.match(/\(([^)]+)\)/);
  return {
    wallet:     !!walletPart,
    walletType: walletTypeMatch ? walletTypeMatch[1] : null,
    email:      parts.some((p) => p.includes("email")),
    discord:    parts.some((p) => p.includes("discord")),
    telegram:   parts.some((p) => p.includes("telegram")),
  };
}

function hasCustomExtras(extras: CustomExtras): boolean {
  return extras.wallet || extras.email || extras.discord || extras.telegram;
}

function buildInfoPrompt(extras: CustomExtras): string {
  const fields: string[] = [];
  if (extras.wallet)   fields.push(`wallet: your_${extras.walletType ?? "crypto"}_address`);
  if (extras.email)    fields.push(`email: your@email.com`);
  if (extras.discord)  fields.push(`discord: YourUsername`);
  if (extras.telegram) fields.push(`telegram: @yourusername`);
  return `📋 <b>Additional Info Required</b>\n\nPlease reply with your info in this format:\n\n<code>${fields.join("\n")}</code>`;
}

function parseInfoResponse(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const allowed = new Set(["wallet", "email", "discord", "telegram"]);
  for (const line of text.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 1) continue;
    const key   = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value && allowed.has(key)) result[key] = value;
  }
  return result;
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
        await sendMessage(chatId, `✅ Job accepted! Verifying retweet...`);
        const verifyRes = await fetch(`${APP_URL}/api/jobs/${jobId}/verify-proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twitter_handle: user.twitter_handle }),
        });
        const verifyData = await verifyRes.json();

        if (verifyRes.ok) {
          await sendMessage(chatId, `🎉 Retweet verified! Job completed. Payment will be sent to your wallet.`);
        } else {
          await sendMessage(
            chatId,
            `⚠️ Job accepted, but retweet not detected yet.\n\n${verifyData.error}\n\nAfter retweeting, send:\n/verify ${jobId}`
          );
          await db.from("users").update({ telegram_pending_job_id: jobId }).eq("id", user.id);
        }
      } else {
        const brief = escapeHtml(formatJobBrief(job.description ?? ""));
        const proofRequired = extractProofRequired(job.description ?? "");

        let proofPrompt: string;
        if (job.type === "custom") {
          proofPrompt = `✏️ Send the URL (your reply or post) as proof.`;
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

    await sendMessage(chatId, `⏳ Checking retweet...`);
    const verifyRes = await fetch(`${APP_URL}/api/jobs/${jobId}/verify-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitter_handle: user.twitter_handle }),
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.ok) {
      await sendMessage(chatId, `🎉 Retweet verified! Job completed.`);
      await db.from("users").update({ telegram_pending_job_id: null }).eq("id", user.id);
    } else {
      await sendMessage(chatId, `❌ ${verifyData.error}\n\nTry again after retweeting.`);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Regular text — proof URL or additional info collection ────────────────
  if (text && !text.startsWith("/")) {
    const { data: user } = await db
      .from("users")
      .select("id, twitter_handle, telegram_pending_job_id")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();

    if (!user?.telegram_pending_job_id) return NextResponse.json({ ok: true });

    const pendingId = user.telegram_pending_job_id;

    // ── Additional info collection phase ──────────────────────────────────
    if (pendingId.endsWith("__info")) {
      const jobId  = pendingId.slice(0, -6); // remove "__info"
      const parsed = parseInfoResponse(text);

      if (Object.keys(parsed).length === 0) {
        await sendMessage(
          chatId,
          `⚠️ Could not read your info. Please reply in key: value format.\n\nExample:\n<code>wallet: 0xAbc123...\nemail: me@example.com</code>`
        );
        return NextResponse.json({ ok: true });
      }

      const submitRes = await fetch(`${APP_URL}/api/jobs/${jobId}/submit-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_handle: user.twitter_handle, ...parsed }),
      });

      if (submitRes.ok) {
        await sendMessage(chatId, `✅ Info saved! Your job is fully complete. 🎉`);
        await db.from("users").update({ telegram_pending_job_id: null }).eq("id", user.id);
      } else {
        await sendMessage(chatId, `❌ Failed to save info. Please try again.`);
      }
      return NextResponse.json({ ok: true });
    }

    // ── Proof URL submission ───────────────────────────────────────────────
    if (!text.includes("twitter.com") && !text.includes("x.com")) {
      await sendMessage(chatId, `⚠️ Please send a valid tweet URL (twitter.com or x.com).`);
      return NextResponse.json({ ok: true });
    }

    await sendMessage(chatId, `⏳ Verifying proof...`);
    const verifyRes = await fetch(`${APP_URL}/api/jobs/${pendingId}/verify-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitter_handle: user.twitter_handle, proof_url: text }),
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.ok) {
      // For custom jobs: check if additional info is needed
      const { data: jobData } = await db
        .from("jobs")
        .select("type, description")
        .eq("id", pendingId)
        .maybeSingle();

      if (jobData?.type === "custom") {
        const extras = extractCustomExtras(jobData.description ?? "");
        if (hasCustomExtras(extras)) {
          await db.from("users").update({ telegram_pending_job_id: `${pendingId}__info` }).eq("id", user.id);
          await sendMessage(chatId, `🎉 Proof accepted!\n\n${buildInfoPrompt(extras)}`);
          return NextResponse.json({ ok: true });
        }
      }

      await sendMessage(chatId, `🎉 Proof accepted! Job completed. Payment will be sent to your wallet.`);
      await db.from("users").update({ telegram_pending_job_id: null }).eq("id", user.id);
    } else {
      await sendMessage(chatId, `❌ Failed: ${verifyData.error}`);
    }
  }

  return NextResponse.json({ ok: true });
}
