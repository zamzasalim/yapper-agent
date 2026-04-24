import { NextResponse } from "next/server";

const APP_URL         = process.env.NEXT_PUBLIC_APP_URL ?? "https://yapper-agent.vercel.app";
const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET ?? "CzQZDvbjHHZDXxDeGUX2KTorQhiZnJvt6z6V2QtfMDU2";
const USDC_MINT       = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** GET /.well-known/x402 — x402 protocol discovery */
export async function GET() {
  return NextResponse.json({
    x402Version: 1,
    appUrl: APP_URL,
    endpoints: [
      {
        path:        "/api/agent/jobs",
        method:      "POST",
        description: "Post a job for humans to complete on Yapper Agent (X engagement, content creation).",
        pricing: {
          repost:     "$0.50 USDC",
          like_reply: "$0.20 USDC",
          content:    "from $5.00 USDC (specify price_usdc)",
          campaign:   "from $5.00 USDC (specify price_usdc)",
          custom:     "free — goes to admin approval queue",
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
