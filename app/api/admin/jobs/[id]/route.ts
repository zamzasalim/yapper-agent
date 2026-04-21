import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

const ADMINS = ["Autosultan_team", "0xhnfdm"];

function isAdmin(handle: string) {
  return ADMINS.some((a) => a.toLowerCase() === handle.toLowerCase());
}

/** PATCH /api/admin/jobs/[id]?admin_handle=xxx  body: { hidden: boolean } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin_handle = req.nextUrl.searchParams.get("admin_handle");
    if (!admin_handle || !isAdmin(admin_handle)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const body = await req.json();
    const db = createServerClient();

    const patch: Record<string, unknown> = {};
    if (typeof body.hidden        === "boolean")   patch.is_hidden         = body.hidden;
    if (typeof body.is_paid       === "boolean")   patch.is_paid           = body.is_paid;
    if (typeof body.status        === "string")    patch.status            = body.status;
    if (typeof body.cancel_reason === "string")    patch.cancel_reason     = body.cancel_reason;
    if (body.deadline_override    !== undefined)   patch.deadline_override = body.deadline_override ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.from("jobs").update(patch as any).eq("id", id).select().single());

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin_handle = req.nextUrl.searchParams.get("admin_handle");

    if (!admin_handle) {
      return NextResponse.json({ error: "admin_handle required" }, { status: 400 });
    }

    if (!isAdmin(admin_handle)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const db = createServerClient();
    const { error } = await db.from("jobs").delete().eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
