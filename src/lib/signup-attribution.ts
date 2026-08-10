import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared signup attribution + referral payout.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This logic used to live only inside the email/password `signUp` action. When
 * Google sign-in shipped (2026-07-23) it got its own code path that did none of
 * it, and the two silently diverged: from that day 59-61% of signups recorded
 * no `source` at all, and `profiles.referred_by` stopped being written entirely
 * — the last referral in the database is dated 2026-07-17. Five referral
 * surfaces were later built on top of a loop that could not record a referral
 * for the majority signup method.
 *
 * So attribution lives here, once, and every signup path calls it. If you add a
 * third way to create an account, call `attributeSignup` from it.
 */

/**
 * Which share surface produced a referral (`?via=`). Allow-listed, never free
 * text — this is written to the database from a URL a stranger controls.
 */
const REFERRAL_SURFACES = new Set([
  "lesson-milestone",
  "certificate",
  "dashboard",
  "leaderboard",
  "email",
  // A signup that started by opening a team-space invite link or scanning the
  // QR at a team meeting. Stamped by /join/space/continue.
  "team-invite",
]);

/** Reduce an untrusted `?via=` to an allow-listed surface, or "" if unknown. */
export function normalizeVia(raw: string | null | undefined): string {
  const v = String(raw || "").trim().toLowerCase();
  return REFERRAL_SURFACES.has(v) ? v : "";
}

/** Reduce an untrusted `?ref=` to the username charset, or "" if unusable. */
export function normalizeRef(raw: string | null | undefined): string {
  return String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/** Read the first-touch source cookie out of a raw Cookie header. */
export function readSourceCookie(cookieHeader: string | null): string | null {
  const m = (cookieHeader || "").match(/(?:^|;\s*)lf_src=([^;]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/**
 * Record where a brand-new account came from.
 *
 * Precedence matches the email path exactly: an explicit conversion-hook token
 * wins (last touch), then a referral link, then the first-touch `lf_src`
 * cookie, then Direct. `referred_by` is only set for a real other user, so a
 * self-invite can neither credit itself nor pollute the surface stats.
 *
 * Never overwrites an existing non-empty `source` — a returning user signing in
 * again must not be re-attributed to wherever they happen to be today.
 */
export async function attributeSignup({
  userId,
  ref,
  via,
  srcCookie,
  signupIp,
  hookSource,
}: {
  userId: string;
  ref?: string | null;
  via?: string | null;
  srcCookie?: string | null;
  signupIp?: string | null;
  hookSource?: string | null;
}): Promise<{ attributed: boolean; referredBy?: string }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("source")
    .eq("id", userId)
    .maybeSingle();
  // No row yet (the trigger that creates it hasn't landed) or already
  // attributed — either way there is nothing safe to write.
  if (!existing) return { attributed: false };
  if (existing.source) return { attributed: false };

  const cleanRef = normalizeRef(ref);
  const cleanVia = normalizeVia(via);

  const source = (
    hookSource || (cleanRef ? "Referral" : srcCookie || "Direct")
  ).slice(0, 40);

  const update: {
    source: string;
    referred_by?: string;
    signup_ip?: string;
    referral_surface?: string;
  } = { source };
  if (signupIp) update.signup_ip = signupIp;

  let referredBy: string | undefined;
  if (cleanRef) {
    const { data: referrer } = await admin
      .from("profiles")
      .select("id")
      .eq("username", cleanRef)
      .maybeSingle();
    if (referrer && referrer.id !== userId) {
      referredBy = referrer.id as string;
      update.referred_by = referredBy;
      // Only meaningful on a real referral, and only after the self-referral
      // check, so a self-invite can't pollute the per-surface stats.
      if (cleanVia) update.referral_surface = cleanVia;
    }
  }

  await admin.from("profiles").update(update).eq("id", userId);
  return { attributed: true, referredBy };
}

/**
 * Pay the double-sided +25 XP for a referral, at most once per invited user.
 *
 * `referral_rewarded` is the gate, so calling this twice is harmless — which
 * matters because the email path calls it from /auth/confirm and the OAuth path
 * calls it from /auth/callback.
 *
 * Only call this once the account's email is genuinely verified (email path:
 * after the confirmation link; OAuth: Google has already verified it). That is
 * what keeps the reward farm-resistant.
 */
export async function payReferralReward(userId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profiles")
    .select("referred_by, referral_rewarded, xp")
    .eq("id", userId)
    .maybeSingle();
  if (!prof?.referred_by || prof.referral_rewarded) return false;

  const { data: refUser } = await admin
    .from("profiles")
    .select("id, xp")
    .eq("id", prof.referred_by as string)
    .maybeSingle();
  if (refUser) {
    await admin
      .from("profiles")
      .update({ xp: ((refUser.xp as number) ?? 0) + 25 })
      .eq("id", refUser.id);
  }

  // The invited user also gets +25 as a head-start, so joining through a
  // teammate's link beats signing up cold.
  await admin
    .from("profiles")
    .update({
      xp: ((prof.xp as number) ?? 0) + 25,
      referral_rewarded: true,
    })
    .eq("id", userId);

  return true;
}
