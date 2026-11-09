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
