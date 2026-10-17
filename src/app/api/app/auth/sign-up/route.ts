import { rateLimit } from "@/lib/rate-limit";
import { appSignupSource, registerAccount, requestIp } from "@/lib/app/accounts";
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

const TEXT_KEYS = ["email", "password", "username", "fullName", "ref", "via", "platform"] as const;

/**
 * POST /api/app/auth/sign-up
 *   { email, password, username, fullName?, teamNumber?, emailOptIn, ref?, via?, platform? }
 *
 * Creates an account with exactly the website's rules: registerAccount
 * (src/lib/app/accounts.ts) is the function the website's signUp action calls
 * (ban list, profanity filter, username rules and uniqueness, team number,
 * the already-registered check, reminder-email consent, referral and source
 * attribution). Email confirmation is required: the link opens learnfrc.com,
 * which pays any referral reward and sends the welcome email, and then the
 * person signs in from the app.
 *
 * Responds { status: "confirm_email" } or { status: "exists" }. Rate limited
 * per IP, generously, because a whole team often signs up together on one
 * school network.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const body = await readJsonObject(req);
    if (!body) return badJson();
    for (const k of TEXT_KEYS)
      if (k in body && body[k] !== null && typeof body[k] !== "string") return badJson();
    const team = body.teamNumber;
    if (team !== undefined && team !== null && typeof team !== "number" && typeof team !== "string")
      return badJson();
    if (typeof team === "number" && !Number.isInteger(team))
      return apiError("validation", "Enter a valid FRC team number.");
    // Consent is never assumed: the app must send an explicit yes or no.
    if (typeof body.emailOptIn !== "boolean") return badJson();

    if (!(await rateLimit("app-sign-up", 30, 3600)))
      return apiError("rate_limited", "Too many sign-ups from this network. Try again in a bit.", {
        retryAfter: 3600,
      });

    const text = (k: (typeof TEXT_KEYS)[number]) =>
      typeof body[k] === "string" ? (body[k] as string) : "";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

    const result = await registerAccount(
      {
        email: text("email"),
        password: text("password"),
        fullName: text("fullName"),
        username: text("username"),
        teamNumber: team === undefined || team === null ? "" : String(team),
        emailOptIn: body.emailOptIn,
        ref: text("ref"),
        via: text("via"),
      },
      {
        auth: createTokenClient(),
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/dashboard")}`,
        signupIp: await requestIp(),
        srcCookie: appSignupSource(text("platform")),
      }
    );
    if (!result.ok) return fromFailure(result);
    return ok({ status: result.status });
  });
}
