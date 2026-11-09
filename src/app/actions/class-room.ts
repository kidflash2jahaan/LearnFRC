"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requestIp } from "@/lib/app/accounts";
import {
  endClass,
  joinClass,
  removeFromClass,
  roomRoster,
  roomStatus,
  setJoinsPaused,
  type JoinGrant,
  type JoinRefusal,
} from "@/lib/app/classes-room";
import type { ClassEndReason, ClassRosterEntry, ClassStatus } from "@/lib/classes/types";

/**
 * The website's door onto the class room (sections 6.4 to 6.6). Joining is a
 * Server Action on purpose: Next checks the request's origin, so another site
 * can't mint a join token with a visitor's cookie.
 *
 * Every rule lives in src/lib/app/classes-room.ts; a "use server" function is
 * a public endpoint, so each shared function checks the caller itself, from
 * the session the auth server verified here. The join token comes back only
 * in the return value, for that browser's memory.
 */

/** The cookie session's verified user, or null. */
async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const SIGNED_OUT = "Sign in again to keep going.";

export type JoinState =
  | ({ ok: true } & JoinGrant)
  | { ok: false; error: string; reason: JoinRefusal | "signed_out"; opensAt?: string };

/** Accepts the recording notice (its version) and returns a join token. */
export async function joinClassAction(classId: string, noticeVersion: string): Promise<JoinState> {
  const user = await sessionUser();
  if (!user) return { ok: false, error: SIGNED_OUT, reason: "signed_out" };
  const h = await headers();
  const result = await joinClass(user, {
    classId,
    noticeVersion,
    userAgent: h.get("user-agent"),
    ip: await requestIp(),
  });
  if (!result.ok) return { ok: false, error: result.error, reason: result.reason, opensAt: result.opensAt };
  return {
    ok: true,
    authToken: result.authToken,
    role: result.role,
    hardEndAt: result.hardEndAt,
    title: result.title,
    displayName: result.displayName,
    username: result.username,
  };
}

export type RoomActionState = { ok: true } | { ok: false; error: string };

/**
 * Ends the class. The teacher's button sends "teacher", staff's "admin", and
 * every browser's timer "time" at the hard end (only accepted once it has
 * passed, from anyone still in the class).
 */
export async function endClassAction(classId: string, reason: "teacher" | "admin" | "time"): Promise<RoomActionState> {
  const user = await sessionUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const r = await endClass(user, { classId, reason: reason as ClassEndReason });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Removes a student from the class for good (the teacher or staff). */
export async function removeFromClassAction(
  classId: string,
  userId: string,
  reason?: string
): Promise<RoomActionState> {
  const user = await sessionUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const r = await removeFromClass(user, { classId, userId, reason: reason ?? null });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Where the class stands, for a browser that just left the meeting. */
export async function roomStatusAction(
  classId: string
): Promise<{ status: ClassStatus | null; endReason: ClassEndReason | null; removed: boolean }> {
  const user = await sessionUser();
  if (!user) return { status: null, endReason: null, removed: false };
  return roomStatus(user, classId);
}

/** The report panel's roster, refreshed while someone is in the room. */
export async function roomRosterAction(classId: string): Promise<ClassRosterEntry[]> {
  const user = await sessionUser();
  if (!user) return [];
  return roomRoster(user, classId);
}

/** The emergency stop and its undo (a super admin or the safety lead). */
export async function setJoinsPausedAction(
  paused: boolean,
  reason?: string
): Promise<{ ok: true; ended: number } | { ok: false; error: string }> {
  const user = await sessionUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const r = await setJoinsPaused(user, { paused, reason: reason ?? null });
  return r.ok ? { ok: true, ended: r.ended } : { ok: false, error: r.error };
}
