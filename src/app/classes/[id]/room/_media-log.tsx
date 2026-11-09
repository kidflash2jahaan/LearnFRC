"use client";

import * as React from "react";
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";
import { MEDIA_LOG_LIMITS, type MediaKindName, type MediaLogEvent } from "@/lib/classes/media";

/**
 * The media logger (section 6.5). The AI review can't see video, so every
 * browser in the room reports who has a camera or a screen share on, its own
 * and everyone else's, to POST /api/classes/[id]/media-log: batched, every
 * 15 seconds, and once more on pagehide (keepalive). Because every browser
 * reports, one tampered client can't hide a teacher's camera.
 *
 * People are identified by RealtimeKit's customParticipantId, which is our
 * user id. When this browser stops watching (leaving, closing the tab), it
 * reports everything it saw on as off, which ends its own observation; other
 * browsers' reports carry on (src/lib/classes/media.ts unions them).
 *
 * Renders nothing.
 */

type Seen = { customParticipantId?: string; videoEnabled?: boolean; screenShareEnabled?: boolean };
type Handler = (...args: unknown[]) => void;
type Emitter = { on(event: string, fn: Handler): unknown; off(event: string, fn: Handler): unknown };
type Joined = Emitter & { toArray(): Seen[] };

export function MediaLog({ classId }: { classId: string }) {
  const { meeting } = useRealtimeKitMeeting();

  React.useEffect(() => {
    if (!meeting) return;
    const url = `/api/classes/${encodeURIComponent(classId)}/media-log`;
    const self = meeting.self as unknown as Emitter & Seen & { roomJoined?: boolean };
    const joined = meeting.participants.joined as unknown as Joined;
    const state = new Map<string, boolean>();
    let queue: MediaLogEvent[] = [];

    const record = (subject: string | undefined, kind: MediaKindName, on: boolean) => {
      if (!subject) return;
      const key = `${subject}|${kind}`;
      const before = state.get(key);
      if (before === on) return;
      state.set(key, on);
      // First sighting and it's off: nothing happened worth logging.
      if (before === undefined && !on) return;
      queue.push({ subject, kind, on, at: new Date().toISOString() });
      if (queue.length > MEDIA_LOG_LIMITS.maxEvents * 2) queue = queue.slice(-MEDIA_LOG_LIMITS.maxEvents);
    };
    const see = (p: Seen) => {
      record(p.customParticipantId, "camera", !!p.videoEnabled);
      record(p.customParticipantId, "screenshare", !!p.screenShareEnabled);
    };
    const snapshot = () => {
      see(self);
      for (const p of joined.toArray()) see(p);
    };
    const stopWatching = () => {
      for (const [key, on] of state) {
        if (!on) continue;
        const [subject, kind] = key.split("|");
        record(subject, kind as MediaKindName, false);
      }
    };
    const flush = (keepalive = false) => {
      if (queue.length === 0) return;
      const batch = queue.slice(0, MEDIA_LOG_LIMITS.maxEvents);
      queue = queue.slice(batch.length);
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
        credentials: "same-origin",
        keepalive,
      })
        .then((res) => {
          // A server hiccup: try again next time. A refusal (4xx) won't change.
          if (res.status >= 500) queue = [...batch, ...queue];
        })
        .catch(() => {
          queue = [...batch, ...queue];
        });
    };

    const onSelfVideo: Handler = (payload) =>
      record(self.customParticipantId, "camera", !!(payload as { videoEnabled?: boolean })?.videoEnabled);
    const onSelfShare: Handler = (payload) =>
      record(self.customParticipantId, "screenshare", !!(payload as { screenShareEnabled?: boolean })?.screenShareEnabled);
    const onVideo: Handler = (p, payload) =>
      record(
        (p as Seen).customParticipantId,
        "camera",
        !!((payload as { videoEnabled?: boolean })?.videoEnabled ?? (p as Seen).videoEnabled)
      );
    const onShare: Handler = (p, payload) =>
      record(
        (p as Seen).customParticipantId,
        "screenshare",
        !!((payload as { screenShareEnabled?: boolean })?.screenShareEnabled ?? (p as Seen).screenShareEnabled)
      );
    const onJoin: Handler = (p) => see(p as Seen);
    const onLeave: Handler = (p) => {
      record((p as Seen).customParticipantId, "camera", false);
      record((p as Seen).customParticipantId, "screenshare", false);
    };
    const onRoomJoined: Handler = () => snapshot();
    const onRoomLeft: Handler = () => {
      stopWatching();
      flush(true);
    };
    const onPageHide = () => {
      stopWatching();
      flush(true);
    };

    self.on("videoUpdate", onSelfVideo);
    self.on("screenShareUpdate", onSelfShare);
    self.on("roomJoined", onRoomJoined);
    self.on("roomLeft", onRoomLeft);
    joined.on("videoUpdate", onVideo);
    joined.on("screenShareUpdate", onShare);
    joined.on("participantJoined", onJoin);
    joined.on("participantLeft", onLeave);
    window.addEventListener("pagehide", onPageHide);
    if (self.roomJoined) snapshot();
    const timer = window.setInterval(() => flush(), MEDIA_LOG_LIMITS.flushEveryMs);

    return () => {
      self.off("videoUpdate", onSelfVideo);
      self.off("screenShareUpdate", onSelfShare);
      self.off("roomJoined", onRoomJoined);
      self.off("roomLeft", onRoomLeft);
      joined.off("videoUpdate", onVideo);
      joined.off("screenShareUpdate", onShare);
      joined.off("participantJoined", onJoin);
      joined.off("participantLeft", onLeave);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(timer);
      stopWatching();
      flush(true);
    };
  }, [meeting, classId]);

  return null;
}
