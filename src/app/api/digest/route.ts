import { NextResponse } from "next/server";
import { sendEmail, adminNotifyHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * The scheduled routine POSTs the combined results of all three checks here and
 * this sends ONE digest email — but only if something actually changed.
 * POST ?secret=CRON_SECRET  { progress, names, content }
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

const esc = (s: string | null | undefined) => (s || "").replace(/</g, "&lt;");
const card = (inner: string) =>
  `<div style="margin:10px 0;padding:10px 12px;background:#070b14;border:1px solid #1d2740;border-radius:10px">${inner}</div>`;

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
          `<div style="font-weight:600;color:#e8edf7">🤖 Removed <span style="color:#ff9b9b">${esc(d.username)}</span> ${d.email ? `<span style="color:#94a2bf;font-size:12px">(${esc(d.email)})</span>` : ""}</div>
           <div style="margin-top:4px;color:#94a2bf;font-size:13px">${esc(`${d.burstGaps} lessons within seconds of each other, ${d.completions} total — scripted`)}</div>`
        )
      )
      .join("");
    sections.push(
      `<h3 style="margin:18px 0 4px;color:#e8edf7;font-size:15px">Leaderboard integrity — ${del.length} bot account${del.length > 1 ? "s" : ""} removed</h3>${rows}${
        ips.length
          ? card(`<div style="color:#ffb27a">🚫 IP/device banned (repeat offender): ${ips.map(esc).join(", ")}</div>`)
          : ""
      }`
    );
  }

  if (names.length) {
    const rows = names
      .map((x) =>
        card(
          `<div style="color:#e8edf7">${
            x.newUsername
              ? `username <span style="color:#ff9b9b">${esc(x.oldUsername)}</span> → <span style="color:#8be9c3">${esc(x.newUsername)}</span>`
              : ""
          }${x.oldFullName ? `${x.newUsername ? "<br>" : ""}full name <span style="color:#ff9b9b">${esc(x.oldFullName)}</span> cleared` : ""}</div>${
            x.reason ? `<div style="margin-top:4px;color:#94a2bf;font-size:13px">${esc(x.reason).slice(0, 300)}</div>` : ""
          }`
        )
      )
      .join("");
    sections.push(
      `<h3 style="margin:18px 0 4px;color:#e8edf7;font-size:15px">Names — ${names.length} auto-moderated</h3>${rows}`
    );
  }

  if (content.length) {
    const label = (d: string) =>
      d === "approved" ? "✅ Approved" : d === "rejected" ? "❌ Rejected" : "✏️ Edited &amp; approved";
    const rows = content
      .map((x) =>
        card(
          `<div style="font-weight:600;color:#e8edf7">${label(x.decision)} — <span style="color:#c8d3ee">${esc(x.title)}</span> <span style="color:#94a2bf;font-size:12px">(${esc(x.kind)})</span></div>${
            x.reason ? `<div style="margin-top:4px;color:#94a2bf;font-size:13px">${esc(x.reason).slice(0, 400)}</div>` : ""
          }`
        )
      )
      .join("");
    sections.push(
      `<h3 style="margin:18px 0 4px;color:#e8edf7;font-size:15px">Community content — ${content.length} reviewed</h3>${rows}`
    );
  }

  const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (!adminEmail) return NextResponse.json({ sent: false, reason: "no admin email" });

  await sendEmail({
    to: adminEmail,
    subject: `🛡️ LearnFRC checks — ${del.length} removed · ${names.length} names · ${content.length} content`,
    html: adminNotifyHtml({
      heading: "Scheduled checks — what changed",
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
