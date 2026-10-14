import { setEmailChoice } from "@/lib/app/profile";
import { clientsFor } from "@/lib/app/result";
import {
  badJson,
  fromFailure,
  guarded,
  ok,
  readJsonObject,
  requireAppUser,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/email-opt-in { optIn }
 *
 * Reminder emails on or off, through setEmailChoice, the function the
 * website's Settings switch and one-time prompt call. Records the choice time,
 * which stops the prompt from asking again.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();

    const result = await setEmailChoice(auth.user, clientsFor(auth.supabase), body.optIn);
    if (!result.ok) return fromFailure(result);
    return ok({ optIn: result.optIn, emailChoiceAt: result.emailChoiceAt });
  });
}
