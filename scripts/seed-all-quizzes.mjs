import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const FILE = process.argv[2];
if (!FILE) {
  console.error("usage: node seed-all-quizzes.mjs <workflow-output.json>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const raw = readFileSync(FILE, "utf8");
const parsed = JSON.parse(raw);
const resultObj =
  typeof parsed.result === "string" ? JSON.parse(parsed.result) : parsed.result;
const quizzes = Array.isArray(parsed)
  ? parsed
  : parsed.quizzes || resultObj?.quizzes || [];

function validQuiz(q) {
  if (!Array.isArray(q) || q.length < 1) return false;
  return q.every(
    (item) =>
      item &&
      typeof item.question === "string" &&
      Array.isArray(item.options) &&
      item.options.length === 4 &&
      item.options.every((o) => typeof o === "string") &&
      Number.isInteger(item.answer) &&
      item.answer >= 0 &&
      item.answer <= 3 &&
      typeof item.explanation === "string"
  );
}

// id -> quiz (last valid wins)
const map = new Map();
let invalid = 0;
for (const entry of quizzes) {
  if (!entry || typeof entry.id !== "string" || !validQuiz(entry.quiz)) {
    invalid++;
    continue;
  }
  // normalize to exactly 3 questions if more were returned
  map.set(entry.id, entry.quiz.slice(0, 3));
}

const { data: lessons } = await supabase.from("lessons").select("id");
const lessonIds = new Set((lessons || []).map((l) => l.id));

let updated = 0;
let unknownId = 0;
const targets = [...map.entries()].filter(([id]) => lessonIds.has(id));
for (const [id] of map) if (!lessonIds.has(id)) unknownId++;

// update in parallel chunks
const CHUNK = 25;
for (let i = 0; i < targets.length; i += CHUNK) {
  const slice = targets.slice(i, i + CHUNK);
  await Promise.all(
    slice.map(async ([id, quiz]) => {
      const { error } = await supabase.from("lessons").update({ quiz }).eq("id", id);
      if (error) console.error("update failed", id, error.message);
      else updated++;
    })
  );
}

// coverage report
const { data: withQuiz } = await supabase
  .from("lessons")
  .select("id, quiz");
const haveQuiz = (withQuiz || []).filter(
  (l) => Array.isArray(l.quiz) && l.quiz.length > 0
).length;

console.log(
  JSON.stringify(
    {
      parsedQuizzes: quizzes.length,
      validUnique: map.size,
      invalid,
      unknownId,
      lessonsUpdated: updated,
      totalLessons: lessonIds.size,
      lessonsWithQuizNow: haveQuiz,
      lessonsStillMissing: lessonIds.size - haveQuiz,
    },
    null,
    2
  )
);
