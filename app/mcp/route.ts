import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requiredUsdc, x402Body, parsePaymentHeader, verifyX402Payment } from "@/lib/x402";
import { notifyNewJob } from "@/lib/telegram";
import { revalidatePath } from "next/cache";

const APP_URL   = process.env.NEXT_PUBLIC_APP_URL   ?? "https://yapperagent.xyz";
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "https://agent.yapperagent.xyz";
const API_URL   = process.env.NEXT_PUBLIC_API_URL   ?? "https://api.yapperagent.xyz";

// ── MCP Tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name:        "register_agent",
    description: "Register your AI agent on Yapper. Returns a permanent api_key for all subsequent requests. Call this once and store the api_key.",
    inputSchema: {
      type:     "object",
      required: ["agent_name"],
      properties: {
        agent_name:     { type: "string", description: "Display name for this agent" },
        wallet_address: { type: "string", description: "Solana wallet address of the agent" },
      },
    },
  },
  {
    name:        "get_payment_info",
    description: "Get x402 payment details before creating a job. Returns the Solana wallet to pay and the exact USDC amount required.",
    inputSchema: {
      type:     "object",
      required: ["type"],
      properties: {
        type:       { type: "string", enum: ["repost", "like_reply", "content", "campaign", "custom"], description: "Job type" },
        price_usdc: { type: "number", description: "Custom price for content/campaign jobs" },
      },
    },
  },
  {
    name:        "create_job",
    description: "Post a job for humans to complete on Yapper. You must pay USDC on Solana first (use get_payment_info to get details) and pass the transaction signature as tx_hash.",
    inputSchema: {
      type:     "object",
      required: ["api_key", "type", "title", "tx_hash"],
      properties: {
        api_key:        { type: "string", description: "Your agent API key" },
        type:           { type: "string", enum: ["repost", "like_reply", "content", "campaign", "custom"] },
        title:          { type: "string" },
        description:    { type: "string" },
        tweet_url:      { type: "string", description: "Required for repost and like_reply jobs" },
        price_usdc:     { type: "number", description: "USDC amount paid. Must match payment." },
        deadline_hours: { type: "number", default: 24 },
        num_creators:   { type: "number", default: 1, description: "Number of slots for campaign jobs" },
        require_blue:   { type: "boolean", default: false },
        min_followers:  { type: "number", default: 0 },
        content_brief:  { type: "string" },
        tx_hash:        { type: "string", description: "Solana transaction signature of your USDC payment" },
      },
    },
  },
  {
    name:        "list_jobs",
    description: "List all jobs you have created on Yapper. Use this to recover job IDs or check status.",
    inputSchema: {
      type:     "object",
      required: ["api_key"],
      properties: {
        api_key: { type: "string" },
      },
    },
  },
  {
    name:        "get_job",
    description: "Get a specific job and all human submissions. Poll this until status is 'completed' to retrieve proof URLs and creator info.",
    inputSchema: {
      type:     "object",
      required: ["api_key", "job_id"],
      properties: {
        api_key: { type: "string" },
        job_id:  { type: "string" },
      },
    },
  },
  {
    name:        "get_cc_payment_info",
    description: "Get Canton CC payment details before creating a CC-paid job. Returns the Canton party ID to send Amulet (CC) to and the exact CC amount required (live price from CoinMarketCap).",
    inputSchema: {
      type:     "object",
      required: ["type"],
      properties: {
        type:       { type: "string", enum: ["repost", "like_reply", "content", "campaign", "custom"], description: "Job type" },
        price_usdc: { type: "number", description: "Custom USDC-equivalent price for content/campaign jobs" },
      },
    },
  },
  {
    name:        "create_cc_job",
    description: "Post a job paid with CC (Amulet on Canton Network). Use get_cc_payment_info to get the Canton party ID and CC amount, send CC via cantonloop.com or Loop SDK, then call this with the canton_tx_hash.",
    inputSchema: {
      type:     "object",
      required: ["api_key", "type", "title", "canton_tx_hash"],
      properties: {
        api_key:          { type: "string", description: "Your agent API key" },
        type:             { type: "string", enum: ["repost", "like_reply", "content", "campaign", "custom"] },
        title:            { type: "string" },
        description:      { type: "string" },
        tweet_url:        { type: "string", description: "Required for repost and like_reply jobs" },
        price_usdc:       { type: "number", description: "USDC-equivalent price. CC amount is derived from live CC/USD price." },
        deadline_hours:   { type: "number", default: 24 },
        num_creators:     { type: "number", default: 1, description: "Number of slots for campaign jobs" },
        require_blue:     { type: "boolean", default: false },
        min_followers:    { type: "number", default: 0 },
        canton_tx_hash:   { type: "string", description: "Canton transaction hash from cantonloop.com Lighthouse after sending CC" },
      },
    },
  },
  {
    name:        "submit_support",
    description: "Report an issue with a job to Yapper moderators.",
    inputSchema: {
      type:     "object",
      required: ["api_key", "job_id", "issue"],
      properties: {
        api_key: { type: "string" },
        job_id:  { type: "string" },
        issue:   { type: "string", description: "Describe the issue" },
      },
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function resolveAgent(apiKey: string) {
  const db = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("users")
    .select("id, display_name")
    .eq("agent_api_key", apiKey)
    .maybeSingle() as { data: { id: string; display_name: string } | null };
  return data;
}

async function handleTool(name: string, args: Record<string, unknown>) {
  const db = createServerClient();

  // ── register_agent ────────────────────────────────────────────────────────
  if (name === "register_agent") {
    const res = await fetch(`${APP_URL}/api/agent/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(args),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return `Agent registered.\napi_key: ${data.api_key}\nagent_id: ${data.agent_id}\n\nStore your api_key — you will need it for all future requests.`;
  }

  // ── get_payment_info ──────────────────────────────────────────────────────
  if (name === "get_payment_info") {
    const type      = String(args.type ?? "");
    const amount    = requiredUsdc(type, args.price_usdc as number | undefined);
    const x402      = x402Body(`${API_URL}/agent/jobs`, amount, `${type} job`);
    const accepts   = x402.accepts[0];
    return `Payment required to create a ${type} job:\n\n- Amount: ${amount} USDC (${accepts.maxAmountRequired} micro-USDC)\n- Pay to: ${accepts.payTo}\n- Network: ${accepts.network}\n- Asset: ${accepts.asset} (USDC)\n\nAfter paying, pass the Solana transaction signature as tx_hash when calling create_job.`;
  }

  // ── create_job ────────────────────────────────────────────────────────────
  if (name === "create_job") {
    const apiKey = String(args.api_key ?? "");
    const agent  = await resolveAgent(apiKey);
    if (!agent) throw new Error("Invalid api_key");

    const txHash = String(args.tx_hash ?? "");
    if (!txHash) throw new Error("tx_hash required");

    const jobType    = String(args.type ?? "");
    const amountUsdc = requiredUsdc(jobType, args.price_usdc as number | undefined);

    // Prevent TX reuse
    const { data: existing } = await db.from("jobs").select("id").eq("tx_hash", txHash).maybeSingle();
    if (existing) throw new Error("Transaction already used for another job.");

    const { valid, error: payErr } = await verifyX402Payment(txHash, amountUsdc);
    if (!valid) throw new Error(payErr ?? "Payment verification failed.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertRow: any = {
      client_id:      agent.id,
      type:           jobType,
      status:         jobType === "custom" ? "pending_approval" : "open",
      title:          args.title,
      description:    args.description ?? null,
      price_usdc:     amountUsdc,
      tweet_url:      args.tweet_url ?? null,
      content_brief:  args.content_brief ?? null,
      is_agent_job:   true,
      deadline_hours: args.deadline_hours ?? 24,
      tx_hash:        txHash,
      require_blue:   args.require_blue ?? false,
      min_followers:  args.min_followers ?? 0,
      max_creators:   Math.max(1, parseInt(String(args.num_creators)) || 1),
      slots_taken:    0,
    };

    const { data: job, error: jobErr } = await db.from("jobs").insert(insertRow).select().single();
    if (jobErr) throw new Error(jobErr.message);

    revalidatePath("/jobs");
    const messageId = await notifyNewJob(job);
    if (messageId) await db.from("jobs").update({ telegram_message_id: String(messageId) }).eq("id", job.id);

    return `Job created successfully!\n\n- ID: ${job.id}\n- Status: ${job.status}\n- Type: ${job.type}\n- Title: ${job.title}\n- Price: $${job.price_usdc} USDC\n\nPoll get_job with this ID to retrieve submissions once completed.`;
  }

  // ── list_jobs ─────────────────────────────────────────────────────────────
  if (name === "list_jobs") {
    const agent = await resolveAgent(String(args.api_key ?? ""));
    if (!agent) throw new Error("Invalid api_key");

    const { data: jobs } = await db
      .from("jobs")
      .select("id, type, status, title, price_usdc, slots_taken, max_creators, completed_at")
      .eq("client_id", agent.id)
      .order("created_at", { ascending: false });

    if (!jobs?.length) return "No jobs found for this agent.";
    const lines = jobs.map(j =>
      `- ${j.id} | ${j.type} | ${j.status} | "${j.title}" | $${j.price_usdc} | ${j.slots_taken}/${j.max_creators} slots`
    );
    return `Your jobs (${jobs.length}):\n\n${lines.join("\n")}`;
  }

  // ── get_job ───────────────────────────────────────────────────────────────
  if (name === "get_job") {
    const agent = await resolveAgent(String(args.api_key ?? ""));
    if (!agent) throw new Error("Invalid api_key");

    const { data: job } = await db
      .from("jobs")
      .select("id, type, status, title, price_usdc, max_creators, slots_taken, proof_url, completed_at, deadline_hours")
      .eq("id", String(args.job_id))
      .eq("client_id", agent.id)
      .maybeSingle();
    if (!job) throw new Error("Job not found.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let submissions: any[] = [];
    if ((job.max_creators ?? 1) > 1) {
      const { data: c } = await db
        .from("job_completions")
        .select("status, proof_url, creator:creator_id(twitter_handle, display_name, wallet_address)")
        .eq("job_id", job.id);
      submissions = c ?? [];
    } else if (job.proof_url) {
      const { data: cr } = await db
        .from("jobs")
        .select("creator:creator_id(twitter_handle, display_name, wallet_address)")
        .eq("id", job.id)
        .maybeSingle();
      submissions = [{ status: job.status, proof_url: job.proof_url, creator: (cr as any)?.creator }];
    }

    const subLines = submissions.map(s =>
      `  - @${(s.creator as any)?.twitter_handle ?? "?"} | ${s.status} | ${s.proof_url ?? "no proof"}`
    );
    return `Job: ${job.id}\nStatus: ${job.status}\nType: ${job.type}\nTitle: "${job.title}"\nSlots: ${job.slots_taken}/${job.max_creators}\n\nSubmissions (${submissions.length}):\n${subLines.join("\n") || "  (none yet)"}`;
  }

  // ── get_cc_payment_info ───────────────────────────────────────────────────
  if (name === "get_cc_payment_info") {
    const type      = String(args.type ?? "");
    const amountUsd = requiredUsdc(type, args.price_usdc as number | undefined);
    // Fetch live CC price from our API
    const priceRes  = await fetch(`${APP_URL}/api/cc-price`);
    const priceData = await priceRes.json() as { price_usd?: number };
    const ccUSD     = priceData.price_usd ?? 0;
    const amountCC  = ccUSD > 0 ? Math.ceil((amountUsd / ccUSD) * 10) / 10 : null;
    const partyId   = process.env.NEXT_PUBLIC_YAPPER_CANTON_PARTY_ID ?? process.env.YAPPER_CANTON_PARTY_ID ?? "";

    if (!partyId) throw new Error("Canton Network payment not yet configured on this platform.");
    if (!amountCC) throw new Error("Could not fetch live CC price. Try again.");

    return `CC payment required to create a ${type} job:\n\n- Amount: ${amountCC} CC (Amulet)\n- Pay to: ${partyId}\n- Network: Canton Network\n- 1 CC ≈ $${ccUSD.toFixed(4)} USD\n\nSend CC via cantonloop.com or Loop SDK. After sending, get the transaction hash from Lighthouse and call create_cc_job with canton_tx_hash.`;
  }

  // ── create_cc_job ─────────────────────────────────────────────────────────
  if (name === "create_cc_job") {
    const apiKey = String(args.api_key ?? "");
    const agent  = await resolveAgent(apiKey);
    if (!agent) throw new Error("Invalid api_key");

    const cantonHash = String(args.canton_tx_hash ?? "");
    if (!cantonHash) throw new Error("canton_tx_hash required");

    const jobType = String(args.type ?? "");

    // Delegate to canton-jobs API route (handles verification + job creation)
    const res = await fetch(`${APP_URL}/api/agent/canton-jobs`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Payment":    Buffer.from(JSON.stringify({ canton_tx_hash: cantonHash })).toString("base64"),
      },
      body: JSON.stringify({
        api_key:        apiKey,
        type:           jobType,
        title:          args.title,
        description:    args.description ?? null,
        tweet_url:      args.tweet_url ?? null,
        price_usdc:     args.price_usdc ?? null,
        deadline_hours: args.deadline_hours ?? 24,
        num_creators:   args.num_creators ?? 1,
        require_blue:   args.require_blue ?? false,
        min_followers:  args.min_followers ?? 0,
      }),
    });
    const data = await res.json() as { job?: { id: string; status: string; type: string; title: string; price_cc?: number }; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to create CC job");

    const job = data.job!;
    return `CC Job created successfully!\n\n- ID: ${job.id}\n- Status: ${job.status}\n- Type: ${job.type}\n- Title: ${job.title}\n- Price: ${job.price_cc ?? "?"} CC (Amulet)\n\nPoll get_job with this ID to retrieve submissions once completed.`;
  }

  // ── submit_support ────────────────────────────────────────────────────────
  if (name === "submit_support") {
    const res = await fetch(`${APP_URL}/api/agent/support`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(args),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.message;
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ── JSON-RPC 2.0 dispatcher ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRequest(msg: any) {
  const { jsonrpc, method, params, id } = msg;

  // Notifications (no id) — acknowledge only
  if (id === undefined || id === null) return null;

  const ok = (result: unknown) => ({ jsonrpc, id, result });
  const err = (code: number, message: string) => ({ jsonrpc, id, error: { code, message } });

  try {
    if (method === "initialize") {
      return ok({
        protocolVersion: "2024-11-05",
        capabilities:    { tools: {} },
        serverInfo:      { name: "yapper-agent", version: "1.0.0" },
      });
    }

    if (method === "ping") return ok({});

    if (method === "tools/list") {
      return ok({ tools: TOOLS });
    }

    if (method === "tools/call") {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;
      const text = await handleTool(toolName, toolArgs);
      return ok({ content: [{ type: "text", text }] });
    }

    return err(-32601, `Method not found: ${method}`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    return ok({ content: [{ type: "text", text: `Error: ${message}` }], isError: true });
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

/** POST /mcp — MCP Streamable HTTP transport */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map(handleRequest));
      const responses = results.filter(r => r !== null);
      if (!responses.length) return new NextResponse(null, { status: 202 });
      return NextResponse.json(responses);
    }

    const result = await handleRequest(body);
    if (result === null) return new NextResponse(null, { status: 202 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }
}

/** GET /mcp — returns server info */
export async function GET() {
  return NextResponse.json({
    name:        "Yapper Agent MCP Server",
    version:     "1.0.0",
    description: "Hire real humans on X for your AI agent via Model Context Protocol.",
    tools:       TOOLS.map(t => ({ name: t.name, description: t.description })),
    endpoint:    `${AGENT_URL}/mcp`,
  });
}
