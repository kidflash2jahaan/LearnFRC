import { NextResponse } from "next/server";
import { sendEmail, adminNotifyHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * The scheduled routine POSTs the combined results of all three checks here and
 * this sends ONE digest email, but only if something actually changed.
 * POST ?secret=CRON_SECRET  { progress, names, content }
 *
 * The cards below are drawn in the notebook's six values. They used to be
 * near-black panels with neon red and mint text, which is a second visual
 * language, and worse, they were being dropped inside a light email shell, so
 * every one of them arrived as a black block in the middle of a white page.
 * Now they are card stock ruled in ink, like every other surface on the site.
 *
 * A removed value is struck through in pencil grey and its replacement is set
 * in bold ink, so a change reads correctly in a client that strips colour, and
 * so nothing depends on telling red from green.
 */

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return (url.searchParams.get("secret") || req.headers.get("x-cron-secret")) === secret;
}

type Digest = {
  progress?: {
    deleted?: { username: string | null; email: string | null; completions: number; burstGaps: number }[];
    bannedIps?: string[];
  };
  names?: {
    done?: { oldUsername: string | null; newUsername: string | null; oldFullName: string | null; reason: string }[];
  };
  content?: { done?: { kind: string; title: string; decision: string; reason: string }[] };
};

const CARD = "#F5F6F2";
const INK = "#16181B";
const GRAPHITE = "#565C60";
const BLUE = "#1B36C8";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const esc = (s: string | null | undefined) => (s || "").replace(/</g, "&lt;");

const card = (inner: string) =>
  `<div style="margin:10px 0;padding:12px 14px;background:${CARD};border:2px solid ${INK};border-radius:10px">${inner}</div>`;

const heading = (text: string) =>
  `<h3 style="margin:22px 0 6px;padding-bottom:6px;border-bottom:2px solid ${INK};color:${INK};font-size:15px;font-weight:800">${text}</h3>`;

/** A mono slug, the way every identifier is set on the site itself. */
const slug = (text: string) =>
  `<span style="font-family:${MONO};font-size:12px;letter-spacing:.04em;color:${GRAPHITE}">${text}</span>`;

const was = (text: string) =>
  `<span style="color:${GRAPHITE};text-decoration:line-through">${text}</span>`;

const now = (text: string) => `<span style="font-weight:700;color:${INK}">${text}</span>`;

const note = (text: string) =>
  `<div style="margin-top:6px;color:${GRAPHITE};font-size:13px;line-height:1.5">${text}</div>`;

export async function POST(req: Request) {
  if (!authed(req)) return new NextResponse(null, { status: 401 });

  let body: Digest = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const del = body.progress?.deleted ?? [];
  const ips = body.progress?.bannedIps ?? [];
  const names = body.names?.done ?? [];
  const content = body.content?.done ?? [];
  if (del.length + names.length + content.length === 0) {
    return NextResponse.json({ sent: false, reason: "nothing changed" });
  }

  const sections: string[] = [];

  if (del.length) {
    const rows = del
      .map((d) =>
        card(
          `${slug("account / removed")}
           <div style="margin-top:4px;font-weight:700;color:${INK}">${was(esc(d.username))}${
             d.email ? ` ${slug(`(${esc(d.email)})`)}` : ""
           }</div>
           ${note(
             esc(
               `${d.burstGaps} lessons within seconds of each other, ${d.completions} total. Scripted.`
             )
           )}`
        )
      )
      .join("");
    sections.push(
      `${heading(
        `Leaderboard integrity: ${del.length} bot account${del.length > 1 ? "s" : ""} removed`
      )}${rows}${
        ips.length
          ? card(
              `${slug("network / banned")}<div style="margin-top:4px;font-weight:700;color:${INK}">${ips
                .map(esc)
                .join(", ")}</div>${note("Repeat offender, IP and device.")}`
            )
          : ""
      }`
    );
  }

  if (names.length) {
    const rows = names
      .map((x) =>
        card(
          `${slug("profile / auto-moderated")}
           <div style="margin-top:4px;color:${INK}">${
             x.newUsername
               ? `username ${was(esc(x.oldUsername))} to ${now(esc(x.newUsername))}`
               : ""
           }${
             x.oldFullName
               ? `${x.newUsername ? "<br>" : ""}full name ${was(esc(x.oldFullName))} cleared`
               : ""
           }</div>${x.reason ? note(esc(x.reason).slice(0, 300)) : ""}`
        )
      )
      .join("");
    sections.push(`${heading(`Names: ${names.length} auto-moderated`)}${rows}`);
  }

  if (content.length) {
    const label = (d: string) =>
      d === "approved" ? "Approved" : d === "rejected" ? "Rejected" : "Edited, then approved";
    const rows = content
      .map((x) =>
        card(
          `${slug(`${esc(x.kind)} / ${esc(x.decision)}`)}
           <div style="margin-top:4px;font-weight:700;color:${INK}">${label(
             x.decision
           )}: <span style="color:${BLUE}">${esc(x.title)}</span></div>${
             x.reason ? note(esc(x.reason).slice(0, 400)) : ""
           }`
        )
      )
      .join("");
    sections.push(`${heading(`Community content: ${content.length} reviewed`)}${rows}`);
  }

  const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (!adminEmail) return NextResponse.json({ sent: false, reason: "no admin email" });

  await sendEmail({
    to: adminEmail,
    subject: `LearnFRC checks: ${del.length} removed, ${names.length} names, ${content.length} content`,
    html: adminNotifyHtml({
      heading: "Scheduled checks, what changed",
      rows: [
        { label: "Bots removed", value: String(del.length) },
        { label: "Names moderated", value: String(names.length) },
        { label: "Content reviewed", value: String(content.length) },
      ],
      bodyHtml: `<div style="margin-top:8px">${sections.join("")}</div>`,
      ctaText: "Open the admin panel",
      ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`,
      note: "Names are reversible in name_moderation_log; content decisions in the admin panel. Removed accounts are scripted bots.",
    }),
  });

  return NextResponse.json({ sent: true });
}
