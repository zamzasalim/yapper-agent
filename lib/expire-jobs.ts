import { createServerClient } from "@/lib/supabase";

/**
 * Accept-to-submit windows per job type.
 * If a creator accepts but doesn't submit proof within this window,
 * their slot is released automatically and the job re-opens.
 */
const ACCEPT_WINDOW_MS: Record<string, number> = {
  repost:     1  * 3_600_000,  // 1h
  like_reply: 1  * 3_600_000,  // 1h
  content:    12 * 3_600_000,  // 12h
  campaign:   24 * 3_600_000,  // 24h
  custom:     24 * 3_600_000,  // 24h
};

interface JobRow {
  id: string;
  status: string;
  created_at: string;
  deadline_hours: number | null;
  deadline_override: string | null;
  client_id: string | null;
  title: string;
  is_agent_job: boolean;
}

/**
 * Core expiry logic shared between the cron route and the admin manual trigger.
 * Handles two passes:
 *   1. Job-level: open→cancelled, in_progress→completed when job deadline passes
 *   2. Slot-level: accepted completions → missed when accept-to-submit window passes
 */
export async function runExpireJobs(): Promise<{
  cancelled: number;
  completed: number;
  slotsReleased: number;
}> {
  const db = createServerClient();
  const now = Date.now();

  // ── Pass 1: job-level deadline expiry ─────────────────────────────────────
  const { data: activeJobs, error: fetchErr } = await db
    .from("jobs")
    .select("id, status, created_at, deadline_hours, deadline_override, client_id, title, is_agent_job")
    .in("status", ["open", "in_progress"]);

  if (fetchErr) throw new Error(fetchErr.message);

  const toCancel: string[]   = [];
  const toComplete: string[] = [];

  for (const job of (activeJobs ?? []) as JobRow[]) {
    const expiresAt = job.deadline_override
      ? new Date(job.deadline_override).getTime()
      : new Date(job.created_at).getTime() + (job.deadline_hours ?? 48) * 3_600_000;
    if (expiresAt > now) continue;
    if (job.status === "open")        toCancel.push(job.id);
    if (job.status === "in_progress") toComplete.push(job.id);
  }

  // For open jobs that expired: check if any creators already completed their slots.
  // If so, the job should be marked completed (not cancelled) so those creators get paid.
  const trueCancel:   string[] = [];
  const partialDone:  string[] = [];

  if (toCancel.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: doneSlots } = await (db as any)
      .from("job_completions")
      .select("job_id")
      .in("job_id", toCancel)
      .eq("status", "completed");
    const jobsWithWork = new Set(((doneSlots ?? []) as { job_id: string }[]).map((r) => r.job_id));
    for (const id of toCancel) {
      if (jobsWithWork.has(id)) partialDone.push(id);
      else                      trueCancel.push(id);
    }
  }

  // Cancel jobs with zero completed work
  if (trueCancel.length) {
    await db.from("jobs")
      .update({ status: "cancelled", cancel_reason: "expired_no_creator" })
      .in("id", trueCancel);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("job_completions")
      .update({ status: "missed" })
      .in("job_id", trueCancel)
      .eq("status", "accepted");
    const notifs = (activeJobs as JobRow[])
      .filter((j) => trueCancel.includes(j.id) && j.client_id && !j.is_agent_job)
      .map((j) => ({
        user_id: j.client_id!,
        job_id:  j.id,
        message: `Your job "${j.title}" expired — no creator accepted in time.`,
      }));
    if (notifs.length) try { await db.from("notifications").insert(notifs); } catch {}
  }

  // Complete jobs where some creators finished work even though not all slots were filled
  if (partialDone.length) {
    const completedAt = new Date().toISOString();
    await db.from("jobs")
      .update({ status: "completed", completed_at: completedAt })
      .in("id", partialDone);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("job_completions")
      .update({ status: "missed" })
      .in("job_id", partialDone)
      .eq("status", "accepted");
    const notifs = (activeJobs as JobRow[])
      .filter((j) => partialDone.includes(j.id) && j.client_id && !j.is_agent_job)
      .map((j) => ({
        user_id: j.client_id!,
        job_id:  j.id,
        message: `Your job "${j.title}" reached its deadline — it's been completed with the creators who submitted in time.`,
      }));
    if (notifs.length) try { await db.from("notifications").insert(notifs); } catch {}
  }

  // toComplete = jobs that were already in_progress when deadline passed (all slots filled)
  if (toComplete.length) {
    const completedAt = new Date().toISOString();
    await db.from("jobs")
      .update({ status: "completed", completed_at: completedAt })
      .in("id", toComplete);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("job_completions")
      .update({ status: "missed" })
      .in("job_id", toComplete)
      .eq("status", "accepted");
    const notifs = (activeJobs as JobRow[])
      .filter((j) => toComplete.includes(j.id) && j.client_id && !j.is_agent_job)
      .map((j) => ({
        user_id: j.client_id!,
        job_id:  j.id,
        message: `Your job "${j.title}" reached its deadline and has been marked completed.`,
      }));
    if (notifs.length) try { await db.from("notifications").insert(notifs); } catch {}
  }

  // ── Pass 2: slot-level accept-to-submit window ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staleRaw } = await (db as any)
    .from("job_completions")
    .select("id, job_id, creator_id, created_at, jobs(type, max_creators, slots_taken, status)")
    .eq("status", "accepted");

  type StaleRow = {
    id: string;
    job_id: string;
    creator_id: string;
    created_at: string;
    jobs: { type: string; max_creators: number; slots_taken: number; status: string } | null;
  };

  // Jobs already handled in pass 1 — skip them in pass 2
  const handledInPass1 = new Set([...trueCancel, ...partialDone, ...toComplete]);

  const stale = ((staleRaw ?? []) as StaleRow[]).filter((c) => {
    if (!c.jobs) return false;
    // Skip if the parent job was already handled in pass 1 (just completed/cancelled)
    if (handledInPass1.has(c.job_id)) return false;
    const window = ACCEPT_WINDOW_MS[c.jobs.type] ?? 24 * 3_600_000;
    return new Date(c.created_at).getTime() + window < now;
  });

  let slotsReleased = 0;

  if (stale.length > 0) {
    // Mark stale completions as missed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("job_completions")
      .update({ status: "missed" })
      .in("id", stale.map((c) => c.id));

    // Restore slots — group by job_id to handle multiple stale completions per job
    const byJob = new Map<string, StaleRow[]>();
    for (const c of stale) {
      if (!byJob.has(c.job_id)) byJob.set(c.job_id, []);
      byJob.get(c.job_id)!.push(c);
    }

    for (const [jobId, rows] of byJob.entries()) {
      const job = rows[0].jobs!;
      // Only adjust jobs still active (not already completed/cancelled)
      if (!["open", "in_progress"].includes(job.status)) continue;
      const newSlots  = Math.max(0, job.slots_taken - rows.length);
      // If all slots were taken (in_progress) but now have room, re-open
      const newStatus = job.status === "in_progress" && newSlots < job.max_creators
        ? "open"
        : job.status;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from("jobs")
        .update({ slots_taken: newSlots, status: newStatus })
        .eq("id", jobId);
    }

    slotsReleased = stale.length;

    // Notify affected creators
    const creatorNotifs = stale.map((c) => ({
      user_id: c.creator_id,
      job_id:  c.job_id,
      message: "Your slot was released because proof wasn't submitted within the required time. The job is now open for others.",
    }));
    if (creatorNotifs.length) try { await db.from("notifications").insert(creatorNotifs); } catch {}
  }

  return { cancelled: trueCancel.length, completed: toComplete.length + partialDone.length, slotsReleased };
}
