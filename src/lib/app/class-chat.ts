import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitKey } from "@/lib/rate-limit";
import { chatHasProfanity } from "@/lib/classes/chat-profanity";
import { isUuid } from "@/lib/app/http";
import { fail, type AppUser, type Result } from "@/lib/app/result";
// From the leaf module, not classes.ts: CHAT_SENTENCES reads it at load time
// (see src/lib/classes/sentences.ts).
import { CLASS_SENTENCES } from "@/lib/classes/sentences";
import { CHAT_LIMITS, classesVisible, rtkApp } from "@/lib/classes/config";
import {
  CHAT_BLOCKED_NOTE,
  CHAT_EMPTY_NOTE,
  CHAT_PROFANITY_NOTE,
  CHAT_TOO_LONG_NOTE,
  chatLengthProblem,
  checkChatMessage,
  cleanChatText,
} from "@/lib/classes/chat-filter";
import type { ChatBlockedKind, ChatMessage, ClassRole } from "@/lib/classes/types";

/**
 * LearnFRC's own class chat (sections 3.6 and 6.5). RealtimeKit's chat is
 * off for every preset, so this is the only chat in a class, for everyone:
 * the teacher, students and staff alike.
 *
 * sendClassChat is the one way a message gets in. It checks the sender is in
 * the class and hasn't been removed, rate-limits, runs the chat filter
 * (links outside LearnFRC and the docs, @handles, emails, phone numbers,
 * other apps' contact names) and the site's profanity check, and stores the
 * message as `shown` or `blocked`. Shown rows reach the class through
 * Supabase Realtime and the panel's polling fallback, both under the
 * members-only read policy; blocked rows are never readable by members and
 * go to the review and holds. The sender of a blocked message sees the note,
 * and nobody else sees anything.
 *
 * @-mentions of people in the class itself (its roster) are allowed: they
 * already see each other's usernames, so "@maya good question" leaks nothing.
 * Every other @handle is stopped.
 *
 * The profanity check is the site's own, applied word by word
 * (src/lib/classes/chat-profanity.ts), so a sentence like "Is the analog
 * input on port 0 or 1?" isn't stopped for what its words spell squeezed
 * together.
 */

export const CHAT_SENTENCES = {
  hidden: CLASS_SENTENCES.hidden,
  notFound: CLASS_SENTENCES.notFound,
  bad: "That request wasn't in the format we expected.",
  closed: "This class is over, so its chat is closed.",
  notMember: "Join the class to use its chat.",
  removed: "You were removed from this class, so you can't send messages here.",
  rate: "You're sending messages quickly. Wait a moment and try again.",
  empty: CHAT_EMPTY_NOTE,
  tooLong: CHAT_TOO_LONG_NOTE,
  blocked: CHAT_BLOCKED_NOTE,
  profanity: CHAT_PROFANITY_NOTE,
  save: "Couldn't send that. Try again.",
} as const;

export type SendChatResult = Result<
  | { status: "shown"; message: ChatMessage }
  | { status: "blocked"; note: string; kinds: ChatBlockedKind[] }
>;

/** The usernames a message may @-mention: everyone who's been in the class, and its teacher. */
async function rosterHandles(classId: string, teacherId: string | null): Promise<string[]> {
  const admin = createAdminClient();
  const { data: parts } = await admin.from("class_participants").select("user_id").eq("class_id", classId);
  const ids = [...new Set([...(parts ?? []).map((p) => p.user_id as string), ...(teacherId ? [teacherId] : [])])];
  if (ids.length === 0) return [];
  const { data: profs } = await admin.from("profiles").select("username").in("id", ids);
  return (profs ?? []).map((p) => p.username as string | null).filter((u): u is string => !!u);
}

/**
 * Sends one chat message to a class (section 6.5): the class is open and
 * before its hard end, the sender has an unrevoked class_participants row,
 * 20 messages a minute, 300 characters, then the filter and the profanity
 * check. A blocked message is stored for the review and answered with the
 * note; the text stays in the sender's box (the panel keeps it).
 */
export async function sendClassChat(
  user: AppUser,
  input: { classId: unknown; text: unknown }
): Promise<SendChatResult> {
  if (!(await classesVisible())) return fail("forbidden", CHAT_SENTENCES.hidden);
  if (typeof input.classId !== "string" || typeof input.text !== "string") return fail("validation", CHAT_SENTENCES.bad);
  const classId = input.classId.toLowerCase();
  if (!isUuid(classId)) return fail("not_found", CHAT_SENTENCES.notFound);

  const length = chatLengthProblem(input.text);
  if (length === "empty") return { ...fail("validation", CHAT_SENTENCES.empty), field: "text" };
  if (length === "too_long") return { ...fail("validation", CHAT_SENTENCES.tooLong), field: "text" };

  const admin = createAdminClient();
  const [{ data: cls }, { data: part }] = await Promise.all([
    admin.from("classes").select("id, status, hard_end_at, rtk_app, teacher_id").eq("id", classId).maybeSingle(),
    admin
      .from("class_participants")
      .select("role, revoked_at")
      .eq("class_id", classId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!cls || cls.rtk_app !== rtkApp()) return fail("not_found", CHAT_SENTENCES.notFound);
  if ((cls.status !== "scheduled" && cls.status !== "live") || Date.now() >= Date.parse(cls.hard_end_at as string))
    return fail("conflict", CHAT_SENTENCES.closed);
  if (!part) return fail("forbidden", CHAT_SENTENCES.notMember);
  if (part.revoked_at) return fail("forbidden", CHAT_SENTENCES.removed);

  if (!(await rateLimitKey("class-chat", CHAT_LIMITS.perMinute, 60, user.id)))
    return fail("rate_limited", CHAT_SENTENCES.rate, 60);

  const text = cleanChatText(input.text);
  const [handles, { data: prof }] = await Promise.all([
    rosterHandles(classId, (cls.teacher_id as string | null) ?? null),
    admin.from("profiles").select("username").eq("id", user.id).maybeSingle(),
  ]);
  const check = checkChatMessage(text, { allowHandles: handles });
  const kinds: ChatBlockedKind[] = check.ok ? [] : [...check.kinds];
  if (chatHasProfanity(text)) kinds.push("profanity");
  const status = kinds.length ? "blocked" : "shown";

  const role = part.role as ClassRole;
  const senderUsername = ((prof?.username as string | null | undefined) ?? "").trim() || "member";
  const { data: row, error } = await admin
    .from("class_chat_messages")
    .insert({
      class_id: classId,
      sender_id: user.id,
      sender_username: senderUsername,
      sender_role: role,
      body: text,
      status,
      // Always set, even when empty: the column is not null.
      blocked_kinds: kinds,
    })
    .select("id, sent_at")
    .single();
  if (error || !row) {
    console.error("sendClassChat:", error?.message);
    return fail("server", CHAT_SENTENCES.save);
  }

  if (status === "blocked") {
    // Contact details win over profanity for the note: it says what to fix.
    const note = kinds.some((k) => k !== "profanity") ? CHAT_SENTENCES.blocked : CHAT_SENTENCES.profanity;
    return { ok: true, status: "blocked", note, kinds };
  }
  return {
    ok: true,
    status: "shown",
    message: {
      id: row.id as number,
      classId,
      senderId: user.id,
      senderUsername,
      senderRole: role,
      body: text,
      sentAt: row.sent_at as string,
    },
  };
}
