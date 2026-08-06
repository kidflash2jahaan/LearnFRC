import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  Layers,
  ListTree,
  Sparkles,
} from "lucide-react";
import { getAllDepartmentSlugs, getDepartmentBySlug } from "@/lib/queries";
import type { DeptWithModules, ModuleRow } from "@/lib/queries";
import { deptMeta, inkFor } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { JsonLd } from "@/components/json-ld";
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

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

/**
 * The module hub — /guides/<department>/<module>.
 *
 * Every lesson URL already contains this path segment, but the segment itself
 * had no page, so walking a lesson URL upward hit a 404 and ~100 real, linkable
 * levels of the catalog simply did not exist. This route makes each module a
 * first-class page: the module's own overview, its lessons as real
 * server-rendered links with summaries, sibling-module navigation, and the way
 * back up to the department.
 *
 * Fully static/ISR like its neighbours — the content is identical for everyone
 * and for crawlers, so there is no per-user state here at all (progress rings
 * live on the department and lesson pages, which already hydrate them).
 */
export const revalidate = 86400; // daily background ISR floor; content edits push live via /api/revalidate
export const dynamicParams = true; // unknown module slugs still render on-demand → notFound

export async function generateStaticParams() {
  const slugs = await getAllDepartmentSlugs();
  const out: { department: string; module: string }[] = [];
  for (const department of slugs) {
    const dept = await getDepartmentBySlug(department);
    if (!dept) continue;
    for (const m of dept.modules) out.push({ department, module: m.slug });
  }
  return out;
}

// ─── SEO derivation ────────────────────────────────────────────────────────
// A bare module title ("Worked Examples & Mini-Projects", "Prerequisites") can
// not match any real search, exactly like the bare lesson titles the lesson
// route already qualifies. Titles and descriptions here are DERIVED from the
// module + department rows — nothing is hardcoded per module.

/** Short topic qualifier per department, used to build query-shaped titles. */
const DEPT_KEYWORD: Record<string, string> = {
  "getting-started": "Rookie Guide",
  "mechanical-build": "Mechanical",
  "programming-software": "Programming",
  "electrical-wiring": "Electrical",
  "cad-design": "CAD",
  "scouting-strategy": "Scouting",
  "drive-team": "Drive Team",
  "business-operations": "Team Business",
  "media-outreach": "Media & Outreach",
  "impact-award": "Impact Award",
  safety: "Safety",
};

const TITLE_MAX = 62;
const DESC_MIN = 145;
const DESC_MAX = 160;

const squash = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** Split prose into sentences without cutting on "e.g." / decimals / "FLL, FTC." */
function sentencesOf(s?: string | null): string[] {
  return squash(s)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .filter(Boolean);
}

/**
 * "FRC CAD: Worked Examples & Mini-Projects — 4 Lessons" — the longest variant
 * that still fits a ~60-char title tag, falling back to progressively shorter
 * shapes so long module titles degrade instead of getting truncated by Google.
 * Module titles that already contain a colon get the qualifier as a suffix, so
 * we never emit an unreadable "FRC X: Y: Z".
 */
function moduleTitleTag(title: string, kw: string | undefined, n: number): string {
  const plural = n === 1 ? "Lesson" : "Lessons";
  const candidates = !kw
    ? [`${title} — ${n} FRC ${plural}`, `${title} — FRC`]
    : title.includes(":")
      ? [
          `${title} — ${n} FRC ${kw} ${plural}`,
          `${title} — FRC ${kw}`,
          `FRC ${kw}: ${title}`,
          `${title} — FRC`,
        ]
      : [
          `FRC ${kw}: ${title} — ${n} ${plural}`,
          `FRC ${kw}: ${title}`,
          `${title} — FRC ${kw}`,
          `${title} — FRC`,
        ];
  return candidates.find((c) => c.length <= TITLE_MAX) ?? title;
}

/**
 * A 145–160 char snippet built from the module's real overview, topped up with
 * the actual lesson titles it contains (which is what a searcher wants to see)
 * rather than boilerplate.
 */
function moduleDescription({
  overview,
  title,
  deptName,
  lessonTitles,
}: {
  overview?: string | null;
  title: string;
  deptName: string;
  lessonTitles: string[];
}): string {
  const n = lessonTitles.length;
  const plural = n === 1 ? "lesson" : "lessons";
  let out = "";
  const append = (chunk: string) => {
    const next = out ? `${out} ${chunk}` : chunk;
    if (next.length > DESC_MAX) return false;
    out = next;
    return true;
  };

  for (const s of sentencesOf(overview)) {
    if (out.length >= DESC_MIN) break;
    if (!append(s)) break;
  }

  // A single overview sentence longer than the whole snippet budget: trim it at
  // a word boundary rather than dropping the module's real prose for filler.
  if (!out) {
    const ov = squash(overview);
    out = ov
      ? `${ov.slice(0, DESC_MAX - 1).replace(/[\s,;:]+\S*$/, "")}…`
      : `${title} — ${n} free FRC ${plural} in the LearnFRC ${deptName} guide.`;
  }

  if (out.length < DESC_MIN && n > 0) {
    let covers = "";
    for (const t of lessonTitles) {
      const next = covers ? `${covers}, ${t}` : `Covers ${t}`;
      if (`${out} ${next}.`.length > DESC_MAX) break;
      covers = next;
      if (`${out} ${covers}.`.length >= DESC_MIN) break;
    }
    if (covers) out = `${out} ${covers}.`;
  }

  if (out.length < DESC_MIN) {
    for (const tail of [
      `${n} free ${plural}, no signup needed.`,
      `${n} free FRC ${plural}.`,
      "Free to read.",
    ]) {
      if (append(tail)) break;
    }
  }

  return out;
}

/** Shared lookup for both generateMetadata and the page render. */
function findModule(dept: DeptWithModules | null, moduleSlug: string) {
  if (!dept) return null;
  const index = dept.modules.findIndex((m) => m.slug === moduleSlug);
  if (index === -1) return null;
  return { mod: dept.modules[index], index };
}

/** Department-page numbering: prerequisite modules read "Start here", rest 1..N. */
function moduleLabels(modules: ModuleRow[]): string[] {
  let regular = 0;
  return modules.map((m) => (m.is_prerequisite ? "Start here" : String(++regular)));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string; module: string }>;
}): Promise<Metadata> {
  const { department, module: moduleSlug } = await params;
  const dept = await getDepartmentBySlug(department).catch(() => null);
  const found = findModule(dept, moduleSlug);
  if (!dept || !found) return { title: "Module" };

  const { mod } = found;
  const lessons = mod.lessons ?? [];
  const url = `${SITE}/guides/${department}/${moduleSlug}`;
  const ogImage = `${SITE}/guides/${department}/opengraph-image`;
  const title = moduleTitleTag(mod.title, DEPT_KEYWORD[department], lessons.length);
  const description = moduleDescription({
    overview: mod.overview,
    title: mod.title,
    deptName: dept.name,
    lessonTitles: lessons.map((l) => l.title),
  });

  return {
    // The root template appends " · LearnFRC"; these are already full-length
    // title tags, so emit them as-is (same posture as the department route).
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ department: string; module: string }>;
}) {
  const { department, module: moduleSlug } = await params;
  const dept = await getDepartmentBySlug(department);
  if (!dept) notFound();
  const found = findModule(dept, moduleSlug);
  if (!found) notFound();

  const { mod, index } = found;
  const modules = dept.modules;
  const lessons = mod.lessons ?? [];
  const labels = moduleLabels(modules);
  const label = labels[index];
  const isPre = !!mod.is_prerequisite;

  const prev = index > 0 ? modules[index - 1] : null;
  const next = index < modules.length - 1 ? modules[index + 1] : null;

  const meta = deptMeta(dept.slug);
  const accent = meta.color;
  const ink = inkFor(accent);
  const accentStyle = { "--a": accent } as CSSProperties;

  const modulePath = `/guides/${dept.slug}/${mod.slug}`;
  const lessonHref = (slug: string) => `${modulePath}/${slug}`;
  const totalMinutes = lessons.reduce((s, l) => s + (l.estimated_minutes ?? 0), 0);
  const deptLessonTotal = modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0);

  // Intro prose: the module's own overview when it has one, otherwise a factual
  // sentence derived from where this module sits in the department.
  const overview =
    squash(mod.overview) ||
    `${mod.title} is ${isPre ? "the recommended starting point" : `module ${label}`} of ${modules.length} in the LearnFRC ${dept.name} guide — ${lessons.length} free ${lessons.length === 1 ? "lesson" : "lessons"} you can read in any order.`;

  return (
    <div className="relative overflow-x-clip">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
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
              item: `${SITE}${modulePath}`,
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${mod.title} — ${dept.name} lessons`,
          description: squash(mod.overview) || undefined,
          url: `${SITE}${modulePath}`,
          numberOfItems: lessons.length,
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          itemListElement: lessons.map((l, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: l.title,
            url: `${SITE}${lessonHref(l.slug)}`,
            item: {
              "@type": "LearningResource",
              name: l.title,
              description: l.summary ?? undefined,
              url: `${SITE}${lessonHref(l.slug)}`,
              learningResourceType: "lesson",
              inLanguage: "en",
              isAccessibleForFree: true,
              ...(l.estimated_minutes
                ? { timeRequired: `PT${l.estimated_minutes}M` }
                : {}),
              isPartOf: {
                "@type": "Course",
                name: dept.name,
                url: `${SITE}/guides/${dept.slug}`,
              },
            },
          })),
        }}
      />

      <Glow
        blobs={[
          { size: "620px", pos: { left: "-160px", top: "-230px" }, color: accent, opacity: 0.38 },
          { size: "540px", pos: { right: "-140px", top: "-90px" }, color: "#6ff0ea", opacity: 0.36, delay: 1.8 },
          { size: "500px", pos: { left: "30%", top: "620px" }, color: "#c8b6ff", opacity: 0.28, delay: 3.6 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-5xl px-4 pb-6 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Rise>
          <nav
            className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
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
            <span className="font-medium text-foreground">{mod.title}</span>
          </nav>
        </Rise>

        <RiseGroup className="mt-6">
          <RiseItem>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={`/guides/${dept.slug}`}
                className="ac-chip inline-flex min-h-11 items-center gap-2 !py-1 !pl-1.5 !pr-3.5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                style={accentStyle}
              >
                <span
                  className="ac-badge flex h-7 w-7 items-center justify-center rounded-full"
                  style={accentStyle}
                >
                  <Icon name={meta.icon} className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{dept.name}</span>
              </Link>
              <span className="ac-chip inline-flex items-center gap-1.5 text-xs">
                {isPre ? (
                  <Sparkles className="h-3.5 w-3.5" style={{ color: ink }} aria-hidden />
                ) : (
                  <Layers className="h-3.5 w-3.5" style={{ color: ink }} aria-hidden />
                )}
                <span className="font-medium">
                  {isPre
                    ? "Start here · Prerequisite module"
                    : `Module ${label} of ${modules.length}`}
                </span>
              </span>
            </div>
          </RiseItem>

          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-3xl font-extrabold leading-[1.06] tracking-tight sm:text-4xl lg:text-[2.9rem]">
              <span
                style={{
                  background: `linear-gradient(120deg, ${ink}, var(--accent))`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {mod.title}
              </span>
            </h1>
          </RiseItem>

          <RiseItem>
            <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/75">
              {overview}
            </p>
          </RiseItem>

          <RiseItem>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="ac-chip inline-flex items-center gap-1.5 text-sm">
                <BookOpen className="h-4 w-4" style={{ color: ink }} aria-hidden />
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </span>
              {totalMinutes > 0 && (
                <span className="ac-chip inline-flex items-center gap-1.5 text-sm">
                  <Clock className="h-4 w-4" style={{ color: ink }} aria-hidden />~
                  {totalMinutes} min
                </span>
              )}
              <span className="ac-chip inline-flex items-center gap-1.5 text-sm">
                <Layers className="h-4 w-4" style={{ color: ink }} aria-hidden />
                {deptLessonTotal} lessons in this guide
              </span>
            </div>
          </RiseItem>

          {lessons.length > 0 && (
            <RiseItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={lessonHref(lessons[0].slug)} className="ac-btn text-sm">
                  Start with {lessons.length === 1 ? "this lesson" : "lesson 1"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href={`/guides/${dept.slug}`} className="ac-btn-ghost text-sm">
                  All of {dept.name}
                </Link>
              </div>
            </RiseItem>
          )}
        </RiseGroup>
      </section>

      {/* ========================== THE LESSONS ========================= */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Reveal className="mb-5 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: ink,
              }}
            >
              <ListTree className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="ac-eyebrow">In this module</p>
              <h2 className="mt-0.5 font-display text-2xl font-bold">
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </h2>
            </div>
          </div>
        </Reveal>

        {lessons.length > 0 ? (
          <RevealGroup className="space-y-3">
            {lessons.map((l, i) => (
              <RevealItem key={l.id}>
                <Hover className="h-full" lift={-3}>
                  <Link
                    href={lessonHref(l.slug)}
                    className="ac-card group flex items-start gap-4 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border font-display text-sm font-semibold tabular-nums transition-transform duration-300 group-hover:scale-105"
                      style={{
                        color: ink,
                        borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[17px] font-bold leading-snug tracking-tight text-foreground group-hover:text-primary">
                        {l.title}
                      </span>
                      {l.summary && (
                        <span className="mt-1.5 block text-pretty text-sm leading-relaxed text-muted-foreground">
                          {l.summary}
                        </span>
                      )}
                      {l.estimated_minutes ? (
                        <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden />
                          <span className="tabular-nums">{l.estimated_minutes}</span> min
                          read
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight
                      className="mt-1 hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block"
                      aria-hidden
                    />
                  </Link>
                </Hover>
              </RevealItem>
            ))}
          </RevealGroup>
        ) : (
          <Reveal>
            <p className="ac-card p-5 text-sm text-muted-foreground">
              This module doesn&apos;t have published lessons yet.{" "}
              <Link href={`/guides/${dept.slug}`} className="underline hover:text-primary">
                Browse the rest of {dept.name}
              </Link>
              .
            </p>
          </Reveal>
        )}

        {/* prev / next module */}
        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
          <RevealItem>
            <Hover className="h-full" lift={-3}>
              <Link
                href={prev ? `/guides/${dept.slug}/${prev.slug}` : `/guides/${dept.slug}`}
                className="ac-card group flex h-full items-center gap-3 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                  <ArrowLeft
                    className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <small className="ac-eyebrow block">
                    {prev ? "Previous module" : "Department"}
                  </small>
                  <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                    {prev ? prev.title : dept.name}
                  </span>
                </span>
              </Link>
            </Hover>
          </RevealItem>
          <RevealItem>
            <Hover className="h-full" lift={-3}>
              <Link
                href={next ? `/guides/${dept.slug}/${next.slug}` : `/guides/${dept.slug}`}
                className="ac-card group flex h-full flex-row-reverse items-center gap-3 p-5 text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <small className="ac-eyebrow block">
                    {next ? "Next module" : "Finish"}
                  </small>
                  <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                    {next ? next.title : `Back to ${dept.name}`}
                  </span>
                </span>
              </Link>
            </Hover>
          </RevealItem>
        </RevealGroup>
      </section>

      {/* ===================== SIBLING MODULE INDEX ===================== */}
      {modules.length > 1 && (
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
          <Reveal>
            <div className="ac-card p-6" style={accentStyle}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-bold">
                  All {modules.length} modules in {dept.name}
                </h2>
                <Link
                  href={`/guides/${dept.slug}`}
                  className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Department overview
                </Link>
              </div>
              <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {modules.map((m, mi) => {
                  const current = m.slug === mod.slug;
                  const count = m.lessons?.length ?? 0;
                  const inner = (
                    <>
                      <span
                        className="w-8 shrink-0 text-xs font-semibold tabular-nums"
                        style={{ color: ink }}
                      >
                        {m.is_prerequisite ? "Pre" : labels[mi].padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </>
                  );
                  return (
                    // min-w-0: a grid item defaults to min-width:min-content,
                    // so without this the truncating title pushes the row wider
                    // than its column instead of ellipsing.
                    <li key={m.id} className="min-w-0">
                      {current ? (
                        <span
                          aria-current="page"
                          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
                        >
                          {inner}
                        </span>
                      ) : (
                        <Link
                          href={`/guides/${dept.slug}/${m.slug}`}
                          className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        </section>
      )}
    </div>
  );
}
