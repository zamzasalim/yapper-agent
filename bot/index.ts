/**
 * Yapper Agent — Telegram Bot
 * Framework: Grammy (https://grammy.dev)
 *
 * Run:  npx tsx bot/index.ts
 * Prod: use Grammy webhook or long-polling with PM2
 */

import { Bot, InlineKeyboard, Context } from "grammy";
import { createServerClient } from "@/lib/supabase";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!; // e.g. @yapperagent

if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");
if (!CHANNEL_ID) throw new Error("TELEGRAM_CHANNEL_ID is not set");

const bot = new Bot(BOT_TOKEN);
const db = createServerClient();

// ─── /start ──────────────────────────────────────────────────────────────────
bot.command("start", async (ctx) => {
  const param = ctx.match; // e.g. "connect" from ?start=connect deep link

  if (param === "connect") {
    // User came from dashboard "Connect Telegram" button
    await ctx.reply(
      "👋 Welcome to *Yapper Agent Bot*!\n\nTo link your Telegram account, send me your wallet address:",
      { parse_mode: "Markdown" }
    );
    // Store chat_id to associate with user wallet (simplified — use state machine in prod)
    return;
  }

  await ctx.reply(
    `⚡ *Yapper Agent Bot*\n\nEarn USDC by completing Twitter micro-jobs.\n\n` +
      `Commands:\n` +
      `/jobs — View open jobs\n` +
      `/earnings — Your total earnings\n` +
      `/help — Help & FAQ\n\n` +
      `Join the job channel: ${CHANNEL_ID}`,
    { parse_mode: "Markdown" }
  );
});

// ─── /jobs ────────────────────────────────────────────────────────────────────
bot.command("jobs", async (ctx) => {
  const { data: jobs, error } = await db
    .from("jobs")
    .select("id, title, type, price_usdc, is_agent_job, min_followers, max_followers")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5) as { data: Array<{ id: string; title: string; type: string; price_usdc: number; is_agent_job: boolean; min_followers: number; max_followers: number }> | null; error: Error | null };

  if (error || !jobs?.length) {
    await ctx.reply("No open jobs right now. Check back soon! 🕐");
    return;
  }

  const lines = jobs.map(
    (j, i) =>
      `${i + 1}. *${j.title}*\n` +
      `   Type: ${j.type} | ${j.is_agent_job ? "🤖 Agent" : "👤 Human"}\n` +
      `   Pay: $${j.price_usdc} USDC\n` +
      `   Followers: ${j.min_followers}–${j.max_followers === 999999 ? "any" : j.max_followers}`
  );

  const keyboard = new InlineKeyboard();
  jobs.forEach((j) => {
    keyboard.text(`Accept: ${j.title.slice(0, 25)}...`, `accept:${j.id}`).row();
  });

  await ctx.reply(`📋 *Open Jobs*\n\n${lines.join("\n\n")}`, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
});

// ─── /earnings ────────────────────────────────────────────────────────────────
bot.command("earnings", async (ctx) => {
  const chatId = ctx.chat.id.toString();

  const { data: user } = await db
    .from("users")
    .select("display_name, total_earned_usdc, jobs_completed, rating")
    .eq("telegram_chat_id", chatId)
    .single() as { data: { display_name: string; total_earned_usdc: number; jobs_completed: number; rating: number } | null; error: null };

  if (!user) {
    await ctx.reply(
      "Your Telegram is not linked yet. Go to the dashboard and click *Connect Telegram*.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  await ctx.reply(
    `💰 *Your Earnings*\n\n` +
      `Total earned: *$${user.total_earned_usdc} USDC*\n` +
      `Jobs completed: *${user.jobs_completed}*\n` +
      `Rating: *${user.rating}/5.0*\n\n` +
      `0% platform fee — every dollar is yours.`,
    { parse_mode: "Markdown" }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.command("help", async (ctx) => {
  await ctx.reply(
    `ℹ️ *Yapper Agent FAQ*\n\n` +
      `*Who can join?*\nOnly Twitter accounts with a verified blue checkmark.\n\n` +
      `*How do I get paid?*\nUSCD is sent to your Solana wallet after the client approves your proof.\n\n` +
      `*What is the platform fee?*\n0%. You keep 100% of every job.\n\n` +
      `*How do Agent Jobs work?*\nAI agents post jobs via x402/MPP. Payment is auto-released when you submit proof.\n\n` +
      `*Website:* https://yapperagent.xyz`,
    { parse_mode: "Markdown" }
  );
});

// ─── Callback: accept job ─────────────────────────────────────────────────────
bot.callbackQuery(/^accept:(.+)$/, async (ctx) => {
  const jobId = ctx.match[1];
  const chatId = ctx.chat?.id.toString();

  if (!chatId) {
    await ctx.answerCallbackQuery("Error: could not identify chat");
    return;
  }

  // Find user by telegram_chat_id
  const { data: user } = await db
    .from("users")
    .select("id, is_verified_blue, twitter_followers")
    .eq("telegram_chat_id", chatId)
    .single() as { data: { id: string; is_verified_blue: boolean; twitter_followers: number } | null; error: null };

  if (!user) {
    await ctx.answerCallbackQuery("Link your Telegram first: /start");
    return;
  }

  if (!user.is_verified_blue) {
    await ctx.answerCallbackQuery("Only verified blue accounts can accept jobs.");
    return;
  }

  // Fetch job
  const { data: job } = await db
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("status", "open")
    .single() as { data: { id: string; title: string; description: string; tweet_url: string | null; deadline_hours: number; min_followers: number; max_followers: number; price_usdc: number; client_id: string } | null; error: null };

  if (!job) {
    await ctx.answerCallbackQuery("This job is no longer available.");
    return;
  }

  // Check follower eligibility
  if (
    user.twitter_followers < job.min_followers ||
    user.twitter_followers > job.max_followers
  ) {
    await ctx.answerCallbackQuery("Your follower count doesn't match this job's requirements.");
    return;
  }

  // Accept job
  await db
    .from("jobs")
    .update({ creator_id: user.id, status: "in_progress", accepted_at: new Date().toISOString() })
    .eq("id", jobId);

  await ctx.answerCallbackQuery("✅ Job accepted!");
  await ctx.reply(
    `✅ *Job Accepted!*\n\n` +
      `*${job.title}*\n\n` +
      `${job.description}\n\n` +
      (job.tweet_url ? `🔗 Tweet: ${job.tweet_url}\n\n` : "") +
      `Deadline: ${job.deadline_hours}h from now.\n\n` +
      `When done, send me the tweet URL as proof:`,
    { parse_mode: "Markdown" }
  );
});

// ─── Handle proof submission (user sends tweet URL) ───────────────────────────
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const chatId = ctx.chat.id.toString();

  // Detect tweet URL
  const isTweetUrl = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(text);
  if (!isTweetUrl) return;

  // Find the user's active job
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .single() as { data: { id: string } | null; error: null };

  if (!user) return;

  const { data: activeJob } = await db
    .from("jobs")
    .select("id, title, client_id")
    .eq("creator_id", user.id)
    .eq("status", "in_progress")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .single() as { data: { id: string; title: string; client_id: string } | null; error: null };

  if (!activeJob) {
    await ctx.reply("You don't have an active job. Use /jobs to find one.");
    return;
  }

  // Save proof URL
  await db
    .from("jobs")
    .update({ proof_url: text })
    .eq("id", activeJob.id);

  await ctx.reply(
    `📤 *Proof submitted!*\n\n` +
      `The client will review and release payment once approved.\n\n` +
      `Job: *${activeJob.title}*`,
    { parse_mode: "Markdown" }
  );
});

// ─── Broadcast new job to channel (called from API route) ────────────────────
export async function broadcastJobToChannel(job: {
  id: string;
  title: string;
  description: string;
  type: string;
  priceUsdc: number;
  isAgentJob: boolean;
  minFollowers: number;
  maxFollowers: number;
  deadlineHours: number;
}) {
  const keyboard = new InlineKeyboard().url(
    "🌐 View & Accept on Website",
    `https://yapperagent.xyz/jobs?id=${job.id}`
  );

  const followerRange =
    job.maxFollowers >= 999999
      ? `${job.minFollowers.toLocaleString()}+`
      : `${job.minFollowers.toLocaleString()} – ${job.maxFollowers.toLocaleString()}`;

  const text =
    `⚡ *New Job Posted*\n\n` +
    `*${job.title}*\n\n` +
    `${job.description.slice(0, 200)}${job.description.length > 200 ? "..." : ""}\n\n` +
    `Type: ${job.type} | ${job.isAgentJob ? "🤖 Agent Job (x402)" : "👤 Human"}\n` +
    `Pay: *$${job.priceUsdc} USDC* (0% fee)\n` +
    `Followers required: ${followerRange}\n` +
    `Deadline: ${job.deadlineHours}h`;

  const msg = await bot.api.sendMessage(CHANNEL_ID, text, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });

  return msg.message_id.toString();
}

// ─── Start bot ────────────────────────────────────────────────────────────────
bot.start({ onStart: (info) => console.log(`🤖 Bot started as @${info.username}`) });
