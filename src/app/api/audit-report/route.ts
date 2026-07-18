import { NextResponse } from "next/server";
import { sendEmail, adminNotifyHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Receives the daily accuracy-audit report from the scheduled cloud agent and
 * emails it to the admin. CRON_SECRET-gated so only the audit routine can post
 * here — this keeps the Resend key server-side (the routine never holds it).
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

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
          (a) => `<div style="margin:0 0 14px;padding:12px 14px;background:#f4f7fd;border:1px solid #e2e8f5;border-radius:10px">
        <div style="font-weight:600;color:#0f1c33"><a href="${site}/blog/${esc(a.slug)}" style="color:#2560e6">${esc(a.slug)}</a> ${a.itemType ? `<span style="color:#64748b;font-weight:400">· ${esc(a.itemType)}</span>` : ""}</div>
        <div style="margin-top:6px;color:#b42318;font-size:13px">− ${esc(a.before)}</div>
        <div style="color:#067647;font-size:13px">+ ${esc(a.after)}</div>
        <div style="margin-top:6px;color:#64748b;font-size:12px">Source: ${esc(a.source)}</div>
      </div>`
        )
        .join("")
    : `<p style="color:#64748b">No fixes applied this run.</p>`;

  const flaggedHtml = flagged.length
    ? flagged
        .map(
          (f) => `<div style="margin:0 0 10px;padding:10px 12px;background:#fffaf0;border:1px solid #fde9c8;border-radius:10px">
        <div style="font-weight:600;color:#0f1c33">${esc(f.slug)}</div>
        <div style="margin-top:4px;color:#1e2a44;font-size:13px">${esc(f.claim)}</div>
        <div style="margin-top:4px;color:#8a6d3b;font-size:12px">${esc(f.why)}${f.source ? ` · ${esc(f.source)}` : ""}</div>
      </div>`
        )
        .join("")
    : `<p style="color:#64748b">Nothing flagged for review.</p>`;

  const html = adminNotifyHtml({
    heading: "Daily accuracy audit",
    rows: [
      { label: "Items scanned", value: String(scanned) },
      { label: "Fixes applied", value: String(applied.length) },
      { label: "Flagged for review", value: String(flagged.length) },
    ],
    bodyHtml: `
      <p style="margin:18px 0 8px;font-weight:700">Fixes applied</p>
      ${appliedHtml}
      <p style="margin:20px 0 8px;font-weight:700">Flagged for your review (not changed)</p>
      ${flaggedHtml}
    `,
    note: "Auto-applied fixes were each backed by a primary source. Reply-review anything above; edits are reversible in the admin content tools.",
  });

  const res = await sendEmail({
    to: admin,
    subject: `🔎 LearnFRC audit — ${applied.length} fixed, ${flagged.length} flagged`,
    html,
  });
  return NextResponse.json({ ok: res.ok, applied: applied.length, flagged: flagged.length });
}
