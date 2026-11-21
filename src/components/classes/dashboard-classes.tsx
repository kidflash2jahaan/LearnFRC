import Link from "next/link";
import type { ClassListing } from "@/lib/classes/types";
import { HomeClassCard } from "@/components/classes/home-section";

/**
 * Live classes on the dashboard. A signed-in reader who opens "/" lands on
 * /dashboard, so the homepage's classes section has to show up here too, in
 * a smaller form: the next three classes (the same cached listing as the
 * homepage, homeClasses in src/lib/classes/static-pages.ts, and the same
 * cards), a link to /classes and, for a teacher, their teaching page.
 *
 * The page renders this only when homeClasses() returns a list, which it does
 * only while classes are visible. A Server Component, like the homepage's.
 */
export function DashboardClasses({ classes, teaches }: { classes: ClassListing[]; teaches: boolean }) {
  return (
    <section aria-labelledby="dash-classes" className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="nb-marker">live classes / free</p>
          <h2 id="dash-classes" className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
            Learn it live, from FRC students.
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/classes" className="nb-btn-ghost nb-btn-sm">
            See all classes
          </Link>
          {teaches ? (
            <Link href="/classes/teaching" className="nb-btn-ghost nb-btn-sm">
              Your teaching page
            </Link>
          ) : null}
        </div>
      </div>

      {classes.length === 0 ? (
        <p className="mt-4 max-w-[56ch] text-[0.99rem] text-graphite">
          No classes are scheduled right now. New ones show up here.
        </p>
      ) : (
        <ul className="mt-[clamp(1.4rem,3vw,2.2rem)] grid list-none grid-cols-1 gap-[clamp(0.85rem,1.7vw,1.35rem)] p-0 md:grid-cols-3">
          {classes.map((c, i) => (
            <HomeClassCard key={c.id} c={c} i={i} />
          ))}
        </ul>
      )}
    </section>
  );
}
