"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
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
};

const FILTERS = [
  { label: "All",     min: 0,      max: Infinity },
  { label: "0–1K",    min: 0,      max: 1_000 },
  { label: "1K–10K",  min: 1_000,  max: 10_000 },
  { label: "10K–50K", min: 10_000, max: 50_000 },
  { label: "50K+",    min: 50_000, max: Infinity },
];

export function MarketplaceClient({ creators }: { creators: Creator[] }) {
  const [query, setQuery]               = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

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
                "tag cursor-pointer transition-colors text-xs",
                activeFilter === f.label
                  ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                  : "hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
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
      {filtered.length >= 30 && (
        <div className="mt-10 text-center">
          <button className="btn-outline text-sm px-6 py-2.5">Load More Creators</button>
        </div>
      )}
    </>
  );
}
