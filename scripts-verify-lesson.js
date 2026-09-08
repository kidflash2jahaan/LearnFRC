#!/usr/bin/env node
/**
 * Mark a lesson as fact-checked, or list what still needs checking.
 *
 * The badge on a lesson is only worth something if marking one is deliberate,
 * so this asks for a name and refuses to run without one. There is no bulk
 * "mark everything" mode on purpose: a claim that a person read a lesson is
 * only true if a person read the lesson.
 *
 *   node scripts-verify-lesson.js --next [department]     what to check next
 *   node scripts-verify-lesson.js --list                  what is already done
 *   node scripts-verify-lesson.js <lesson-slug> --by "Jahaan Pardhanani" \
 *        [--note "Corrected the gear ratio example"] \
 *        [--sources "WPILib docs, 2026 game manual"]
 *   node scripts-verify-lesson.js <lesson-slug> --unverify
 */
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
const g = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };
const U = g("NEXT_PUBLIC_SUPABASE_URL"), K = g("SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: K, Authorization: "Bearer " + K, "Content-Type": "application/json" };

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf("--" + name); return i === -1 ? null : args[i + 1] ?? true; };
const has = (name) => args.includes("--" + name);

const api = async (p, init) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { headers: H, ...init });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 160)}`);
  return t ? JSON.parse(t) : null;
};

(async () => {
  if (has("list")) {
    const rows = await api("lessons?select=slug,title,verified_at,verified_by&verified_at=not.is.null&order=verified_at.desc");
    if (rows.length === 0) return console.log("nothing checked yet");
    rows.forEach((r) => console.log(`  ${r.verified_at.slice(0, 10)}  ${r.verified_by}  ${r.title}`));
    return console.log(`\n  ${rows.length} checked`);
  }

  if (has("next")) {
    const dept = flag("next");
    const q = typeof dept === "string"
      ? `lessons?select=slug,title,modules!inner(departments!inner(slug))&verified_at=is.null&modules.departments.slug=eq.${dept}&order=sort_order&limit=25`
      : "lessons?select=slug,title,modules(departments(slug))&verified_at=is.null&order=sort_order&limit=25";
    const rows = await api(q);
    const [{ count: left }] = [{ count: rows.length }];
    console.log(typeof dept === "string" ? `unchecked in ${dept}:` : "unchecked, first 25:");
    rows.forEach((r) => console.log(`  ${(r.modules?.departments?.slug ?? "?").padEnd(22)} ${r.slug}`));
    if (rows.length === 0) console.log("  none left");
    return;
  }

  const slug = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--by" && args[args.indexOf(a) - 1] !== "--note" && args[args.indexOf(a) - 1] !== "--sources" && args[args.indexOf(a) - 1] !== "--next");
  if (!slug) { console.error("give a lesson slug, or --next / --list"); process.exit(1); }

  const found = await api(`lessons?select=id,slug,title,verified_at,verified_by&slug=eq.${encodeURIComponent(slug)}`);
  if (found.length === 0) { console.error(`no lesson with slug "${slug}"`); process.exit(1); }
  const lesson = found[0];

  if (has("unverify")) {
    await api(`lessons?id=eq.${lesson.id}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ verified_at: null, verified_by: null, verified_note: null, verified_sources: null }),
    });
    return console.log(`unmarked: ${lesson.title}`);
  }

  const by = flag("by");
  if (!by || by === true) {
    console.error('--by "Your Name" is required. An unattributed check is not a check.');
    process.exit(1);
  }
  const note = flag("note");
  const sources = flag("sources");

  await api(`lessons?id=eq.${lesson.id}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({
      verified_at: new Date().toISOString(),
      verified_by: by,
      verified_note: typeof note === "string" ? note : null,
      verified_sources: typeof sources === "string" ? sources.split(",").map((s) => s.trim()).filter(Boolean) : null,
    }),
  });

  const prog = await api("lessons?select=id&verified_at=not.is.null");
  const all = await api("lessons?select=id");
  console.log(`checked: ${lesson.title}`);
  console.log(`  by ${by}${typeof note === "string" ? `, note: ${note}` : ""}`);
  console.log(`  progress: ${prog.length} of ${all.length}`);
  console.log(`  the page updates within the hour, or run /api/revalidate to push it now`);
})().catch((e) => { console.error("error:", e.message); process.exit(1); });
