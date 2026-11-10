"use client";

import * as React from "react";
import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { endClassAction, removeFromClassAction } from "@/app/actions/class-room";
import { ReportControl } from "@/components/safety/report-control";
import { useArmed } from "@/components/use-armed";
import { CLASS_REPORT_REASONS } from "@/lib/report-reasons";
import type { ClassRole, ClassRosterEntry } from "@/lib/classes/types";

/**
 * "Class controls" (section 6.5), for the teacher and staff: everyone in the
 * room with Mute, Remove and Report, the waiting room with Admit, and "End
 * class for everyone".
 *
 * Mute is RealtimeKit's own (the teacher and staff presets may disable
 * someone's audio). Remove and End go through the server (removeFromClass
 * and endClass in src/lib/app/classes-room.ts), so they stick: a removed
 * student's participant is deleted, their chat stops, and they can't rejoin.
 * Remove and End arm first, like the reports desk: the first press says what
 * will happen, the second does it. They stay armed until a click elsewhere,
 * Escape or 10 seconds (useArmed, src/components/use-armed.ts).
 */

type Person = {
  id: string;
  name: string;
  customParticipantId?: string;
  audioEnabled?: boolean;
  disableAudio?: () => Promise<void>;
};

export function RoomControls({
  classId,
  role,
  roster,
}: {
  classId: string;
  role: ClassRole;
  roster: ClassRosterEntry[];
}) {
  const { meeting } = useRealtimeKitMeeting();
  const joinedMap = useRealtimeKitSelector((m) => m.participants.joined);
  const waitingMap = useRealtimeKitSelector((m) => m.participants.waitlisted);
  const joined = (joinedMap?.toArray() ?? []) as unknown as Person[];
  const waiting = (waitingMap?.toArray() ?? []) as unknown as Person[];
  const [armed, setArmed, armScope] = useArmed<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const roleOf = (userId?: string) => roster.find((r) => r.userId === userId)?.role ?? "student";
  const usernameOf = (userId?: string) => roster.find((r) => r.userId === userId)?.username ?? null;

  async function remove(p: Person) {
    const key = `remove:${p.id}`;
    if (armed !== key) {
      setArmed(key);
      return;
    }
    if (!p.customParticipantId) return;
    setArmed(null);
    setBusy(key);
    const r = await removeFromClassAction(classId, p.customParticipantId);
    setBusy(null);
    setMessage(r.ok ? `${p.name} was removed from the class.` : r.error);
  }

  async function mute(p: Person) {
    try {
      await p.disableAudio?.();
      setMessage(`${p.name} is muted.`);
    } catch {
      setMessage(`Couldn't mute ${p.name}. Try again.`);
    }
  }

  async function endForEveryone() {
    if (armed !== "end") {
      setArmed("end");
      return;
    }
    setArmed(null);
    setBusy("end");
    const r = await endClassAction(classId, role === "teacher" ? "teacher" : "admin");
    setBusy(null);
    if (!r.ok) setMessage(r.error);
  }

  return (
    <section className="nb-box mb-3 p-3" aria-label="Class controls">
      <p className="nb-slug">class controls</p>

      {waiting.length > 0 ? (
        <div className="mt-2">
          <p className="text-[0.9rem] font-bold">Waiting to come in</p>
          <ul className="mt-1 grid gap-1">
            {waiting.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">{p.name}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="nb-btn nb-btn-sm"
                    onClick={() => meeting?.participants.acceptWaitingRoomRequest(p.id)}
                  >
                    Admit
                  </button>
                  <button
                    type="button"
                    className="nb-btn-ghost nb-btn-sm"
                    disabled={busy === `remove:${p.id}` || !p.customParticipantId}
                    onClick={() => void remove(p)}
                    {...armScope}
                  >
                    {armed === `remove:${p.id}` ? "Yes, remove" : "Remove"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2">
        <p className="text-[0.9rem] font-bold">In the room</p>
        {joined.length === 0 ? (
          <p className="nb-hint mt-1">Nobody else is in the room yet.</p>
        ) : (
          <ul className="mt-1 grid gap-1">
            {joined.map((p) => {
              const r = roleOf(p.customParticipantId);
              const removable = r === "student";
              const username = usernameOf(p.customParticipantId);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words">{p.name}</span>
                  <span className="flex flex-wrap justify-end gap-2">
                    {username ? (
                      <ReportControl
                        key={username}
                        reasons={CLASS_REPORT_REASONS}
                        username={username}
                        contentKind="class"
                        contentId={classId}
                        surface="class"
                        label="Report"
                        what={`@${username} in this class`}
                      />
                    ) : null}
                    <button
                      type="button"
                      className="nb-btn-ghost nb-btn-sm"
                      disabled={!p.audioEnabled}
                      onClick={() => void mute(p)}
                    >
                      {p.audioEnabled ? "Mute" : "Muted"}
                    </button>
                    {removable ? (
                      <button
                        type="button"
                        className="nb-btn-ghost nb-btn-sm"
                        disabled={busy === `remove:${p.id}` || !p.customParticipantId}
                        aria-busy={busy === `remove:${p.id}`}
                        onClick={() => void remove(p)}
                        {...armScope}
                      >
                        {busy === `remove:${p.id}` ? "Removing" : armed === `remove:${p.id}` ? "Yes, remove" : "Remove"}
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t-2 border-ink pt-3">
        <button
          type="button"
          className="nb-btn nb-btn-sm"
          disabled={busy === "end"}
          aria-busy={busy === "end"}
          onClick={() => void endForEveryone()}
          {...armScope}
        >
          {busy === "end" ? "Ending" : armed === "end" ? "Yes, end it for everyone" : "End class for everyone"}
        </button>
      </div>

      <p role="status" className="nb-hint mt-2 empty:mt-0" {...armScope}>
        {armed?.startsWith("remove:")
          ? "One more press removes them for good: they leave the room, lose the chat and can't rejoin this class."
          : armed === "end"
            ? "One more press ends the class for everyone and closes the room."
            : (message ?? "")}
      </p>
    </section>
  );
}
