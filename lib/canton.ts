/**
 * lib/canton.ts — Server-side Canton Network utilities
 *
 * Two distinct APIs:
 *   1. Lighthouse API  (public, no auth)  — verify CC transfer by tx hash
 *   2. Canton JSON Ledger API (JWT auth)  — DAML contract create / exercise
 *      Docs: https://docs.daml.com/json-api/
 *
 * JSON Ledger API command format (POST /v2/commands/submit-and-wait):
 *   { commands, userId, commandId, actAs, readAs }
 */

// Lighthouse (mainnet) or hackathon devnet Scan API — configurable via env
const LIGHTHOUSE_URL  = process.env.CANTON_SCAN_URL ?? "https://lighthouse.cantonloop.com/api";
const LEDGER_URL      = process.env.CANTON_LEDGER_URL;
const LEDGER_USER_ID  = process.env.CANTON_LEDGER_USER_ID ?? "yapper-agent";
// Validator wallet API — for actual CC transfers. Defaults to same host as CANTON_SCAN_URL
// (on the hackathon devnet the validator and scan APIs share the same base URL).
const VALIDATOR_URL   = process.env.CANTON_VALIDATOR_URL ?? process.env.CANTON_SCAN_URL;

// ── Auto-refreshing token ─────────────────────────────────────────────────────
// Keycloak password grant credentials. If set, token is refreshed automatically
// when it expires — no manual .env.local update or GitHub Actions cron needed.
const KC_URL      = process.env.CANTON_KEYCLOAK_URL
  ?? "https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token";
const KC_CLIENT   = process.env.CANTON_KEYCLOAK_CLIENT ?? "web-app-ui-hackcanton-01-devnet";
const KC_USER     = process.env.CANTON_KEYCLOAK_USER;
const KC_PASS     = process.env.CANTON_KEYCLOAK_PASS;

let _cachedToken: string | null = process.env.CANTON_LEDGER_TOKEN ?? null;
let _tokenExpAt  = 0; // Unix seconds

/** Decode JWT exp claim without external libs */
function jwtExp(token: string): number {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as { exp?: number };
    return decoded.exp ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Returns a valid Canton bearer token.
 * If CANTON_KEYCLOAK_USER + CANTON_KEYCLOAK_PASS are set, automatically refreshes
 * the token when it is within 5 minutes of expiry — no manual rotation needed.
 * Falls back to the static CANTON_LEDGER_TOKEN env var if credentials are absent.
 */
async function getToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);

  // Initialise expiry from cached token on first call
  if (_cachedToken && _tokenExpAt === 0) {
    _tokenExpAt = jwtExp(_cachedToken);
  }

  // Still valid with >5 min buffer
  if (_cachedToken && _tokenExpAt > now + 300) return _cachedToken;

  // Refresh if credentials are available
  if (KC_USER && KC_PASS) {
    try {
      const res = await fetch(KC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    new URLSearchParams({
          grant_type: "password",
          client_id:  KC_CLIENT,
          username:   KC_USER,
          password:   KC_PASS,
        }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json() as { access_token?: string };
        if (data.access_token) {
          _cachedToken = data.access_token;
          _tokenExpAt  = jwtExp(_cachedToken);
          console.log(`[canton] token refreshed — exp: ${new Date(_tokenExpAt * 1000).toISOString()}`);
          return _cachedToken;
        }
      } else {
        console.error("[canton] token refresh failed:", res.status);
      }
    } catch (e) {
      console.error("[canton] token refresh error:", e);
    }
  }

  // Fall back to whatever is cached (may be expired — caller will get 401)
  return _cachedToken;
}

// Package ID / alias used in templateId references.
// Set to the package hash after `dpm build` + deploy, e.g.
//   "6fd1d46124d5ab0c958ce35e9bb370bb2835b2672a0d6fa039a3855c11b8801d"
// Or use "#<package-name>" alias format for local sandbox, e.g. "#job-escrow"
const PACKAGE_ID = process.env.CANTON_PACKAGE_ID ?? "#job-escrow";

/** Internal name for CC in the Canton Ledger / Lighthouse API. */
export const CANTON_CC_CURRENCY = "Amulet";

/**
 * The platform's own Canton party ID — used as escrow recipient.
 * Falls back to NEXT_PUBLIC_ so only one env var is needed in .env.local.
 */
export const YAPPER_CANTON_PARTY =
  process.env.YAPPER_CANTON_PARTY_ID ??
  process.env.NEXT_PUBLIC_YAPPER_CANTON_PARTY_ID ??
  "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LighthouseEvent {
  choice_argument: {
    sender:   string;
    receiver: string;
    amount:   string;
    currency: string;
  };
}

interface LighthouseTx {
  events:  Record<string, LighthouseEvent>;
  verdict: { verdict_result: string };
}

export interface VerifyResult {
  valid:   boolean;
  sender?: string;
  amount?: number;
}

export interface ClaimInput {
  contractId:     string;
  creatorPartyId: string;
  amount:         number;
}

export interface ClaimResult {
  contractId: string;
  updateId:   string | null;
  error:      string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ledgerHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${await getToken() ?? ""}`,
  };
}

/** Build templateId: "<PACKAGE_ID>:Module:Template" */
function tid(module: string, template: string) {
  return `${PACKAGE_ID}:${module}:${template}`;
}

/**
 * Build JSON Ledger API command body.
 * Matches the format from Canton get-started docs:
 *   { commands, userId, commandId, actAs, readAs }
 */
function cmdBody(
  actAs:     string[],
  commands:  unknown[],
  commandId: string,
) {
  return { commands, userId: LEDGER_USER_ID, commandId, actAs, readAs: actAs };
}

/**
 * Recursively search a parsed JSON value for the first string value
 * associated with `key`. Used to extract contractId from ACS responses
 * regardless of the exact nesting shape.
 */
function findField(obj: unknown, key: string): string | undefined {
  if (obj === null || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = findField(item, key);
      if (r !== undefined) return r;
    }
    return undefined;
  }
  const rec = obj as Record<string, unknown>;
  if (typeof rec[key] === "string") return rec[key] as string;
  for (const v of Object.values(rec)) {
    const r = findField(v, key);
    if (r !== undefined) return r;
  }
  return undefined;
}

// ── 1. Lighthouse / Scan API — verify a CC transfer ──────────────────────────

const IS_DEVNET = (process.env.NEXT_PUBLIC_CANTON_NETWORK ?? "canton-mainnet") !== "canton-mainnet";

/**
 * Verify that a Canton CC transfer:
 *   - verdict accepted
 *   - receiver = YAPPER_CANTON_PARTY
 *   - currency = Amulet
 *   - amount >= expectedAmountCC
 *
 * On devnet (NEXT_PUBLIC_CANTON_NETWORK !== "canton-mainnet"):
 *   If the scan API is unavailable (wrong path / 404 / timeout), the tx hash
 *   is trusted optimistically. DAML contract creation provides the audit trail.
 *   Set CANTON_SCAN_URL to a working scan endpoint when available.
 */
export async function verifyCantonTransfer(
  txHash:           string,
  expectedAmountCC: number,
): Promise<VerifyResult> {
  if (!txHash || !YAPPER_CANTON_PARTY) return { valid: false };

  // Try scan/lighthouse paths in order
  const scanPaths = [
    `/transactions/${txHash}`,
    `/api/scan/v0/updates/${txHash}`,
    `/api/scan/v0/transfer/${txHash}`,
  ];

  for (const path of scanPaths) {
    try {
      const res = await fetch(`${LIGHTHOUSE_URL}${path}`, { cache: "no-store" });
      if (!res.ok) continue;

      const data: LighthouseTx = await res.json();
      if (data.verdict?.verdict_result !== "accepted") continue;

      const event = Object.values(data.events ?? {})[0];
      if (!event) continue;

      const arg      = event.choice_argument;
      const amount   = parseFloat(arg?.amount ?? "0");
      const receiver = arg?.receiver ?? "";
      const currency = arg?.currency ?? "";

      if (
        receiver !== YAPPER_CANTON_PARTY ||
        currency !== CANTON_CC_CURRENCY  ||
        amount   <  expectedAmountCC
      ) {
        return { valid: false };
      }

      return { valid: true, sender: arg.sender, amount };
    } catch {
      continue;
    }
  }

  // All paths failed — on devnet, trust the tx hash optimistically
  if (IS_DEVNET) {
    console.warn(`[canton] verifyCantonTransfer: scan API unreachable for ${txHash}, bypassing on devnet`);
    return { valid: true, amount: expectedAmountCC };
  }

  return { valid: false };
}

// ── 2. Canton Ledger API — DAML contract operations ──────────────────────────

/**
 * Query ACS at a given ledger offset and return the contractId of the
 * JobEscrow contract whose createArgument.jobId matches the given jobId.
 *
 * Step 2 of createJobEscrow — called after submit-and-wait returns completionOffset.
 */
async function findJobEscrowContractId(
  jobId:            string,
  completionOffset: number,
): Promise<string | null> {
  try {
    const res = await fetch(`${LEDGER_URL}/v2/state/active-contracts`, {
      method:  "POST",
      headers: await ledgerHeaders(),
      body:    JSON.stringify({
        eventFormat: {
          filtersByParty: {
            [YAPPER_CANTON_PARTY]: {
              cumulative: [{
                identifierFilter: {
                  WildcardFilter: { value: { includeCreatedEventBlob: true } },
                },
              }],
            },
          },
          verbose: true,
        },
        activeAtOffset: completionOffset,
      }),
    });

    if (!res.ok) return null;

    // Response may be a single JSON object or newline-delimited JSON stream
    const text = await res.text();
    const lines = text.split("\n").filter(Boolean);
    const docs: unknown[] = lines.map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    // Also try parsing the full text as one JSON doc
    try { docs.push(JSON.parse(text)); } catch { /* already parsed as lines */ }

    // Find the event whose createArgument.jobId matches
    for (const doc of docs) {
      // Walk the tree to find a createdEvent that has our jobId
      const allText = JSON.stringify(doc);
      if (!allText.includes(jobId)) continue;

      const contractId = findField(doc, "contractId");
      if (contractId) return contractId;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create a JobEscrow DAML contract on the Canton ledger.
 * Returns the contractId on success; null on failure (job still proceeds).
 *
 * Flow (per Canton get-started docs):
 *   1. POST /v2/commands/submit-and-wait  → { completionOffset }
 *   2. POST /v2/state/active-contracts    → find contractId by jobId
 *
 * @param jobId       - Yapper job UUID stored in the contract for lookup
 * @param clientParty - client's canton_party_id (observer); falls back to platform party
 * @param amountCC    - CC amount the escrow represents
 */
export async function createJobEscrow(
  jobId:       string,
  clientParty: string | null,
  amountCC:    number,
): Promise<string | null> {
  if (!LEDGER_URL || !YAPPER_CANTON_PARTY) return null;

  try {
    const res = await fetch(`${LEDGER_URL}/v2/commands/submit-and-wait`, {
      method:  "POST",
      headers: await ledgerHeaders(),
      body:    JSON.stringify(
        cmdBody(
          [YAPPER_CANTON_PARTY],
          [{
            CreateCommand: {
              templateId: tid("JobEscrow", "JobEscrow"),
              createArguments: {
                admin:  YAPPER_CANTON_PARTY,
                client: clientParty ?? YAPPER_CANTON_PARTY,
                jobId,
                amount: amountCC.toFixed(10),
              },
            },
          }],
          `create-escrow-${jobId}`,
        ),
      ),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      console.error(`[canton] createJobEscrow failed for ${jobId}:`, err.message ?? res.status);
      return null;
    }

    const { completionOffset } = await res.json() as { completionOffset?: number };
    if (completionOffset === undefined) return null;

    return await findJobEscrowContractId(jobId, completionOffset);
  } catch (err) {
    console.error("[canton] createJobEscrow exception:", err);
    return null;
  }
}

/**
 * Exercise ClaimReward on each JobEscrow contract.
 * Returns one ClaimResult per claim — fault-tolerant (never throws).
 * Failed claims are recorded in result.error so the caller can report them
 * without blocking payment of successful claims.
 */
export async function exerciseBatchClaim(claims: ClaimInput[]): Promise<ClaimResult[]> {
  if (!LEDGER_URL) {
    return claims.map((c) => ({ contractId: c.contractId, updateId: null, error: "Canton Ledger API not configured (CANTON_LEDGER_URL missing)" }));
  }

  const results: ClaimResult[] = [];

  for (const claim of claims) {
    try {
      const res = await fetch(`${LEDGER_URL}/v2/commands/submit-and-wait`, {
        method:  "POST",
        headers: await ledgerHeaders(),
        body:    JSON.stringify(
          cmdBody(
            [YAPPER_CANTON_PARTY],
            [{
              ExerciseCommand: {
                templateId:     tid("JobEscrow", "JobEscrow"),
                contractId:     claim.contractId,
                choice:         "ClaimReward",
                choiceArgument: {
                  creator:     claim.creatorPartyId,
                  claimAmount: claim.amount.toFixed(10),
                },
              },
            }],
            `claim-reward-${claim.contractId}`,
          ),
        ),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        results.push({ contractId: claim.contractId, updateId: null, error: err.message ?? String(res.status) });
        continue;
      }

      const data = await res.json() as { updateId?: string };
      results.push({ contractId: claim.contractId, updateId: data.updateId ?? claim.contractId, error: null });
    } catch (e) {
      results.push({ contractId: claim.contractId, updateId: null, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return results;
}

/**
 * Exercise CancelEscrow — called on job expire or admin cancel for CC jobs.
 */
export async function exerciseCancel(contractId: string): Promise<void> {
  if (!LEDGER_URL) {
    throw new Error("Canton Ledger API not configured (CANTON_LEDGER_URL missing)");
  }

  const res = await fetch(`${LEDGER_URL}/v2/commands/submit-and-wait`, {
    method:  "POST",
    headers: await ledgerHeaders(),
    body:    JSON.stringify(
      cmdBody(
        [YAPPER_CANTON_PARTY],
        [{
          ExerciseCommand: {
            templateId:     tid("JobEscrow", "JobEscrow"),
            contractId,
            choice:         "CancelEscrow",
            choiceArgument: {},
          },
        }],
        `cancel-escrow-${contractId}`,
      ),
    ),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`CancelEscrow failed for ${contractId}: ${err.message ?? res.status}`);
  }
}

/**
 * Look up an active JobEscrow contract by contractId via ACS query.
 */
export async function getEscrowState(
  contractId: string,
): Promise<{ active: boolean; amount: number } | null> {
  if (!LEDGER_URL) return null;

  try {
    const res = await fetch(`${LEDGER_URL}/v2/contracts/${contractId}`, {
      headers: { Authorization: `Bearer ${await getToken() ?? ""}` },
      cache:   "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json() as { contractId?: string; payload?: { amount?: string } };
    return {
      active: !!data.contractId,
      amount: parseFloat(data.payload?.amount ?? "0"),
    };
  } catch {
    return null;
  }
}

/**
 * Transfer CC from the platform's validator wallet to a recipient party.
 * Uses the Canton validator wallet API (splice-amulet WalletService).
 *
 * Tries several endpoint paths because the hackathon devnet URL layout may
 * differ from the mainnet/canonical splice layout.  Best-effort: returns null
 * on any failure without throwing so callers are never blocked.
 *
 * @param toParty     - Recipient's canton party ID (e.g. "alice::1220ab...")
 * @param amount      - CC amount to send (positive)
 * @param description - Optional memo stored in the transfer
 * @returns Canton transaction/update ID on success, null on failure
 */
export async function transferCC(
  toParty:      string,
  amount:       number,
  description?: string,
): Promise<string | null> {
  if (!VALIDATOR_URL || !toParty || amount <= 0) return null;

  const memo       = description ?? "Yapper job reward";
  // expires_at: Unix timestamp in milliseconds (Long), 30 days from now
  const expiresAt  = Date.now() + 30 * 24 * 3_600_000;
  // tracking_id: unique per offer — used for idempotency
  const trackingId = crypto.randomUUID();

  // Confirmed working endpoint (tested against hackathon devnet):
  //   POST /api/validator/v0/wallet/transfer-offers
  //   Body: { receiver_party_id, amount, description, expires_at (ms Long), tracking_id (UUID) }
  //   Response: { offer_contract_id }
  // Note: creates a Transfer Offer on the Canton ledger — recipient accepts via Loop wallet.
  const attempts: Array<{ url: string }> = [
    { url: `${VALIDATOR_URL}/api/validator/v0/wallet/transfer-offers` },
    { url: `${VALIDATOR_URL}/v0/wallet/transfer-offers` },
  ];

  const body = {
    receiver_party_id: toParty,
    amount:            amount.toFixed(10),
    description:       memo,
    expires_at:        expiresAt,
    tracking_id:       trackingId,
  };

  for (const { url } of attempts) {
    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken() ?? ""}` },
        body:    JSON.stringify(body),
        cache:   "no-store",
      });

      if (res.ok) {
        const data = await res.json() as { offer_contract_id?: string; contract_id?: string; transaction_id?: string };
        const txId = data.offer_contract_id ?? data.contract_id ?? data.transaction_id ?? "ok";
        console.log(`[canton] transferCC offer: ${amount} CC → ${toParty} offer=${txId}`);
        return txId;
      }

      if (res.status === 404) continue;

      const err = await res.json().catch(() => ({})) as { message?: string; error?: string };
      console.error(`[canton] transferCC to ${toParty} (${url}) HTTP ${res.status}:`, err.message ?? err.error ?? "");
      break;
    } catch {
      continue;
    }
  }

  if (IS_DEVNET) {
    console.warn(`[canton] transferCC: validator unreachable — manual transfer needed: ${amount} CC → ${toParty}`);
  }
  return null;
}

/**
 * Create a Canton party via the JSON Ledger API.
 * Run once to obtain YAPPER_CANTON_PARTY_ID for .env.local.
 *
 * curl equivalent (from Canton get-started docs):
 *   curl -d '{"partyIdHint":"Yapper","identityProviderId":""}' \
 *        -H "Content-Type: application/json" \
 *        -X POST <CANTON_LEDGER_URL>/v2/parties
 */
export async function createParty(hint: string): Promise<string | null> {
  if (!LEDGER_URL) {
    console.error("[canton] createParty: CANTON_LEDGER_URL not set");
    return null;
  }

  try {
    const res = await fetch(`${LEDGER_URL}/v2/parties`, {
      method:  "POST",
      headers: await ledgerHeaders(),
      body:    JSON.stringify({ partyIdHint: hint, identityProviderId: "" }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      console.error(`[canton] createParty failed (${res.status}):`, err.message ?? res.statusText);
      return null;
    }

    const data = await res.json() as { partyDetails?: { party?: string } };
    const partyId = data.partyDetails?.party ?? null;
    if (partyId) console.log(`[canton] createParty ok — partyId: ${partyId}`);
    return partyId;
  } catch (err) {
    console.error("[canton] createParty exception:", err);
    return null;
  }
}
