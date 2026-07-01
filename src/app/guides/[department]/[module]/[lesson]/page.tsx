import type { Metadata } from "next";
import type { CSSProperties } from "react";
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
import { AnimatedCounter } from "@/components/animated-counter";
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
  const accentStyle = { "--a": meta.color } as CSSProperties;

  return (
    <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="aq-glow -z-10">
        <span
          className="aq-float left-[-6%] top-[6%] h-72 w-72 opacity-50"
          style={{ background: "radial-gradient(circle, #2560e6, transparent 70%)" }}
        />
        <span
          className="aq-float right-[-4%] top-[30%] h-80 w-80 opacity-40"
          style={{ background: `radial-gradient(circle, ${meta.color}, transparent 70%)`, animationDelay: "1.4s" }}
        />
        <span
          className="aq-float bottom-[8%] left-[24%] h-72 w-72 opacity-30"
          style={{ background: "radial-gradient(circle, #1aa9d6, transparent 70%)", animationDelay: "2.6s" }}
        />
      </div>

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
      <nav
        className="aq-rise aq-rise-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <Link href="/guides" className="transition-colors hover:text-primary">
          Guides
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
        <Link
          href={`/guides/${dept.slug}`}
          className="transition-colors hover:text-primary"
        >
          {dept.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
        <span className="truncate font-medium text-foreground">{les.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-12">
        {/* main */}
        <article className="min-w-0">
          {/* hero: the reading experience */}
          <header className="aq-rise aq-rise-2">
            <Stagger className="flex flex-wrap items-center gap-2.5" stagger={0.06}>
              {/* department chip w/ glossy badge */}
              <StaggerItem>
                <Link
                  href={`/guides/${dept.slug}`}
                  className="aq-chip aq-card-hover gap-2 !py-1 !pl-1.5 !pr-3.5"
                  style={accentStyle}
                >
                  <span className="aq-badge aq-badge-bob flex h-7 w-7 items-center justify-center rounded-full" style={accentStyle}>
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{dept.name}</span>
                </Link>
              </StaggerItem>
              <StaggerItem className="aq-chip font-mono text-xs">
                Lesson <AnimatedCounter value={idx + 1} /> / <AnimatedCounter value={flat.length} />
              </StaggerItem>
              <StaggerItem className="aq-chip gap-1.5 font-mono text-xs text-primary">
                <Zap className="h-3.5 w-3.5" /> +10 XP
              </StaggerItem>
              <StaggerItem
                className={cn(
                  "aq-chip gap-1.5 font-mono text-xs",
                  isCompleted ? "text-primary" : "text-accent"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <span className="aq-pulse inline-block h-2 w-2 rounded-full bg-accent" aria-hidden />
                )}
                {isCompleted ? "Completed" : "In progress"}
              </StaggerItem>
            </Stagger>

            <h1 className="mt-5 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.7rem] lg:leading-[1.08]">
              <span className="aq-grad-anim bg-gradient-to-r from-[#2560e6] via-[color:var(--a)] to-[#1aa9d6] bg-clip-text text-transparent" style={accentStyle}>
                {les.title}
              </span>
            </h1>
            {les.summary && (
              <p className="mt-3 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
                {les.summary}
              </p>
            )}
          </header>

          {/* actions bar */}
          <div className="aq-rise aq-rise-3 mt-6">
            <div className="aq-card aq-sheen p-4 sm:p-5">
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
                  <Info className="h-4 w-4 text-primary" />
                  <Link
                    href={`/login?next=${encodeURIComponent(lessonPath)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to track progress, earn XP, and save lessons.
                </p>
              )}
            </div>
          </div>

          {/* content */}
          <Reveal className="mt-8">
            <Markdown content={les.content} />
          </Reveal>

          {/* key takeaways */}
          {takeaways.length > 0 && (
            <Reveal>
              <section className="aq-card aq-card-hover aq-reveal mt-10 p-6">
                <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold">
                  <span className="aq-icon aq-badge-bob h-9 w-9">
                    <Lightbulb className="h-5 w-5" />
                  </span>
                  Key takeaways
                </h2>
                <ul className="mt-4 space-y-3">
                  {takeaways.map((t, i) => (
                    <li
                      key={i}
                      className="aq-reveal flex gap-3 text-foreground/85"
                      style={{ animationDelay: `${i * 0.07}s` }}
                    >
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          )}

          {/* resources */}
          {resources.length > 0 && (
            <Reveal>
              <section className="aq-card aq-card-hover aq-reveal mt-8 p-6">
                <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold">
                  <span
                    className="aq-icon aq-badge-bob h-9 w-9"
                    style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
                  >
                    <ExternalLink className="h-5 w-5" />
                  </span>
                  Go deeper
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {resources.map((r, i) => (
                    <li key={i} className="aq-reveal" style={{ animationDelay: `${i * 0.06}s` }}>
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
              </section>
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
                  className="aq-card aq-card-hover group flex h-full items-center gap-3 p-5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
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
                  className="aq-card aq-card-hover group flex h-full flex-row-reverse items-center gap-3 p-5 text-right"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
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
                  className="aq-card aq-card-hover group flex h-full flex-row-reverse items-center gap-3 p-5 text-right"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
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

        {/* sidebar — progress + tidy contents rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            {user && (
              <Reveal>
                <div className="aq-card aq-card-hover aq-sheen aq-reveal p-5">
                  <div className="aq-eyebrow">Your progress</div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-foreground">
                      <AnimatedCounter value={pct} suffix="%" />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      through {dept.name}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="aq-bar-anim h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundImage: deptGradient }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <AnimatedCounter value={doneInDept} /> / {total} lessons complete
                  </div>
                </div>
              </Reveal>
            )}

            <Reveal delay={0.05}>
              <nav
                aria-label="Lesson contents"
                className="aq-card aq-card-hover aq-reveal max-h-[calc(100vh-15rem)] overflow-y-auto p-4"
              >
                <Link
                  href={`/guides/${dept.slug}`}
                  className="mb-3 flex items-center gap-2.5 border-b border-border pb-3"
                >
                  <span
                    className="aq-badge aq-badge-bob flex h-9 w-9 items-center justify-center rounded-xl"
                    style={accentStyle}
                  >
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </span>
                  <span className="truncate font-display text-sm font-semibold">{dept.name}</span>
                </Link>
                <div className="space-y-3">
                  {dept.modules.map((m, mi) => (
                    <div key={m.id} className="aq-reveal" style={{ animationDelay: `${mi * 0.05}s` }}>
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
                                  "flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors",
                                  active
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
              </nav>
            </Reveal>
          </div>
        </aside>
      </div>
    </div>
  );
}
