import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPathBySlug, getAllPathSlugs } from "@/lib/paths-data";
import { getDepartmentBySlug } from "@/lib/queries";
import { JsonLd } from "@/components/json-ld";
import { RouteStopRow } from "./_route-line";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export function generateStaticParams() {
  return getAllPathSlugs().map((slug) => ({ slug }));
}

/** Query-matching title tags + ≤160-char meta descriptions per path.
    The bare route name ("Game Day Ready") matches nothing anyone searches;
    these mirror how people actually phrase the goal. */
const SEO_META: Record<string, { title: string; description: string }> = {
  "new-member-onboarding": {
    title: "How to Start on an FRC Team: Free Onboarding Path",
    description:
      "A guided route for brand-new FRC members: how the season works, shop safety, your first build, wiring basics, and picking a department. Free, no login.",
  },
  "become-a-robot-programmer": {
    title: "How to Become an FRC Robot Programmer: Free Path",
    description:
      "A guided route from zero code to competition-ready FRC software: WPILib setup, command-based subsystems, sensors, PID, and autonomous. Free, no login.",
  },
  "build-and-design-track": {
    title: "How to Design and Build an FRC Robot: Free Path",
    description:
      "A guided route through the FRC build pipeline: CAD in Onshape, fabrication and fasteners, gearboxes, wiring your mechanism, and shop safety. Free.",
  },
  "win-the-impact-award": {
    title: "How to Win the FIRST Impact Award: Free Path",
    description:
      "A guided route to a winning FIRST Impact Award entry: team sustainability, funding, outreach and media, then the essay and presentation. Free, no login.",
  },
  "game-day-ready": {
    title: "How to Prepare for an FRC Competition: Free Path",
    description:
      "A guided route to competition day: scouting and picklists, match strategy, drive team roles, and running a safe, inspection-ready pit. Free, no login.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = getPathBySlug(slug);
  if (!path) return { title: "Path" };
  const seo = SEO_META[slug];
  const title = seo?.title ?? `${path.title}: Free FRC Learning Path`;
  const description = seo?.description ?? path.description;
  return {
    // The root template appends " · LearnFRC"; these are already full-length
    // title tags, so emit them as-is.
    title: { absolute: title },
    description,
    alternates: { canonical: `/paths/${slug}` },
    openGraph: {
      title,
      description,
      url: `/paths/${slug}`,
      type: "website",
    },
  };
}

/**
 * One route, opened.
 *
 * The page has exactly one job: show the order, and get the reader into stop
 * one. So it is drawn as three things and stops. A masthead that names the
 * route and prints its extent in figures. The itinerary itself as a log, one
 * ruled line per stop, each line the size of the click target. Then the payoff
 * printed once on the single inverted surface the system owns, because "what
 * you can do at the end" is the claim the whole route is making and it should
 * be the loudest thing on the page after the itinerary.
 *
 * Server Component. Same fetches as before, only the presentation is new.
 */
export default async function PathPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const path = getPathBySlug(slug);
  if (!path) notFound();

  // One cached fetch per department on the route, the same cache entries the
  // department pages use, so these are warm in practice. They give us the real
  // department names for the route AND the real lesson-minute total behind the
  // Course schema, so the declared workload isn't invented.
  const routeSlugs = [...new Set(path.steps.map((s) => s.deptSlug))];
  const routeDepts = await Promise.all(
    routeSlugs.map((s) => getDepartmentBySlug(s).catch(() => null)),
  );
  const nameBySlug = new Map(
    routeDepts.flatMap((d) => (d ? ([[d.slug, d.name]] as const) : [])),
  );
  const totalMinutes = routeDepts.reduce(
    (sum, d) =>
      sum +
      (d?.modules ?? []).reduce(
        (mAcc, mod) =>
          mAcc +
          (mod.lessons ?? []).reduce(
            (lAcc, lesson) => lAcc + (lesson.estimated_minutes ?? 0),
            0,
          ),
          0,
      ),
    0,
  );
  const workloadHours = Math.max(1, Math.ceil(totalMinutes / 60));

  const firstStep = path.steps[0];
  const lastStep = path.steps[path.steps.length - 1];
  const routeNumber = String(getAllPathSlugs().indexOf(path.slug) + 1).padStart(
    2,
    "0",
  );
  const deptsVisited = routeSlugs.length;

  const firstName = firstStep
    ? (nameBySlug.get(firstStep.deptSlug) ?? firstStep.label)
    : "";
  const lastName = lastStep
    ? (nameBySlug.get(lastStep.deptSlug) ?? lastStep.label)
    : "";

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: path.title,
          description: path.description,
          url: `${SITE}/paths/${path.slug}`,
          isAccessibleForFree: true,
          inLanguage: "en",
          provider: {
            "@type": "Organization",
            name: "LearnFRC",
            url: SITE,
          },
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "online",
            courseWorkload: `PT${workloadHours}H`,
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
          teaches: path.outcomes,
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
            {
              "@type": "ListItem",
              position: 3,
              name: path.title,
              item: `${SITE}/paths/${path.slug}`,
            },
          ],
        }}
      />

      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(1.4rem,3vw,2.4rem)]">
        <Link
          href="/paths"
          className="nb-slug inline-flex min-h-11 items-center hover:text-blue"
        >
          &larr; all {getAllPathSlugs().length} routes
        </Link>

        <p className="nb-marker mt-2">
          route {routeNumber} / {path.slug}
        </p>

        <h1 className="max-w-[17ch]">{path.title}</h1>

        <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">{path.description}</p>

        <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
          {firstStep && (
            <Link href={`/guides/${firstStep.deptSlug}`} className="nb-btn">
              Start at stop 01
            </Link>
          )}
          <Link href="#outcomes" className="nb-btn-ghost">
            What you leave with
          </Link>
        </div>

        {/* The extent of the route, ruled off. Three figures, printed once, on
            the same line rather than in three separate boxes: they describe one
            thing and they are not three separate decisions. */}
        <div className="nb-rule mt-[clamp(1.6rem,3.4vw,2.4rem)] flex flex-wrap gap-x-[clamp(1.6rem,5vw,4rem)] gap-y-3 pt-[clamp(0.9rem,2vw,1.3rem)]">
          <p className="nb-count">
            {path.steps.length}
            <small>stops</small>
          </p>
          <p className="nb-count">
            {deptsVisited}
            <small>departments</small>
          </p>
          <p className="nb-count">
            {path.outcomes.length}
            <small>skills at the end</small>
          </p>
          <p className="nb-count">
            {workloadHours}
            <small>hours of reading</small>
          </p>
        </div>
      </section>

      {/* ===================== THE ITINERARY ===================== */}
      <section
        className="nb-wrap pb-[clamp(2.4rem,5vw,3.6rem)]"
        aria-labelledby="route-heading"
      >
        <div className="mb-[clamp(1.2rem,2.6vw,1.9rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h2 id="route-heading" className="max-w-[18ch]">
              The order to read it in.
            </h2>
            <p className="nb-sub mt-3">
              Every stop is a department guide you can also reach on its own.
              Work down the list. Nothing here is locked and nothing needs an
              account to read.
            </p>
          </div>
          <p className="nb-pen max-w-[18ch] rotate-[-1.1deg] min-[900px]:text-right">
            skip a stop you already do all season
          </p>
        </div>

        <ol className="nb-list">
          {path.steps.map((step, i) => (
            <RouteStopRow
              key={step.deptSlug + i}
              index={i}
              deptSlug={step.deptSlug}
              deptName={nameBySlug.get(step.deptSlug) ?? step.label}
              label={step.label}
              note={step.note}
            />
          ))}
        </ol>

        <p className="nb-slug mt-4">
          end of route / starts in {firstName} / ends in {lastName}
        </p>
      </section>

      {/* ===================== THE PAYOFF =====================
          The single inverted surface on this page, spent on the one claim the
          route is making. Numbered, because the outcomes are the same list the
          Course structured data declares and a reader should be able to count
          them against the stops above. */}
      <section
        id="outcomes"
        className="nb-slab py-[clamp(2.4rem,5vw,3.8rem)]"
        aria-labelledby="outcomes-heading"
      >
        <div className="nb-wrap grid gap-[clamp(1.6rem,4vw,3.4rem)] min-[900px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
          <div>
            <h2
              id="outcomes-heading"
              className="max-w-[15ch] text-[clamp(1.6rem,1.1rem+1.9vw,2.55rem)]"
            >
              What you can do at the end.
            </h2>
            <p className="mt-3 max-w-[34ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
              Not topics covered. These are the jobs you can be handed on a real
              team once the route is behind you.
            </p>
            <p className="nb-stamp mt-[clamp(1.4rem,3vw,2.2rem)]">
              <b>{path.outcomes.length}</b>
              <span>skills, signed off by quiz</span>
            </p>
          </div>

          <ol>
            {path.outcomes.map((outcome, i) => (
              <li
                key={outcome}
                className={
                  i === 0
                    ? "flex gap-4 pb-3"
                    : "nb-hair flex gap-4 pb-3 pt-3.5"
                }
              >
                <span className="nb-slug shrink-0 font-bold text-[rgba(245,246,242,0.72)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[1rem] leading-[1.5]">{outcome}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===================== THE WAY IN ===================== */}
      {firstStep && (
        <section className="nb-wrap py-[clamp(2.6rem,5vw,4.2rem)]">
          <div
            className="nb-box nb-tilt max-w-[44rem] p-[clamp(1.3rem,2.8vw,2rem)]"
            style={{ "--tilt": "-0.5deg" } as CSSProperties}
          >
            <span
              className="nb-tape -top-3 left-[17%] rotate-[-3.4deg]"
              aria-hidden="true"
            />

            <p className="nb-slug">stop 01 / {firstStep.deptSlug}</p>
            <h2 className="mt-2 text-[clamp(1.4rem,1.1rem+1.1vw,2rem)]">
              It starts in {firstName}.
            </h2>
            <p className="mt-3 max-w-[52ch] text-graphite">
              {firstStep.note} From there the route works down to {lastName},
              and you can stop at any line and stay in that department for the
              rest of the season.
            </p>

            <div className="mt-[clamp(1.2rem,2.4vw,1.7rem)] flex flex-wrap gap-3">
              <Link href={`/guides/${firstStep.deptSlug}`} className="nb-btn">
                Start at stop 01
              </Link>
              <Link href="/paths" className="nb-btn-ghost">
                Compare the other routes
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
