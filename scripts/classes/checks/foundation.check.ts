// The Foundation's checks against production with throwaway accounts
// (classes-design.md 15.1 acceptance, and 6.10 check 6):
//   - 6 accounts racing class_enroll for 5 seats get exactly 5 "ok";
//   - classEligibility returns each state from real rows, and a generated
//     username (the 2026-11-11 migration's) is needs_handle until it's kept;
//   - enrollInClass's refusals, listings and the class page, with blocks;
//   - the chat read policy through Supabase Realtime and plain selects;
//   - deleteAccountData keeps consent proof and queues RealtimeKit cleanup.
// Everything it makes is deleted at the end (test-data.mjs cleanup).
// Needs supabase/migrations/20261111120000_usernames_always_set.sql applied
// first (profiles.username_generated).
//
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/foundation.check.ts

import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
process.env.CLASSES_DEV_SWITCHES = "1";
delete process.env.VERCEL_ENV;

const PKG = "foundation";
const results: { name: string; ok: boolean; error?: string }[] = [];
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok   ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: (e as Error).message });
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Account = { id: string; email: string; password: string; username: string | null };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Signed-in clients, closed at the end so their sockets don't hold the process open. */
const openClients: SupabaseClient[] = [];

async function newClass(title: string, teacherId: string, capacity: number, startsInMin = 180) {
  const starts = new Date(Date.now() + startsInMin * 60_000);
  const { data, error } = await admin
    .from("classes")
    .insert({
      teacher_id: teacherId,
      title,
      starts_at: starts.toISOString(),
      duration_minutes: 30,
      hard_end_at: new Date(starts.getTime() + 45 * 60_000).toISOString(),
      capacity,
      rtk_app: "dev",
    })
    .select("id")
    .single();
  if (error) throw new Error(`class ${title}: ${error.message}`);
  return data.id as string;
}

async function signIn(a: Account): Promise<SupabaseClient> {
  const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  if (error) throw new Error(`sign in ${a.username}: ${error.message}`);
  openClients.push(c);
  return c;
}

async function main() {
  await cleanup(PKG); // a clean start if an earlier run stopped halfway
  await create(PKG, [
    "t1:age=16:parent=agreed:teacher",
    ...[1, 2, 3, 4, 5, 6].map((n) => `s${n}:age=14:parent=agreed`),
    "nohandle:nousername",
    "gen:age=15:parent=agreed:generated",
    "noage",
    "adult:age=19",
    "needp:age=15",
    "waitp:age=15:parent=sent",
    "declp:age=15:parent=declined",
    "revp:age=15:parent=revoked",
    "expp:age=15:parent=expired",
    "bio:age=15:parent=agreed:bio=add%20me%20on%20snap%20jake22",
    "out:age=15:parent=agreed",
    "rev:age=15:parent=agreed",
    "del:age=15:parent=agreed",
  ]);
  const acc = readCredentials(PKG).accounts as Record<string, Account>;
  const user = (k: string) => ({ id: acc[k].id, email: acc[k].email, created_at: new Date().toISOString() });

  const classes = await import("../../../src/lib/app/classes.ts");
  const profile = await import("../../../src/lib/app/profile.ts");

  const raceId = await newClass("lftest foundation race", acc.t1.id, 5);
  const openId = await newClass("lftest foundation open", acc.t1.id, 15);
  const chatId = await newClass("lftest foundation chat", acc.t1.id, 15, 5);

  await step("6 accounts racing class_enroll for 5 seats get exactly 5 ok", async () => {
    const outcomes = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) =>
        admin.rpc("class_enroll", { p_class_id: raceId, p_user_id: acc[`s${n}`].id }).then((r) => {
          if (r.error) throw new Error(r.error.message);
          return r.data as string;
        })
      )
    );
    assert.equal(outcomes.filter((o) => o === "ok").length, 5, outcomes.join(","));
    assert.equal(outcomes.filter((o) => o === "full").length, 1, outcomes.join(","));
    const { count } = await admin
      .from("class_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("class_id", raceId)
      .eq("status", "enrolled");
    assert.equal(count, 5);
    const again = await admin.rpc("class_enroll", { p_class_id: raceId, p_user_id: acc.s1.id });
    assert.equal(again.data, "already");
  });

  await step("classEligibility returns each state from real rows", async () => {
    const e = classes.classEligibility;
    assert.equal(await e(null), "signed_out");
    assert.equal(await e(user("nohandle")), "needs_handle");
    assert.equal(await e(user("gen")), "needs_handle", "a generated username is no handle for classes");
    assert.equal(await e(user("noage"), { deviceBlocked: false }), "needs_age");
    assert.equal(await e(user("noage"), { deviceBlocked: true }), "device_blocked");
    assert.equal(await e(user("adult")), "adult");
    assert.equal(await e(user("needp")), "needs_parent");
    assert.equal(await e(user("waitp")), "waiting_parent");
    assert.equal(await e(user("declp")), "parent_declined");
    assert.equal(await e(user("revp")), "parent_declined");
    assert.equal(await e(user("expp")), "needs_parent");
    assert.equal(await e(user("s1")), "ready");
    const detail = await classes.classEligibilityDetail(user("t1"));
    assert.equal(detail.ageBand, "16-17");
    assert.equal(detail.age, 16);
  });

  await step("a generated username: made for an account without one, refused until it's kept", async () => {
    // The database named the account that signed up with no username, and flagged it.
    const { data: made } = await admin
      .from("profiles")
      .select("username, username_generated")
      .eq("id", acc.nohandle.id)
      .single();
    assert.match(made!.username as string, /^[a-z]+_[0-9]{4}$/);
    assert.equal(made!.username_generated, true);
    const before = await classes.classEligibilityDetail(user("nohandle"));
    assert.equal(before.state, "needs_handle");
    assert.equal(before.username, null, "the generated handle is never handed on");

    // Enrolling says why, in the classes' words.
    const refused = await classes.enrollInClass(user("gen"), { classId: openId });
    assert.ok(!refused.ok && refused.error === classes.CLASS_SENTENCES.needsHandle, JSON.stringify(refused));

    // Keep on the username step writes only the flag; then classes open.
    const { error } = await admin.from("profiles").update({ username_generated: false }).eq("id", acc.gen.id);
    if (error) throw new Error(error.message);
    const after = await classes.classEligibilityDetail(user("gen"));
    assert.equal(after.state, "ready");
    assert.equal(after.username, acc.gen.username);
  });

  await step("hidden without the switches, and visible with them", async () => {
    process.env.CLASSES_DEV_SWITCHES = "";
    try {
      assert.equal(await classes.classEligibility(user("s1")), "hidden");
      const list = await classes.listUpcomingClasses();
      assert.deepEqual(list, { visible: false, classes: [], liveNow: 0 });
      assert.equal(await classes.getClassDetail(raceId, user("s2")), null);
      const r = await classes.enrollInClass(user("s1"), { classId: openId });
      assert.equal(r.ok, false);
    } finally {
      process.env.CLASSES_DEV_SWITCHES = "1";
    }
    assert.equal((await classes.listUpcomingClasses()).visible, true);
  });

  await step("enrollInClass refuses what it should", async () => {
    const bio = await classes.enrollInClass(user("bio"), { classId: openId });
    assert.equal(bio.ok, false);
    if (!bio.ok) assert.equal(bio.error, classes.CLASS_SENTENCES.bio);
    const own = await classes.enrollInClass(user("t1"), { classId: openId });
    assert.equal(own.ok, false);
    if (!own.ok) assert.equal(own.error, classes.CLASS_SENTENCES.ownClass);
    const adult = await classes.enrollInClass(user("adult"), { classId: openId });
    assert.equal(adult.ok, false);
    if (!adult.ok) assert.equal(adult.code, "forbidden");
    const needAge = await classes.enrollInClass(user("noage"), { classId: openId });
    assert.equal(needAge.ok, false);
    const full = await classes.enrollInClass(user("s6"), { classId: raceId });
    const s6Enrolled = await admin
      .from("class_enrollments")
      .select("status")
      .eq("class_id", raceId)
      .eq("user_id", acc.s6.id)
      .maybeSingle();
    if (s6Enrolled.data?.status === "enrolled") assert.equal(full.ok, true);
    else {
      assert.equal(full.ok, false);
      if (!full.ok) assert.equal(full.error, classes.CLASS_SENTENCES.full);
    }
    const bad = await classes.enrollInClass(user("s1"), { classId: "not-a-uuid" });
    assert.equal(bad.ok, false);
  });

  await step("waiting_parent can enroll; leave and re-enroll work", async () => {
    const r = await classes.enrollInClass(user("waitp"), { classId: openId });
    assert.deepEqual(r, { ok: true, status: "enrolled" });
    const again = await classes.enrollInClass(user("waitp"), { classId: openId });
    assert.deepEqual(again, { ok: true, status: "already" });
    assert.deepEqual(await classes.leaveClass(user("waitp"), { classId: openId }), { ok: true });
    const back = await classes.enrollInClass(user("waitp"), { classId: openId });
    assert.deepEqual(back, { ok: true, status: "enrolled" });
  });

  await step("blocks either way hide the class and refuse enrolling", async () => {
    await admin.from("user_blocks").insert([
      { blocker_id: acc.s3.id, blocked_id: acc.t1.id },
      { blocker_id: acc.t1.id, blocked_id: acc.out.id },
    ]);
    try {
      for (const k of ["s3", "out"]) {
        const r = await classes.enrollInClass(user(k), { classId: openId });
        assert.equal(r.ok, false, k);
        if (!r.ok) assert.equal(r.error, classes.CLASS_SENTENCES.blocked);
        const list = await classes.listUpcomingClasses({ viewer: user(k) });
        assert.ok(!list.classes.some((c) => c.id === openId), `${k} still sees the class`);
        const d = await classes.getClassDetail(openId, user(k));
        assert.equal(d?.blockedEitherWay, true);
      }
    } finally {
      await admin.from("user_blocks").delete().in("blocker_id", [acc.s3.id, acc.t1.id]);
    }
  });

  await step("listings: no handle signed out; handle, seats and enrollment signed in", async () => {
    const out = await classes.listUpcomingClasses();
    const race = out.classes.find((c) => c.id === raceId);
    assert.ok(race, "race class listed");
    assert.equal(race!.teacher, null);
    assert.equal(race!.teacherLabel, "Taught by an FRC student");
    assert.equal(race!.enrolled, null);
    assert.ok(!JSON.stringify(out).includes("lftest_foundation_t1"), "no handle signed out");
    // Which five won the race isn't fixed, so read one of them back.
    const { data: seat } = await admin
      .from("class_enrollments")
      .select("user_id")
      .eq("class_id", raceId)
      .eq("status", "enrolled")
      .limit(1)
      .single();
    const enrolledKey = Object.keys(acc).find((k) => acc[k].id === seat!.user_id)!;
    const signedIn = await classes.listUpcomingClasses({ viewer: user(enrolledKey) });
    const r2 = signedIn.classes.find((c) => c.id === raceId)!;
    assert.equal(r2.teacher?.username, "lftest_foundation_t1");
    assert.equal(r2.enrolled, true);
    assert.deepEqual(r2.seats, { capacity: 5, taken: 5, left: 0 });
    const d = await classes.getClassDetail(raceId, user(enrolledKey));
    assert.equal(d?.viewerRole, "student");
    assert.equal(d?.enrollment, "enrolled");
    assert.equal(d?.classStatus, "scheduled");
    assert.equal((await classes.getClassDetail(raceId, user("t1")))?.viewerRole, "teacher");
  });

  // ── The chat read policy (6.10 check 6) ─────────────────────────────
  // is_class_member() counts a student only while they're enrolled and have
  // a parent's OK (20261109121500_class_member_enrolled.sql), so both
  // students are enrolled the way joinClass needs: the member reads, and the
  // revoked one is shut out by the revocation alone.
  for (const k of ["s2", "rev"]) {
    const { data, error } = await admin.rpc("class_enroll", { p_class_id: chatId, p_user_id: acc[k].id });
    if (error || (data !== "ok" && data !== "already")) throw new Error(`enroll ${k}: ${error?.message ?? data}`);
  }
  await admin.from("class_participants").insert([
    { class_id: chatId, user_id: acc.t1.id, role: "teacher", preset_name: "lfrc-teacher" },
    { class_id: chatId, user_id: acc.s2.id, role: "student", preset_name: "lfrc-student" },
    {
      class_id: chatId,
      user_id: acc.rev.id,
      role: "student",
      preset_name: "lfrc-student",
      revoked_at: new Date().toISOString(),
    },
  ]);

  await step("classRoster lists everyone with their usernames, teacher first", async () => {
    const roster = await classes.classRoster(chatId);
    assert.equal(roster[0].role, "teacher");
    assert.equal(roster[0].username, "lftest_foundation_t1");
    assert.equal(roster.length, 3);
    assert.equal(roster.find((r) => r.userId === acc.rev.id)?.revoked, true);
  });

  await step("chat: Realtime delivers shown rows to members only; blocked rows reach nobody", async () => {
    const who = { member: acc.s2, outsider: acc.out, revoked: acc.rev };
    const got: Record<string, string[]> = { member: [], outsider: [], revoked: [] };
    const clients: SupabaseClient[] = [];
    const statuses: Record<string, string> = {};
    for (const [k, a] of Object.entries(who)) {
      const c = await signIn(a);
      clients.push(c);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 8000);
        c.channel(`chat-${k}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "class_chat_messages", filter: `class_id=eq.${chatId}` },
            (payload) => got[k].push((payload.new as { body: string }).body)
          )
          .subscribe((status) => {
            statuses[k] = status;
            if (status === "SUBSCRIBED") {
              clearTimeout(timer);
              resolve();
            }
          });
      });
    }
    openClients.push(...clients);
    assert.equal(statuses.member, "SUBSCRIBED", `member channel: ${statuses.member}`);
    await sleep(1500);
    const { error } = await admin.from("class_chat_messages").insert([
      { class_id: chatId, sender_id: acc.t1.id, sender_username: "lftest_foundation_t1", sender_role: "teacher", body: "welcome to class", status: "shown", blocked_kinds: [] },
      { class_id: chatId, sender_id: acc.s2.id, sender_username: "lftest_foundation_s2", sender_role: "student", body: "add me on snap", status: "blocked", blocked_kinds: ["contact_app", "contact_phrase"] },
    ]);
    if (error) throw new Error(error.message);
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && got.member.length < 1) await sleep(250);
    await sleep(2500); // give the others time to (wrongly) receive anything
    for (const c of clients) await c.removeAllChannels();
    assert.deepEqual(got.member, ["welcome to class"], `member got ${JSON.stringify(got.member)}`);
    assert.deepEqual(got.outsider, [], `outsider got ${JSON.stringify(got.outsider)}`);
    assert.deepEqual(got.revoked, [], `revoked member got ${JSON.stringify(got.revoked)}`);
  });

  await step("chat: the polling read (plain select) follows the same policy", async () => {
    const read = async (a: Account | null) => {
      const c = a
        ? await signIn(a)
        : createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      const { data, error } = await c.from("class_chat_messages").select("body, status").eq("class_id", chatId);
      return { rows: data ?? [], error: error?.message ?? null };
    };
    const member = await read(acc.s2);
    assert.deepEqual(member.rows, [{ body: "welcome to class", status: "shown" }]);
    assert.deepEqual((await read(acc.out)).rows, []);
    assert.deepEqual((await read(acc.rev)).rows, []);
    const anon = await read(null);
    assert.ok(anon.rows.length === 0, "anon reads nothing");
    // And no member can write: inserts go through the server only.
    const c = await signIn(acc.s2);
    const ins = await c.from("class_chat_messages").insert({
      class_id: chatId, sender_id: acc.s2.id, sender_username: "x", sender_role: "student", body: "sneaky", status: "shown",
    });
    assert.ok(ins.error, "a member insert must be refused");
    // A locked table stays locked to a signed-in member.
    const locked = await c.from("classes").select("id").eq("id", chatId);
    assert.ok(locked.error || (locked.data ?? []).length === 0, "classes is locked");
  });

  await step("deleteAccountData keeps consent proof and queues RealtimeKit cleanup", async () => {
    await admin.from("classes").update({ rtk_meeting_id: "lftest-foundation-meeting" }).eq("id", chatId);
    await admin.from("class_participants").insert({
      class_id: chatId, user_id: acc.del.id, role: "student", preset_name: "lfrc-student", rtk_participant_id: "lftest-foundation-participant",
    });
    const { data: consent } = await admin
      .from("class_consents")
      .insert({ user_id: acc.del.id, user_handle: "lftest_foundation_del", user_birth_year: 2011, class_id: chatId, kind: "recording_notice", version: "2026-11-09" })
      .select("id")
      .single();
    const r = await profile.deleteAccountData(user("del"), { supabase: admin, admin });
    assert.deepEqual(r, { ok: true });
    const { data: kept } = await admin.from("class_consents").select("user_id, account_deleted_at, user_handle").eq("id", consent!.id).single();
    assert.equal(kept!.user_id, null);
    assert.ok(kept!.account_deleted_at, "stamped");
    assert.equal(kept!.user_handle, "lftest_foundation_del");
    const { data: parent } = await admin
      .from("class_parent_consents")
      .select("student_id, account_deleted_at")
      .eq("student_handle", "lftest_foundation_del")
      .single();
    assert.equal(parent!.student_id, null);
    assert.ok(parent!.account_deleted_at);
    const { data: queued } = await admin
      .from("class_rtk_cleanup")
      .select("rtk_app, participant_id, last_error")
      .eq("meeting_id", "lftest-foundation-meeting");
    assert.equal(queued?.length, 1, "participant delete queued for retry (no keys)");
    assert.equal(queued![0].participant_id, "lftest-foundation-participant");
    const gone = await admin.auth.admin.getUserById(acc.del.id);
    assert.ok(!gone.data.user, "auth user deleted");
  });
}

try {
  await main();
} catch (e) {
  results.push({ name: "setup", ok: false, error: (e as Error).message });
  console.log(`FAIL setup: ${(e as Error).message}`);
} finally {
  for (const c of new Set(openClients)) {
    try {
      await c.removeAllChannels();
      c.realtime.disconnect();
      await c.auth.signOut({ scope: "local" });
    } catch {
      // closing is best effort
    }
  }
  console.log("--- cleanup ---");
  await cleanup(PKG);
  await check(PKG);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : (process.exitCode ?? 0));
}
