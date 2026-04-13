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

    if (error || !data?.length) return null;
    return data;
  } catch {
    return null;
  }
}

// Fallback mock — shown when DB is not yet set up
const MOCK_CREATORS = [
  { id: "1", twitter_handle: "cryptoyapper", display_name: "CryptoYapper", twitter_followers: 9800, avatar_url: null, rating: 4.9, jobs_completed: 47, tags: ["DeFi", "NFT", "Alpha"], is_verified_blue: true },
  { id: "2", twitter_handle: "solana_shill", display_name: "SolanaShill", twitter_followers: 4300, avatar_url: null, rating: 4.7, jobs_completed: 31, tags: ["Solana", "Meme", "Airdrop"], is_verified_blue: true },
  { id: "3", twitter_handle: "web3writer", display_name: "Web3Writer", twitter_followers: 820, avatar_url: null, rating: 5.0, jobs_completed: 12, tags: ["Content", "Thread"], is_verified_blue: true },
  { id: "4", twitter_handle: "alphasniper", display_name: "AlphaSniper", twitter_followers: 11200, avatar_url: null, rating: 4.6, jobs_completed: 88, tags: ["Alpha", "DeFi"], is_verified_blue: true },
  { id: "5", twitter_handle: "nftqueen", display_name: "NFT Queen", twitter_followers: 3100, avatar_url: null, rating: 4.8, jobs_completed: 24, tags: ["NFT", "Art"], is_verified_blue: true },
  { id: "6", twitter_handle: "degenlife", display_name: "DegenLife", twitter_followers: 650, avatar_url: null, rating: 4.5, jobs_completed: 8, tags: ["Degen", "Meme"], is_verified_blue: true },
  { id: "7", twitter_handle: "blockchainbro", display_name: "Blockchain Bro", twitter_followers: 7200, avatar_url: null, rating: 4.9, jobs_completed: 55, tags: ["Tech", "Thread"], is_verified_blue: true },
  { id: "8", twitter_handle: "yapmaster", display_name: "YapMaster", twitter_followers: 2400, avatar_url: null, rating: 4.6, jobs_completed: 19, tags: ["General", "Engagement"], is_verified_blue: true },
  { id: "9", twitter_handle: "solside", display_name: "Solside", twitter_followers: 490, avatar_url: null, rating: 4.7, jobs_completed: 6, tags: ["Solana", "Active"], is_verified_blue: true },
];

const FILTERS = ["All", "0–1K", "1K–10K", "10K–50K"];

export default async function MarketplacePage() {
  const dbCreators = await getCreators();
  const raw = dbCreators ?? MOCK_CREATORS;

  // Normalize shape for CreatorCard
  const creators = raw.map((c) => ({
    id: c.id,
    handle: c.twitter_handle ?? "",
    name: c.display_name ?? c.twitter_handle ?? "",
    followers: c.twitter_followers ?? 0,
    avatar: c.avatar_url ?? null,
    rating: c.rating ?? 5.0,
    jobsDone: c.jobs_completed ?? 0,
    // @ts-ignore — tags only exist on mock, not DB type
    tags: (c as { tags?: string[] }).tags ?? [],
    verified: c.is_verified_blue ?? true,
  }));

  const isLive = !!dbCreators;

  return (
    <>
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mb-1">
              Creator Marketplace
            </h1>
            <p className="text-neutral-500 text-sm flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              {isLive
                ? `${creators.length} verified creators registered`
                : `1,000+ verified blue-tick creators`}
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by handle, tag, or niche..."
              className="input-field pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                className="tag cursor-pointer hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs"
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
        {creators.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creators.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-neutral-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No creators yet. Be the first to register.</p>
          </div>
        )}

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
