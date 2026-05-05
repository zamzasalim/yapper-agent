import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import { notifyNewJob } from "@/lib/telegram";
import { verifyCantonTransfer, createJobEscrow, YAPPER_CANTON_PARTY } from "@/lib/canton";

export async function GET() {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("jobs")
      .select(
        `id, created_at, type, status, title, description,
         price_usdc, tweet_url, is_agent_job, deadline_hours,
         client:users!client_id(twitter_handle, display_name)`
      )
      .eq("status", "open")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ jobs: [] });
    return NextResponse.json({ jobs: data ?? [] });
  } catch {
    return NextResponse.json({ jobs: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate twitter_handle format — only alphanumeric + underscore, 1–15 chars
    const rawHandle = String(body.twitter_handle ?? "").replace(/^@/, "").trim();
    if (!/^[A-Za-z0-9_]{1,15}$/.test(rawHandle)) {
      return NextResponse.json(
        { error: "Invalid Twitter handle" },
        { status: 400 }
      );
    }
    body.twitter_handle = rawHandle;

    const prefilledCreator: string | undefined = body.prefilledCreator
      ? String(body.prefilledCreator).replace(/^@/, "")
      : undefined;
    const db = createServerClient();

    // Upsert user (client) — create record if they haven't registered as creator
    let clientId: string | null = null;
    let clientCantonPartyId: string | null = null;

    if (body.twitter_handle) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (db as any)
        .from("users")
        .select("id, canton_party_id")
        .eq("twitter_handle", body.twitter_handle)
        .maybeSingle() as { data: { id: string; canton_party_id: string | null } | null };

      if (existing) {
        clientId = existing.id;
        clientCantonPartyId = existing.canton_party_id ?? null;
      } else {
        const { data: created } = await db
          .from("users")
          .insert({
            id: crypto.randomUUID(),
            privy_did: body.privy_did || body.twitter_handle,
            wallet_address: body.wallet_address || "pending",
            twitter_handle: body.twitter_handle,
            twitter_id: body.twitter_id || body.twitter_handle,
            twitter_followers: body.twitter_followers ?? 0,
            display_name: body.display_name || body.twitter_handle,
            is_verified_blue: body.is_verified_blue ?? false,
            role: "client" as const,
          })
          .select("id")
          .maybeSingle();
        clientId = created?.id ?? null;
      }
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "Could not resolve client user — missing twitter_handle" },
        { status: 400 }
      );
    }

    // Enforce minimum price per creator (server-side guard against API bypass)
    const MIN_PRICE: Record<string, number> = {
      repost:     0.50,
      like_reply: 0.20,
      content:    5.00,
      campaign:   5.00,
    };
    const minPrice = MIN_PRICE[body.type];
    if (minPrice !== undefined && (body.price_usdc ?? 0) < minPrice) {
      return NextResponse.json(
        { error: `Minimum price for ${body.type} is $${minPrice.toFixed(2)} USDC per creator` },
        { status: 400 }
      );
    }

    // CC payment: verify transfer on Canton Lighthouse before accepting the job
    if (body.currency === "cc") {
      if (!YAPPER_CANTON_PARTY) {
        return NextResponse.json({ error: "Canton Network payment is not yet configured on this platform." }, { status: 503 });
      }
      if (!body.canton_tx_hash) {
        return NextResponse.json({ error: "canton_tx_hash required for CC payment" }, { status: 400 });
      }
      const priceCC: number = typeof body.price_cc === "number" ? body.price_cc : 0;
      const result = await verifyCantonTransfer(body.canton_tx_hash, priceCC);
      if (!result.valid) {
        return NextResponse.json(
          { error: "CC payment verification failed — transfer not found or amount insufficient" },
          { status: 400 },
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertRow: any = {
      client_id: clientId,
      type: body.type,
      status: body.status ?? "open",
      title: body.title,
      description: body.description,
      price_usdc: body.price_usdc,
      currency: body.currency ?? "usdc",
      price_cc: body.price_cc ?? 0,
      tweet_url: body.tweet_url || null,
      content_brief: body.content_brief || null,
      is_agent_job: body.is_agent_job ?? false,
      deadline_hours: body.deadline_hours,
      tx_hash: body.tx_hash ?? null,
      canton_tx_hash: body.canton_tx_hash ?? null,
      require_blue: body.require_blue ?? false,
      min_followers: body.min_followers ?? 0,
      max_creators: Math.min(500, Math.max(1, parseInt(body.num_creators) || 1)),
      slots_taken: 0,
    };

    const { data: job, error } = await db
      .from("jobs")
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && error.message?.includes("canton_tx_hash")) {
        return NextResponse.json(
          { error: "This CC transaction has already been used to pay for another job." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/jobs");

    // CC job: create DAML JobEscrow contract and persist contractId (best-effort)
    if (job.currency === "cc") {
      const contractId = await createJobEscrow(job.id, clientCantonPartyId, job.price_cc ?? 0);
      if (contractId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).from("jobs").update({ canton_contract_id: contractId }).eq("id", job.id);
      }
    }

    if (job.status === "open") {
      const messageId = await notifyNewJob(job);
      if (messageId) {
        await db.from("jobs").update({ telegram_message_id: String(messageId) }).eq("id", job.id);
      }
    }

    // Direct-hire: notify the target creator
    if (prefilledCreator && ["open", "pending_approval"].includes(job.status)) {
      const { data: targetCreator } = await db
        .from("users")
        .select("id")
        .eq("twitter_handle", prefilledCreator)
        .maybeSingle();
      if (targetCreator) {
        void db.from("notifications").insert({
          user_id: targetCreator.id,
          job_id: job.id,
          message: `@${body.twitter_handle} wants to hire you directly for "${job.title}"!`,
        });
      }
    }

    return NextResponse.json({ job });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
