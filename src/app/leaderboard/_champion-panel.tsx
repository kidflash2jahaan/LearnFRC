import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { clampPct } from "@/lib/utils";
import type { PodiumEntry } from "@/components/leaderboard/podium";

/**
 * THE STANDING, TAPED UP.
 *
 * The one thing somebody wants from this page before they scroll: who is
 * actually on top right now. It is drawn as the slip of paper a scorekeeper
 * pins to the wall between matches, three ruled lines with the gap between
 * them measured out, not a floating instrument panel.
 *
 * WHY A METER AND A NUMBER. The bars are the shape of the race, and they are
 * the whole reason to put second and third next to first: 12,400 against
 * 11,900 is a photo finish and 12,400 against 900 is not, and neither reads
 * from the figures alone at a glance. Every bar prints its own figure beside
 * it, because a bar on its own is one colour against one colour.
 *
 * This is the all-time standing. The board further down shows whichever week
 * or view you pick, which is a different question and gets a different shape.
 *
 * Server Component: no state, no motion, no client bundle.
 */
export function ChampionPanel({ top3 }: { top3: PodiumEntry[] }) {
  const champ = top3[0];
  if (!champ) return null;

  // Every bar is measured against the leader, so the leader is always full and
  // the gap below is real distance rather than a rescaled ranking.
  const max = Math.max(1, champ.xp);

  return (
    <div className="nb-box nb-tilt-2 relative w-full max-w-[27rem] p-[clamp(1.2rem,2.6vw,1.8rem)] lg:justify-self-end">
      <span className="nb-tape -top-3 left-[18%] rotate-[-4.2deg]" aria-hidden="true" />
      <span className="nb-tape -bottom-3 right-[14%] rotate-[2.6deg]" aria-hidden="true" />

      <p className="nb-marker">standings / all time</p>

      <ol className="mt-1">
        {top3.slice(0, 3).map((e, i) => {
          const first = i === 0;
          const pct = clampPct((e.xp / max) * 100);

          const nameTag = (
            <span
              className={`block truncate tracking-[-0.02em] ${
                first ? "text-[1.18rem] font-extrabold" : "text-[1rem] font-bold"
              }`}
            >
              {e.name}
            </span>
          );

          return (
            <li
              key={e.id}
              className={first ? "pt-1" : "nb-hair mt-3.5 pt-3.5"}
            >
              <div className="flex items-center gap-3">
                <span className="nb-slug w-[1.6rem] shrink-0 font-bold text-ink">
                  {String(e.rank).padStart(2, "0")}
                </span>

                <Avatar
                  name={e.name}
                  src={e.avatarUrl}
                  seed={e.username ?? e.id}
                  className={
                    first
                      ? "h-12 w-12 text-[0.9rem]"
                      : "h-9 w-9 text-[0.72rem]"
                  }
                />

                <div className="min-w-0 flex-1">
                  {e.username ? (
                    <Link
                      href={`/u/${e.username}`}
                      className="block min-w-0 hover:text-blue"
                    >
                      {nameTag}
                    </Link>
                  ) : (
                    nameTag
                  )}
                  <span className="nb-slug block truncate">
                    {e.teamNumber != null ? `team ${e.teamNumber} / ` : ""}
                    {e.role.toLowerCase()}
                  </span>
                </div>

                <span
                  className={`nb-count shrink-0 ${first ? "text-[1.5rem]" : "text-[1.05rem]"}`}
                >
                  {e.xp.toLocaleString()}
                  <small>xp</small>
                </span>
              </div>

              <span className="nb-meter mt-2 block">
                <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
              </span>
            </li>
          );
        })}
      </ol>

      <p className="nb-hair nb-slug mt-4 pt-3.5 leading-relaxed">
        bars are measured against first place
      </p>
    </div>
  );
}
