import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

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
    const db = createServerClient();

    // Upsert user (client) — create record if they haven't registered as creator
    let clientId: string | null = null;

    if (body.twitter_handle) {
      const { data: existing } = await db
        .from("users")
        .select("id")
        .eq("twitter_handle", body.twitter_handle)
        .maybeSingle();

      if (existing) {
        clientId = existing.id;
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

    const { data: job, error } = await db
      .from("jobs")
      .insert({
        client_id: clientId,
        type: body.type,
        status: (body.status ?? "open") as const,
        title: body.title,
        description: body.description,
        price_usdc: body.price_usdc,
        tweet_url: body.tweet_url || null,
        content_brief: body.content_brief || null,
        is_agent_job: body.is_agent_job ?? false,
        deadline_hours: body.deadline_hours,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
