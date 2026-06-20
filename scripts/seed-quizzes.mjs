/**
 * Updates lessons.quiz from generated quizzes WITHOUT touching other data.
 * Source: content/quizzes.json  ->  { quizzes: [{ id, quiz: [{question, options[4], answer, explanation}] }] }
 *
 * Run: node --env-file=.env.local scripts/seed-quizzes.mjs [sourceFile]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sourceFile = process.argv[2] || join(root, "content", "quizzes.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

function clean(quiz) {
  if (!Array.isArray(quiz)) return null;
  const out = [];
  for (const q of quiz) {
    if (!q || typeof q.question !== "string") continue;
    const options = Array.isArray(q.options) ? q.options.filter((o) => typeof o === "string") : [];
    if (options.length < 2) continue;
    let answer = Number(q.answer);
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
    out.push({
      question: q.question.trim(),
      options,
      answer,
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
    });
  }
  return out.length ? out : null;
}

async function main() {
  const parsed = JSON.parse(readFileSync(sourceFile, "utf8"));
  const quizzes = parsed.quizzes || parsed;
  let updated = 0, skipped = 0;

  for (const entry of quizzes) {
    const id = entry.id;
    const quiz = clean(entry.quiz);
    if (!id || !quiz) { skipped++; continue; }
    const { error } = await supabase.from("lessons").update({ quiz }).eq("id", id);
    if (error) { console.warn(`! ${id}: ${error.message}`); skipped++; continue; }
    updated++;
  }

  const { count } = await supabase
    .from("lessons").select("*", { count: "exact", head: true }).gt("quiz", "[]");
  console.log(`\nUpdated ${updated} lessons with quizzes (${skipped} skipped).`);
  console.log(`Lessons with a quiz now: ~${count ?? "?"}`);
}

main().catch((e) => { console.error("Quiz seed failed:", e); process.exit(1); });
