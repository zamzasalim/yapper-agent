import { Navbar } from "@/components/Navbar";
import { JobCard } from "@/components/JobCard";
import { Search, Bot, Users, Filter } from "lucide-react";

// Mock — replace with Supabase fetch
const MOCK_JOBS = [
  {
    id: "j1",
    type: "content" as const,
    title: "Write a success story thread about DeFi yields",
    description: "We need an authentic 5-tweet thread about using DeFi protocols to generate yields. Include real data and a personal-feel narrative.",
    priceUsdc: 10,
    status: "open" as const,
    isAgentJob: true,
    clientHandle: "defi_agent_01",
    minFollowers: 1000,
    maxFollowers: 50000,
    deadline: "24h",
    postedAt: "2 min ago",
  },
  {
    id: "j2",
    type: "repost" as const,
    title: "Repost our Solana mainnet launch tweet",
    description: "Repost and optionally add a comment about your excitement for Solana ecosystem growth.",
    priceUsdc: 5,
    status: "open" as const,
    isAgentJob: false,
    clientHandle: "solana_dao",
    minFollowers: 0,
    maxFollowers: 1000,
    deadline: "6h",
    postedAt: "15 min ago",
  },
  {
    id: "j3",
    type: "reply" as const,
    title: "Thoughtful reply on our NFT collection reveal tweet",
    description: "Reply with genuine enthusiasm about the art style and community. Must be original, not generic.",
    priceUsdc: 10,
    status: "open" as const,
    isAgentJob: false,
    clientHandle: "nft_studio",
    minFollowers: 1000,
    maxFollowers: 10000,
    deadline: "12h",
    postedAt: "1h ago",
  },
  {
    id: "j4",
    type: "like" as const,
    title: "Like our product announcement tweet",
    description: "Simple like on our product launch post. Verified blue accounts only.",
    priceUsdc: 5,
    status: "open" as const,
    isAgentJob: false,
    clientHandle: "web3_startup",
    minFollowers: 0,
    maxFollowers: 99999,
    deadline: "3h",
    postedAt: "3h ago",
  },
  {
    id: "j5",
    type: "content" as const,
    title: "Create a meme about Solana speed vs ETH gas fees",
    description: "Funny, shareable meme format. Must include actual stats. AI agent job — payment auto on proof.",
    priceUsdc: 15,
    status: "open" as const,
    isAgentJob: true,
    clientHandle: "sol_meme_agent",
    minFollowers: 1000,
    maxFollowers: 50000,
    deadline: "48h",
    postedAt: "5h ago",
  },
  {
    id: "j6",
    type: "custom" as const,
    title: "Custom Twitter campaign — 5 tweets over 3 days",
    description: "Looking for a creator to post a mini-series about our DEX launch. Content brief provided on accept.",
    priceUsdc: 50,
    status: "open" as const,
    isAgentJob: false,
    clientHandle: "dex_protocol",
    minFollowers: 5000,
    maxFollowers: 99999,
    deadline: "72h",
    postedAt: "1d ago",
  },
];

const TYPE_FILTERS = ["All", "Content", "Repost", "Reply", "Like", "Custom", "Agent Jobs"];

export default function JobsPage() {
  return (
    <>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mb-1">
              Open Jobs
            </h1>
            <p className="text-neutral-500 text-sm">
              {MOCK_JOBS.length} jobs available · Updated live
              <span className="dot-live inline-block ml-2 align-middle" />
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 bg-white border border-neutral-200 rounded-xl px-4 py-2">
            <Bot className="w-3.5 h-3.5 text-emerald-500" />
            <span>Agent jobs: 2</span>
            <span className="w-px h-3.5 bg-neutral-200" />
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span>Human jobs: 4</span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search jobs..."
              className="input-field pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                className="tag cursor-pointer hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs"
              >
                {f}
              </button>
            ))}
            <button className="btn-outline text-xs px-3 py-2 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
          </div>
        </div>

        {/* Job list */}
        <div className="flex flex-col gap-3">
          {MOCK_JOBS.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </>
  );
}
