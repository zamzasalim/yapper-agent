import { NextResponse } from "next/server";
import { getCCPriceUSD } from "@/lib/cc-price";

export const revalidate = 600; // cache the route for 10 minutes

export async function GET() {
  try {
    const price_usd = await getCCPriceUSD();
    return NextResponse.json({ price_usd });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch CC price";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
