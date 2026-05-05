import { getCCPriceUSD, usdcToCC } from "@/lib/cc-price";
import { YAPPER_CANTON_PARTY, CANTON_CC_CURRENCY } from "@/lib/canton";

const CANTON_NETWORK   = process.env.NEXT_PUBLIC_CANTON_NETWORK ?? "canton-mainnet";
const LIGHTHOUSE_URL   = process.env.CANTON_SCAN_URL ?? "https://lighthouse.cantonloop.com/api";

/**
 * Compute the CC amount required for a job whose USDC price is `amountUsdc`.
 * Fetches live CC/USD price (CMC, 10-min cache) and rounds up to 1 decimal.
 */
export async function requiredCC(amountUsdc: number): Promise<number> {
  const priceUSD = await getCCPriceUSD();
  return usdcToCC(amountUsdc, priceUSD);
}

/**
 * Decode X-Payment header for Canton CC payments.
 * Accepts:
 *   - base64({"canton_tx_hash":"..."})
 *   - base64({"tx_hash":"..."})  — alias
 *   - raw hex tx hash (≥32 hex chars)
 */
export function parseCantonPaymentHeader(
  header: string,
): { canton_tx_hash: string } | null {
  try {
    const json = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
    if (typeof json.canton_tx_hash === "string") return { canton_tx_hash: json.canton_tx_hash };
    if (typeof json.tx_hash === "string")        return { canton_tx_hash: json.tx_hash };
  } catch {}
  // Raw hex Canton tx hash
  if (header.length >= 32 && /^[a-fA-F0-9]+$/.test(header)) {
    return { canton_tx_hash: header };
  }
  return null;
}

/** Build a 402 response body for Canton CC payment (x402 spec). */
export function canton402Body(
  resource:    string,
  amountCC:    number,
  description: string,
) {
  return {
    x402Version: 1,
    error:       "Payment required",
    accepts: [
      {
        scheme:            "exact",
        network:           CANTON_NETWORK,
        asset:             CANTON_CC_CURRENCY, // "Amulet"
        payTo:             YAPPER_CANTON_PARTY,
        maxAmountRequired: String(amountCC),
        resource,
        description,
        mimeType:          "application/json",
        maxTimeoutSeconds: 300,
        extra: {
          name:         "CC",
          version:      "1",
          lighthouseUrl: LIGHTHOUSE_URL,
          note:         "Send CC to payTo party ID via cantonloop.com or Loop SDK, then retry with X-Payment: base64({\"canton_tx_hash\":\"<hash>\"})",
        },
      },
    ],
  };
}
