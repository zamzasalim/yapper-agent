const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN  ?? "";
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID ?? "@yapperagent";
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL  ?? "https://yapper-agent.vercel.app";

const TYPE_LABEL: Record<string, string> = {
  repost:     "Repost",
  like_reply: "Like & Reply",
  content:    "Content",
  campaign:   "Campaign",
  custom:     "Custom",
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function notifyNewJob(job: {
  id: string;
  title: string;
  type: string;
  price_usdc: number;
}) {
  if (!BOT_TOKEN) return;

  const typeLabel = TYPE_LABEL[job.type] ?? job.type;
  const price = job.price_usdc < 1
    ? job.price_usdc.toFixed(2)
    : String(job.price_usdc);

  const text = [
    `🔔 <b>New Job is Available</b>`,
    ``,
    `➜ Title » ${escapeHtml(job.title)}`,
    `➜ Type » ${typeLabel}`,
    `➜ Reward » $${price} USDC`,
    ``,
    `<a href="${APP_URL}/jobs">👉🏻 Apply Now</a>`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Non-critical — don't block job approval if Telegram fails
  }
}
