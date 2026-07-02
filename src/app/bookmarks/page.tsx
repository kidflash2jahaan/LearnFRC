import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bookmark,
  BookmarkX,
  Clock,
  Compass,
  Layers,
  Library,
  Sparkles,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  BookmarkCard,
  type BookmarkCardData,
} from "@/components/bookmarks/bookmark-card";
import { Icon } from "@/lib/icon-map";
import { deptMeta, inkFor } from "@/lib/departments";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bookmarks · LearnFRC",
  description: "Your saved lessons, ready to pick up any time.",
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
  const shelves = (() => {
    const map = new Map<
      string,
      { slug: string; name: string; count: number }
    >();
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
  const topShelf = shelves[0];

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate min-h-screen overflow-x-clip text-foreground"
    >
      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="aq-drift-a h-[620px] w-[620px] opacity-70"
          style={{
            left: "-180px",
            top: "-200px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="aq-drift-b h-[560px] w-[560px] opacity-60"
          style={{
            right: "-160px",
            top: "-120px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="aq-drift-c h-[520px] w-[520px] opacity-45"
          style={{
            left: "28%",
            top: "520px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-28 sm:px-6 sm:pt-28 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:pb-16 lg:pt-32">
        <div>
          <span className="aq-chip aq-eyebrow aq-rise aq-rise-1 inline-flex items-center gap-2">
            <Library aria-hidden className="h-3.5 w-3.5" />
            Your personal reading list
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-extrabold leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.35rem]">
            The shelf you built,{" "}
            <span className="aq-grad-anim" style={HEADING_GRADIENT}>
              ready for the pit
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
            {total > 0
              ? `${pluralize(total, "lesson")} saved${
                  deptCount > 1 ? ` across ${pluralize(deptCount, "department")}` : ""
                }. Every spine is a lesson you set aside — pull one down whenever build season leaves you a spare minute.`
              : "Save any lesson while you browse and it lands here like a book on a shelf — your own reading list across all 11 departments."}
          </p>

          {total > 0 && (
            <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/guides"
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                <Compass aria-hidden className="h-4 w-4" />
                Add more to the shelf
              </Link>
              <Link
                href="/guides/getting-started"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                <Sparkles aria-hidden className="h-4 w-4" />
                Start with the basics
              </Link>
            </div>
          )}

          {total > 0 && (
            <div className="aq-rise aq-rise-5 mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
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
          )}
        </div>

        {/* ===== SIGNATURE: the glass "shelf" — spines stacked by department ===== */}
        {total > 0 ? (
          <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-3 rounded-3xl p-6 lg:justify-self-end">
            <div className="mb-5 flex items-center gap-2">
              <span
                className="aq-badge aq-badge-bob grid h-9 w-9 place-items-center rounded-xl"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Library aria-hidden className="h-[18px] w-[18px]" />
              </span>
              <span className="aq-display text-[17px] font-bold text-foreground">
                Your shelf
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a7a43]">
                <span className="aq-pulse h-2 w-2 rounded-full bg-[#12b565]" />
                Live
              </span>
            </div>

            {/* the spines: one bar per department, width ∝ saved count */}
            <div className="flex flex-col gap-3">
              {shelves.map((s, i) => {
                const meta = deptMeta(s.slug);
                const pct = topShelf ? (s.count / topShelf.count) * 100 : 0;
                return (
                  <div
                    key={s.slug}
                    className="aq-reveal flex items-center gap-3"
                    style={{ animationDelay: `${0.15 + i * 0.1}s` } as CSSProperties}
                  >
                    <span
                      className="aq-badge aq-badge-bob flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ "--a": meta.color } as CSSProperties}
                    >
                      <Icon name={meta.icon} className="h-[17px] w-[17px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {s.name}
                        </span>
                        <span className="tabular-nums text-xs font-semibold text-foreground/70">
                          {s.count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-[7px] overflow-hidden rounded-md bg-[rgba(120,145,190,.24)]">
                        <span
                          className="aq-bar-anim block h-full rounded-md"
                          style={{
                            width: `${Math.max(pct, 10)}%`,
                            animationDelay: `${0.3 + i * 0.12}s`,
                            background: `linear-gradient(90deg, ${meta.color}, ${meta.to})`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <hr className="aq-divider my-5" />

            <div className="grid grid-cols-2 gap-3">
              <div className="aq-card rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  <Layers aria-hidden className="h-3.5 w-3.5" />
                  Departments
                </div>
                <div className="aq-display mt-1 text-2xl font-extrabold leading-none text-foreground">
                  <AnimatedCounter value={deptCount} />
                </div>
              </div>
              <div className="aq-card rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  <Clock aria-hidden className="h-3.5 w-3.5" />
                  {readMinutes > 0 ? "Read time" : "Saved"}
                </div>
                <div className="aq-display mt-1 text-2xl font-extrabold leading-none text-foreground">
                  {readMinutes > 0 ? (
                    <>
                      <AnimatedCounter value={readMinutes} />
                      <span className="text-base font-bold text-muted-foreground">
                        {" "}
                        min
                      </span>
                    </>
                  ) : (
                    <AnimatedCounter value={total} />
                  )}
                </div>
              </div>
            </div>

            {topShelf && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Leaning hardest into{" "}
                <span
                  className="font-semibold"
                  style={{ color: inkFor(deptMeta(topShelf.slug).color) }}
                >
                  {topShelf.name}
                </span>
                .
              </p>
            )}
          </div>
        ) : (
          // Empty-state companion panel: an evocative empty shelf.
          <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-3 rounded-3xl p-6 lg:justify-self-end">
            <div className="mb-5 flex items-center gap-2">
              <span
                className="aq-badge grid h-9 w-9 place-items-center rounded-xl"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Library aria-hidden className="h-[18px] w-[18px]" />
              </span>
              <span className="aq-display text-[17px] font-bold text-foreground">
                An empty shelf
              </span>
            </div>
            <div className="flex flex-col gap-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aq-reveal flex items-center gap-3 opacity-60"
                  style={{ animationDelay: `${0.15 + i * 0.12}s` } as CSSProperties}
                >
                  <span className="h-9 w-9 shrink-0 rounded-xl border border-dashed border-border bg-background/40" />
                  <div className="h-[7px] flex-1 rounded-md border border-dashed border-border" />
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Bookmark a lesson and its spine appears here.
            </p>
          </div>
        )}
      </section>

      {/* ============================ SHELF ============================ */}
      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        {total === 0 ? (
          <Reveal>
            <div className="aq-glass aq-sheen aq-reveal mx-auto max-w-xl rounded-3xl px-6 py-16 text-center">
              <div
                className="aq-badge aq-badge-bob mx-auto grid h-16 w-16 place-items-center rounded-2xl"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <BookmarkX aria-hidden className="h-8 w-8" />
              </div>
              <h2 className="aq-display aq-reveal mt-6 text-2xl font-bold tracking-tight">
                Nothing saved yet
              </h2>
              <p className="mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
                Tap the bookmark icon on any lesson to shelve it here. Build your
                own reading list across all 11 departments — from mechanical
                build to the Impact award.
              </p>
              <div
                className="aq-reveal mt-8 flex items-center justify-center gap-2"
                style={{ animationDelay: "120ms" } as CSSProperties}
              >
                <div className="aq-display text-4xl font-extrabold text-foreground">
                  <AnimatedCounter value={11} />
                </div>
                <div className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  departments
                  <br />
                  to explore
                </div>
              </div>
              <div
                className="aq-reveal mt-8 flex flex-wrap items-center justify-center gap-3"
                style={{ animationDelay: "220ms" } as CSSProperties}
              >
                <Link
                  href="/guides"
                  className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
                >
                  <Compass aria-hidden className="h-4 w-4" />
                  Explore the guides
                </Link>
                <Link
                  href="/guides/getting-started"
                  className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
                >
                  Start with the basics
                </Link>
              </div>
            </div>
          </Reveal>
        ) : (
          <>
            <div className="aq-reveal flex items-end justify-between gap-4">
              <div>
                <span className="aq-eyebrow">On the shelf</span>
                <h2 className="aq-display mt-1 text-2xl font-bold tracking-tight text-foreground">
                  {pluralize(total, "saved lesson")}
                </h2>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="aq-pulse inline-block h-2 w-2 rounded-full bg-[#2560e6]"
                />
                Newest first
              </span>
            </div>

            {/* the reading rail: a hairline spine ties the saved lessons together */}
            <div className="relative mt-5 pl-5 sm:pl-6">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-2 left-[6px] w-px bg-gradient-to-b from-primary/40 via-border to-transparent sm:left-[8px]"
              />
              <Stagger className="flex flex-col gap-3">
                {bookmarks.map((b) => {
                  const meta = deptMeta(b.deptSlug);
                  return (
                    <StaggerItem key={b.lessonId} className="relative">
                      {/* rail node keyed to the department color */}
                      <span
                        aria-hidden
                        className="absolute -left-[18px] top-7 z-[1] h-2.5 w-2.5 rounded-full ring-4 ring-background sm:-left-[22px]"
                        style={{ background: meta.color }}
                      />
                      <BookmarkCard data={b} />
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </div>

            <Reveal className="mt-10">
              <div className="aq-card aq-card-hover flex flex-col items-center gap-3 rounded-3xl px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
                <div>
                  <h3 className="aq-display text-lg font-bold text-foreground">
                    Room for more on the shelf
                  </h3>
                  <p className="mt-1 text-sm text-foreground/70">
                    Keep browsing — every lesson you bookmark lands right here.
                  </p>
                </div>
                <Link
                  href="/guides"
                  className="aq-cta inline-flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
                >
                  <Compass aria-hidden className="h-4 w-4" />
                  Browse guides
                </Link>
              </div>
            </Reveal>
          </>
        )}
      </section>
    </div>
  );
}
