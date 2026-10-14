import { rateLimit } from "@/lib/rate-limit";
import { resolveSignInEmail } from "@/lib/app/accounts";
import { createTokenClient } from "@/lib/app/auth";
import { normalizeUsername } from "@/lib/app/profile";
import {
  apiError,
  badJson,
  fromFailure,
  guarded,
  ok,
  readJsonObject,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/auth/sign-in { identifier, password }
 *
 * Sign in with an email OR a username, like the website's login form. The
 * username lookup is resolveSignInEmail (src/lib/app/accounts.ts), the same
 * function the website's signIn action uses. The password is checked by
 * Supabase Auth, and the session goes back to the app, which installs it with
 * auth.setSession. The account's email is never sent back.
 *
 * Rate limited per IP, and per IP and identifier, on top of Supabase Auth's
 * own limits.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier || !password)
      return apiError("validation", "Please enter your email or username and password.");

    const key = identifier.includes("@")
      ? identifier.toLowerCase()
      : normalizeUsername(identifier);
    if (
      !(await rateLimit("app-sign-in", 30, 300)) ||
      !(await rateLimit("app-sign-in-account", 10, 300, key.slice(0, 120)))
    )
      return apiError("rate_limited", "Too many sign-in attempts. Wait a few minutes and try again.", {
        retryAfter: 300,
      });

    const resolved = await resolveSignInEmail(identifier);
    if (!resolved.ok) return fromFailure(resolved);

    const auth = createTokenClient();
    const { data, error } = await auth.auth.signInWithPassword({
      email: resolved.email,
      password,
    });
    if (error || !data.session) {
      if (error?.status === 429)
        return apiError("rate_limited", "Too many attempts. Wait a minute and try again.", {
          retryAfter: 60,
        });
      return apiError("unauthorized", error?.message ?? "Couldn't sign you in. Try again.");
    }

    const s = data.session;
    return ok({
      accessToken: s.access_token,
      refreshToken: s.refresh_token,
      expiresAt: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in,
      expiresIn: s.expires_in,
      tokenType: s.token_type,
      userId: s.user.id,
    });
  });
}
