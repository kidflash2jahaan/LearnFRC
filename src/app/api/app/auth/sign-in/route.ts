import { passwordSignIn } from "@/lib/app/accounts";
import { createTokenClient } from "@/lib/app/auth";
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
 * rate limits, the username lookup and the password check are passwordSignIn
 * (src/lib/app/accounts.ts), the same function the website's signIn action
 * uses, so both doors share one budget per network and per account. The
 * session goes back to the app, which installs it with auth.setSession. The
 * account's email is never sent back.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier || !password)
      return apiError("validation", "Please enter your email or username and password.");

    const signedIn = await passwordSignIn(createTokenClient(), identifier, password);
    if (!signedIn.ok) return fromFailure(signedIn);

    const s = signedIn.session;
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
