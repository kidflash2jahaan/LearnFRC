import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIGNED_IN_HOME,
  SIGNED_IN_REDIRECT_CACHE_CONTROL,
  SIGNED_IN_VERSION,
  SIGNED_OUT_ONLY,
  signedInHref,
  signedInLanding,
  signedInRedirect,
} from "./signed-in-routes.ts";
import { safeNextPath } from "./safe-next.ts";

const get = (path: string, method = "GET") => {
  const url = new URL(path, "https://learnfrc.com");
  return signedInRedirect({ method, pathname: url.pathname, searchParams: url.searchParams });
};

test("the pairs", () => {
  assert.equal(get("/"), "/dashboard");
  assert.equal(get("/for-teams"), "/teams");
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

test("the query string is dropped", () => {
  assert.equal(get("/for-teams?ref=someone"), "/teams");
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
    // signUp's Server Action redirects here, and Next renders it inside the
    // action's response with the browser's cookies, so a session left on that
    // browser must not turn "check your inbox" into someone's dashboard.
    "/auth/verify-email",
    "/auth/verify-email?email=a%40b.co",
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
    assert.ok(!SIGNED_OUT_ONLY.includes(to), `${from} -> ${to} is a signed-out page`);
    assert.equal(get(to), null, `${to} redirects again`);
    assert.ok(to.startsWith("/") && !to.startsWith("//"), `${to} must be a same-site path`);
  }
  assert.equal(get(SIGNED_IN_HOME), null);
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
  assert.equal(signedInLanding("/guides/../for-teams"), "/teams");
  assert.equal(signedInLanding("/signup"), "/dashboard");
  assert.equal(signedInLanding("/signup?next=/signup"), "/dashboard");
  assert.equal(signedInLanding("/login?next=/x"), "/dashboard");
  assert.equal(signedInLanding("/forgot-password"), "/dashboard");
  assert.equal(signedInLanding("/x/../login"), "/dashboard");
});

// /signup hands this to redirect(), which puts it in the Location header as
// it is, and Node throws (a 500) on a header character above U+00FF.
test("signed-in landing is always safe to put in a Location header", () => {
  assert.equal(signedInLanding("/guides/\u00e9t\u00e9"), "/guides/%C3%A9t%C3%A9");
  assert.equal(signedInLanding("/guides?q=\u65e5\u672c"), "/guides?q=%E6%97%A5%E6%9C%AC");
  assert.equal(signedInLanding("/guides/a b#part 2"), "/guides/a%20b#part%202");
  assert.equal(signedInLanding("/guides/already%20encoded"), "/guides/already%20encoded");
  assert.equal(signedInLanding("/guides/x#top"), "/guides/x#top");
  for (const next of ["/\u65e5\u672c", "/x?y=\u{1F916}", "/\u00fc#\u00e9", "/a\u0000b", "/a\u2028b"]) {
    const to = signedInLanding(next);
    assert.match(to, /^\/[\x21-\x7e]*$/, `${JSON.stringify(next)} -> ${to}`);
    assert.ok(!to.startsWith("//"), to);
  }
});

// safeNextPath lets these through (they start with "/" but not "//" or
// "/\"), and resolving the dots turns each one into "//evil.com", which a
// browser reads as another site.
test("signed-in landing never leaves the site", () => {
  for (const next of [
    "/.//evil.com",
    "/x/..//evil.com",
    "/./\\evil.com",
    "/%2e//evil.com",
    "/./%2e//evil.com",
    "/x/../..//evil.com/path?q=1#h",
  ]) {
    assert.equal(signedInLanding(next), "/dashboard", JSON.stringify(next));
  }
});

// /signup and /account/username both run a raw `next` through safeNextPath
// and then signedInLanding before redirect().
const landing = (raw: string) => signedInLanding(safeNextPath(raw));

test("raw next: encoded for the Location header", () => {
  assert.equal(landing("/guides/\u00e9"), "/guides/%C3%A9");
  assert.equal(landing("/\u65e5\u672c"), "/%E6%97%A5%E6%9C%AC");
  assert.equal(landing("/x?y=\u{1F916}"), "/x?y=%F0%9F%A4%96");
  assert.equal(landing("/guides/a b?q=c d"), "/guides/a%20b?q=c%20d");
  assert.equal(landing("/a%00b"), "/a%00b");
  assert.equal(landing("/a\u0000b"), "/a%00b");
  assert.equal(landing("/a\u2028b"), "/a%E2%80%A8b");
  assert.equal(landing("/guides/%C3%A9t%C3%A9?q=%E6%97%A5"), "/guides/%C3%A9t%C3%A9?q=%E6%97%A5");
  // Normal values are unchanged.
  assert.equal(landing("/start?change=1"), "/start?change=1");
  assert.equal(landing("/guides/programming/java/hello"), "/guides/programming/java/hello");
});

test("raw next: never another site", () => {
  for (const raw of [
    "//evil.com",
    "/.//evil.com",
    "/\\evil.com",
    "/./\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(landing(raw), "/dashboard", JSON.stringify(raw));
  }
});

// Even without safeNextPath in front, signedInLanding stays on the site.
test("signed-in landing refuses other sites on its own", () => {
  for (const next of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)"]) {
    assert.equal(signedInLanding(next), "/dashboard", JSON.stringify(next));
  }
});

// The username step's loop check sees the resolved path.
test("dots resolve before the username step checks for itself", () => {
  assert.equal(landing("/x/../account/username?next=/y"), "/account/username?next=/y");
});

test("signed-in links", () => {
  assert.equal(signedInHref("/"), "/dashboard");
  assert.equal(signedInHref("/for-teams"), "/teams");
  assert.equal(signedInHref("/guides"), "/guides");
  assert.equal(signedInHref("/leaderboard"), "/leaderboard");
});
