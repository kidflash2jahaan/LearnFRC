import type { CSSProperties } from "react";
import { DepartmentCard } from "@/components/department-card";

export type WallDept = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  moduleCount: number;
  lessonCount: number;
};

/**
 * Column spans for the wall, in the order the cards go up.
 *
 * Four rows of twelve, so the pattern tiles cleanly and no two neighbours are
 * the same width. Reading a wall of eleven identical rectangles is work; a wall
 * where the widths vary has an obvious scanning order, which is the whole point
 * of a contents page.
 */
const CYCLE = [5, 4, 3, 3, 4, 5, 4, 5, 3, 5, 3, 4];

/**
 * Assign a span to every card, then let the last card in the bottom row absorb
 * whatever is left of the twelve.
 *
 * Grid auto-placement pushes a card to the next row when it does not fit in the
 * space remaining, so this walk has to model the same wrap, or the widened card
 * would land on a row it was not measured for. Without the widening the bottom
 * row ends in a gap that reads as a missing card rather than as a ragged edge.
 */
export function spansFor(count: number): number[] {
  const spans = Array.from({ length: count }, (_, i) => CYCLE[i % CYCLE.length]);
  let used = 0;
  for (const span of spans) {
    if (used + span > 12) used = 0;
    used += span;
  }
  if (spans.length > 0 && used < 12) spans[spans.length - 1] += 12 - used;
  return spans;
}

/**
 * The wall: every department as an index card taped up, widths varying, none of
 * them straightened.
 *
 * An ordered list, because the order is real. It is the order the catalogue is
 * stored in, the order the ItemList structured data on the page declares, and
 * the order a rookie is meant to read it in: the foundations first.
 *
 * Server Component. The card carries its own hover in CSS, so nothing here
 * needs to run on the client.
 */
export function CatalogueWall({
  departments,
  progress,
  className,
}: {
  departments: WallDept[];
  /** Per-department completion, keyed by id. Absent for a signed-out reader. */
  progress?: Record<string, number>;
  className?: string;
}) {
  const spans = spansFor(departments.length);

  return (
    // Both breakpoints are written as `min-[...]` on purpose. Tailwind emits
    // every arbitrary min-width variant BEFORE the named ones (sm/md/lg), so
    // `md:grid-cols-2` would land later in the sheet than
    // `min-[1080px]:grid-cols-12` and win at every width above 1080px. The wall
    // then had two explicit columns with `span 5` items generating implicit
    // ones, which is how eleven cards ended up ragged. Same family, same order.
    <ol
      className={[
        "grid list-none grid-cols-1 gap-[clamp(0.85rem,1.7vw,1.35rem)] p-0",
        "min-[768px]:grid-cols-2 min-[1080px]:grid-cols-12",
        className ?? "",
      ].join(" ")}
    >
      {departments.map((d, i) => (
        <li
          key={d.slug}
          className="min-[1080px]:[grid-column:var(--span)]"
          style={{ "--span": `span ${spans[i]}` } as CSSProperties}
        >
          <DepartmentCard
            slug={d.slug}
            name={d.name}
            tagline={d.tagline}
            moduleCount={d.moduleCount}
            lessonCount={d.lessonCount}
            progressPct={progress?.[d.id]}
            index={i + 1}
          />
        </li>
      ))}
    </ol>
  );
}
