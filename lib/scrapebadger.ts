/**
 * ScrapeBadger Twitter API helper.
 * Fetches a user's live follower count and blue-verified status by handle.
 */
export async function fetchTwitterUserStats(
  handle: string
): Promise<{ followers: number; is_verified_blue: boolean } | null> {
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

    // Try multiple field name variations — ScrapeBadger API may vary
    const followers: number =
      user.followers_count ??
      user.public_metrics?.followers_count ??
      user.follower_count ??
      user.followers ??
      0;

    const is_verified_blue: boolean =
      user.is_blue_verified ??
      user.verified ??
      user.is_verified ??
      user.blue_verified ??
      false;

    return { followers, is_verified_blue };
  } catch {
    return null;
  }
}

/** Check if `handle` has retweeted `tweetId`. Paginates up to 5 pages. */
export async function checkRetweeted(tweetId: string, handle: string): Promise<boolean> {
  const apiKey = process.env.SCRAPEBADGER_API_KEY ?? "";
  if (!apiKey) return false;
  const lc = handle.toLowerCase();
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const url = new URL(`https://scrapebadger.com/v1/twitter/tweets/tweet/${tweetId}/retweeters`);
    if (cursor) url.searchParams.set("cursor", cursor);
    try {
      const res = await fetch(url.toString(), { headers: { "x-api-key": apiKey } });
      if (!res.ok) return false;
      const json = await res.json();
      const users: Array<{ username: string }> = json.data ?? [];
      if (users.some((u) => u.username.toLowerCase() === lc)) return true;
      cursor = json.next_cursor;
      if (!cursor) break;
    } catch { return false; }
  }
  return false;
}

/** Check if `handle` has liked `tweetId`. Paginates up to 5 pages. */
export async function checkLiked(tweetId: string, handle: string): Promise<boolean> {
  const apiKey = process.env.SCRAPEBADGER_API_KEY ?? "";
  if (!apiKey) return false;
  const lc = handle.toLowerCase();
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const url = new URL(`https://scrapebadger.com/v1/twitter/tweets/tweet/${tweetId}/liking_users`);
    if (cursor) url.searchParams.set("cursor", cursor);
    try {
      const res = await fetch(url.toString(), { headers: { "x-api-key": apiKey } });
      if (!res.ok) return false;
      const json = await res.json();
      const users: Array<{ username: string }> = json.data ?? [];
      if (users.some((u) => u.username.toLowerCase() === lc)) return true;
      cursor = json.next_cursor;
      if (!cursor) break;
    } catch { return false; }
  }
  return false;
}

/** Parse S&K requirements encoded in a job description. */
export function parseJobRequirements(description: string): {
  requireCenblue: boolean;
  minFollowers: number;
} {
  const match = description.match(/\[S&K:\s*([^\]]+)\]/i);
  if (!match) return { requireCenblue: false, minFollowers: 0 };
  const parts = match[1].toLowerCase();
  const requireCenblue = parts.includes("cenblue wajib");
  const followerMatch  = parts.match(/min\.\s*([\d,]+)\s*followers/);
  const minFollowers   = followerMatch
    ? parseInt(followerMatch[1].replace(/,/g, ""), 10)
    : 0;
  return { requireCenblue, minFollowers };
}
