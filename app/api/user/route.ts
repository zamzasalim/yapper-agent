import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

/**
 * POST /api/user
 * Upsert a creator record when the user first connects their X account.
 * Returns the full user row.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { twitter_handle, twitter_id, display_name } = body;

    if (!twitter_handle) {
      return NextResponse.json({ error: "twitter_handle required" }, { status: 400 });
    }

    const db = createServerClient();

    // Check if user already exists
    const { data: existing } = await db
      .from("users")
      .select("*")
      .eq("twitter_handle", twitter_handle)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ user: existing });
    }

    // Create new creator record
    const { data: created, error } = await db
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        wallet_address: "pending",
        twitter_handle,
        twitter_id: twitter_id || twitter_handle,
        twitter_followers: 0,
        display_name: display_name || twitter_handle,
        is_verified_blue: true, // X OAuth confirms real account
        role: "creator" as const,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/user
 * Update wallet address and/or follower count.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { twitter_handle, wallet_address, twitter_followers } = body;

    if (!twitter_handle) {
      return NextResponse.json({ error: "twitter_handle required" }, { status: 400 });
    }

    const db = createServerClient();

    type UserUpdate = Database["public"]["Tables"]["users"]["Update"];
    const updates: UserUpdate = {};
    if (wallet_address !== undefined) updates.wallet_address = wallet_address;
    if (twitter_followers !== undefined) updates.twitter_followers = twitter_followers;

    const { data, error } = await db
      .from("users")
      .update(updates)
      .eq("twitter_handle", twitter_handle)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/user?handle=xxx
 * Fetch a creator's profile and their completed jobs.
 */
export async function GET(req: NextRequest) {
  try {
    const handle = req.nextUrl.searchParams.get("handle");
    if (!handle) {
      return NextResponse.json({ error: "handle required" }, { status: 400 });
    }

    const db = createServerClient();

    const { data: user, error } = await db
      .from("users")
      .select("*")
      .eq("twitter_handle", handle)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!user) return NextResponse.json({ user: null });

    // Fetch their accepted/completed jobs
    const { data: jobs } = await db
      .from("jobs")
      .select("id, created_at, type, title, price_usdc, status, client_id")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ user, jobs: jobs ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
