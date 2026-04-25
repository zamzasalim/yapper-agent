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
