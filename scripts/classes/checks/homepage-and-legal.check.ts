// The homepage-and-legal package's checks of src/lib/classes/static-pages.ts
// against production with throwaway data (classes-design.md 15.2):
//   - with the env switch off, nothing is visible and nothing touches the
//     database (the live site's state: no trace, no cost);
//   - CLASSES_VISIBLE=1 outside a Next runtime fails closed;
//   - with the dev switches, the homepage gets the same first three classes
//     /classes and the app get, soonest first, and never a handle.
// The rendered pages (nav order, homepage, legal pages, sitemap) are checked
// with curl against a dev server; see the package report.
//
//   node --import ./scripts/classes/register.mjs scripts/classes/checks/homepage-and-legal.check.ts [--keep]
//
// --keep leaves the test classes in place for the curl checks; run
//   node scripts/classes/test-data.mjs cleanup homepage-and-legal
// afterwards. Without it, everything is deleted at the end.

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../env.mjs";
import { create, cleanup, check, readCredentials } from "../test-data.mjs";

loadEnv();
delete process.env.VERCEL_ENV;

const PKG = "homepage-and-legal";
const TITLE = "lftest homepage-and-legal";
const keep = process.argv.includes("--keep");

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

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Counts requests to the Supabase project while `fn` runs. */
async function countSupabaseCalls<T>(fn: () => Promise<T>): Promise<{ value: T; calls: number }> {
  const real = globalThis.fetch;
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
  let calls = 0;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(host)) calls++;
    return real(input, init);
  }) as typeof fetch;
  try {
    return { value: await fn(), calls };
  } finally {
    globalThis.fetch = real;
  }
}

function setSwitches(s: { dev?: boolean; visible?: boolean }) {
  if (s.dev) process.env.CLASSES_DEV_SWITCHES = "1";
  else delete process.env.CLASSES_DEV_SWITCHES;
  if (s.visible) process.env.CLASSES_VISIBLE = "1";
  else delete process.env.CLASSES_VISIBLE;
}

async function newClass(n: number, teacherId: string, opts: { startsInMin: number; live?: boolean; lessonId?: string }) {
  const starts = new Date(Date.now() + opts.startsInMin * 60_000);
  const duration = 45;
  const { data, error } = await admin
    .from("classes")
    .insert({
      teacher_id: teacherId,
      title: `${TITLE} class ${n}`,
      starts_at: starts.toISOString(),
      duration_minutes: duration,
      hard_end_at: new Date(starts.getTime() + (duration + 15) * 60_000).toISOString(),
      capacity: 15,
      status: opts.live ? "live" : "scheduled",
      lesson_id: opts.lessonId ?? null,
      rtk_app: "dev",
    })
    .select("id")
    .single();
  if (error) throw new Error(`class ${n}: ${error.message}`);
  return data.id as string;
}

async function main() {
  const sp = await import("../../../src/lib/classes/static-pages.ts");
  const classes = await import("../../../src/lib/app/classes.ts");

  await step("env switch off: hidden everywhere, and no database read", async () => {
    setSwitches({});
    const { value, calls } = await countSupabaseCalls(async () => ({
      env: sp.classesEnvAllows(),
      visible: await sp.classesVisibleOnStaticPages(),
      home: await sp.homeClasses(),
    }));
    assert.equal(value.env, false);
    assert.equal(value.visible, false);
    assert.equal(value.home, null);
    assert.equal(calls, 0, "no Supabase request while CLASSES_VISIBLE is off");
  });

  await step("CLASSES_DEV_SWITCHES is ignored by a production build", async () => {
    setSwitches({ dev: true });
    const env = process.env as Record<string, string | undefined>;
    const was = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const { value, calls } = await countSupabaseCalls(async () => ({
        env: sp.classesEnvAllows(),
        visible: await sp.classesVisibleOnStaticPages(),
        home: await sp.homeClasses(),
      }));
      assert.deepEqual(value, { env: false, visible: false, home: null });
      assert.equal(calls, 0);
    } finally {
      env.NODE_ENV = was;
    }
  });

  await step("CLASSES_VISIBLE=1 outside a Next runtime fails closed", async () => {
    // unstable_cache needs Next's cache; without it the read throws, and a
    // throw has to mean hidden, never visible.
    setSwitches({ visible: true });
    const silence = console.error;
    console.error = () => {};
    try {
      assert.equal(sp.classesEnvAllows(), true);
      assert.equal(await sp.classesVisibleOnStaticPages(), false);
      assert.equal(await sp.homeClasses(), null);
    } finally {
      console.error = silence;
    }
  });

  await cleanup(PKG); // a clean start if an earlier run stopped halfway
  await create(PKG, ["t1:age=16:parent=agreed:teacher"]);
  const t1 = readCredentials(PKG).accounts.t1 as { id: string; username: string };
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, title")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  const ids = [
    await newClass(1, t1.id, { startsInMin: -5, live: true }),
    await newClass(2, t1.id, { startsInMin: 40, lessonId: lesson!.id as string }),
    await newClass(3, t1.id, { startsInMin: 70 }),
    await newClass(4, t1.id, { startsInMin: 100 }),
  ];

  await step("dev switches: the homepage gets the listing's first three, with no handle", async () => {
    setSwitches({ dev: true });
    const home = await sp.homeClasses();
    assert.ok(home, "visible");
    const all = await classes.listUpcomingClasses({ limit: 200 });
    assert.equal(home!.length, Math.min(3, all.classes.length));
    assert.deepEqual(
      home!.map((c) => c.id),
      all.classes.slice(0, 3).map((c) => c.id),
      "same classes, same order as /classes and the app"
    );
    for (let i = 1; i < home!.length; i++)
      assert.ok(home![i - 1].startsAt <= home![i].startsAt, "soonest first");
    for (const c of home!) {
      assert.equal(c.teacher, null, "no teacher handle");
      assert.equal(c.enrolled, null);
      assert.equal(c.teacherLabel, "Taught by an FRC student");
    }
    assert.ok(!JSON.stringify(home).includes(t1.username), "the teacher's username never appears");
    // Ours are the soonest unless another package has an earlier class.
    const mine = home!.filter((c) => ids.includes(c.id));
    if (mine.length === 3) {
      assert.deepEqual(mine.map((c) => c.id), ids.slice(0, 3));
      assert.equal(mine[0].status, "live");
      assert.equal(mine[1].topic?.kind, "lesson");
      assert.equal(mine[1].topic?.title, lesson!.title);
      assert.equal(mine[1].seats.left, 15);
    }
    console.log(`     homepage would show: ${home!.map((c) => c.title).join(" | ")}`);
  });

  await step("hidden again the moment the env switch is off", async () => {
    setSwitches({});
    assert.equal(await sp.homeClasses(), null);
    assert.equal(await sp.classesVisibleOnStaticPages(), false);
  });

  if (keep) {
    console.log(`kept ${ids.length} test classes for the curl checks; clean up with test-data.mjs cleanup ${PKG}`);
  } else {
    await cleanup(PKG);
    await check(PKG);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e);
  if (!keep) await cleanup(PKG).catch(() => {});
  process.exit(1);
});
