import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail, type SiteRole } from "@/lib/auth";

/**
 * Reads for the admin team: who is on it, who has applied.
 *
 * Nothing here returns a real name or an email address. The public handle
 * (`username`) and the team number are the only identifiers the panel gets,
 * so a volunteer admin can do the job without seeing anyone's personal data.
 * Both tables are RLS-locked, so every read is service-role and the CALLER's
 * role must be checked by whoever calls these.
 */

export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type AdminApplication = {
  id: string;
  userId: string;
  /** Public handle, or null if they never picked one. Never the real name. */
  username: string | null;
  teamNumber: number | null;
  teamRole: string | null;
  experience: string;
  why: string;
  availability: string | null;
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type TeamMember = {
  userId: string;
  username: string | null;
  teamNumber: number | null;
  role: Exclude<SiteRole, "member">;
  grantedAt: string;
  note: string | null;
  /** Listed in ADMIN_EMAILS: a super admin by configuration, so the panel
      cannot demote or remove them. */
  isOwner: boolean;
};

type Handle = { username: string | null; team_number: number | null };

/** Public handles for a set of user ids. One query, no names, no emails. */
async function handlesFor(userIds: string[]): Promise<Map<string, Handle>> {
  const map = new Map<string, Handle>();
  if (userIds.length === 0) return map;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, team_number")
    .in("id", userIds);
  for (const row of (data as { id: string; username: string | null; team_number: number | null }[]) ?? []) {
    map.set(row.id, { username: row.username, team_number: row.team_number });
  }
  return map;
}

function toApplication(
  r: Record<string, unknown>,
  handle?: Handle
): AdminApplication {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    username: handle?.username ?? null,
    teamNumber: (r.team_number as number | null) ?? handle?.team_number ?? null,
    teamRole: (r.team_role as string | null) ?? null,
    experience: (r.experience as string) ?? "",
    why: (r.why as string) ?? "",
    availability: (r.availability as string | null) ?? null,
    status: (r.status as ApplicationStatus) ?? "pending",
    createdAt: r.created_at as string,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
    reviewNote: (r.review_note as string | null) ?? null,
  };
}

const APP_COLUMNS =
  "id, user_id, team_number, team_role, experience, why, availability, status, created_at, reviewed_at, review_note";

/** The caller's most recent application, so /apply can show where it stands. */
export async function getMyApplication(
  userId: string
): Promise<AdminApplication | null> {
  const { data } = await createAdminClient()
    .from("admin_applications")
    .select(APP_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const handles = await handlesFor([userId]);
  return toApplication(data as Record<string, unknown>, handles.get(userId));
}

/** Applications for the super admin's desk. Pending first, newest first. */
export async function getApplications(
  status: ApplicationStatus | "all" = "all",
  limit = 60
): Promise<AdminApplication[]> {
  let q = createAdminClient()
    .from("admin_applications")
    .select(APP_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  const rows = (data as Record<string, unknown>[]) ?? [];
  const handles = await handlesFor(rows.map((r) => r.user_id as string));
  return rows.map((r) => toApplication(r, handles.get(r.user_id as string)));
}

/**
 * The decision log: everything already answered, most recently answered first.
 *
 * A separate read rather than a slice of `getApplications("all")`, because that
 * one is ordered by when an application ARRIVED and this list is ordered by
 * when it was DECIDED. Cutting a window by one order and then sorting it by the
 * other silently drops rows: clear a burst of new applications, then work
 * through an old backlog, and those decisions sit past the window in creation
 * order and never appear at all. Ordering and cutting by the same column is the
 * only way the list can be what it says it is.
 *
 * It also leaves `experience` and `why` behind. The log prints a date, a
 * handle, a decision and a note, so pulling two 3000-character answers per row
 * to throw them away is most of the bytes on the page for none of the content.
 */
export async function getDecidedApplications(
  limit = 30
): Promise<AdminApplication[]> {
  const { data } = await createAdminClient()
    .from("admin_applications")
    .select("id, user_id, team_number, team_role, availability, status, created_at, reviewed_at, review_note")
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  const rows = (data as Record<string, unknown>[]) ?? [];
  const handles = await handlesFor(rows.map((r) => r.user_id as string));
  return rows.map((r) => toApplication(r, handles.get(r.user_id as string)));
}

/** Everyone with site authority, owners first, then by when they joined. */
export async function getAdminTeam(): Promise<TeamMember[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("site_admins")
    .select("user_id, role, granted_at, note")
    .order("granted_at", { ascending: true });
  const rows =
    (data as { user_id: string; role: "admin" | "superadmin"; granted_at: string; note: string | null }[]) ?? [];
  const handles = await handlesFor(rows.map((r) => r.user_id));

  // Owner status comes from the account's email, which never leaves this
  // function: it is compared against ADMIN_EMAILS and discarded.
  const members = await Promise.all(
    rows.map(async (r) => {
      const { data: u } = await admin.auth.admin.getUserById(r.user_id);
      const handle = handles.get(r.user_id);
      return {
        userId: r.user_id,
        username: handle?.username ?? null,
        teamNumber: handle?.team_number ?? null,
        role: r.role,
        grantedAt: r.granted_at,
        note: r.note,
        isOwner: isOwnerEmail(u?.user?.email),
      } satisfies TeamMember;
    })
  );
  return members.sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
}

/** Just the count, for the line on /admin that says applications are waiting. */
export async function getPendingApplicationCount(): Promise<number> {
  const { count } = await createAdminClient()
    .from("admin_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
