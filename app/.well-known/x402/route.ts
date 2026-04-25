import { NextResponse } from "next/server";

const APP_URL         = process.env.NEXT_PUBLIC_APP_URL ?? "https://yapperagent.xyz";
const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET ?? "CzQZDvbjHHZDXxDeGUX2KTorQhiZnJvt6z6V2QtfMDU2";
const USDC_MINT       = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** GET /.well-known/x402 — x402 protocol discovery */
export async function GET() {
  return NextResponse.json({
    x402Version: 1,
    appUrl: APP_URL,
    endpoints: [
      {
        path:        "/agent/jobs",
        method:      "POST",
        description: "Post a job for humans to complete on Yapper Agent (X engagement, content creation).",
        // Per-type pricing so agents can pre-compute the required amount before hitting 402.
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
            network:           "solana-mainnet",
            asset:             USDC_MINT,
            payTo:             PLATFORM_WALLET,
            maxTimeoutSeconds: 300,
            extra:             { name: "USDC", version: "1" },
          },
        ],
      },
    ],
  });
}
