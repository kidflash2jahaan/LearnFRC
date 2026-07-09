import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Deterministic leaderboard-integrity scan the scheduled routine calls.
 * POST ?secret=CRON_SECRET -> finds accounts that *scripted* their completions
 * (many lessons finished within seconds of each other — impossible for a real
 * learner), deletes them, bans the email, and — if a second banned account
 * shares the same signup IP — bans that IP. Returns what it did (no email; the
 * routine folds this into one digest). No AI needed.
 */

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return (url.searchParams.get("secret") || req.headers.get("x-cron-secret")) === secret;
}

// Conservative by design — bias to NEVER remove a real user. A human can't
// finish 8+ lessons each within 4 seconds of the last; a script does exactly that.
const BURST_GAP_SECONDS = 4;
const MIN_BURST_GAPS = 8;
const MIN_COMPLETIONS = 15;

export async function POST(req: Request) {
  if (!authed(req)) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();

  // Pull every completion timestamp (paged).
  const prog: { user_id: string; completed_at: string }[] = [];
  let from = 0;
  for (;;) {
    const { data } = await admin
      .from("lesson_progress")
      .select("user_id, completed_at")
      .not("completed_at", "is", null)
      .range(from, from + 999);
    if (!data || !data.length) break;
    prog.push(...(data as typeof prog));
    if (data.length < 1000) break;
    from += 1000;
  }

  const byUser = new Map<string, number[]>();
  for (const r of prog) {
    const t = Date.parse(r.completed_at);
    if (Number.isNaN(t)) continue;
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(t);
    byUser.set(r.user_id, arr);
  }

  const suspects: { userId: string; completions: number; burstGaps: number }[] = [];
  for (const [uid, times] of byUser) {
    if (times.length < MIN_COMPLETIONS) continue;
    times.sort((a, b) => a - b);
    let burst = 0;
    for (let i = 1; i < times.length; i++) {
      if ((times[i] - times[i - 1]) / 1000 < BURST_GAP_SECONDS) burst++;
    }
    if (burst >= MIN_BURST_GAPS) {
      suspects.push({ userId: uid, completions: times.length, burstGaps: burst });
    }
  }

  const deleted: {
    username: string | null;
    email: string | null;
    completions: number;
    burstGaps: number;
  }[] = [];
  const bannedIps: string[] = [];

  for (const s of suspects) {
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("username, signup_ip")
        .eq("id", s.userId)
        .maybeSingle();
      const { data: userRes } = await admin.auth.admin.getUserById(s.userId);
      const email = userRes?.user?.email ?? null;
      const ip = (prof?.signup_ip as string | null) ?? null;
      const reason = `scripted completions — ${s.burstGaps} lessons finished within ${BURST_GAP_SECONDS}s of each other (${s.completions} total)`;

      if (email) {
        await admin
          .from("banned_emails")
          .upsert({ email, reason, banned_ip: ip }, { onConflict: "email", ignoreDuplicates: true });
        // Second banned account from the same IP → ban the whole IP.
        if (ip) {
          const { count } = await admin
            .from("banned_emails")
            .select("email", { count: "exact", head: true })
            .eq("banned_ip", ip);
          if ((count ?? 0) >= 2) {
            await admin
              .from("banned_ips")
              .upsert(
                { ip, reason: "multiple banned accounts from this IP/device" },
                { onConflict: "ip", ignoreDuplicates: true }
              );
            if (!bannedIps.includes(ip)) bannedIps.push(ip);
          }
        }
      }

      await admin.from("lesson_progress").delete().eq("user_id", s.userId);
      await admin.auth.admin.deleteUser(s.userId); // cascades the profile
      deleted.push({
        username: (prof?.username as string) ?? null,
        email,
        completions: s.completions,
        burstGaps: s.burstGaps,
      });
    } catch {
      /* skip one bad suspect, keep going */
    }
  }

  return NextResponse.json({ deleted, bannedIps });
}
