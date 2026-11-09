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
 * GET /api/app/apply: the closed apply state installed app copies read (on
 * the admin team, pending, needs a handle, applying again, or new), with the
 * heading and the record a reviewer would see. Applying here is closed:
 * `applicationsOpen` is false, `jobs`, `posting`, `rules` and `marketer` are
 * always empty, and `roles` lists only the teacher role (/apply/teach) while
 * classes are visible. loadApplyState in src/lib/app/admin-apply.ts.
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
 * Always 409 through submitApplication: "Applications are closed for now.
 * Check back later." (an admin gets "You're already on the team."). Kept so
 * installed copies get a clear answer. The teacher application is web only.
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

/** DELETE /api/app/apply: withdraws the caller's pending application from before applying closed. */
export async function DELETE(req: Request) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const result = await withdrawApplication(auth.user);
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true });
  });
}
