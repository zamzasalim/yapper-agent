import { Connection } from "@solana/web3.js";

export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
export const connection = new Connection(SOLANA_RPC, "confirmed");

export function getPriceTier(followers: number): number {
  if (followers < 1000)   return 5;   // Nano CT
  if (followers < 10000)  return 25;  // Small CT
  if (followers < 50000)  return 50;  // Big CT
  return -1;                           // Super CT — custom quote
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
