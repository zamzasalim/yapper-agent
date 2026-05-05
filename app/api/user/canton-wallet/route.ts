import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/user/canton-wallet
 * Save the user's Canton party ID after Loop wallet connect.
 * Body: { twitter_handle, party_id }
 */
export async function POST(req: NextRequest) {
  try {
    const { twitter_handle, party_id } = await req.json();
    if (!twitter_handle || !party_id) {
      return NextResponse.json({ error: "twitter_handle and party_id required" }, { status: 400 });
    }

    const db = createServerClient();
    const { error } = await db
      .from("users")
      .update({ canton_party_id: party_id } as never)
      .eq("twitter_handle", twitter_handle);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/user/canton-wallet
 * Disconnect Canton wallet — clears canton_party_id.
 * Body: { twitter_handle }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { twitter_handle } = await req.json();
    if (!twitter_handle) {
      return NextResponse.json({ error: "twitter_handle required" }, { status: 400 });
    }

    const db = createServerClient();
    const { error } = await db
      .from("users")
      .update({ canton_party_id: null } as never)
      .eq("twitter_handle", twitter_handle);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
