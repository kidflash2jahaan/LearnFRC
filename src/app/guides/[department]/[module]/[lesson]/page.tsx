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
  BookOpen,
  ListTree,
  Trophy,
} from "lucide-react";
import {
  getDepartmentBySlug,
  getCompletedLessonIds,
  getBookmarkedLessonIds,
  flattenLessons,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { deptMeta, inkFor } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Markdown, extractHeadings } from "@/components/markdown";
import { LessonActions } from "@/components/lesson/lesson-actions";
import { LessonComplete } from "@/components/lesson/lesson-complete";
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
import { JsonLd } from "@/components/json-ld";
import { cn } from "@/lib/utils";
import type { Resource, QuizQuestion } from "@/lib/types";
import { ReadingRail } from "./_reading-rail";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

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

  const { user, profile } = await getSession();
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

  // Real per-department progress (drives the reading rail + mobile card).
  const doneInDept = flat.filter((l) => completed.has(l.id)).length;
  const total = flat.length;
  const pct = total ? Math.round((doneInDept / total) * 100) : 0;
  const readMins = Math.max(1, Math.round((les.content?.split(/\s+/).length ?? 0) / 200));
  const deptGradient = `linear-gradient(135deg, ${meta.color}, ${meta.to})`;
  // --a: bright accent (fills/badges); --ai: darker same-hue tone for text.
  const ink = inkFor(meta.color);
  const accentStyle = { "--a": meta.color } as CSSProperties;

  // Same extraction the Markdown renderer uses, so the rail's ids match the
  // article's rendered heading ids exactly.
  const headings = extractHeadings(les.content ?? "");

  const ARTICLE_ID = "lesson-body";

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "620px", pos: { left: "5%", top: "-220px" }, color: "#2560e6", opacity: 0.4 },
          { size: "560px", pos: { right: "0%", top: "10%" }, color: meta.color, opacity: 0.35, delay: 1.4 },
          { size: "520px", pos: { left: "22%", top: "700px" }, color: "#1aa9d6", opacity: 0.25, delay: 2.6 },
        ]}
      />

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

      <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {/* breadcrumb */}
        <Rise>
          <nav
            className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <Link href="/guides" className="transition-colors hover:text-primary">
              Guides
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
            <Link href={`/guides/${dept.slug}`} className="transition-colors hover:text-primary">
              {dept.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
            <span className="truncate font-medium text-foreground">{les.title}</span>
          </nav>
        </Rise>

        {/* ============================ HERO ============================ */}
        <header className="mt-6">
          <RiseGroup className="flex flex-wrap items-center gap-2.5">
            <RiseItem>
              <Link
                href={`/guides/${dept.slug}`}
                className="ac-chip inline-flex items-center gap-2 !py-1 !pl-1.5 !pr-3.5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                style={accentStyle}
              >
                <span className="ac-badge flex h-7 w-7 items-center justify-center rounded-full" style={accentStyle}>
                  <Icon name={meta.icon} className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-sm font-medium">{dept.name}</span>
              </Link>
            </RiseItem>
            <RiseItem>
              <span className="ac-chip inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="tabular-nums">{readMins} min read</span>
              </span>
            </RiseItem>
            <RiseItem>
              <span
                className="ac-chip inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: isCompleted ? "var(--success)" : ink }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <span
                    className="inline-block h-2 w-2 animate-pulse rounded-full"
                    style={{ background: meta.color }}
                    aria-hidden
                  />
                )}
                {isCompleted ? "Completed" : "In progress"}
              </span>
            </RiseItem>
          </RiseGroup>

          <Rise delay={0.05}>
            <h1 className="mt-5 text-balance font-display text-3xl font-bold leading-[1.06] tracking-tight sm:text-4xl lg:text-[2.9rem]">
              <span style={BRAND_GRADIENT}>{les.title}</span>
            </h1>
          </Rise>
          {les.summary && (
            <Rise delay={0.1}>
              <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
                {les.summary}
              </p>
            </Rise>
          )}

          {/* lesson meta + actions — the glass "control deck" for this lesson */}
          <Rise delay={0.15}>
            <div className="mt-7">
              <div className="ac-glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-30 blur-2xl"
                  style={{ background: `radial-gradient(circle, ${meta.color}, transparent 70%)` }}
                />
                <div className="relative grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                  {/* stat cluster */}
                  <dl className="flex flex-wrap gap-x-7 gap-y-4">
                    <div>
                      <dt className="ac-eyebrow">Lesson</dt>
                      <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">
                        <AnimatedCounter value={idx + 1} />
                        <span className="text-lg text-muted-foreground"> / {flat.length}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="ac-eyebrow">Reward</dt>
                      <dd className="mt-1 flex items-center gap-1.5 font-display text-2xl font-bold text-foreground">
                        <Zap className="h-5 w-5 text-primary" aria-hidden />
                        +10<span className="text-lg text-muted-foreground">XP</span>
                      </dd>
                    </div>
                    <div className="hidden sm:block">
                      <dt className="ac-eyebrow">Module</dt>
                      <dd
                        className="mt-1 max-w-[16rem] truncate font-display text-base font-semibold text-foreground"
                        title={mod.title}
                      >
                        {mod.title}
                      </dd>
                    </div>
                  </dl>

                  {/* actions */}
                  <div className="sm:justify-self-end">
                    <LessonActions
                      lessonId={les.id}
                      deptSlug={dept.slug}
                      lessonPath={lessonPath}
                      authed={!!user}
                      initialCompleted={isCompleted}
                      initialBookmarked={bookmarks.has(les.id)}
                      quizRequired={quiz.length > 0}
                    />
                  </div>
                </div>
                {!user && (
                  <p className="relative mt-4 flex items-center gap-1.5 border-t border-white/40 pt-4 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>
                      <Link
                        href={`/login?next=${encodeURIComponent(lessonPath)}`}
                        className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        Sign in
                      </Link>{" "}
                      to track progress, earn XP, and save lessons.
                    </span>
                  </p>
                )}
              </div>
            </div>
          </Rise>
        </header>

        {/* ===================== BODY: rail + article ==================== */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
          {/* signature: sticky live contents/progress rail (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <ReadingRail
                deptName={dept.name}
                deptIcon={meta.icon}
                accent={meta.color}
                headings={headings}
                authed={!!user}
                pct={pct}
                doneInDept={doneInDept}
                totalInDept={total}
                lessonPath={lessonPath}
              />
            </div>
          </aside>

          {/* article */}
          <article id={ARTICLE_ID} className="min-w-0">
            <Reveal>
              <Markdown content={les.content} />
            </Reveal>

            {/* key takeaways */}
            {takeaways.length > 0 && (
              <Reveal>
                <section className="ac-card mt-10 p-6">
                  <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold">
                    <span className="ac-badge flex h-9 w-9 items-center justify-center" style={accentStyle}>
                      <Lightbulb className="h-5 w-5" aria-hidden />
                    </span>
                    Key takeaways
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {takeaways.map((t, i) => (
                      <li key={i} className="flex gap-3 text-foreground/85">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
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
                <section className="ac-card mt-8 p-6">
                  <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold">
                    <span
                      className="ac-badge flex h-9 w-9 items-center justify-center"
                      style={{ "--a": "#1aa9d6" } as CSSProperties}
                    >
                      <ExternalLink className="h-5 w-5" aria-hidden />
                    </span>
                    Go deeper
                  </h2>
                  <ul className="mt-4 space-y-2.5">
                    {resources.map((r, i) => (
                      <li key={i}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex min-h-9 items-start gap-2 text-foreground/85 transition-colors hover:text-[color:var(--ai)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          style={{ "--ai": ink } as CSSProperties}
                        >
                          <ChevronRight
                            className="mt-1 h-4 w-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
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
              referrerUsername={profile?.username ?? null}
            />

            {/* mobile: reading progress + dept progress card */}
            {user && (
              <Reveal>
                <div className="mt-10 lg:hidden">
                  <div className="ac-card p-5">
                    <div className="ac-eyebrow">Your progress</div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-3xl font-bold tabular-nums text-foreground">{pct}%</span>
                      <span className="text-sm text-muted-foreground">through {dept.name}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundImage: deptGradient }}
                      />
                    </div>
                    <div className="mt-2 text-xs tabular-nums text-muted-foreground">
                      {doneInDept} / {total} lessons complete
                    </div>
                  </div>
                </div>
              </Reveal>
            )}

            {/* prev / next */}
            <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
              {prev ? (
                <RevealItem>
                  <Hover className="h-full" lift={-3}>
                    <Link
                      href={`/guides/${dept.slug}/${prev.moduleSlug}/${prev.slug}`}
                      className="ac-card group flex h-full items-center gap-3 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <small className="ac-eyebrow block">Previous</small>
                        <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                          {prev.title}
                        </span>
                      </span>
                    </Link>
                  </Hover>
                </RevealItem>
              ) : (
                <span />
              )}
              {next ? (
                <RevealItem>
                  <Hover className="h-full" lift={-3}>
                    <Link
                      href={`/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`}
                      className="ac-card group flex h-full flex-row-reverse items-center gap-3 p-5 text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <small className="ac-eyebrow block">Next up</small>
                        <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                          {next.title}
                        </span>
                      </span>
                    </Link>
                  </Hover>
                </RevealItem>
              ) : (
                <RevealItem>
                  <Hover className="h-full" lift={-3}>
                    <Link
                      href={`/guides/${dept.slug}`}
                      className="ac-card group flex h-full flex-row-reverse items-center gap-3 p-5 text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                        <Trophy className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <small className="ac-eyebrow block">Finish</small>
                        <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                          Back to {dept.name}
                        </span>
                      </span>
                    </Link>
                  </Hover>
                </RevealItem>
              )}
            </RevealGroup>

            {/* full department contents — collapsible, all breakpoints */}
            <Reveal>
              <details className="ac-card mt-10 overflow-hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 p-5 font-display text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="ac-badge flex h-9 w-9 items-center justify-center" style={accentStyle}>
                    <ListTree className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    All {flat.length} lessons in {dept.name}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform [details[open]_&]:rotate-90"
                    aria-hidden
                  />
                </summary>
                <div className="space-y-4 border-t border-border p-4 sm:columns-2 sm:gap-6 sm:[&>div]:break-inside-avoid">
                  {dept.modules.map((m, mi) => (
                    <div key={m.id} className="mb-4">
                      <div className="ac-eyebrow px-1">
                        {String(mi + 1).padStart(2, "0")} &middot; {m.title}
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
                                  "flex min-h-11 items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                  active
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}
                              >
                                {done ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                                ) : (
                                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                )}
                                <span className="sr-only">{done ? "Completed:" : "Not started:"}</span>
                                <span className="line-clamp-1">{l.title}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </Reveal>
          </article>
        </div>
      </div>
    </div>
  );
}
