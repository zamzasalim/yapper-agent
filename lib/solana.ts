import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
export const connection = new Connection(SOLANA_RPC, "confirmed");

// USDC on Solana mainnet
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Platform wallet (receives nothing — 100% goes to creator)
export const PLATFORM_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_PLATFORM_WALLET ?? "11111111111111111111111111111111"
);

export function lamportsToSol(lamports: number) {
  return lamports / 1e9;
}

export function usdcToRaw(usdc: number) {
  return Math.floor(usdc * 1e6); // USDC has 6 decimals
}

/**
 * Build a USDC transfer transaction from sender to recipient.
 * No fee deducted — 100% goes to recipient.
 */
export async function buildUsdcTransfer(
  senderPubkey: PublicKey,
  recipientPubkey: PublicKey,
  amountUsdc: number
): Promise<Transaction> {
  const amount = usdcToRaw(amountUsdc);

  const fromATA = await getAssociatedTokenAddress(USDC_MINT, senderPubkey);
  const toATA = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

  const tx = new Transaction().add(
    createTransferInstruction(
      fromATA,
      toATA,
      senderPubkey,
      amount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = senderPubkey;

  return tx;
}

/**
 * Price tier based on follower count.
 */
export function getPriceTier(followers: number): number {
  if (followers < 1000) return 5;
  if (followers < 10000) return 10;
  return -1; // "rate applied" — custom quote
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
