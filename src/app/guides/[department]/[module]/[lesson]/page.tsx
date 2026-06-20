import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  ExternalLink,
  CheckCircle2,
  Circle,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  getDepartmentBySlug,
  getCompletedLessonIds,
  getBookmarkedLessonIds,
  flattenLessons,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { deptMeta } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Markdown } from "@/components/markdown";
import { LessonActions } from "@/components/lesson/lesson-actions";
import { LessonComplete } from "@/components/lesson/lesson-complete";
import { Reveal } from "@/components/motion/reveal";
import { JsonLd } from "@/components/json-ld";
import { cn } from "@/lib/utils";
import type { Resource, QuizQuestion } from "@/lib/types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string; module: string; lesson: string }>;
}): Promise<Metadata> {
  const { department, module: moduleSlug, lesson } = await params;
  const dept = await getDepartmentBySlug(department).catch(() => null);
  const les = dept?.modules
    .find((m) => m.slug === moduleSlug)
    ?.lessons.find((l) => l.slug === lesson);
  if (!les) return { title: "Lesson" };
  return { title: les.title, description: les.summary ?? undefined };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ department: string; module: string; lesson: string }>;
}) {
  const { department, module: moduleSlug, lesson } = await params;
  const dept = await getDepartmentBySlug(department);
  if (!dept) notFound();
  const mod = dept.modules.find((m) => m.slug === moduleSlug);
  if (!mod) notFound();
  const les = mod.lessons.find((l) => l.slug === lesson);
  if (!les) notFound();

  const meta = deptMeta(dept.slug);
  const flat = flattenLessons(dept);
  const idx = flat.findIndex((l) => l.id === les.id);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;

  const { user } = await getSession();
  const completed = user ? await getCompletedLessonIds(user.id) : new Set<string>();
  const bookmarks = user ? await getBookmarkedLessonIds(user.id) : new Set<string>();
  const isCompleted = completed.has(les.id);
  const lessonPath = `/guides/${dept.slug}/${mod.slug}/${les.slug}`;

  const takeaways = (les.key_takeaways ?? []) as string[];
  const resources = (les.resources ?? []) as Resource[];
  const quiz = (les.quiz ?? []) as QuizQuestion[];
  const nextHref = next
    ? `/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`
    : `/guides/${dept.slug}`;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: les.title,
          description: les.summary ?? undefined,
          learningResourceType: "lesson",
          url: `${SITE}${lessonPath}`,
          isPartOf: { "@type": "Course", name: dept.name },
          provider: { "@type": "Organization", name: "LearnFRC", url: SITE },
        }}
      />
      {/* breadcrumb */}
      <Reveal>
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/guides" className="transition-colors hover:text-foreground">
            Guides
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href={`/guides/${dept.slug}`}
            className="transition-colors hover:text-foreground"
          >
            {dept.name}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate text-foreground/70">{mod.title}</span>
        </nav>
      </Reveal>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_280px] lg:gap-12">
        {/* main */}
        <article className="min-w-0">
          <Reveal>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span style={{ color: meta.color }}>{dept.name}</span>
              <span>·</span>
              <span>
                Lesson {idx + 1} of {flat.length}
              </span>
            </div>
            <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              {les.title}
            </h1>
            {les.summary && (
              <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
                {les.summary}
              </p>
            )}
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-6 border-y border-border py-5">
              <LessonActions
                lessonId={les.id}
                deptSlug={dept.slug}
                lessonPath={lessonPath}
                authed={!!user}
                initialCompleted={isCompleted}
                initialBookmarked={bookmarks.has(les.id)}
                quizRequired={quiz.length > 0}
              />
              {!user && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <Link href={`/login?next=${encodeURIComponent(lessonPath)}`} className="text-primary hover:underline">
                    Sign in
                  </Link>{" "}
                  to track progress, earn XP, and save lessons.
                </p>
              )}
            </div>
          </Reveal>

          {/* content */}
          <div className="mt-8">
            <Markdown content={les.content} />
          </div>

          {/* key takeaways */}
          {takeaways.length > 0 && (
            <div
              className="mt-10 rounded-2xl border p-6"
              style={{
                borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)`,
                background: `color-mix(in srgb, ${meta.color} 7%, transparent)`,
              }}
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Lightbulb className="h-5 w-5" style={{ color: meta.color }} />
                Key takeaways
              </h2>
              <ul className="mt-4 space-y-2.5">
                {takeaways.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-foreground/85">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0"
                      style={{ color: meta.color }}
                    />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* resources */}
          {resources.length > 0 && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Go deeper</h2>
              <ul className="mt-4 space-y-2.5">
                {resources.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-start gap-2 text-foreground/85 transition-colors hover:text-primary"
                    >
                      <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                      <span className="underline decoration-border underline-offset-2 group-hover:decoration-primary">
                        {r.title}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* completion / quiz */}
          <LessonComplete
            lessonId={les.id}
            deptSlug={dept.slug}
            lessonPath={lessonPath}
            authed={!!user}
            initialCompleted={isCompleted}
            quiz={quiz}
            nextHref={nextHref}
          />

          {/* prev / next */}
          <nav className="mt-10 grid gap-4 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/guides/${dept.slug}/${prev.moduleSlug}/${prev.slug}`}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Previous
                </span>
                <span className="mt-1 line-clamp-1 font-medium group-hover:text-primary">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-right transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <span className="inline-flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </span>
                <span className="mt-1 line-clamp-1 font-medium group-hover:text-primary">
                  {next.title}
                </span>
              </Link>
            ) : (
              <Link
                href={`/guides/${dept.slug}`}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-right transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <span className="inline-flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  Finish <ArrowRight className="h-3.5 w-3.5" />
                </span>
                <span className="mt-1 font-medium group-hover:text-primary">
                  Back to {dept.name}
                </span>
              </Link>
            )}
          </nav>
        </article>

        {/* sidebar outline */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-border bg-card p-4">
            <Link
              href={`/guides/${dept.slug}`}
              className="mb-3 flex items-center gap-2 border-b border-border pb-3"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                style={{ backgroundImage: `linear-gradient(135deg, ${meta.color}, ${meta.to})` }}
              >
                <Icon name={meta.icon} className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-semibold">{dept.name}</span>
            </Link>
            <div className="space-y-3">
              {dept.modules.map((m, mi) => (
                <div key={m.id}>
                  <div className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {mi + 1}. {m.title}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {m.lessons.map((l) => {
                      const active = l.id === les.id;
                      const done = completed.has(l.id);
                      return (
                        <li key={l.id}>
                          <Link
                            href={`/guides/${dept.slug}/${m.slug}/${l.slug}`}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                              active
                                ? "bg-muted font-medium text-foreground"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                          >
                            {done ? (
                              <CheckCircle2
                                className="h-4 w-4 shrink-0"
                                style={{ color: meta.color }}
                              />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                            )}
                            <span className="line-clamp-1">{l.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
