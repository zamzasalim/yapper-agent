import { NextResponse } from "next/server";
import { getVaultPDA } from "@/lib/contract";
import { YAPPER_CANTON_PARTY, CANTON_CC_CURRENCY } from "@/lib/canton";

const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "https://yapperagent.xyz";
const VAULT_ADDRESS  = getVaultPDA().toBase58();
const USDC_MINT      = process.env.NEXT_PUBLIC_USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet" ? "solana-devnet" : "solana-mainnet";

/** GET /.well-known/x402 — x402 protocol discovery */
export async function GET() {
  return NextResponse.json({
    x402Version: 1,
    appUrl: APP_URL,
    endpoints: [
      {
        path:        "/agent/jobs",
        method:      "POST",
        description: "Post a job for humans to complete on Yapper Agent (X engagement, content creation). Payment in USDC on Solana.",
        // maxAmountRequired is in micro-USDC (6 decimals). price_usdc can be set higher.
        pricingByType: {
          repost:     { maxAmountRequired: "500000",  usd: "$0.50",      note: "fixed" },
          like_reply: { maxAmountRequired: "200000",  usd: "$0.20",      note: "fixed" },
          content:    { maxAmountRequired: "5000000", usd: "from $5.00", note: "set price_usdc to override" },
          campaign:   { maxAmountRequired: "5000000", usd: "from $5.00", note: "set price_usdc to override" },
          custom:     { maxAmountRequired: "0",       usd: "free",       note: "goes to admin approval queue" },
        },
        accepts: [
          {
            scheme:            "exact",
            network:           SOLANA_NETWORK,
            asset:             USDC_MINT,
            payTo:             VAULT_ADDRESS,
            maxTimeoutSeconds: 300,
            extra:             { name: "USDC", version: "1" },
          },
        ],
      },
      {
        path:        "/agent/canton-jobs",
        method:      "POST",
        description: "Post a job paid with CC on Canton Network (Amulet). Same job types as /agent/jobs. 402 includes live CC amount (USDC equivalent converted via CoinMarketCap price, ceiling-rounded to 0.1 CC).",
        pricingByType: {
          repost:     { usd: "$0.50",      note: "fixed USDC equivalent, converted to CC at request time" },
          like_reply: { usd: "$0.20",      note: "fixed USDC equivalent, converted to CC at request time" },
          content:    { usd: "from $5.00", note: "set price_usdc to override" },
          campaign:   { usd: "from $5.00", note: "set price_usdc to override" },
          custom:     { usd: "free",       note: "goes to admin approval queue, no CC required" },
        },
        accepts: [
          {
            scheme:            "exact",
            network:           "canton-mainnet",
            asset:             CANTON_CC_CURRENCY,
            payTo:             YAPPER_CANTON_PARTY,
            maxTimeoutSeconds: 300,
            extra: {
              name:          "CC",
              version:       "1",
              lighthouseUrl: "https://lighthouse.cantonloop.com/api",
              paymentHeader: "base64({\"canton_tx_hash\":\"<hash>\"})",
            },
          },
        ],
      },
    ],
  });
}
