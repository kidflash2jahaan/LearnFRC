import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./safe-next.ts";

test("same-site paths pass", () => {
  assert.equal(safeNextPath("/dashboard"), "/dashboard");
  assert.equal(safeNextPath("/classes/teaching/letter?x=1"), "/classes/teaching/letter?x=1");
});

test("other sites and odd values don't", () => {
  for (const n of ["//t.me/maya", "/\\t.me", "/\t/t.me", "/\n/wa.me/1", "https://evil.example", "dashboard", "", null, undefined]) {
    assert.equal(safeNextPath(n), undefined, JSON.stringify(n));
  }
});

// The property the auth routes depend on: they redirect to
// new URL(next, origin), and the URL parser drops tabs and newlines and reads
// a backslash as "/", so the check has to hold after the parser has had its go.
test("whatever comes back stays on the site", () => {
  for (const n of [
    "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\t\\evil.com", "//evil.com",
    "/\\evil.com", "https://evil.com", " //evil.com", "/dashboard", "/lessons/x?y=1",
  ]) {
    const url = new URL(safeNextPath(n) ?? "/dashboard", "https://learnfrc.com");
    assert.equal(url.origin, "https://learnfrc.com", JSON.stringify(n));
  }
});
