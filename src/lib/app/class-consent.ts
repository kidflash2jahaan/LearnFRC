import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitKey } from "@/lib/rate-limit";
import { requestIp } from "@/lib/app/accounts";
import { deleteAccountData } from "@/lib/app/profile";
import { CLASS_SENTENCES, classEligibilityDetail, eligibilitySentence } from "@/lib/app/classes";
import { requireClassReviewer } from "@/lib/app/class-reviewers";
import { isUuid } from "@/lib/app/http";
import { fail, type AppClients, type AppUser, type Result } from "@/lib/app/result";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import {
  PARENT_LIMITS,
  UNDER_13_COOKIE,
  UNDER_13_COOKIE_VALUE,
  auditSalt,
  classesVisible,
} from "@/lib/classes/config";
import { ageBand, ageOn, isValidBirthMonthYear } from "@/lib/classes/age";
import {
  UNDER_13_COOKIE_SECONDS,
  cleanParentName,
  isEmailAddress,
  isParentTokenShape,
  normalizeEmail,
  parentDecision,
  resendWaitMs,
  roughWait,
  sameMailbox,
  wholeNumber,
  type ParentDecision,
} from "@/lib/classes/consent-rules";
import { sendClassEmail } from "@/lib/classes/emails";
import {
  PARENT_NOTICE_VERSION,
  parentRequestMail,
  studentDecisionMail,
  studentRevokedMail,
} from "@/lib/classes/emails-parent";
import type { Eligibility, ParentConsentStatus } from "@/lib/classes/types";

/**
 * Live classes: the age screen and the parent OK (classes-design.md sections
 * 5 and 5.1). The one place these rules live: the website's actions
 * (src/app/actions/class-consent.ts), the parent link route
 * (src/app/classes/parent/open/[token]/route.ts) and the /admin/classes
 * consent lookup all call these.
 *
 * - recordAgeCheck: one neutral answer, written once. Under 13 deletes the
 *   account (deleteAccountData with reason "under_13"), leaves the device
 *   cookie and stores nothing about the person.
 * - requestParentOk: one email to a parent or guardian with a single-use link.
 *   Only the token's sha256 is stored.
 * - openParentLink / loadParentRequest / decideParentOk: the parent's side.
 *   Opening the link decides nothing (mail scanners prefetch links); the
 *   decision is a POST from /classes/parent, and it records who, when, from
 *   which network (an HMAC, never the IP) and whether that matched the
 *   student's own network (same_network, a review flag, never a block).
 *
 * Every read and write is service role, scoped by the id auth.getUser()
 * verified, or by the hash of the emailed token. Nothing works while
 * classesVisible() is false.
 */

/* ── Sentences ─────────────────────────────────────────────────────── */

export const CONSENT_SENTENCES = {
  pickBoth: "Pick a month and a year.",
  notYet: "That month hasn't happened yet. Pick another one.",
  confirmFirst: "Check your answer, then press Yes.",
  alreadySaved: `Your answer's already saved. If it's wrong, write to us at ${PUBLIC_CONTACT_EMAIL}.`,
  deleteFailed: `Something went wrong on our side. Write to us at ${PUBLIC_CONTACT_EMAIL} and we'll sort it out.`,
  emailInvalid: "Enter your parent or guardian's email address.",
  ownEmail: "That's your own email address. Enter your parent or guardian's.",
  alreadyAgreed: "Your parent or guardian already said OK.",
  sendFailed: "We couldn't send that email. Check the address and try again.",
  rateAccount: "That's three emails today, the most we send in a day. Try again tomorrow.",
  rateNetwork: "Too many requests from this network today. Try again tomorrow.",
  linkClosed: "This link has already been used, or it has expired.",
  nameNeeded: "Type your name to say OK.",
  nameInvalid: "Type your name in letters, 2 to 80 characters.",
  pickDecision: "Choose I agree or I don't agree.",
  busy: "Too many tries from this network. Wait an hour and try again.",
  notFound: "We couldn't find that one.",
  closedConsent: "That one is already closed.",
} as const;

export function sameAddressSoon(wait: string): string {
  return `We emailed that address recently. You can send it again in ${wait}, or use a different address.`;
}

/* ── Request facts ─────────────────────────────────────────────────── */

/**
 * What a door knows about the request. The website's actions and the route
 * pass the IP and user agent from the request; when a field is left out it is
 * read from the current request, and a script outside a request passes them
 * itself.
 */
export type ConsentRequest = {
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
};

async function ipFor(ctx: ConsentRequest): Promise<string | null> {
  if (ctx.ip !== undefined) return ctx.ip;
  try {
    return await requestIp();
  } catch {
    return null;
  }
}

async function userAgentFor(ctx: ConsentRequest): Promise<string | null> {
  if (ctx.userAgent !== undefined) return ctx.userAgent;
  try {
    return (await headers()).get("user-agent");
  } catch {
    return null;
  }
}

/**
 * HMAC-SHA256 of an IP with CLASSES_AUDIT_SALT, hex. The same hash every
 * classes table stores (class_parent_consents' requested and decided hashes,
 * class_consents.ip_hash), so two of them can be compared without ever
 * keeping an address. Null when there's no IP.
 */
export function classIpHash(ip: string | null | undefined): string | null {
  const v = ip?.trim();
  if (!v) return null;
  return createHmac("sha256", auditSalt()).update(v).digest("hex");
}

/** sha256 of the emailed token, hex: all class_parent_consents keeps of it. */
export function hashParentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A new token: 32 random bytes, base64url (43 characters). */
export function newParentToken(): string {
  return randomBytes(32).toString("base64url");
}

/* ── The age screen (section 5) ────────────────────────────────────── */

export type AgeOutcome =
  /** 13 to 17: stored; next is the parent email. */
  | "parent"
  /** 18 or older: stored; classes stay closed (state `adult`). */
  | "adult"
  /** Under 13: the account is gone and the device cookie is set. */
  | "deleted";

export type AgeCheckDoor = ConsentRequest & {
  /** Overrides the lf_cls_age cookie read (tests). */
  deviceBlocked?: boolean;
  /**
   * Leaves lf_cls_age=u13 on the device. Defaults to a response cookie
   * through next/headers, which works in a Server Action or route handler.
   */
  markDevice?: () => void | Promise<void>;
};

/** The under-13 device cookie, as a response cookie (Server Actions, routes). */
export async function markDeviceUnder13(): Promise<void> {
  (await cookies()).set(UNDER_13_COOKIE, UNDER_13_COOKIE_VALUE, {
    path: "/",
    maxAge: UNDER_13_COOKIE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function refusalFor(state: Eligibility) {
  if (state === "signed_out") return fail("unauthorized", eligibilitySentence(state));
  return fail("forbidden", eligibilitySentence(state));
}

/**
 * Saves the one neutral answer: "What's your birth month and year?"
 *
 * The UI shows a confirm step for every answer ("You picked March 2011. Is
 * that right?"), and `confirmed` is what its Yes button sends, so an answer
 * can't be saved without passing through it.
 *
 * - Written once. A second answer is refused, whatever it says.
 * - 13 to 17 and 18+: stored as month and year (class_age_checks).
 * - Under 13: nothing is stored. The device gets lf_cls_age=u13 (365 days, no
 *   personal data), the account is deleted through deleteAccountData with
 *   reason "under_13", and one class_events row (`under13_deleted`, no user
 *   data) is written. The door signs the browser out.
 *
 * Age is computed conservatively (src/lib/classes/age.ts).
 */
export async function recordAgeCheck(
  user: AppUser,
  clients: AppClients,
  input: { birthMonth: unknown; birthYear: unknown; confirmed?: unknown },
  door: AgeCheckDoor = {}
): Promise<Result<{ outcome: AgeOutcome }>> {
  if (!(await classesVisible())) return fail("forbidden", CLASS_SENTENCES.hidden);
  const now = door.now ?? new Date();

  const birthMonth = wholeNumber(input.birthMonth);
  const birthYear = wholeNumber(input.birthYear);
  if (birthMonth === null || birthYear === null) {
    return {
      ...fail("validation", CONSENT_SENTENCES.pickBoth),
      field: birthMonth === null ? "birth_month" : "birth_year",
    };
  }
  if (!isValidBirthMonthYear(birthYear, birthMonth, now)) {
    const future = birthYear === now.getUTCFullYear() && birthMonth > now.getUTCMonth() + 1;
    return {
      ...fail("validation", future ? CONSENT_SENTENCES.notYet : CONSENT_SENTENCES.pickBoth),
      field: future ? "birth_month" : "birth_year",
    };
  }
  if (input.confirmed !== true && input.confirmed !== "yes") {
    return fail("validation", CONSENT_SENTENCES.confirmFirst);
  }

  if (!(await rateLimitKey("class-consent-age", 10, 3600, user.id)))
    return fail("rate_limited", CLASS_SENTENCES.rate, 3600);

  const detail = await classEligibilityDetail(user, { deviceBlocked: door.deviceBlocked, now });
  if (detail.state !== "needs_age") {
    if (
      detail.state === "hidden" ||
      detail.state === "signed_out" ||
      detail.state === "needs_handle" ||
      detail.state === "device_blocked"
    ) {
      return refusalFor(detail.state);
    }
    return fail("conflict", CONSENT_SENTENCES.alreadySaved);
  }

  const band = ageBand(ageOn(now, birthYear, birthMonth));
  if (band === "under13") return deleteUnder13(user, clients, door);

  const { error } = await clients.admin
    .from("class_age_checks")
    .insert({ user_id: user.id, birth_year: birthYear, birth_month: birthMonth });
  if (error) {
    if (error.code === "23505") return fail("conflict", CONSENT_SENTENCES.alreadySaved);
    console.error("recordAgeCheck:", error.message);
    return fail("server", CLASS_SENTENCES.save);
  }
  return { ok: true, outcome: band === "18+" ? "adult" : "parent" };
}

/**
 * An under-13 answer is actual knowledge (COPPA, section 5), so the account
 * goes. The cookie is set first, so this device stays closed to classes even
 * if the deletion has to be finished by hand. A failed deletion is retried
 * once; if it still fails, a class_events row (`under13_delete_failed`, with
 * the account id so staff can finish it) is the one record kept.
 */
async function deleteUnder13(
  user: AppUser,
  clients: AppClients,
  door: AgeCheckDoor
): Promise<Result<{ outcome: AgeOutcome }>> {
  try {
    await (door.markDevice ?? markDeviceUnder13)();
  } catch (e) {
    console.error("recordAgeCheck: device cookie:", e);
  }

  let deleted = await deleteAccountData(user, clients, { reason: "under_13" });
  if (!deleted.ok) deleted = await deleteAccountData(user, clients, { reason: "under_13" });

  if (!deleted.ok) {
    const { error } = await clients.admin
      .from("class_events")
      .insert({ kind: "under13_delete_failed", actor_id: user.id, detail: {} });
    if (error) console.error("recordAgeCheck: under13_delete_failed:", error.message);
    return fail("server", CONSENT_SENTENCES.deleteFailed);
  }

  // No class, no actor, no detail: the count is all that's kept.
  const { error } = await clients.admin.from("class_events").insert({ kind: "under13_deleted", detail: {} });
  if (error) console.error("recordAgeCheck: under13_deleted:", error.message);
  return { ok: true, outcome: "deleted" };
}

/* ── The parent email (section 5.1) ────────────────────────────────── */

/** The student's latest request, for the ready page's waiting step. */
export type StudentParentRequest = {
  parentEmail: string;
  status: ParentConsentStatus;
  sentAt: string;
  expiresAt: string;
  /** Milliseconds before the same address can be emailed again (0 = now). */
  resendWaitMs: number;
};

export async function latestParentRequest(
  user: AppUser,
  opts: { now?: Date } = {}
): Promise<StudentParentRequest | null> {
  const now = opts.now ?? new Date();
  const { data } = await createAdminClient()
    .from("class_parent_consents")
    .select("parent_email, status, sent_at, expires_at")
    .eq("student_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    parentEmail: data.parent_email as string,
    status: data.status as ParentConsentStatus,
    sentAt: data.sent_at as string,
    expiresAt: data.expires_at as string,
    resendWaitMs: resendWaitMs(new Date(data.sent_at as string), now, PARENT_LIMITS.resendAfterHours),
  };
}

/**
 * Emails a parent or guardian once, with a link that works once for 14 days.
 *
 * - Only from `needs_parent` or `waiting_parent` (a declined or revoked OK
 *   isn't re-asked from here; the page points to the contact address).
 * - A valid address that isn't the student's own mailbox (sameMailbox).
 * - The same address again only 24 hours after the last email to it. A
 *   different address can go at once, so a typo is fixable.
 * - 3 emails a day per account and 10 a day per network (rateLimitKey on the
 *   account id, and on the IP).
 * - Stores only the token's sha256 and an HMAC of the student's IP. A new
 *   request expires the older open ones, so their links stop working.
 * - If the email can't be sent, the request is removed again and the student
 *   is told, so they're never left waiting on an email that never went.
 */
export async function requestParentOk(
  user: AppUser,
  input: { parentEmail: unknown },
  ctx: ConsentRequest = {}
): Promise<Result<{ parentEmail: string; expiresAt: string }>> {
  if (!(await classesVisible())) return fail("forbidden", CLASS_SENTENCES.hidden);
  const now = ctx.now ?? new Date();

  const detail = await classEligibilityDetail(user, { now });
  switch (detail.state) {
    case "needs_parent":
    case "waiting_parent":
      break;
    case "ready":
      return fail("conflict", CONSENT_SENTENCES.alreadyAgreed);
    default:
      return refusalFor(detail.state);
  }

  const raw = typeof input.parentEmail === "string" ? input.parentEmail : "";
  if (!isEmailAddress(raw)) return { ...fail("validation", CONSENT_SENTENCES.emailInvalid), field: "parent_email" };
  const parentEmail = normalizeEmail(raw);
  if (sameMailbox(parentEmail, user.email)) {
    return { ...fail("validation", CONSENT_SENTENCES.ownEmail), field: "parent_email" };
  }

  const admin = createAdminClient();
  const last = await latestParentRequest(user, { now });
  if (last && last.status === "sent" && last.resendWaitMs > 0 && sameMailbox(last.parentEmail, parentEmail)) {
    return {
      ...fail("conflict", sameAddressSoon(roughWait(last.resendWaitMs)), Math.ceil(last.resendWaitMs / 1000)),
      field: "parent_email",
    };
  }

  const ip = await ipFor(ctx);
  if (!(await rateLimitKey("class-consent-parent", PARENT_LIMITS.sendsPerDayPerAccount, 86400, user.id)))
    return fail("rate_limited", CONSENT_SENTENCES.rateAccount, 86400);
  if (!(await rateLimitKey("class-consent-parent-ip", PARENT_LIMITS.sendsPerDayPerIp, 86400, ip ?? "unknown")))
    return fail("rate_limited", CONSENT_SENTENCES.rateNetwork, 86400);

  const token = newParentToken();
  const sentAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + PARENT_LIMITS.tokenDays * 86_400_000).toISOString();
  const { data: row, error } = await admin
    .from("class_parent_consents")
    .insert({
      student_id: user.id,
      student_handle: detail.username,
      student_birth_year: detail.birthYear,
      parent_email: parentEmail,
      token_hash: hashParentToken(token),
      notice_version: PARENT_NOTICE_VERSION,
      status: "sent",
      sent_at: sentAt,
      expires_at: expiresAt,
      requested_ip_hash: classIpHash(ip),
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("requestParentOk:", error?.message);
    return fail("server", CLASS_SENTENCES.save);
  }

  const sent = await sendClassEmail(
    "parent request",
    null,
    parentRequestMail({ parentEmail, studentHandle: detail.username as string, token })
  );
  if (!sent.ok) {
    await admin.from("class_parent_consents").delete().eq("id", row.id);
    return fail("server", CONSENT_SENTENCES.sendFailed);
  }

  // Older open requests stop working. Only older ones, so two requests racing
  // can't expire each other.
  await admin
    .from("class_parent_consents")
    .update({ status: "expired" })
    .eq("student_id", user.id)
    .eq("status", "sent")
    .lt("sent_at", sentAt)
    .neq("id", row.id);

  return { ok: true, parentEmail, expiresAt };
}

/* ── The parent's side ─────────────────────────────────────────────── */

type ConsentLookup = {
  id: string;
  status: ParentConsentStatus;
  expires_at: string;
  student_id: string | null;
  student_handle: string;
  requested_ip_hash: string | null;
};

async function findByToken(token: unknown): Promise<ConsentLookup | null> {
  if (!isParentTokenShape(token)) return null;
  const { data } = await createAdminClient()
    .from("class_parent_consents")
    .select("id, status, expires_at, student_id, student_handle, requested_ip_hash")
    .eq("token_hash", hashParentToken(token))
    .maybeSingle();
  return (data as ConsentLookup | null) ?? null;
}

/** Still waiting on a decision, in date, and the account still exists. */
function isOpen(row: ConsentLookup | null, now: Date): row is ConsentLookup {
  return (
    !!row &&
    row.status === "sent" &&
    Date.parse(row.expires_at) > now.getTime() &&
    !!row.student_id
  );
}

/** What /classes/parent shows for the token in its cookie. */
export type ParentRequestView =
  | { open: true; studentHandle: string; expiresAt: string }
  | { open: false };

export async function loadParentRequest(token: unknown, opts: { now?: Date } = {}): Promise<ParentRequestView> {
  if (!(await classesVisible())) return { open: false };
  const row = await findByToken(token);
  if (!isOpen(row, opts.now ?? new Date())) return { open: false };
  return { open: true, studentHandle: row.student_handle, expiresAt: row.expires_at };
}

/**
 * The emailed link (GET /classes/parent/open/<token>). Decides nothing: it
 * only says whether the route should leave the token in the lf_parent cookie
 * ("open") or send the parent to the plain "used or expired" message.
 * Rate-limited per network, so the route can't be used to guess tokens.
 */
export async function openParentLink(
  token: unknown,
  ctx: ConsentRequest = {}
): Promise<"open" | "closed" | "busy"> {
  if (!(await classesVisible())) return "closed";
  const ip = await ipFor(ctx);
  if (!(await rateLimitKey("class-consent-open-ip", 60, 3600, ip ?? "unknown"))) return "busy";
  const row = await findByToken(token);
  return isOpen(row, ctx.now ?? new Date()) ? "open" : "closed";
}

/**
 * The parent's answer, from /classes/parent's form (a POST, never the GET
 * link). Records the status, the typed name (needed to agree, optional to
 * decline), the time, an HMAC of the parent's IP, their user agent, and
 * same_network = (that hash equals the one from the student's request). The
 * update is conditional on the request still being open, so a link works
 * once. The student gets an email either way.
 */
export async function decideParentOk(
  input: { token: unknown; decision: unknown; parentName: unknown },
  ctx: ConsentRequest = {}
): Promise<Result<{ decision: ParentDecision; sameNetwork: boolean }>> {
  if (!(await classesVisible())) return fail("forbidden", CLASS_SENTENCES.hidden);
  const now = ctx.now ?? new Date();

  const decision = parentDecision(input.decision);
  if (!decision) return fail("validation", CONSENT_SENTENCES.pickDecision);
  const name = cleanParentName(input.parentName);
  if (decision === "agree" && !name) {
    const typed = typeof input.parentName === "string" && input.parentName.trim().length > 0;
    return {
      ...fail("validation", typed ? CONSENT_SENTENCES.nameInvalid : CONSENT_SENTENCES.nameNeeded),
      field: "parent_name",
    };
  }

  const ip = await ipFor(ctx);
  if (!(await rateLimitKey("class-consent-decide-ip", 20, 3600, ip ?? "unknown")))
    return fail("rate_limited", CONSENT_SENTENCES.busy, 3600);

  const row = await findByToken(input.token);
  if (!isOpen(row, now)) return fail("not_found", CONSENT_SENTENCES.linkClosed);

  const decidedIpHash = classIpHash(ip);
  const sameNetwork = !!decidedIpHash && decidedIpHash === row.requested_ip_hash;
  const userAgent = (await userAgentFor(ctx))?.slice(0, 300) ?? null;
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("class_parent_consents")
    .update({
      status: decision === "agree" ? "agreed" : "declined",
      parent_name: name,
      decided_at: now.toISOString(),
      decided_ip_hash: decidedIpHash,
      decided_user_agent: userAgent,
      same_network: sameNetwork,
    })
    .eq("id", row.id)
    .eq("status", "sent")
    .gt("expires_at", now.toISOString())
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("decideParentOk:", error.message);
    return fail("server", CLASS_SENTENCES.save);
  }
  if (!updated) return fail("not_found", CONSENT_SENTENCES.linkClosed);

  try {
    const { data } = await admin.auth.admin.getUserById(row.student_id as string);
    const to = data?.user?.email;
    if (to) await sendClassEmail("parent decision", null, studentDecisionMail({ to, agreed: decision === "agree" }));
  } catch (e) {
    console.error("decideParentOk: student email:", e);
  }
  return { ok: true, decision, sameNetwork };
}

/* ── Staff: the consent lookup on /admin/classes (section 7.6) ─────── */

export type ParentConsentSummary = {
  id: string;
  studentId: string | null;
  studentHandle: string;
  parentEmail: string;
  parentName: string | null;
  status: ParentConsentStatus;
  sentAt: string;
  expiresAt: string;
  decidedAt: string | null;
  sameNetwork: boolean;
  revokedAt: string | null;
  accountDeletedAt: string | null;
};

/**
 * Every parent OK request for a handle (the current username's account and
 * any snapshot with that handle), newest first. Super admins and the safety
 * lead only (requireClassReviewer).
 */
export async function listParentConsents(
  user: AppUser,
  input: { handle: unknown }
): Promise<Result<{ consents: ParentConsentSummary[] }>> {
  const access = await requireClassReviewer(user);
  if (!access.ok) return access;
  const handle =
    typeof input.handle === "string" ? input.handle.trim().replace(/^@/, "").toLowerCase() : "";
  if (!/^[a-z0-9_]{1,40}$/.test(handle)) return fail("validation", "Enter a username.");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("username", handle).maybeSingle();
  let q = admin
    .from("class_parent_consents")
    .select(
      "id, student_id, student_handle, parent_email, parent_name, status, sent_at, expires_at, decided_at, same_network, revoked_at, account_deleted_at"
    )
    .order("sent_at", { ascending: false })
    .limit(50);
  q = profile?.id
    ? q.or(`student_id.eq.${profile.id},student_handle.eq.${handle}`)
    : q.eq("student_handle", handle);
  const { data, error } = await q;
  if (error) {
    console.error("listParentConsents:", error.message);
    return fail("server", CLASS_SENTENCES.save);
  }
  return {
    ok: true,
    consents: (data ?? []).map((r) => ({
      id: r.id as string,
      studentId: (r.student_id as string | null) ?? null,
      studentHandle: r.student_handle as string,
      parentEmail: r.parent_email as string,
      parentName: (r.parent_name as string | null) ?? null,
      status: r.status as ParentConsentStatus,
      sentAt: r.sent_at as string,
      expiresAt: r.expires_at as string,
      decidedAt: (r.decided_at as string | null) ?? null,
      sameNetwork: !!r.same_network,
      revokedAt: (r.revoked_at as string | null) ?? null,
      accountDeletedAt: (r.account_deleted_at as string | null) ?? null,
    })),
  };
}

/**
 * Withdraws a parent OK (or an open request) at once: classEligibility then
 * answers `parent_declined`, so joinClass refuses the next join. The student
 * gets a short email when an agreed OK is withdrawn. Super admins and the
 * safety lead only.
 */
export async function revokeParentConsent(
  user: AppUser,
  input: { consentId: unknown }
): Promise<Result> {
  const access = await requireClassReviewer(user);
  if (!access.ok) return access;
  if (!isUuid(input.consentId)) return fail("not_found", CONSENT_SENTENCES.notFound);
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("class_parent_consents")
    .select("id, status, student_id")
    .eq("id", input.consentId)
    .maybeSingle();
  if (!before) return fail("not_found", CONSENT_SENTENCES.notFound);
  if (before.status !== "agreed" && before.status !== "sent") return fail("conflict", CONSENT_SENTENCES.closedConsent);

  const { data: updated, error } = await admin
    .from("class_parent_consents")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq("id", before.id)
    .in("status", ["agreed", "sent"])
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("revokeParentConsent:", error.message);
    return fail("server", CLASS_SENTENCES.save);
  }
  if (!updated) return fail("conflict", CONSENT_SENTENCES.closedConsent);

  if (before.status === "agreed" && before.student_id) {
    try {
      const { data } = await admin.auth.admin.getUserById(before.student_id as string);
      const to = data?.user?.email;
      if (to) await sendClassEmail("parent consent revoked", null, studentRevokedMail({ to }));
    } catch (e) {
      console.error("revokeParentConsent: student email:", e);
    }
  }
  return { ok: true };
}

/**
 * Marks open requests past their 14 days as `expired`. For the daily sweep
 * (section 6.9); eligibility already treats them as expired either way.
 * Returns how many it closed.
 */
export async function expireParentRequests(now: Date = new Date()): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("class_parent_consents")
    .update({ status: "expired" })
    .eq("status", "sent")
    .lte("expires_at", now.toISOString())
    .select("id");
  if (error) {
    console.error("expireParentRequests:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
