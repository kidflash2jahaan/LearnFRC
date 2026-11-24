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

test("a class of 100, two tries each, fits the network limits", () => {
  const L = limits();
  assert.ok(L.signInNetwork.max >= 200 && L.signInNetwork.seconds <= 300);
  assert.ok(L.signInNetworkHour.max >= 200);
  assert.ok(L.signUpNetwork.max >= 200);
});

test("account limits stay low enough to stop password guessing", () => {
  const L = limits();
  assert.ok(L.signInAccount.max <= 10 && L.signInAccount.seconds >= 300);
  assert.ok(L.signInAccountAnywhere.max <= 30 && L.signInAccountAnywhere.seconds >= 900);
});

test("both sign-in doors go through checkSignIn, not their own limits", () => {
  for (const door of ["src/app/actions/auth.ts", "src/app/api/app/auth/sign-in/route.ts"]) {
    const src = read(door);
    assert.match(src, /checkSignIn\(identifier\)/, door);
    assert.doesNotMatch(src, /rateLimit\(/, door);
  }
});

test("both sign-up doors go through registerAccount, which checks the limit", () => {
  assert.match(read("src/lib/app/accounts.ts"), /await checkSignUp\(\)/);
  for (const door of ["src/app/actions/auth.ts", "src/app/api/app/auth/sign-up/route.ts"]) {
    const src = read(door);
    assert.match(src, /registerAccount\(/, door);
    assert.doesNotMatch(src, /rateLimit\(/, door);
  }
});
