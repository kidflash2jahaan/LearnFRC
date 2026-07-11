import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, lifecycleEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Automatic, recurring lifecycle email (Duolingo-style "come back / keep your
 * streak"). Runs on a schedule; on each run it emails a small batch of
 * ELIGIBLE lapsed users and never a mass blast. Eligibility is deliberately
 * conservative for legal + reputation safety:
 *   - email_opt_in = true (opt-out model; unsubscribe flips this)
 *   - email is CONFIRMED (implied: only confirmed users can sign in & complete
 *     lessons, so "engaged" already guarantees a confirmed inbox)
 *   - ENGAGED: completed >= 1 lesson (real relationship, wanted the service)
 *   - LAPSED: no lesson activity in the last 5 days (don't nag active users)
 *   - THROTTLED: not emailed in the last 7 days
 * Hard stop: refuses to send unless MAILING_ADDRESS is set (CAN-SPAM requires a
 * physical address in the footer). GET/POST ?secret=CRON_SECRET  [&dry=1]
 */

const DORMANT_DAYS = 5;
const THROTTLE_DAYS = 7;
const MAX_PER_RUN = 40; // stay well under Resend's 100/day free cap

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically, so
  // the secret never has to live in vercel.json. Also accept the manual forms.
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    url.searchParams.get("secret") === secret ||
    req.headers.get("x-cron-secret") === secret
  );
}

function streakFromDates(timestamps: string[]): number {
  const dayMs = 86_400_000;
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = new Set<string>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) days.add(keyOf(d));
  }
  if (!days.size) return 0;
  const today = new Date();
  if (
    !days.has(keyOf(today)) &&
    !days.has(keyOf(new Date(today.getTime() - dayMs)))
  )
    return 0;
  let streak = 0;
  const cur = new Date(today);
  if (!days.has(keyOf(cur))) cur.setTime(cur.getTime() - dayMs);
  while (days.has(keyOf(cur))) {
    streak++;
    cur.setTime(cur.getTime() - dayMs);
  }
  return streak;
}

async function run(req: Request) {
  if (!authed(req)) return new NextResponse(null, { status: 401 });

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

  // Compliance hard stop — never SEND without a physical postal address.
  // (dry-run only computes eligibility, so it's allowed without these.)
  if (!dry && !process.env.MAILING_ADDRESS) {
    return NextResponse.json({
      ok: false,
      skipped: "MAILING_ADDRESS not set — refusing to send (CAN-SPAM).",
    });
  }
  if (!dry && !process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, skipped: "no RESEND_API_KEY" });
  }

  const admin = createAdminClient();
  const now = Date.now();

  // 1) auth users -> confirmed email map
  const emailById = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email && (u.email_confirmed_at || u.confirmed_at))
        emailById.set(u.id, u.email);
    }
    if (users.length < 1000) break;
  }

  // 2) opted-in profiles
  const { data: profs } = await admin
    .from("profiles")
    .select("id, username, full_name, unsubscribe_token, last_lifecycle_email_at")
    .eq("email_opt_in", true);

  // 3) progress -> per-user completed dates
  const byUser = new Map<string, string[]>();
  for (let from = 0; ; from += 1000) {
    const { data: lp } = await admin
      .from("lesson_progress")
      .select("user_id, completed_at")
      .order("id", { ascending: true })
      .range(from, from + 999);
    const chunk = (lp ?? []) as { user_id: string; completed_at: string }[];
    for (const r of chunk) {
      if (!r.completed_at) continue;
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.completed_at);
      byUser.set(r.user_id, arr);
    }
    if (chunk.length < 1000) break;
  }

  const eligible: {
    id: string;
    email: string;
    name: string | null;
    token: string;
    completed: number;
    streak: number;
  }[] = [];

  for (const p of (profs ?? []) as {
    id: string;
    username: string | null;
    full_name: string | null;
    unsubscribe_token: string;
    last_lifecycle_email_at: string | null;
  }[]) {
    const email = emailById.get(p.id);
    if (!email) continue; // not confirmed
    const dates = byUser.get(p.id) ?? [];
    if (dates.length === 0) continue; // not engaged
    const lastActive = Math.max(...dates.map((d) => new Date(d).getTime()));
    if (now - lastActive < DORMANT_DAYS * 86_400_000) continue; // still active
    if (
      p.last_lifecycle_email_at &&
      now - new Date(p.last_lifecycle_email_at).getTime() <
        THROTTLE_DAYS * 86_400_000
    )
      continue; // emailed recently
    eligible.push({
      id: p.id,
      email,
      name: p.full_name || p.username || null,
      token: p.unsubscribe_token,
      completed: dates.length, // one lesson_progress row per lesson (no dupes)
      streak: streakFromDates(dates),
    });
  }

  const batch = eligible.slice(0, MAX_PER_RUN);
  if (dry) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      totalEligible: eligible.length,
      wouldSend: batch.length,
      sample: batch.slice(0, 5).map((b) => ({ email: b.email.replace(/(.).+(@.*)/, "$1***$2"), completed: b.completed, streak: b.streak })),
    });
  }

  let sent = 0;
  for (const u of batch) {
    const unsubscribeUrl = `${site}/unsubscribe?token=${u.token}`;
    const res = await sendEmail({
      to: u.email,
      subject:
        u.streak > 1
          ? `Keep your ${u.streak}-day FRC streak alive 🔥`
          : "Your next FRC lesson is waiting",
      html: lifecycleEmailHtml({
        name: u.name,
        completed: u.completed,
        streak: u.streak,
        unsubscribeUrl,
      }),
    });
    if (res.ok) {
      sent++;
      await admin
        .from("profiles")
        .update({ last_lifecycle_email_at: new Date().toISOString() })
        .eq("id", u.id);
    }
  }

  return NextResponse.json({ ok: true, totalEligible: eligible.length, sent });
}

export const GET = run;
export const POST = run;
