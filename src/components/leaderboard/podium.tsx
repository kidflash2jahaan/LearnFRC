import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";

export type PodiumEntry = {
  id: string;
  rank: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  teamNumber: number | null;
  role: string;
  xp: number;
  level: number;
  lessons: number;
  isYou: boolean;
};

/**
 * THE TOP THREE, AND EVERYONE ELSE.
 *
 * Two shapes, deliberately unalike, because they answer different questions.
 * The top three are three index cards taped to the wall, so the shape of the
 * standing reads before a single number does. Ranks four and down are a table,
 * because past third place nobody is looking at a picture, they are looking
 * for a name in a column and their own row.
 *
 * NOBODY IS GOLD, SILVER OR BRONZE. Three medal hues is three colours this
 * palette does not have, and rank read as colour alone dies in a photocopy.
 * Rank one is centred, raised, larger and labelled "leader"; that survives
 * greyscale, and it survives a screen reader.
 *
 * Server Components. There is no state here and nothing animates: the cards
 * straighten on hover through `.nb-lift`, which is CSS, so this ships no
 * JavaScript of its own.
 */

/** Placement of each plinth. Rank one goes to the middle and sits higher. */
const PLINTH: Record<number, { order: string; lift: string; tilt: string }> = {
  1: { order: "order-first sm:order-2", lift: "sm:-mt-7", tilt: "nb-tilt-3" },
  2: { order: "order-2 sm:order-1", lift: "", tilt: "nb-tilt-1" },
  3: { order: "order-3", lift: "", tilt: "nb-tilt-4" },
};

function Plinth({ entry }: { entry: PodiumEntry }) {
  const p = PLINTH[entry.rank] ?? PLINTH[3];
  const first = entry.rank === 1;

  const nameTag = (
    <span className="block truncate text-[clamp(1.02rem,0.95rem+0.4vw,1.28rem)] font-extrabold tracking-[-0.02em]">
      {entry.name}
    </span>
  );

  return (
    <div
      className={`nb-box nb-lift flex flex-col items-center px-[clamp(0.9rem,2vw,1.4rem)] pb-[clamp(1rem,2vw,1.4rem)] pt-[clamp(1.4rem,2.6vw,2rem)] text-center ${p.order} ${p.lift} ${p.tilt}`}
    >
      <span
        className={`nb-tape -top-3 ${first ? "left-[22%]" : "left-[16%]"} rotate-[-3.8deg]`}
        aria-hidden="true"
      />

      <p className="nb-slug">
        rank {String(entry.rank).padStart(2, "0")}
        {first ? " / leader" : ""}
      </p>

      <Avatar
        name={entry.name}
        src={entry.avatarUrl}
        seed={entry.username ?? entry.id}
        className={`mt-3 ${first ? "h-[4.5rem] w-[4.5rem] text-[1.1rem]" : "h-16 w-16 text-[1rem]"}`}
      />

      <div className="mt-3 w-full min-w-0">
        {entry.username ? (
          <Link
            href={`/u/${entry.username}`}
            className="inline-flex min-h-[var(--tap)] w-full min-w-0 items-center justify-center hover:text-blue"
          >
            {nameTag}
          </Link>
        ) : (
          nameTag
        )}
        <p className="nb-slug mt-0.5 truncate">
          {entry.teamNumber != null ? `team ${entry.teamNumber} / ` : ""}
          {entry.role.toLowerCase()}
        </p>
        {entry.isYou && (
          <p className="mt-2">
            <span className="nb-tag" data-on>
              you
            </span>
          </p>
        )}
      </div>

      <p
        className={`nb-count mt-4 ${first ? "text-[clamp(1.9rem,1.2rem+2vw,2.6rem)]" : "text-[clamp(1.6rem,1.1rem+1.5vw,2.1rem)]"}`}
      >
        {entry.xp.toLocaleString()}
        <small>xp</small>
      </p>

      <p className="nb-hair nb-slug mt-4 w-full pt-3">
        level {entry.level} / {entry.lessons}{" "}
        {entry.lessons === 1 ? "lesson" : "lessons"}
      </p>
    </div>
  );
}

export function Podium({ entries }: { entries: PodiumEntry[] }) {
  // Render in rank order so the DOM matches the standing; CSS `order` moves
  // rank one to the middle on wide screens without reordering it for a reader.
  const ordered = [...entries].sort((a, b) => a.rank - b.rank);
  return (
    <div className="mx-auto grid max-w-[54rem] grid-cols-1 items-end gap-[clamp(0.9rem,2vw,1.4rem)] sm:grid-cols-3">
      {ordered.map((e) => (
        <Plinth key={e.id} entry={e} />
      ))}
    </div>
  );
}

/**
 * Ranks four and down, as figures in the binder.
 *
 * A real <table>, so the header and the rows cannot drift out of alignment,
 * which is the one thing the old flexbox rows needed a shared column map to
 * prevent. Level and lesson count drop out on narrow screens rather than
 * forcing a sideways scroll, and the two columns that identify a person and
 * rank them, name and XP, are never the ones that go.
 */
export function LeaderTable({
  entries,
  caption,
}: {
  entries: PodiumEntry[];
  /** Announced to screen readers, and printed above the table as its title. */
  caption: string;
}) {
  return (
    <div className="nb-scroll">
      <table className="nb-table">
        <caption className="nb-slug pb-3 text-left">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[3.5rem]">
              rank
            </th>
            <th scope="col">learner</th>
            <th scope="col" className="hidden text-right sm:table-cell">
              level
            </th>
            <th scope="col" className="hidden text-right md:table-cell">
              lessons
            </th>
            <th scope="col" className="text-right">
              xp
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              // Your own row is washed blue AND barred in blue on the left, so
              // it is still findable when the page is printed in greyscale.
              className={e.isYou ? "bg-blue/[0.07]" : undefined}
            >
              <td
                className={`nb-slug text-ink ${e.isYou ? "border-l-[3px] border-l-blue pl-2" : ""}`}
              >
                {e.rank}
              </td>
              <td>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={e.name}
                    src={e.avatarUrl}
                    seed={e.username ?? e.id}
                    className="h-9 w-9 text-[0.7rem]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      {e.username ? (
                        <Link
                          href={`/u/${e.username}`}
                          className="min-w-0 truncate font-bold hover:text-blue"
                        >
                          {e.name}
                        </Link>
                      ) : (
                        <span className="min-w-0 truncate font-bold">
                          {e.name}
                        </span>
                      )}
                      {e.isYou && (
                        <span className="nb-tag" data-on>
                          you
                        </span>
                      )}
                    </span>
                    <span className="nb-slug block truncate">
                      {e.teamNumber != null ? `team ${e.teamNumber} / ` : ""}
                      {e.role.toLowerCase()}
                    </span>
                  </span>
                </span>
              </td>
              <td className="nb-slug hidden text-right text-ink sm:table-cell">
                {e.level}
              </td>
              <td className="nb-slug hidden text-right text-ink md:table-cell">
                {e.lessons}
              </td>
              <td className="nb-slug text-right font-bold text-ink">
                {e.xp.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
