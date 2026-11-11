#!/usr/bin/env node
// Throwaway test data for the live-classes packages, in PRODUCTION Supabase
// (the only database). classes-design.md sections 1 and 15.1 step 7.
//
//   node scripts/classes/test-data.mjs create  <package> <role[:mod...]> ...
//   node scripts/classes/test-data.mjs cleanup <package>
//   node scripts/classes/test-data.mjs check   [package]
//
// create: one throwaway account per role, by the auth admin API with
//   email_confirm true (Supabase sends no email), username
//   lftest_<package letters>_<role>, email lftest+<package>-<role>-<rand>@example.com
//   and a random password. Credentials go ONLY to the git-ignored
//   .claude-scratch/classes-dev/test-accounts/<package>.json in this worktree,
//   so a test can sign in; nothing is printed but usernames and ids.
//   Modifiers (joined with ":"):
//     age=N           a class_age_checks row that makes them N today
//     parent=STATUS   a class_parent_consents row: agreed, sent, declined,
//                     revoked or expired
//     teacher         a class_teachers row (letter name "Lftest <Role>")
//     superadmin      a site_admins row (role superadmin); admin likewise
//     safetylead      class_settings.safety_lead_user_id = this account.
//                     Shared row: set it back in a finally step. Deleting
//                     the account also clears it (on delete set null).
//     bio=TEXT        profiles.bio (URL-encoded: bio=add%20me%20on%20snap)
//     nousername      no username in the sign-up metadata: since the
//                     2026-11-11 migration the database gives the account a
//                     generated handle (gearbox_4821) with
//                     profiles.username_generated set (needs_handle)
//     generated       keep the lftest username but flag it as generated, as
//                     if the person hadn't chosen or kept it yet
//                     (needs_handle; needs that migration)
//   e.g. create room-and-chat t1:age=16:parent=agreed:teacher s1:age=14:parent=agreed
//
// cleanup: deletes the package's test classes (titles starting
//   "lftest <package>" or taught by its accounts) and every row tied to them
//   or to its accounts in the classes tables (but a class_events row one of
//   its accounts caused in another package's class stays with that class),
//   its reports and their moderation_log rows, banned_emails rows for its
//   emails, rate-limit rows, then the accounts, the credentials file and the
//   package's outbox.
//
// check: read-only. With a package, nothing of that package is left. Without
//   one, every classes table is empty, class_settings is at its defaults, and
//   no lftest account or test row exists anywhere. Exits 1 if anything's left.
//
// Rules (section 1): tests never use the sign-up form, password reset or magic
// links; test accounts never complete lessons; nothing is left in place
// across the daily crons (06:00 and 16:00 UTC).

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { devDir, loadEnv, requireEnv } from "./env.mjs";
import { birthMonthYearForAge } from "../../src/lib/classes/age.ts";
import { CLASS_NOTICE_VERSION, TEACHER_CODE_VERSION } from "../../src/lib/classes/notice.ts";

loadEnv();

/** Every classes table, children before parents. */
export const CLASS_TABLES = [
  "class_chat_messages",
  "class_media_events",
  "class_attendance",
  "class_transcripts",
  "class_sessions",
  "class_reviews",
  "class_events",
  "class_participants",
  "class_enrollments",
  "class_consents",
  "class_safety_holds",
  "hours_letters",
  "class_webhook_events",
  "class_rtk_cleanup",
  "classes",
  "class_parent_consents",
  "class_age_checks",
  "class_teachers",
  "teacher_applications",
];

const SETTINGS_DEFAULTS = {
  classes_visible: false,
  joins_paused: true,
  paused_reason: "not launched yet",
  safety_lead_user_id: null,
  monthly_minute_cap: 40000,
  max_live_classes: 3,
  min_student_account_days: 7,
  rtk_organization_id: null,
  last_daily_sweep_at: null,
};

function admin() {
  requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function packageLetters(pkg) {
  return pkg.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function usernameFor(pkg, role) {
  return `lftest_${packageLetters(pkg)}_${role}`;
}

function credentialsPath(pkg) {
  return join(devDir(), "test-accounts", `${pkg}.json`);
}

export function readCredentials(pkg) {
  const p = credentialsPath(pkg);
  if (!existsSync(p)) return { package: pkg, accounts: {} };
  return JSON.parse(readFileSync(p, "utf8"));
}

function writeCredentials(pkg, data) {
  mkdirSync(join(devDir(), "test-accounts"), { recursive: true });
  writeFileSync(credentialsPath(pkg), JSON.stringify(data, null, 2), { mode: 0o600 });
}

function checkPackage(pkg) {
  if (!pkg || !/^[a-z0-9-]+$/.test(pkg)) throw new Error("package must be a-z, 0-9 and -");
}

function warnNearCrons() {
  const now = new Date();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const cron of [6 * 60, 16 * 60]) {
    const until = (cron - minutes + 1440) % 1440;
    if (until < 45)
      console.warn(`warning: a daily cron runs in ${until} minutes; clean up before ${cron / 60}:00 UTC`);
  }
}

/* ── create ────────────────────────────────────────────────────────── */

function parseRole(spec) {
  const [name, ...mods] = spec.split(":");
  if (!/^[a-z0-9]{1,12}$/.test(name)) throw new Error(`role name must be a-z and 0-9, up to 12: ${name}`);
  const out = {
    name,
    age: null,
    parent: null,
    teacher: false,
    site: null,
    safetylead: false,
    bio: null,
    nousername: false,
    generated: false,
  };
  for (const m of mods) {
    const [k, ...rest] = m.split("=");
    const v = rest.join("=");
    if (k === "age") out.age = Number(v);
    else if (k === "parent") out.parent = v;
    else if (k === "teacher") out.teacher = true;
    else if (k === "superadmin" || k === "admin") out.site = k;
    else if (k === "safetylead") out.safetylead = true;
    else if (k === "bio") out.bio = decodeURIComponent(v);
    else if (k === "nousername") out.nousername = true;
    else if (k === "generated") out.generated = true;
    else throw new Error(`unknown modifier ${k}`);
  }
  if (out.age !== null && !(Number.isInteger(out.age) && out.age >= 1 && out.age <= 99)) throw new Error("bad age");
  if (out.parent && !["agreed", "sent", "declined", "revoked", "expired"].includes(out.parent))
    throw new Error("bad parent status");
  if (out.generated && out.nousername) throw new Error("generated and nousername don't mix");
  return out;
}

async function create(pkg, specs) {
  checkPackage(pkg);
  if (specs.length === 0) throw new Error("name at least one role");
  warnNearCrons();
  const db = admin();
  const creds = readCredentials(pkg);
  creds.package = pkg;
  creds.accounts ??= {};
  for (const spec of specs) {
    const r = parseRole(spec);
    if (creds.accounts[r.name]) throw new Error(`role ${r.name} already exists for ${pkg}; run cleanup first`);
    const username = usernameFor(pkg, r.name);
    const email = `lftest+${pkg}-${r.name}-${randomBytes(3).toString("hex")}@example.com`;
    const password = randomBytes(18).toString("base64url");
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: r.nousername ? {} : { username },
    });
    if (error || !data.user) throw new Error(`createUser ${r.name}: ${error?.message}`);
    const id = data.user.id;
    // Record at once, so a later failure still leaves something cleanup finds.
    creds.accounts[r.name] = { id, email, password, username: r.nousername ? null : username, spec };
    writeCredentials(pkg, creds);

    if (!r.nousername) {
      const { error: e } = await db.from("profiles").update({ username, bio: r.bio }).eq("id", id);
      if (e) throw new Error(`profile ${r.name}: ${e.message}`);
      if (r.generated) {
        // Its own write: the database's username guard clears the flag on a
        // rename, and this one doesn't touch username.
        const { error: g } = await db.from("profiles").update({ username_generated: true }).eq("id", id);
        if (g) throw new Error(`generated ${r.name}: ${g.message}`);
      }
    } else if (r.bio) {
      await db.from("profiles").update({ bio: r.bio }).eq("id", id);
    }
    if (r.age !== null) {
      const { birthYear, birthMonth } = birthMonthYearForAge(r.age);
      const { error: e } = await db
        .from("class_age_checks")
        .insert({ user_id: id, birth_year: birthYear, birth_month: birthMonth });
      if (e) throw new Error(`age ${r.name}: ${e.message}`);
      if (r.parent) {
        const now = Date.now();
        const expired = r.parent === "expired";
        const { error: e2 } = await db.from("class_parent_consents").insert({
          student_id: id,
          student_handle: r.nousername ? `lftest_${packageLetters(pkg)}_${r.name}` : username,
          student_birth_year: birthYear,
          parent_email: `lftest+${pkg}-${r.name}-parent@example.com`,
          parent_name: r.parent === "agreed" ? "Lftest Parent" : null,
          token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
          notice_version: CLASS_NOTICE_VERSION,
          status: r.parent === "expired" ? "sent" : r.parent,
          sent_at: new Date(now - (expired ? 20 : 1) * 86_400_000).toISOString(),
          expires_at: new Date(now + (expired ? -6 : 13) * 86_400_000).toISOString(),
          decided_at: ["agreed", "declined"].includes(r.parent) ? new Date(now).toISOString() : null,
          revoked_at: r.parent === "revoked" ? new Date(now).toISOString() : null,
        });
        if (e2) throw new Error(`parent ${r.name}: ${e2.message}`);
      }
    } else if (r.parent) {
      throw new Error("parent= needs age= too");
    }
    if (r.teacher) {
      const { error: e } = await db.from("class_teachers").insert({
        user_id: id,
        letter_name: `Lftest ${r.name.charAt(0).toUpperCase()}${r.name.slice(1)}`,
        code_version: TEACHER_CODE_VERSION,
        code_agreed_at: new Date().toISOString(),
        note: "lftest",
      });
      if (e) throw new Error(`teacher ${r.name}: ${e.message}`);
    }
    if (r.site) {
      const { error: e } = await db
        .from("site_admins")
        .insert({ user_id: id, role: r.site, note: "lftest account" });
      if (e) throw new Error(`site_admins ${r.name}: ${e.message}`);
    }
    if (r.safetylead) {
      const { error: e } = await db.from("class_settings").update({ safety_lead_user_id: id }).eq("id", true);
      if (e) throw new Error(`safety lead ${r.name}: ${e.message}`);
    }
    console.log(`created ${r.name}: ${creds.accounts[r.name].username ?? "(no username)"} ${id}`);
  }
  console.log(`credentials: ${credentialsPath(pkg)}`);
}

/* ── finding a package's rows ──────────────────────────────────────── */

async function allTestUsers(db) {
  const out = [];
  for (let page = 1; page < 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) if ((u.email ?? "").startsWith("lftest")) out.push({ id: u.id, email: u.email });
    if (data.users.length < 1000) break;
  }
  return out;
}

async function packageAccounts(db, pkg) {
  const prefix = pkg ? `lftest_${packageLetters(pkg)}_` : "lftest";
  const emailPrefix = pkg ? `lftest+${pkg}-` : "lftest";
  const ids = new Map();
  const { data: profs } = await db.from("profiles").select("id, username").ilike("username", "lftest%");
  for (const p of profs ?? []) if (p.username.startsWith(prefix)) ids.set(p.id, null);
  for (const u of await allTestUsers(db)) if (u.email.startsWith(emailPrefix)) ids.set(u.id, u.email);
  if (pkg) for (const a of Object.values(readCredentials(pkg).accounts ?? {})) ids.set(a.id, a.email);
  // Fill in emails for profile-only matches.
  for (const [id, email] of ids) {
    if (email) continue;
    const { data } = await db.auth.admin.getUserById(id);
    ids.set(id, data?.user?.email ?? null);
  }
  return { ids: [...ids.keys()], emails: [...ids.values()].filter(Boolean), prefix, emailPrefix };
}

async function packageClasses(db, pkg, accountIds) {
  const titlePrefixes = pkg ? [`lftest ${pkg}`, `lftest ${packageLetters(pkg)}`] : ["lftest"];
  const found = new Map();
  const { data: byTitle } = await db.from("classes").select("id, title, teacher_id, rtk_meeting_id").ilike("title", "lftest%");
  for (const c of byTitle ?? []) {
    const t = c.title.toLowerCase();
    if (titlePrefixes.some((p) => t.startsWith(p))) found.set(c.id, c);
  }
  if (accountIds.length) {
    const { data: byTeacher } = await db
      .from("classes")
      .select("id, title, teacher_id, rtk_meeting_id")
      .in("teacher_id", accountIds);
    for (const c of byTeacher ?? []) found.set(c.id, c);
  }
  return [...found.values()];
}

const inList = (ids) => `(${ids.map((x) => `"${x}"`).join(",")})`;

/* ── cleanup ───────────────────────────────────────────────────────── */

async function del(db, table, build, what, quiet = false) {
  const { error, count } = await build(db.from(table).delete({ count: "exact" }));
  if (error) throw new Error(`${table} (${what}): ${error.message}`);
  if (count && !quiet) console.log(`  ${table}: ${count} (${what})`);
  return count ?? 0;
}

async function cleanup(pkg) {
  checkPackage(pkg);
  const db = admin();
  const acc = await packageAccounts(db, pkg);
  const classes = await packageClasses(db, pkg, acc.ids);
  const classIds = classes.map((c) => c.id);
  const meetings = classes.map((c) => c.rtk_meeting_id).filter(Boolean);
  console.log(`cleanup ${pkg}: ${acc.ids.length} accounts, ${classIds.length} classes`);

  const handleLike = `${acc.prefix}%`;
  const emailLike = `${acc.emailPrefix}%`;

  // Holds and consents outlive accounts and classes (set null), so go first.
  if (classIds.length) await del(db, "class_safety_holds", (q) => q.in("class_id", classIds), "classes");
  if (acc.ids.length) await del(db, "class_safety_holds", (q) => q.in("subject_user_id", acc.ids), "subjects");
  await del(db, "class_safety_holds", (q) => q.ilike("subject_handle", handleLike), "handles");
  await del(db, "class_safety_holds", (q) => q.ilike("subject_email", emailLike), "emails");
  if (classIds.length) await del(db, "class_consents", (q) => q.in("class_id", classIds), "classes");
  if (acc.ids.length) await del(db, "class_consents", (q) => q.in("user_id", acc.ids), "accounts");
  await del(db, "class_consents", (q) => q.ilike("user_handle", handleLike), "handles");
  if (acc.ids.length) await del(db, "class_parent_consents", (q) => q.in("student_id", acc.ids), "accounts");
  await del(db, "class_parent_consents", (q) => q.ilike("student_handle", handleLike), "handles");

  // Reports about or by the package, and the decisions logged for them.
  const reportIds = new Set();
  const addReports = async (build) => {
    const { data, error } = await build(db.from("user_reports").select("id"));
    if (error) throw new Error(`user_reports: ${error.message}`);
    for (const r of data ?? []) reportIds.add(r.id);
  };
  if (acc.ids.length) {
    await addReports((q) => q.or(`reporter_id.in.${inList(acc.ids)},reported_user_id.in.${inList(acc.ids)}`));
  }
  if (classIds.length) await addReports((q) => q.eq("content_kind", "class").in("content_id", classIds));
  await addReports((q) => q.ilike("reported_username", handleLike));
  if (reportIds.size) {
    await del(db, "moderation_log", (q) => q.eq("kind", "report").in("ref_id", [...reportIds]), "report decisions");
    await del(db, "user_reports", (q) => q.in("id", [...reportIds]), "reports");
  }

  if (meetings.length) {
    await del(db, "class_rtk_cleanup", (q) => q.in("meeting_id", meetings), "meetings");
    await del(db, "class_webhook_events", (q) => q.in("meeting_id", meetings), "meetings");
  }
  if (acc.ids.length) {
    // Rows the accounts left in other packages' classes, and actor-only events.
    await del(db, "class_chat_messages", (q) => q.in("sender_id", acc.ids), "sent");
    await del(db, "class_attendance", (q) => q.in("user_id", acc.ids), "attended");
    await del(db, "class_media_events", (q) => q.in("subject_user_id", acc.ids), "subjects");
    await del(db, "class_media_events", (q) => q.in("reported_by", acc.ids), "reporters");
    // Events with no class only (a pause, an unpause). An event in a class
    // goes with its class: this package's classes are deleted below, and an
    // event this package's account caused in another package's class (a
    // pause ending it, say) is that class's history, so it stays and loses
    // its actor when the account goes (on delete set null).
    await del(db, "class_events", (q) => q.in("actor_id", acc.ids).is("class_id", null), "actors, no class");
    await del(db, "hours_letters", (q) => q.in("teacher_id", acc.ids), "letters");
  }
  // Account holds (a ban or a self-delete with no class) log events with no
  // class and no actor, about an account that may be gone already: find them
  // by the subject's id, from the accounts that exist and the credentials file.
  const everId = [
    ...new Set([
      ...acc.ids,
      ...Object.values(readCredentials(pkg).accounts ?? {})
        .map((a) => a?.id)
        .filter(Boolean),
    ]),
  ];
  if (everId.length) {
    await del(
      db,
      "class_events",
      (q) => q.is("class_id", null).like("kind", "hold_%").in("detail->>subjectUserId", everId),
      "account hold events"
    );
  }
  if (classIds.length) await del(db, "classes", (q) => q.in("id", classIds), "classes and their rows");

  if (acc.emails.length) await del(db, "banned_emails", (q) => q.in("email", acc.emails), "accounts");
  await del(db, "banned_emails", (q) => q.ilike("email", emailLike), "emails");

  let limits = 0;
  for (const id of acc.ids) {
    limits += await del(db, "rate_limit_hits", (q) => q.like("bucket", `%:k:${id}`), "per-account limits", true);
    for (const t of ["lesson_progress", "bookmarks", "user_achievements"]) {
      await del(db, t, (q) => q.eq("user_id", id), "account");
    }
    await del(db, "profiles", (q) => q.eq("id", id), "account", true);
    const { error } = await db.auth.admin.deleteUser(id);
    if (error && !/not.?found/i.test(error.message)) throw new Error(`deleteUser ${id}: ${error.message}`);
  }
  if (limits) console.log(`  rate_limit_hits: ${limits} (per-account limits)`);
  if (acc.ids.length) console.log(`  profiles and auth users: ${acc.ids.length}`);

  rmSync(credentialsPath(pkg), { force: true });
  rmSync(join(devDir(), "outbox", pkg), { recursive: true, force: true });
  console.log("done");
}

/* ── check ─────────────────────────────────────────────────────────── */

async function count(db, table, build) {
  const { count: n, error } = await build(db.from(table).select("*", { count: "exact", head: true }));
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
}

async function check(pkg) {
  if (pkg) checkPackage(pkg);
  const db = admin();
  const problems = [];
  const acc = await packageAccounts(db, pkg);
  if (acc.ids.length) problems.push(`${acc.ids.length} lftest accounts`);

  if (pkg) {
    const classes = await packageClasses(db, pkg, acc.ids);
    if (classes.length) problems.push(`${classes.length} test classes`);
    const handleLike = `${acc.prefix}%`;
    for (const [t, col] of [
      ["class_consents", "user_handle"],
      ["class_parent_consents", "student_handle"],
      ["class_safety_holds", "subject_handle"],
      ["user_reports", "reported_username"],
    ]) {
      const n = await count(db, t, (q) => q.ilike(col, handleLike));
      if (n) problems.push(`${n} ${t} rows`);
    }
    if (existsSync(credentialsPath(pkg))) problems.push("a credentials file");
  } else {
    for (const t of CLASS_TABLES) {
      const n = await count(db, t, (q) => q);
      if (n) problems.push(`${n} rows in ${t}`);
    }
    const { data: s } = await db.from("class_settings").select("*").eq("id", true).maybeSingle();
    if (!s) problems.push("no class_settings row");
    else {
      for (const [k, v] of Object.entries(SETTINGS_DEFAULTS)) {
        if (s[k] !== v) problems.push(`class_settings.${k} is not at its default`);
      }
    }
    const reports = await count(db, "user_reports", (q) => q.ilike("reported_username", "lftest%"));
    if (reports) problems.push(`${reports} lftest user_reports`);
    const classReports = await count(db, "user_reports", (q) => q.eq("content_kind", "class"));
    if (classReports) problems.push(`${classReports} class reports`);
    const banned = await count(db, "banned_emails", (q) => q.ilike("email", "lftest%"));
    if (banned) problems.push(`${banned} lftest banned_emails`);
  }

  if (problems.length) {
    console.log(`check ${pkg ?? "(all)"}: left behind: ${problems.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log(`check ${pkg ?? "(all)"}: clean`);
  }
}

/* ── main ──────────────────────────────────────────────────────────── */

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("test-data.mjs");
if (isMain) {
  const [cmd, pkg, ...rest] = process.argv.slice(2);
  const run =
    cmd === "create" ? () => create(pkg, rest) : cmd === "cleanup" ? () => cleanup(pkg) : cmd === "check" ? () => check(pkg) : null;
  if (!run) {
    console.error("usage: test-data.mjs create <package> <role[:mod...]>... | cleanup <package> | check [package]");
    process.exit(2);
  }
  run().catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  });
}

export { create, cleanup, check };
