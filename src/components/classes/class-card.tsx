import Link from "next/link";
import { LocalTime } from "@/components/classes/local-time";
import { TEACHER_LABEL } from "@/lib/classes/constants";
import type { ClassListing } from "@/lib/classes/types";

/**
 * One class in a listing (classes-design.md section 11): /classes, the
 * homepage section and the "Live now" band.
 *
 * Two shapes from one set of facts:
 *   - ClassCard, a boxed card for a grid (the homepage's next three, the
 *     live band);
 *   - ClassRow, a ruled ledger row for the day-by-day list on /classes,
 *     drawn like the lesson lists (`.nb-row`), where the day is already
 *     in the heading above it.
 *
 * WHO TAUGHT IT. The teacher's @handle shows only when the page passes
 * `showTeacher` AND the listing carries one, and listUpcomingClasses only
 * fills it in for a signed-in viewer. Signed out, and on the homepage
 * (which stays cached), every card says "Taught by an FRC student". Never a
 * team number.
 *
 * No hooks, so a Server Component can render it; the time inside is the
 * client LocalTime.
 */

export type ClassCardProps = {
  c: ClassListing;
  /** Show the teacher's @handle when the listing has one (signed-in pages only). */
  showTeacher?: boolean;
  className?: string;
};

/** "60 min", "1 hr 30 min". */
export function lengthLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "9 of 15 seats left", or "Full". */
export function seatsLabel(seats: ClassListing["seats"]): string {
  if (seats.left <= 0) return "Full";
  return `${seats.left} of ${seats.capacity} seat${seats.capacity === 1 ? "" : "s"} left`;
}

function teacherLine(c: ClassListing, showTeacher: boolean): string {
  return showTeacher && c.teacher ? `Taught by @${c.teacher.username}` : TEACHER_LABEL;
}

/** The site-relative link (listing urls are absolute, for the app). */
const hrefFor = (c: ClassListing) => `/classes/${c.id}`;

function Tags({ c }: { c: ClassListing }) {
  if (c.status !== "live" && !c.enrolled) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {c.status === "live" && (
        <span className="nb-tag" data-on="">
          Live now
        </span>
      )}
      {c.enrolled && <span className="nb-tag">You&rsquo;re in</span>}
    </span>
  );
}

export function ClassCard({ c, showTeacher = false, className }: ClassCardProps) {
  return (
    <Link
      href={hrefFor(c)}
      className={`nb-box-sm nb-lift flex h-full flex-col gap-2 p-[clamp(1rem,2.2vw,1.35rem)] text-inherit no-underline ${className ?? ""}`}
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <LocalTime iso={c.startsAt} className="nb-slug text-ink" />
        <span className="nb-slug">{lengthLabel(c.durationMinutes)}</span>
      </span>
      <h3 className="text-[1.12rem] leading-snug">{c.title}</h3>
      {c.topic && <span className="text-[0.92rem] text-graphite">On {c.topic.title}</span>}
      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2">
        <span className="text-[0.9rem]">{teacherLine(c, showTeacher)}</span>
        <span className="nb-slug">{seatsLabel(c.seats)}</span>
      </span>
      <Tags c={c} />
    </Link>
  );
}

export function ClassRow({ c, showTeacher = false }: ClassCardProps) {
  return (
    <Link href={hrefFor(c)} className="nb-row">
      <span className="flex flex-col gap-1">
        <LocalTime iso={c.startsAt} end={c.endsAt} style="range" className="font-bold text-ink" />
        <span className="nb-slug">{lengthLabel(c.durationMinutes)}</span>
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-[1.08rem] leading-snug">{c.title}</h3>
        {c.topic && <span className="text-[0.92rem] text-graphite">On {c.topic.title}</span>}
        <span className="text-[0.9rem]">{teacherLine(c, showTeacher)}</span>
        <Tags c={c} />
      </div>
      <span className="nb-slug whitespace-nowrap">{seatsLabel(c.seats)}</span>
    </Link>
  );
}
