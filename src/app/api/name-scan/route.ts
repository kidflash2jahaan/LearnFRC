import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Endpoint the scheduled name-moderation agent calls.
 *   GET  ?secret=CRON_SECRET  -> every profile's { id, username, full_name }
 *   POST ?secret=CRON_SECRET  -> { changes: [{ id, username_offensive?, full_name_offensive?, reason }] }
 *
 * The agent only *identifies* clearly-offensive fields (biased to leave names
 * alone when unsure). The site generates a safe, unique replacement, records
 * the old value for reversal, and emails ONE digest only if anything changed.
 */

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return (url.searchParams.get("secret") || req.headers.get("x-cron-secret")) === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();
  const rows: { id: string; username: string | null; full_name: string | null }[] = [];
  let from = 0;
  for (;;) {
    const { data } = await admin
      .from("profiles")
      .select("id, username, full_name")
      .range(from, from + 999);
    if (!data || !data.length) break;
    rows.push(...(data as typeof rows));
    if (data.length < 1000) break;
    from += 1000;
  }
  return NextResponse.json({ profiles: rows });
}

type Change = {
  id: string;
  username_offensive?: boolean;
  full_name_offensive?: boolean;
  reason?: string;
};

async function uniqueUsername(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = "member" + Math.floor(100000 + Math.random() * 899999).toString();
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return "member" + Date.now().toString().slice(-8);
}

export async function POST(req: Request) {
  if (!authed(req)) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();

  let body: { changes?: Change[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const changes = (body.changes ?? []).filter(
    (c) => c && c.id && (c.username_offensive || c.full_name_offensive)
  );
  if (!changes.length) return NextResponse.json({ changed: 0 });

  const done: {
    oldUsername: string | null;
    newUsername: string | null;
    oldFullName: string | null;
    reason: string;
  }[] = [];

  for (const c of changes) {
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("id, username, full_name")
        .eq("id", c.id)
        .maybeSingle();
      if (!prof) continue;

      const update: { username?: string; full_name?: string | null } = {};
      let newUsername: string | null = null;
      if (c.username_offensive) {
        newUsername = await uniqueUsername(admin);
        update.username = newUsername;
      }
      if (c.full_name_offensive) {
        update.full_name = null; // display falls back to (now-safe) username
      }
      if (!Object.keys(update).length) continue;

      await admin.from("profiles").update(update).eq("id", c.id);
      await admin.from("name_moderation_log").insert({
        user_id: c.id,
        old_username: prof.username,
        new_username: newUsername,
        old_full_name: prof.full_name,
        new_full_name: c.full_name_offensive ? null : prof.full_name,
        reason: c.reason ?? null,
      });
      done.push({
        oldUsername: prof.username as string | null,
        newUsername,
        oldFullName: prof.full_name as string | null,
        reason: c.reason ?? "",
      });
    } catch {
      /* skip a bad change, keep going */
    }
  }

  // No email here — the scheduled routine folds `done` into one combined digest.
  return NextResponse.json({ changed: done.length, done });
}
