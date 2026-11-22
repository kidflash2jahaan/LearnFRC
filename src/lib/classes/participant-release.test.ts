import { test } from "node:test";
import assert from "node:assert/strict";
import { dropWith, releaseWith, type DeleteResult } from "./participant-release.ts";

// records what each step did
function steps(del: DeleteResult | Error, queueOk: boolean | Error = true, withRow = true) {
  const calls: string[] = [];
  const queued: string[] = [];
  return {
    calls,
    queued,
    steps: {
      del: async () => {
        calls.push("del");
        if (del instanceof Error) throw del;
        return del;
      },
      queue: async (error: string) => {
        calls.push("queue");
        if (queueOk instanceof Error) throw queueOk;
        if (queueOk) queued.push(error);
        return queueOk;
      },
      forget: withRow
        ? async () => {
            calls.push("forget");
          }
        : undefined,
    },
  };
}

test("a delete that works forgets the id and queues nothing", async () => {
  const s = steps({ ok: true });
  assert.deepEqual(await releaseWith(s.steps), { state: "deleted", error: "" });
  assert.deepEqual(s.calls, ["del", "forget"]);
});

test("a 404 counts as deleted: it's gone already", async () => {
  const s = steps({ ok: false, status: 404, error: "not found" });
  assert.deepEqual(await releaseWith(s.steps), { state: "deleted", error: "" });
  assert.deepEqual(s.calls, ["del", "forget"]);
});

test("a delete that fails is queued, and only then is the id forgotten", async () => {
  const s = steps({ ok: false, status: 503, error: "upstream down" });
  assert.deepEqual(await releaseWith(s.steps), { state: "queued", error: "503 upstream down" });
  assert.deepEqual(s.calls, ["del", "queue", "forget"]);
  assert.deepEqual(s.queued, ["503 upstream down"]);
});

test("a delete and a queue that both fail keep the id", async () => {
  const s = steps({ ok: false, status: 500, error: "boom" }, false);
  assert.deepEqual(await releaseWith(s.steps), { state: "kept", error: "500 boom" });
  assert.deepEqual(s.calls, ["del", "queue"], "never forgets");
});

test("a delete that throws is treated as failed and queued", async () => {
  const s = steps(new Error("socket hang up"));
  assert.deepEqual(await releaseWith(s.steps), { state: "queued", error: "0 socket hang up" });
  assert.deepEqual(s.calls, ["del", "queue", "forget"]);
});

test("a queue that throws keeps the id", async () => {
  const s = steps({ ok: false, status: 0, error: "not_configured" }, new Error("db down"));
  assert.deepEqual(await releaseWith(s.steps), { state: "kept", error: "0 not_configured" });
  assert.deepEqual(s.calls, ["del", "queue"]);
});

test("another app's meeting (the client refuses at once) is queued", async () => {
  const s = steps({ ok: false, status: 0, error: "other_app" });
  assert.equal((await releaseWith(s.steps)).state, "queued");
  assert.deepEqual(s.queued, ["0 other_app"]);
});

test("with no row to forget, a failed delete is still queued", async () => {
  const s = steps({ ok: false, status: 502, error: "bad gateway" }, true, false);
  assert.deepEqual(await releaseWith(s.steps), { state: "queued", error: "502 bad gateway" });
  assert.deepEqual(s.calls, ["del", "queue"]);
});

test("a forget that throws doesn't fail the release", async () => {
  const r = await releaseWith({
    del: async () => ({ ok: true }),
    queue: async () => true,
    forget: async () => {
      throw new Error("db down");
    },
  });
  assert.deepEqual(r, { state: "deleted", error: "" });
});

test("a long error is cut to 300 characters for the queue", async () => {
  const s = steps({ ok: false, status: 500, error: "x".repeat(400) });
  const r = await releaseWith(s.steps);
  assert.equal(r.error.length, 300);
  assert.equal(s.queued[0].length, 300);
});

/* ── dropWith: someone who may be in the call now ─────────────────── */

// records each step, with a kick
function dropSteps(del: DeleteResult | Error, kick: DeleteResult | Error, queueOk = true) {
  const s = steps(del, queueOk);
  return {
    calls: s.calls,
    queued: s.queued,
    steps: {
      ...s.steps,
      kick: async () => {
        s.calls.push("kick");
        if (kick instanceof Error) throw kick;
        return kick;
      },
    },
  };
}

const down = { ok: false, status: 503, error: "upstream down" } as const;

test("a duplicate connection whose delete fails is kicked and queued, and the row keeps the id", async () => {
  const s = dropSteps(down, { ok: true });
  assert.deepEqual(await dropWith(s.steps, { keepUntilDeleted: true }), {
    video: "kicked",
    queued: true,
    error: "503 upstream down",
  });
  assert.deepEqual(s.calls, ["del", "kick", "queue"], "kicked now, and never forgotten");
  assert.deepEqual(s.queued, ["503 upstream down"]);
});

test("a duplicate connection whose delete works forgets the id without a kick", async () => {
  const s = dropSteps({ ok: true }, { ok: true });
  assert.deepEqual(await dropWith(s.steps, { keepUntilDeleted: true }), { video: "deleted", queued: false, error: "" });
  assert.deepEqual(s.calls, ["del", "forget"]);
});

test("a duplicate connection keeps the id even when the kick and the queue fail", async () => {
  const s = dropSteps(down, { ok: false, status: 500, error: "kick failed" }, false);
  assert.deepEqual(await dropWith(s.steps, { keepUntilDeleted: true }), {
    video: "failed",
    queued: false,
    error: "503 upstream down",
  });
  assert.deepEqual(s.calls, ["del", "kick", "queue"]);
});

test("a removal whose delete fails is kicked, queued, and then forgotten", async () => {
  const s = dropSteps(down, { ok: true });
  assert.deepEqual(await dropWith(s.steps, { keepUntilDeleted: false }), {
    video: "kicked",
    queued: true,
    error: "503 upstream down",
  });
  assert.deepEqual(s.calls, ["del", "kick", "queue", "forget"]);
});

test("a kick with no live session (404) counts as kicked", async () => {
  const s = dropSteps(down, { ok: false, status: 404, error: "no session" });
  assert.equal((await dropWith(s.steps, { keepUntilDeleted: false })).video, "kicked");
  assert.deepEqual(s.calls, ["del", "kick", "queue", "forget"]);
});

test("a removal whose kick fails keeps the id, so Remove again retries both", async () => {
  const s = dropSteps(down, { ok: false, status: 500, error: "kick failed" });
  assert.deepEqual(await dropWith(s.steps, { keepUntilDeleted: false }), {
    video: "failed",
    queued: true,
    error: "503 upstream down",
  });
  assert.deepEqual(s.calls, ["del", "kick", "queue"]);
});

test("a kick that throws counts as failed", async () => {
  const s = dropSteps(down, new Error("socket hang up"));
  assert.equal((await dropWith(s.steps, { keepUntilDeleted: false })).video, "failed");
  assert.deepEqual(s.calls, ["del", "kick", "queue"]);
});

test("with no kick to try (no keys), a removal is queued and forgotten, a duplicate kept", async () => {
  const removal = steps(down);
  assert.deepEqual(await dropWith(removal.steps, { keepUntilDeleted: false }), {
    video: "skipped",
    queued: true,
    error: "503 upstream down",
  });
  assert.deepEqual(removal.calls, ["del", "queue", "forget"]);
  const dupe = steps(down);
  assert.equal((await dropWith(dupe.steps, { keepUntilDeleted: true })).video, "skipped");
  assert.deepEqual(dupe.calls, ["del", "queue"]);
});
