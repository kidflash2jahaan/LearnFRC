import { getProfile } from "@/lib/queries";
import { updateProfileFields, type ProfileFields } from "@/lib/app/profile";
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

const TEXT_KEYS = ["fullName", "bio", "avatarUrl", "username", "role"] as const;

/**
 * PATCH /api/app/profile { fullName?, bio?, avatarUrl?, username?, teamNumber?, role? }
 *
 * Settings, the same rules as the website's settings form. A field left out
 * keeps its current value; null clears it. The merged record then goes through
 * updateProfileFields (src/lib/app/profile.ts), the function the website's
 * updateProfile action calls, so validation, rate limits and messages match.
 * Responds with the updated /me profile object.
 */
export async function PATCH(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();

    for (const k of TEXT_KEYS)
      if (k in body && body[k] !== null && typeof body[k] !== "string") return badJson();
    const team = body.teamNumber;
    if ("teamNumber" in body && team !== null && typeof team !== "number" && typeof team !== "string")
      return badJson();
    if (typeof team === "number" && !Number.isInteger(team))
      return apiError("validation", "Enter a valid FRC team number.");

    const current = await getProfile(auth.user.id);
    if (!current) return apiError("not_found", "We couldn't find your profile. Try signing in again.");

    const text = (key: (typeof TEXT_KEYS)[number], fallback: string | null) =>
      key in body ? ((body[key] as string | null) ?? "") : (fallback ?? "");
    const fields: ProfileFields = {
      fullName: text("fullName", current.full_name),
      bio: text("bio", current.bio),
      avatarUrl: text("avatarUrl", current.avatar_url),
      username: text("username", current.username),
      teamNumber:
        "teamNumber" in body
          ? team === null
            ? ""
            : String(team)
          : current.team_number != null
            ? String(current.team_number)
            : "",
      role: text("role", current.role) || "student",
    };

    const result = await updateProfileFields(auth.user, clientsFor(auth.supabase), fields);
    if (!result.ok) return fromFailure(result);

    const profile = await loadMeProfile(auth.user);
    if (!profile) return apiError("not_found", "We couldn't find your profile. Try signing in again.");
    return ok(profile);
  });
}
