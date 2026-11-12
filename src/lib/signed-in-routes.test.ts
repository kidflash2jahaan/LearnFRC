import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIGNED_IN_HOME,
  SIGNED_IN_REDIRECT_CACHE_CONTROL,
  SIGNED_IN_VERSION,
  SIGNED_IN_VERSION_IN_PAGE,
  SIGNED_OUT_ONLY,
  signedInHref,
  signedInLanding,
  signedInRedirect,
} from "./signed-in-routes.ts";

const get = (path: string, method = "GET") => {
  const url = new URL(path, "https://learnfrc.com");
  return signedInRedirect({ method, pathname: url.pathname, searchParams: url.searchParams });
};

test("the pairs", () => {
  assert.equal(get("/"), "/dashboard");
  assert.equal(get("/for-teams"), "/teams");
  assert.equal(get("/auth/verify-email"), "/dashboard");
});

test("HEAD too, and a trailing slash is the same page", () => {
  assert.equal(get("/", "HEAD"), "/dashboard");
  assert.equal(get("/for-teams/"), "/teams");
});

// Server Actions post to the page they're on: the footer's newsletter form
// posts to "/" when it's used from the home page.
test("never a POST or any other method", () => {
  for (const m of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    assert.equal(get("/", m), null, m);
    assert.equal(get("/for-teams", m), null, m);
  }
});

test("the query string is dropped, so an address on verify-email isn't carried on", () => {
  assert.equal(get("/auth/verify-email?email=a%40b.co"), "/dashboard");
  assert.equal(get("/?ref=someone&utm_source=x"), "/dashboard");
});

// Supabase's fallback when a redirect URL isn't allow-listed is the Site URL,
// the root. Those requests are left exactly as they were.
test("Supabase auth returns to the root are left alone", () => {
  for (const q of [
    "?code=abc",
    "?token_hash=abc&type=email",
    "?error=access_denied",
    "?error_code=otp_expired",
    "?error_description=Email+link+is+invalid",
  ]) {
    assert.equal(get(`/${q}`), null, q);
  }
});

test("everything else is untouched", () => {
  for (const p of [
    "/dashboard",
    "/teams",
    "/start",
    "/guides",
    "/guides/programming",
    "/for-teams/anything",
    "/login",
    "/signup",
    "/forgot-password",
    "/account/username",
    "/account/password",
    "/auth/callback",
    "/auth/confirm",
    "/auth/verify-email/x",
    "/api/me",
    "/u/someone",
    "/leaderboard",
  ]) {
    assert.equal(get(p), null, p);
  }
});

// The loop guard: a signed-in redirect lands on a page that renders for a
// signed-in reader, not on another redirect.
test("no destination redirects again", () => {
  for (const [from, to] of Object.entries(SIGNED_IN_VERSION)) {
    assert.equal(SIGNED_IN_VERSION[to], undefined, `${from} -> ${to} chains`);
    assert.equal(SIGNED_IN_VERSION_IN_PAGE[to], undefined, `${from} -> ${to} chains through a page`);
    assert.ok(!SIGNED_OUT_ONLY.includes(to), `${from} -> ${to} is a signed-out page`);
    assert.equal(get(to), null, `${to} redirects again`);
    assert.ok(to.startsWith("/") && !to.startsWith("//"), `${to} must be a same-site path`);
  }
  assert.equal(get(SIGNED_IN_HOME), null);
});

// Pairs a page redirects itself (it needs a database read the middleware
// doesn't make). Same loop rules, and the middleware leaves them alone.
test("in-page pairs follow the same rules", () => {
  assert.equal(SIGNED_IN_VERSION_IN_PAGE["/apply/teach"], "/classes/teaching");
  const all = { ...SIGNED_IN_VERSION, ...SIGNED_IN_VERSION_IN_PAGE };
  for (const [from, to] of Object.entries(SIGNED_IN_VERSION_IN_PAGE)) {
    assert.equal(SIGNED_IN_VERSION[from], undefined, `${from} is in both lists`);
    assert.equal(all[to], undefined, `${from} -> ${to} chains`);
    assert.ok(!SIGNED_OUT_ONLY.includes(to), `${from} -> ${to} is a signed-out page`);
    assert.ok(to.startsWith("/") && !to.startsWith("//"), `${to} must be a same-site path`);
    assert.equal(get(from), null, `the middleware redirects ${from}`);
    assert.equal(get(to), null, `${to} redirects again`);
    assert.equal(signedInHref(from), from, `links to ${from} are rewritten for everyone`);
  }
});

test("the redirect is never cacheable for everyone", () => {
  const cc = SIGNED_IN_REDIRECT_CACHE_CONTROL.split(",").map((s) => s.trim());
  assert.ok(cc.includes("private"));
  assert.ok(cc.includes("no-store"));
  assert.ok(!cc.some((d) => d.startsWith("s-maxage") || d === "public"));
});

test("signed-in landing honors next", () => {
  assert.equal(signedInLanding(undefined), "/dashboard");
  assert.equal(signedInLanding("/guides/programming/java/hello"), "/guides/programming/java/hello");
  assert.equal(signedInLanding("/tools/frc-budget-calculator"), "/tools/frc-budget-calculator");
  assert.equal(signedInLanding("/teams?x=1"), "/teams?x=1");
});

test("signed-in landing skips pages that would only redirect again", () => {
  assert.equal(signedInLanding("/"), "/dashboard");
  assert.equal(signedInLanding("/for-teams"), "/teams");
  assert.equal(signedInLanding("/for-teams?ref=x"), "/teams");
  assert.equal(signedInLanding("/auth/verify-email?email=a%40b.co"), "/dashboard");
  assert.equal(signedInLanding("/signup"), "/dashboard");
  assert.equal(signedInLanding("/signup?next=/signup"), "/dashboard");
  assert.equal(signedInLanding("/login?next=/x"), "/dashboard");
  assert.equal(signedInLanding("/forgot-password"), "/dashboard");
});

test("signed-in links", () => {
  assert.equal(signedInHref("/"), "/dashboard");
  assert.equal(signedInHref("/for-teams"), "/teams");
  assert.equal(signedInHref("/guides"), "/guides");
  assert.equal(signedInHref("/leaderboard"), "/leaderboard");
});
