import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { creator_handle, wallet, email, discord, telegram } = await req.json();

    const db = createServerClient();

    const additionalInfo = {
      ...(wallet   ? { wallet }   : {}),
      ...(email    ? { email }    : {}),
      ...(discord  ? { discord }  : {}),
      ...(telegram ? { telegram } : {}),
    };

    const { data: creator } = await db
      .from("users")
      .select("id")
      .eq("twitter_handle", creator_handle)
      .maybeSingle();

    if (creator) {
      // Multi-creator: update job_completions if record exists
      const { count } = await db
        .from("job_completions")
        .select("id", { count: "exact", head: true })
        .eq("job_id", id)
        .eq("creator_id", creator.id);

      if ((count ?? 0) > 0) {
        await (db as any)
          .from("job_completions")
          .update({ additional_info: additionalInfo })
          .eq("job_id", id)
          .eq("creator_id", creator.id);
      } else {
        // Single-creator: update jobs table
        await (db as any)
          .from("jobs")
          .update({ additional_info: additionalInfo })
          .eq("id", id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
