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
  ChevronRight,
  Info,
  Zap,
  BookOpen,
  ListTree,
  Trophy,
} from "lucide-react";
import {
  getDepartmentBySlug,
  getLessonContent,
  getAllDepartmentSlugs,
  flattenLessons,
} from "@/lib/queries";
import { deptMeta, inkFor } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Markdown, extractHeadings } from "@/components/markdown";
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
import { MyProgressProvider } from "@/components/progress/my-progress";
import {
  LessonStatusChip,
  LessonActionsIsland,
  SignupPrompt,
  ReadingRailIsland,
  LessonCompleteIsland,
  MobileProgressCard,
  LessonStatusDot,
  SuggestEditIsland,
} from "./_progress-islands";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

// Static/ISR: the lesson body is identical for everyone and crawlers, so this
// page is prerendered and revalidated on the catalog window. Per-user progress
// (completed state, bookmarks, mastery rail, mark-complete/quiz) hydrates
// client-side from /api/me/progress — see the `Lesson*` islands below.
// (Previously force-dynamic only to read the session; that read is now client.)
export const revalidate = 3600; // CATALOG_TTL — matches the content-layer cache
export const dynamicParams = true; // lessons not prebuilt still render on-demand

export async function generateStaticParams() {
  const slugs = await getAllDepartmentSlugs();
  const out: { department: string; module: string; lesson: string }[] = [];
  for (const department of slugs) {
    const dept = await getDepartmentBySlug(department);
    if (!dept) continue;
    for (const m of dept.modules) {
      for (const l of m.lessons) {
        out.push({ department, module: m.slug, lesson: l.slug });
      }
    }
  }
  return out;
}

/** Strip common markdown syntax down to plain prose for meta descriptions. */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_>#~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const ogImage = `${SITE}/guides/${department}/opengraph-image`;
  // Description falls back to the department tagline, then a plain-text excerpt
  // of the lesson body, when the lesson has no summary of its own.
  const stripped = les.content ? stripMarkdown(les.content) : "";
  const excerpt = stripped
    ? `${stripped.slice(0, 155).trim()}${stripped.length > 155 ? "…" : ""}`
    : undefined;
  const description =
    (les.summary && les.summary.trim()) ||
    (dept?.tagline ?? undefined) ||
    excerpt;
  return {
    title: les.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: les.title,
      description,
      url,
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: les.title,
      description,
      images: [ogImage],
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
  // Every lesson id in the department — the client islands derive per-dept
  // progress (reading rail + mobile card) from these + the fetched completion set.
  const flatIds = flat.map((l) => l.id);

  // The heavy lesson body (markdown, takeaways, resources, quiz) is fetched and
  // cached separately so list/nav queries never carry lesson content. It's the
  // same for everyone, so it stays server-rendered; per-user progress hydrates
  // client-side (see the Lesson* islands below).
  const body = await getLessonContent(les.id);
  const lessonPath = `/guides/${dept.slug}/${mod.slug}/${les.slug}`;

  const content = body?.content ?? "";
  const takeaways = (body?.key_takeaways ?? []) as string[];
  const resources = (body?.resources ?? []) as Resource[];
  const quiz = (body?.quiz ?? []) as QuizQuestion[];
  const nextHref = next
    ? `/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`
    : `/guides/${dept.slug}`;

  const readMins = Math.max(1, Math.round((content?.split(/\s+/).length ?? 0) / 200));
  const deptGradient = `linear-gradient(135deg, ${meta.color}, ${meta.to})`;
  // --a: bright accent (fills/badges); --ai: darker same-hue tone for text.
  const ink = inkFor(meta.color);
  const accentStyle = { "--a": meta.color } as CSSProperties;

  // Same extraction the Markdown renderer uses, so the rail's ids match the
  // article's rendered heading ids exactly.
  const headings = extractHeadings(content);

  const ARTICLE_ID = "lesson-body";

  return (
    <MyProgressProvider>
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
          inLanguage: "en",
          isAccessibleForFree: true,
          timeRequired: `PT${readMins}M`,
          educationalLevel: "Beginner",
          about: "FIRST Robotics Competition",
          image: `${SITE}/guides/${dept.slug}/opengraph-image`,
          isPartOf: {
            "@type": "Course",
            name: dept.name,
            url: `${SITE}/guides/${dept.slug}`,
          },
          provider: { "@type": "Organization", name: "LearnFRC", url: SITE },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          // Mirrors the on-page breadcrumb. There is no standalone module route,
          // so the module tier is omitted rather than linking a 404.
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE}/guides` },
            {
              "@type": "ListItem",
              position: 3,
              name: dept.name,
              item: `${SITE}/guides/${dept.slug}`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: les.title,
              item: `${SITE}${lessonPath}`,
            },
          ],
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
              <LessonStatusChip lessonId={les.id} ink={ink} accentColor={meta.color} />
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
                    <LessonActionsIsland
                      lessonId={les.id}
                      deptSlug={dept.slug}
                      lessonPath={lessonPath}
                      quizRequired={quiz.length > 0}
                    />
                  </div>
                </div>
                <SignupPrompt lessonPath={lessonPath}>
                  <p className="relative mt-4 flex items-center gap-1.5 border-t border-white/40 pt-4 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>
                      <Link
                        href={`/signup?next=${encodeURIComponent(lessonPath)}`}
                        className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        Create a free account
                      </Link>{" "}
                      to track progress, earn XP, and save lessons.
                    </span>
                  </p>
                </SignupPrompt>
              </div>
            </div>
          </Rise>
        </header>

        {/* ===================== BODY: rail + article ==================== */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
          {/* signature: sticky live contents/progress rail (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <ReadingRailIsland
                deptName={dept.name}
                deptIcon={meta.icon}
                accent={meta.color}
                headings={headings}
                lessonIds={flatIds}
                lessonPath={lessonPath}
              />
            </div>
          </aside>

          {/* article */}
          <article id={ARTICLE_ID} className="min-w-0">
            <Reveal>
              <Markdown content={content} />
            </Reveal>

            <SuggestEditIsland
              contentType="lesson"
              targetId={les.id}
              title={les.title}
              path={lessonPath}
              content={content}
            />

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
            <LessonCompleteIsland
              lessonId={les.id}
              deptSlug={dept.slug}
              lessonPath={lessonPath}
              quiz={quiz}
              nextHref={nextHref}
            />

            {/* mobile: reading progress + dept progress card */}
            <MobileProgressCard
              deptName={dept.name}
              deptGradient={deptGradient}
              lessonIds={flatIds}
            />

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
                                <LessonStatusDot lessonId={l.id} />
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
    </MyProgressProvider>
  );
}
