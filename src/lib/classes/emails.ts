import "server-only";
import { after } from "next/server";
import { emailShell, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Live classes email: the one way every classes package sends mail, and the
 * shared layout their templates use (section 7.5).
 *
 * `mailClass` sends after the response (like mailAfter in admin-notify.ts)
 * and, when Resend refuses, writes a class_events row (`email_failed`, with
 * the error) so /admin/classes can show a red banner. A safety email that
 * didn't go out must never go unnoticed.
 *
 * Every message gets the sendEmail default reply-to, never a student's,
 * teacher's or parent's address. On dev servers EMAIL_DEV_OUTBOX catches
 * every message (src/lib/email.ts), so tests never mail anyone.
 */

export type ClassMail = {
  to: string | string[];
  subject: string;
  html: string;
};

/** Escapes text for HTML. Every interpolated value goes through it. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Records a failed class email. Never throws. */
export async function recordEmailFailure(what: string, classId: string | null, error: string): Promise<void> {
  try {
    await createAdminClient()
      .from("class_events")
      .insert({ class_id: classId, kind: "email_failed", detail: { what, error: error.slice(0, 500) } });
  } catch (e) {
    console.error(`classes email failure not recorded (${what}):`, e);
  }
}

/**
 * Sends a class email now and returns whether it went. For the few callers
 * that need the answer (the parent OK, which shows "we couldn't send it").
 */
export async function sendClassEmail(what: string, classId: string | null, message: ClassMail) {
  const res = await sendEmail(message);
  if (!res.ok) {
    console.error(`classes email failed (${what}):`, res.error);
    await recordEmailFailure(what, classId, res.error ?? "unknown error");
  }
  return res;
}

/**
 * Sends a class email after the response. `what` names it in the logs and
 * the failure row ("review notes", "removed participant", ...).
 */
export function mailClass(what: string, classId: string | null, message: ClassMail): void {
  after(async () => {
    await sendClassEmail(what, classId, message);
  });
}

export type EmailButton = { text: string; url: string; tone?: "primary" | "plain" };

/**
 * The classes email body, inside the site's shared frame (emailShell). Rows
 * are label and value pairs; `bodyHtml` must already be escaped.
 */
export function classEmailHtml(input: {
  heading: string;
  intro?: string;
  rows?: { label: string; value: string }[];
  bodyHtml?: string;
  buttons?: EmailButton[];
  note?: string;
}): string {
  const rows = (input.rows ?? [])
    .map(
      (r) =>
        `<p style="margin:6px 0"><strong style="color:#16181B">${escapeHtml(r.label)}:</strong> ${escapeHtml(r.value)}</p>`
    )
    .join("");
  const buttons = (input.buttons ?? [])
    .map((b) =>
      b.tone === "plain"
        ? `<a href="${escapeHtml(b.url)}" style="display:inline-block;margin:0 8px 8px 0;color:#1B36C8;text-decoration:none;padding:11px 16px;border:2px solid #16181B;border-radius:4px;font-weight:700">${escapeHtml(b.text)}</a>`
        : `<a href="${escapeHtml(b.url)}" style="display:inline-block;margin:0 8px 8px 0;background:#1B36C8;color:#ffffff;text-decoration:none;padding:11px 20px;border:2px solid #16181B;border-radius:4px;font-weight:700">${escapeHtml(b.text)}</a>`
    )
    .join("");
  return emailShell(`
    <p style="margin:0 0 14px;font-weight:700;font-size:17px">${escapeHtml(input.heading)}</p>
    ${input.intro ? `<p style="margin:0 0 14px">${escapeHtml(input.intro)}</p>` : ""}
    ${rows}
    ${input.bodyHtml ?? ""}
    ${buttons ? `<p style="margin:20px 0 6px">${buttons}</p>` : ""}
    ${input.note ? `<p style="margin:16px 0 0;color:#565C60;font-size:13px">${escapeHtml(input.note)}</p>` : ""}
  `);
}

/** A short list of already-escaped items. */
export function emailListHtml(items: string[]): string {
  if (items.length === 0) return "";
  return `<ul style="margin:8px 0;padding-left:18px">${items.map((i) => `<li style="margin:0 0 6px">${i}</li>`).join("")}</ul>`;
}

/**
 * "Thu, Nov 20, 5:00 PM PT": class times in emails are always Pacific. The
 * same helper every class page uses (src/lib/classes/class-time.ts), so an
 * email and the page it links to print a time the same way.
 */
export { pacificTime } from "@/lib/classes/class-time";
