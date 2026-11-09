"use client";

import * as React from "react";
import { RealtimeKitProvider, useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import { RtkMeeting, createDefaultConfig, type UIConfig } from "@cloudflare/realtimekit-react-ui";
import type { ClassRole, ClassRosterEntry } from "@/lib/classes/types";
import { MediaLog } from "./_media-log";
import { RoomControls } from "./_controls";

/**
 * The meeting itself (section 6.5), loaded only in the browser by _room.tsx
 * (next/dynamic with ssr: false), since RealtimeKit's UI Kit is web
 * components that need a DOM.
 *
 * Cameras and mics start off (initMeeting's defaults, and switched off again
 * before the join in case the defaults are ignored). RtkMeeting joins by
 * itself, with no setup screen, because the pre-join screen already ran.
 * What students can do is set by their preset on Cloudflare's side
 * (src/lib/classes/presets.ts: no camera, no screen share, no RealtimeKit
 * chat, polls, plugins or breakout rooms); the buttons for things nobody in a
 * class uses are also taken out of the UI here, so none of them shows.
 */

/**
 * UI Kit elements nobody in a class gets: our chat panel replaces theirs.
 *
 * The meeting title too. On Cloudflare's side it's "LearnFRC class <id>"
 * (meetingConfigFor in src/lib/classes/realtimekit.ts), because Cloudflare
 * keeps meeting records and the class's own title stays off them, so the UI
 * Kit's header would show everyone a raw id. Our bar above the meeting
 * already names the class.
 */
const HIDDEN_ELEMENTS = new Set([
  "rtk-meeting-title",
  "rtk-chat-toggle",
  "rtk-polls-toggle",
  "rtk-plugins-toggle",
  "rtk-ai-toggle",
  "rtk-breakout-rooms-toggle",
  "rtk-recording-toggle",
  "rtk-livestream-toggle",
  "rtk-caption-toggle",
  "rtk-transcripts",
]);

function withoutHidden(list: unknown[]): unknown[] {
  return list.filter((item) => {
    const name = Array.isArray(item) ? item[0] : item;
    return !(typeof name === "string" && HIDDEN_ELEMENTS.has(name));
  });
}

/** The UI Kit's default layout with the hidden elements taken out everywhere they appear. */
export function roomUiConfig(): UIConfig {
  const config = createDefaultConfig();
  const root = (config.root ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(root)) {
    const name = key.split(/[.[]/)[0];
    if (HIDDEN_ELEMENTS.has(name)) {
      delete root[key];
      continue;
    }
    if (Array.isArray(value)) {
      root[key] = withoutHidden(value);
    } else if (value && typeof value === "object") {
      const v = value as { children?: unknown[]; add?: unknown[] };
      if (Array.isArray(v.children)) v.children = withoutHidden(v.children);
      if (Array.isArray(v.add)) v.add = withoutHidden(v.add);
    }
  }
  return config;
}

export type MeetingHandle = { leave: () => Promise<void> };

export default function Meeting({
  authToken,
  classId,
  role,
  roster,
  controlsOpen,
  onMeeting,
  onLeft,
}: {
  authToken: string;
  classId: string;
  role: ClassRole;
  roster: ClassRosterEntry[];
  controlsOpen: boolean;
  onMeeting: (handle: MeetingHandle | null) => void;
  onLeft: (state: string) => void;
}) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const config = React.useMemo(() => roomUiConfig(), []);
  const started = React.useRef<string | null>(null);
  // Whether this component is mounted right now. The join below runs once per
  // token, so in React's development double-run of effects the second run
  // returns early; a per-run "cancelled" flag would then drop the result of
  // the only join and leave the room on "connecting" forever.
  const mounted = React.useRef(false);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (started.current === authToken) return;
    started.current = authToken;
    initMeeting({ authToken, defaults: { audio: false, video: false } })
      .then(async (m) => {
        if (!m) return;
        // Belt and braces: everyone starts muted with no camera, even if the
        // defaults above were ignored.
        try {
          if (m.self.audioEnabled) await m.self.disableAudio();
          if (m.self.videoEnabled) await m.self.disableVideo();
        } catch {
          // Nothing was on to turn off.
        }
        if (mounted.current) setReady(true);
      })
      .catch(() => {
        if (mounted.current) setFailed(true);
      });
  }, [authToken, initMeeting]);

  React.useEffect(() => {
    if (!meeting) return;
    onMeeting({ leave: () => meeting.leave() });
    const handler = (payload: { state: string }) => {
      // The SDK reconnects by itself after a dropped connection.
      if (payload?.state === "disconnected") return;
      onLeft(payload?.state ?? "left");
    };
    meeting.self.on("roomLeft", handler);
    return () => {
      meeting.self.off("roomLeft", handler);
      onMeeting(null);
    };
  }, [meeting, onMeeting, onLeft]);

  if (failed) {
    return (
      <div className="flex h-full min-h-[22rem] items-center justify-center p-6">
        <p className="max-w-[36ch] text-center">
          Couldn&rsquo;t open the room. Check your connection, then leave and join again.
        </p>
      </div>
    );
  }

  const connecting = (
    <div className="flex h-full min-h-[22rem] items-center justify-center border-2 border-ink p-6">
      <p className="nb-slug">room / connecting</p>
    </div>
  );

  return (
    <RealtimeKitProvider value={meeting} fallback={connecting}>
      {ready && meeting ? (
        <>
          <MediaLog classId={classId} />
          {controlsOpen && (role === "teacher" || role === "staff") ? (
            <RoomControls classId={classId} role={role} roster={roster} />
          ) : null}
          <div className="h-[min(72dvh,46rem)] min-h-[22rem] overflow-hidden border-2 border-ink bg-ink">
            <RtkMeeting mode="fill" meeting={meeting} showSetupScreen={false} config={config} leaveOnUnmount />
          </div>
        </>
      ) : (
        connecting
      )}
    </RealtimeKitProvider>
  );
}
