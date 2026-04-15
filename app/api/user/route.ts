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
    const { twitter_handle, twitter_id, display_name, privy_did, avatar_url } = body;

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
      // Refresh avatar_url in case profile picture changed
      if (avatar_url && avatar_url !== existing.avatar_url) {
        await db.from("users").update({ avatar_url }).eq("id", existing.id);
        return NextResponse.json({ user: { ...existing, avatar_url } });
      }
      return NextResponse.json({ user: existing });
    }

    // Create new creator record
    const { data: created, error } = await db
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        privy_did: privy_did || twitter_handle,
        wallet_address: "pending",
        twitter_handle,
        twitter_id: twitter_id || twitter_handle,
        twitter_followers: 0,
        display_name: display_name || twitter_handle,
        avatar_url: avatar_url ?? null,
        is_verified_blue: true,
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
 * Uses upsert so it works even if the user record doesn't exist yet.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { twitter_handle, twitter_id, display_name, privy_did, wallet_address, twitter_followers } = body;

    if (!twitter_handle) {
      return NextResponse.json({ error: "twitter_handle required" }, { status: 400 });
    }

    const db = createServerClient();

    // Try UPDATE first — fast path when user already exists
    const { data: updated, error: updateError } = await db
      .from("users")
      .update({
        ...(wallet_address !== undefined && { wallet_address }),
        ...(twitter_followers !== undefined && { twitter_followers }),
      })
      .eq("twitter_handle", twitter_handle)
      .select()
      .single();

    // PGRST116 = no rows matched — user doesn't exist yet, create them
    if (!updateError) {
      return NextResponse.json({ user: updated });
    }

    if (updateError.code !== "PGRST116") {
      return NextResponse.json({ error: updateError.message, code: updateError.code }, { status: 500 });
    }

    // INSERT new user record
    type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
    const payload: UserInsert = {
      id: crypto.randomUUID(),
      privy_did: privy_did || twitter_handle,
      twitter_handle,
      twitter_id: twitter_id || twitter_handle,
      display_name: display_name || twitter_handle,
      wallet_address: wallet_address ?? "pending",
      twitter_followers: twitter_followers ?? 0,
      is_verified_blue: true,
      role: "creator" as const,
    };

    const { data, error } = await db
      .from("users")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
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
