import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eventTimeMs,
  isEmptyTranscriptFile,
  isRecordingReady,
  isStale,
  meetingIdOf,
  parseCsv,
  parseTranscriptFile,
  sessionIdOf,
  wordCount,
} from "./webhook-events.ts";

const NOW = Date.parse("2026-11-20T03:00:00Z");

test("meeting and session ids come from the meeting object or the top level", () => {
  assert.equal(meetingIdOf({ meeting: { id: "m1", sessionId: "s1" } }), "m1");
  assert.equal(sessionIdOf({ meeting: { id: "m1", sessionId: "s1" } }), "s1");
  // meeting.chatSynced shape: no meeting object.
  const top = { event: "meeting.chatSynced", meetingId: "m2", sessionId: "s2" };
  assert.equal(meetingIdOf(top), "m2");
  assert.equal(sessionIdOf(top), "s2");
  assert.equal(meetingIdOf({ recording: { meetingId: "m3" } }), "m3");
  assert.equal(meetingIdOf({}), null);
  assert.equal(meetingIdOf({ meeting: { id: "  " } }), null);
});

test("each event's own time, and the 7-day freshness check", () => {
  const joined = {
    event: "meeting.participantJoined",
    meeting: { id: "m", startedAt: "2026-11-20T01:00:00Z" },
    participant: { joinedAt: "2026-11-20T01:05:00Z" },
  };
  assert.equal(eventTimeMs(joined), Date.parse("2026-11-20T01:05:00Z"));
  const left = { event: "meeting.participantLeft", participant: { joinedAt: "2026-11-20T01:05:00Z", leftAt: "2026-11-20T01:50:00Z" } };
  assert.equal(eventTimeMs(left), Date.parse("2026-11-20T01:50:00Z"));
  const ended = { event: "meeting.ended", meeting: { startedAt: "2026-11-20T01:00:00Z", endedAt: "2026-11-20T02:00:00Z" } };
  assert.equal(eventTimeMs(ended), Date.parse("2026-11-20T02:00:00Z"));
  const rec = { event: "recording.statusUpdate", recording: { startedTime: "2026-11-20T01:00:00Z", stoppedTime: "2026-11-20T02:01:00Z" } };
  assert.equal(eventTimeMs(rec), Date.parse("2026-11-20T02:01:00Z"));
  const chat = { event: "meeting.chatSynced", meetingId: "m", endedAt: "2026-11-20T02:00:00Z" };
  assert.equal(eventTimeMs(chat), Date.parse("2026-11-20T02:00:00Z"));
  assert.equal(eventTimeMs({ event: "meeting.started" }), null);

  assert.equal(isStale(ended, NOW), false);
  const old = { event: "meeting.ended", meeting: { endedAt: new Date(NOW - 8 * 86_400_000).toISOString() } };
  assert.equal(isStale(old, NOW), true);
  assert.equal(isStale({ event: "meeting.started" }, NOW), false, "no time: can't call it stale");
});

test("recording readiness", () => {
  assert.equal(isRecordingReady("UPLOADED"), true);
  assert.equal(isRecordingReady("uploaded"), true);
  assert.equal(isRecordingReady("RECORDING"), false);
  assert.equal(isRecordingReady(undefined), false);
});

test("JSON transcripts (Cloudflare's documented shape)", () => {
  const file = JSON.stringify([
    { startTime: 5000, endTime: 7500, sentence: "Second line", peerData: { id: "p2", userId: "u", displayName: "@sam", cpi: "s1", joinedAt: "", leftAt: "" } },
    { startTime: 1000, endTime: 2500, sentence: "Hello everyone", peerData: { id: "p1", displayName: "@maya (teacher)", cpi: "t" } },
    { startTime: 9000, endTime: 9500, sentence: "   ", peerData: { id: "p1", cpi: "t" } },
  ]);
  const lines = parseTranscriptFile(file);
  assert.deepEqual(lines, [
    { t0: 1, t1: 2.5, peerId: "p1", cpi: "t", displayName: "@maya (teacher)", text: "Hello everyone" },
    { t0: 5, t1: 7.5, peerId: "p2", cpi: "s1", displayName: "@sam", text: "Second line" },
  ]);
  assert.equal(wordCount(lines), 4);
});

test("JSON lines, wrapped objects and epoch timestamps", () => {
  const start = Date.parse("2026-11-20T01:00:00Z");
  const jsonl = [
    JSON.stringify({ startTime: start + 3000, endTime: start + 4000, sentence: "b", peerData: { cpi: "s1" } }),
    JSON.stringify({ startTime: start + 1000, endTime: start + 2000, sentence: "a", peerData: { cpi: "t" } }),
  ].join("\n");
  const lines = parseTranscriptFile(jsonl, start);
  assert.deepEqual(lines.map((l) => [l.t0, l.text]), [[1, "a"], [3, "b"]]);
  const wrapped = JSON.stringify({ transcript: [{ startTime: 2000, sentence: "x", peerData: { cpi: "t" } }] });
  assert.equal(parseTranscriptFile(wrapped)[0].t0, 2);
});

test("CSV transcripts, with quotes, commas and a header row", () => {
  const csv = [
    "start,peer,user,cpi,name,text",
    '"1000","peer-123","user-456","t","@maya (teacher)","Hello everyone"',
    '"3000","peer-234","user-567","s1","@sam","Hi, I have a ""question"""',
    "",
  ].join("\r\n");
  const lines = parseTranscriptFile(csv);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[1], { t0: 3, t1: 3, peerId: "peer-234", cpi: "s1", displayName: "@sam", text: 'Hi, I have a "question"' });
  assert.deepEqual(parseCsv('a,"b,c"\n"d""e",f'), [["a", "b,c"], ['d"e', "f"]]);
});

test("an empty download means the transcript isn't ready; a header-only file is a real one", () => {
  assert.equal(isEmptyTranscriptFile(""), true);
  assert.equal(isEmptyTranscriptFile("  \n\r\n "), true);
  assert.equal(isEmptyTranscriptFile("\uFEFF\n"), true);
  assert.equal(isEmptyTranscriptFile("start,peer,user,cpi,name,text\n"), false);
  assert.equal(isEmptyTranscriptFile("[]"), false);
});

test("garbage and empty files give no lines", () => {
  assert.deepEqual(parseTranscriptFile(""), []);
  assert.deepEqual(parseTranscriptFile("not a transcript"), []);
  assert.deepEqual(parseTranscriptFile("{ broken json"), []);
});
