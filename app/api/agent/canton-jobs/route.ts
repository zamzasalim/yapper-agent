import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import { notifyNewJob } from "@/lib/telegram";
import { requiredUsdc } from "@/lib/x402";
import { requiredCC, parseCantonPaymentHeader, canton402Body } from "@/lib/canton-x402";
import { verifyCantonTransfer, createJobEscrow, YAPPER_CANTON_PARTY } from "@/lib/canton";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.yapperagent.xyz";

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
 * POST /api/agent/canton-jobs
 *
 * Create a job paid with CC (Canton Network / Amulet) using the x402 protocol.
 *
 * Flow:
 *   1. No X-Payment header → 402 with Canton party ID + live CC amount
 *   2. Agent transfers CC via cantonloop.com or Loop SDK → gets canton_tx_hash
 *   3. Retry with X-Payment: base64({"canton_tx_hash":"<hash>"})
 *   4. Server verifies via Canton Lighthouse → job created with currency=cc
 *
 * Body: { api_key, type, title, description, price_usdc?,
 *         tweet_url?, deadline_hours?, require_blue?, min_followers?, num_creators? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiKey = (body.api_key as string | undefined) ?? req.headers.get("X-API-Key") ?? "";
    if (!apiKey) return NextResponse.json({ error: "api_key required" }, { status: 401 });

    const agent = await resolveAgent(apiKey);
    if (!agent) return NextResponse.json({ error: "Invalid api_key" }, { status: 401 });

    // Canton must be configured on the server before accepting CC jobs
    if (!YAPPER_CANTON_PARTY) {
      return NextResponse.json(
        { error: "Canton Network payment is not yet configured on this platform." },
        { status: 503 },
      );
    }

    const jobType    = String(body.type ?? "");
    const amountUsdc = requiredUsdc(jobType, body.price_usdc);
    // Fetch live CC price and convert — ceiling-rounded to 0.1 CC
    const amountCC   = await requiredCC(amountUsdc);

    const resource    = `${API_URL}/agent/canton-jobs`;
    const description = `Post ${jobType} job "${body.title ?? ""}" on Yapper Agent`;

    // ── x402 payment gate ──────────────────────────────────────────────────
    const paymentHeader = req.headers.get("X-Payment");

    if (!paymentHeader) {
      return NextResponse.json(
        canton402Body(resource, amountCC, description),
        { status: 402 },
      );
    }

    const payment = parseCantonPaymentHeader(paymentHeader);
    if (!payment) {
      return NextResponse.json(
        { error: "Invalid X-Payment header. Expected base64({\"canton_tx_hash\":\"...\"}) or raw hex hash." },
        { status: 400 },
      );
    }

    // Prevent TX reuse across jobs
    const db = createServerClient();
    const { data: existing } = await db
      .from("jobs")
      .select("id")
      .eq("canton_tx_hash", payment.canton_tx_hash)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "Transaction already used for another job." },
        { status: 409 },
      );
    }

    // Verify transfer on Canton Lighthouse
    const result = await verifyCantonTransfer(payment.canton_tx_hash, amountCC);
    if (!result.valid) {
      return NextResponse.json(
        {
          ...canton402Body(resource, amountCC, description),
          error: "CC payment verification failed — transfer not found, amount insufficient, or wrong receiver. Wait for confirmation and retry.",
        },
        { status: 402 },
      );
    }

    // ── Create job ─────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertRow: any = {
      client_id:      agent.id,
      type:           jobType,
      status:         jobType === "custom" ? "pending_approval" : "open",
      title:          body.title,
      description:    body.description ?? null,
      price_usdc:     amountUsdc,
      currency:       "cc",
      price_cc:       amountCC,
      tweet_url:      body.tweet_url ?? null,
      content_brief:  body.content_brief ?? null,
      is_agent_job:   true,
      deadline_hours: body.deadline_hours ?? 24,
      canton_tx_hash: payment.canton_tx_hash,
      require_blue:   body.require_blue ?? false,
      min_followers:  body.min_followers ?? 0,
      max_creators:   Math.max(1, parseInt(String(body.num_creators)) || 1),
      slots_taken:    0,
    };

    const { data: job, error: jobErr } = await db
      .from("jobs")
      .insert(insertRow)
      .select()
      .single();

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

    revalidatePath("/jobs");

    // Create DAML JobEscrow contract and persist contractId (best-effort)
    const contractId = await createJobEscrow(job.id, null, amountCC);
    if (contractId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from("jobs").update({ canton_contract_id: contractId }).eq("id", job.id);
    }

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
