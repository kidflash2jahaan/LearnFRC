import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * The endpoint the scheduled name-moderation agent calls.
 *
 *   GET  ?secret=CRON_SECRET   every profile's { id, username, full_name }
 *   POST ?secret=CRON_SECRET   { changes: [{ id, username_offensive?,
 *                                            full_name_offensive?, reason }] }
 *
 * The agent only IDENTIFIES clearly offensive fields, and is biased toward
 * leaving a name alone when it is unsure. The site is what generates a safe,
 * unique replacement, records the old value so a change can be reversed, and
 * leaves the digest to the routine that called it.
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

/**
 * A free generated handle like `gearbox_4821`, from the database's
 * `generate_username` (the same one that names accounts that arrive without a
 * username; see src/lib/usernames.ts). It checks the table itself. Throws when
 * there isn't one, so that change is skipped rather than half made.
 */
async function generatedUsername(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data, error } = await admin.rpc("generate_username");
  if (error || typeof data !== "string" || !data)
    throw new Error(`generate_username: ${error?.message ?? "no handle"}`);
  return data;
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
        newUsername = await generatedUsername(admin);
        update.username = newUsername;
      }
      if (c.full_name_offensive) {
        update.full_name = null; // display falls back to the now-safe username
      }
      if (!Object.keys(update).length) continue;

      const { error: writeError } = await admin.from("profiles").update(update).eq("id", c.id);
      if (writeError) throw new Error(writeError.message);
      if (newUsername) {
        // Flagged, so the username step asks them to pick a name of their own
        // (or keep this one) the next time they're signed in. A write of its
        // own, after the rename: the database's username guard clears the flag
        // on a rename that leaves it as it was, and it can't tell "set it to
        // true" from "didn't mention it" on a row that's already flagged. This
        // write doesn't touch username, so the guard doesn't run.
        const { error: flagError } = await admin
          .from("profiles")
          .update({ username_generated: true })
          .eq("id", c.id);
        if (flagError) console.error("name-scan: flagging the new username failed:", flagError.message);
      }
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
      // One bad change does not stop the batch.
    }
  }

  // No email from here. The scheduled routine folds `done` into one digest.
  return NextResponse.json({ changed: done.length, done });
}
