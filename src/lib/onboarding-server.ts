import "server-only";
import { cookies } from "next/headers";
import type { Profile } from "@/lib/types";
import {
  isPlaceholderUsername,
  SETUP_SKIP_COOKIE,
  type ProfileSetupState,
} from "@/lib/onboarding";

/**
 * Server half of the profile-setup prompt. Split from `onboarding.ts` so the
 * pure helpers and types there stay importable from Client Components — this
 * file reaches for `cookies()` and must never reach a browser bundle.
 */

/**
 * Decide whether to ask this account to finish its profile, and for what.
 *
 * `username` mode covers accounts with no handle or a placeholder one (they
 * also get the optional team field). `team` mode is the narrower ask for an
 * account whose handle is genuinely their own but has no team number.
 *
 * The dismissal is read from a cookie on the SERVER, so the prompt's presence
 * is decided before render — the markup never differs between server and
 * client, and nothing here branches on motion preference.
 */
export async function getProfileSetupState(
  profile: Profile | null
): Promise<ProfileSetupState> {
  if (!profile) return { show: false, mode: null, required: false };

  // NO handle at all is a hard stop. Signing up by email cannot produce an
  // account without one (actions/auth.ts rejects the form), so Google sign-in
  // must not either — that gap is what produced 26 accounts with no profile URL
  // and a bare "Learner" wherever they appeared.
  const hasNoUsername = !profile.username;

  // A machine-minted handle is a softer case: the account works, the profile
  // opens, and the person is only carrying a name they did not choose. Asking
  // is right; locking them out is not. 23 of the accounts holding one are
  // active learners, including the single highest-XP account on the site, and
  // hard-gating someone mid-way through the catalogue to force a rename would
  // cost far more than the generated name does.
  const hasPlaceholder =
    !hasNoUsername && isPlaceholderUsername(profile.username);
  const needsTeam = profile.team_number == null;

  if (hasNoUsername) return { show: true, mode: "username", required: true };

  if (!hasPlaceholder && !needsTeam)
    return { show: false, mode: null, required: false };

  const jar = await cookies();
  if (jar.get(SETUP_SKIP_COOKIE)?.value)
    return { show: false, mode: null, required: false };

  return {
    show: true,
    mode: hasPlaceholder ? "username" : "team",
    required: false,
  };
}

/**
 * Does this account have no handle at all? Account pages call this to hold the
 * learner on the setup step, because without a handle there is no profile URL
 * for them to have. Deliberately NOT true for a placeholder handle: those
 * accounts work, and are asked rather than blocked.
 *
 * Reading the site is unaffected either way — guides and articles never
 * required an account and still do not.
 */
export function needsUsernameSetup(profile: Profile | null): boolean {
  if (!profile) return false;
  return !profile.username;
}
