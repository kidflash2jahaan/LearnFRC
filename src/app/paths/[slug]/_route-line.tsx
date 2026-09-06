import Link from "next/link";

/**
 * One stop on a route, printed as a line of the carbon-copy log.
 *
 * The old file drew a decorative gradient spine down the side of the itinerary
 * with a spring animation. The binder does not draw a spine: an ordered list of
 * places you go is a log, and the system already owns that shape in `nb-list` /
 * `nb-row`. So this is one line of it. The mono stop number and the department
 * slug sit in the left column where the log's identifiers always go, the actual
 * instruction sits in the middle, and the whole line is the link.
 *
 * The file keeps its name because that path is fixed in this rebuild.
 *
 * Server Component. The row carries its own hover in CSS.
 */
export function RouteStopRow({
  index,
  deptSlug,
  deptName,
  label,
  note,
}: {
  /** Zero-based position on the route. Printed one-based and zero-padded. */
  index: number;
  deptSlug: string;
  /** Real department name where the catalogue could be read, else the step
      label, so the row never prints an empty second line. */
  deptName: string;
  label: string;
  note: string;
}) {
  return (
    <li>
      <Link
        href={`/guides/${deptSlug}`}
        className="nb-row"
        aria-label={`Stop ${index + 1}, ${label}, in ${deptName}`}
      >
        <span>
          <span className="nb-count block">
            {String(index + 1).padStart(2, "0")}
            <small>stop</small>
          </span>
          <span className="mt-1.5 block text-[0.95rem] font-semibold leading-snug">
            {deptName}
          </span>
          <span className="nb-slug block">dept / {deptSlug}</span>
        </span>

        <span>
          <h3 className="text-[clamp(1.1rem,0.95rem+0.8vw,1.5rem)] leading-[1.1]">
            {label}
          </h3>
          <p className="mt-2 max-w-[62ch] text-[0.96rem] leading-[1.5] text-graphite">
            {note}
          </p>
        </span>

        <span className="nb-slug whitespace-nowrap">open the guide</span>
      </Link>
    </li>
  );
}
