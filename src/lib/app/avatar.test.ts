import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NO_AVATAR_URL, PHOTO_LINK_REFUSED, photoLinkEdit } from "./avatar.ts";

// Profile pictures are initials only. Most of these read the source, because
// the rule is "nothing shows the column", and that is a property of every file
// at once. photoLinkEdit, the one piece with behaviour, is tested directly.

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
// the shared Settings rules, which may compare against it and delete it
const PROFILE_RULES = "src/lib/app/profile.ts";

test("the rule is no avatar URL", () => {
  assert.equal(NO_AVATAR_URL, null);
});

test("nothing else in src/ selects, reads or writes the avatar column", () => {
  const offenders = sourceFiles("src")
    .filter((f) => !RULE_FILES.includes(f) && f !== PROFILE_RULES)
    .filter((f) => read(f).includes("avatar_url"));
  assert.deepEqual(
    offenders,
    [],
    "avatar_url is back in these files. Profile pictures are initials only: see src/lib/app/avatar.ts"
  );
});

test("the shared Settings rules only ever write null to the avatar column", () => {
  const src = read(PROFILE_RULES);
  // a write or a type, never a value read from somewhere
  const assigned = [...src.matchAll(/\bavatar_url\s*:\s*([^,;\n}]+)/g)].map((m) => m[1].trim());
  assert.ok(assigned.includes("null"), "the delete should write null");
  for (const value of assigned) assert.match(value, /^(null|string \| null)$/, value);
  // and the yes or no Settings gets is a boolean, not the link
  assert.match(src, /hasStoredPhotoLink\([^)]*\)\s*:\s*Promise<boolean>/);
});

/* ------------------------------------------------------------------ */
/*  Deleting a stored photo link                                       */
/* ------------------------------------------------------------------ */

const STORED = "https://lh3.googleusercontent.com/a/example";

test("a photo link left out changes nothing", () => {
  assert.equal(photoLinkEdit(undefined, STORED), "keep");
  assert.equal(photoLinkEdit(undefined, null), "keep");
});

test("null or blank deletes the stored link", () => {
  for (const sent of [null, "", "   "]) {
    assert.equal(photoLinkEdit(sent, STORED), "delete", JSON.stringify(sent));
    // and deleting nothing is fine too
    assert.equal(photoLinkEdit(sent, null), "delete", JSON.stringify(sent));
  }
});

test("the stored link sent back unchanged changes nothing", () => {
  // an installed app's form, filled from a cached /me, riding along with a bio edit
  assert.equal(photoLinkEdit(STORED, STORED), "keep");
  assert.equal(photoLinkEdit(`  ${STORED} `, STORED), "keep");
});

test("any new photo link is refused, with a sentence that says what to do", () => {
  assert.equal(photoLinkEdit("https://example.com/me.png", null), "refuse");
  assert.equal(photoLinkEdit("https://example.com/me.png", STORED), "refuse");
  assert.equal(photoLinkEdit("not a link", null), "refuse");
  // the installed app's field is called "Avatar image URL"
  assert.match(PHOTO_LINK_REFUSED, /initials only/);
  assert.match(PHOTO_LINK_REFUSED, /avatar image URL/);
  assert.match(PHOTO_LINK_REFUSED, /Clear that field/);
  assert.doesNotMatch(PHOTO_LINK_REFUSED, /\u2014/);
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

test("PATCH /api/app/profile hands a sent avatarUrl to the shared rule", () => {
  const route = read("src/app/api/app/profile/route.ts");
  // still type-checked like the other text fields
  assert.match(route, /TEXT_KEYS = \[[^\]]*"avatarUrl"/);
  // passed on only when sent, so leaving it out leaves the stored link alone
  assert.match(route, /if \("avatarUrl" in body\) fields\.avatarUrl = body\.avatarUrl/);
  assert.doesNotMatch(route, /text\("avatarUrl"/);

  // the shared rule runs on it, refuses a new link, and deletes on "delete"
  const rules = read(PROFILE_RULES);
  assert.match(rules, /photoLinkEdit\(fields\.avatarUrl, current\?\.avatar_url \?\? null\)/);
  assert.match(rules, /photo === "refuse"\) return fail\("validation", PHOTO_LINK_REFUSED\)/);
  assert.match(rules, /photo === "delete" \? \{ avatar_url: null \}/);
});

test("the site's Avatar draws initials and takes no image", () => {
  const avatar = read("src/components/ui/avatar.tsx");
  assert.doesNotMatch(avatar, /AvatarPrimitive\.Image|<img\b/);
  assert.doesNotMatch(avatar, /\bsrc\??\s*:|\bsrc=/);
  assert.match(avatar, /AvatarPrimitive\.Fallback/);
});

test("Settings has no avatar field, only a delete box while a link is stored", () => {
  const form = read("src/components/settings/settings-form.tsx");
  assert.doesNotMatch(form, /Avatar image URL|name="avatar/);
  assert.match(form, /\{storedPhotoLink && \(/);
  assert.match(form, /name="delete_photo_link"/);

  // the page asks the shared rules whether one is stored
  const page = read("src/app/settings/page.tsx");
  assert.match(page, /hasStoredPhotoLink\(admin, user\.id\)/);
  assert.match(page, /storedPhotoLink=\{storedPhotoLink\}/);

  // and the ticked box sends blank, which the shared rule reads as delete
  const action = read("src/app/actions/profile.ts");
  assert.match(action, /formData\.get\("delete_photo_link"\) \? \{ avatarUrl: "" \}/);
  assert.equal(photoLinkEdit("", STORED), "delete");
});

test("the app's own Settings form has no avatar field either", () => {
  const form = read("apple/LearnFRC/Features/Account/SettingsProfileForm.swift");
  assert.doesNotMatch(form, /Avatar image URL/);
  assert.doesNotMatch(form, /avatarURL/);
});

test("the privacy policy doesn't promise an avatar field, and says how to delete the link", () => {
  const ledger = read("src/app/privacy/_privacy-glass.tsx");
  const policy = read("src/app/privacy/page.tsx");
  for (const [name, src] of [
    ["ledger", ledger],
    ["policy", policy],
  ]) {
    assert.doesNotMatch(src, /bio,? and avatar/, name);
    assert.match(src, /photo link/, name);
  }
  assert.match(ledger, /its own delete box/);
  assert.match(policy, /you can delete it in your settings/);
});

/* ------------------------------------------------------------------ */
/*  The sign-up trigger                                                */
/* ------------------------------------------------------------------ */

// These read the migration file, so they say what the repo will apply, not
// what the live database runs: nothing applies migrations on deploy here, and
// this one has to be applied by hand (see its header).

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
