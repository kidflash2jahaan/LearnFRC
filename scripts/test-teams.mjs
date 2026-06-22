import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

const pass = "TestPass123!aZ";
const suffix = Date.now();
const emailA = `team-test-a-${suffix}@example.com`;
const emailB = `team-test-b-${suffix}@example.com`;
let idA, idB, teamId, code, lessonId;
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗ FAIL"} ${m}`); if (!c) failures++; };

async function signedClient(email) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error("signin: " + error.message);
  return c;
}

try {
  // ── setup ──────────────────────────────────────────────
  const a = await admin.auth.admin.createUser({ email: emailA, password: pass, email_confirm: true });
  const b = await admin.auth.admin.createUser({ email: emailB, password: pass, email_confirm: true });
  idA = a.data.user.id; idB = b.data.user.id;
  ok(idA && idB, "created two confirmed test users");

  const ca = await signedClient(emailA);
  const cb = await signedClient(emailB);

  // ── create_team (A) ────────────────────────────────────
  const created = await ca.rpc("create_team", { p_name: "Test Team", p_team_number: 9999 });
  ok(!created.error, `A create_team ${created.error ? "(" + created.error.message + ")" : "ok"}`);
  teamId = created.data?.id; code = created.data?.join_code;
  ok(!!code, `got a join code (${code})`);

  // one-team-per-user enforced
  const dupe = await ca.rpc("create_team", { p_name: "Second", p_team_number: 1 });
  ok(!!dupe.error, "A cannot create a second team (one-per-user)");

  // ── join_team (B) ──────────────────────────────────────
  const joined = await cb.rpc("join_team", { p_code: code });
  ok(!joined.error, `B join_team ${joined.error ? "(" + joined.error.message + ")" : "ok"}`);

  const badJoin = await cb.rpc("join_team", { p_code: "ZZZZZZ" });
  ok(!!badJoin.error, "invalid code is rejected");

  // ── RLS: roster visibility ────────────────────────────
  const ownerView = await ca.from("team_memberships").select("user_id, role").eq("team_id", teamId);
  ok((ownerView.data?.length ?? 0) === 2, `owner sees full roster (${ownerView.data?.length} members)`);

  const memberView = await cb.from("team_memberships").select("user_id").eq("team_id", teamId);
  ok((memberView.data?.length ?? 0) === 1, `member sees only own membership (${memberView.data?.length})`);

  const bSeesTeam = await cb.from("teams").select("name").eq("id", teamId);
  ok((bSeesTeam.data?.length ?? 0) === 1, "member can read their team row");

  // ── RLS: progress privacy (mentor can't read via normal client) ──
  const oneLesson = await admin.from("lessons").select("id").limit(1).maybeSingle();
  lessonId = oneLesson.data?.id;
  if (lessonId) {
    await admin.from("lesson_progress").insert({ user_id: idA, lesson_id: lessonId });
    const bReadsA = await cb.from("lesson_progress").select("id").eq("user_id", idA);
    ok((bReadsA.data?.length ?? 0) === 0, "member CANNOT read another member's progress (RLS holds)");
    const adminReadsA = await admin.from("lesson_progress").select("id").eq("user_id", idA);
    ok((adminReadsA.data?.length ?? 0) >= 1, "admin client CAN read progress (dashboard path works)");
  }
} catch (e) {
  console.error("ERROR:", e.message);
  failures++;
} finally {
  // ── cleanup ────────────────────────────────────────────
  for (const id of [idA, idB].filter(Boolean)) {
    await admin.from("lesson_progress").delete().eq("user_id", id);
    await admin.from("team_memberships").delete().eq("user_id", id);
    await admin.from("teams").delete().eq("owner_id", id);
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
  }
  console.log("cleaned up test users");
  console.log(failures === 0 ? "\nALL PASSED ✅" : `\n${failures} FAILURE(S) ❌`);
  process.exit(failures === 0 ? 0 : 1);
}
