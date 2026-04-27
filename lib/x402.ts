import { connection } from "@/lib/solana";
import { getStatePDA, getVaultPDA } from "@/lib/contract";

const USDC_MINT_STR   = process.env.NEXT_PUBLIC_USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const VAULT_OWNER_STR = getStatePDA().toBase58();
const VAULT_ADDRESS   = getVaultPDA().toBase58();
const SOLANA_NETWORK  = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet" ? "solana-devnet" : "solana-mainnet";

/** Minimum job prices in USDC — agents can always specify higher via price_usdc. */
export const JOB_PRICES_USDC: Record<string, number> = {
  repost:     0.50,
  like_reply: 0.20,
  content:    5.00,
  campaign:   5.00,
  custom:     0,     // free — goes to pending_approval
};

export function requiredUsdc(type: string, price_usdc?: number): number {
  const min = JOB_PRICES_USDC[type] ?? 0;
  return price_usdc && price_usdc > 0 ? price_usdc : min;
}

/**
 * Decode X-Payment header.
 * Accepts:
 *   - base64({"tx_hash":"..."}) — simplified
 *   - base64({"payload":{"signature":"..."}}) — x402 standard
 *   - raw Solana base58 signature string
 */
export function parsePaymentHeader(header: string): { tx_hash: string } | null {
  try {
    const json = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
    if (typeof json.tx_hash === "string")            return { tx_hash: json.tx_hash };
    if (typeof json.payload?.signature === "string") return { tx_hash: json.payload.signature };
  } catch {}
  // Raw base58 Solana signature (87–88 chars, base58 alphabet)
  if (header.length >= 80 && header.length <= 100 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(header)) {
    return { tx_hash: header };
  }
  return null;
}

/** Verify a Solana USDC payment to the platform wallet. Returns `payer` (fee payer address) on success. */
export async function verifyX402Payment(
  txHash: string,
  expectedUsdc: number
): Promise<{ valid: boolean; error?: string; payer?: string }> {
  try {
    const tx = await connection.getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx)                  return { valid: false, error: "Transaction not found. Wait for confirmation and retry." };
    if (tx.meta?.err !== null) return { valid: false, error: "Transaction failed on-chain." };

    // Fee payer = first account key (the wallet that signed and sent the tx)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payer: string | undefined = (tx.transaction.message.accountKeys[0] as any)?.pubkey?.toString();

    const pre  = tx.meta?.preTokenBalances?.find(b => b.mint === USDC_MINT_STR && b.owner === VAULT_OWNER_STR);
    const post = tx.meta?.postTokenBalances?.find(b => b.mint === USDC_MINT_STR && b.owner === VAULT_OWNER_STR);
    const delta = (post?.uiTokenAmount?.uiAmount ?? 0) - (pre?.uiTokenAmount?.uiAmount ?? 0);

    if (delta < expectedUsdc - 0.001) {
      return { valid: false, error: `Insufficient payment: received $${delta.toFixed(2)}, required $${expectedUsdc.toFixed(2)} USDC.` };
    }
    return { valid: true, payer };
  } catch {
    return { valid: false, error: "Failed to verify transaction. Please retry." };
  }
}

/** Build a 402 response body per the x402 spec. */
export function x402Body(resource: string, amountUsdc: number, description: string) {
  return {
    x402Version: 1,
    error: "Payment required",
    accepts: [
      {
        scheme:            "exact",
        network:           SOLANA_NETWORK,
        asset:             USDC_MINT_STR,
        payTo:             VAULT_ADDRESS,
        maxAmountRequired: String(Math.round(amountUsdc * 1_000_000)),
        resource,
        description,
        mimeType:          "application/json",
        maxTimeoutSeconds: 300,
        extra:             { name: "USDC", version: "1" },
      },
    ],
  };
}
