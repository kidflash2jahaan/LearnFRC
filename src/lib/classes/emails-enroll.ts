import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { classUrl, adminClassUrl, SITE_URL } from "@/lib/classes/config";
import {
  classEmailHtml,
  escapeHtml,
  mailClass,
  pacificTime,
  sendClassEmail,
  type ClassMail,
} from "@/lib/classes/emails";

/**
 * The emails around scheduling and enrolling (classes-design.md section 11):
 *
 *   - the FYI Jahaan gets for every class a teacher schedules, marked when
 *     it's the teacher's first;
 *   - the note every enrolled student gets when a class is canceled (by the
 *     teacher, by staff, or because the teacher was suspended or deleted
 *     their account);
 *   - the enrollment confirmation, sent only when CLASSES_ENROLL_EMAILS=1.
 *     Decision 6 in the design: confirmations go out only once Resend is on
 *     Pro, because the free plan's 100 a day is shared with sign-up mail and
 *     the safety emails. Until then the class page shows the confirmation.
 *
 * Every template takes plain values and escapes them. None carries a
 * student's handle, and none quotes anything a teacher typed besides the
 * class title, which passed the profanity and contact-details checks before
 * it was saved. Each student gets their own message, never a shared To line.
 */

/** Whether enrollment confirmations go out (Resend Pro, decision 6). */
export function enrollEmailsOn(): boolean {
  return process.env.CLASSES_ENROLL_EMAILS === "1";
}

/**
 * Sends after the response through mailClass (a failure is recorded as an
 * email_failed class event). Outside a request, where `after` isn't
 * available (scripts and the package's checks), it sends straight away.
 */
export async function deliverClassMail(what: string, classId: string | null, message: ClassMail): Promise<void> {
  try {
    mailClass(what, classId, message);
  } catch {
    await sendClassEmail(what, classId, message);
  }
}

function lengthText(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} minutes` : ""}`;
}

/* ── Jahaan's FYI ──────────────────────────────────────────────────── */

export type ScheduledFyi = {
  classId: string;
  title: string;
  description: string | null;
  topicTitle: string | null;
  teacherUsername: string | null;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  /** No approved class yet and no earlier class still on the books. */
  firstClass: boolean;
  /** Approved classes this teacher has taught before. */
  approvedBefore: number;
};

export function scheduledFyiEmail(input: ScheduledFyi, to: string): ClassMail {
  const marker = input.firstClass ? "Teacher's first class" : null;
  const subject = `${marker ? "[First class] " : ""}LearnFRC class scheduled: ${input.title}`;
  return {
    to,
    subject,
    html: classEmailHtml({
      heading: marker ? `A teacher scheduled their first class` : "A class was scheduled",
      intro: marker
        ? "Nothing is needed from you. It's listed now and works like any other class. Its notes will be marked as a first class, and they sort right after urgent reviews."
        : "Nothing is needed from you. It's listed now.",
      rows: [
        { label: "Title", value: input.title },
        { label: "Topic", value: input.topicTitle ?? "not set" },
        { label: "Teacher", value: input.teacherUsername ? `@${input.teacherUsername}` : "unknown" },
        { label: "When", value: pacificTime(input.startsAt) },
        { label: "Length", value: lengthText(input.durationMinutes) },
        { label: "Seats", value: String(input.capacity) },
        {
          label: "Teacher's first class",
          value: input.firstClass
            ? "yes"
            : input.approvedBefore > 0
              ? `no (${input.approvedBefore} approved before)`
              : "no (an earlier class is still waiting)",
        },
      ],
      bodyHtml: input.description
        ? `<p style="margin:14px 0 0;color:#565C60;font-size:14px;white-space:pre-line">${escapeHtml(input.description)}</p>`
        : "",
      buttons: [
        { text: "Open the class page", url: classUrl(input.classId) },
        { text: "Admin view", url: adminClassUrl(input.classId), tone: "plain" },
      ],
    }),
  };
}

/* ── Canceled ──────────────────────────────────────────────────────── */

export type CanceledBy = "teacher" | "staff" | "system";

export function classCanceledEmail(
  input: { title: string; startsAt: string; by: CanceledBy },
  to: string
): ClassMail {
  const who =
    input.by === "teacher"
      ? "The teacher canceled it."
      : "LearnFRC canceled it.";
  return {
    to,
    subject: `Class canceled: ${input.title}`,
    html: classEmailHtml({
      heading: "A class you signed up for was canceled",
      intro: `${who} You don't need to do anything, and your seat is gone with it.`,
      rows: [
        { label: "Class", value: input.title },
        { label: "Was", value: pacificTime(input.startsAt) },
      ],
      buttons: [{ text: "See other classes", url: `${SITE_URL}/classes` }],
      note: "You got this because you signed up for this class on LearnFRC.",
    }),
  };
}

/* ── Enrolled (only with CLASSES_ENROLL_EMAILS=1) ──────────────────── */

/**
 * The one confirmation after a new enrollment, when confirmations are on.
 * Never throws: a missing email never undoes a seat.
 */
export async function confirmEnrollment(
  user: { id: string; email?: string | null },
  classId: string
): Promise<void> {
  if (!enrollEmailsOn() || !user.email) return;
  try {
    const { data } = await createAdminClient()
      .from("classes")
      .select("id, title, starts_at, duration_minutes")
      .eq("id", classId)
      .maybeSingle();
    if (!data) return;
    await deliverClassMail(
      "enrolled",
      classId,
      classEnrolledEmail(
        {
          classId,
          title: data.title as string,
          startsAt: data.starts_at as string,
          durationMinutes: data.duration_minutes as number,
        },
        user.email
      )
    );
  } catch (e) {
    console.error("confirmEnrollment:", e);
  }
}

export function classEnrolledEmail(
  input: { classId: string; title: string; startsAt: string; durationMinutes: number },
  to: string
): ClassMail {
  return {
    to,
    subject: `You're in: ${input.title}`,
    html: classEmailHtml({
      heading: "You're signed up for a live class",
      intro:
        "The room opens 15 minutes before the start. Join from the class page on learnfrc.com. Everyone in the class sees your LearnFRC username, the class is recorded on video, and your camera stays off.",
      rows: [
        { label: "Class", value: input.title },
        { label: "When", value: pacificTime(input.startsAt) },
        { label: "Length", value: lengthText(input.durationMinutes) },
      ],
      buttons: [{ text: "Open the class page", url: classUrl(input.classId) }],
      note: "Can't make it? Leave the class from its page so someone else can have the seat.",
    }),
  };
}
