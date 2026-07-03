import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Public (anon-key) client with NO cookie/session/request context.
 *
 * Safe to construct and use inside a durable cache scope (`unstable_cache`),
 * where reading `cookies()`/`headers()` is not allowed. Only reads data the
 * anonymous role can already see under RLS — the public catalog (departments,
 * modules, lessons) and the public leaderboard aggregates that anonymous
 * visitors render today. Never use it for per-user or privileged reads.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
