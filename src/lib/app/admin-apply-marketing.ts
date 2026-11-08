import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { teamInviteUrl } from "@/components/team/invite-link";
import { isUuid } from "@/lib/app/http";
import { toIso } from "@/lib/app/format";
import {
  BAD_REQUEST,
  NOT_SUPER_ADMIN,
  requireSiteRole,
  textField,
} from "@/lib/app/admin-access";
import { revalidateTeamPages } from "@/lib/app/admin-notify";
import { fail, type AppUser, type Result } from "@/lib/app/result";

/**
 * The marketing tag: who has it, what it shows, and taking it away. Shared by
 * /apply, /admin/team (its page and the removeMarketer Server Action), the
 * acceptance in admin-team-desk.ts, and the app's /api/app/apply,
 * /api/app/admin/team and /api/app/admin/marketers/{userId} routes.
 *
 * THE TAG CAN NEVER OPEN /admin. It lives in its own table, `marketers`
 * (supabase/migrations/20261108120000_marketers.sql), and nothing here reads or
 * writes `site_admins`, which is the only thing `getSiteRole` (src/lib/auth.ts)
 * consults. Being a marketer changes two screens: the marketer's own card on
 * /apply, and their line on the super admin's desk.
 *
 * Nothing here returns a real name or an email address, and nothing here is
 * ever shown publicly: marketers' handles appear only to super admins.
 */

/**
 * Replies to every application email land here, so a marketer can answer the
 * acceptance email with what they made. Never printed on a page: the site's
 * public contact address is a different one.
 */
export const APPLICATION_REPLY_TO = "kidflash2jahaan@gmail.com";

/**
 * The invite link a marketer's signups are counted through: the referral link
 * the site already hands every account (`teamInviteUrl`, the same string /teams
 * copies and prints). `attributeSignup` (src/lib/signup-attribution.ts) writes
 * `profiles.referred_by` from its `?ref=`, which is what the desk counts. Null
 * without a handle, because the link is keyed on the handle.
 */
export function marketerInviteUrl(username: string | null | undefined): string | null {
  return username ? teamInviteUrl(username) : null;
}

/**
 * The caller's own tag, or null when they don't have one.
 *
 * A read that fails (the migration not applied yet, a network blip) counts as
 * no tag. That is the safe direction: the worst case is that a marketer sees
 * the apply form for a moment, and submitApplication refuses them anyway once
 * the read works.
 */
export async function getMarketerTag(
  userId: string
): Promise<{ grantedAt: string } | null> {
  const { data, error } = await createAdminClient()
    .from("marketers")
    .select("granted_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const grantedAt = data.granted_at as string;
  return { grantedAt: toIso(grantedAt) ?? grantedAt };
}

export type DeskMarketer = {
  userId: string;
  username: string | null;
  teamNumber: number | null;
  grantedAt: string;
  note: string | null;
  /** Every account whose `referred_by` is this marketer, whenever it joined. */
  signups: number;
  /** The same count, only accounts created after the tag was granted. */
  signupsSinceAccepted: number;
  /** The link those signups came through, or null without a handle. */
  inviteUrl: string | null;
};

/**
 * Everyone with the tag, longest-standing first, each with how many people
 * signed up through their invite link. For the super admin's desk only: the
 * caller (loadAdminTeamDesk) has already checked the role.
 *
 * The counts are head-only, like getReferralCount in src/lib/queries.ts: the
 * desk learns how many people a marketer brought in, never who they are. Both
 * are served by profiles_referred_by_idx.
 */
export async function getMarketers(): Promise<DeskMarketer[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("marketers")
    .select("user_id, granted_at, note")
    .order("granted_at", { ascending: true });
  if (error || !data) return [];
  const rows = data as { user_id: string; granted_at: string; note: string | null }[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: profs } = await admin
    .from("profiles")
    .select("id, username, team_number")
    .in("id", ids);
  const handles = new Map<string, { username: string | null; team_number: number | null }>();
  for (const p of (profs as { id: string; username: string | null; team_number: number | null }[]) ?? []) {
    handles.set(p.id, { username: p.username, team_number: p.team_number });
  }

  const count = async (userId: string, since?: string) => {
    let q = admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId);
    if (since) q = q.gte("created_at", since);
    const { count: n } = await q;
    return n ?? 0;
  };

  return Promise.all(
    rows.map(async (r) => {
      const handle = handles.get(r.user_id);
      const [signups, signupsSinceAccepted] = await Promise.all([
        count(r.user_id),
        count(r.user_id, r.granted_at),
      ]);
      return {
        userId: r.user_id,
        username: handle?.username ?? null,
        teamNumber: handle?.team_number ?? null,
        grantedAt: toIso(r.granted_at) ?? r.granted_at,
        note: r.note,
        signups,
        signupsSinceAccepted,
        inviteUrl: marketerInviteUrl(handle?.username),
      } satisfies DeskMarketer;
    })
  );
}

/**
 * Puts the tag on an account. Called by decideApplication once the
 * application's status change has won; the caller rolls that back if this
 * fails. Idempotent: an account that already has the tag keeps its original
 * date.
 */
export async function grantMarketingTag(input: {
  userId: string;
  grantedBy: string;
  applicationId: string;
  note: string | null;
}): Promise<{ ok: boolean }> {
  const { error } = await createAdminClient().from("marketers").upsert(
    {
      user_id: input.userId,
      granted_by: input.grantedBy,
      application_id: input.applicationId,
      note: input.note || "accepted application",
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );
  return { ok: !error };
}

/**
 * Takes the tag off. Super admins only. Their account, progress and the
 * signups already credited to them stay; /apply goes back to offering the form.
 */
export async function removeMarketerFor(
  user: AppUser,
  input: { userId: unknown }
): Promise<Result> {
  const gate = await requireSiteRole(user, "superadmin", NOT_SUPER_ADMIN);
  if (!gate.ok) return gate;

  const userId = textField(input.userId);
  if (userId === null) return fail("validation", BAD_REQUEST);
  if (!userId) return fail("validation", "Missing user.");
  if (!isUuid(userId)) return fail("validation", BAD_REQUEST);

  const { data, error } = await createAdminClient()
    .from("marketers")
    .delete()
    .eq("user_id", userId)
    .select("user_id");
  if (error) return fail("server", "Couldn't remove them. Please try again.");
  if (!data || data.length === 0)
    return fail("not_found", "They aren't on the marketing team any more.");

  revalidateTeamPages();
  return { ok: true };
}
