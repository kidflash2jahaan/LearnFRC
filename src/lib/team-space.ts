import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getTeamSubteamCoverage, type SubteamCoverage } from "@/lib/queries";
import { sendEmail, adminNotifyHtml } from "@/lib/email";
import { headers } from "next/headers";

/**
 * TEAM MODE — the whole server-side surface.
 *
 * WHY THIS FILE EXISTS AT ALL. The old /teams page grouped people by
 * `profiles.team_number`, a self-declared integer anyone can edit in Settings.
 * Typing "254" and reloading handed you that team's roster and every member's
 * lesson progress. Team Mode replaces that with a membership ROW the user
 * created by pressing accept. Nothing in this file reads `profiles.team_number`
 * for authorisation — it is a display label and nothing more.
 *
 * THE RULES EVERY FUNCTION HERE OBEYS
 *  - Authorisation is re-derived server-side on every call from
 *    `auth.getUser()` + a membership row. No caller-supplied role, ownership
 *    flag or "isLead" is ever trusted, and nothing is read out of FormData.
 *  - Not-authorised reads return `not_found`, never `forbidden`, so a probe
 *    cannot confirm that a space exists.
 *  - `full_name`, email, signup_ip, last_seen_at and DOB-adjacent fields are
 *    never selected. Every profile read lists its columns explicitly; there is
 *    no `select("*")` and no `{...profile}` spread anywhere in this file. The
 *    admin client bypasses the column grants that keep real names off public
 *    surfaces, so that discipline is the ONLY thing standing between a whole
 *    team of minors and their legal names.
 *  - The raw `auth.users` UUID never leaves the server. Callers get an opaque,
 *    per-space `memberKey` for React keys, avatar seeds and remove actions.
 *  - No free text travels user→user. There is no note, no description, no
 *    custom space name, no nudge copy and no removal reason — not in the DB
 *    (see the CHECK on team_spaces.name) and not in any signature below.
 *  - Removal is a single DELETE of one membership row. No function here writes
 *    to profiles, lesson_progress, user_achievements or xp for anyone.
 */

// ── result type ─────────────────────────────────────────────────────────────
// Errors are a closed union rather than thrown strings so the UI renders fixed,
// server-authored copy for each case and can never echo attacker input back.
export type TeamSpaceError =
  | "unauthenticated"
  | "not_found"
  | "rate_limited"
  | "taken"
  | "already_in_space"
  | "already_member"
  | "invalid_team_number"
  | "invalid_invite"
  | "blocked"
  | "not_eligible"
  | "server_error";

export type TeamSpaceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: TeamSpaceError };

const ok = <T,>(data: T): TeamSpaceResult<T> => ({ ok: true, data });
const fail = <T,>(error: TeamSpaceError): TeamSpaceResult<T> => ({
  ok: false,
  error,
});

// ── public shapes ───────────────────────────────────────────────────────────
export type SpaceRole = "lead" | "member";
export type MemberStatus = "invited" | "active";

/** A space as its own members see it. */
export type TeamSpace = {
  id: string;
  program: string;
  teamNumber: number;
  /** Always the derived string `Team <n>`. DB CHECK-pinned; never user input. */
  name: string;
  createdAt: string;
  /** The viewer's own standing in this space. */
  myRole: SpaceRole;
};

/** Roster identity only — deliberately carries NO progress. */
export type SpaceMember = {
  /** Opaque per-space handle. Use for React keys, avatar seeds and mutations. */
  memberKey: string;
  username: string;
  avatarUrl: string | null;
  isLead: boolean;
  isSelf: boolean;
  joinedAt: string;
};

/** Roster identity + progress. Lead-only; see listSpaceProgress(). */
export type SpaceMemberProgress = SpaceMember & {
  xp: number;
  /** Lessons finished. The single number this whole feature exists to show. */
  completed: number;
  lastActive: string | null;
};

export type SpaceOverview = {
  space: TeamSpace;
  members: SpaceMember[];
  memberCount: number;
  totalLessons: number;
  /** Distinct lessons finished by ANYONE in the space (not a sum). */
  teamCompleted: number;
};

export type SpaceProgress = {
  space: TeamSpace;
  members: SpaceMemberProgress[];
  totalLessons: number;
  /** Per-subteam coverage, member ids already mapped to opaque memberKeys. */
  coverage: (Omit<SubteamCoverage, "members"> & {
    members: { memberKey: string; completed: number }[];
  })[];
};

/** What the lead sees of their own live link. */
export type SpaceInvite = {
  id: string;
  /** The secret. Only ever produced for a verified lead of this exact space. */
  token: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
};

/** Everything an invitee is shown BEFORE they consent. */
export type InvitePreview = {
  teamNumber: number;
  /** Derived name, safe to render. */
  name: string;
  memberCount: number;
  /** Username only — never the lead's real name, email or avatar. */
  leadUsername: string;
};

export type PlanItem = {
  id: string;
  departmentId: string;
  /** null = suggested for the whole space. */
  memberKey: string | null;
  assignedAt: string;
};

// ── constants ───────────────────────────────────────────────────────────────
const INVITE_TTL_DAYS = 7;
const INVITE_MAX_USES = 25;
/** 128 bits. Un-brute-forceable, and the redeem path is IP rate limited too. */
const INVITE_TOKEN_BYTES = 16;
/**
 * Anti-spam speed bump for creating a space — NOT a trust signal and NOT
 * verification of anything. It exists only so a throwaway account cannot mint
 * spaces the second it is created. Do NOT read this as evidence the creator is
 * an adult, a real mentor, or trustworthy, and do NOT widen what a lead can do
 * on the strength of it.
 */
const MIN_LESSONS_TO_CREATE = 1;

// ── caller identity ─────────────────────────────────────────────────────────
async function currentUserId(): Promise<string | null> {
  // Always auth.getUser(), never a raw cookie read: getUser() revalidates the
  // JWT with the auth server, a decoded cookie proves nothing.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── opaque member ids ───────────────────────────────────────────────────────
/**
 * Per-space HMAC of the auth UUID.
 *
 * The old roster shipped the raw `auth.users` UUID to the browser just to use
 * as a React key. That UUID is a stable cross-surface identifier, and while
 * `user_achievements` remains anon-readable it joins a roster row to that
 * user's complete timestamped achievement history. Emitting an HMAC instead
 * costs nothing and makes the roster non-joinable to anything else. It is
 * per-space, so the same person in two contexts is not correlatable either.
 */
function memberKeyFor(spaceId: string, userId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHmac("sha256", secret)
    .update(`${spaceId}:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

function keyEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Resolve an opaque key back to a real user id, scoped to one space. */
function resolveMemberKey(
  spaceId: string,
  memberKey: string,
  userIds: string[]
): string | null {
  for (const id of userIds) {
    if (keyEquals(memberKeyFor(spaceId, id), memberKey)) return id;
  }
  return null;
}

// ── rate limiting ───────────────────────────────────────────────────────────
/**
 * FAIL-CLOSED rate limit.
 *
 * `rateLimit()` in src/lib/rate-limit.ts deliberately fails OPEN — correct for
 * lesson completion, where a Postgres blip must not block a kid finishing a
 * lesson. It is the wrong default for minting invite links into a space full of
 * minors, so this wrapper treats an infrastructure error as "denied".
 */
async function strictRateLimit(
  action: string,
  max: number,
  windowSeconds: number,
  extraKey?: string
): Promise<boolean> {
  try {
    const h = await headers();
    const ip =
      (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
      h.get("x-real-ip") ||
      "unknown";
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: `${action}:${ip}${extraKey ? `:${extraKey}` : ""}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return false;
    return data !== false;
  } catch {
    return false;
  }
}

// ── membership lookups (service-role, always filtered by the caller) ────────
type MembershipRow = {
  space_id: string;
  user_id: string;
  role: SpaceRole;
  status: MemberStatus;
  joined_at: string | null;
};

type SpaceRow = {
  id: string;
  program: string;
  team_number: number;
  name: string;
  created_by: string;
  created_at: string;
};

const SPACE_COLS = "id, program, team_number, name, created_by, created_at";
/**
 * The ONLY profile columns this feature ever reads. `full_name`, `email`,
 * `signup_ip`, `last_seen_at`, `bio`, `role` and `team_number` are all absent
 * on purpose — a lead must not learn a member's real name, must not get a
 * presence feed on a minor, and must not see a self-asserted "Mentor" badge
 * that would make a stranger's invite look endorsed.
 */
const MEMBER_PROFILE_COLS = "id, username, avatar_url, xp";

/**
 * Authorisation primitive. Returns the space + the caller's membership, or null
 * if the caller is not an ACTIVE member. `requireLead` additionally demands the
 * lead row. Every read/write below goes through this first.
 */
async function authorize(
  spaceId: string,
  opts: { requireLead?: boolean } = {}
): Promise<{ userId: string; space: SpaceRow; membership: MembershipRow } | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const admin = createAdminClient();
  const { data: m } = await admin
    .from("team_space_members")
    .select("space_id, user_id, role, status, joined_at")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const membership = m as MembershipRow | null;
  if (!membership) return null;
  if (opts.requireLead && membership.role !== "lead") return null;
  const { data: s } = await admin
    .from("team_spaces")
    .select(SPACE_COLS)
    .eq("id", spaceId)
    .maybeSingle();
  const space = s as SpaceRow | null;
  if (!space) return null;
  return { userId, space, membership };
}

function toSpace(row: SpaceRow, myRole: SpaceRole): TeamSpace {
  return {
    id: row.id,
    program: row.program,
    teamNumber: row.team_number,
    name: row.name,
    createdAt: row.created_at,
    myRole,
  };
}

// ── reads ───────────────────────────────────────────────────────────────────

/**
 * The caller's own space, or null. Safe to call on any authed page — it reads
 * nothing about anyone else.
 */
export async function getMyTeamSpace(): Promise<TeamSpace | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const admin = createAdminClient();
  const { data: m } = await admin
    .from("team_space_members")
    .select("space_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const row = m as { space_id: string; role: SpaceRole } | null;
  if (!row) return null;
  const { data: s } = await admin
    .from("team_spaces")
    .select(SPACE_COLS)
    .eq("id", row.space_id)
    .maybeSingle();
  return s ? toSpace(s as SpaceRow, row.role) : null;
}

/** Whether a space already exists for a program+number. No identities leak. */
export async function isTeamNumberClaimed(
  teamNumber: number,
  program = "frc"
): Promise<boolean> {
  if (!Number.isInteger(teamNumber) || teamNumber < 1 || teamNumber > 99999)
    return false;
  const admin = createAdminClient();
  const { count } = await admin
    .from("team_spaces")
    .select("id", { count: "exact", head: true })
    .eq("program", program)
    .eq("team_number", teamNumber);
  return (count ?? 0) > 0;
}

async function activeMemberRows(spaceId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_space_members")
    .select("user_id, role, joined_at")
    .eq("space_id", spaceId)
    .eq("status", "active");
  return (data ?? []) as {
    user_id: string;
    role: SpaceRole;
    joined_at: string;
  }[];
}

/**
 * The member-facing view: who is in the space and how far the space has got
 * BETWEEN them. Deliberately carries no per-member progress — the brief grants
 * per-member visibility to the lead only, so members see the aggregate.
 * Available to any ACTIVE member.
 */
export async function getSpaceOverview(
  spaceId: string
): Promise<TeamSpaceResult<SpaceOverview>> {
  const auth = await authorize(spaceId);
  if (!auth) return fail("not_found");
  const admin = createAdminClient();
  const rows = await activeMemberRows(spaceId);
  const ids = rows.map((r) => r.user_id);

  const [{ count: totalLessons }, { data: profs }] = await Promise.all([
    admin.from("lessons").select("id", { count: "exact", head: true }),
    ids.length
      ? admin.from("profiles").select(MEMBER_PROFILE_COLS).in("id", ids)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const byId = new Map<string, { username: string | null; avatar_url: string | null }>();
  for (const p of (profs ?? []) as {
    id: string;
    username: string | null;
    avatar_url: string | null;
  }[]) {
    byId.set(p.id, { username: p.username, avatar_url: p.avatar_url });
  }

  const members: SpaceMember[] = rows
    .map((r) => ({
      memberKey: memberKeyFor(spaceId, r.user_id),
      username: byId.get(r.user_id)?.username || "Member",
      avatarUrl: byId.get(r.user_id)?.avatar_url ?? null,
      isLead: r.role === "lead",
      isSelf: r.user_id === auth.userId,
      joinedAt: r.joined_at,
    }))
    .sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.joinedAt.localeCompare(b.joinedAt));

  const done = await distinctLessonsFinished(ids);

  return ok({
    space: toSpace(auth.space, auth.membership.role),
    members,
    memberCount: rows.length,
    totalLessons: totalLessons ?? 0,
    teamCompleted: done,
  });
}

/**
 * Lead-only: per-member lesson progress for members who ACCEPTED, plus subteam
 * coverage. This is the one genuinely privileged read in the feature, which is
 * why authorize({requireLead}) runs before a single cross-user row is fetched.
 */
export async function listSpaceProgress(
  spaceId: string
): Promise<TeamSpaceResult<SpaceProgress>> {
  const auth = await authorize(spaceId, { requireLead: true });
  if (!auth) return fail("not_found");
  const admin = createAdminClient();
  const rows = await activeMemberRows(spaceId);
  const ids = rows.map((r) => r.user_id);

  const [{ count: totalLessons }, { data: profs }] = await Promise.all([
    admin.from("lessons").select("id", { count: "exact", head: true }),
    ids.length
      ? admin.from("profiles").select(MEMBER_PROFILE_COLS).in("id", ids)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const prof = new Map<
    string,
    { username: string | null; avatar_url: string | null; xp: number | null }
  >();
  for (const p of (profs ?? []) as {
    id: string;
    username: string | null;
    avatar_url: string | null;
    xp: number | null;
  }[]) {
    prof.set(p.id, { username: p.username, avatar_url: p.avatar_url, xp: p.xp });
  }

  const { counts, last } = await progressByUser(ids);

  const members: SpaceMemberProgress[] = rows
    .map((r) => ({
      memberKey: memberKeyFor(spaceId, r.user_id),
      username: prof.get(r.user_id)?.username || "Member",
      avatarUrl: prof.get(r.user_id)?.avatar_url ?? null,
      isLead: r.role === "lead",
      isSelf: r.user_id === auth.userId,
      joinedAt: r.joined_at,
      xp: prof.get(r.user_id)?.xp ?? 0,
      completed: counts[r.user_id] ?? 0,
      lastActive: last[r.user_id] ?? null,
    }))
    .sort((a, b) => b.completed - a.completed || b.xp - a.xp);

  // Reuses the existing, already-paged coverage query, then swaps every raw
  // UUID for this space's opaque key before anything can reach a client.
  const raw = ids.length ? await getTeamSubteamCoverage(ids) : [];
  const coverage = raw.map((c) => ({
    ...c,
    members: c.members.map((m) => ({
      memberKey: memberKeyFor(spaceId, m.userId),
      completed: m.completed,
    })),
  }));

  return ok({
    space: toSpace(auth.space, auth.membership.role),
    members,
    totalLessons: totalLessons ?? 0,
    coverage,
  });
}

/**
 * Per-user completion counts and last-active timestamps.
 *
 * PAGED, not a plain .select(): PostgREST caps a response at 1000 rows and
 * truncates SILENTLY. A 15-person space is already past 800 lesson_progress
 * rows, and a truncated read would under-report progress MORE the harder the
 * team worked — the exact inversion of what this view is for.
 */
async function progressByUser(ids: string[]): Promise<{
  counts: Record<string, number>;
  last: Record<string, string>;
}> {
  const counts: Record<string, number> = {};
  const last: Record<string, string> = {};
  if (!ids.length) return { counts, last };
  const admin = createAdminClient();
  const PAGE = 1000;
  // Bounded defensively: `.in()` builds a URL, and no real team is this big.
  const scoped = ids.slice(0, 200);
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("lesson_progress")
      .select("user_id, completed_at")
      .in("user_id", scoped)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as { user_id: string; completed_at: string }[];
    for (const r of chunk) {
      counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
      if (!last[r.user_id] || r.completed_at > last[r.user_id])
        last[r.user_id] = r.completed_at;
    }
    if (chunk.length < PAGE) break;
  }
  return { counts, last };
}

/** Distinct lessons finished by anyone in the set. Same paging trap applies. */
async function distinctLessonsFinished(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const admin = createAdminClient();
  const seen = new Set<string>();
  const PAGE = 1000;
  const scoped = ids.slice(0, 200);
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("lesson_progress")
      .select("lesson_id")
      .in("user_id", scoped)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as { lesson_id: string }[];
    for (const r of chunk) seen.add(r.lesson_id);
    if (chunk.length < PAGE) break;
  }
  return seen.size;
}

// ── create / claim a space ──────────────────────────────────────────────────

/**
 * Claim the space for a team number. First claimer wins — a second claim on the
 * same number is refused with `taken` and the claimer should be pointed at
 * "ask your team for the invite link", never at an ownership-transfer flow.
 *
 * Anyone may do this. The capability is "you own this row", earned by creating
 * it — not "you are a mentor", claimed from a dropdown. profiles.role is not
 * consulted here and must never be.
 */
export async function createTeamSpace(input: {
  teamNumber: number;
  program?: string;
}): Promise<TeamSpaceResult<TeamSpace>> {
  const userId = await currentUserId();
  if (!userId) return fail("unauthenticated");

  const program = input.program === "ftc" || input.program === "fll" ? input.program : "frc";
  const n = Number(input.teamNumber);
  if (!Number.isInteger(n) || n < 1 || n > 99999) return fail("invalid_team_number");

  if (!(await strictRateLimit("space-create", 2, 86400, userId)))
    return fail("rate_limited");

  const supabase = await createClient();
  // The caller's own progress, read under their own RLS — no admin client
  // needed, and no other user's rows are touched.
  const { count: myLessons } = await supabase
    .from("lesson_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((myLessons ?? 0) < MIN_LESSONS_TO_CREATE) return fail("not_eligible");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("team_space_members")
    .select("space_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return fail("already_in_space");

  const { data, error } = await admin
    .from("team_spaces")
    .insert({
      program,
      team_number: n,
      // DERIVED. There is no code path anywhere that lets a human type this.
      name: `Team ${n}`,
      created_by: userId,
    })
    .select(SPACE_COLS)
    .single();

  if (error) {
    // 23505 = unique violation. Three indexes can raise it, and they mean
    // different things to the caller:
    //   team_space_members_one_active_per_user → they joined a space between
    //     the check above and this insert (the seed-lead trigger caught it),
    //   otherwise → the number is claimed, or this account already owns a
    //     space. Both read as "taken", and neither reveals who holds it.
    if (error.code === "23505") {
      return fail(
        error.message?.includes("one_active_per_user") ? "already_in_space" : "taken"
      );
    }
    return fail("server_error");
  }

  // Cheapest, strongest child-safety control available at this scale: a human
  // eyeballs 100% of space creations. Fire-and-forget — a mail failure must
  // never roll back a legitimate space.
  void notifyAdmin("New team space created", [
    { label: "Team", value: `${program.toUpperCase()} ${n}` },
    { label: "Space", value: (data as SpaceRow).id },
  ]);

  // The lead membership row and the audit entry are written by the
  // team_spaces_seed_lead trigger, so "space with no lead" is unrepresentable.
  return ok(toSpace(data as SpaceRow, "lead"));
}

/** A lead's own exit. Cascades: members, invites, plan items, events. */
export async function deleteTeamSpace(
  spaceId: string
): Promise<TeamSpaceResult<true>> {
  const auth = await authorize(spaceId, { requireLead: true });
  if (!auth) return fail("not_found");
  const admin = createAdminClient();
  await admin.from("team_spaces").delete().eq("id", spaceId);
  return ok(true as const);
}

// ── invites ─────────────────────────────────────────────────────────────────

/**
 * Mint the space's invite link, revoking whatever link was live before.
 *
 * Rotation IS revocation: the DB carries a partial unique index allowing at
 * most one un-revoked invite per space, so a leaked link dies the moment a new
 * one is made and forgotten live links cannot accumulate.
 *
 * Link-only by design. There is no invite-by-email and no invite-by-username:
 * email would turn LearnFRC into an outbound-mail primitive pointed at
 * strangers, and a username lookup would answer "does this person have an
 * account", which is an oracle against a specific named child. The lead pastes
 * this into the Discord the team already uses.
 */
export async function createSpaceInvite(
  spaceId: string,
  opts: { days?: number; maxUses?: number } = {}
): Promise<TeamSpaceResult<SpaceInvite>> {
  const auth = await authorize(spaceId, { requireLead: true });
  if (!auth) return fail("not_found");

  if (!(await strictRateLimit("team-invite", 10, 86400, auth.userId)))
    return fail("rate_limited");
  if (!(await strictRateLimit("team-invite-ip", 30, 86400)))
    return fail("rate_limited");

  const days = clamp(opts.days ?? INVITE_TTL_DAYS, 1, INVITE_TTL_DAYS);
  const maxUses = clamp(opts.maxUses ?? INVITE_MAX_USES, 1, 100);
  const token = randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
  const admin = createAdminClient();

  await admin
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("space_id", spaceId)
    .is("revoked_at", null);

  const { data, error } = await admin
    .from("team_invites")
    .insert({
      space_id: spaceId,
      token,
      created_by: auth.userId,
      expires_at: new Date(Date.now() + days * 86400_000).toISOString(),
      max_uses: maxUses,
    })
    .select("id, expires_at, max_uses, uses")
    .single();
  if (error || !data) return fail("server_error");

  await logEvent(spaceId, auth.userId, "invite_create", null);

  const row = data as {
    id: string;
    expires_at: string;
    max_uses: number;
    uses: number;
  };
  return ok({
    id: row.id,
    token,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    uses: row.uses,
  });
}

/**
 * The lead's live link, or null. Reads `token`, which no client role can select
 * (the column has no grant to anon or authenticated at all) — so this is the
 * only way the secret is ever produced, and only after leadership is re-derived.
 */
export async function getSpaceInvite(
  spaceId: string
): Promise<TeamSpaceResult<SpaceInvite | null>> {
  const auth = await authorize(spaceId, { requireLead: true });
  if (!auth) return fail("not_found");
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_invites")
    .select("id, token, expires_at, max_uses, uses")
    .eq("space_id", spaceId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return ok(null);
  const row = data as {
    id: string;
    token: string;
    expires_at: string;
    max_uses: number;
    uses: number;
  };
  if (row.uses >= row.max_uses) return ok(null);
  return ok({
    id: row.id,
    token: row.token,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    uses: row.uses,
  });
}

/** Kill the live link without minting a replacement. */
export async function revokeSpaceInvite(
  spaceId: string
): Promise<TeamSpaceResult<true>> {
  const auth = await authorize(spaceId, { requireLead: true });
  if (!auth) return fail("not_found");
  const admin = createAdminClient();
  await admin
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("space_id", spaceId)
    .is("revoked_at", null);
  await logEvent(spaceId, auth.userId, "invite_revoke", null);
  return ok(true as const);
}

/**
 * What the consent screen may show BEFORE the user presses accept.
 *
 * Clicking a link confers nothing. This returns the team number, how many
 * people are in the space and the lead's USERNAME — no member list, no
 * avatars, no progress, no real names, no email. Requires an authenticated
 * account so the link is not an anonymous oracle, and returns a single
 * `invalid_invite` for expired, revoked, exhausted and non-existent tokens
 * alike, so probing never confirms that a space exists.
 */
export async function previewInvite(
  token: string
): Promise<TeamSpaceResult<InvitePreview>> {
  const userId = await currentUserId();
  if (!userId) return fail("unauthenticated");
  if (!token || token.length > 128) return fail("invalid_invite");
  if (!(await strictRateLimit("invite-preview", 20, 3600)))
    return fail("rate_limited");

  const admin = createAdminClient();
  const { data } = await admin
    .from("team_invites")
    .select("space_id, expires_at, max_uses, uses, revoked_at")
    .eq("token", token)
    .maybeSingle();
  const inv = data as {
    space_id: string;
    expires_at: string;
    max_uses: number;
    uses: number;
    revoked_at: string | null;
  } | null;
  if (
    !inv ||
    inv.revoked_at ||
    new Date(inv.expires_at) <= new Date() ||
    inv.uses >= inv.max_uses
  )
    return fail("invalid_invite");

  const { data: s } = await admin
    .from("team_spaces")
    .select("team_number, name, created_by")
    .eq("id", inv.space_id)
    .maybeSingle();
  const space = s as {
    team_number: number;
    name: string;
    created_by: string;
  } | null;
  if (!space) return fail("invalid_invite");

  const { count } = await admin
    .from("team_space_members")
    .select("user_id", { count: "exact", head: true })
    .eq("space_id", inv.space_id)
    .eq("status", "active");

  const { data: lead } = await admin
    .from("profiles")
    .select("username")
    .eq("id", space.created_by)
    .maybeSingle();

  return ok({
    teamNumber: space.team_number,
    name: space.name,
    memberCount: count ?? 0,
    leadUsername: (lead as { username: string | null } | null)?.username || "a teammate",
  });
}

/**
 * The consent moment. Everything the space will see about this user starts
 * here and stops the instant the membership row goes away.
 *
 * The UI calling this MUST have shown, in these words or closer: "Team <n>'s
 * space will see which lessons you have completed and when you were last
 * active. They will not see your name or your email. You can leave at any
 * time." Consent that does not name the fields and the audience is not consent.
 *
 * Validation, membership insert, use-count increment and the audit entry all
 * happen inside one Postgres function so a 25-use link cannot be redeemed 40
 * times under concurrency.
 */
export async function acceptInvite(
  token: string
): Promise<TeamSpaceResult<{ spaceId: string; alreadyMember: boolean }>> {
  const userId = await currentUserId();
  if (!userId) return fail("unauthenticated");
  if (!token || token.length > 128) return fail("invalid_invite");
  // Doubles as the short-token brute-force guard.
  if (!(await strictRateLimit("invite-redeem", 10, 3600)))
    return fail("rate_limited");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_team_invite", {
    p_token: token,
    p_user: userId,
  });
  if (error) return fail("server_error");
  const res = data as { ok: boolean; reason: string; space_id?: string };
  if (!res?.ok) {
    if (res?.reason === "blocked") return fail("blocked");
    if (res?.reason === "already_in_another_space") return fail("already_in_space");
    return fail("invalid_invite");
  }
  return ok({
    spaceId: res.space_id as string,
    alreadyMember: res.reason === "already_member",
  });
}

// ── membership changes ──────────────────────────────────────────────────────

/**
 * One-click leave, from the member's OWN settings — no lead approval, no
 * notice period. Because progress is read by joining THROUGH this row and is
 * never denormalised onto the space, deleting it revokes the lead's visibility
 * instantly and automatically.
 *
 * A lead cannot leave (it would orphan a space full of minors); they delete the
 * space instead.
 */
export async function leaveSpace(
  spaceId: string,
  opts: { block?: boolean } = {}
): Promise<TeamSpaceResult<true>> {
  const auth = await authorize(spaceId);
  if (!auth) return fail("not_found");
  if (auth.membership.role === "lead") return fail("not_found");
  const admin = createAdminClient();
  await admin
    .from("team_space_members")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", auth.userId);
  await logEvent(spaceId, auth.userId, "leave", auth.userId);
  if (opts.block) await blockSpace(spaceId, auth.userId);
  return ok(true as const);
}

/**
 * Lead removes a member. By design this damages nothing: it is exactly one
 * DELETE against one membership row and touches no other table. XP, badges and
 * every completed lesson survive untouched, and the person can rejoin with a
 * fresh link.
 *
 * Takes the opaque memberKey, so the caller never had to hold a real user id.
 */
export async function removeSpaceMember(
  spaceId: string,
  memberKey: string
): Promise<TeamSpaceResult<true>> {
  const auth = await authorize(spaceId, { requireLead: true });
  if (!auth) return fail("not_found");
  const rows = await activeMemberRows(spaceId);
  const targetId = resolveMemberKey(
    spaceId,
    memberKey,
    rows.filter((r) => r.role !== "lead").map((r) => r.user_id)
  );
  // A lead cannot remove themselves, and cannot reach outside this space.
  if (!targetId || targetId === auth.userId) return fail("not_found");

  const admin = createAdminClient();
  await admin
    .from("team_space_members")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", targetId);
  await logEvent(spaceId, auth.userId, "remove", targetId);
  return ok(true as const);
}

/**
 * The member's permanent veto: no link from this space can admit them again,
 * whatever the lead does, and it survives leaving. This is what makes "leave"
 * safe to offer without approval, and it is the anti-harassment backstop
 * against remove-and-reinvite churn.
 */
export async function blockSpace(
  spaceId: string,
  knownUserId?: string
): Promise<TeamSpaceResult<true>> {
  const userId = knownUserId ?? (await currentUserId());
  if (!userId) return fail("unauthenticated");
  const admin = createAdminClient();
  const { error } = await admin
    .from("team_space_blocks")
    .upsert({ space_id: spaceId, user_id: userId }, { onConflict: "space_id,user_id" });
  // Unknown space id → FK violation. Report it the same as any other failure so
  // this is not a space-existence oracle.
  if (error) return fail("not_found");
  await logEvent(spaceId, userId, "block", userId);
  return ok(true as const);
}

export async function unblockSpace(spaceId: string): Promise<TeamSpaceResult<true>> {
  const userId = await currentUserId();
  if (!userId) return fail("unauthenticated");
  const admin = createAdminClient();
  await admin
    .from("team_space_blocks")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", userId);
  return ok(true as const);
}

// ── training plan ───────────────────────────────────────────────────────────

/**
 * "Assign a suggested training plan." The entire payload is a DEPARTMENT ID
 * from the existing fixed catalog — there is no title, no note and no due date,
 * because any of those would be a free-text channel from an adult to a minor.
 * `memberKey` omitted = suggested for the whole space.
 */
export async function setPlanItem(
  spaceId: string,
  input: { departmentId: string; memberKey?: string | null }
): Promise<TeamSpaceResult<PlanItem>> {
  const auth = await authorize(spaceId, { requireLead: true });
  if (!auth) return fail("not_found");
  const admin = createAdminClient();

  const { data: dept } = await admin
    .from("departments")
    .select("id")
    .eq("id", input.departmentId)
    .maybeSingle();
  if (!dept) return fail("not_found");

  let targetId: string | null = null;
  if (input.memberKey) {
    const rows = await activeMemberRows(spaceId);
    targetId = resolveMemberKey(spaceId, input.memberKey, rows.map((r) => r.user_id));
    if (!targetId) return fail("not_found");
  }

  const { data, error } = await admin
    .from("team_space_plan_items")
    .upsert(
      {
        space_id: spaceId,
        user_id: targetId,
        department_id: input.departmentId,
        assigned_by: auth.userId,
      },
      { onConflict: "space_id,user_id,department_id" }
    )
    .select("id, department_id, user_id, assigned_at")
    .single();
  if (error || !data) return fail("server_error");

  await logEvent(spaceId, auth.userId, "plan_set", targetId);
  const row = data as {
    id: string;
    department_id: string;
    user_id: string | null;
    assigned_at: string;
  };
  return ok({
    id: row.id,
    departmentId: row.department_id,
    memberKey: row.user_id ? memberKeyFor(spaceId, row.user_id) : null,
    assignedAt: row.assigned_at,
  });
}

export async function clearPlanItem(
  spaceId: string,
  planItemId: string
): Promise<TeamSpaceResult<true>> {
  const auth = await authorize(spaceId, { requireLead: true });
  if (!auth) return fail("not_found");
  const admin = createAdminClient();
  // Scoped by space_id as well as id: an id from another space matches nothing.
  await admin
    .from("team_space_plan_items")
    .delete()
    .eq("id", planItemId)
    .eq("space_id", spaceId);
  await logEvent(spaceId, auth.userId, "plan_clear", null);
  return ok(true as const);
}

/** The space's plan. Visible to any ACTIVE member — it is advice, not data. */
export async function getSpacePlan(
  spaceId: string
): Promise<TeamSpaceResult<PlanItem[]>> {
  const auth = await authorize(spaceId);
  if (!auth) return fail("not_found");
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_space_plan_items")
    .select("id, department_id, user_id, assigned_at")
    .eq("space_id", spaceId)
    .order("assigned_at", { ascending: true });
  const rows = (data ?? []) as {
    id: string;
    department_id: string;
    user_id: string | null;
    assigned_at: string;
  }[];
  return ok(
    rows.map((r) => ({
      id: r.id,
      departmentId: r.department_id,
      memberKey: r.user_id ? memberKeyFor(spaceId, r.user_id) : null,
      assignedAt: r.assigned_at,
    }))
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────
function clamp(n: number, lo: number, hi: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(v)));
}

type SpaceEventAction =
  | "invite_create"
  | "invite_revoke"
  | "accept"
  | "leave"
  | "remove"
  | "block"
  | "plan_set"
  | "plan_clear";

/**
 * The record that lets a parent or a school be answered later. Fixed
 * vocabulary, no free-text column — the log must not become a message channel.
 * Never blocks the operation it describes.
 */
async function logEvent(
  spaceId: string,
  actorId: string,
  action: SpaceEventAction,
  targetUserId: string | null
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("team_space_events").insert({
      space_id: spaceId,
      actor_id: actorId,
      action,
      target_user_id: targetUserId,
    });
  } catch {
    // Audit failure must not fail the user's action.
  }
}

/**
 * Human review is the strongest child-safety control available at 347 users and
 * it costs one email. Body is entirely server-authored — no lead-supplied text
 * ever reaches an inbox.
 */
async function notifyAdmin(
  heading: string,
  rows: { label: string; value: string }[]
): Promise<void> {
  try {
    const to = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
    if (!to) return;
    await sendEmail({
      to,
      subject: `LearnFRC — ${heading}`,
      html: adminNotifyHtml({ heading, rows }),
    });
  } catch {
    // Never let a mail failure roll back a legitimate action.
  }
}
