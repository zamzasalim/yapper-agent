import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { ADMINS } from "@/lib/admins";

/**
 * GET /api/admin/credits/pending?admin_handle=xxx
 * Returns completed jobs/completions that have not yet been credited.
 * Response:
 *   pending   — USDC items (credited_at IS NULL)
 *   ccPending — CC items   (canton_credited_at IS NULL, currency = 'cc')
 */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("admin_handle") ?? "";
  if (!ADMINS.some((a) => a.toLowerCase() === handle.toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = createServerClient();

  // ── USDC: campaign completions ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usdcCampaignRows, error: e1 } = await (db as any)
    .from("job_completions")
    .select(`
      id,
      job_id,
      jobs ( id, title, type, price_usdc, currency, is_agent_job, status ),
      users ( twitter_handle, display_name, wallet_address )
    `)
    .eq("status", "completed")
    .is("credited_at", null);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // ── USDC: single-creator jobs ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usdcSingleRows, error: e2 } = await (db as any)
    .from("jobs")
    .select(`
      id, title, type, price_usdc, currency, creator_id, credited_at, is_agent_job,
      users!jobs_creator_id_fkey ( twitter_handle, display_name, wallet_address )
    `)
    .eq("status", "completed")
    .is("credited_at", null)
    .not("creator_id", "is", null)
    .or("max_creators.is.null,max_creators.lte.1");

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  // ── CC: campaign completions ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ccCampaignRows, error: e3 } = await (db as any)
    .from("job_completions")
    .select(`
      id,
      job_id,
      jobs!inner ( id, title, type, price_cc, canton_contract_id, currency, is_agent_job, status ),
      users ( twitter_handle, display_name, wallet_address, canton_party_id )
    `)
    .eq("status", "completed")
    .is("canton_credited_at", null)
    .eq("jobs.currency", "cc");

  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

  // ── CC: single-creator jobs ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ccSingleRows, error: e4 } = await (db as any)
    .from("jobs")
    .select(`
      id, title, type, price_cc, canton_contract_id, currency, creator_id, canton_credited_at, is_agent_job,
      users!jobs_creator_id_fkey ( twitter_handle, display_name, wallet_address, canton_party_id )
    `)
    .eq("status", "completed")
    .eq("currency", "cc")
    .is("canton_credited_at", null)
    .not("creator_id", "is", null)
    .or("max_creators.is.null,max_creators.lte.1");

  if (e4) return NextResponse.json({ error: e4.message }, { status: 500 });

  // ── Normalise USDC items ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending: any[] = [];

  for (const row of ((usdcCampaignRows as any[]) ?? [])) {
    const job  = row.jobs;
    const user = row.users;
    if (!job || !user?.wallet_address) continue;
    if (["open", "in_progress"].includes(job.status)) continue;
    if ((job.currency ?? "usdc") === "cc") continue; // handled in ccPending
    pending.push({
      source_id:      row.id,
      source_type:    "completion",
      job_id:         row.job_id,
      title:          job.title,
      type:           job.type,
      is_agent_job:   job.is_agent_job ?? false,
      creator_handle: user.twitter_handle,
      creator_name:   user.display_name,
      wallet:         user.wallet_address,
      amount_usdc:    job.price_usdc ?? 0,
      currency:       "usdc",
    });
  }

  for (const row of ((usdcSingleRows as any[]) ?? [])) {
    const user = row.users;
    if (!user?.wallet_address) continue;
    if ((row.currency ?? "usdc") === "cc") continue;
    pending.push({
      source_id:      row.id,
      source_type:    "job",
      job_id:         row.id,
      title:          row.title,
      type:           row.type,
      is_agent_job:   row.is_agent_job ?? false,
      creator_handle: user.twitter_handle,
      creator_name:   user.display_name,
      wallet:         user.wallet_address,
      amount_usdc:    row.price_usdc ?? 0,
      currency:       "usdc",
    });
  }

  // ── Normalise CC items ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ccPending: any[] = [];

  for (const row of ((ccCampaignRows as any[]) ?? [])) {
    const job  = row.jobs;
    const user = row.users;
    if (!job || (job.currency ?? "usdc") !== "cc") continue;
    if (["open", "in_progress"].includes(job.status)) continue;
    ccPending.push({
      source_id:               row.id,
      source_type:             "completion",
      job_id:                  row.job_id,
      title:                   job.title,
      type:                    job.type,
      is_agent_job:            job.is_agent_job ?? false,
      creator_handle:          user?.twitter_handle ?? "",
      creator_name:            user?.display_name ?? "",
      wallet:                  user?.wallet_address ?? "",
      amount_usdc:             0,
      currency:                "cc",
      amount_cc:               job.price_cc ?? 0,
      canton_contract_id:      job.canton_contract_id ?? null,
      creator_canton_party_id: user?.canton_party_id ?? null,
    });
  }

  for (const row of ((ccSingleRows as any[]) ?? [])) {
    const user = row.users;
    ccPending.push({
      source_id:               row.id,
      source_type:             "job",
      job_id:                  row.id,
      title:                   row.title,
      type:                    row.type,
      is_agent_job:            row.is_agent_job ?? false,
      creator_handle:          user?.twitter_handle ?? "",
      creator_name:            user?.display_name ?? "",
      wallet:                  user?.wallet_address ?? "",
      amount_usdc:             0,
      currency:                "cc",
      amount_cc:               row.price_cc ?? 0,
      canton_contract_id:      row.canton_contract_id ?? null,
      creator_canton_party_id: user?.canton_party_id ?? null,
    });
  }

  return NextResponse.json({ pending, ccPending });
}
