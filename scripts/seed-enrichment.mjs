/**
 * Appends enrichment modules/lessons to existing departments WITHOUT wiping.
 * Source: content/enrichment.json  ->  { departments: [{ slug, newModules:[...] }] }
 *
 * Run: node --env-file=.env.local scripts/seed-enrichment.mjs [sourceFile]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sourceFile = process.argv[2] || join(root, "content", "enrichment.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

function slugify(s, i) {
  let out = (s || `item-${i}`).toString().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return out || `item-${i}`;
}

async function main() {
  const parsed = JSON.parse(readFileSync(sourceFile, "utf8"));
  const depts = parsed.departments || parsed;
  let addedModules = 0, addedLessons = 0, skipped = 0;

  for (const d of depts) {
    const { data: dept } = await supabase
      .from("departments").select("id").eq("slug", d.slug).maybeSingle();
    if (!dept) { console.warn(`! no department ${d.slug}`); continue; }

    const { data: existing } = await supabase
      .from("modules").select("slug, sort_order").eq("department_id", dept.id);
    const used = new Set((existing ?? []).map((m) => m.slug));
    let order = Math.max(0, ...(existing ?? []).map((m) => m.sort_order)) + 1;

    for (const m of d.newModules || []) {
      let slug = slugify(m.slug || m.title, order);
      if (used.has(slug)) { skipped++; continue; } // already appended — skip
      let cand = slug, n = 2;
      while (used.has(cand)) cand = `${slug}-${n++}`;
      used.add(cand);

      const { data: mod, error: mErr } = await supabase
        .from("modules")
        .insert({ department_id: dept.id, slug: cand, title: m.title, overview: m.overview ?? null, sort_order: order++ })
        .select("id").single();
      if (mErr) { console.warn(`! module ${m.title}: ${mErr.message}`); continue; }
      addedModules++;

      const lessons = m.lessons || [];
      const lUsed = new Set();
      const rows = lessons.map((l, li) => {
        let ls = slugify(l.slug || l.title, li);
        let lc = ls, k = 2;
        while (lUsed.has(lc)) lc = `${ls}-${k++}`;
        lUsed.add(lc);
        return {
          module_id: mod.id, slug: lc, title: l.title, summary: l.summary ?? null,
          content: l.content ?? "", key_takeaways: l.keyTakeaways ?? [],
          resources: l.resources ?? [], estimated_minutes: l.estimatedMinutes ?? 10, sort_order: li,
        };
      });
      if (rows.length) {
        const { error: lErr } = await supabase.from("lessons").insert(rows);
        if (lErr) { console.warn(`! lessons for ${m.title}: ${lErr.message}`); continue; }
        addedLessons += rows.length;
      }
    }
    console.log(`✓ ${d.slug}: +${(d.newModules || []).length} modules`);
  }
  console.log(`\nAppended ${addedModules} modules, ${addedLessons} lessons (${skipped} skipped as duplicates).`);
}

main().catch((e) => { console.error("Enrichment seed failed:", e); process.exit(1); });
