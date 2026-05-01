"use client";

import { useState, useMemo } from "react";
import { Search, Loader2 } from "lucide-react";
import { CreatorCard } from "./CreatorCard";
import { cn } from "@/lib/cn";

type Creator = {
  id: string;
  handle: string;
  name: string;
  followers: number;
  avatar: string | null;
  rating: number;
  jobsDone: number;
  tags: string[];
  verified: boolean;
  customContentRate?: boolean | null;
};

const FILTERS = [
  { label: "All",     min: 0,      max: Infinity },
  { label: "0–1K",    min: 0,      max: 1_000 },
  { label: "1K–10K",  min: 1_000,  max: 10_000 },
  { label: "10K–50K", min: 10_000, max: 50_000 },
  { label: "50K+",    min: 50_000, max: Infinity },
];

const PAGE_SIZE = 30;

function normalize(raw: Record<string, unknown>): Creator {
  return {
    id:               raw.id as string,
    handle:           (raw.twitter_handle as string) ?? "",
    name:             (raw.display_name as string) ?? (raw.twitter_handle as string) ?? "",
    followers:        (raw.twitter_followers as number) ?? 0,
    avatar:           (raw.avatar_url as string | null) ?? null,
    rating:           (raw.rating as number) ?? 5.0,
    jobsDone:         (raw.jobs_completed as number) ?? 0,
    tags:             (raw.niches as string[] | null) ?? [],
    verified:         (raw.is_verified_blue as boolean) ?? false,
    customContentRate: (raw.custom_content_rate as boolean | null) ?? null,
  };
}

export function MarketplaceClient({
  creators: initialCreators,
  totalCreators,
}: {
  creators: Creator[];
  totalCreators: number;
}) {
  const [creators, setCreators]     = useState<Creator[]>(initialCreators);
  const [query, setQuery]           = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [loadingMore, setLoadingMore]   = useState(false);

  const hasMore = creators.length < totalCreators;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const f = FILTERS.find((x) => x.label === activeFilter) ?? FILTERS[0];
    return creators.filter((c) => {
      const matchesQuery =
        !q ||
        c.handle.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q));
      const matchesRange = c.followers >= f.min && c.followers < f.max;
      return matchesQuery && matchesRange;
    });
  }, [creators, query, activeFilter]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res  = await fetch(`/api/creators?offset=${creators.length}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      const next = (data.creators ?? []).map(normalize);
      setCreators((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        return [...prev, ...next.filter((c: Creator) => !existingIds.has(c.id))];
      });
    } catch {
      // silently fail — user can try again
    }
    setLoadingMore(false);
  }

  return (
    <>
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          <input
            type="text"
            aria-label="Search creators"
            placeholder="Search by handle or niche..."
            className="input-field"
            style={{ paddingLeft: "2.25rem" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setActiveFilter(f.label)}
              className={cn(
                "inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-full border transition-colors cursor-pointer",
                activeFilter === f.label
                  ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600"
                  : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-transparent hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-neutral-400 dark:text-neutral-500">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No creators match your search.</p>
          <button
            onClick={() => { setQuery(""); setActiveFilter("All"); }}
            className="text-xs text-blue-500 hover:underline mt-2 block mx-auto"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-10 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="btn-outline text-sm px-6 py-2.5 flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? "Loading…" : "Load More Creators"}
          </button>
        </div>
      )}
    </>
  );
}
