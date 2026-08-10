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
  if (!profile) return { show: false, mode: null };

  const needsUsername =
    !profile.username || isPlaceholderUsername(profile.username);
  const needsTeam = profile.team_number == null;
  if (!needsUsername && !needsTeam) return { show: false, mode: null };

  const jar = await cookies();
  if (jar.get(SETUP_SKIP_COOKIE)?.value) return { show: false, mode: null };

  return { show: true, mode: needsUsername ? "username" : "team" };
}
