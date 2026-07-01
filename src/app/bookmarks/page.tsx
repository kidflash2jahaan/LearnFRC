import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, BookmarkX, Compass, Sparkles } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  BookmarkCard,
  type BookmarkCardData,
} from "@/components/bookmarks/bookmark-card";
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
  background: "linear-gradient(120deg,#2560e6,#1aa9d6,#8b5cf6,#2560e6)",
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

  // Count distinct departments across the saved lessons for a small stat.
  const deptCount = new Set(bookmarks.map((b) => b.deptSlug)).size;

  return (
    <div className="relative mx-auto max-w-4xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -left-32 top-16 h-[420px] w-[420px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,96,230,0.20), transparent 70%)" }}
        />
        <div
          className="absolute right-[-10%] top-[30%] h-[380px] w-[380px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(26,169,214,0.20), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.16), transparent 70%)" }}
        />
      </div>

      {/* hero */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <span className="aq-eyebrow aq-rise aq-rise-1">
            <Bookmark className="h-3.5 w-3.5" />
            Saved for later
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-3 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Your reading list,{" "}
            <span className="aq-grad-anim" style={HEADING_GRADIENT}>
              ready for the pit
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 text-pretty text-lg leading-relaxed text-foreground/70">
            {total > 0
              ? `${pluralize(total, "lesson")} saved${
                  deptCount > 1 ? ` across ${pluralize(deptCount, "department")}` : ""
                } — jump back in whenever build season leaves you a spare minute.`
              : "Save lessons while you browse and they'll gather here, ready to pick up any time."}
          </p>

          {total > 0 && (
            <div className="aq-rise aq-rise-4 mt-6 flex flex-wrap items-center gap-3">
              <Link href="/guides" className="aq-cta">
                <Compass className="h-4 w-4" />
                Browse guides
              </Link>
              <Link href="/guides/getting-started" className="aq-ghost">
                <Sparkles className="h-4 w-4" />
                Start with the basics
              </Link>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-3 flex shrink-0 items-center gap-4 rounded-2xl px-5 py-4">
            <div
              className="aq-badge aq-badge-bob grid h-11 w-11 place-items-center"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <Bookmark className="h-5 w-5" />
            </div>
            <div>
              <div className="aq-display text-3xl font-bold leading-none text-foreground">
                <AnimatedCounter value={total} />
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                saved {total === 1 ? "lesson" : "lessons"}
              </div>
            </div>
          </div>
        )}
      </header>

      <hr className="aq-divider mt-10" />

      {total === 0 ? (
        <Reveal className="mt-12">
          <div className="aq-card aq-card-hover aq-reveal aq-sheen mx-auto max-w-xl px-6 py-16 text-center">
            <div
              className="aq-badge aq-badge-bob mx-auto grid h-16 w-16 place-items-center"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <BookmarkX className="h-8 w-8" />
            </div>
            <h2 className="aq-display aq-reveal mt-6 text-2xl font-bold tracking-tight">
              No bookmarks yet
            </h2>
            <p className="mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
              Tap the bookmark icon on any lesson to save it here. Build your own
              reading list across all 11 departments — from mechanical build to
              the Impact award.
            </p>
            <div
              className="aq-reveal mt-8 flex items-center justify-center gap-2"
              style={{ animationDelay: "120ms" } as CSSProperties}
            >
              <div className="aq-display text-4xl font-bold text-foreground">
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
              <Link href="/guides" className="aq-cta">
                <Compass className="h-4 w-4" />
                Explore the guides
              </Link>
              <Link href="/guides/getting-started" className="aq-ghost">
                Start with the basics
              </Link>
            </div>
          </div>
        </Reveal>
      ) : (
        <>
          <div className="aq-reveal mt-8 flex items-center justify-between gap-4">
            <span className="aq-eyebrow">Every acronym, decoded</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="aq-pulse inline-block h-2 w-2 rounded-full bg-[#2560e6]" />
              Newest first
            </span>
          </div>
          <Stagger className="mt-4 flex flex-col gap-3">
            {bookmarks.map((b) => (
              <StaggerItem key={b.lessonId}>
                <BookmarkCard data={b} />
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </div>
  );
}
