import { appSignupSource, completeOAuthSignIn, requestIp } from "@/lib/app/accounts";
import { badJson, guarded, ok, requireAppUser } from "@/lib/app/http";

export const dynamic = "force-dynamic";

const TEXT_KEYS = ["ref", "via", "platform"] as const;

/**
 * POST /api/app/auth/oauth-complete   (Bearer)
 *   {} or { ref?, via?, platform? }
 *
 * The app's half of the website's /auth/callback. On the site, Google lands on
 * that route, which records where a brand-new account came from and pays a
 * pending referral reward. The app's own Google sign-in never passes through
 * it, so the app calls this straight after every OAuth sign-in instead. Both
 * doors run completeOAuthSignIn (src/lib/app/accounts.ts): the same freshness
 * test, the same attribution and the same reward.
 *
 * `ref` and `via` come from the invite link the app was opened with, like the
 * site's `?ref=` and `?via=`. `platform` (`ios`, `ipados`, `macos`) records the
 * source the way POST /api/app/auth/sign-up does. All optional; no body at all
 * is the same as {}.
 *
 * Responds { isNewAccount }. Idempotent: an account older than a few minutes
 * gets `false` and nothing is written, and the reward is paid at most once.
 * Attribution trouble never fails the call.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;

    let body: Record<string, unknown> = {};
    const raw = await req.text();
    if (raw.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return badJson();
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return badJson();
      body = parsed as Record<string, unknown>;
    }
    for (const k of TEXT_KEYS)
      if (k in body && body[k] !== null && typeof body[k] !== "string") return badJson();
    const text = (k: (typeof TEXT_KEYS)[number]) =>
      typeof body[k] === "string" ? (body[k] as string) : null;

    const { isNewAccount } = await completeOAuthSignIn(auth.user, {
      ref: text("ref"),
      via: text("via"),
      srcCookie: appSignupSource(text("platform") ?? ""),
      signupIp: await requestIp(),
      door: "api/app/auth/oauth-complete",
    });
    return ok({ isNewAccount });
  });
}
