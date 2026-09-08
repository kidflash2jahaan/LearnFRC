import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDepartmentBySlug,
  getLessonContent,
  getAllDepartmentSlugs,
  flattenLessons,
} from "@/lib/queries";
import { Markdown, extractHeadings } from "@/components/markdown";
import { JsonLd } from "@/components/json-ld";
import type { Resource, QuizQuestion } from "@/lib/types";
import { MyProgressProvider } from "@/components/progress/my-progress";
import {
  LessonOpenBeacon,
  LessonStatusChip,
  LessonActionsIsland,
  ReadingRailIsland,
  LessonCompleteIsland,
  MobileProgressCard,
  LessonStatusDot,
  SuggestEditIsland,
} from "./_progress-islands";
import { LessonSignupHook } from "@/components/lesson/lesson-signup-hook";
import { Provenance } from "@/components/lesson/provenance";
import { VerifiedBadge } from "@/components/lesson/verified-badge";
import { LessonReadNext } from "@/components/lesson/lesson-read-next";
import {
  LessonNextStep,
  type NextStepLink,
} from "@/components/lesson/lesson-next-step";
import { Reveal } from "@/components/motion/primitives";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

/** Short topic qualifier appended to lesson <title>s ("…, FRC CAD in
    Onshape") so lessons can match FRC-modified searches. */
const DEPT_TITLE_KEYWORD: Record<string, string> = {
  "getting-started": "Rookie Guide",
  "mechanical-build": "Mechanical",
  "programming-software": "Programming",
  "electrical-wiring": "Electrical",
  "cad-design": "CAD in Onshape",
  "scouting-strategy": "Scouting",
  "drive-team": "Drive Team",
  "business-operations": "Team Business",
  "media-outreach": "Outreach",
  "impact-award": "Impact Award",
  safety: "Safety",
};

// Static/ISR: the lesson body is identical for everyone and crawlers, so this
// page is prerendered and revalidated on the catalog window. Per-user progress
// (completed state, bookmarks, mastery rail, mark-complete/quiz) hydrates
// client-side from /api/me/progress, see the `Lesson*` islands below.
// (Previously force-dynamic only to read the session; that read is now client.)
export const revalidate = 86400; // daily background ISR floor; content edits push live via /api/revalidate (hourly was needless ISR-write churn)
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
  // Qualify the title with "FRC <department topic>" so the page can match the
  // FRC-modified queries people actually type ("Assemblies and Mates" alone
  // matches nothing). Skip the qualifier when it would blow past ~60 chars.
  const keyword = DEPT_TITLE_KEYWORD[department];
  const qualified = keyword ? `${les.title}, FRC ${keyword}` : les.title;
  const pageTitle = qualified.length <= 62 ? qualified : les.title;
  return {
    title: { absolute: pageTitle },
    description,
    alternates: { canonical: url },
    openGraph: {
      title: pageTitle,
      description,
      url,
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
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

  const flat = flattenLessons(dept);
  const idx = flat.findIndex((l) => l.id === les.id);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;
  // Every lesson id in the department, the client islands derive per-dept
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

  // Same extraction the Markdown renderer uses, so the rail's ids match the
  // article's rendered heading ids exactly.
  const headings = extractHeadings(content);

  // ---- end-of-lesson continuation data (see <LessonNextStep/>) -------------
  // All derived server-side from the department tree we already loaded, so the
  // whole block is static HTML, crawler-visible, zero extra queries, no CLS.
  const moduleHref = `/guides/${dept.slug}/${mod.slug}`;
  const posInModule = mod.lessons.findIndex((l) => l.id === les.id) + 1;
  const toLink = (l: {
    title: string;
    summary: string | null;
    slug: string;
    moduleSlug?: string;
  }): NextStepLink => ({
    title: l.title,
    summary: l.summary,
    href: `/guides/${dept.slug}/${l.moduleSlug ?? mod.slug}/${l.slug}`,
  });

  // "Related" means same module first, those are genuinely adjacent in scope.
  // Only if this module has nothing else to offer do we fall back to the
  // nearest lessons in the department, and the label says so.
  const skip = new Set([les.id, next?.id].filter(Boolean) as string[]);
  const siblings = mod.lessons.filter((l) => !skip.has(l.id));
  const related: NextStepLink[] = siblings.length
    ? siblings.slice(0, 4).map((l) => toLink(l))
    : flat
        .filter((l) => !skip.has(l.id))
        .slice(Math.max(0, idx - 2), Math.max(0, idx - 2) + 4)
        .map((l) => toLink(l));
  const relatedLabel = siblings.length
    ? `More in ${mod.title}`
    : `More in ${dept.name}`;

  const first = flat[0];
  const startHref = first
    ? `/guides/${dept.slug}/${first.moduleSlug}/${first.slug}`
    : `/guides/${dept.slug}`;

  const ARTICLE_ID = "lesson-body";


  return (
    <MyProgressProvider>
      {/* Records `lesson_opened`. Renders nothing, and it is mounted at the top
          of the tree so the milestone does not depend on how far down the page
          a reader scrolls or on which optional block happens to render. */}
      <LessonOpenBeacon />

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
          // Mirrors the on-page breadcrumb, module tier included, the
          // standalone module route exists now, so this no longer skips a level.
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
              name: mod.title,
              item: `${SITE}/guides/${dept.slug}/${mod.slug}`,
            },
            {
              "@type": "ListItem",
              position: 5,
              name: les.title,
              item: `${SITE}${lessonPath}`,
            },
          ],
        }}
      />

      {/* ================= THE SHEET HEADER =================
          This is one page of the binder, so the top of it is written the way a
          student writes the top of a worksheet: the file path, the title, one
          line saying what it is, then a ruled row of the facts (which lesson,
          how long, which module) with the two controls at the end of it. The
          old page put all of that inside a floating panel; a panel here would
          be a second sheet laid on the sheet you are already reading. */}
      <div className="nb-wrap pb-[clamp(2.4rem,5vw,4rem)] pt-[clamp(1.8rem,4vw,3rem)]">
        <nav aria-label="Breadcrumb" className="nb-slug -my-2 flex flex-wrap items-center gap-x-2">
          <Link href="/guides" className="inline-flex min-h-11 items-center py-2 hover:text-blue">
            guides
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/guides/${dept.slug}`}
            className="inline-flex min-h-11 items-center py-2 hover:text-blue"
          >
            {dept.slug}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={moduleHref} className="inline-flex min-h-11 items-center py-2 hover:text-blue">
            {mod.slug}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="inline-flex min-h-11 items-center py-2 font-bold text-ink">
            {les.slug}
          </span>
        </nav>

        <header className="mt-[clamp(1rem,2.2vw,1.6rem)]">
          <h1 className="max-w-[17ch]">{les.title}</h1>

          {les.summary && <p className="nb-lede mt-[clamp(0.9rem,1.8vw,1.3rem)]">{les.summary}</p>}

          {/* The facts, ruled off. `dl` because every one of these is a label
              and its value, and a screen reader should read them as pairs
              rather than as a run of loose numbers. */}
          <div className="nb-rule mt-[clamp(1.4rem,2.8vw,2.1rem)] flex flex-wrap items-end justify-between gap-x-[clamp(1.2rem,3vw,2.6rem)] gap-y-5 pt-4">
            <dl className="flex flex-wrap items-end gap-x-[clamp(1.2rem,3vw,2.6rem)] gap-y-4">
              <div>
                <dt className="nb-slug">this lesson</dt>
                <dd className="nb-count mt-1.5">
                  {idx + 1}
                  <small>of {flat.length} in {dept.name}</small>
                </dd>
              </div>
              <div>
                <dt className="nb-slug">reading time</dt>
                <dd className="nb-count mt-1.5">
                  {readMins}
                  <small>min</small>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="nb-slug">filed under</dt>
                <dd className="mt-1.5 max-w-[22ch] truncate text-[0.98rem] font-bold leading-tight">
                  <Link href={moduleHref} className="no-underline hover:text-blue">
                    {mod.title}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="nb-slug">state</dt>
                <dd className="mt-1.5">
                  <LessonStatusChip lessonId={les.id} />
                </dd>
              </div>
            </dl>

            <LessonActionsIsland
              lessonId={les.id}
              deptSlug={dept.slug}
              lessonPath={lessonPath}
              quizRequired={quiz.length > 0}
            />
          </div>
        </header>

        {/* ================= MARGIN + SHEET =================
            A notebook page has a ruled margin down its left edge and the
            writing to the right of it. That is the whole layout: the rail is
            the margin, the 2px ink line between them is the margin rule, and
            everything the reader came for lives in the second column. Below
            1024px there is no margin, so the rail's mobile counterpart is the
            progress card further down. */}
        <div className="mt-[clamp(2rem,4vw,3.2rem)] grid gap-[clamp(1.8rem,3.5vw,3rem)] lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-0">
          <aside className="hidden lg:block lg:pr-[clamp(1.6rem,2.6vw,2.6rem)]">
            <div className="sticky top-[clamp(5rem,7vw,6.5rem)]">
              <ReadingRailIsland
                deptName={dept.name}
                deptSlug={dept.slug}
                headings={headings}
                lessonIds={flatIds}
                lessonPath={lessonPath}
              />
            </div>
          </aside>

          <article
            id={ARTICLE_ID}
            className="min-w-0 lg:border-l-2 lg:border-ink lg:pl-[clamp(1.8rem,3vw,3rem)]"
          >
            <div className="nb-prose">
              <Markdown content={content} />
            </div>

            {/* Key takeaways. `nb-note` is the system's callout, and this is
                the archetypal one: the thing the student underlined twice at
                the bottom of the page before closing the binder.

                THE ONLY MOTION ON A LESSON PAGE, and it gets exactly one for a
                reason that has nothing to do with taste. A student working
                through a department opens this route ten or twenty times in a
                sitting, which is the frequency tier where animation stops
                reading as craft and starts reading as a wait. So: nothing in
                the header, nothing in the prose, nothing on the pagination,
                and one 14px settle on the single block whose whole job is to
                be noticed after the reading stops. It marks the seam between
                the lesson and its distillation, and it fires once, well below
                the fold, on a transform only. */}
            {takeaways.length > 0 && (
              <Reveal as="section" aria-labelledby="takeaways-heading" className="nb-note mt-[clamp(2rem,4vw,3rem)]">
                <p className="nb-slug">the part worth keeping</p>
                <h2 id="takeaways-heading" className="mt-1.5 text-[clamp(1.15rem,1rem+0.6vw,1.45rem)]">
                  Key takeaways
                </h2>
                <ul className="mt-3 grid gap-2.5">
                  {takeaways.map((t, i) => (
                    <li key={i} className="relative pl-5 leading-relaxed">
                      <span aria-hidden="true" className="absolute left-0 font-bold text-blue">
                        -
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {/* Continuation FIRST. Measured: the old page put the only "next
                lesson" link 2,305px below the end of the prose, behind a
                1,102px quiz, and offered four outbound target="_blank" links
                before it. The reader met the exit before the continuation. */}
            <LessonNextStep
              deptName={dept.name}
              deptHref={`/guides/${dept.slug}`}
              moduleTitle={mod.title}
              moduleHref={moduleHref}
              moduleLessonCount={mod.lessons.length}
              positionInModule={posInModule}
              next={next ? { title: next.title, summary: next.summary, href: nextHref } : null}
              nextIsNewModule={!!next && next.moduleSlug !== mod.slug}
              related={related}
              relatedLabel={relatedLabel}
              startHref={startHref}
              showStart={idx > 0}
            />

            {/* The verified mark, immediately above the sources it was checked
                against. Renders nothing until the lesson has been verified, so
                this is a no-op on most pages for now. Placed BEFORE the
                colophon rather than inside it: on a page that has been checked,
                that is the first thing a sceptical reader wants. */}
            <VerifiedBadge verifiedAt={body?.verified_at ?? null} />

            {/* Provenance: the lesson's sources, its last logged correction,
                and the report-an-error control. The links are the same
                `resources` rows; what changed is that the page now says where
                the lesson came from and how to challenge it, which is the
                actual answer to "this is AI slop". */}
            <Provenance kind="lesson" path={lessonPath} sources={resources}>
              <SuggestEditIsland
                contentType="lesson"
                targetId={les.id}
                title={les.title}
                path={lessonPath}
                content={content}
                dense
              />
            </Provenance>

            {/* Into the articles. Lessons are the biggest surface on the site
                and were sending zero internal links to the pages that actually
                pull search traffic. */}
            <LessonReadNext lessonId={les.id} />

            {/* completion / quiz */}
            <LessonCompleteIsland
              lessonId={les.id}
              deptSlug={dept.slug}
              lessonPath={lessonPath}
              quiz={quiz}
              nextHref={nextHref}
            />

            {/* logged-out conversion: save progress / continue the path */}
            <LessonSignupHook
              department={dept.name}
              count={flat.length}
              position={idx + 1}
              lessonPath={lessonPath}
              lessonIds={flatIds}
            />

            {/* mobile: what the margin rail carries on a desktop */}
            <MobileProgressCard deptName={dept.name} lessonIds={flatIds} />

            {/* ---- the running footer ----
                A printed page ends with what came before it and what comes
                after, set in the footer margin. No cards: two cards here would
                compete with the completion control above, which is the only
                thing on this page that records that the lesson was read. */}
            <nav
              aria-label="Lesson pagination"
              className="nb-rule mt-[clamp(2rem,4vw,3rem)] grid gap-y-0 pt-5 sm:grid-cols-2 sm:gap-x-8"
            >
              {prev ? (
                <Link
                  href={`/guides/${dept.slug}/${prev.moduleSlug}/${prev.slug}`}
                  className="group flex min-w-0 flex-col justify-start py-2 no-underline"
                  rel="prev"
                >
                  <span className="nb-slug">&larr; the lesson before</span>
                  <span className="mt-1 font-bold leading-snug group-hover:text-blue">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <p className="flex min-w-0 flex-col justify-start py-2">
                  <span className="nb-slug">&larr; the start of the guide</span>
                  <span className="mt-1 font-bold leading-snug text-graphite">
                    This is the first lesson in {dept.name}
                  </span>
                </p>
              )}

              <Link
                href={next ? `/guides/${dept.slug}/${next.moduleSlug}/${next.slug}` : `/guides/${dept.slug}`}
                className="group nb-hair flex min-w-0 flex-col justify-start py-2 no-underline sm:border-t-0 sm:text-right"
                {...(next ? { rel: "next" } : {})}
              >
                <span className="nb-slug">
                  {next ? "the lesson after →" : "back to the department →"}
                </span>
                <span className="mt-1 font-bold leading-snug group-hover:text-blue">
                  {next ? next.title : dept.name}
                </span>
              </Link>
            </nav>

            {/* ---- the whole department, folded away ----
                Every lesson in the guide, closed by default because a reader
                mid-lesson did not ask for a 394-line index. Open, it is the
                contents page: modules ruled off, lessons under them, the one
                you are on marked in ink and not only in colour.

                It opens instantly, on purpose. Sliding a `<details>` open means
                animating height, and the only ways to do that are a layout
                animation on every frame or `::details-content` plus
                `interpolate-size`, which is one engine only. Both are outside
                the budget: transform and opacity, or it does not ship. */}
            <details className="nb-box mt-[clamp(2rem,4vw,3rem)] overflow-hidden">
              <summary className="nb-slug flex min-h-[3.4rem] cursor-pointer list-none items-center justify-between gap-3 px-[clamp(1rem,2.2vw,1.5rem)] py-3 text-ink">
                <span className="min-w-0 truncate font-bold">
                  All {flat.length} lessons in {dept.name}
                </span>
                {/* Two words, not a glyph: the control says what it does, and
                    it still says it in a screen reader and in greyscale. */}
                <span className="shrink-0 text-blue">
                  <span className="[details[open]_&]:hidden">open</span>
                  <span className="hidden [details[open]_&]:inline">close</span>
                </span>
              </summary>

              <div className="nb-rule px-[clamp(1rem,2.2vw,1.5rem)] pb-[clamp(1rem,2.2vw,1.5rem)] pt-1 sm:columns-2 sm:gap-x-[clamp(1.4rem,3vw,2.6rem)]">
                {dept.modules.map((m, mi) => (
                  <div key={m.id} className="mt-4 break-inside-avoid">
                    <p className="nb-slug border-b border-dashed border-rule pb-1.5">
                      {String(mi + 1).padStart(2, "0")} / {m.slug}
                    </p>
                    <ul className="mt-1">
                      {m.lessons.map((l) => {
                        const active = l.id === les.id;
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/guides/${dept.slug}/${m.slug}/${l.slug}`}
                              aria-current={active ? "page" : undefined}
                              className={
                                active
                                  ? "flex min-h-11 items-center gap-2 border-l-[3px] border-blue bg-[rgba(27,54,200,0.07)] py-1.5 pl-2.5 text-[0.92rem] font-bold leading-snug no-underline"
                                  : "flex min-h-11 items-center gap-2 border-l-[3px] border-transparent py-1.5 pl-2.5 text-[0.92rem] leading-snug text-graphite no-underline hover:border-rule hover:text-ink"
                              }
                            >
                              <LessonStatusDot lessonId={l.id} />
                              <span className="min-w-0 flex-1">{l.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </article>
        </div>
      </div>
    </MyProgressProvider>
  );
}
