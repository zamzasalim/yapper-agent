/**
 * ScrapeBadger Twitter API helper.
 * Fetches a user's live follower count and blue-verified status by handle.
 */
export async function fetchTwitterUserStats(
  handle: string
): Promise<{ followers: number; is_verified_blue: boolean; name?: string; avatar_url?: string } | null> {
  const apiKey = process.env.SCRAPEBADGER_API_KEY ?? "";
  if (!apiKey || !handle) return null;
  try {
    const res = await fetch(
      `https://scrapebadger.com/v1/twitter/users/${encodeURIComponent(handle)}/by_username`,
      { headers: { "x-api-key": apiKey } }
    );
    if (!res.ok) return null;
    const json = await res.json();

    // response shape: root object, { data: {...} }, or { data: [{...}] }
    let user = json;
    if (json.data !== undefined) {
      user = Array.isArray(json.data) ? json.data[0] : json.data;
    }
    if (!user) return null;

    const followers: number = user.followers_count ?? user.public_metrics?.followers_count ?? user.follower_count ?? user.followers ?? 0;
    const is_verified_blue: boolean = user.is_blue_verified ?? user.verified ?? false;

    // Use higher-res avatar (_normal → _400x400)
    const raw_avatar: string | undefined = user.profile_image_url;
    const avatar_url = raw_avatar ? raw_avatar.replace("_normal.", "_400x400.") : undefined;

    return { followers, is_verified_blue, name: user.name ?? undefined, avatar_url };
  } catch {
    return null;
  }
}

// ── Retweeters cache ──────────────────────────────────────────────────────────
// Module-level cache per tweet_id. Persists across requests within the same
// serverless function instance (warm invocations). Falls back to API on cold start.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface RetweetersEntry {
  handles: Set<string>; // lowercase
  fetchedAt: number;
}

const retweetersCache = new Map<string, RetweetersEntry>();

function getCacheEntry(tweetId: string): Set<string> | null {
  const entry = retweetersCache.get(tweetId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    retweetersCache.delete(tweetId);
    return null;
  }
  return entry.handles;
}

function mergeIntoCache(tweetId: string, usernames: string[]) {
  const existing = retweetersCache.get(tweetId);
  if (existing) {
    usernames.forEach((u) => existing.handles.add(u.toLowerCase()));
  } else {
    retweetersCache.set(tweetId, {
      handles: new Set(usernames.map((u) => u.toLowerCase())),
      fetchedAt: Date.now(),
    });
  }
}

/**
 * Check if `handle` has retweeted `tweetId`.
 *
 * Flow:
 * 1. Check in-memory cache — if found, return immediately (no API call).
 * 2. Cache miss or handle not found → fetch retweeters from ScrapeBadger,
 *    merge results into cache, then re-check.
 * 3. After fetch, cache is populated for subsequent verifications of the
 *    same tweet (other creators benefit from the already-fetched list).
 */
export async function checkRetweeted(tweetId: string, handle: string): Promise<boolean> {
  const lc = handle.toLowerCase();

  // Step 1: cache hit
  const cached = getCacheEntry(tweetId);
  if (cached?.has(lc)) return true;

  // Step 2: fetch from API and merge into cache
  const apiKey = process.env.SCRAPEBADGER_API_KEY ?? "";
  if (!apiKey) return false;

  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const url = new URL(`https://scrapebadger.com/v1/twitter/tweets/tweet/${tweetId}/retweeters`);
    if (cursor) url.searchParams.set("cursor", cursor);
    try {
      const res = await fetch(url.toString(), { headers: { "x-api-key": apiKey } });
      if (!res.ok) return false;
      const json = await res.json();
      const users: Array<{ username: string }> = json.data ?? [];

      // Merge page into cache so future verifications reuse it
      mergeIntoCache(tweetId, users.map((u) => u.username));

      if (users.some((u) => u.username.toLowerCase() === lc)) return true;
      cursor = json.next_cursor;
      if (!cursor) break;
    } catch { return false; }
  }

  return false;
}
