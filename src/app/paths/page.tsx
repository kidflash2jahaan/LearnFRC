import type { Metadata } from "next";
import Link from "next/link";
import { PATHS } from "@/lib/paths-data";
import { JsonLd } from "@/components/json-ld";
import { RevealGroup } from "@/components/motion/primitives";
import { RouteSlip } from "./_route-preview";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC"; this is already a full-length
  // title tag, so emit it as-is.
  title: { absolute: "FRC Learning Paths: Guided Tracks by Goal" },
  description:
    "Free, guided FRC learning paths: new-member onboarding, robot programming, build & design, the FIRST Impact Award, and competition day. No login needed.",
  alternates: { canonical: "/paths" },
  openGraph: {
    title: "FRC Learning Paths: Guided Tracks by Goal",
    description:
      "Free, guided FRC learning paths: onboarding, robot programming, build & design, the Impact Award, and competition day.",
    url: "/paths",
    type: "website",
  },
};

/**
 * Hand angle per slip, in the order they go on the page.
 *
 * These are an order of magnitude smaller than the angles on an index card,
 * and deliberately so: a slip is the full 1280px of the gutter, where a single
 * degree of rotation is 22px of vertical drift and stops reading as "nobody
 * straightened it" and starts reading as a broken grid. No two are the same.
 */
const SLIP_TILT = ["-0.3deg", "0.22deg", "-0.16deg", "0.26deg", "-0.24deg"];

/**
 * /paths is the divider at the front of the routes section of the binder.
 *
 * A person arrives here for one reason: they know roughly what job they want on
 * the team, and they do not know which of eleven department tabs to open first.
 * So the page answers that and nothing else. The masthead says what a route is
 * and how it differs from a department, then every route is printed full width
 * as a slip with its whole itinerary showing, so the choice is made by reading
 * the stops rather than by clicking through five pages to compare them.
 *
 * Server Component. Every route is static data; nothing here is per-user.
 */
export default function PathsPage() {
  const totalStops = PATHS.reduce((sum, p) => sum + p.steps.length, 0);
  const deptsTouched = new Set(
    PATHS.flatMap((p) => p.steps.map((s) => s.deptSlug)),
  ).size;
  const first = PATHS[0];

  // What the card in the masthead prints. Written out here so the card markup
  // below stays a shape and not a pile of interleaved arithmetic.
  const tally: { n: number; label: string }[] = [
    { n: PATHS.length, label: "routes, one per job people ask about" },
    { n: totalStops, label: "stops, in the order they stop being confusing" },
    { n: deptsTouched, label: "departments the routes pass through" },
  ];

  return (
    <>
      {/* The hub lists the individual path Courses; each detail page carries
          the full Course markup for itself. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "FRC learning paths",
          description:
            "Guided, multi-department routes through the LearnFRC curriculum.",
          url: `${SITE}/paths`,
          numberOfItems: PATHS.length,
          itemListElement: PATHS.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: p.title,
            url: `${SITE}/paths/${p.slug}`,
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            {
              "@type": "ListItem",
              position: 2,
              name: "Learning paths",
              item: `${SITE}/paths`,
            },
          ],
        }}
      />

      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap grid items-start gap-[clamp(1.6rem,4vw,3.4rem)] pb-[clamp(2.4rem,5vw,4rem)] pt-[clamp(2.2rem,5vw,4rem)] min-[900px]:grid-cols-[minmax(0,1.5fr)_minmax(0,0.82fr)]">
        <div>
          <p className="nb-marker">
            {PATHS.length} routes / {totalStops} stops
          </p>

          <h1 className="max-w-[19ch]">
            Every route is a <span className="nb-mark">reading order</span> for
            one job.
          </h1>

          <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
            The catalogue is filed by department, because that is how a team is
            organised. A route cuts across it: five or six stops, in the order
            that stops them being confusing.
          </p>

          <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
            {first && (
              <Link href={`/paths/${first.slug}`} className="nb-btn">
                Start the first route
              </Link>
            )}
            <Link href="/guides" className="nb-btn-ghost">
              Browse all departments
            </Link>
          </div>
        </div>

        {/* The taped tally. It exists to answer "what is a route" in figures
            rather than in another paragraph, which is the one question that
            keeps people on this page instead of moving through it. */}
        <div>
          <div className="nb-box nb-tilt-1 mt-1 p-[clamp(1.2rem,2.4vw,1.7rem)]">
            <span
              className="nb-tape -top-3 left-[22%] rotate-[-3.6deg]"
              aria-hidden="true"
            />
            <span
              className="nb-tape -bottom-3 right-[16%] rotate-[2.4deg]"
              aria-hidden="true"
            />

            <p className="nb-slug border-b border-dashed border-rule pb-3">
              what is in this section
            </p>

            <dl className="mt-1">
              {tally.map((row, i) => (
                <div
                  key={row.label}
                  className={
                    i === 0
                      ? "flex items-baseline gap-3 py-2.5"
                      : "nb-hair flex items-baseline gap-3 py-2.5"
                  }
                >
                  <dt className="nb-count min-w-[2.6ch] text-[clamp(1.7rem,1.1rem+1.9vw,2.4rem)]">
                    {row.n}
                  </dt>
                  <dd className="text-[0.95rem] font-medium leading-snug">
                    {row.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="nb-pen mt-4 max-w-[24ch] rotate-[-1.2deg]">
            the first one is for anyone in their first season
          </p>
        </div>
      </section>

      {/* ===================== THE SLIPS ===================== */}
      <section className="nb-wrap nb-rule py-[clamp(2.4rem,5vw,4rem)]">
        <div className="mb-[clamp(1.6rem,3.4vw,2.6rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h2 className="max-w-[20ch]">
              All {PATHS.length} routes, with every stop showing.
            </h2>
            <p className="nb-sub mt-3">
              Each stop is a whole department guide, so a route is a reading
              order and not a separate set of lessons. Nothing on it is locked,
              and you can leave a route at any stop and stay in that department.
            </p>
          </div>
          <p className="nb-pen max-w-[19ch] rotate-[1.4deg] min-[900px]:text-right">
            pick by the stops, not by the title
          </p>
        </div>

        {/* MOTION: the slips SETTLE, they do not straighten. A slip is the full
            1280px of the gutter, where `nb-straighten`'s 1.6deg would be 36px
            of vertical drift at the far corner and read as a broken grid, which
            is the same reason SLIP_TILT above is an order of magnitude smaller
            than an index card's angle. So they travel 14px and are laid down
            flat: no rotation on full-width paper. */}
        <RevealGroup className="grid gap-[clamp(1.1rem,2.4vw,1.8rem)]">
          {PATHS.map((p, i) => (
            <RouteSlip
              key={p.slug}
              index={i}
              slug={p.slug}
              title={p.title}
              description={p.description}
              stops={p.steps.map((s) => ({
                deptSlug: s.deptSlug,
                label: s.label,
              }))}
              outcomeCount={p.outcomes.length}
              tilt={SLIP_TILT[i % SLIP_TILT.length]}
            />
          ))}
        </RevealGroup>
      </section>

      {/* ===================== THE TWO WAYS OUT =====================
          Not a third restatement of the same button. Someone still reading at
          this point has already decided none of the five slips is them, and
          there are exactly two reasons for that: they want one department
          rather than a route, or they are setting this up for other people. */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <div className="nb-box grid overflow-hidden min-[861px]:grid-cols-2">
            <div className="nb-panel">
              <p className="nb-slug">none of them is your job</p>
              <h2 className="mt-2 text-[clamp(1.25rem,1rem+0.9vw,1.7rem)]">
                Open the department instead.
              </h2>
              <p className="mt-3 text-[0.96rem] text-graphite">
                All eleven stand on their own, with their modules already in the
                order a rookie should read them. A route only decides which tabs
                you open and when.
              </p>
              <p className="mt-auto pt-5">
                <Link href="/guides" className="nb-btn-ghost">
                  Browse all departments
                </Link>
              </p>
            </div>

            <div className="nb-panel">
              <p className="nb-slug">running this for other people</p>
              <h2 className="mt-2 text-[clamp(1.25rem,1rem+0.9vw,1.7rem)]">
                Point a whole team down one.
              </h2>
              <p className="mt-3 text-[0.96rem] text-graphite">
                Everyone who signs up with the same FRC team number is grouped
                together, so you can hand new members a route and then see who
                actually finished it.
              </p>
              <p className="mt-auto pt-5">
                <Link href="/for-teams" className="nb-btn-ghost">
                  How teams use this
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
