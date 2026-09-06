export type HeroDept = {
  slug: string;
  name: string;
  lessons: number;
  /**
   * Accepted and ignored. Departments carry no colour and no icon in this
   * system: they are identified by their name and their mono slug. Both fields
   * stay on the type so the home page keeps compiling while it is rebuilt.
   */
  color?: string;
  icon?: string;
};

/**
 * The card taped up beside the headline: what is actually in the binder.
 *
 * The old panel was a "Season telemetry" glass instrument with a pulsing Live
 * dot and four gradient meters that swept in on load. None of that was true.
 * Nothing here is live, the numbers are the catalogue counted at build time,
 * and a green dot that blinks forever is exactly the idle motion this system
 * bans. So it is what it says it is: an index card, taped down at both ends and
 * never straightened, with the counts ruled off one under the next.
 *
 * The four biggest departments keep their share meters, because share is the
 * one thing a raw count does not tell you, and `.nb-meter` prints the number
 * beside the bar so the bar is never the only way to read it.
 *
 * Server Component. It holds no state and nothing in it animates.
 */
export function HeroPanel({
  lessonCount,
  deptCount,
  depts,
}: {
  lessonCount: number;
  deptCount: number;
  depts: HeroDept[];
}) {
  // Bar width and printed figure are the same number, so a bar can never look
  // full while the label next to it says 13%.
  const pctOf = (lessons: number) =>
    Math.round((lessons / Math.max(1, lessonCount)) * 100);

  return (
    <div className="w-full max-w-md lg:justify-self-end">
      <div className="nb-box nb-tilt-1 p-[clamp(1.2rem,2.4vw,1.7rem)]">
        <span className="nb-tape -top-3 left-[22%] rotate-[-3.6deg]" aria-hidden="true" />
        <span className="nb-tape -bottom-3 right-[16%] rotate-[2.4deg]" aria-hidden="true" />

        <p className="nb-slug border-b border-dashed border-rule pb-3">
          what is in the binder
        </p>

        {/* Plain rows rather than a dl: the label reads as one phrase with its
            figure, so splitting them into dt/dd only buys a `display:contents`
            that drops both out of the accessibility tree in some browsers. */}
        <div className="mt-1">
          <p className="flex items-baseline gap-3 py-2">
            <b className="min-w-[3.6ch] font-mono text-[clamp(1.7rem,1.1rem+1.9vw,2.5rem)] font-bold leading-none tabular-nums text-blue">
              {lessonCount.toLocaleString()}
            </b>
            <span className="text-[0.95rem]">lessons, written and reviewed</span>
          </p>
          <p className="flex items-baseline gap-3 border-t border-[rgba(22,24,27,0.13)] py-2">
            <b className="min-w-[3.6ch] font-mono text-[clamp(1.7rem,1.1rem+1.9vw,2.5rem)] font-bold leading-none tabular-nums text-blue">
              {deptCount.toLocaleString()}
            </b>
            <span className="text-[0.95rem]">departments, one per team job</span>
          </p>
        </div>

        {depts.length > 0 && (
          <div className="mt-4 border-t border-dashed border-rule pt-4">
            <p className="nb-slug">biggest departments, share of the catalogue</p>
            <ul className="mt-3 flex flex-col gap-3">
              {depts.map((d) => {
                const pct = pctOf(d.lessons);
                return (
                  <li key={d.slug}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[0.92rem] font-semibold">
                        {d.name}
                      </span>
                      <span className="nb-slug shrink-0 font-bold text-ink">
                        {pct}%
                      </span>
                    </div>
                    <span className="nb-meter mt-1.5 block h-[0.55rem]">
                      <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <p className="nb-pen mt-4 rotate-[-1.2deg] pl-2">
        built by one high&#8209;school student, working alone
      </p>
    </div>
  );
}
