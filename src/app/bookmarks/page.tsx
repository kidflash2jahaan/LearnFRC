import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { needsUsernameSetup } from "@/lib/onboarding-server";
import {
  BookmarkCard,
  type BookmarkCardData,
} from "@/components/bookmarks/bookmark-card";
import { ShelfIndex, type ShelfRow } from "./_shelf-panel";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pluralize } from "@/lib/utils";

/**
 * Bookmarks, rebuilt as the folder at the back of the binder.
 *
 * The page has exactly one job: pick one of the lessons you set aside and open
 * it now. So it is a masthead, an index slip saying what is in the folder, and
 * then the folder itself: one drawn container holding ruled entries. No card
 * grid, no rail, no per-entry frame. The old page put every saved lesson in its
 * own bordered, glowing, department-coloured card, which meant a reader scanned
 * eleven frames to find one title.
 *
 * Behaviour is unchanged: same auth gate, same handle gate, same single
 * bookmarks query, same newest-first order, same optimistic removal.
 */

export const metadata: Metadata = {
  title: "Bookmarks · LearnFRC",
  description: "Your saved lessons, ready to pick up any time.",
  robots: { index: false, follow: false },
};

type LessonJoin = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  estimated_minutes: number | null;
  modules: {
    slug: string;
    departments: { slug: string; name: string } | null;
  } | null;
};

type BookmarkRow = {
  created_at: string;
  lessons: LessonJoin | null;
};

export default async function BookmarksPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/bookmarks");
  // Required handle: hold them on the setup step (see onboarding-server.ts).
  if (needsUsernameSetup(profile)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("bookmarks")
    .select(
      "created_at, lessons(id, slug, title, summary, estimated_minutes, modules(slug, departments(slug, name)))"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as BookmarkRow[];

  const bookmarks: BookmarkCardData[] = rows
    .filter((r) => r.lessons && r.lessons.modules?.departments)
    .map((r) => {
      const l = r.lessons!;
      const mod = l.modules!;
      const dept = mod.departments!;
      return {
        lessonId: l.id,
        lessonSlug: l.slug,
        title: l.title,
        summary: l.summary,
        estimatedMinutes: l.estimated_minutes,
        moduleSlug: mod.slug,
        deptSlug: dept.slug,
        deptName: dept.name,
        savedAt: r.created_at,
      };
    });

  const total = bookmarks.length;

  // What is in the folder, by department, most-saved first.
  const shelves: ShelfRow[] = (() => {
    const map = new Map<string, ShelfRow>();
    for (const b of bookmarks) {
      const cur = map.get(b.deptSlug);
      if (cur) cur.count += 1;
      else map.set(b.deptSlug, { slug: b.deptSlug, name: b.deptName, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  })();

  const deptCount = shelves.length;
  const readMinutes = bookmarks.reduce(
    (sum, b) => sum + (b.estimatedMinutes ?? 0),
    0
  );

  return (
    <>
      {/* ===================== MASTHEAD ===================== */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <div className="grid items-start gap-[clamp(1.6rem,4vw,3.2rem)] min-[900px]:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
          <div className="min-w-0">
            <p className="nb-marker">your reading list</p>

            <h1 className="max-w-[16ch]">
              {total > 0
                ? `${pluralize(total, "lesson")} you set aside.`
                : "A folder for the lessons you'll want twice."}
            </h1>

            <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
              {total > 0
                ? `Filed from ${pluralize(
                    deptCount,
                    "department"
                  )}, newest first. Pull one down when build season leaves you ten minutes.`
                : "Hit the bookmark on any lesson while you are reading and it lands here, so the thing you needed in week one is still findable in week five."}
            </p>

            <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
              <Link href="/guides" className="nb-btn">
                {total > 0 ? "Add to the folder" : "Browse the guides"}
              </Link>
              <Link href="/guides/getting-started" className="nb-btn-ghost">
                Start with the basics
              </Link>
            </div>
          </div>

          <div className="min-[900px]:justify-self-end">
            <ShelfIndex shelves={shelves} readMinutes={readMinutes} total={total} />
          </div>
        </div>
      </section>

      {/* ===================== THE FOLDER =====================
          One drawn container. The entries live inside its edge rather than
          carrying edges of their own, so what a reader scans is a column of
          titles and not a column of frames. */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        {total === 0 ? (
          <div className="nb-box max-w-[46rem] p-[clamp(1.3rem,3vw,2.1rem)]">
            <p className="nb-slug">the folder</p>
            <h2 className="mt-2 text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">
              Empty, for now.
            </h2>
            <p className="nb-sub mt-3">
              Every lesson page has a bookmark on it. Nothing about saving one is
              a commitment: it is a note that says come back to this, and this is
              where the notes pile up.
            </p>
            <p className="nb-hair mt-5 pt-4">
              <span className="nb-count">
                11<small>departments to file from</small>
              </span>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-[clamp(1.1rem,2.4vw,1.6rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
                The folder
              </h2>
              <p className="nb-slug">newest first</p>
            </div>

            <div className="nb-box">
              <ul>
                {bookmarks.map((b) => (
                  <BookmarkCard key={b.lessonId} data={b} />
                ))}
              </ul>
            </div>

            {/* Not a second call to action. By this point the reader has
                scrolled the whole folder, so the only thing left worth saying
                is where the next one comes from. */}
            <p className="nb-sub mt-[clamp(1.4rem,3vw,2.2rem)]">
              Run out of things to read?{" "}
              <Link href="/guides" className="nb-link">
                The catalogue
              </Link>{" "}
              has {deptCount === 11 ? "all eleven" : "eleven"} departments, and
              the bookmark is on every lesson in it.
            </p>
          </>
        )}
      </section>
    </>
  );
}
