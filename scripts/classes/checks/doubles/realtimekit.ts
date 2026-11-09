// Test double for src/lib/classes/realtimekit.ts, for the pages package's
// checks without Cloudflare keys. Everything is the real module except the
// two calls scheduling and cancelling make, which are recorded instead of
// sent, so a check can prove a refusal happened before any RealtimeKit call
// and walk the success path with a fake meeting id. The real calls are the
// "needs keys" checks. Only scripts/classes/checks/pages.check.ts loads this,
// through a resolve hook.

import { randomUUID } from "node:crypto";
import type { MeetingConfig, RtkCallOptions, RtkMeeting, RtkResult } from "../../../../src/lib/classes/realtimekit.ts";

export * from "../../../../src/lib/classes/realtimekit.ts";

export type RtkCall = { fn: string; args: unknown[] };

const g = globalThis as unknown as { __rtkCalls?: RtkCall[] };
export function rtkCalls(): RtkCall[] {
  g.__rtkCalls ??= [];
  return g.__rtkCalls;
}

export async function createMeeting(cfg: MeetingConfig): Promise<RtkResult<RtkMeeting>> {
  rtkCalls().push({ fn: "createMeeting", args: [cfg] });
  return { ok: true, data: { id: `lftest-meeting-${randomUUID()}`, title: cfg.title, status: "ACTIVE" } };
}

export async function setMeetingStatus(
  meetingId: string,
  status: "ACTIVE" | "INACTIVE",
  opts: RtkCallOptions = {}
): Promise<RtkResult<RtkMeeting>> {
  rtkCalls().push({ fn: "setMeetingStatus", args: [meetingId, status, opts] });
  return { ok: true, data: { id: meetingId, status } };
}
