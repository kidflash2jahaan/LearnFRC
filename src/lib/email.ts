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
export const emailShell = (inner: string) => `
<div style="background:#060912;padding:40px 0;font-family:Inter,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#0c1220;border:1px solid #1d2740;border-radius:18px;overflow:hidden">
    <div style="background:linear-gradient(110deg,#2f5fff,#22d3ee);padding:28px 32px">
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.02em">LearnFRC</div>
      <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:2px">Master FIRST Robotics Competition</div>
    </div>
    <div style="padding:30px 32px;color:#e8edf7;font-size:15px;line-height:1.6">${inner}</div>
    <div style="padding:18px 32px;border-top:1px solid #1d2740;color:#94a2bf;font-size:12px">
      LearnFRC · Built by Jahaan Pardhanani
    </div>
  </div>
</div>`;
const shell = emailShell;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
        `<p style="margin:6px 0"><strong style="color:#c8d3ee">${esc(r.label)}:</strong> ${esc(r.value)}</p>`
    )
    .join("");
  return shell(`
    <p style="margin:0 0 14px;font-weight:700;font-size:17px">${esc(heading)}</p>
    ${rowsHtml}
    ${bodyHtml ?? ""}
    ${
      ctaText && ctaUrl
        ? `<p style="margin:20px 0 6px"><a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(110deg,#2f5fff,#22d3ee);color:#fff;text-decoration:none;padding:11px 20px;border-radius:12px;font-weight:600">${esc(ctaText)} →</a></p>`
        : ""
    }
    ${note ? `<p style="margin:16px 0 0;color:#94a2bf;font-size:13px">${esc(note)}</p>` : ""}
  `);
}

export function welcomeEmailHtml(name?: string | null) {
  const greeting = name ? `Hey ${name},` : "Welcome aboard,";
  return shell(`
    <p style="margin:0 0 14px">${greeting}</p>
    <p style="margin:0 0 14px">Welcome to <strong>LearnFRC</strong> — your structured path to mastering every department of FIRST Robotics Competition, from swerve drivetrains and WPILib to the Impact Award and scouting.</p>
    <p style="margin:0 0 22px">Pick a department, work through the guides, and track your progress as you go.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com"}/guides"
       style="display:inline-block;background:linear-gradient(110deg,#2f5fff,#22d3ee);color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">Explore the guides →</a>
    <p style="margin:22px 0 0;color:#94a2bf">Gracious professionalism, always. 🤖</p>
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
  return shell(`
    <p style="margin:0 0 10px;font-weight:600">New feedback / topic request</p>
    <p style="margin:0 0 10px;white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
    <p style="margin:14px 0 0;color:#94a2bf;font-size:13px">From: ${
      fromEmail || "anonymous"
    }${page ? ` · Page: ${page}` : ""}</p>
  `);
}

export function errorEmailHtml({
  message,
  stack,
  url,
  kind,
  digest,
  userAgent,
}: {
  message: string;
  stack?: string;
  url?: string;
  kind?: string;
  digest?: string;
  userAgent?: string;
}) {
  const esc = (s: string) => s.replace(/</g, "&lt;");
  return shell(`
    <p style="margin:0 0 10px;font-weight:600;color:#ff6b6b">⚠️ ${esc(kind || "Error")} on LearnFRC</p>
    <p style="margin:0 0 12px;white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:13px">${esc(message)}</p>
    ${url ? `<p style="margin:0 0 6px;color:#94a2bf;font-size:13px">URL: ${esc(url)}</p>` : ""}
    ${digest ? `<p style="margin:0 0 6px;color:#94a2bf;font-size:13px">Digest: ${esc(digest)}</p>` : ""}
    ${userAgent ? `<p style="margin:0 0 12px;color:#94a2bf;font-size:12px">UA: ${esc(userAgent)}</p>` : ""}
    ${stack ? `<pre style="margin:8px 0 0;padding:12px;background:#070b14;border:1px solid #1d2740;border-radius:10px;color:#94a2bf;font-size:11px;overflow:auto;white-space:pre-wrap">${esc(stack).slice(0, 4000)}</pre>` : ""}
  `);
}

export function subscribeEmailHtml() {
  return shell(`
    <p style="margin:0 0 14px">Thanks for joining the LearnFRC list! 🤖</p>
    <p style="margin:0 0 18px">We'll send the occasional update on new departments, lessons, and features. In the meantime, dive in:</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com"}/guides"
       style="display:inline-block;background:linear-gradient(110deg,#2f5fff,#22d3ee);color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">Explore the guides</a>
  `);
}
