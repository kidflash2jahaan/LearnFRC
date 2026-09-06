import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { subteamLabel } from "@/components/team/subteam-label";
import { clampPct } from "@/lib/utils";

/**
 * One subteam row, already joined against the roster on the server: usernames
 * and avatars only, never `full_name`.
 */
export type SubteamRow = {
  slug: string;
  name: string;
  lessonCount: number;
  /** Distinct lessons finished by anyone on the team. */
  teamCompleted: number;
  crew: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    completed: number;
    isYou: boolean;
  }[];
};

/**
 * THE SIGN-OUT SHEET — the point of the whole /teams page.
 *
 * Every pit has a board with the subteams down one side and names written
 * against them, and the useful thing about that board is never the names: it is
 * the lines with nothing next to them. This catalog is split into departments
 * and an FRC team is split into subteams, one for one, so the board can be
 * drawn for real. Eleven ruled lines, who from your team signed each one, and
 * how far the team has got through it.
 *
 * IT IS A SHEET, NOT A GRID OF CARDS. Eleven cards make you read eleven objects
 * and compare them; eleven ruled lines make the empty ones fall out of the page
 * in one pass, which is the entire job. Nothing here is coloured per subteam
 * either: a subteam is its name and its mono slug, and the only accent on the
 * sheet is the ink in the meters.
 *
 * Server Component. The hover slide is `.nb-row`, which is CSS, so this ships
 * no JavaScript at all.
 */
export function SubteamBoard({ rows }: { rows: SubteamRow[] }) {
  return (
    <ul className="nb-list" aria-label="Subteam coverage across your team">
      {rows.map((row) => {
        const pct =
          row.lessonCount > 0
            ? clampPct((row.teamCompleted / row.lessonCount) * 100)
            : 0;
        const done = row.lessonCount > 0 && row.teamCompleted >= row.lessonCount;
        const gap = row.crew.length === 0;
        const label = subteamLabel(row.name);

        // Crew arrives sorted by lessons done, but a straight top-four cut can
        // hide the viewer in a big subteam, and "where am I on this" is half the
        // reason to look. Float yourself into the last visible slot.
        const meIdx = row.crew.findIndex((m) => m.isYou);
        const ordered =
          meIdx < 4
            ? row.crew
            : [
                ...row.crew.filter((_, k) => k !== meIdx).slice(0, 3),
                row.crew[meIdx],
                ...row.crew.filter((_, k) => k !== meIdx).slice(3),
              ];
        const shown = ordered.slice(0, 4);
        const overflow = Math.max(0, row.crew.length - shown.length);

        return (
          <li key={row.slug}>
            <Link
              href={`/guides/${row.slug}`}
              className="nb-row"
              aria-label={
                gap
                  ? `${label}, nobody on your team has started it, 0 of ${row.lessonCount} lessons`
                  : `${label}, your team has finished ${row.teamCompleted} of ${row.lessonCount} lessons`
              }
            >
              {/* who the line is for */}
              <span className="min-w-0">
                <span className="nb-slug block truncate">sub / {row.slug}</span>
                <h3 className="mt-1">{label}</h3>
              </span>

              {/* who signed it */}
              <span className="flex min-w-0 items-center self-center">
                {gap ? (
                  <span className="nb-tag border-dashed text-graphite">
                    nobody yet
                  </span>
                ) : (
                  <>
                    {shown.map((m, mi) => (
                      <span
                        key={m.userId}
                        className="relative -ml-2 first:ml-0"
                        style={{ zIndex: shown.length - mi }}
                        title={`${m.name}, ${m.completed} ${m.completed === 1 ? "lesson" : "lessons"}`}
                      >
                        <Avatar
                          name={m.name}
                          src={m.avatarUrl}
                          seed={m.userId}
                          // Spotting yourself in a fifteen-person stack matters
                          // more than the stack looking uniform, so your own
                          // mark is the one ringed in blue.
                          className={`h-8 w-8 text-[0.62rem] ${m.isYou ? "border-blue" : ""}`}
                        />
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="nb-avatar relative -ml-2 h-8 w-8 text-[0.62rem]">
                        +{overflow}
                      </span>
                    )}
                  </>
                )}
              </span>

              {/* how far the team has got */}
              <span className="block w-full self-center sm:w-[9.5rem]">
                <span className="nb-slug flex items-baseline justify-between gap-2">
                  <span>{done ? "all done" : "lessons"}</span>
                  <b className="font-bold text-ink">
                    {row.teamCompleted}/{row.lessonCount}
                  </b>
                </span>
                <span className="nb-meter mt-1.5 block h-[0.5rem]">
                  <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The whole team's shape in one line: a tick box per subteam, inked in when
 * somebody is on it and left empty when nobody is. It is the sheet above
 * compressed to eleven marks, so the gaps are countable before a word is read.
 *
 * Decorative and `aria-hidden`. The sheet below is the accessible version, and
 * the covered / total figure is always printed next to this.
 */
export function SubteamMeter({ rows }: { rows: SubteamRow[] }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {rows.map((r) => (
        <span
          key={r.slug}
          className={`h-3 flex-1 rounded-[var(--hand-s)] border-2 border-ink ${
            r.crew.length ? "bg-blue" : "bg-transparent border-dashed"
          }`}
        />
      ))}
    </span>
  );
}
