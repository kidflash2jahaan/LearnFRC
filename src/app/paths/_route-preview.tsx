import type { CSSProperties } from "react";
import Link from "next/link";

export type RouteStop = { deptSlug: string; label: string };

/**
 * One route, printed as a slip in the binder.
 *
 * A route is a list of places you go in order, so it is drawn the way the
 * binder draws one: a full-width hand-ruled slip split down a 2px ink rule,
 * with the pitch on the left and the actual itinerary on the right. Nothing
 * animates except the one hover the system owns.
 *
 * The whole slip is a single link, like the department cards on the wall, so
 * the target is the size of the card and a keyboard never has to walk past
 * nested links inside it. The module keeps its old filename because that is a
 * fixed path in this rebuild, not because it is still a preview of anything.
 *
 * Server Component. No state, no client bundle.
 */
export function RouteSlip({
  index,
  slug,
  title,
  description,
  stops,
  outcomeCount,
  tilt,
}: {
  index: number;
  slug: string;
  title: string;
  description: string;
  stops: RouteStop[];
  outcomeCount: number;
  /** Hand angle for this slip. Full-width paper needs a much smaller angle
      than an index card: a degree across 1280px is 22px of vertical drift. */
  tilt: string;
}) {
  const n = String(index + 1).padStart(2, "0");

  return (
    <Link
      href={`/paths/${slug}`}
      aria-label={`Open the ${title} route`}
      className="nb-box nb-tilt nb-lift group block overflow-hidden"
      style={{ "--tilt": tilt } as CSSProperties}
    >
      {/* 860px, not a Tailwind breakpoint: that is where `.nb-panel` turns its
          dividing rule from vertical to horizontal, and the columns have to
          split on the same pixel or the rule ends up on the wrong edge. */}
      <div className="grid min-[860px]:grid-cols-[1.3fr_1fr]">
        <div className="nb-panel">
          <p className="nb-slug">
            route {n} / {slug}
          </p>

          <h3 className="mt-2 text-[clamp(1.3rem,1rem+1.1vw,1.85rem)] leading-[1.02]">
            {title}
          </h3>

          <p className="mt-3 max-w-[52ch] text-[0.97rem] leading-[1.5] text-graphite">
            {description}
          </p>

          <div className="nb-hair mt-auto flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-4">
            <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="nb-count">
                {stops.length}
                <small>stops</small>
              </span>
              <span className="nb-count">
                {outcomeCount}
                <small>skills</small>
              </span>
            </span>
            <span className="nb-slug border-b-2 border-transparent font-bold text-ink group-hover:border-blue group-hover:text-blue">
              open the route
            </span>
          </div>
        </div>

        <div className="nb-panel">
          <p className="nb-slug">where it goes</p>
          <ol className="mt-2.5">
            {stops.map((stop, i) => (
              <li
                key={stop.deptSlug + i}
                className="flex items-baseline gap-3 border-b border-dashed border-rule py-2 last:border-b-0 last:pb-0"
              >
                <span className="nb-slug shrink-0 font-bold text-blue">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.92rem] font-semibold leading-snug">
                    {stop.label}
                  </span>
                  <span className="nb-slug block">dept / {stop.deptSlug}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Link>
  );
}
