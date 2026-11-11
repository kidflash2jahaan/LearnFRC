import "server-only";
import { cookies } from "next/headers";
import type { Profile } from "@/lib/types";
import { SETUP_SKIP_COOKIE, type ProfileSetupState } from "@/lib/onboarding";
import { needsUsernameStep } from "@/lib/usernames";

/**
 * Server half of the profile-setup prompt. Split from `onboarding.ts` so the
 * pure helpers and types there stay importable from Client Components; this
 * file reaches for `cookies()` and must never reach a browser bundle.
 */

/**
 * Whether to show the dashboard's skippable team-number card.
 *
 * Only for an account whose username is settled (chosen or kept): the
 * username step at /account/username comes first and has the screen to
 * itself. The dismissal is read from a cookie on the SERVER, so the prompt's
 * presence is decided before render and the markup never differs between
 * server and client.
 */
export async function getProfileSetupState(
  profile: Profile | null
): Promise<ProfileSetupState> {
  if (!profile || needsUsernameStep(profile) || profile.team_number != null)
    return { show: false, mode: null };

  const jar = await cookies();
  if (jar.get(SETUP_SKIP_COOKIE)?.value) return { show: false, mode: null };

  return { show: true, mode: "team" };
}
