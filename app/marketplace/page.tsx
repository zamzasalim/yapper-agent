import { Navbar } from "@/components/Navbar";
import { CreatorCard } from "@/components/CreatorCard";
import { Search, SlidersHorizontal } from "lucide-react";

// Mock data – replace with Supabase query
const MOCK_CREATORS = [
  { id: "1", handle: "cryptoyapper", name: "CryptoYapper", followers: 9800, avatar: null, rating: 4.9, jobsDone: 47, tags: ["DeFi", "NFT", "Alpha"], verified: true },
  { id: "2", handle: "solana_shill", name: "SolanaShill", followers: 4300, avatar: null, rating: 4.7, jobsDone: 31, tags: ["Solana", "Meme", "Airdrop"], verified: true },
  { id: "3", handle: "web3writer", name: "Web3Writer", followers: 820, avatar: null, rating: 5.0, jobsDone: 12, tags: ["Content", "Thread", "Education"], verified: true },
  { id: "4", handle: "alphasniper", name: "AlphaSniper", followers: 11200, avatar: null, rating: 4.6, jobsDone: 88, tags: ["Alpha", "Calls", "DeFi"], verified: true },
  { id: "5", handle: "nftqueen", name: "NFT Queen", followers: 3100, avatar: null, rating: 4.8, jobsDone: 24, tags: ["NFT", "Art", "Creator"], verified: true },
  { id: "6", handle: "degenlife", name: "DegenLife", followers: 650, avatar: null, rating: 4.5, jobsDone: 8, tags: ["Degen", "Meme", "Trend"], verified: true },
  { id: "7", handle: "blockchainbro", name: "Blockchain Bro", followers: 7200, avatar: null, rating: 4.9, jobsDone: 55, tags: ["Tech", "Thread", "Analysis"], verified: true },
  { id: "8", handle: "yapmaster", name: "YapMaster", followers: 2400, avatar: null, rating: 4.6, jobsDone: 19, tags: ["General", "Engagement", "Repost"], verified: true },
  { id: "9", handle: "solside", name: "Solside", followers: 490, avatar: null, rating: 4.7, jobsDone: 6, tags: ["Solana", "Newcomer", "Active"], verified: true },
];

const FILTERS = ["All", "0–1K", "1K–10K", "10K–50K"];

export default function MarketplacePage() {
  return (
    <>
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mb-1">
            Creator Marketplace
          </h1>
          <p className="text-neutral-500 text-sm">
            Browse {MOCK_CREATORS.length.toLocaleString()}+ verified blue-tick creators ready to yap for you.
          </p>
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
          <div className="flex items-center gap-2">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_CREATORS.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>

        {/* Load more */}
        <div className="mt-10 text-center">
          <button className="btn-outline text-sm px-6 py-2.5">
            Load More Creators
          </button>
        </div>
      </div>
    </>
  );
}
