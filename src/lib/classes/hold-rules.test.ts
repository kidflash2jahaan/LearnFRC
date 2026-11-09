import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COPY_RETRY_MS,
  COPY_STALE_MS,
  HOLD_NOTES_TOTAL_MAX,
  PEER_RETRY_MS,
  aggregateRecordingStatus,
  appendHoldNote,
  holdExpiry,
  holdRecordingKey,
  holdRecordingPrefix,
  isHoldRestricted,
  latestCopyStates,
  laterOf,
  mergePeerReports,
  peerReportsToRetry,
  planRecordingCopies,
  summarizePeerReport,
  type HoldPeerReport,
  type SessionCopyState,
} from "./hold-rules.ts";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const ahead = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

test("a hold lasts a year, and a new event never shortens one", () => {
  assert.equal(holdExpiry(NOW).toISOString(), "2027-11-20T12:00:00.000Z");
  const later = new Date("2028-01-01T00:00:00.000Z");
  assert.equal(laterOf("2028-06-01T00:00:00.000Z", later).toISOString(), "2028-06-01T00:00:00.000Z");
  assert.equal(laterOf("2027-01-01T00:00:00.000Z", later).toISOString(), later.toISOString());
  assert.equal(laterOf(null, later), later);
});

test("restricted: a restricted review or a refusal, until released", () => {
  assert.equal(isHoldRestricted({ reason: "class_report", releasedAt: null, reviewRestricted: true }), true);
  assert.equal(isHoldRestricted({ reason: "refusal", releasedAt: null, reviewRestricted: null }), true);
  assert.equal(isHoldRestricted({ reason: "refusal", releasedAt: NOW.toISOString(), reviewRestricted: true }), false);
  assert.equal(isHoldRestricted({ reason: "ban", releasedAt: null, reviewRestricted: false }), false);
  assert.equal(isHoldRestricted({ reason: "urgent_flag", releasedAt: null, reviewRestricted: undefined }), false);
});

test("recording keys sit under one prefix per class and stay path-safe", () => {
  assert.equal(holdRecordingPrefix("c-1"), "holds/c-1/");
  assert.equal(holdRecordingKey("c-1", "s-1"), "holds/c-1/s-1.mp4");
  assert.equal(holdRecordingKey("c-1", "../x y"), "holds/c-1/.._x_y.mp4");
  assert.ok(holdRecordingKey("c/1", "s").startsWith("holds/c_1/"));
});

test("plan: copy a valid link, skip stored or running copies, back off failures, gone when expired", () => {
  const sessions = [
    { sessionId: "a", recordingUrl: "https://r/a", recordingExpiresAt: ahead(86_400_000) },
    { sessionId: "b", recordingUrl: "https://r/b", recordingExpiresAt: ahead(86_400_000) },
    { sessionId: "c", recordingUrl: "https://r/c", recordingExpiresAt: ahead(86_400_000) },
    { sessionId: "d", recordingUrl: "https://r/d", recordingExpiresAt: ago(1000) },
    { sessionId: "e", recordingUrl: null, recordingExpiresAt: null },
    { sessionId: "f", recordingUrl: "https://r/f", recordingExpiresAt: ahead(86_400_000) },
    { sessionId: "g", recordingUrl: "https://r/g", recordingExpiresAt: ahead(86_400_000) },
  ];
  const ledger = new Map<string, SessionCopyState>([
    ["b", { sessionId: "b", status: "stored", at: ago(1000) }],
    ["c", { sessionId: "c", status: "copying", at: ago(COPY_STALE_MS - 1000) }],
    ["f", { sessionId: "f", status: "failed", at: ago(COPY_RETRY_MS - 1000) }],
    ["g", { sessionId: "g", status: "copying", at: ago(COPY_STALE_MS + 1000) }],
  ]);
  const plan = Object.fromEntries(planRecordingCopies(sessions, ledger, NOW).map((p) => [p.sessionId, p]));
  assert.deepEqual(plan.a, { action: "copy", sessionId: "a", url: "https://r/a" });
  assert.equal(plan.b.action, "skip");
  assert.deepEqual(plan.c, { action: "skip", sessionId: "c", why: "in_progress" });
  assert.deepEqual(plan.d, { action: "gone", sessionId: "d" });
  assert.deepEqual(plan.e, { action: "skip", sessionId: "e", why: "no_recording" });
  assert.deepEqual(plan.f, { action: "skip", sessionId: "f", why: "backoff" });
  assert.equal(plan.g.action, "copy", "a copy stuck past 6 minutes is retried");
  const forced = planRecordingCopies(sessions, ledger, NOW, { force: true });
  assert.equal(forced.find((p) => p.sessionId === "f")?.action, "copy");
  assert.equal(forced.find((p) => p.sessionId === "b")?.action, "skip", "never re-copies a stored one");
});

test("aggregate status", () => {
  const s = (id: string, url: string | null) => ({ sessionId: id, recordingUrl: url, recordingExpiresAt: null });
  const L = (entries: [string, SessionCopyState["status"]][]) =>
    new Map(entries.map(([id, status]) => [id, { sessionId: id, status, at: NOW.toISOString() }]));
  assert.equal(aggregateRecordingStatus([], new Map()), "none");
  assert.equal(aggregateRecordingStatus([s("a", null)], new Map()), "none");
  assert.equal(aggregateRecordingStatus([s("a", "u")], new Map()), "copying");
  assert.equal(aggregateRecordingStatus([s("a", "u"), s("b", "u")], L([["a", "stored"], ["b", "stored"]])), "stored");
  assert.equal(aggregateRecordingStatus([s("a", "u"), s("b", "u")], L([["a", "stored"], ["b", "failed"]])), "failed");
  assert.equal(aggregateRecordingStatus([s("a", "u"), s("b", "u")], L([["a", "stored"], ["b", "gone"]])), "gone");
  assert.equal(aggregateRecordingStatus([s("a", "u"), s("b", "u")], L([["a", "copying"], ["b", "failed"]])), "copying");
});

test("the ledger keeps the newest entry per session", () => {
  const m = latestCopyStates([
    { created_at: "2026-11-20T10:05:00Z", detail: { sessionId: "a", status: "stored", bytes: 5 } },
    { created_at: "2026-11-20T10:00:00Z", detail: { sessionId: "a", status: "copying" } },
    { created_at: "2026-11-20T10:01:00Z", detail: { sessionId: "b", status: "failed", error: "x" } },
    { created_at: "2026-11-20T10:02:00Z", detail: { sessionId: "b", status: "bogus" } },
    { created_at: "2026-11-20T10:02:00Z", detail: null },
  ]);
  assert.equal(m.get("a")?.status, "stored");
  assert.equal(m.get("a")?.bytes, 5);
  assert.equal(m.get("b")?.status, "failed");
  assert.equal(m.get("b")?.error, "x");
  assert.equal(m.size, 2);
  const cleared = latestCopyStates([
    { created_at: "2026-11-20T10:00:00Z", detail: { sessionId: "a", status: "stored", key: "holds/c/a.mp4" } },
    { created_at: "2026-11-21T10:00:00Z", detail: { sessionId: "*", status: "deleted" } },
    { created_at: "2026-11-21T11:00:00Z", detail: { sessionId: "b", status: "failed", error: "r2_not_configured" } },
  ]);
  assert.equal(cleared.has("a"), false, "a deleted prefix clears what was stored before it");
  assert.equal(cleared.get("b")?.key, null, "no key when nothing reached the bucket");
});

test("peer reports: retry only retryable failures, after 6 hours, within 150 days", () => {
  const r = (peerId: string, ok: boolean, error: string | null, fetchedAt: string): HoldPeerReport => ({
    userId: "u", handle: "h", role: "student", sessionId: "s", peerId, fetchedAt, ok, error,
  });
  const reports = [
    r("p1", false, "not_configured", ago(PEER_RETRY_MS + 1)),
    r("p2", false, "not_configured", ago(PEER_RETRY_MS - 60_000)),
    r("p3", false, "other_app", ago(PEER_RETRY_MS + 1)),
    r("p4", true, null, ago(PEER_RETRY_MS + 1)),
    r("p5", false, "http_503", ago(PEER_RETRY_MS + 1)),
    r("p6", false, "http_404", ago(PEER_RETRY_MS + 1)),
  ];
  assert.deepEqual(peerReportsToRetry(reports, ago(86_400_000), NOW).map((x) => x.peerId), ["p1", "p5"]);
  assert.deepEqual(peerReportsToRetry(reports, ago(151 * 86_400_000), NOW), []);
  const merged = mergePeerReports(
    [r("p4", true, null, ago(1)), r("p1", false, "not_configured", ago(1))],
    [r("p4", false, "timeout", NOW.toISOString()), r("p1", true, null, NOW.toISOString()), r("p9", true, null, NOW.toISOString())]
  );
  assert.equal(merged.find((x) => x.peerId === "p4")?.ok, true, "a good report is never replaced by a failure");
  assert.equal(merged.find((x) => x.peerId === "p1")?.ok, true);
  assert.equal(merged.length, 3);
});

test("summarizePeerReport finds the documented fields wherever they sit", () => {
  const report = {
    participant: {
      peer_stats: {
        device_info: {
          browser: "Chrome",
          browser_version: "131.0",
          os: "macOS",
          os_version: "15.1",
          is_mobile: false,
          user_agent: "Mozilla/5.0",
        },
        ip_information: { ipv4: "203.0.113.9", city: "Irvine", region: "California", country: "US" },
      },
    },
  };
  assert.deepEqual(summarizePeerReport(report), {
    ip: "203.0.113.9",
    city: "Irvine",
    region: "California",
    country: "US",
    browser: "Chrome 131.0",
    os: "macOS 15.1",
    device: "desktop",
    userAgent: "Mozilla/5.0",
  });
  const empty = summarizePeerReport(null);
  assert.equal(empty.ip, null);
  assert.equal(summarizePeerReport({ a: [{ ip: "198.51.100.2" }] }).ip, "198.51.100.2");
});

test("notes: dated lines, newest last, capped", () => {
  const one = appendHoldNote(null, "NCMEC report filed", "@dhiren", NOW);
  assert.equal(one, "Nov 20, 2026 (@dhiren): NCMEC report filed");
  const two = appendHoldNote(one, "  police asked for records  ", null, NOW);
  assert.equal(two, `${one}\nNov 20, 2026: police asked for records`);
  assert.equal(appendHoldNote("x".repeat(HOLD_NOTES_TOTAL_MAX), "more", null, NOW), null);
});
