import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import { notifyNewJob } from "@/lib/telegram";
import { parsePaymentHeader, verifyX402Payment, requiredUsdc, x402Body } from "@/lib/x402";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://yapper-agent.vercel.app";

type AgentRow = { id: string; display_name: string } | null;

async function resolveAgent(apiKey: string): Promise<AgentRow> {
  const db = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("users")
    .select("id, display_name")
    .eq("agent_api_key", apiKey)
    .maybeSingle() as { data: AgentRow };
  return data;
}

/**
 * GET /api/agent/jobs?api_key=xxx
 * List all jobs created by this agent (recovery endpoint).
 */
export async function GET(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get("api_key");
  if (!apiKey) return NextResponse.json({ error: "api_key required" }, { status: 401 });

  const agent = await resolveAgent(apiKey);
  if (!agent) return NextResponse.json({ error: "Invalid api_key" }, { status: 401 });

  const db = createServerClient();
  const { data: jobs, error } = await db
    .from("jobs")
    .select("id, created_at, type, status, title, price_usdc, max_creators, slots_taken, deadline_hours, is_paid, completed_at")
    .eq("client_id", agent.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: jobs ?? [] });
}

/**
 * POST /api/agent/jobs
 * Create a job. Requires X-Payment header (x402) OR sends back 402 with payment details.
 * Body: { api_key, type, title, description, price_usdc?, tweet_url?, content_brief?,
 *         deadline_hours?, require_blue?, min_followers?, num_creators? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // api_key from body or X-API-Key header
    const apiKey = (body.api_key as string | undefined) ?? req.headers.get("X-API-Key") ?? "";
    if (!apiKey) return NextResponse.json({ error: "api_key required" }, { status: 401 });

    const agent = await resolveAgent(apiKey);
    if (!agent) return NextResponse.json({ error: "Invalid api_key" }, { status: 401 });

    const jobType    = String(body.type ?? "");
    const amountUsdc = requiredUsdc(jobType, body.price_usdc);

    // ── x402 payment gate ──────────────────────────────────────────────────
    const paymentHeader = req.headers.get("X-Payment");

    if (!paymentHeader) {
      return NextResponse.json(
        x402Body(
          `${APP_URL}/api/agent/jobs`,
          amountUsdc,
          `Post ${jobType} job "${body.title ?? ""}" on Yapper Agent`
        ),
        { status: 402 }
      );
    }

    const payment = parsePaymentHeader(paymentHeader);
    if (!payment) {
      return NextResponse.json({ error: "Invalid X-Payment header format." }, { status: 400 });
    }

    // Prevent TX reuse
    const db = createServerClient();
    const { data: existing } = await db
      .from("jobs")
      .select("id")
      .eq("tx_hash", payment.tx_hash)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Transaction already used for another job." }, { status: 409 });
    }

    const { valid, error: payErr, payer } = await verifyX402Payment(payment.tx_hash, amountUsdc);
    if (!valid) {
      return NextResponse.json({ error: payErr }, { status: 402 });
    }

    // Backfill agent wallet_address from tx fee payer if not yet set
    if (payer) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: agentUser } = await (db as any)
        .from("users")
        .select("wallet_address")
        .eq("id", agent.id)
        .maybeSingle();
      if (!agentUser?.wallet_address) {
        await db.from("users").update({ wallet_address: payer }).eq("id", agent.id);
      }
    }

    // ── Create job ─────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertRow: any = {
      client_id:     agent.id,
      type:          jobType,
      status:        jobType === "custom" ? "pending_approval" : "open",
      title:         body.title,
      description:   body.description ?? null,
      price_usdc:    amountUsdc,
      tweet_url:     body.tweet_url ?? null,
      content_brief: body.content_brief ?? null,
      is_agent_job:  true,
      deadline_hours: body.deadline_hours ?? 24,
      tx_hash:       payment.tx_hash,
      require_blue:  body.require_blue ?? false,
      min_followers: body.min_followers ?? 0,
      max_creators:  Math.max(1, parseInt(String(body.num_creators)) || 1),
      slots_taken:   0,
    };

    const { data: job, error: jobErr } = await db.from("jobs").insert(insertRow).select().single();
    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

    revalidatePath("/jobs");

    if (job.status === "open") {
      const messageId = await notifyNewJob(job);
      if (messageId) {
        await db.from("jobs").update({ telegram_message_id: String(messageId) }).eq("id", job.id);
      }
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
