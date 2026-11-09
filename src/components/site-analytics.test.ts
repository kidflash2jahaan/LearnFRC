import { test } from "node:test";
import assert from "node:assert/strict";
import { REDACTED_PATH_PREFIXES, analyticsBeforeSend, redactAnalyticsUrl } from "./site-analytics-url.ts";

const SITE = "https://learnfrc.com";

test("the three private prefixes are the ones the design names", () => {
  assert.deepEqual([...REDACTED_PATH_PREFIXES], ["/classes/parent/", "/letters/", "/verify/"]);
});

test("a parent's page is cut back to /classes/parent/", () => {
  assert.equal(redactAnalyticsUrl(`${SITE}/classes/parent`), `${SITE}/classes/parent/`);
  assert.equal(redactAnalyticsUrl(`${SITE}/classes/parent/`), `${SITE}/classes/parent/`);
  assert.equal(
    redactAnalyticsUrl(`${SITE}/classes/parent/open/3q2-7xYz_tokenvalue`),
    `${SITE}/classes/parent/`
  );
  assert.equal(redactAnalyticsUrl(`${SITE}/classes/parent?token=abc#done`), `${SITE}/classes/parent/`);
});

test("letters and their verify pages lose the code", () => {
  assert.equal(redactAnalyticsUrl(`${SITE}/letters/LF-ABCDE-12345`), `${SITE}/letters/`);
  assert.equal(redactAnalyticsUrl(`${SITE}/letters/LF-ABCDE-12345/print?x=1`), `${SITE}/letters/`);
  assert.equal(redactAnalyticsUrl(`${SITE}/verify/LF-ABCDE-12345`), `${SITE}/verify/`);
  assert.equal(redactAnalyticsUrl(`${SITE}/verify/LF-ABCDE-12345#qr`), `${SITE}/verify/`);
  assert.equal(redactAnalyticsUrl(`${SITE}/verify`), `${SITE}/verify/`);
});

test("a typo'd capital doesn't leak the code either", () => {
  assert.equal(redactAnalyticsUrl(`${SITE}/Verify/LF-ABCDE-12345`), `${SITE}/verify/`);
  assert.equal(redactAnalyticsUrl(`${SITE}/LETTERS/LF-ABCDE-12345`), `${SITE}/letters/`);
});

test("the origin is kept, whatever it is", () => {
  assert.equal(
    redactAnalyticsUrl("http://localhost:3417/verify/LF-ABCDE-12345"),
    "http://localhost:3417/verify/"
  );
  assert.equal(
    redactAnalyticsUrl("https://learnfrc-git-release.vercel.app/letters/LF-1"),
    "https://learnfrc-git-release.vercel.app/letters/"
  );
});

test("every other page is sent exactly as it was", () => {
  for (const url of [
    `${SITE}/`,
    `${SITE}/classes`,
    `${SITE}/classes/0b7d0c5e-3a52-4f7e-9d6b-1d2a3b4c5d6e`,
    `${SITE}/classes/0b7d0c5e-3a52-4f7e-9d6b-1d2a3b4c5d6e/room`,
    `${SITE}/classes/ready`,
    `${SITE}/classes/teaching/letter`,
    `${SITE}/classes/parents-guide`,
    `${SITE}/apply/teach`,
    `${SITE}/verifying-things`,
    `${SITE}/blog/frc-can-bus?utm_source=x#top`,
    `${SITE}/guides/electrical-wiring/can/letters`,
  ]) {
    assert.equal(redactAnalyticsUrl(url), url, url);
  }
});

test("bare paths work too", () => {
  assert.equal(redactAnalyticsUrl("/verify/LF-ABCDE-12345?x=1"), "/verify/");
  assert.equal(redactAnalyticsUrl("/classes/parent#x"), "/classes/parent/");
  assert.equal(redactAnalyticsUrl("/guides"), "/guides");
  assert.equal(redactAnalyticsUrl(""), "");
});

test("beforeSend keeps the event and only changes its url", () => {
  const view = { type: "pageview" as const, url: `${SITE}/verify/LF-ABCDE-12345` };
  assert.deepEqual(analyticsBeforeSend(view), { type: "pageview", url: `${SITE}/verify/` });
  // The original event isn't mutated.
  assert.equal(view.url, `${SITE}/verify/LF-ABCDE-12345`);

  const vital = { type: "vital" as const, url: `${SITE}/letters/LF-ABCDE-12345`, route: "/letters/[code]" };
  assert.deepEqual(analyticsBeforeSend(vital), { type: "vital", url: `${SITE}/letters/`, route: "/letters/[code]" });

  const plain = { type: "pageview" as const, url: `${SITE}/guides` };
  assert.equal(analyticsBeforeSend(plain), plain, "an untouched event is passed through as is");
  // Never drops an event (null would stop it being counted at all).
  assert.notEqual(analyticsBeforeSend(view), null);
});
