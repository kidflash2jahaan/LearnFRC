"use client";

import { stubCalled } from "@/lib/classes/stub";
import type { ClassRosterEntry } from "@/lib/classes/types";

/**
 * "Report someone" for a class (section 10.2): the room bar, the "You were
 * removed" screen and /classes/[id] for 30 days after the class. Lists the
 * roster (classRoster in src/lib/app/classes.ts, by username and role) and
 * files through ReportControl with contentKind "class".
 *
 * Owned by the room-and-chat package, which replaces this stub and keeps the
 * props. The stub renders nothing.
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

export function ClassReportPanel(props: ClassReportPanelProps) {
  stubCalled("ClassReportPanel", { classId: props.classId, surface: props.surface });
  return null;
}
