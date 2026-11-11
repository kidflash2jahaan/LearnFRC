import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSourceCookie } from "@/lib/signup-attribution";
import { postAuthDestination } from "@/lib/first-run";
import { BANNED_SIGNUP, completeOAuthSignIn } from "@/lib/app/accounts";
import { usernameStepHref } from "@/lib/usernames";
import { safeNextPath } from "@/lib/safe-next";

/**
 * THE OAUTH DOOR, where Google puts people down.
 *
 * Nothing is drawn here, so there is no markup in this file. What it decides
 * is which page of the binder opens first, which makes it the earliest design
 * decision every Google account on the site ever meets.
 *
 * The job itself is small: trade the `code` query param for a session, then
 * redirect. The destination is built as an absolute URL off the request
 * origin, so local, preview and production all behave the same way.
 *
 * ATTRIBUTION. This route is the only thing that runs on a Google signup. The
 * email path's server action never executes. Until 2026-08-10 it recorded
 * nothing at all, so Google signups landed with a NULL `source` (59 to 61% of
 * every signup on the site) and no `referred_by` whatsoever. It now writes the
 * same attribution the email path writes, through the same shared module, and
 * it pays the referral reward here because Google has already proved the
 * address is real. The email path has to wait for /auth/confirm to get that
 * same guarantee. That work is completeOAuthSignIn (src/lib/app/accounts.ts),
 * shared with the app's POST /api/app/auth/oauth-complete, because the app's
 * own Google sign-in never passes through this route.
 *
 * SIGN IN WITH APPLE comes through the same door (the Apple button adds
 * `provider=apple` to this URL). Two things differ, and both are handled in
 * completeOAuthSignIn: Apple's refresh token, which Supabase passes back only
 * now, is kept so the account's Apple sign-in can be revoked when it's deleted,
 * and Apple's name, sent on the first sign-in only, has already been read into
 * the account by Supabase and copied to the profile by handle_new_user.
 *
 * THE BAN LIST. completeOAuthSignIn also gives a brand-new account the sign-up
 * form's ban check. On a hit it deletes the account, and this route signs out
 * and sends the person to /login?notice=banned, which says the account can't
 * be created.
 *
 * FIRST RUN. A brand-new account whose destination is the GENERIC dashboard is
 * sent to /start instead: one question, then a five-lesson plan. 45% of
 * accounts never finish a single lesson, and that loss happens entirely
 * upstream of the content, so the fix belongs at the door and not in the
 * lessons. `isNew` is the same created_at test that gates attribution below,
 * which keeps one definition of "new account" in this route rather than two
 * that can drift apart.
 *
 * WHAT IS DELIBERATELY LEFT ALONE. An explicit `next` is handed back verbatim,
 * once safeNextPath (src/lib/safe-next.ts) has checked it's a same-site path:
 * an invite link, a lesson someone was part-way through while signed out, a
 * tool page. Only the literal string "/dashboard" is ever swapped out. `ref`
 * and `via` are read straight off this URL for attribution, and the
 * destination choice never touches either of them. Referrals through this file
 * were silently dead for 24 days once already, so the invite path is a hard
 * constraint here, not a preference.
 *
 * THE USERNAME STEP. Google and Apple never show the sign-up form, so the
 * database gives a new Google or Apple account a generated username
 * (src/lib/usernames.ts). An
 * account still carrying one goes to /account/username first, with the
 * destination above as its `next`, so the person keeps that handle or picks
 * their own before the lesson, invite or /start they came for. The step sends
 * them on to `next` afterwards, so nothing about the destination is lost.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next")) ?? "/dashboard";

  // Set only once a brand-new account is confirmed, and read once at the very
  // bottom to choose between /start and the resolved destination.
  let isNew = false;
  // The account still has to choose or keep its username.
  let usernameStep = false;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
      );
    }

    // Only a fresh account gets attributed (and paid its referral reward).
    // Someone signing back in has to keep the source they first arrived with.
    // Never throws: analytics must not block a sign-in.
    const hdrs = request.headers;
    const outcome = await completeOAuthSignIn(data?.user, {
      ref: searchParams.get("ref"),
      via: searchParams.get("via"),
      srcCookie: readSourceCookie(hdrs.get("cookie")),
      signupIp:
        (hdrs.get("x-forwarded-for") || "").split(",")[0].trim() ||
        hdrs.get("x-real-ip") ||
        null,
      door: "auth/callback",
      // Only Apple's: a Google sign-in on an account that also has Apple must
      // never file Google's token as Apple's. completeOAuthSignIn also checks
      // the account really has an Apple identity.
      apple:
        searchParams.get("provider") === "apple"
          ? { refreshToken: data?.session?.provider_refresh_token ?? null }
          : undefined,
    });
    // On the ban list: the account was just deleted, so drop the session the
    // code exchange set and say why on the sign-in page.
    if (outcome.banned) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?notice=banned", origin));
    }
    isNew = outcome.isNewAccount;
    usernameStep = outcome.needsUsernameStep;
  } else if (searchParams.get("error_description") === BANNED_SIGNUP) {
    // The ban-list hook in the database refused to make the account, and
    // Supabase sent its sentence back here instead of a code.
    return NextResponse.redirect(new URL("/login?notice=banned", origin));
  }

  const destination = postAuthDestination(next, isNew);
  return NextResponse.redirect(
    new URL(usernameStep ? usernameStepHref(destination) : destination, origin)
  );
}
