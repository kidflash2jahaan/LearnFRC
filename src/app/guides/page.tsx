import type { Metadata } from "next";
import Link from "next/link";
import { getDepartments, getCompletedLessonIds } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CatalogueWall } from "./_pit-row";
import { JsonLd } from "@/components/json-ld";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Guides: Learn Every Department, Free",
  description:
    "Explore every FRC department: mechanical, CAD, programming, electrical, business, outreach, scouting, drive team and more. Structured guides from fundamentals to advanced.",
  alternates: { canonical: `${SITE}/guides` },
  openGraph: {
    title: "FRC Guides: Learn Every Department, Free · LearnFRC",
    description:
      "Explore every FRC department: mechanical, CAD, programming, electrical, business, outreach, scouting, drive team and more. Structured guides from fundamentals to advanced.",
    url: `${SITE}/guides`,
    type: "website",
  },
};

/**
 * /guides is the contents page of the binder.
 *
 * A person arrives here to do exactly one thing: pick which of the departments
 * they are going to read. So the page is built the way a contents page is: a
 * short masthead saying what the binder is, the totals ruled off across the
 * page, then the tabs themselves as a wall of index cards. Nothing else, and
 * nothing repeated. The eleven cards are the content, and they are already the
 * largest click targets on the page, so the page does not end in a third
 * restatement of the same two buttons.
 */
export default async function GuidesPage() {
  const [departments, { user }] = await Promise.all([
    getDepartments(),
    getSession(),
  ]);

  const progress: Record<string, number> = {};
  // Hoisted out of the block below so the first-run entry point can read it.
  // Only ever compared against zero: PostgREST truncates a large select at 1000
  // rows, but truncation can never turn a non-empty history into an empty one,
  // so `=== 0` is safe on this unpaged read in a way that a count would not be.
  let completedCount = 0;
  if (user) {
    const supabase = await createClient();
    const [{ data: lessons }, completed] = await Promise.all([
      supabase.from("lessons").select("id, modules(department_id)"),
      getCompletedLessonIds(user.id),
    ]);
    completedCount = completed.size;
    const totals: Record<string, number> = {};
    const done: Record<string, number> = {};
    for (const l of lessons ?? []) {
      const dep = (l.modules as { department_id?: string } | null)?.department_id;
      if (!dep) continue;
      totals[dep] = (totals[dep] ?? 0) + 1;
      if (completed.has(l.id as string)) done[dep] = (done[dep] ?? 0) + 1;
    }
    for (const d of departments)
      progress[d.id] = totals[d.id]
        ? Math.round(((done[d.id] ?? 0) / totals[d.id]) * 100)
        : 0;
  }

  const totalModules = departments.reduce((s, d) => s + d.moduleCount, 0);
  const totalLessons = departments.reduce((s, d) => s + d.lessonCount, 0);

  /**
   * THE ENTRY POINT FOR ACCOUNTS THAT NEVER STARTED.
   *
   * 156 of 347 accounts (45%) have never completed a lesson, and every one of
   * them predates /start, and the post-signup redirect only catches people who
   * sign up from now on. This is how the existing 156 find it.
   *
   * WHY HERE. This page is the choosing surface, and the choosing is exactly
   * where those accounts are lost: 11 departments and 394 lessons is the
   * problem /start exists to collapse, so the alternative belongs beside it.
   * It is also already a per-user render (it reads the session for the
   * per-department progress), so showing it costs no extra dynamism.
   *
   * WHY IT IS NOT A NAG. Signed-out visitors never see it (they get the normal
   * public masthead), it disappears permanently the moment one lesson is done,
   * it is one note inside the page's own content, not a banner, modal, toast or
   * interstitial, and it is dismissible by simply doing nothing.
   */
  const showFirstRunEntry = !!user && completedCount === 0;

  // Catalog structured data: tells search engines this is a browsable set of
  // FRC department guides, each linking to its own curriculum.
  const catalogLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "FRC guides by department",
    itemListElement: departments.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: d.name,
      url: `${SITE}/guides/${d.slug}`,
    })),
  };

  return (
    <>
      <JsonLd data={catalogLd} />

      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <p className="nb-marker">the catalogue</p>

        <h1 className="max-w-[16ch]">
          Pick the department you actually work on.
        </h1>

        <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
          An FRC team is {departments.length} jobs happening at once, and each
          one gets its own tab in here: the modules to work through, the lessons
          inside them, and the parts that cost rookie teams a match.
        </p>

        <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
          <Link href="/guides/getting-started" className="nb-btn">
            Start with the basics
          </Link>
          <Link href="/glossary" className="nb-btn-ghost">
            Decode the acronyms
          </Link>
        </div>

        {showFirstRunEntry && (
          <div className="nb-note mt-[clamp(1.4rem,2.6vw,2rem)] max-w-[42rem]">
            <p className="nb-slug">your account</p>
            <p className="mt-2 text-[0.95rem] leading-snug">
              You are signed in, but nothing is ticked off yet. Answer one
              question and these {totalLessons} lessons narrow down to the five
              worth doing first.{" "}
              <Link href="/start" className="nb-link">
                Build my plan
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      {/* ===================== THE TALLY =====================
          The one inverted surface on this page, and the only place the totals
          are printed. A contents page states its own extent once, in figures
          big enough to read from across the room. */}
      <section className="nb-slab py-[clamp(2.2rem,4.5vw,3.4rem)]">
        <div className="nb-wrap grid items-end gap-[clamp(1.3rem,3vw,2.6rem)] min-[900px]:grid-cols-[1.05fr_repeat(3,minmax(0,0.72fr))]">
          <div>
            <h2 className="max-w-[15ch] text-[clamp(1.6rem,1.1rem+1.9vw,2.55rem)]">
              Free to read, all of it.
            </h2>
            <p className="mt-3 max-w-[34ch] text-[0.95rem] text-[rgba(245,246,242,0.85)]">
              No account needed to read a lesson. Sign in when you want the
              ticks, the streak and the department certificate.
            </p>
          </div>

          <p className="nb-stamp">
            <b>{departments.length}</b>
            <span>departments</span>
          </p>
          <p className="nb-stamp">
            <b>{totalModules.toLocaleString()}</b>
            <span>modules</span>
          </p>
          <p className="nb-stamp">
            <b>{totalLessons.toLocaleString()}</b>
            <span>lessons</span>
          </p>
        </div>
      </section>

      {/* ===================== THE WALL ===================== */}
      <section className="nb-wrap py-[clamp(2.6rem,5vw,4.4rem)]">
        <div className="mb-[clamp(1.6rem,3.4vw,2.6rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h2>All {departments.length} departments</h2>
            <p className="nb-sub mt-3">
              Every card is a whole curriculum: modules in order, lessons inside
              them, and a quiz at the end of each one. Read them in any order you
              like.
            </p>
          </div>
          <p className="nb-pen max-w-[20ch] rotate-[1.5deg] min-[900px]:text-right">
            start top left if this is your first season
          </p>
        </div>

        <CatalogueWall
          departments={departments}
          progress={user ? progress : undefined}
        />
      </section>

      {/* ===================== THE NOTE AT THE END =====================
          Not a third call to action. By this point the reader has scrolled past
          every card on the site's largest set of click targets, so the only
          thing left worth saying is which one to open when none of them
          obviously fits. That is a sentence, so it is written as one. */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <div className="nb-box nb-tilt-3 max-w-[46rem] p-[clamp(1.2rem,2.6vw,1.9rem)]">
            <span className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]" aria-hidden="true" />
            <span className="nb-tape -bottom-3 right-[14%] rotate-[2.6deg]" aria-hidden="true" />

            <h2 className="text-[clamp(1.4rem,1.1rem+1.1vw,2rem)]">
              Not sure where you fit?
            </h2>
            <p className="mt-3 max-w-[52ch] text-graphite">
              Open{" "}
              <Link href="/guides/getting-started" className="nb-link">
                Getting Started
              </Link>
              . It walks the whole map: what each department actually does during
              a season, and what a rookie usually gets handed in week one. Every
              other tab makes more sense afterwards.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
