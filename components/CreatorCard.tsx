import Link from "next/link";
import { Star, CheckCircle2, ArrowRight } from "lucide-react";
import { formatFollowers, getPriceTier } from "@/lib/solana";

interface Creator {
  id: string;
  handle: string;
  name: string;
  followers: number;
  avatar: string | null;
  rating: number;
  jobsDone: number;
  tags: string[];
  verified: boolean;
}

export function CreatorCard({ creator }: { creator: Creator }) {
  const price = getPriceTier(creator.followers);
  const initials = creator.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center shrink-0 text-white font-bold text-sm">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate" style={{ color: "var(--text-1)" }}>
              {creator.name}
            </span>
            {creator.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
          </div>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            @{creator.handle}
          </span>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-bold text-sm" style={{ color: "var(--text-1)" }}>
            {price === -1 ? "Rate ↗" : `$${price}`}
          </p>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>per job</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
        <div>
          <p className="font-bold text-xs" style={{ color: "var(--text-1)" }}>
            {formatFollowers(creator.followers)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-3)" }}>followers</p>
        </div>
        <div>
          <p className="font-bold text-xs flex items-center justify-center gap-0.5" style={{ color: "var(--text-1)" }}>
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            {creator.rating.toFixed(1)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-3)" }}>rating</p>
        </div>
        <div>
          <p className="font-bold text-xs" style={{ color: "var(--text-1)" }}>{creator.jobsDone}</p>
          <p className="text-[10px]" style={{ color: "var(--text-3)" }}>jobs done</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {creator.tags.map((tag) => (
          <span key={tag} className="tag text-[10px] px-2 py-0.5">{tag}</span>
        ))}
      </div>

      {/* CTA */}
      <Link href={`/post-job?creator=${creator.handle}`} className="btn-primary text-xs px-4 py-2.5 mt-auto">
        Hire @{creator.handle}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
