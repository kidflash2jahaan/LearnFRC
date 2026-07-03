import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookmarkX, Compass, Library, Sparkles } from "lucide-react";
import {
  Rise,
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  BookmarkCard,
  type BookmarkCardData,
} from "@/components/bookmarks/bookmark-card";
import { ShelfPanel, type ShelfRow } from "./_shelf-panel";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deptMeta } from "@/lib/departments";
import { pluralize } from "@/lib/utils";

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

const HEADING_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6,#7c5cff,#2560e6)",
  backgroundSize: "200% auto",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function BookmarksPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/bookmarks");

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

  // The reading list, understood as a shelf: how many spines per department,
  // and roughly how long a full read-through would take.
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
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "620px", pos: { left: "-180px", top: "-200px" }, color: "#8bbcff", opacity: 0.65 },
          { size: "560px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.55, delay: 2 },
          { size: "520px", pos: { left: "28%", top: "520px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-28 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:pb-16 lg:pt-32">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Library className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Your personal reading list</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.03] sm:text-5xl lg:text-[3.35rem]">
              The shelf you built,{" "}
              <span style={HEADING_GRADIENT}>ready for the pit</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              {total > 0
                ? `${pluralize(total, "lesson")} saved${
                    deptCount > 1 ? ` across ${pluralize(deptCount, "department")}` : ""
                  }. Every spine is a lesson you set aside — pull one down whenever build season leaves you a spare minute.`
                : "Save any lesson while you browse and it lands here like a book on a shelf — your own reading list across all 11 departments."}
            </p>
          </RiseItem>

          {total > 0 && (
            <RiseItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/guides" className="ac-btn text-sm">
                  <Compass className="h-4 w-4" aria-hidden />
                  Add more to the shelf
                </Link>
                <Link href="/guides/getting-started" className="ac-btn-ghost text-sm">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Start with the basics
                </Link>
              </div>
            </RiseItem>
          )}

          {total > 0 && (
            <RiseItem>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span>
                  <b className="font-semibold text-foreground">
                    <AnimatedCounter value={total} />
                  </b>{" "}
                  saved
                </span>
                <span>
                  <b className="font-semibold text-foreground">
                    <AnimatedCounter value={deptCount} />
                  </b>{" "}
                  {deptCount === 1 ? "department" : "departments"}
                </span>
                {readMinutes > 0 && (
                  <span>
                    <b className="font-semibold text-foreground">
                      <AnimatedCounter value={readMinutes} />
                    </b>{" "}
                    min to read it all
                  </span>
                )}
              </div>
            </RiseItem>
          )}
        </RiseGroup>

        {/* ===== SIGNATURE: the glass "shelf" — spines stacked by department ===== */}
        <ShelfPanel
          shelves={shelves}
          deptCount={deptCount}
          readMinutes={readMinutes}
          total={total}
        />
      </section>

      {/* ============================ SHELF ============================ */}
      <section className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
        {total === 0 ? (
          <Reveal>
            <div className="ac-glass mx-auto max-w-xl px-6 py-16 text-center">
              <span
                className="ac-badge mx-auto grid h-16 w-16 place-items-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <BookmarkX className="h-8 w-8" aria-hidden />
              </span>
              <h2 className="mt-6 font-display text-2xl font-bold tracking-tight">
                Nothing saved yet
              </h2>
              <p className="mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
                Tap the bookmark icon on any lesson to shelve it here. Build your
                own reading list across all 11 departments — from mechanical
                build to the Impact award.
              </p>
              <div className="mt-8 flex items-center justify-center gap-2">
                <div className="font-display text-4xl font-extrabold text-foreground">
                  <AnimatedCounter value={11} />
                </div>
                <div className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  departments
                  <br />
                  to explore
                </div>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/guides" className="ac-btn text-sm">
                  <Compass className="h-4 w-4" aria-hidden />
                  Explore the guides
                </Link>
                <Link href="/guides/getting-started" className="ac-btn-ghost text-sm">
                  Start with the basics
                </Link>
              </div>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal className="flex items-end justify-between gap-4">
              <div>
                <span className="ac-eyebrow">On the shelf</span>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
                  {pluralize(total, "saved lesson")}
                </h2>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-xs text-muted-foreground">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-primary" />
                Newest first
              </span>
            </Reveal>

            {/* the reading rail: a hairline spine ties the saved lessons together */}
            <div className="relative mt-5 pl-5 sm:pl-6">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-2 left-[6px] w-px bg-gradient-to-b from-primary/40 via-border to-transparent sm:left-[8px]"
              />
              <RevealGroup className="flex flex-col gap-3">
                {bookmarks.map((b) => (
                  <RevealItem key={b.lessonId} className="relative">
                    {/* rail node keyed to the department color */}
                    <span
                      aria-hidden
                      className="absolute -left-[18px] top-7 z-[1] h-2.5 w-2.5 rounded-full ring-4 ring-background sm:-left-[22px]"
                      style={{ background: deptMeta(b.deptSlug).color }}
                    />
                    <BookmarkCard data={b} />
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>

            <Reveal className="mt-10">
              <Hover lift={-4}>
                <div className="ac-card flex flex-col items-center gap-3 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      Room for more on the shelf
                    </h3>
                    <p className="mt-1 text-sm text-foreground/70">
                      Keep browsing — every lesson you bookmark lands right here.
                    </p>
                  </div>
                  <Link href="/guides" className="ac-btn shrink-0 text-sm">
                    <Compass className="h-4 w-4" aria-hidden />
                    Browse guides
                  </Link>
                </div>
              </Hover>
            </Reveal>
          </>
        )}
      </section>
    </div>
  );
}
