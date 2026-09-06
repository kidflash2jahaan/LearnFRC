import { Avatar } from "@/components/ui/avatar";
import { clampPct } from "@/lib/utils";

export type RosterMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  completed: number;
  lastActive: string | null;
  isYou: boolean;
};

/**
 * THE ROSTER SHEET.
 *
 * A pit roster is a table: names down one side, figures across. So this is a
 * table, not a stack of cards. The subteam sheet above it is already a ruled
 * log with one big heading per line, and repeating that shape here would make
 * the page read as one list interrupted by a heading. Columns are also the
 * only shape in which "who is furthest along" is answerable by running a
 * finger down a single column.
 *
 * NOBODY GETS A CROWN. Rank one is the top row, labelled "lead" in the same
 * mono as everything else, because a gold badge is a colour this palette does
 * not have and a rank you cannot photocopy is not a rank.
 *
 * Two columns drop out on narrow screens rather than forcing a sideways
 * scroll, and the two that never drop are the ones the sheet exists for: who
 * the person is, and how far through they are.
 *
 * Server Component. Every figure is already known at render time, so there is
 * nothing to count up and nothing to hydrate.
 */

/**
 * How long ago somebody last finished something, in the binder's voice: short,
 * lowercase, and specific about the unit.
 */
function relTime(iso: string | null): string {
  if (!iso) return "not started yet";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "unknown";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 3600) return "just now";
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86_400);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function Roster({
  members,
  totalLessons,
}: {
  members: RosterMember[];
  totalLessons: number;
}) {
  return (
    <div className="nb-scroll">
      <table className="nb-table">
        <caption className="nb-slug pb-3 text-left">
          ranked by lessons finished
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-[3.25rem]">
              no.
            </th>
            <th scope="col">member</th>
            {/* Narrower on a phone so the sheet fits 375px without reaching
                for its own sideways scroll, wider once there is room. */}
            <th scope="col" className="w-[9rem] sm:w-[11rem]">
              lessons
            </th>
            <th scope="col" className="hidden text-right sm:table-cell">
              xp
            </th>
            <th scope="col" className="hidden text-right md:table-cell">
              last active
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => {
            const pct =
              totalLessons > 0 ? clampPct((m.completed / totalLessons) * 100) : 0;
            const lead = i === 0 && m.completed > 0;

            return (
              <tr
                key={m.userId}
                // Your own row is washed blue AND barred in the margin, so it
                // survives being printed without colour.
                className={m.isYou ? "bg-blue/[0.07]" : undefined}
              >
                <td
                  className={`nb-slug text-ink ${m.isYou ? "border-l-[3px] border-l-blue pl-2" : ""}`}
                >
                  {i + 1}
                </td>

                <td>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={m.name}
                      src={m.avatarUrl}
                      seed={m.userId}
                      className="h-9 w-9 text-[0.7rem]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{m.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {m.isYou && (
                          <span className="nb-tag" data-on>
                            you
                          </span>
                        )}
                        {lead && <span className="nb-tag">lead</span>}
                      </span>
                    </span>
                  </span>
                </td>

                <td>
                  <span className="nb-slug flex items-baseline justify-between gap-2">
                    <span>done</span>
                    <b className="font-bold text-ink">
                      {m.completed}/{totalLessons}
                    </b>
                  </span>
                  <span className="nb-meter mt-1.5 block">
                    <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
                  </span>
                </td>

                <td className="nb-slug hidden text-right font-bold text-ink sm:table-cell">
                  {m.xp.toLocaleString()}
                </td>

                <td className="nb-slug hidden text-right md:table-cell">
                  {relTime(m.lastActive)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
