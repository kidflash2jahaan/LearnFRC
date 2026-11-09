"use client";

import { ClassRow } from "@/components/classes/class-card";
import { useClassTimeZone } from "@/components/classes/local-time";
import { classTimeParts, dayKey, dayLabel } from "@/lib/classes/class-time";
import type { ClassListing } from "@/lib/classes/types";

/**
 * Upcoming classes, grouped by day (/classes).
 *
 * A day depends on the reader's time zone: a 5 PM Pacific class is already
 * tomorrow in London. The server can't know the zone, so the server render
 * (and hydration) groups by Pacific days, the same zone LocalTime shows
 * before hydration, and the browser regroups by its own days right after.
 * For most readers nothing moves.
 */
export function ClassDayList({ classes, showTeacher }: { classes: ClassListing[]; showTeacher: boolean }) {
  const timeZone = useClassTimeZone();
  const groups: { key: string; label: string; items: ClassListing[] }[] = [];
  for (const c of classes) {
    const p = classTimeParts(c.startsAt, timeZone);
    const key = p ? dayKey(p) : "unknown";
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: p ? dayLabel(p) : "Upcoming", items: [] };
      groups.push(g);
    }
    g.items.push(c);
  }
  return (
    <div className="flex flex-col gap-[clamp(1.6rem,3.4vw,2.4rem)]">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          {/* Not a heading: each row's title is the h3, and the row CSS
              underlines that h3 on hover. The section carries the label. */}
          <p className="nb-slug mb-2 font-bold text-ink">{g.label}</p>
          <div className="nb-list">
            {g.items.map((c) => (
              <ClassRow key={c.id} c={c} showTeacher={showTeacher} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
