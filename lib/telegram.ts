const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN    ?? "";
const CHANNEL_ID   = process.env.TELEGRAM_CHANNEL_ID   ?? "@yapperagent";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "yapper_agent_bot";
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL    ?? "https://yapperagent.xyz";

const TYPE_LABEL: Record<string, string> = {
  repost:     "Repost",
  like_reply: "Like & Reply",
  content:    "Content",
  campaign:   "Campaign",
  custom:     "Custom",
};

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  extra?: Record<string, unknown>
) {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...extra,
      }),
    });
    const json = await res.json();
    return json.result ?? null;
  } catch {
    return null;
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

/** Sends a new job notification to the channel with inline Apply/Web buttons. Returns Telegram message_id or null. */
export async function notifyNewJob(job: {
  id: string;
  title: string;
  type: string;
  price_usdc: number;
  deadline_hours?: number;
}): Promise<number | null> {
  if (!BOT_TOKEN) return null;

  const typeLabel = TYPE_LABEL[job.type] ?? job.type;
  const price     = job.price_usdc < 1 ? job.price_usdc.toFixed(2) : String(job.price_usdc);
  const deadline  = job.deadline_hours ? `${job.deadline_hours}h` : "—";

  const text = [
    `🔔 <b>New Job is Available</b>`,
    ``,
    `➜ Title    » ${escapeHtml(job.title)}`,
    `➜ Type     » ${typeLabel}`,
    `➜ Reward   » $${price} USDC`,
    `➜ Deadline » ${deadline}`,
  ].join("\n");

  const inline_keyboard = [[
    { text: "🤖 Apply via Bot", url: `https://t.me/${BOT_USERNAME}?start=job_${job.id}` },
    { text: "🌐 View on Web",   url: `${APP_URL}/jobs` },
  ]];

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard },
      }),
    });
    const json = await res.json();
    return (json.result?.message_id as number) ?? null;
  } catch {
    return null;
  }
}
