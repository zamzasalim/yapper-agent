import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { ADMINS } from "@/lib/admins";

/**
 * GET /api/admin/credits/pending?admin_handle=xxx
 * Returns completed job_completions (campaign slots) and single-creator jobs
 * that have not yet been credited on-chain (credited_at IS NULL).
 */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("admin_handle") ?? "";
  if (!ADMINS.includes(handle)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = createServerClient();

  // Campaign completions (multi-slot jobs use job_completions rows)
  // Cast as any: credited_at is a migration-added column, not yet in generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaignRows, error: e1 } = await (db as any)
    .from("job_completions")
    .select(`
      id,
      job_id,
      jobs ( id, title, type, price_usdc ),
      users ( twitter_handle, display_name, wallet_address )
    `)
    .eq("status", "completed")
    .is("credited_at", null);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // Single-creator jobs: creator stored on jobs.creator_id (max_creators = 1 or null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: singleRows, error: e2 } = await (db as any)
    .from("jobs")
    .select(`
      id, title, type, price_usdc, creator_id, credited_at,
      users!jobs_creator_id_fkey ( twitter_handle, display_name, wallet_address )
    `)
    .eq("status", "completed")
    .is("credited_at", null)
    .not("creator_id", "is", null)
    .or("max_creators.is.null,max_creators.lte.1");

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  // Normalise into flat list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending: any[] = [];

  for (const row of ((campaignRows as any[]) ?? [])) {
    const job  = row.jobs;
    const user = row.users;
    if (!job || !user?.wallet_address) continue;
    pending.push({
      source_id:      row.id,
      source_type:    "completion",
      job_id:         row.job_id,
      title:          job.title,
      type:           job.type,
      creator_handle: user.twitter_handle,
      creator_name:   user.display_name,
      wallet:         user.wallet_address,
      amount_usdc:    job.price_usdc ?? 0,
    });
  }

  for (const row of ((singleRows as any[]) ?? [])) {
    const user = row.users;
    if (!user?.wallet_address) continue;
    pending.push({
      source_id:      row.id,
      source_type:    "job",
      job_id:         row.id,
      title:          row.title,
      type:           row.type,
      creator_handle: user.twitter_handle,
      creator_name:   user.display_name,
      wallet:         user.wallet_address,
      amount_usdc:    row.price_usdc ?? 0,
    });
  }

  return NextResponse.json({ pending });
}
