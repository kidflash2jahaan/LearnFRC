import Link from "next/link";
import type { ClassListing } from "@/lib/classes/types";
import { HomeClassTime } from "@/components/classes/home-class-time";
import { lengthLabel, seatsLabel, topicLine } from "@/components/classes/home-format";

/**
 * Live classes on the homepage (classes-design.md section 11): one line in
 * the hero and section 1a, between the hero and the 60-second tour.
 *
 * The page renders these only when homeClasses() (src/lib/classes/
 * static-pages.ts) returns a list, which it does only while classes are
 * visible. The homepage is cached and the same for everyone, so nothing here
 * carries a handle, an avatar or a team number, signed in or not: a class is
 * "Taught by an FRC student" and its time is UTC until the browser swaps in
 * the reader's own.
 *
 * Server Components. The only client leaf is the time.
 */

/**
 * Each card gets its own tilt and tape angle, the same rule as the
 * department wall: no two pieces on one screen straightened the same way.
 * Written out in full so Tailwind sees every class name.
 */
const CARD = [
  { tilt: "nb-tilt-2", tape: "left-[18px] rotate-[-3.6deg]" },
  { tilt: "nb-tilt-3", tape: "right-[22%] rotate-[2.8deg]" },
  { tilt: "nb-tilt-1", tape: "left-[30%] rotate-[-1.8deg]" },
] as const;

/** The hero's one line about classes, under the two buttons. */
export function HomeClassesHeroLine() {
  return (
    <p className="mt-4">
      <Link href="/classes" className="nb-link inline-flex min-h-11 items-center text-[0.98rem]">
        New: free live classes, taught by FRC students
      </Link>
    </p>
  );
}

function ClassCard({ c, i }: { c: ClassListing; i: number }) {
  const cell = CARD[i % CARD.length];
  const topic = topicLine(c.topic);
  const live = c.status === "live";
  return (
    <li className="flex">
      <Link
        href={`/classes/${c.id}`}
        className={`nb-box nb-lift ${cell.tilt} flex w-full flex-col p-[clamp(1rem,1.9vw,1.45rem)] no-underline`}
      >
        <span aria-hidden="true" className={`nb-tape -top-3 h-[21px] w-[74px] ${cell.tape}`} />
        <p className="nb-slug flex flex-wrap items-center gap-x-2 gap-y-1">
          {live ? (
            <span className="nb-tag" data-on="">
              live now
            </span>
          ) : null}
          <HomeClassTime iso={c.startsAt} />
        </p>
        <h3 className="mt-2 break-words">{c.title}</h3>
        {topic ? <p className="nb-slug mt-2 break-words">{topic}</p> : null}
        {/* Never a handle here, even if a listing carried one: this page is
            cached and shared by everyone. */}
        <p className="mb-3 mt-2 text-[0.92rem] leading-snug text-graphite">{c.teacherLabel}</p>
        <div className="nb-hair mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-4">
          <span className="nb-slug text-ink">
            {lengthLabel(c.durationMinutes)} / {seatsLabel(c.seats)}
          </span>
          <span className="nb-slug text-ink">{live ? "join" : "open"}</span>
        </div>
      </Link>
    </li>
  );
}

/**
 * Section 1a. Up to three classes as cards, soonest first, or the empty state
 * when none is scheduled yet. Either way it ends with the two ways in: the
 * full list and teaching one.
 */
export function HomeClassesSection({ classes }: { classes: ClassListing[] }) {
  const empty = classes.length === 0;
  return (
    <section id="classes" aria-labelledby="classes-heading" className="nb-rule">
      <div className="nb-wrap py-[clamp(2.6rem,5vw,4.4rem)]">
        <p className="nb-marker">live classes / free</p>
        <h2 id="classes-heading" className="max-w-[18ch]">
          Learn it live, from FRC students.
        </h2>
        <p className="nb-sub mt-4">
          Free online classes on LearnFRC lessons, 15 to 90 minutes long, for
          students 13 to 17 and taught by FRC students the same age. Every
          class is recorded on video and reviewed, student cameras stay off,
          and the class chat is filtered.
        </p>

        {empty ? (
          <div className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[40rem]">
            <p className="text-[1.02rem] leading-relaxed">
              The first classes are being scheduled. Want to teach one?
            </p>
          </div>
        ) : (
          <ul className="mt-[clamp(1.6rem,3.4vw,2.6rem)] grid list-none grid-cols-1 gap-[clamp(0.85rem,1.7vw,1.35rem)] p-0 md:grid-cols-3">
            {classes.map((c, i) => (
              <ClassCard key={c.id} c={c} i={i} />
            ))}
          </ul>
        )}

        <div className="mt-[clamp(1.4rem,2.8vw,2rem)] flex flex-wrap gap-3">
          {empty ? (
            <>
              <Link href="/apply/teach" className="nb-btn">
                Teach a class
              </Link>
              <Link href="/classes" className="nb-btn-ghost">
                How classes work
              </Link>
            </>
          ) : (
            <>
              <Link href="/classes" className="nb-btn">
                See all classes
              </Link>
              <Link href="/apply/teach" className="nb-btn-ghost">
                Teach a class
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
