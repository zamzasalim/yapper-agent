export const revalidate = 60; // ISR: cache page for 60 seconds

import { Navbar } from "@/components/Navbar";
import { CreatorCard } from "@/components/CreatorCard";
import { Search, SlidersHorizontal, Users } from "lucide-react";
import { createServerClient } from "@/lib/supabase";

async function getCreators() {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("users")
      .select("id, twitter_handle, display_name, twitter_followers, avatar_url, rating, jobs_completed, is_verified_blue")
      .eq("is_verified_blue", true)
      .eq("role", "creator")
      .order("jobs_completed", { ascending: false })
      .limit(30);

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

const FILTERS = ["All", "0–1K", "1K–10K", "10K–50K"];

export default async function MarketplacePage() {
  const raw = await getCreators();
  const creators = (raw ?? []).map((c) => ({
    id: c.id,
    handle: c.twitter_handle ?? "",
    name: c.display_name ?? c.twitter_handle ?? "",
    followers: c.twitter_followers ?? 0,
    avatar: c.avatar_url ?? null,
    rating: c.rating ?? 5.0,
    jobsDone: c.jobs_completed ?? 0,
    tags: [] as string[],
    verified: c.is_verified_blue ?? true,
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
              {creators.length} verified creator{creators.length !== 1 ? "s" : ""} registered
              {isLive && (
                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                  <span className="dot-live" /> Live
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Search by handle, tag, or niche..."
              className="input-field"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                className="tag cursor-pointer hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors text-xs"
              >
                {f}
              </button>
            ))}
            <button className="btn-outline text-xs px-3 py-2 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creators.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>

        {/* Load more */}
        {creators.length >= 30 && (
          <div className="mt-10 text-center">
            <button className="btn-outline text-sm px-6 py-2.5">
              Load More Creators
            </button>
          </div>
        )}
      </div>
    </>
  );
}
