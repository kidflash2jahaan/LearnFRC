import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, BookmarkX, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { TerminalFrame, NeonCounter, TypeLine } from "@/components/motion/terminal";
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

  return (
    <div className="mx-auto max-w-4xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-dots opacity-50 mask-b-faded" />
      </div>

      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="primary" className="mb-3 px-3 py-1 font-mono uppercase tracking-wider">
              <Bookmark className="h-3.5 w-3.5" />
              Saved for later
            </Badge>
            <h1 className="text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Your <span className="text-gradient">bookmarks</span>
            </h1>
            <p className="mt-2 text-pretty text-muted-foreground">
              {total > 0
                ? `${pluralize(total, "lesson")} saved — jump back in any time.`
                : "Save lessons while you browse and they'll show up here."}
            </p>
          </div>
          {total > 0 && (
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/guides">
                <Compass className="h-4 w-4" />
                Browse guides
              </Link>
            </Button>
          )}
        </div>
      </Reveal>

      {total > 0 && (
        <Reveal delay={0.06} className="mt-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-3">
            <TypeLine
              prompt="~/learnfrc $"
              text="ls ~/bookmarks"
              className="text-xs text-muted-foreground"
            />
            <span className="flex items-baseline gap-1.5 font-mono text-sm text-muted-foreground">
              <NeonCounter
                to={total}
                className="font-display text-lg font-bold text-primary neon-text"
              />
              saved
            </span>
          </div>
        </Reveal>
      )}

      {total === 0 ? (
        <Reveal delay={0.1} className="mt-12">
          <TerminalFrame
            title="bookmarks — ~/saved"
            bodyClassName="px-6 py-16 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary glow-primary">
              <BookmarkX className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-xl font-semibold">
              No bookmarks yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-pretty text-muted-foreground">
              Tap the bookmark icon on any lesson to save it here. Build your own
              reading list across all 11 departments.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="brand" size="lg">
                <Link href="/guides">Explore the guides</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/guides/getting-started">Start with the basics</Link>
              </Button>
            </div>
          </TerminalFrame>
        </Reveal>
      ) : (
        <Stagger className="mt-8 flex flex-col gap-3">
          {bookmarks.map((b) => (
            <StaggerItem key={b.lessonId}>
              <BookmarkCard data={b} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
