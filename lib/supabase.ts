import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Lazy singletons — created on first use, not at module import time.
// This prevents build-time crashes when env vars aren't available (e.g. Vercel build step).

let _browserClient: SupabaseClient<Database> | null = null;
let _serverClient: SupabaseClient<Database> | null = null;

/** Browser / client-component Supabase client (anon key). */
export function getSupabase(): SupabaseClient<Database> {
  if (!_browserClient) {
    _browserClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _browserClient;
}

/** @deprecated Use getSupabase() instead. Kept for compatibility. */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});

/** Server-side client with service role key (API routes only). */
export function createServerClient(): SupabaseClient<Database> {
  if (!_serverClient) {
    _serverClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _serverClient;
}
