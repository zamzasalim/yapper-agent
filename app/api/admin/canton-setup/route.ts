import { NextRequest, NextResponse } from "next/server";
import { ADMINS } from "@/lib/admins";
import { createParty } from "@/lib/canton";

/**
 * POST /api/admin/canton-setup
 * One-shot: create the Yapper platform party on Canton ledger.
 * Copy the returned partyId into NEXT_PUBLIC_YAPPER_CANTON_PARTY_ID in .env.local
 *
 * Requires CANTON_LEDGER_URL + CANTON_LEDGER_TOKEN to be set first.
 *
 * Body: { admin_handle: string, hint?: string }
 * Default hint: "Yapper"
 */
export async function POST(req: NextRequest) {
  try {
    const { admin_handle, hint } = await req.json();

    if (!ADMINS.some((a) => a.toLowerCase() === (admin_handle ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const partyIdHint = (hint as string | undefined) ?? "Yapper";
    const partyId = await createParty(partyIdHint);

    if (!partyId) {
      return NextResponse.json(
        {
          error: "Failed to create party. Ensure CANTON_LEDGER_URL and CANTON_LEDGER_TOKEN are set correctly.",
          hint: "Check server logs for details from the Canton Ledger API.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      partyId,
      hint: partyIdHint,
      next: `Set NEXT_PUBLIC_YAPPER_CANTON_PARTY_ID=${partyId} in .env.local and restart the server.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
