"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CLASS_NOTICE_VERSION } from "@/lib/classes/notice";
import { RecordingBadge } from "@/components/classes/recording-badge";
import { ClassReportPanel } from "@/components/classes/class-report-panel";
import {
  endClassAction,
  joinClassAction,
  roomRosterAction,
  roomStatusAction,
} from "@/app/actions/class-room";
import type { JoinGrant, RoomView } from "@/lib/app/classes-room";
import type { ClassEndReason, ClassStatus } from "@/lib/classes/types";
import { Prejoin } from "./_prejoin";
import { ChatPanel } from "./_chat-panel";
import type { MeetingHandle } from "./_meeting";

/**
 * The class room, in the browser (section 6.5).
 *
 *   prejoin  the notice, the rules and "Join class" (_prejoin.tsx)
 *   in       our bar (the recording badge, Report someone, Class controls
 *            for the teacher and staff, Leave), the meeting (_meeting.tsx,
 *            browser only) and the chat panel (_chat-panel.tsx)
 *   left     after Leave, or a drop: join again
 *   removed  "You were removed from this class." plus Report someone,
 *            because a removed student may need to report who removed them
 *   ended    why the class ended ("This class was ended for a safety check."),
 *            with Report someone for anyone who was in it, or, once they've
 *            reported, "You've reported this class."
 *
 * Every browser also sets a timer for the hard end and ends the class then
 * ("Class time is up."); the server's sweep is what guarantees it.
 */

const Meeting = dynamic(() => import("./_meeting"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[22rem] items-center justify-center p-6">
      <p className="nb-slug">room / loading</p>
    </div>
  ),
});

type Phase =
  | { kind: "prejoin" }
  | { kind: "in"; grant: JoinGrant }
  | { kind: "left"; why: string }
  | { kind: "removed" }
  | { kind: "ended"; reason: ClassEndReason | null; canceled?: boolean };

const OPEN: readonly ClassStatus[] = ["scheduled", "live"];

function endedMessage(reason: ClassEndReason | null, canceled?: boolean): string {
  if (canceled) return "This class was canceled.";
  switch (reason) {
    case "reports":
      return "This class was ended for a safety check.";
    case "time":
      return "Class time is up.";
    case "teacher":
      return "The teacher ended the class.";
    case "admin":
      return "LearnFRC staff ended the class.";
    case "paused":
      return "LearnFRC paused every class for a moment, so this one ended.";
    case "teacher_gone":
      return "The class ended because the teacher left.";
    default:
      return "This class has ended.";
  }
}

function initialPhase(v: RoomView): Phase {
  if (v.removed) return { kind: "removed" };
  if (v.status === "canceled") return { kind: "ended", reason: null, canceled: true };
  if (!OPEN.includes(v.status)) return { kind: "ended", reason: v.endReason };
  return { kind: "prejoin" };
}

export function Room(view: RoomView) {
  const { classId } = view;
  const [phase, setPhase] = React.useState<Phase>(() => initialPhase(view));
  const [refusal, setRefusal] = React.useState<{ reason: string; message: string; opensAt?: string } | null>(
    view.refusal
  );
  const [joining, setJoining] = React.useState(false);
  const [roster, setRoster] = React.useState(view.roster);
  const [controlsOpen, setControlsOpen] = React.useState(false);
  // The page's copy of these was read before this browser joined: a student
  // on their first visit wasn't a participant yet, so it said they couldn't
  // report. Joining and leaving update them.
  const [canReport, setCanReport] = React.useState(view.canReport);
  const [reported, setReported] = React.useState(view.reported);
  // Whether the class is on, for the report panel's line about where a
  // report goes. The page's copy can be from before the class went live.
  const [live, setLive] = React.useState(view.liveNow);
  const meetingRef = React.useRef<MeetingHandle | null>(null);

  const refreshRoster = React.useCallback(() => {
    roomRosterAction(classId)
      .then((r) => {
        if (r.length) setRoster(r);
      })
      .catch(() => {});
  }, [classId]);

  async function join(accepted: boolean) {
    setJoining(true);
    try {
      const r = await joinClassAction(classId, accepted ? CLASS_NOTICE_VERSION : "");
      if (r.ok) {
        setRefusal(null);
        // They're a participant now, so they can report from this class.
        setCanReport(true);
        setLive(true);
        setPhase({ kind: "in", grant: r });
        return;
      }
      if (r.reason === "removed") setPhase({ kind: "removed" });
      else if (r.reason === "over" || r.reason === "closed") setPhase({ kind: "ended", reason: null });
      else if (r.reason === "canceled") setPhase({ kind: "ended", reason: null, canceled: true });
      else setRefusal({ reason: r.reason, message: r.error, opensAt: r.opensAt });
    } catch {
      setRefusal({ reason: "rtk", message: "Couldn't reach LearnFRC. Check your connection and try again." });
    } finally {
      setJoining(false);
    }
  }

  const onMeeting = React.useCallback((h: MeetingHandle | null) => {
    meetingRef.current = h;
  }, []);

  /** After the meeting ends for this browser, find out why. */
  const onLeft = React.useCallback(
    (why: string) => {
      roomStatusAction(classId)
        .then((s) => {
          if (s.status) {
            setCanReport(s.canReport);
            setReported(s.reported);
            setLive(s.status === "live");
          }
          if (s.removed) setPhase({ kind: "removed" });
          else if (s.status === "canceled") setPhase({ kind: "ended", reason: null, canceled: true });
          else if (s.status && !OPEN.includes(s.status)) setPhase({ kind: "ended", reason: s.endReason });
          else setPhase({ kind: "left", why });
        })
        .catch(() => setPhase({ kind: "left", why }));
      refreshRoster();
    },
    [classId, refreshRoster]
  );

  // Every browser ends the class at its hard end.
  const hardEndAt = phase.kind === "in" ? phase.grant.hardEndAt : null;
  React.useEffect(() => {
    if (!hardEndAt) return;
    const ms = Math.min(Math.max(0, Date.parse(hardEndAt) - Date.now()), 2 ** 31 - 1);
    const t = window.setTimeout(() => {
      void endClassAction(classId, "time").finally(() => {
        void meetingRef.current?.leave().catch(() => {});
        setPhase({ kind: "ended", reason: "time" });
      });
    }, ms);
    return () => window.clearTimeout(t);
  }, [hardEndAt, classId]);

  // Each phase is its own screen, and a new screen opens at its top. "Join
  // class" sits at the bottom of the long pre-join page, and the browser kept
  // that scroll offset when the room replaced it, so the room opened scrolled
  // down, with our bar and the top of the video above the window (and the
  // short "ended" screen could open the same way). Before the new screen
  // paints, and only when the screen changes: scrolling within one is the
  // person's, and nothing here moves it.
  const shownKind = React.useRef(phase.kind);
  React.useLayoutEffect(() => {
    if (shownKind.current === phase.kind) return;
    shownKind.current = phase.kind;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [phase.kind]);

  // New people show up in the report panel and the controls as they arrive.
  const inRoom = phase.kind === "in";
  React.useEffect(() => {
    if (!inRoom) return;
    const first = window.setTimeout(refreshRoster, 5_000);
    const every = window.setInterval(refreshRoster, 45_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [inRoom, refreshRoster]);

  const reportPanel = (surface: "room" | "after" | "removed", liveNow: boolean, label?: string) => (
    <ClassReportPanel
      classId={classId}
      roster={roster}
      viewerId={view.viewerId}
      surface={surface}
      liveNow={liveNow}
      label={label}
    />
  );

  if (phase.kind === "prejoin") {
    return (
      <Prejoin
        title={view.title}
        teacherUsername={view.teacherUsername}
        role={view.role}
        displayName={view.displayName}
        classId={classId}
        joining={joining}
        refusal={refusal}
        onJoin={(accepted) => void join(accepted)}
      />
    );
  }

  if (phase.kind !== "in") {
    const heading =
      phase.kind === "removed"
        ? "You were removed from this class."
        : phase.kind === "ended"
          ? phase.reason === "teacher" && view.role === "teacher"
            ? "You ended the class."
            : endedMessage(phase.reason, phase.canceled)
          : phase.why === "kicked"
            ? "You were disconnected from the class."
            : "You left the class.";
    // The words and the report button have to agree: "report it here" only
    // when the button is there, and someone who already reported is told so.
    const sub =
      phase.kind === "removed"
        ? "You can't rejoin it or read its chat. If something happened that LearnFRC should know about, report it here."
        : phase.kind === "ended"
          ? reported
            ? "You've reported this class. LearnFRC is looking at it."
            : phase.reason === "reports"
              ? canReport
                ? "LearnFRC is looking at what happened. If you saw something, you can report it here too."
                : "LearnFRC is looking at what happened."
              : view.role === "teacher"
                ? "Thanks for teaching it. LearnFRC reviews every class, and your teaching page shows when it's approved."
                : "Thanks for being part of it."
          : phase.why === "kicked"
            ? "That happens when you join from another tab or device. Join again to come back here."
            : "You can join again while the class is on.";
    return (
      <div className="nb-wrap max-w-[46rem] pb-[clamp(3rem,6vw,4.5rem)] pt-[clamp(2rem,4.5vw,3.2rem)]">
        <p className="nb-marker">live class / {view.title}</p>
        <h1 className="mt-2 text-[clamp(1.9rem,1.2rem+2.4vw,2.8rem)] leading-tight">{heading}</h1>
        <p className="nb-lede mt-3 max-w-[56ch]">{sub}</p>
        <div className="mt-6 flex flex-wrap items-start gap-3">
          {phase.kind === "left" ? (
            <button type="button" className="nb-btn" onClick={() => setPhase({ kind: "prejoin" })}>
              Join again
            </button>
          ) : null}
          <Link href={`/classes/${classId}`} className="nb-btn-ghost">
            Back to the class page
          </Link>
        </div>
        {phase.kind === "removed" || canReport ? (
          <div className="mt-6">
            {reportPanel(
              phase.kind === "removed" ? "removed" : "after",
              phase.kind !== "ended" && live,
              reported && phase.kind === "ended" ? "Report someone else" : undefined
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const { grant } = phase;
  const canControl = grant.role === "teacher" || grant.role === "staff";
  return (
    <div className="nb-wrap pb-10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-2 border-ink pb-3">
        <div className="min-w-0">
          <p className="nb-slug truncate">live class / {grant.title}</p>
          <div className="mt-1">
            <RecordingBadge />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canControl ? (
            <button
              type="button"
              className="nb-btn-ghost nb-btn-sm"
              aria-expanded={controlsOpen}
              onClick={() => setControlsOpen((o) => !o)}
            >
              {controlsOpen ? "Hide class controls" : "Class controls"}
            </button>
          ) : null}
          <button
            type="button"
            className="nb-btn nb-btn-sm"
            onClick={() => {
              const h = meetingRef.current;
              if (h) void h.leave().catch(() => setPhase({ kind: "left", why: "left" }));
              else setPhase({ kind: "left", why: "left" });
            }}
          >
            Leave
          </button>
        </div>
      </div>

      <div className="mt-3">{reportPanel("room", true)}</div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Meeting
            authToken={grant.authToken}
            classId={classId}
            role={grant.role}
            roster={roster}
            controlsOpen={controlsOpen}
            onMeeting={onMeeting}
            onLeft={onLeft}
          />
        </div>
        <ChatPanel classId={classId} viewerId={view.viewerId} hiddenSenderIds={view.hiddenSenderIds} />
      </div>
      <p className="nb-hint mt-3">
        You&rsquo;re in as <b>{grant.displayName}</b>. Everyone in the class sees your username.
      </p>
    </div>
  );
}
