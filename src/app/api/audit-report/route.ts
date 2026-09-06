import { NextResponse } from "next/server";
import { sendEmail, adminNotifyHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Receives the daily accuracy-audit report from the scheduled cloud agent and
 * emails it to the admin. CRON_SECRET-gated so only the audit routine can post
 * here — this keeps the Resend key server-side (the routine never holds it).
 *
 * The report is a page of corrections, so it is set like one: card stock ruled
 * in ink, the wrong line struck through in pencil grey, the line that replaced
 * it in bold ink, and the source underneath in the mono face every identifier
 * on this site uses. The old version leaned on red and green text to say which
 * line was which, which is a colour the palette does not own and which says
 * nothing at all in a mail client that strips styles.
 */
function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    url.searchParams.get("secret") === secret ||
    req.headers.get("x-cron-secret") === secret
  );
}

type Applied = { slug: string; itemType?: string; before: string; after: string; source: string };
type Flagged = { slug: string; claim: string; why: string; source?: string };

const CARD = "#F5F6F2";
const INK = "#16181B";
const GRAPHITE = "#565C60";
const BLUE = "#1B36C8";
const RULE = "rgba(22,24,27,0.30)";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const slug = (text: string) =>
  `<div style="font-family:${MONO};font-size:12px;letter-spacing:.04em;color:${GRAPHITE}">${text}</div>`;

export async function POST(req: Request) {
  if (!authed(req)) return new NextResponse("Unauthorized", { status: 401 });
  const admin = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (!admin) return NextResponse.json({ ok: false, skipped: "no ADMIN_EMAILS" });

  let body: { scanned?: number; applied?: Applied[]; flagged?: Flagged[] } = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  const scanned = Number(body.scanned ?? 0);
  const applied = Array.isArray(body.applied) ? body.applied.slice(0, 100) : [];
  const flagged = Array.isArray(body.flagged) ? body.flagged.slice(0, 100) : [];

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

  const appliedHtml = applied.length
    ? applied
        .map(
          (a) => `<div style="margin:0 0 14px;padding:12px 14px;background:${CARD};border:2px solid ${INK};border-radius:10px">
        ${slug(`article / ${esc(a.slug)}${a.itemType ? ` / ${esc(a.itemType)}` : ""}`)}
        <div style="margin-top:6px;font-weight:700"><a href="${site}/blog/${esc(a.slug)}" style="color:${BLUE};text-decoration:underline">${esc(a.slug)}</a></div>
        <div style="margin-top:8px;color:${GRAPHITE};font-size:13px;text-decoration:line-through">${esc(a.before)}</div>
        <div style="margin-top:2px;color:${INK};font-size:13px;font-weight:700">${esc(a.after)}</div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${RULE};font-family:${MONO};font-size:12px;color:${GRAPHITE}">source / ${esc(a.source)}</div>
      </div>`
        )
        .join("")
    : `<p style="color:${GRAPHITE}">No fixes applied this run.</p>`;

  const flaggedHtml = flagged.length
    ? flagged
        .map(
          (f) => `<div style="margin:0 0 10px;padding:12px 14px;background:${CARD};border:1px dashed ${RULE};border-left:3px solid ${INK};border-radius:10px">
        ${slug(`article / ${esc(f.slug)}`)}
        <div style="margin-top:6px;color:${INK};font-size:13px">${esc(f.claim)}</div>
        <div style="margin-top:6px;color:${GRAPHITE};font-size:12px">${esc(f.why)}${f.source ? `<br>source / ${esc(f.source)}` : ""}</div>
      </div>`
        )
        .join("")
    : `<p style="color:${GRAPHITE}">Nothing flagged for review.</p>`;

  const html = adminNotifyHtml({
    heading: "Daily accuracy audit",
    rows: [
      { label: "Items scanned", value: String(scanned) },
      { label: "Fixes applied", value: String(applied.length) },
      { label: "Flagged for review", value: String(flagged.length) },
    ],
    bodyHtml: `
      <p style="margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid ${INK};font-weight:800">Fixes applied</p>
      ${appliedHtml}
      <p style="margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid ${INK};font-weight:800">Flagged for your review, not changed</p>
      ${flaggedHtml}
    `,
    note: "Auto-applied fixes were each backed by a primary source. Reply-review anything above; edits are reversible in the admin content tools.",
  });

  const res = await sendEmail({
    to: admin,
    subject: `LearnFRC audit: ${applied.length} fixed, ${flagged.length} flagged`,
    html,
  });
  return NextResponse.json({ ok: res.ok, applied: applied.length, flagged: flagged.length });
}
