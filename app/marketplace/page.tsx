export const revalidate = 10; // ISR: cache page for 10 seconds

import { Navbar } from "@/components/Navbar";
import { MarketplaceClient } from "@/components/MarketplaceClient";
import { Users } from "lucide-react";
import { createServerClient } from "@/lib/supabase";

async function getCreators() {
  try {
    const db = createServerClient();
    const [{ data, error }, { count }] = await Promise.all([
      db
        .from("users")
        .select("id, twitter_handle, display_name, twitter_followers, avatar_url, rating, jobs_completed, is_verified_blue, niches, custom_content_rate")
        .eq("role", "creator")
        .order("twitter_followers", { ascending: false })
        .limit(30),
      db
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "creator"),
    ]);

    if (error || !data) return null;
    return { creators: data, total: count ?? data.length };
  } catch {
    return null;
  }
}

export default async function MarketplacePage() {
  const raw = await getCreators();
  const totalCreators = raw?.total ?? 0;
  const creators = (raw?.creators ?? []).map((c) => ({
    id: c.id,
    handle: c.twitter_handle ?? "",
    name: c.display_name ?? c.twitter_handle ?? "",
    followers: c.twitter_followers ?? 0,
    avatar: c.avatar_url ?? null,
    rating: c.rating ?? 5.0,
    jobsDone: c.jobs_completed ?? 0,
    tags: (c.niches as string[] | null) ?? [],
    verified: c.is_verified_blue ?? false,
    customContentRate: c.custom_content_rate ?? null,
  }));

  const isLive = raw !== null;

  // ── Empty state: full-page centered ─────────────────────────────────────
  if (creators.length === 0) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
          <Users className="w-14 h-14 mb-5 text-neutral-300 dark:text-neutral-700" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2">
            Creator Marketplace
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">No creators registered yet</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-8">
            Connect your X account to join the marketplace as a verified creator.
          </p>
          <a href="/dashboard" className="btn-primary text-sm px-8">
            Join as Creator
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-1">
              Creator Marketplace
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              {totalCreators} active creator{totalCreators !== 1 ? "s" : ""} registered
              {isLive && (
                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                  <span className="dot-live" /> Live
                </span>
              )}
            </p>
          </div>
        </div>

        <MarketplaceClient creators={creators} totalCreators={totalCreators} />
      </div>
    </>
  );
}
