import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { fetchClaimable } from "@/lib/contract";

/**
 * GET /api/user/claimable?wallet=<solana_address>
 * Returns the creator's claimable USDC balance from the escrow contract.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  try {
    const pubkey   = new PublicKey(wallet);
    const claimable = await fetchClaimable(pubkey);
    return NextResponse.json({ claimable_usdc: claimable });
  } catch {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
}
