import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/agent/register
 * One-time registration for an AI agent. Returns a permanent api_key.
 * Body: { agent_name: string, wallet_address?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { agent_name, wallet_address } = await req.json();
    if (!agent_name) {
      return NextResponse.json({ error: "agent_name required" }, { status: 400 });
    }

    const db = createServerClient();

    // 64-char hex API key
    const apiKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Synthetic twitter_handle — satisfies NOT NULL / UNIQUE constraint, clearly not a real handle
    const syntheticHandle = `_agent_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agent, error } = await (db as any)
      .from("users")
      .insert({
        id:               crypto.randomUUID(),
        privy_did:        `agent_${crypto.randomUUID()}`,
        twitter_handle:   syntheticHandle,
        twitter_id:       syntheticHandle,
        wallet_address:   wallet_address ?? "pending",
        display_name:     agent_name,
        twitter_followers: 0,
        is_verified_blue: false,
        role:             "client",
        agent_api_key:    apiKey,
      })
      .select("id, display_name, agent_api_key")
      .single() as { data: { id: string; display_name: string; agent_api_key: string } | null; error: unknown };

    if (error) return NextResponse.json({ error: (error as Error).message ?? error }, { status: 500 });

    return NextResponse.json({
      agent_id:   agent!.id,
      agent_name: agent!.display_name,
      api_key:    agent!.agent_api_key,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
