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
  Zap,
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
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import {
  TerminalFrame,
  StatusPill,
  TypeLine,
  NeonCounter,
} from "@/components/motion/terminal";
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
  const url = `${SITE}/guides/${department}/${moduleSlug}/${lesson}`;
  return {
    title: les.title,
    description: les.summary ?? undefined,
    alternates: { canonical: url },
    openGraph: {
      title: les.title,
      description: les.summary ?? undefined,
      url,
      type: "article",
    },
  };
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

  // Real per-department progress (drives the sidebar progress card).
  const doneInDept = flat.filter((l) => completed.has(l.id)).length;
  const total = flat.length;
  const pct = total ? Math.round((doneInDept / total) * 100) : 0;
  const deptGradient = `linear-gradient(135deg, ${meta.color}, ${meta.to})`;

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
      {/* breadcrumb — terminal path */}
      <Reveal>
        <nav
          className="flex flex-wrap items-center gap-1.5 font-mono text-[0.8rem] text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link href="/guides" className="transition-colors hover:text-primary">
            guides
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={`/guides/${dept.slug}`}
            className="transition-colors hover:text-primary"
          >
            {dept.slug}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-primary">{les.slug}</span>
        </nav>
      </Reveal>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_300px] lg:gap-12">
        {/* main */}
        <article className="min-w-0">
          <Reveal>
            <TypeLine
              prompt="~/learnfrc $"
              text={`open ${dept.slug}/${les.slug}`}
              className="text-xs text-muted-foreground"
            />
            <Stagger className="mt-4 flex flex-wrap items-center gap-2.5" stagger={0.06}>
              <StaggerItem>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-medium"
                  style={{
                    color: meta.color,
                    borderColor: `color-mix(in srgb, ${meta.color} 40%, var(--border))`,
                    background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                  }}
                >
                  <Icon name={meta.icon} className="h-3.5 w-3.5" />
                  {dept.name}
                </span>
              </StaggerItem>
              <StaggerItem className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 font-mono text-xs text-muted-foreground">
                lesson {idx + 1} / {flat.length}
              </StaggerItem>
              <StaggerItem className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 font-mono text-xs text-accent">
                <Zap className="h-3.5 w-3.5" /> +10 XP
              </StaggerItem>
              <StaggerItem>
                <StatusPill tone={isCompleted ? "primary" : "accent"}>
                  {isCompleted ? "completed" : "in progress"}
                </StatusPill>
              </StaggerItem>
            </Stagger>

            <h1 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.7rem] lg:leading-[1.08]">
              {les.title}
            </h1>
            {les.summary && (
              <p className="mt-3 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
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
            <Reveal>
              <TerminalFrame title="key_takeaways.md" className="mt-10" glow>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Key takeaways
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {takeaways.map((t, i) => (
                    <li key={i} className="flex gap-2.5 text-foreground/85">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </TerminalFrame>
            </Reveal>
          )}

          {/* resources */}
          {resources.length > 0 && (
            <Reveal>
              <TerminalFrame title="resources.links" className="mt-8">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <ExternalLink className="h-5 w-5 text-accent" />
                  Go deeper
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {resources.map((r, i) => (
                    <li key={i}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-2 text-foreground/85 transition-colors hover:text-accent"
                      >
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-accent/70 transition-transform group-hover:translate-x-0.5" />
                        <span className="underline decoration-border underline-offset-2 group-hover:decoration-accent">
                          {r.title}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </TerminalFrame>
            </Reveal>
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
          <Stagger className="mt-10 grid gap-4 sm:grid-cols-2" stagger={0.08}>
            {prev ? (
              <StaggerItem>
                <Link
                  href={`/guides/${dept.slug}/${prev.moduleSlug}/${prev.slug}`}
                  className="group flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                    <ArrowLeft className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <small className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Previous
                    </small>
                    <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                      {prev.title}
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            ) : (
              <span />
            )}
            {next ? (
              <StaggerItem>
                <Link
                  href={`/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`}
                  className="group flex h-full flex-row-reverse items-center gap-3 rounded-2xl border border-border bg-card p-5 text-right transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <small className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Next up
                    </small>
                    <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                      {next.title}
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            ) : (
              <StaggerItem>
                <Link
                  href={`/guides/${dept.slug}`}
                  className="group flex h-full flex-row-reverse items-center gap-3 rounded-2xl border border-border bg-card p-5 text-right transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <small className="block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Finish
                    </small>
                    <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                      Back to {dept.name}
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            )}
          </Stagger>
        </article>

        {/* sidebar — progress + contents file tree */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            {user && (
              <Reveal>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
                    <span>// your progress</span>
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-accent animate-glow-pulse"
                      style={{ boxShadow: "0 0 8px var(--accent)" }}
                      aria-hidden
                    />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-foreground">
                      <NeonCounter to={pct} suffix="%" />
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">
                      through {dept.name}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-primary shadow-[0_0_10px_var(--primary)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 font-mono text-xs text-muted-foreground">
                    {doneInDept} / {total} lessons complete
                  </div>
                </div>
              </Reveal>
            )}

            <Reveal delay={0.05}>
              <TerminalFrame
                title="contents.md"
                bodyClassName="max-h-[calc(100vh-15rem)] overflow-y-auto p-3"
              >
                <Link
                  href={`/guides/${dept.slug}`}
                  className="mb-3 flex items-center gap-2 border-b border-border px-1 pb-3"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground"
                    style={{ backgroundImage: deptGradient }}
                  >
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </span>
                  <span className="truncate font-display text-sm font-semibold">{dept.name}</span>
                </Link>
                <div className="space-y-3">
                  {dept.modules.map((m, mi) => (
                    <div key={m.id}>
                      <div className="px-1 font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                        {String(mi + 1).padStart(2, "0")} · {m.title}
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {m.lessons.map((l) => {
                          const active = l.id === les.id;
                          const done = completed.has(l.id);
                          return (
                            <li key={l.id}>
                              <Link
                                href={`/guides/${dept.slug}/${m.slug}/${l.slug}`}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border-l-2 px-2 py-1.5 text-sm transition-colors",
                                  active
                                    ? "border-primary bg-primary/10 font-medium text-primary"
                                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}
                              >
                                {done ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
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
              </TerminalFrame>
            </Reveal>
          </div>
        </aside>
      </div>
    </div>
  );
}
