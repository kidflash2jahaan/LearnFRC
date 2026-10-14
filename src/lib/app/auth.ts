import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Authentication for the native app's /api/app/* routes.
 *
 * The website authenticates with the Supabase cookie (src/lib/supabase/server.ts
 * reads cookies only). The iPhone, iPad and Mac app has no cookie; it holds a
 * Supabase session in the Keychain and sends the access token as
 * `Authorization: Bearer <token>`.
 *
 * The token is verified with supabase.auth.getUser(token), which asks the auth
 * server rather than only checking the signature, so a revoked session or a
 * deleted account is rejected straight away. The returned client sends the same
 * token to PostgREST, so every read through it is the user's own role under RLS,
 * exactly like the website's cookie client.
 *
 * Never use the user's id from a request body. The id comes from here.
 */

export type AppSession = {
  user: User;
  /** Acts as this user under RLS. */
  supabase: SupabaseClient;
};

/** The raw Bearer token from a request, or null. */
export function bearerToken(req: Request): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

/**
 * A Supabase client with no session of its own. With `token` it acts as that
 * user; without one it is the anonymous role (sign-in and sign-up use that).
 */
export function createTokenClient(token?: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

/**
 * Verifies the Bearer token on a request. Returns the user and a client that
 * acts as them, or null when the header is missing, malformed, expired,
 * revoked, or belongs to a deleted account.
 */
export async function getAppUser(req: Request): Promise<AppSession | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const supabase = createTokenClient(token);
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return { user, supabase };
  } catch {
    return null;
  }
}
