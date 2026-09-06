export type RosterMember = {
  initials: string;
  name: string;
  role: string;
  xp: number;
};

/**
 * The roster, drawn as the sign-in sheet taped to the pit wall.
 *
 * A roster is a table: rows of people, columns of the same fact about each of
 * them. The old file animated it in as a floating glass panel with a spring and
 * a stagger, which is a lot of motion for a list of four names. Here it is
 * ruled paper with a mono head, tabular figures, and two strips of tape holding
 * it down.
 *
 * The data is illustrative and says so twice: once in the head, where a reader
 * scanning the columns will see it, and once under the rule, where a reader who
 * actually read the names will. Nothing on this page shows a real member.
 *
 * Server Component.
 */
export function RosterSheet({ roster }: { roster: RosterMember[] }) {
  return (
    // MOTION: taped at both corners, so it straightens as you reach it. The
    // one motion on this half of the spread; the running text beside it is
    // read, not watched.
    <div className="nb-box nb-tilt-2 nb-straighten p-[clamp(1.1rem,2.4vw,1.6rem)]">
      <span
        className="nb-tape -top-3 left-[19%] rotate-[-3.8deg]"
        aria-hidden="true"
      />
      <span
        className="nb-tape -bottom-3 right-[15%] rotate-[2.6deg]"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-dashed border-rule pb-3">
        <p className="nb-slug text-ink">team 0000 / roster</p>
        <p className="nb-slug">example, not a real team</p>
      </div>

      {/* Four short rows will not overflow, but the head row can at 320px once
          the browser text size is turned up, and a table is exactly the thing
          the system says to put in an nb-scroll rather than let widen a page. */}
      <div className="nb-scroll mt-1">
        <table className="nb-table">
          <caption className="sr-only">
            An example team roster, showing what members can see of each
            other&apos;s progress.
          </caption>
          <thead>
            <tr>
              <th scope="col">member</th>
              <th scope="col">department</th>
              <th scope="col" className="text-right">
                xp
              </th>
            </tr>
          </thead>
          <tbody>
            {roster.map((member) => (
              <tr key={member.initials}>
                <td>
                  <span className="flex items-center gap-2.5">
                    <span
                      className="nb-avatar size-8 shrink-0 text-[0.7rem]"
                      aria-hidden="true"
                    >
                      {member.initials}
                    </span>
                    <span className="font-semibold">{member.name}</span>
                  </span>
                </td>
                <td className="text-graphite">{member.role}</td>
                <td className="nb-slug text-right font-bold text-ink">
                  {member.xp.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="nb-hint mt-4">
        One team number groups rookies, veterans and mentors into a roster you
        can all see. Nobody has to be invited and nobody has to approve anyone.
      </p>
    </div>
  );
}
