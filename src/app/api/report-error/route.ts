import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, feedbackEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Anonymous, no-account error report / contact endpoint.
 *
 * This is the ONLY way to reach the site without signing up. `learnfrc.com`
 * publishes no MX record, so every `mailto:` on the site bounced; the
 * maintainer is a minor, so a personal address can't be published either.
 * Everything that used to say "email us" now points at a form that POSTs here.
 *
 * Deliberately never reads the session: a signed-in reader who wants to report
 * something anonymously gets to. The richer, attributable path (rewrite the
 * markdown yourself, land in the public queue) is still the "Suggest an edit"
 * control on every lesson and article — this is the fallback, not a
 * replacement.
 *
 * Rows land in the existing `feedback` table, so they show up in the admin
 * inbox and can be replied to with the existing reply flow (only when the
 * sender chose to leave an address). No schema change: the submission kind is
 * carried as a short prefix on the message text.
 */

/** Hard ceiling on the raw request body, checked before it is buffered. */
const MAX_BODY_BYTES = 16_000;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 4000;
/** RFC 5321 maximum path length for an address. */
const MAX_EMAIL = 254;
const MAX_PAGE = 300;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Submission kinds and the label prefixed onto the stored message so the admin
 * inbox can tell a bug report from a privacy request at a glance. Allow-listed
 * — an unknown value falls back to "contact" rather than being stored.
 */
const KIND_LABEL = {
  error: "Error report",
  contact: "Contact",
} as const;
type Kind = keyof typeof KIND_LABEL;

function isKind(v: unknown): v is Kind {
  return typeof v === "string" && v in KIND_LABEL;
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * Strip C0/C1 control characters that would corrupt the stored row or the
 * notification email. Tab, newline and carriage return survive — people write
 * multi-line reports.
 */
function cleanBody(s: string): string {
   
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

/** Same, for single-line fields: every control character goes, including \n. */
function cleanLine(s: string): string {
   
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

export async function POST(req: Request) {
  // Cheap rejection before anything is buffered. A lying Content-Length is
  // caught by the identical check on the decoded body below.
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
    return fail(413, "That message is too long.");

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return fail(400, "Couldn't read that request.");
  }
  if (raw.length > MAX_BODY_BYTES) return fail(413, "That message is too long.");
  if (!raw.trim()) return fail(400, "Nothing was sent.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Expected a JSON body.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return fail(400, "Expected a JSON object.");
  const input = body as Record<string, unknown>;

  const message = cleanBody(
    typeof input.message === "string" ? input.message : ""
  );
  if (!message) return fail(400, "Please describe the problem.");
  if (message.length < MIN_MESSAGE)
    return fail(400, "Please add a little more detail — what's wrong, and where?");
  if (message.length > MAX_MESSAGE)
    return fail(
      400,
      `That's longer than ${MAX_MESSAGE} characters — please trim it down.`
    );

  // Optional. Blank is the expected case: this path exists precisely so people
  // who don't want to hand over an address can still report something.
  const emailRaw = cleanLine(
    typeof input.email === "string" ? input.email : ""
  ).toLowerCase();
  if (emailRaw && (emailRaw.length > MAX_EMAIL || !EMAIL_RE.test(emailRaw)))
    return fail(400, "That email doesn't look right — fix it or leave it blank.");

  // Free text, not a trusted URL. It is stored and rendered as text (React
  // escapes it in the admin inbox, and `feedbackEmailHtml` escapes it in the
  // notification), so it is capped and control-stripped rather than parsed.
  const page = cleanLine(typeof input.page === "string" ? input.page : "").slice(
    0,
    MAX_PAGE
  );

  const kind: Kind = isKind(input.kind) ? input.kind : "contact";

  // Per-IP, generous enough that a reader filing several real reports in one
  // sitting is never blocked, tight enough that one host can't fill the inbox.
  // Note it is per-IP, so a whole team behind one school NAT shares the budget.
  const allowed =
    (await rateLimit("report-error", 10, 3600)) &&
    (await rateLimit("report-error-daily", 30, 86400));
  if (!allowed)
    return fail(
      429,
      "That's a lot of reports from one connection — please try again later."
    );

  const stored = `[${KIND_LABEL[kind]}] ${message}`;

  const { error } = await createAdminClient()
    .from("feedback")
    .insert({
      message: stored,
      page: page || null,
      from_email: emailRaw || null,
      // Never attributed, even for a signed-in reader. See the note above.
      user_id: null,
    });
  if (error) {
    // A dropped write here means a reader who was told "sent" was lied to, and
    // a correction the site promised to act on is gone. Log it AND fail loudly
    // so the form can tell them to try again.
    console.error("[report-error] insert failed:", error.message);
    return fail(500, "Couldn't save that just now — please try again.");
  }

  // Notification is best-effort: the row above is the durable record, so a
  // mail outage must not turn a saved report into an error for the reader.
  // It is still logged — a silent email failure is how this project lost 24
  // days of referral data.
  const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (adminEmail) {
    const res = await sendEmail({
      to: adminEmail,
      subject: `LearnFRC — ${KIND_LABEL[kind].toLowerCase()} (anonymous form)`,
      html: feedbackEmailHtml({
        message: stored,
        fromEmail: emailRaw || undefined,
        page: page || undefined,
      }),
      replyTo: emailRaw || undefined,
    });
    if (!res.ok)
      console.error("[report-error] admin notification failed:", res.error);
  } else {
    console.warn(
      "[report-error] ADMIN_EMAILS is unset — report stored, nobody notified."
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
