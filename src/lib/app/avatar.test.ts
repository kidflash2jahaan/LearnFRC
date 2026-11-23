import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NO_AVATAR_URL } from "./avatar.ts";

// Profile pictures are initials only. These read the source, because the rule
// is "nothing reads the column", and that is a property of every file at once.

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

// every .ts and .tsx file under a folder, as paths from the repo root
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

// the file that states the rule, and this one, may name the column
const RULE_FILES = ["src/lib/app/avatar.ts", "src/lib/app/avatar.test.ts"];

test("the rule is no avatar URL", () => {
  assert.equal(NO_AVATAR_URL, null);
});

test("nothing in src/ selects, reads or writes the avatar column", () => {
  const offenders = sourceFiles("src")
    .filter((f) => !RULE_FILES.includes(f))
    .filter((f) => read(f).includes("avatar_url"));
  assert.deepEqual(
    offenders,
    [],
    "avatar_url is back in these files. Profile pictures are initials only: see src/lib/app/avatar.ts"
  );
});

test("every avatarUrl an /api/app response sends is NO_AVATAR_URL", () => {
  const files = [...sourceFiles("src/app/api/app"), ...sourceFiles("src/lib/app")].filter(
    (f) => !RULE_FILES.includes(f)
  );
  const bad: string[] = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/\bavatarUrl\s*:\s*([^,;\n}]+)/g)) {
      // a value (NO_AVATAR_URL) or a type (null), never something read from a row
      const value = m[1].trim();
      if (value !== "NO_AVATAR_URL" && value !== "null") bad.push(`${f}: ${m[0].trim()}`);
    }
  }
  assert.deepEqual(bad, []);

  // and the routes that send one still do, so installed copies keep decoding it
  for (const f of [
    "src/lib/app/profile.ts", // /me and PATCH /profile
    "src/lib/app/leaderboard.ts",
    "src/app/api/app/team/route.ts",
    "src/app/api/app/u/[username]/route.ts",
  ])
    assert.match(read(f), /avatarUrl: NO_AVATAR_URL/, f);
});

test("PATCH /api/app/profile still accepts avatarUrl from installed copies", () => {
  const route = read("src/app/api/app/profile/route.ts");
  assert.match(route, /TEXT_KEYS = \[[^\]]*"avatarUrl"/);
  // accepted for its type check only: it never reaches the shared rules
  assert.doesNotMatch(route, /text\("avatarUrl"/);
  assert.doesNotMatch(read("src/lib/app/profile.ts"), /fields\.avatarUrl/);
});

test("the site's Avatar draws initials and takes no image", () => {
  const avatar = read("src/components/ui/avatar.tsx");
  assert.doesNotMatch(avatar, /AvatarPrimitive\.Image|<img\b/);
  assert.doesNotMatch(avatar, /\bsrc\??\s*:|\bsrc=/);
  assert.match(avatar, /AvatarPrimitive\.Fallback/);
});

test("Settings has no avatar field", () => {
  const form = read("src/components/settings/settings-form.tsx");
  assert.doesNotMatch(form, /Avatar image URL|name="avatar/);
  assert.doesNotMatch(read("src/app/actions/profile.ts"), /avatarUrl/);
});

/* ------------------------------------------------------------------ */
/*  The sign-up trigger                                                */
/* ------------------------------------------------------------------ */

const MIGRATIONS = "supabase/migrations";

// the newest migration that redefines handle_new_user, without its comments
function latestHandleNewUser(): { file: string; sql: string } {
  const files = readdirSync(join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
  const defining = files.filter((f) =>
    /create or replace function public\.handle_new_user\b/i.test(read(join(MIGRATIONS, f)))
  );
  const file = defining.at(-1);
  assert.ok(file, "no migration defines handle_new_user");
  const sql = read(join(MIGRATIONS, file))
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  return { file, sql };
}

// the top-level comma-separated parts of a parenthesised list starting at `open`
function topLevelParts(sql: string, open: number): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = open + 1;
  for (let i = open; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") quoted = !quoted;
    if (quoted) continue;
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) {
      parts.push(sql.slice(start, i).trim());
      return parts;
    } else if (c === "," && depth === 1) {
      parts.push(sql.slice(start, i).trim());
      start = i + 1;
    }
  }
  throw new Error("unbalanced parentheses");
}

test("new sign-ups don't get their Google photo copied in", () => {
  const { file, sql } = latestHandleNewUser();
  assert.equal(file, "20261123120000_no_google_avatar_copy.sql");
  assert.doesNotMatch(sql, /avatar/i);

  const insert = sql.search(/insert into public\.profiles\s*\(/i);
  assert.ok(insert >= 0, "handle_new_user should insert into public.profiles");
  const columns = topLevelParts(sql, sql.indexOf("(", insert));
  assert.deepEqual(columns, ["id", "full_name", "username", "team_number"]);

  // one value for each column, in the same order
  const values = topLevelParts(sql, sql.indexOf("(", sql.search(/\bvalues\s*\(/i)));
  assert.equal(values.length, columns.length);
  assert.equal(values[0], "new.id");
  assert.match(values[1], /'full_name'/);
  assert.match(values[2], /'username'/);
  assert.match(values[3], /'team_number'/);
});
