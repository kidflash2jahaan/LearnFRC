import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, STUDENT_PRESET, presetForRole } from "./presets.ts";

test("nobody waits to be let in: every preset skips the waiting room", () => {
  for (const p of PRESETS) {
    assert.equal(p.permissions.waiting_room_type, "SKIP", p.name);
    assert.equal(p.permissions.accept_waiting_requests, false, p.name);
  }
});

test("the three presets are the ones joinClass hands out", () => {
  assert.deepEqual(
    (["teacher", "student", "staff"] as const).map((r) => presetForRole(r).name),
    ["lfrc-teacher", "lfrc-student", "lfrc-staff"]
  );
  assert.deepEqual(PRESETS.map((p) => p.name).sort(), ["lfrc-staff", "lfrc-student", "lfrc-teacher"]);
});

test("going straight in changes nothing else: no student camera or screen, no RealtimeKit chat, no client kick", () => {
  assert.equal(STUDENT_PRESET.permissions.media.video.can_produce, "NOT_ALLOWED");
  assert.equal(STUDENT_PRESET.permissions.media.screenshare.can_produce, "NOT_ALLOWED");
  assert.equal(STUDENT_PRESET.permissions.show_participant_list, false);
  for (const p of PRESETS) {
    const { chat } = p.permissions;
    assert.equal(chat.private.can_send || chat.private.can_receive || chat.public.can_send, false, p.name);
    assert.equal(p.permissions.kick_participant, false, p.name);
    assert.equal(p.permissions.hidden_participant, false, p.name);
  }
});
