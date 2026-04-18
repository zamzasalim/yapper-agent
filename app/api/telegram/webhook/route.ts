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
        `👋 Halo! Saya <b>Yapper Agent Bot</b>.\n\nUntuk mulai, buka dashboard dan klik <b>Connect Telegram</b>.\n\n👉 ${APP_URL}/dashboard`
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
          `⚠️ Akun belum terhubung.\n\nBuka dashboard → Connect Telegram terlebih dahulu.\n👉 ${APP_URL}/dashboard`
        );
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, `⏳ Memproses lamaran...`);

      const acceptRes = await fetch(`${APP_URL}/api/jobs/${jobId}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter_handle: user.twitter_handle }),
      });
      const acceptData = await acceptRes.json();

      if (!acceptRes.ok) {
        await sendMessage(chatId, `❌ Gagal accept job:\n${acceptData.error}`);
        return NextResponse.json({ ok: true });
      }

      const job = acceptData.job;

      if (job.type === "repost") {
        await sendMessage(chatId, `✅ Job diterima! Sedang memverifikasi repost...`);
        const verifyRes = await fetch(`${APP_URL}/api/jobs/${jobId}/verify-proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twitter_handle: user.twitter_handle }),
        });
        const verifyData = await verifyRes.json();

        if (verifyRes.ok) {
          await sendMessage(chatId, `🎉 Selesai! Job terverifikasi. Payment akan diproses oleh admin.`);
        } else {
          await sendMessage(
            chatId,
            `⚠️ Job diterima, tapi repost belum terdeteksi.\n\n${verifyData.error}\n\nSetelah retweet, kirim:\n/verify ${jobId}`
          );
          await db.from("users").update({ telegram_pending_job_id: jobId }).eq("id", user.id);
        }
      } else {
        await sendMessage(
          chatId,
          `✅ Job diterima!\n\n📌 <b>${escapeHtml(job.title)}</b>\nTipe: ${TYPE_LABEL[job.type] ?? job.type}\n\nKirimkan URL tweet sebagai bukti pekerjaan kamu:`
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
      await sendMessage(chatId, `⚠️ Link tidak valid. Generate ulang dari dashboard.`);
      return NextResponse.json({ ok: true });
    }

    if (user.telegram_token_expires_at && user.telegram_token_expires_at < now) {
      await sendMessage(chatId, `⏰ Link sudah expired. Generate link baru dari dashboard.`);
      return NextResponse.json({ ok: true });
    }

    await db
      .from("users")
      .update({
        telegram_chat_id: String(chatId),
        telegram_link_token: null,
        telegram_token_expires_at: null,
      })
      .eq("id", user.id);

    await sendMessage(
      chatId,
      `✅ Akun <b>@${escapeHtml(user.twitter_handle)}</b> berhasil terhubung!\n\nSekarang kamu bisa apply job langsung dari channel notifikasi. 🎉`
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
      await sendMessage(chatId, `⚠️ Akun belum terhubung.`);
      return NextResponse.json({ ok: true });
    }

    await sendMessage(chatId, `⏳ Mengecek repost...`);
    const verifyRes = await fetch(`${APP_URL}/api/jobs/${jobId}/verify-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitter_handle: user.twitter_handle }),
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.ok) {
      await sendMessage(chatId, `🎉 Repost terverifikasi! Job selesai.`);
      await db.from("users").update({ telegram_pending_job_id: null }).eq("id", user.id);
    } else {
      await sendMessage(chatId, `❌ ${verifyData.error}\n\nCoba lagi setelah retweet.`);
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
      await sendMessage(chatId, `⚠️ Kirim URL tweet yang valid (twitter.com atau x.com).`);
      return NextResponse.json({ ok: true });
    }

    await sendMessage(chatId, `⏳ Memverifikasi proof...`);
    const verifyRes = await fetch(`${APP_URL}/api/jobs/${user.telegram_pending_job_id}/verify-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twitter_handle: user.twitter_handle, proof_url: text }),
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.ok) {
      await sendMessage(chatId, `🎉 Proof diterima! Job selesai. Payment akan diproses oleh admin.`);
      await db.from("users").update({ telegram_pending_job_id: null }).eq("id", user.id);
    } else {
      await sendMessage(chatId, `❌ Gagal: ${verifyData.error}`);
    }
  }

  return NextResponse.json({ ok: true });
}
