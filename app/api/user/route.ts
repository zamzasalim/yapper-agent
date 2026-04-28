import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { fetchTwitterUserStats } from "@/lib/scrapebadger";
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
      // Refresh live stats (followers + avatar) in the background on every login
      type UserUpdate = Database["public"]["Tables"]["users"]["Update"];
      const updates: UserUpdate = {};
      if (avatar_url && avatar_url !== existing.avatar_url) updates.avatar_url = avatar_url;

      const stats = await fetchTwitterUserStats(twitter_handle || existing.twitter_handle);
      if (stats) {
        updates.twitter_followers = stats.followers;
        updates.is_verified_blue  = stats.is_verified_blue;
        // Only backfill name/avatar if not already set by user
        if (!existing.display_name || existing.display_name === existing.twitter_handle) {
          if (stats.name) updates.display_name = stats.name;
        }
        if (!existing.avatar_url && stats.avatar_url) {
          updates.avatar_url = stats.avatar_url;
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.from("users").update(updates).eq("id", existing.id);
        return NextResponse.json({ user: { ...existing, ...updates } });
      }
      return NextResponse.json({ user: existing });
    }

    // Fetch real follower count + blue status from ScrapeBadger for new user
    const stats = await fetchTwitterUserStats(twitter_handle);

    // Create new creator record
    const { data: created, error } = await db
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        privy_did: privy_did || twitter_handle,
        wallet_address: "pending",
        twitter_handle,
        twitter_id: twitter_id || twitter_handle,
        twitter_followers: stats?.followers ?? 0,
        display_name: display_name || stats?.name || twitter_handle,
        avatar_url: avatar_url ?? stats?.avatar_url ?? null,
        is_verified_blue: stats?.is_verified_blue ?? false,
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
    const { twitter_handle, twitter_id, display_name, privy_did, wallet_address, twitter_followers, niches, avatar_url } = body;

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
        ...(niches !== undefined && { niches }),
        ...(display_name !== undefined && { display_name }),
        ...(avatar_url !== undefined && { avatar_url }),
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
      is_verified_blue: false,
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

    // Fetch their accepted/completed jobs (as creator — single-creator jobs)
    // credited_at is a migration-added column, cast to any
    const { data: singleJobs } = await (db as any)
      .from("jobs")
      .select("id, created_at, type, title, price_usdc, status, client_id, credited_at")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch multi-creator jobs they've accepted via job_completions
    // Use job_completions.status and credited_at for the individual creator's progress
    const { data: completions } = await (db as any)
      .from("job_completions")
      .select("job_id, status, credited_at, jobs(id, created_at, type, title, price_usdc)")
      .eq("creator_id", user.id)
      .limit(50);

    const multiJobs = ((completions as any[]) ?? [])
      .map((c: any) => {
        if (!c.jobs) return null;
        // job_completions uses "accepted" for slots not yet proven; map to "in_progress"
        // so dashboard stats/labels are consistent with single-creator jobs
        const displayStatus = c.status === "accepted" ? "in_progress" : c.status;
        return { ...c.jobs, status: displayStatus, credited_at: c.credited_at };
      })
      .filter(Boolean)
      .filter((j: any) => !(singleJobs ?? []).some((s: any) => s.id === j.id));

    const jobs = [...(singleJobs ?? []), ...multiJobs]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    // Fetch jobs they posted (as client)
    const { data: clientJobs } = await db
      .from("jobs")
      .select("id, created_at, type, title, price_usdc, status, creator_id, rating")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ user, jobs: jobs ?? [], clientJobs: clientJobs ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
