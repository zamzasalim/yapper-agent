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
    if (!user || !user.followers_count) return null;
    return {
      followers:        user.followers_count  ?? 0,
      is_verified_blue: user.is_blue_verified ?? false,
    };
  } catch {
    return null;
  }
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
