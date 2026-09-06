import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDepartmentBySlug, getAllDepartmentSlugs, flattenLessons } from "@/lib/queries";
import { JsonLd } from "@/components/json-ld";
import type { Resource } from "@/lib/types";
import { MyProgressProvider } from "@/components/progress/my-progress";
import { TITLE_BLOCK_CELL, TITLE_BLOCK_FIGURE } from "./_mastery-panel";
import {
  DeptMastery,
  DeptCtaRow,
  DeptFooterHeading,
  DeptModules,
  DeptSuggest,
  DeptWeekGoal,
} from "./_progress-islands";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

// Static/ISR: the catalog is identical for everyone and crawlers, so this page
// is prerendered and revalidated on the catalog window. Per-user progress
// (ticks, continue state, mastery) hydrates client-side from
// /api/me/progress, see the `Dept*` islands below. (Previously force-dynamic
// only to read the session; that read now lives entirely on the client.)
export const revalidate = 86400; // daily background ISR floor; content edits push live via /api/revalidate (hourly was needless ISR-write churn)
export const dynamicParams = true; // unknown slugs still render on-demand → notFound

export async function generateStaticParams() {
  const slugs = await getAllDepartmentSlugs();
  return slugs.map((department) => ({ department }));
}

/** Query-matching title tags + ≤160-char meta descriptions per department.
    The bare dept name ("Safety") can't match any real search; these can. */
const SEO_META: Record<string, { title: string; description: string }> = {
  "getting-started": {
    title: "Getting Started with FRC: A Rookie's Complete Guide",
    description:
      "New to FIRST Robotics? Free structured lessons on how FRC works — the season, the robot, the team roles — from zero to your first competition.",
  },
  "mechanical-build": {
    title: "FRC Mechanical & Build Guide: Drivetrain to Pneumatics",
    description:
      "Free FRC mechanical lessons — drivetrains, power transmission, pneumatics, intakes, and fabrication — from first bolt to competition-ready robot.",
  },
  "programming-software": {
    title: "FRC Programming Guide: WPILib, Java & Command-Based",
    description:
      "Learn FRC programming free — WPILib setup, Java, command-based structure, closed-loop control, and vision — with hands-on lessons and quizzes.",
  },
  "electrical-wiring": {
    title: "FRC Electrical & Wiring Guide: PDH, CAN & Breakers",
    description:
      "Wire an FRC robot the right way — PDH, CAN bus, breakers, brownouts, and troubleshooting — in free step-by-step electrical lessons.",
  },
  "cad-design": {
    title: "FRC CAD & Design: Free Onshape Robot Design Course",
    description:
      "Design FRC robots in Onshape — sketches, assemblies, swerve drivebase layout, and worked mini-projects — in a free structured CAD course.",
  },
  "scouting-strategy": {
    title: "FRC Scouting & Strategy: OPR, EPA & Picklists",
    description:
      "Free FRC scouting and strategy lessons — data collection, OPR/EPA, match strategy, alliance selection, and picklist building that wins matches.",
  },
  "drive-team": {
    title: "FRC Drive Team Guide: Driver, Operator & Coach",
    description:
      "Everything the FRC drive team needs — driver practice, operator flow, coach calls, and match-day routines — in free structured lessons.",
  },
  "business-operations": {
    title: "FRC Team Business & Fundraising Guide: Budgets, Grants",
    description:
      "Run the business side of an FRC team — budgets, sponsors, grants, and sustainability — with free lessons and real templates.",
  },
  "media-outreach": {
    title: "FRC Media, Branding & Outreach Guide",
    description:
      "Build your FRC team's brand — social media, outreach events, storytelling, and award documentation — in free structured lessons.",
  },
  "impact-award": {
    title: "FIRST Impact Award Guide: Essay, Submission & Judging",
    description:
      "Win the FIRST Impact Award — essay writing, executive summaries, judging prep, and documentation — with free lessons from real submissions.",
  },
  safety: {
    title: "FRC Robot Safety Guide: Shop, Battery & Pit Rules",
    description:
      "FRC safety done right — shop practices, battery handling, pit conduct, and inspection rules — in free lessons your whole team can take.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<Metadata> {
  const { department } = await params;
  const dept = await getDepartmentBySlug(department).catch(() => null);
  if (!dept) return { title: "Department" };
  const url = `${SITE}/guides/${department}`;
  const seo = SEO_META[department];
  // Meta description must stay snippet-length; the long dept.description
  // belongs on the page, not in the tag.
  const mods = dept.modules ?? [];
  const totalModules = mods.length;
  const totalLessons = mods.reduce((s, m) => s + (m.lessons?.length ?? 0), 0);
  const richFallback = `Learn ${dept.name} for FRC — ${totalLessons} free lessons across ${totalModules} modules. ${dept.tagline ?? ""}`.trim();
  const title = seo?.title ?? `${dept.name} — FRC Guide`;
  const description = seo?.description ?? richFallback;
  return {
    // The root template appends " · LearnFRC"; these titles are already full
    // 50-60 char tags, so emit them as-is.
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
  };
}

/**
 * One department, as a sheet out of the binder.
 *
 * A person here has already chosen. What they need is the shape of the thing
 * (how big is it, how long will it take, how far in am I) and then the path
 * itself. So the sheet is laid out the way a drawing is: the masthead names it,
 * a ruled title block states its figures, and the body carries the work, with
 * the notes that do not fit in the path running down the margin.
 *
 * The old page said the same numbers three times, in hero chips, in a strip of
 * four tiles, and again above the module list. They are printed once now, in
 * the title block, which is the only place a drawing puts them.
 */
export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const dept = await getDepartmentBySlug(department);
  if (!dept) notFound();

  const flat = flattenLessons(dept);
  const totalLessons = flat.length;
  const totalModules = dept.modules.length;
  // Ordered lesson refs the client islands use to derive progress (completed
  // set → counts, mastery %, and the continue/next destination) after hydration.
  // Titles ride along so the resume affordance can NAME the next lesson instead
  // of saying "continue". One array, passed by reference to every island, so
  // the RSC payload carries it exactly once.
  const lessons = flat.map((l) => ({
    id: l.id,
    moduleSlug: l.moduleSlug,
    slug: l.slug,
    title: l.title,
    moduleTitle: l.moduleTitle,
  }));

  const learn = (dept.what_youll_learn ?? []) as string[];
  const tools = (dept.tools ?? []) as string[];
  const prereqs = (dept.prerequisites ?? []) as string[];
  const sources = (dept.sources ?? []) as Resource[];
  const hasMargin =
    learn.length > 0 || tools.length > 0 || prereqs.length > 0 || sources.length > 0;

  // Estimated total time across every lesson, surfaced as an at-a-glance stat.
  const totalMinutes = flat.reduce((sum, l) => sum + (l.estimated_minutes ?? 0), 0);
  const totalHours = Math.max(1, Math.round(totalMinutes / 60));
  // Whole-hour workload for the Course schema (ISO-8601 duration, rounded up).
  const workloadHours = Math.max(1, Math.ceil(totalMinutes / 60));

  return (
    <MyProgressProvider>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: dept.name,
          description: dept.tagline ?? dept.description ?? undefined,
          url: `${SITE}/guides/${dept.slug}`,
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
          educationalCredentialAwarded: `${dept.name} certificate`,
          ...(learn.length > 0 ? { teaches: learn } : {}),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE}/guides` },
            {
              "@type": "ListItem",
              position: 3,
              name: dept.name,
              item: `${SITE}/guides/${dept.slug}`,
            },
          ],
        }}
      />

      {/* ===================== MASTHEAD =====================
          The visible trail matches the BreadcrumbList above it, so the page
          tells a reader and a crawler the same thing about where it sits. */}
      <section className="nb-wrap pb-[clamp(1.6rem,3vw,2.4rem)] pt-[clamp(1.6rem,3.5vw,2.6rem)]">
        <nav aria-label="Breadcrumb">
          <ol className="nb-slug m-0 flex list-none flex-wrap items-center gap-x-2 p-0">
            <li>
              <Link href="/" className="hover:text-blue hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/guides" className="hover:text-blue hover:underline">
                Guides
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink">
              {dept.slug}
            </li>
          </ol>
        </nav>

        <h1 className="mt-[clamp(1rem,2vw,1.5rem)] max-w-[15ch]">{dept.name}</h1>

        {dept.tagline && <p className="nb-lede mt-5">{dept.tagline}</p>}

        {dept.description && (
          <p className="mt-4 max-w-[62ch] text-graphite">{dept.description}</p>
        )}

        <div className="mt-[clamp(1.4rem,2.6vw,2rem)]">
          <DeptCtaRow variant="hero" deptSlug={dept.slug} lessons={lessons} />
        </div>

        <p className="nb-pen mt-5 max-w-[26ch] rotate-[-1.2deg]">
          nobody reads these in order, that is fine
        </p>
      </section>

      {/* ===================== TITLE BLOCK =====================
          Every figure on this page, printed once. Three of the four cells are
          catalogue facts and render on the server; only mastery has to know who
          is reading, so only mastery is an island.

          The grid flips to one column at the width `.nb-panel` turns its
          dividing rule from vertical to horizontal, so the cells and the rules
          between them can never disagree about which way the block runs. */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)]">
        <div className="nb-box grid grid-cols-1 min-[861px]:grid-cols-4">
          <span className="nb-tape -top-3 left-[8%] rotate-[-3.4deg]" aria-hidden="true" />

          <div className={TITLE_BLOCK_CELL}>
            <p className="nb-slug">modules</p>
            <p className={`${TITLE_BLOCK_FIGURE} min-[861px]:mt-1`}>
              {totalModules}
            </p>
          </div>

          <div className={TITLE_BLOCK_CELL}>
            <p className="nb-slug">lessons</p>
            <p className={`${TITLE_BLOCK_FIGURE} min-[861px]:mt-1`}>
              {totalLessons}
            </p>
          </div>

          <div className={TITLE_BLOCK_CELL}>
            <p className="nb-slug">reading time</p>
            <p className={`${TITLE_BLOCK_FIGURE} min-[861px]:mt-1`}>
              {totalHours}
              <small>hours</small>
            </p>
          </div>

          <DeptMastery lessons={lessons} />
        </div>
      </section>

      {/* ===================== THE PATH, AND THE MARGIN ===================== */}
      <div className="nb-wrap grid gap-[clamp(2rem,4vw,3.2rem)] pb-[clamp(2.6rem,5vw,4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        <div className="min-w-0">
          {/* Week rhythm, resume, next badge. Renders nothing for a reader with
              no tracked progress, so the static HTML below is untouched. */}
          <DeptWeekGoal
            deptSlug={dept.slug}
            deptName={dept.name}
            lessons={lessons}
          />

          <div className="mb-[clamp(1.2rem,2.4vw,1.8rem)]">
            <p className="nb-marker">the path</p>
            <h2 className="text-[clamp(1.6rem,1.1rem+1.6vw,2.4rem)]">
              Modules and lessons
            </h2>
          </div>

          <DeptModules departmentSlug={dept.slug} modules={dept.modules} />

          <div className="nb-hair mt-[clamp(1.8rem,3.5vw,2.6rem)] flex flex-wrap items-center gap-x-4 gap-y-3 pt-[clamp(1.4rem,2.6vw,1.9rem)]">
            <p className="text-[0.95rem] text-graphite">
              Know something this department is missing?
            </p>
            <DeptSuggest
              departmentId={dept.id}
              departmentName={dept.name}
              modules={dept.modules.map((m) => ({ id: m.id, title: m.title }))}
              loginPath={`/signup?next=${encodeURIComponent(`/guides/${dept.slug}`)}`}
            />
          </div>
        </div>

        {/* The margin: one sheet of notes, ruled off into sections, rather than
            four separate cards saying four separate things.

            It does NOT stick. On a real department this sheet runs past 1700px
            against an 800px viewport, and a sticky element taller than the
            viewport pins at the top and puts its own tail permanently out of
            reach: the sources list simply could not be scrolled to. Margin
            notes are read once, beside the page, so they scroll with it. */}
        {hasMargin && (
          <aside aria-label="Field notes">
            <div className="nb-box nb-tilt-2 p-[clamp(1.1rem,2.2vw,1.5rem)]">
              <span className="nb-tape -top-3 right-6 rotate-[2.8deg]" aria-hidden="true" />

              {learn.length > 0 && (
                <section className="nb-hair mt-5 pt-5 [&:first-of-type]:mt-0 [&:first-of-type]:border-t-0 [&:first-of-type]:pt-0">
                  <h2 className="text-[1rem] font-extrabold tracking-[-0.02em]">
                    What you will learn
                  </h2>
                  <ul className="mt-2.5 list-none p-0">
                    {learn.map((item, i) => (
                      <li key={i} className="relative mt-2 pl-4 text-[0.92rem] leading-snug">
                        <span aria-hidden="true" className="absolute left-0 font-bold text-blue">
                          -
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* A parts list, not a row of chips. These are real part numbers
                  ("REV Power Distribution Hub (PDH, REV-11-1850)"), and an
                  `nb-tag` is `white-space: nowrap`, so eight of the fifteen on
                  electrical-wiring drew 430px wide inside a 304px margin and
                  ran off the page. Space Mono is what this system uses for an
                  identifier anyway, and `break-words` means no part number can
                  ever blow the column open again. */}
              {tools.length > 0 && (
                <section className="nb-hair mt-5 pt-5 [&:first-of-type]:mt-0 [&:first-of-type]:border-t-0 [&:first-of-type]:pt-0">
                  <h2 className="text-[1rem] font-extrabold tracking-[-0.02em]">
                    Tools you will touch
                  </h2>
                  <ul className="mt-2.5 list-none p-0">
                    {tools.map((t, i) => (
                      <li
                        key={i}
                        className="nb-slug relative mt-1.5 break-words pl-4 text-ink"
                      >
                        <span aria-hidden="true" className="absolute left-0 font-bold text-blue">
                          -
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {prereqs.length > 0 && (
                <section className="nb-hair mt-5 pt-5 [&:first-of-type]:mt-0 [&:first-of-type]:border-t-0 [&:first-of-type]:pt-0">
                  <h2 className="text-[1rem] font-extrabold tracking-[-0.02em]">
                    Before you start
                  </h2>
                  <ul className="mt-2.5 list-none p-0">
                    {prereqs.map((p, i) => (
                      <li key={i} className="relative mt-2 pl-4 text-[0.92rem] leading-snug">
                        <span aria-hidden="true" className="absolute left-0 font-bold text-blue">
                          -
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {sources.length > 0 && (
                <section className="nb-hair mt-5 pt-5 [&:first-of-type]:mt-0 [&:first-of-type]:border-t-0 [&:first-of-type]:pt-0">
                  <h2 className="text-[1rem] font-extrabold tracking-[-0.02em]">
                    Where this comes from
                  </h2>
                  <ul className="mt-1.5 list-none p-0">
                    {sources.slice(0, 8).map((s, i) => (
                      <li key={i} className="nb-hair first:border-t-0">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center text-[0.92rem] leading-snug text-ink hover:text-blue hover:underline hover:decoration-2 hover:underline-offset-4"
                        >
                          {s.title}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ===================== THE SIGN-OFF =====================
          A ruled band, not a fourth card. The page has already handed over a
          module log full of links; what is left is one line telling the reader
          what happens if they finish, and the button that starts it. */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <DeptFooterHeading deptName={dept.name} lessons={lessons} />

          <p className="nb-sub mt-3">
            {totalModules} {totalModules === 1 ? "module" : "modules"} and{" "}
            {totalLessons} lessons, free to read without an account, written
            against the real Game Manual and the WPILib docs. Sign in when you
            want the ticks to stick and the certificate at the end.
          </p>

          <div className="mt-[clamp(1.4rem,2.6vw,2rem)]">
            <DeptCtaRow variant="footer" deptSlug={dept.slug} lessons={lessons} />
          </div>
        </div>
      </section>
    </MyProgressProvider>
  );
}
