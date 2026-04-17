import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { createServerClient } from "@/lib/supabase";

const USDC_MINT_STR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PLATFORM_WALLET_STR =
  process.env.NEXT_PUBLIC_PLATFORM_WALLET ?? "CzQZDvbjHHZDXxDeGUX2KTorQhiZnJvt6z6V2QtfMDU2";
const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

/**
 * POST /api/verify-payment
 * Body: { tx_hash: string, expected_usdc: number }
 *
 * Verifies that a Solana transaction:
 * 1. Is confirmed and succeeded
 * 2. Transferred at least `expected_usdc` USDC to the platform wallet
 * 3. Has not been used for another job already
 */
export async function POST(req: NextRequest) {
  try {
    const { tx_hash, expected_usdc } = await req.json();

    if (!tx_hash || typeof tx_hash !== "string" || tx_hash.trim().length < 10) {
      return NextResponse.json({ error: "Valid tx_hash required." }, { status: 400 });
    }
    if (typeof expected_usdc !== "number" || expected_usdc <= 0) {
      return NextResponse.json({ error: "expected_usdc must be a positive number." }, { status: 400 });
    }

    const txSig = tx_hash.trim();

    // 1. Prevent TX reuse
    const db = createServerClient();
    const { data: existing } = await db
      .from("jobs")
      .select("id")
      .eq("tx_hash", txSig)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "This transaction has already been used for another job." },
        { status: 409 }
      );
    }

    // 2. Fetch transaction from Solana
    const connection = new Connection(SOLANA_RPC, "confirmed");
    let tx;
    try {
      tx = await connection.getParsedTransaction(txSig, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch transaction from Solana. Please try again." },
        { status: 502 }
      );
    }

    if (!tx) {
      return NextResponse.json(
        { error: "Transaction not found. Wait for confirmation and try again." },
        { status: 404 }
      );
    }

    if (tx.meta?.err !== null) {
      return NextResponse.json(
        { error: "Transaction failed on-chain. Please send again." },
        { status: 400 }
      );
    }

    // 3. Check USDC balance delta on platform wallet using token balance snapshots.
    //    preTokenBalances / postTokenBalances contain per-account token state before/after.
    const pre = tx.meta?.preTokenBalances?.find(
      (b) => b.mint === USDC_MINT_STR && b.owner === PLATFORM_WALLET_STR
    );
    const post = tx.meta?.postTokenBalances?.find(
      (b) => b.mint === USDC_MINT_STR && b.owner === PLATFORM_WALLET_STR
    );

    const preAmt  = pre?.uiTokenAmount?.uiAmount  ?? 0;
    const postAmt = post?.uiTokenAmount?.uiAmount ?? 0;
    const delta   = postAmt - preAmt;

    // Allow 0.001 USDC floating-point tolerance
    if (delta < expected_usdc - 0.001) {
      return NextResponse.json(
        {
          error: `USDC received ($${delta.toFixed(2)}) is less than the required amount ($${expected_usdc.toFixed(2)}). Please send the exact amount.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true, received_usdc: parseFloat(delta.toFixed(6)) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
