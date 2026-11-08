import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminNotifyHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { mailAfter } from "@/lib/app/admin-notify";
import { normalizeUsername } from "@/lib/app/profile";
import { textField } from "@/lib/app/admin-access";
import { toIso } from "@/lib/app/format";
import { fail, type AppUser, type Result } from "@/lib/app/result";

/**
 * Blocking, shared by the website (the block control on /u/<username>, the
 * list in Settings, and every page that hides a blocked account) and the app's
 * /api/app/blocks routes.
 *
 * WHAT A BLOCK DOES. It hides the blocked account from the person who blocked
 * it: their profile page, their rows on the leaderboards, their row on the
 * team sheet, and their suggested edits and lesson proposals on
 * /contributions. Nothing is sent to the blocked account and nothing changes
 * for anyone else. Profiles are public pages, so a block is a filter on what
 * the blocker sees, not a wall. A new block also emails the owner, so the
 * blocked account can be looked at (tellOwnerAboutBlock below).
 *
 * `user_blocks` is written only here, with the service role, scoped by the id
 * the auth server verified. People are named by username at the edges (the
 * app's payloads carry no user ids) and by id in the table.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

/** Per account. Far past any honest use, and it keeps the filters cheap. */
export const MAX_BLOCKS = 500;
const BLOCK_RATE_MAX = 60;
const BLOCK_RATE_WINDOW = 3600;

export const BLOCK_SENTENCES = {
  missing: "Pick someone to block.",
  notFound: "There's no learner with that username.",
  self: "You can't block yourself.",
  rate: "That's a lot of blocks in an hour. Try again in a bit.",
  full: "You've blocked as many accounts as you can. Unblock someone in Settings first.",
  save: "Couldn't save that. Try again.",
} as const;

/** One account the caller has blocked, as Settings lists it. */
export type BlockedAccount = {
  /** The account's handle now (it can change after the block). */
  username: string | null;
  avatarUrl: string | null;
  blockedAt: string | null;
};

/**
 * Who the viewer has blocked. `ids` for the website, whose rows carry user
 * ids; `usernames` (lowercased) for anything keyed by handle, like the app's
 * leaderboard payload.
 */
export type BlockedSet = { ids: Set<string>; usernames: Set<string> };

export function emptyBlockedSet(): BlockedSet {
  return { ids: new Set(), usernames: new Set() };
}

/**
 * The viewer's blocks, for filtering what a page shows them. Fails open: a
 * read error (or the table not existing yet) returns an empty set rather than
 * breaking the leaderboard, the team sheet or a profile.
 */
export async function blockedSetFor(viewerId: string | null | undefined): Promise<BlockedSet> {
  if (!viewerId) return emptyBlockedSet();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", viewerId)
      .limit(MAX_BLOCKS);
    if (error || !data || data.length === 0) return emptyBlockedSet();
    const ids = new Set(data.map((r) => r.blocked_id as string));
    const { data: profs } = await admin
      .from("profiles")
      .select("id, username")
      .in("id", [...ids]);
    const usernames = new Set<string>();
    for (const p of profs ?? []) {
      const u = (p.username as string | null)?.toLowerCase();
      if (u) usernames.add(u);
    }
    return { ids, usernames };
  } catch {
    return emptyBlockedSet();
  }
}

/** Whether `viewerId` has blocked `targetId`. False on any error. */
export async function hasBlocked(
  viewerId: string | null | undefined,
  targetId: string | null | undefined
): Promise<boolean> {
  if (!viewerId || !targetId || viewerId === targetId) return false;
  try {
    const { data, error } = await createAdminClient()
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", viewerId)
      .eq("blocked_id", targetId)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

/** Drops rows by blocked user id (the website's boards and team sheet). */
export function withoutBlockedIds<T>(rows: T[], blocked: BlockedSet, idOf: (row: T) => string | null | undefined): T[] {
  if (blocked.ids.size === 0) return rows;
  return rows.filter((r) => {
    const id = idOf(r);
    return !id || !blocked.ids.has(id);
  });
}

/** Drops rows by blocked handle (anything that carries a username, not an id). */
export function withoutBlockedUsernames<T>(
  rows: T[],
  blocked: BlockedSet,
  usernameOf: (row: T) => string | null | undefined
): T[] {
  if (blocked.usernames.size === 0) return rows;
  return rows.filter((r) => {
    const u = usernameOf(r)?.toLowerCase();
    return !u || !blocked.usernames.has(u);
  });
}

/** The account a handle names, or null. Exact match on the normalised handle. */
async function accountByUsername(
  raw: string
): Promise<{ id: string; username: string; avatarUrl: string | null } | null> {
  const username = normalizeUsername(raw);
  if (!username) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("username", username)
    .maybeSingle();
  if (!data?.username) return null;
  return {
    id: data.id as string,
    username: data.username as string,
    avatarUrl: (data.avatar_url as string | null) ?? null,
  };
}

/** Everyone the caller has blocked, newest first. */
export async function listBlocks(user: AppUser): Promise<Result<{ blocks: BlockedAccount[] }>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_BLOCKS);
  if (error) return fail("server", "Couldn't load the accounts you've blocked. Try again.");
  const rows = data ?? [];
  if (rows.length === 0) return { ok: true, blocks: [] };

  const { data: profs } = await admin
    .from("profiles")
    .select("id, username, avatar_url")
    .in(
      "id",
      rows.map((r) => r.blocked_id as string)
    );
  const byId = new Map((profs ?? []).map((p) => [p.id as string, p]));
  return {
    ok: true,
    blocks: rows.map((r) => {
      const p = byId.get(r.blocked_id as string);
      return {
        username: (p?.username as string | null) ?? null,
        avatarUrl: (p?.avatar_url as string | null) ?? null,
        blockedAt: toIso(r.created_at as string),
      };
    }),
  };
}

/**
 * Block an account by its handle. Blocking someone already blocked answers
 * success with the existing row, so a double tap is harmless.
 */
export async function blockUser(
  user: AppUser,
  input: { username: unknown }
): Promise<Result<{ block: BlockedAccount }>> {
  const raw = textField(input.username);
  if (raw === null) return fail("validation", "That request wasn't in the format we expected.");
  if (!raw) return fail("validation", BLOCK_SENTENCES.missing);

  const target = await accountByUsername(raw);
  if (!target) return fail("not_found", BLOCK_SENTENCES.notFound);
  if (target.id === user.id) return fail("validation", BLOCK_SENTENCES.self);

  if (!(await rateLimit("block", BLOCK_RATE_MAX, BLOCK_RATE_WINDOW, user.id)))
    return fail("rate_limited", BLOCK_SENTENCES.rate, BLOCK_RATE_WINDOW);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("user_blocks")
    .select("created_at")
    .eq("blocker_id", user.id)
    .eq("blocked_id", target.id)
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      block: {
        username: target.username,
        avatarUrl: target.avatarUrl,
        blockedAt: toIso(existing.created_at as string),
      },
    };
  }

  const { count } = await admin
    .from("user_blocks")
    .select("blocked_id", { count: "exact", head: true })
    .eq("blocker_id", user.id);
  if ((count ?? 0) >= MAX_BLOCKS) return fail("validation", BLOCK_SENTENCES.full);

  const blockedAt = new Date().toISOString();
  const { error } = await admin
    .from("user_blocks")
    .upsert(
      { blocker_id: user.id, blocked_id: target.id, created_at: blockedAt },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }
    );
  if (error) {
    console.error("blockUser:", error.message);
    return fail("server", BLOCK_SENTENCES.save);
  }
  await tellOwnerAboutBlock(user.id, target.username);
  return {
    ok: true,
    block: { username: target.username, avatarUrl: target.avatarUrl, blockedAt },
  };
}

/** Owner emails about blocks from any one account, per day. */
const BLOCK_NOTICE_MAX = 5;

/**
 * App Review 1.2 asks that blocking also reaches the developer, so the blocked
 * account can be looked at. A new block emails the owner (ADMIN_EMAILS, first
 * entry), at most BLOCK_NOTICE_MAX a day from one account, so a run of blocks
 * can't use up the day's email allowance that reports need. The blocked
 * account is never told. Never fails the block.
 */
async function tellOwnerAboutBlock(blockerId: string, blocked: string): Promise<void> {
  try {
    const ownerEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
    if (!ownerEmail) return;
    if (!(await rateLimit("block-notice", BLOCK_NOTICE_MAX, 86400, blockerId))) return;
    const { data: me } = await createAdminClient()
      .from("profiles")
      .select("username")
      .eq("id", blockerId)
      .maybeSingle();
    const blocker = (me?.username as string | null) ?? null;
    const by = blocker ? `@${blocker}` : "A member";
    mailAfter("block notification", {
      to: ownerEmail,
      subject: `LearnFRC: @${blocked} was blocked`,
      html: adminNotifyHtml({
        heading: `${by} blocked @${blocked}`,
        rows: [
          { label: "Blocked", value: `@${blocked}` },
          { label: "By", value: blocker ? `@${blocker}` : "a member with no username" },
        ],
        ctaText: "Open their profile",
        ctaUrl: `${SITE}/u/${encodeURIComponent(blocked)}`,
        note: "A block only hides the account from the person who blocked it, and nobody is told about this email. If the profile breaks the rules, report it from that page and answer the report on the reports desk.",
      }),
    });
  } catch (e) {
    console.error("block notification:", e);
  }
}

/** Undo a block, by the account's current handle. Idempotent. */
export async function unblockUser(
  user: AppUser,
  input: { username: unknown }
): Promise<Result<{ username: string }>> {
  const raw = textField(input.username);
  if (raw === null) return fail("validation", "That request wasn't in the format we expected.");
  if (!raw) return fail("validation", BLOCK_SENTENCES.missing);

  const target = await accountByUsername(raw);
  if (!target) return fail("not_found", BLOCK_SENTENCES.notFound);

  const { error } = await createAdminClient()
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", target.id);
  if (error) {
    console.error("unblockUser:", error.message);
    return fail("server", BLOCK_SENTENCES.save);
  }
  // Nothing to delete is still the state that was asked for, so a second tap
  // (or an unblock from another device first) answers success too.
  return { ok: true, username: target.username };
}
