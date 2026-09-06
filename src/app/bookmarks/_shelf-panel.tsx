export type ShelfRow = { slug: string; name: string; count: number };

/**
 * The index slip clipped to the front of the folder: which departments the
 * saved lessons came from, and how long the whole stack takes to read.
 *
 * WHAT THIS USED TO BE: a floating glass panel that spring-drew one gradient
 * bar per department, each in that department's own hue, with a pulsing "Live"
 * dot in the corner. Three things wrong with it here. The bars encoded a
 * quantity ("3 saved") that is already two characters long, so the bar was
 * slower to read than the number. The hues came from `deptMeta`, and this
 * system identifies a department by its name and its slug, never by a colour.
 * And a "Live" indicator on a list that only changes when you change it is
 * decoration pretending to be status.
 *
 * So it is an index: department on the left, count on the right, leader dots
 * between them, the way a contents page is set. The two figures that are not
 * per-department (how many, how long) are ruled off underneath.
 *
 * Server Component. It was a Client Component only to run the springs.
 */
export function ShelfIndex({
  shelves,
  readMinutes,
  total,
}: {
  /** Departments with at least one saved lesson, most-saved first. */
  shelves: ShelfRow[];
  /** Summed `estimated_minutes` across the saved lessons. 0 hides the figure. */
  readMinutes: number;
  total: number;
}) {
  const empty = total === 0;

  return (
    <aside
      aria-labelledby="shelf-index-heading"
      className="nb-box nb-tilt-2 w-full max-w-[24rem] p-[clamp(1.1rem,2.4vw,1.6rem)]"
    >
      <span className="nb-tape -top-3 left-[22%] rotate-[-3.6deg]" aria-hidden="true" />
      <span className="nb-tape -bottom-3 right-[16%] rotate-[2.4deg]" aria-hidden="true" />

      <h2 id="shelf-index-heading" className="nb-slug border-b border-dashed border-rule pb-2.5">
        the index
      </h2>

      {empty ? (
        <p className="mt-3 text-[0.95rem] leading-snug text-graphite">
          Nothing filed yet. Bookmark a lesson and its department shows up on
          this slip.
        </p>
      ) : (
        <dl className="mt-3">
          {shelves.map((s) => (
            <div
              key={s.slug}
              className="flex items-baseline gap-2 py-1.5 [&+div]:border-t [&+div]:border-dashed [&+div]:border-rule"
            >
              <dt className="min-w-0 shrink text-[0.94rem] leading-snug">
                {s.name}
              </dt>
              {/* The leader dots are a border, not characters, so a screen
                  reader never has to say "dot dot dot dot" between the
                  department and its count. */}
              <span
                aria-hidden="true"
                className="mb-[0.28em] min-w-4 flex-1 border-b border-dotted border-rule"
              />
              <dd className="nb-slug shrink-0 font-bold text-ink">{s.count}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="nb-hair mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 pt-3.5">
        <p className="nb-count">
          {total}
          <small>{total === 1 ? "saved" : "saved"}</small>
        </p>
        {readMinutes > 0 && (
          <p className="nb-count">
            {readMinutes}
            <small>min to read</small>
          </p>
        )}
      </div>
    </aside>
  );
}
