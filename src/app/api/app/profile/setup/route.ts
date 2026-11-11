import { saveProfileSetupFields } from "@/lib/app/profile";
import { loadMeProfile } from "@/lib/app/me";
import { clientsFor } from "@/lib/app/result";
import {
  apiError,
  badJson,
  fromFailure,
  guarded,
  ok,
  readJsonObject,
  requireAppUser,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/profile/setup { username, teamNumber? }
 *
 * The username step for an account whose username was generated
 * (`needsUsernameSetup` on /me), and the team-number card, through
 * saveProfileSetupFields, the function the website's /account/username page
 * and dashboard card call. Sending the current username back unchanged keeps
 * it. Responds with the updated /me profile object.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();

    const { username, teamNumber } = body;
    if (username !== undefined && username !== null && typeof username !== "string")
      return badJson();
    if (
      teamNumber !== undefined &&
      teamNumber !== null &&
      typeof teamNumber !== "number" &&
      typeof teamNumber !== "string"
    )
      return badJson();
    if (typeof teamNumber === "number" && !Number.isInteger(teamNumber))
      return apiError("validation", "Enter a valid FRC team number.");

    const result = await saveProfileSetupFields(auth.user, clientsFor(auth.supabase), {
      username: typeof username === "string" ? username : "",
      teamNumber: teamNumber === undefined || teamNumber === null ? "" : String(teamNumber),
    });
    if (!result.ok) return fromFailure(result);

    const profile = await loadMeProfile(auth.user);
    if (!profile) return apiError("not_found", "We couldn't find your profile. Try signing in again.");
    return ok(profile);
  });
}
