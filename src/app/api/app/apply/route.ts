import {
  loadApplyState,
  submitApplication,
  withdrawApplication,
} from "@/lib/app/admin-apply";
import {
  badJson,
  fromFailure,
  guarded,
  ok,
  readJsonObject,
  requireAppUser,
  successBody,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/apply: where the caller stands on /apply (on the team, pending,
 * needs a handle, applying again, or new), with the page's heading, the four
 * jobs, the record a reviewer would see and whether applications are open.
 * loadApplyState in src/lib/app/admin-apply.ts, which /apply renders from too.
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await loadApplyState(auth.user);
    if (!result.ok) return fromFailure(result);
    return ok(successBody(result));
  });
}

/**
 * POST /api/app/apply { experience, why, availability? }
 *
 * Files an application through submitApplication, the function /apply's form
 * calls: closed (409) while applications are closed, a handle required, the
 * same lengths, rate limits (3 a day per account, 25 per network) and the
 * one-pending rule. 201 on success.
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const result = await submitApplication(auth.user, {
      experience: body.experience,
      why: body.why,
      availability: body.availability,
    });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true }, 201);
  });
}

/** DELETE /api/app/apply: withdraws the caller's pending application. */
export async function DELETE(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await withdrawApplication(auth.user);
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true });
  });
}
