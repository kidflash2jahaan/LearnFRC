// RealtimeKit webhook payloads for the webhooks-and-review tests, in the
// shapes Cloudflare documents (classes-design.md 6.8, [S2]): most events carry
// a `meeting` object, the participant events a `participant`, recordings a
// `recording`, and meeting.chatSynced puts meetingId and sessionId at the top
// level. Times are ISO strings; ids are whatever the test passes.
//
// sign.mjs signs them with a key pair made on the spot. The verifier accepts
// that key only under `node --test` (RTK_TEST_PUBLIC_KEY), so these never work
// against a real deployment.

const iso = (t) => new Date(t).toISOString();

function meeting({ meetingId, sessionId, startedAt, endedAt, createdAt }) {
  return {
    id: meetingId,
    sessionId,
    title: `LearnFRC class fixture`,
    status: endedAt ? "INACTIVE" : "ACTIVE",
    createdAt: iso(createdAt ?? startedAt),
    startedAt: iso(startedAt),
    ...(endedAt ? { endedAt: iso(endedAt) } : {}),
    organizedBy: { id: "fixture-org", name: "LearnFRC" },
  };
}

export function meetingStarted(o) {
  return { event: "meeting.started", meeting: meeting(o) };
}

export function participantJoined(o) {
  return {
    event: "meeting.participantJoined",
    meeting: meeting(o),
    participant: {
      peerId: o.peerId,
      userDisplayName: o.displayName ?? "@fixture",
      customParticipantId: o.userId,
      joinedAt: iso(o.joinedAt),
    },
  };
}

export function participantLeft(o) {
  return {
    event: "meeting.participantLeft",
    meeting: meeting({ ...o, endedAt: undefined }),
    participant: {
      peerId: o.peerId,
      userDisplayName: o.displayName ?? "@fixture",
      customParticipantId: o.userId,
      joinedAt: iso(o.joinedAt),
      leftAt: iso(o.leftAt),
    },
  };
}

export function meetingEnded(o) {
  return { event: "meeting.ended", meeting: meeting(o), reason: o.reason ?? "ALL_PARTICIPANTS_LEFT" };
}

export function recordingUploaded(o) {
  return {
    event: "recording.statusUpdate",
    recording: {
      id: o.recordingId ?? "fixture-recording",
      recordingId: o.recordingId ?? "fixture-recording",
      status: "UPLOADED",
      downloadUrl: o.downloadUrl,
      audioDownloadUrl: o.downloadUrl.replace(/\.mp4$/, ".aac"),
      downloadUrlExpiry: iso(o.expiresAt),
      startedTime: iso(o.startedAt),
      stoppedTime: iso(o.endedAt),
      fileSize: 1024,
      outputFileName: "fixture.mp4",
      meetingId: o.meetingId,
      recordingDuration: 60,
      organizationId: o.organizationId ?? "fixture-org",
      roomUUID: "fixture-room",
    },
    meeting: meeting(o),
  };
}

export function transcriptReady(o) {
  return {
    event: "meeting.transcript",
    meeting: meeting(o),
    transcriptDownloadUrl: o.url,
    transcriptDownloadUrlExpiry: iso(Date.parse(o.endedAt) + 7 * 86_400_000),
  };
}

/** meeting.chatSynced: meetingId and sessionId at the top level, no meeting object. */
export function chatSynced(o) {
  return {
    event: "meeting.chatSynced",
    title: "LearnFRC class fixture",
    meetingId: o.meetingId,
    sessionId: o.sessionId,
    createdAt: iso(o.startedAt),
    startedAt: iso(o.startedAt),
    endedAt: iso(o.endedAt),
    chatDownloadUrl: "https://example.com/fixture-chat.csv",
    chatDownloadUrlExpiry: iso(Date.parse(o.endedAt) + 86_400_000),
    organizedBy: { id: "fixture-org", name: "LearnFRC" },
  };
}

/**
 * A transcript download in Cloudflare's JSON shape: lines are
 * { at (seconds from the session start), userId, name, text }.
 */
export function transcriptJson(lines) {
  return JSON.stringify(
    lines.map((l, i) => ({
      startTime: Math.round(l.at * 1000),
      endTime: Math.round(l.at * 1000) + 2500,
      sentence: l.text,
      peerData: {
        id: `peer-${l.userId?.slice(0, 8) ?? "x"}-${i}`,
        userId: "rtk-user",
        displayName: l.name ?? "@fixture",
        cpi: l.userId,
        joinedAt: new Date(0).toISOString(),
        leftAt: "",
      },
    }))
  );
}

/** The same lines in Cloudflare's CSV shape (start ms, peer, user, cpi, name, text). */
export function transcriptCsv(lines) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return lines.map((l, i) => [Math.round(l.at * 1000), `peer-${i}`, "rtk-user", l.userId, l.name ?? "@fixture", l.text].map(q).join(",")).join("\n");
}
