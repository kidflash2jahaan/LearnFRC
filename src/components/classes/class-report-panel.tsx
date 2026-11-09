"use client";

import * as React from "react";
import { ReportControl } from "@/components/safety/report-control";
import { CLASS_REPORT_REASONS } from "@/lib/report-reasons";
import type { ClassRosterEntry } from "@/lib/classes/types";

/**
 * "Report someone" for a class (section 10.2): the room bar, the "You were
 * removed" screen and /classes/[id] for 30 days after the class. Lists the
 * roster (classRoster in src/lib/app/classes.ts: everyone who's been in the
 * class, by username and role, the teacher first), then files through
 * ReportControl with contentKind "class", the class-only reasons first.
 *
 * Who may report whom is decided by fileReport on the server, not here: the
 * class's teacher by anyone signed in, anyone else only by someone who was
 * in the class too, within 30 days. The person reported is never told who
 * sent it.
 */
export type ClassReportPanelProps = {
  classId: string;
  roster: ClassRosterEntry[];
  /** The signed-in viewer's id, so they aren't listed to report themselves. */
  viewerId: string | null;
  /** Where the panel is: the room, the removed screen, or the class page. */
  surface: "room" | "removed" | "class_page";
  /** The class is live now (reports say LIVE CLASS). */
  liveNow?: boolean;
  /** The button text. Default "Report someone". */
  label?: string;
};

const ROLE_WORD: Record<ClassRosterEntry["role"], string> = {
  teacher: " (teacher)",
  staff: " (LearnFRC staff)",
  student: "",
};

export function ClassReportPanel({
  classId,
  roster,
  viewerId,
  surface,
  liveNow = false,
  label = "Report someone",
}: ClassReportPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [who, setWho] = React.useState("");
  const uid = React.useId();
  const pickId = `${uid}-who`;
  const people = roster.filter((r) => r.userId !== viewerId && !!r.username);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="nb-btn-ghost nb-btn-sm">
        {label}
      </button>
    );
  }

  return (
    <div className="nb-box w-full max-w-[36rem] p-[clamp(1rem,2.4vw,1.4rem)]">
      <p className="nb-slug">report / someone in this class</p>
      {people.length === 0 ? (
        <p className="mt-2 text-[0.95rem] leading-snug">
          There&rsquo;s nobody else from this class to report yet.
        </p>
      ) : (
        <div className="nb-field mt-3">
          <label htmlFor={pickId} className="nb-label">
            Who?
          </label>
          <select
            id={pickId}
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className="nb-input nb-select"
          >
            <option value="" disabled>
              Pick a person
            </option>
            {people.map((p) => (
              <option key={p.userId} value={p.username!}>
                @{p.username}
                {ROLE_WORD[p.role]}
              </option>
            ))}
          </select>
          <p className="nb-hint">
            {liveNow || surface === "room"
              ? "A report from a class that's on goes to LearnFRC's safety lead straight away. You can also leave the class at any time."
              : "Reports from a class go to LearnFRC's safety lead and are read within 24 hours."}
          </p>
        </div>
      )}

      {who ? (
        <div className="mt-3">
          <ReportControl
            key={who}
            reasons={CLASS_REPORT_REASONS}
            username={who}
            contentKind="class"
            contentId={classId}
            surface="class"
            label={`Report @${who}`}
            what={`@${who} in this class`}
            defaultOpen
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setWho("");
        }}
        className="nb-btn-ghost nb-btn-sm mt-4"
      >
        Close
      </button>
    </div>
  );
}
