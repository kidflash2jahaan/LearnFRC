import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limit keyed on `key` alone (an account id, say), with no IP in the
 * bucket, so the limit follows the account onto any network. `rateLimit`
 * below keys on the IP plus an extra key, which is per account per network.
 * Same Postgres function, same fail-open rule.
 */
export async function rateLimitKey(
  action: string,
  max: number,
  windowSeconds: number,
  key: string
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: `${action}:k:${key}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** The bucket `rateLimit` counts in: the action, the client's IP, the extra key. */
async function ipBucket(action: string, extraKey?: string): Promise<string> {
  const h = await headers();
  const ip =
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "unknown";
  return `${action}:${ip}${extraKey ? `:${extraKey}` : ""}`;
}

/**
 * Per-IP rate limit backed by a SECURITY DEFINER Postgres function.
 * Returns true if the request is allowed, false if the limit is exceeded.
 * Fails open on infrastructure errors so legitimate users are never blocked.
 */
export async function rateLimit(
  action: string,
  max: number,
  windowSeconds: number,
  extraKey?: string
): Promise<boolean> {
  try {
    const bucket = await ipBucket(action, extraKey);
    // Use the service-role client: the check_rate_limit RPC is now revoked from
    // anon/authenticated (so it can't be poked directly via /rest/v1/rpc), and
    // rate limiting is enforced server-side regardless of the caller's session.
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/**
 * Gives back one try counted by `rateLimit` (same action and extra key, same
 * IP), for a try that turned out not to count, like a right password. Removes
 * the bucket's newest hit. Best effort: a failure just leaves the try counted.
 */
export async function refundRateLimit(action: string, extraKey?: string): Promise<void> {
  try {
    const bucket = await ipBucket(action, extraKey);
    const admin = createAdminClient();
    const { data } = await admin
      .from("rate_limit_hits")
      .select("id")
      .eq("bucket", bucket)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) await admin.from("rate_limit_hits").delete().eq("id", data.id);
  } catch {
    // leave it counted
  }
}
