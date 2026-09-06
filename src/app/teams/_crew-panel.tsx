import { Avatar } from "@/components/ui/avatar";
import { clampPct, pluralize } from "@/lib/utils";

export type CrewMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isYou: boolean;
};

/**
 * THE PIT CARD.
 *
 * The index card taped above a pit bench with the crew's initials on it and
 * how far through the season they are. It answers, in one object, the two
 * things a member wants before they read anything else: who else from my team
 * is actually here, and how far along are we.
 *
 * The avatar lineup is `aria-hidden` on purpose. It is a picture of a group,
 * and the same people are listed by name, rank and progress in the roster
 * table further down the page, which is the version worth reading aloud.
 *
 * The readiness figure is printed next to its meter, never instead of it: the
 * bar is one colour against one colour, so on a photocopy or to a reader who
 * cannot judge that ratio by eye, the number is the whole message.
 *
 * Server Component. It used to be a spring-loaded glass panel with a gradient
 * progress ring and a pulsing "Live" dot; none of that is in the system, and
 * without it the card needs no client bundle at all.
 */
export function CrewPanel({
  teamNumber,
  avgPct,
  totalCompleted,
  totalNeeded,
  memberCount,
  members,
}: {
  teamNumber: number;
  avgPct: number;
  totalCompleted: number;
  totalNeeded: number;
  memberCount: number;
  members: CrewMember[];
}) {
  // Six marks is where an overlapped row stops reading as a group and starts
  // reading as a smear. Past that the count carries it.
  const shown = members.slice(0, 6);
  const overflow = Math.max(0, memberCount - shown.length);
  const pct = clampPct(avgPct);

  return (
    <div className="nb-box nb-tilt-1 relative w-full max-w-[25rem] p-[clamp(1.2rem,2.6vw,1.8rem)] lg:justify-self-end">
      <span className="nb-tape -top-3 left-[20%] rotate-[-3.6deg]" aria-hidden="true" />
      <span className="nb-tape -bottom-3 right-[16%] rotate-[2.4deg]" aria-hidden="true" />

      <p className="nb-marker">the pit / team {teamNumber}</p>

      {shown.length === 0 ? (
        <p className="nb-slug">nobody signed in yet</p>
      ) : (
        <>
          <div className="flex items-center" aria-hidden="true">
            {shown.map((m, i) => (
              <span
                key={m.userId}
                className="relative -ml-2.5 first:ml-0"
                style={{ zIndex: shown.length - i }}
              >
                <Avatar
                  name={m.name}
                  src={m.avatarUrl}
                  seed={m.userId}
                  // Spotting yourself in a stack matters more than the stack
                  // looking uniform, so your own mark is the one ringed in blue.
                  className={`h-11 w-11 text-[0.78rem] ${m.isYou ? "border-blue" : ""}`}
                />
              </span>
            ))}
            {overflow > 0 && (
              <span className="nb-avatar relative -ml-2.5 h-11 w-11 text-[0.7rem]">
                +{overflow}
              </span>
            )}
          </div>
          <p className="nb-slug mt-2.5">
            {pluralize(memberCount, "member")}, one pit
          </p>
        </>
      )}

      <div className="nb-hair mt-[clamp(1.1rem,2.2vw,1.5rem)] pt-[clamp(1.1rem,2.2vw,1.5rem)]">
        <p className="nb-slug">how far the crew has got</p>

        <div className="mt-1.5 flex items-baseline gap-2.5">
          <span className="nb-count text-[clamp(2rem,1.4rem+1.8vw,2.7rem)]">
            {pct}
            <small>% done</small>
          </span>
        </div>

        <span className="nb-meter mt-2.5 block">
          <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
        </span>

        <p className="nb-slug mt-2.5 leading-relaxed">
          {totalCompleted.toLocaleString()} of {totalNeeded.toLocaleString()}{" "}
          lessons finished between you
        </p>
      </div>
    </div>
  );
}
