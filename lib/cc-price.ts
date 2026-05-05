const CMC_CC_ID = 37263;
const PRICE_TTL_MS = 10 * 60 * 1000;

let _price: number | null = null;
let _pricedAt = 0;

/**
 * Fetch CC price in USD from CoinMarketCap.
 * In-memory cache (10 min) + Next.js fetch cache (10 min revalidate).
 */
export async function getCCPriceUSD(): Promise<number> {
  const now = Date.now();
  if (_price !== null && now - _pricedAt < PRICE_TTL_MS) return _price;

  const res = await fetch(
    `https://pro-api.coinmarketcap.com/v1/simple/price?ids=${CMC_CC_ID}`,
    {
      headers: { "x-cmc_pro_api_key": process.env.CMC_API_KEY ?? "" },
      next: { revalidate: 600 },
    },
  );
  if (!res.ok) throw new Error(`CMC API ${res.status}`);

  const json = await res.json();

  // Response: { "data": [{ "id": 37263, "price": 0.1489... }] }
  // Fallback: standard CMC quotes shape { "data": { "37263": { "quote": { "USD": { "price": ... } } } } }
  const price: number | undefined = Array.isArray(json?.data)
    ? json.data[0]?.price
    : json?.data?.[String(CMC_CC_ID)]?.quote?.USD?.price;

  if (typeof price !== "number" || price <= 0) throw new Error("Invalid CC price from CMC");

  _price = price;
  _pricedAt = now;
  return price;
}

/**
 * Convert a USDC amount to CC, ceiling-rounded to 1 decimal place.
 * e.g. usdcToCC(0.50, 0.1489) → 3.4
 */
export function usdcToCC(usdc: number, ccPriceUSD: number): number {
  return Math.ceil((usdc / ccPriceUSD) * 10) / 10;
}
