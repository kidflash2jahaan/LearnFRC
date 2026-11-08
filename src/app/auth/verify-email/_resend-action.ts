"use server";

import { rateLimit } from "@/lib/rate-limit";
import { resendConfirmation } from "@/app/actions/auth";

export type ResendResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** Seconds until Supabase will send another, when it said so. */
      retryAfter?: number;
    };

/** RFC 5321 maximum path length for an address. */
const MAX_EMAIL = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send the sign-up confirmation link again, from the "check your inbox" page.
 *
 * The send itself is the site's existing `resendConfirmation`, so the link and
 * where it lands stay exactly what sign-up sends. This adds the two things that
 * page needs before it can offer the button to anyone, including someone who
 * types an address in: the site's own per-IP and per-address limits on top of
 * Supabase's, and answers a person can act on instead of raw auth errors.
 *
 * Supabase answers an unknown or already-confirmed address with success and
 * sends nothing, so the reply never says whether an account exists.
 */
export async function resendConfirmationEmail(raw: string): Promise<ResendResult> {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter the address you signed up with." };
  }

  // Six an hour from one network covers a school lab sharing an IP; three an
  // hour to one address is more than any inbox needs. Both sit under
  // Supabase's own limits, which still apply below.
  if (
    !(await rateLimit("resend-confirm", 6, 3600)) ||
    !(await rateLimit("resend-confirm-email", 3, 3600, email))
  ) {
    return {
      ok: false,
      error:
        "That's a lot of resends. Check spam and any Promotions tab, then try again in an hour.",
    };
  }

  const r = await resendConfirmation(email);
  if (!r.error) return { ok: true };

  // Supabase: "For security purposes, you can only request this after 42
  // seconds." The number is the useful part.
  const wait = /after (\d+) seconds?/i.exec(r.error);
  if (wait) {
    const seconds = Number(wait[1]);
    return {
      ok: false,
      error: `One just went out. You can send another in ${seconds} seconds.`,
      retryAfter: seconds,
    };
  }
  if (/rate limit/i.test(r.error)) {
    return {
      ok: false,
      error: "Too many emails went out just now. Wait a few minutes and try again.",
    };
  }

  console.error("resendConfirmationEmail:", r.error);
  return { ok: false, error: "That didn't send. Try again in a minute." };
}
