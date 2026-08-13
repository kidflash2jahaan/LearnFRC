import "server-only";

const FROM = process.env.EMAIL_FROM || "LearnFRC <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "missing RESEND_API_KEY" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The one shared email frame — every LearnFRC email renders inside this. */
const emailShell = (inner: string) => `
<div style="background:#eef3fb;padding:40px 20px;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f5;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(16,30,60,0.08)">
    <div style="background:linear-gradient(110deg,#2560e6,#1aa9d6);padding:28px 32px">
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.02em">LearnFRC</div>
      <div style="color:rgba(255,255,255,0.9);font-size:13px;margin-top:2px">Master FIRST Robotics Competition</div>
    </div>
    <div style="padding:30px 32px;color:#1e2a44;font-size:15px;line-height:1.6">${inner}</div>
    <div style="padding:18px 32px;border-top:1px solid #eef2f9;color:#64748b;font-size:12px">
      LearnFRC · Built by Jahaan Pardhanani
    </div>
  </div>
</div>`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Lifecycle frame — same look as emailShell, for RELATIONSHIP emails to a
 * registered user about their OWN account activity (their unfinished lessons /
 * progress). Kept strictly non-promotional so its primary purpose is
 * relationship/transactional, which under CAN-SPAM does not require a physical
 * postal address. We still include a one-click unsubscribe as courtesy + a
 * settings link. Do NOT add promotional content here or it changes category.
 */
const marketingShell = (
  inner: string,
  unsubscribeUrl: string,
  /** Why this person is receiving THIS email. Must be true for the segment it
   * is used with — a learner who has never opened a lesson does not have
   * "lessons in progress", and telling them they do is the kind of small lie
   * that earns a spam complaint. Defaults to the original wording. */
  reason: string = "You're getting this because you have a LearnFRC account with lessons in progress."
) => {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";
  const address = process.env.MAILING_ADDRESS; // optional; shown only if set
  return `
<div style="background:#eef3fb;padding:40px 20px;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f5;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(16,30,60,0.08)">
    <div style="background:linear-gradient(110deg,#2560e6,#1aa9d6);padding:28px 32px">
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.02em">LearnFRC</div>
      <div style="color:rgba(255,255,255,0.9);font-size:13px;margin-top:2px">Master FIRST Robotics Competition</div>
    </div>
    <div style="padding:30px 32px;color:#1e2a44;font-size:15px;line-height:1.6">${inner}</div>
    <div style="padding:18px 32px;border-top:1px solid #eef2f9;color:#64748b;font-size:12px;line-height:1.6">
      ${reason} Manage emails in your
      <a href="${site}/settings" style="color:#2560e6">settings</a> or
      <a href="${unsubscribeUrl}" style="color:#2560e6">turn these off</a>.${address ? `<br/>LearnFRC · ${esc(address)}` : ""}
    </div>
  </div>
</div>`;
};

/**
 * Which win-back conversation this learner is actually in. The three are
 * genuinely different situations and get genuinely different emails:
 *   never_started — has an account, has never completed a lesson. Sent ONCE,
 *                   ever. They need a starting point, not a reminder.
 *   stalled_early — 1-4 lessons then stopped. They have context but never got
 *                   deep enough for the product to be worth anything to them.
 *   deep_churn    — 5+ lessons then stopped. Demonstrated affinity; the email
 *                   can safely assume they know what LearnFRC is.
 */
export type LifecycleSegment =
  | "never_started"
  | "stalled_early"
  | "deep_churn";

export type LifecycleEmailProps = {
  segment: LifecycleSegment;
  name?: string | null;
  unsubscribeUrl: string;
  /** The learner's real next lesson — named, summarised, deep-linked. */
  nextLessonTitle?: string | null;
  nextLessonHref?: string | null;
  nextLessonSummary?: string | null;
  /** The department that lesson lives in + their true position inside it. */
  departmentName?: string | null;
  departmentDone?: number;
  departmentTotal?: number;
  /** Measured lifetime facts. Never estimates, never projections. */
  completed?: number;
  activeDays?: number;
  daysSinceLastLesson?: number | null;
  lastLessonTitle?: string | null;
  /** never_started only: the honest shape of the starter lesson. */
  readMinutes?: number | null;
  quizQuestions?: number | null;
  /** Referral link. Only passed once the product's own 5-lesson gate is met. */
  inviteUrl?: string | null;
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "3 days ago" / "yesterday" — reads as a fact, never as a reprimand. */
const agoPhrase = (days: number | null | undefined) =>
  days === null || days === undefined
    ? null
    : days <= 0
      ? "today"
      : days === 1
        ? "yesterday"
        : `${days} days ago`;

/**
 * Subject line for a lifecycle email. Always names the actual next lesson, so
 * the subject is useful on its own and is never a generic "we miss you".
 */
export function lifecycleEmailSubject(p: LifecycleEmailProps): string {
  const title = p.nextLessonTitle;
  const dept = p.departmentName;
  if (!title) return "Your next FRC lesson";
  if (p.segment === "never_started") return `Start here: ${title}`;
  if (p.segment === "deep_churn" && p.completed && dept)
    return `${plural(p.completed, "lesson")} in, next up: ${title}`;
  return dept ? `Next in ${dept}: ${title}` : `Your next lesson: ${title}`;
}

/**
 * Lifecycle win-back email — RELATIONSHIP content only, strictly about this
 * learner's own account and their own next lesson. Deliberately contains no
 * deadline, no expiring offer, no streak-at-risk framing and no "you're falling
 * behind": every eligible learner is by definition dormant, so manufactured
 * urgency would be both false and the fastest route to a spam complaint. The
 * only claims made are ones read straight out of the database.
 */
export function lifecycleEmailHtml(p: LifecycleEmailProps): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";
  const greeting = p.name ? `Hey ${esc(p.name)},` : "Hey,";
  const dept = p.departmentName ? esc(p.departmentName) : null;

  // Deep-link straight at the lesson page. Landing on a lesson rather than the
  // dashboard is the single strongest predictor of depth in the funnel data, so
  // the dashboard is only ever a fallback.
  const ctaHref =
    p.nextLessonHref && p.nextLessonHref.startsWith("/")
      ? `${site}${p.nextLessonHref}`
      : `${site}/dashboard`;

  const eyebrow =
    p.segment === "never_started"
      ? "Your first lesson"
      : dept
        ? `Next in ${dept}`
        : "Your next lesson";

  const nextBlock = p.nextLessonTitle
    ? `<div style="margin:0 0 22px;padding:16px 18px;background:#f6f9fe;border:1px solid #e2e8f5;border-radius:14px">
         <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.06em">${eyebrow}</p>
         <p style="margin:0;font-size:18px;font-weight:700;color:#0f1c33;line-height:1.35">${esc(p.nextLessonTitle)}</p>
         ${
           p.nextLessonSummary
             ? `<p style="margin:8px 0 0;color:#475569;font-size:14px;line-height:1.55">${esc(p.nextLessonSummary)}</p>`
             : ""
         }
       </div>`
    : "";

  const ctaLabel =
    p.segment === "never_started"
      ? "Read this lesson →"
      : dept
        ? `Continue in ${dept} →`
        : "Continue this lesson →";

  // Position-in-department, stated as a fact. Only rendered when both numbers
  // are known, so it can never read "lesson 1 of 0".
  const positionLine =
    dept && p.departmentTotal
      ? `<p style="margin:18px 0 0;color:#64748b;font-size:13px">You've done ${p.departmentDone ?? 0} of ${p.departmentTotal} lessons in ${dept}.</p>`
      : "";

  let intro: string;
  let closing: string;
  let reason: string;

  if (p.segment === "never_started") {
    const shape =
      p.readMinutes && p.quizQuestions
        ? `It's about ${plural(p.readMinutes, "minute")} of reading, then ${plural(p.quizQuestions, "multiple-choice question")} at the end. You need all ${p.quizQuestions} right for it to count, and you can retry as many times as you like.`
        : p.readMinutes
          ? `It's about ${plural(p.readMinutes, "minute")} of reading, then a short quiz at the end. You can retry the quiz as many times as you like.`
          : `It's a short read with a quick quiz at the end. You can retry the quiz as many times as you like.`;
    // Says "finished", never "opened". This segment is defined purely by having
    // zero rows in lesson_progress, and that table only records COMPLETIONS — so
    // a reader who opened ten lessons and finished none lands in this segment.
    // Telling them they never opened one is simply false to their face, and
    // being caught in a small lie is exactly the failure mode this project can
    // least afford right now.
    intro = `<p style="margin:0 0 16px">You created a LearnFRC account but haven't finished a lesson yet. Nothing's wrong: picking where to start out of 394 lessons is the hard part, so here's the one we'd start you on.</p>`;
    closing = `<p style="margin:18px 0 0;color:#64748b;font-size:13px">${shape}</p>
      <p style="margin:10px 0 0;color:#64748b;font-size:13px">Everything on LearnFRC is free and there's nothing else to set up. If it turns out not to be what you wanted, you can turn these off below. No hard feelings.</p>`;
    reason = `You're getting this once because you created a LearnFRC account and haven't finished a lesson yet. It's the only reminder we'll send about it.`;
  } else if (p.segment === "stalled_early") {
    const last = p.lastLessonTitle
      ? ` Your last one was <strong>${esc(p.lastLessonTitle)}</strong>${
          agoPhrase(p.daysSinceLastLesson)
            ? `, ${agoPhrase(p.daysSinceLastLesson)}`
            : ""
        }.`
      : "";
    intro = `<p style="margin:0 0 16px">You've finished <strong>${plural(p.completed ?? 0, "lesson")}</strong> on LearnFRC.${last} Here's what comes next.</p>`;
    // "There's no streak to keep" used to sit here, and it was simply false.
    // `handle_lesson_completed` awards `10 + least(10, streak - 1)` XP per
    // lesson, where the streak is the run of consecutive days with a
    // completion — so a streak exists, it lapses, and it is worth up to double
    // XP. Telling a learner otherwise is a claim they can disprove from their
    // own dashboard, which shows the multiplier. The replacement says only
    // what is true: nothing already earned goes away, consecutive days pay
    // more, and a new run costs exactly one lesson. No deadline, no
    // streak-at-risk framing — this segment's streak has already lapsed by
    // definition, so urgency here would be manufactured as well as unkind.
    closing = `${positionLine}
      <p style="margin:10px 0 0;color:#64748b;font-size:13px">Nothing you've finished expires: your lessons and XP stay exactly as you left them. Lessons on back-to-back days earn bonus XP, and a new run starts with your next one, so pick it up whenever the shop's quiet.</p>`;
    reason = `You're getting this because you have a LearnFRC account with lessons in progress.`;
  } else {
    const daysLine =
      p.activeDays && p.activeDays > 1
        ? ` across ${plural(p.activeDays, "day")}`
        : "";
    const last = p.lastLessonTitle
      ? ` Your last one was <strong>${esc(p.lastLessonTitle)}</strong>${
          agoPhrase(p.daysSinceLastLesson)
            ? `, ${agoPhrase(p.daysSinceLastLesson)}`
            : ""
        }.`
      : "";
    intro = `<p style="margin:0 0 16px">You're <strong>${plural(p.completed ?? 0, "lesson")}</strong> into LearnFRC${daysLine}: that's real work.${last} Whenever you want to pick it back up, this is where you left off.</p>`;
    closing = `${positionLine}
      <p style="margin:10px 0 0;color:#64748b;font-size:13px">Nothing expires and your progress is saved exactly as you left it.</p>`;
    reason = `You're getting this because you have a LearnFRC account with lessons in progress.`;
  }

  // The referral ask is gated on the same 5-lesson milestone the dashboard
  // uses, so it only ever reaches people who have actually earned the invite.
  const inviteBlock =
    p.inviteUrl && p.segment === "deep_churn"
      ? `<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #eef2f9;color:#64748b;font-size:13px">
           Learning with a team? Bring a teammate and you <strong>both get +25 XP</strong>:
           <a href="${p.inviteUrl}" style="color:#2560e6;font-weight:600">share your invite link</a>.
         </p>`
      : "";

  return marketingShell(
    `
    <p style="margin:0 0 14px">${greeting}</p>
    ${intro}
    ${nextBlock}
    <a href="${ctaHref}"
       style="display:inline-block;background:linear-gradient(110deg,#2560e6,#1aa9d6);color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">${ctaLabel}</a>
    ${closing}
    ${inviteBlock}
    <p style="margin:22px 0 0;color:#64748b">Gracious professionalism, always. 🤖</p>
  `,
    p.unsubscribeUrl,
    reason
  );
}

/**
 * Consistent admin-notification body (used by edit/submission notifications and
 * the moderation digest) so every operational email looks identical.
 */
export function adminNotifyHtml({
  heading,
  rows = [],
  bodyHtml,
  ctaText,
  ctaUrl,
  note,
}: {
  heading: string;
  rows?: { label: string; value: string }[];
  bodyHtml?: string;
  ctaText?: string;
  ctaUrl?: string;
  note?: string;
}) {
  const rowsHtml = rows
    .map(
      (r) =>
        `<p style="margin:6px 0"><strong style="color:#334155">${esc(r.label)}:</strong> ${esc(r.value)}</p>`
    )
    .join("");
  return emailShell(`
    <p style="margin:0 0 14px;font-weight:700;font-size:17px">${esc(heading)}</p>
    ${rowsHtml}
    ${bodyHtml ?? ""}
    ${
      ctaText && ctaUrl
        ? `<p style="margin:20px 0 6px"><a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(110deg,#2560e6,#1aa9d6);color:#fff;text-decoration:none;padding:11px 20px;border-radius:12px;font-weight:600">${esc(ctaText)} →</a></p>`
        : ""
    }
    ${note ? `<p style="margin:16px 0 0;color:#64748b;font-size:13px">${esc(note)}</p>` : ""}
  `);
}

export function welcomeEmailHtml(name?: string | null) {
  const greeting = name ? `Hey ${name},` : "Welcome aboard,";
  return emailShell(`
    <p style="margin:0 0 14px">${greeting}</p>
    <p style="margin:0 0 14px">Welcome to <strong>LearnFRC</strong>: your structured path to mastering every department of FIRST Robotics Competition, from swerve drivetrains and WPILib to the Impact Award and scouting.</p>
    <p style="margin:0 0 22px">Pick a department, work through the guides, and track your progress as you go.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com"}/guides"
       style="display:inline-block;background:linear-gradient(110deg,#2560e6,#1aa9d6);color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">Explore the guides →</a>
    <p style="margin:22px 0 0;color:#64748b">Gracious professionalism, always. 🤖</p>
  `);
}

export function feedbackEmailHtml({
  message,
  fromEmail,
  page,
}: {
  message: string;
  fromEmail?: string;
  page?: string;
}) {
  // Every interpolation goes through `esc`. `message` used to be `<`-only and
  // `fromEmail`/`page` were interpolated raw — fine while the only caller was a
  // server action, but /api/report-error accepts these fields from anonymous
  // visitors, and an unescaped field is markup injected into the admin's inbox.
  return emailShell(`
    <p style="margin:0 0 10px;font-weight:600">New feedback / topic request</p>
    <p style="margin:0 0 10px;white-space:pre-wrap">${esc(message)}</p>
    <p style="margin:14px 0 0;color:#64748b;font-size:13px">From: ${esc(
      fromEmail || "anonymous"
    )}${page ? ` · Page: ${esc(page)}` : ""}</p>
  `);
}

/**
 * Personal reply the admin sends back to someone who left feedback / a support
 * note. Relationship/transactional (a direct answer to a message they sent us),
 * so no marketing footer or unsubscribe is required.
 */
export function feedbackReplyHtml({
  reply,
  original,
}: {
  reply: string;
  original?: string | null;
}) {
  return emailShell(`
    <p style="margin:0 0 14px">Thanks for reaching out to LearnFRC. Here&rsquo;s a reply to your message:</p>
    <div style="margin:0 0 16px;padding:14px 16px;background:#f4f7fd;border:1px solid #e2e8f5;border-radius:12px;white-space:pre-wrap;color:#1e2a44">${esc(
      reply
    )}</div>
    ${
      original
        ? `<p style="margin:0 0 6px;color:#64748b;font-size:12px">In reply to what you sent:</p>
    <div style="margin:0;padding:12px 14px;background:#fbfcfe;border:1px solid #eef2f9;border-radius:10px;color:#64748b;font-size:13px;white-space:pre-wrap">${esc(
      original
    ).slice(0, 800)}</div>`
        : ""
    }
    <p style="margin:18px 0 0">Jahaan · LearnFRC</p>
  `);
}

export function subscribeEmailHtml() {
  return emailShell(`
    <p style="margin:0 0 14px">Thanks for joining the LearnFRC list! 🤖</p>
    <p style="margin:0 0 18px">We'll send the occasional update on new departments, lessons, and features. In the meantime, dive in:</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com"}/guides"
       style="display:inline-block;background:linear-gradient(110deg,#2560e6,#1aa9d6);color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">Explore the guides</a>
  `);
}
