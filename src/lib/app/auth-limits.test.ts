import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// auth-limits.ts is server-only, so these read the source instead of
// importing it, like avatar.test.ts does.

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

// the AUTH_LIMITS table, as { name: { max, seconds } }
function limits(): Record<string, { max: number; seconds: number }> {
  const out: Record<string, { max: number; seconds: number }> = {};
  const src = read("src/lib/app/auth-limits.ts");
  for (const m of src.matchAll(/(\w+): \{ max: (\d+), seconds: (\d+) \}/g))
    out[m[1]] = { max: Number(m[2]), seconds: Number(m[3]) };
  return out;
}

// Only the site's own limits. Supabase's limits and its hourly email cap
// also decide whether a class of 100 really fits (see auth-limits.ts).
test("the site's network limits fit a class of 100, two tries each", () => {
  const L = limits();
  assert.ok(L.signInNetwork.max >= 200 && L.signInNetwork.seconds <= 300);
  assert.ok(L.signInNetworkHour.max >= 200);
  assert.ok(L.signUpNetwork.max >= 200);
});

// These only cover the site's doors, not email sign-in straight to Supabase.
test("the site's per-account limit stays at 10 failed sign-ins per 5 minutes", () => {
  const L = limits();
  assert.ok(L.signInAccount.max <= 10 && L.signInAccount.seconds >= 300);
});

// a limit on the account from every network lets anyone lock its owner out
test("no sign-in limit is keyed on the account alone", () => {
  const src = read("src/lib/app/auth-limits.ts");
  assert.doesNotMatch(src, /rateLimitKey/);
  assert.equal(limits().signInAccountAnywhere, undefined);
});

test("one network's resends stay a small share of the 500-an-hour email cap", () => {
  assert.ok(limits().resendNetwork.max <= 50);
});

test("both sign-in doors go through passwordSignIn, not their own limits", () => {
  for (const door of ["src/app/actions/auth.ts", "src/app/api/app/auth/sign-in/route.ts"]) {
    const src = read(door);
    assert.match(src, /passwordSignIn\(/, door);
    assert.doesNotMatch(src, /rateLimit\(|signInWithPassword/, door);
  }
});

test("a successful sign-in gives its try back, so only failed ones count", () => {
  const src = read("src/lib/app/accounts.ts");
  const fn = src.slice(src.indexOf("export async function passwordSignIn"));
  assert.ok(fn.indexOf("checkSignInAccount(") < fn.indexOf("signInWithPassword("));
  assert.ok(fn.indexOf("signInWithPassword(") < fn.indexOf("forgiveSignIn("));
});

test("both sign-up doors go through registerAccount, which checks the limit", () => {
  assert.match(read("src/lib/app/accounts.ts"), /await checkSignUp\(\)/);
  for (const door of ["src/app/actions/auth.ts", "src/app/api/app/auth/sign-up/route.ts"]) {
    const src = read(door);
    assert.match(src, /registerAccount\(/, door);
    assert.doesNotMatch(src, /rateLimit\(/, door);
  }
});
