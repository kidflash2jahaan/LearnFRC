import { setAdminRoleFor } from "@/lib/app/admin-team-desk";
import {
  badJson,
  fromFailure,
  guarded,
  ok,
  readJsonObject,
  requireAppUser,
} from "@/lib/app/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * PATCH /api/app/admin/team/{userId} { role: "admin" | "superadmin" }
 *
 * Changes a team member's role (or adds a site_admins row when there is none),
 * through setAdminRoleFor (src/lib/app/admin-team-desk.ts), the function
 * /admin/team's "Save role" calls. Refuses your own row and any owner. Super
 * admins only.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(req);
    if (!body) return badJson();
    const { userId } = await params;
    // Removing has its own verb below; PATCH only sets a role.
    const role = body.role === "remove" ? "" : body.role;
    const result = await setAdminRoleFor(auth.user, { userId: userId.toLowerCase(), role });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true });
  });
}

/**
 * DELETE /api/app/admin/team/{userId}
 *
 * Takes someone off the team (their account and progress stay; /admin shuts to
 * them), through the same setAdminRoleFor as /admin/team's "Remove".
 */
export async function DELETE(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const auth = await requireAppUser(req);
    if (auth instanceof Response) return auth;
    const { userId } = await params;
    const result = await setAdminRoleFor(auth.user, {
      userId: userId.toLowerCase(),
      role: "remove",
    });
    if (!result.ok) return fromFailure(result);
    return ok({ ok: true });
  });
}
