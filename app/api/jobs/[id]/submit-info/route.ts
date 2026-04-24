import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { creator_handle, wallet, email, discord, telegram } = await req.json();

    if (!creator_handle) {
      return NextResponse.json({ error: "creator_handle required" }, { status: 400 });
    }

    const db = createServerClient();

    const { data: creator } = await db
      .from("users")
      .select("id")
      .eq("twitter_handle", creator_handle)
      .maybeSingle();

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const additionalInfo = {
      ...(wallet   ? { wallet }   : {}),
      ...(email    ? { email }    : {}),
      ...(discord  ? { discord }  : {}),
      ...(telegram ? { telegram } : {}),
    };

    // Multi-creator: verify completed slot exists
    const { data: completion } = await db
      .from("job_completions")
      .select("id, status")
      .eq("job_id", id)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (completion) {
      if (completion.status !== "completed") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from("job_completions").update({ additional_info: additionalInfo }).eq("id", completion.id);
      return NextResponse.json({ ok: true });
    }

    // Single-creator: verify this creator owns the completed job
    const { data: job } = await db
      .from("jobs")
      .select("creator_id, status")
      .eq("id", id)
      .maybeSingle();

    if (!job || job.creator_id !== creator.id || job.status !== "completed") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("jobs").update({ additional_info: additionalInfo }).eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
