import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Layers,
  Check,
  Wrench,
  ListChecks,
  ExternalLink,
  Sparkles,
  Award,
} from "lucide-react";
import { getDepartmentBySlug, getCompletedLessonIds, flattenLessons } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { deptMeta } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { DepartmentModules } from "@/components/guides/department-modules";
import { AnimatedCounter } from "@/components/animated-counter";
import { JsonLd } from "@/components/json-ld";
import type { Resource } from "@/lib/types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<Metadata> {
  const { department } = await params;
  const dept = await getDepartmentBySlug(department).catch(() => null);
  if (!dept) return { title: "Department" };
  return {
    title: dept.name,
    description: dept.tagline ?? dept.description ?? undefined,
  };
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const dept = await getDepartmentBySlug(department);
  if (!dept) notFound();

  const { user } = await getSession();
  const completed = user ? await getCompletedLessonIds(user.id) : new Set<string>();

  const meta = deptMeta(dept.slug);
  const flat = flattenLessons(dept);
  const totalLessons = flat.length;
  const totalModules = dept.modules.length;
  const doneCount = flat.filter((l) => completed.has(l.id)).length;
  const pct = totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0;

  const firstLesson = flat[0];
  const nextLesson = flat.find((l) => !completed.has(l.id)) ?? firstLesson;
  const ctaLabel = doneCount === 0 ? "Start learning" : doneCount === totalLessons ? "Review" : "Continue";
  const ctaHref = nextLesson
    ? `/guides/${dept.slug}/${nextLesson.moduleSlug}/${nextLesson.slug}`
    : `/guides/${dept.slug}`;

  const learn = (dept.what_youll_learn ?? []) as string[];
  const tools = (dept.tools ?? []) as string[];
  const prereqs = (dept.prerequisites ?? []) as string[];
  const sources = (dept.sources ?? []) as Resource[];

  const accent = meta.color;

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate overflow-hidden text-foreground"
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: dept.name,
          description: dept.tagline ?? dept.description ?? undefined,
          url: `${SITE}/guides/${dept.slug}`,
          provider: {
            "@type": "Organization",
            name: "LearnFRC",
            url: SITE,
          },
        }}
      />

      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[620px] w-[620px] opacity-60"
          style={{
            left: "-180px",
            top: "-220px",
            background: `radial-gradient(circle, ${accent}, transparent 70%)`,
          }}
        />
        <span
          className="h-[560px] w-[560px] opacity-45"
          style={{
            right: "-160px",
            top: "-120px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[520px] w-[520px] opacity-40"
          style={{
            left: "30%",
            top: "420px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Link
          href="/guides"
          className="aq-rise aq-rise-1 group/back inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover/back:-translate-x-0.5" />
          All departments
        </Link>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          {/* hero copy */}
          <div>
            <p className="aq-rise aq-rise-1 aq-eyebrow">
              <Sparkles className="h-3.5 w-3.5" /> Department guide
            </p>

            <div className="aq-rise aq-rise-2 mt-4 flex items-center gap-4">
              <span
                className="aq-badge aq-badge-bob flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
                style={{ "--a": accent } as CSSProperties}
              >
                <Icon name={meta.icon} className="h-8 w-8" />
              </span>
              <h1 className="aq-display text-balance text-4xl font-extrabold leading-[1.05] sm:text-5xl">
                <span
                  className="aq-grad-anim"
                  style={{
                    background: `linear-gradient(120deg, ${accent}, #1aa9d6, ${accent})`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {dept.name}
                </span>
              </h1>
            </div>

            {dept.tagline && (
              <p className="aq-rise aq-rise-2 mt-4 max-w-2xl text-pretty text-xl font-medium text-foreground/80">
                {dept.tagline}
              </p>
            )}

            {dept.description && (
              <p className="aq-rise aq-rise-3 mt-3 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
                {dept.description}
              </p>
            )}

            <div className="aq-rise aq-rise-3 mt-6 flex flex-wrap items-center gap-2.5">
              <span className="aq-chip">
                <Layers className="h-4 w-4" style={{ color: accent }} />
                <AnimatedCounter value={totalModules} /> modules
              </span>
              <span className="aq-chip">
                <BookOpen className="h-4 w-4" style={{ color: accent }} />
                <AnimatedCounter value={totalLessons} /> lessons
              </span>
              {user && doneCount > 0 && (
                <span className="aq-chip font-semibold text-primary">
                  <AnimatedCounter value={pct} suffix="% complete" />
                </span>
              )}
            </div>

            <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={ctaHref}
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {pct === 100 && (
                <Link
                  href={`/certificate/${dept.slug}`}
                  className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Award className="h-4 w-4" /> Get certificate
                </Link>
              )}
            </div>
          </div>

          {/* progress panel */}
          <aside className="aq-rise aq-rise-4 aq-float lg:pt-1">
            <div
              className="aq-glass aq-sheen relative overflow-hidden rounded-3xl p-6"
              style={{ "--a": accent } as CSSProperties}
            >
              <p className="aq-eyebrow flex items-center gap-2">
                <span className="aq-pulse inline-block h-2 w-2 rounded-full" style={{ background: accent }} />
                Your progress
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      strokeWidth="9"
                      className="stroke-primary/10"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      strokeWidth="9"
                      strokeLinecap="round"
                      stroke={accent}
                      className="aq-ring-anim"
                      style={{
                        strokeDasharray: 2 * Math.PI * 42,
                        strokeDashoffset: 2 * Math.PI * 42 * (1 - pct / 100),
                      }}
                    />
                  </svg>
                  <span
                    className="aq-display absolute inset-0 flex items-center justify-center text-xl font-extrabold leading-none"
                    style={{ color: accent }}
                  >
                    <AnimatedCounter value={pct} suffix="%" />
                  </span>
                </div>
                <div>
                  <span className="aq-display block text-3xl font-extrabold leading-none" style={{ color: accent }}>
                    <AnimatedCounter value={doneCount} />
                  </span>
                  <span className="mt-1 block text-sm font-medium text-foreground/70">
                    of {totalLessons} lessons done
                  </span>
                </div>
              </div>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-primary/10">
                <div
                  className="aq-bar-anim h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${accent}, #1aa9d6)`,
                  }}
                />
              </div>
              {!user && (
                <p className="mt-4 text-sm leading-relaxed text-foreground/70">
                  Reading is free — no login needed. Sign in to track what
                  you&apos;ve mastered through the season.
                </p>
              )}
              {user && doneCount === totalLessons && totalLessons > 0 && (
                <p className="mt-4 text-sm font-medium text-foreground/80">
                  Department complete. Gracious professionalism, well earned.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* ============================ BODY ============================ */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8 lg:py-14">
        {/* main: modules */}
        <div className="aq-reveal lg:col-span-2">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="aq-eyebrow">The curriculum</p>
              <h2 className="aq-display mt-1 text-2xl font-bold">Modules &amp; lessons</h2>
            </div>
            <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">
              <AnimatedCounter value={totalModules} /> modules · <AnimatedCounter value={totalLessons} /> lessons
            </span>
          </div>
          <DepartmentModules
            departmentSlug={dept.slug}
            modules={dept.modules}
            completedIds={[...completed]}
            accent={accent}
          />
        </div>

        {/* sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {learn.length > 0 && (
            <div className="aq-reveal aq-card aq-card-hover p-5" style={{ animationDelay: "60ms" } as CSSProperties}>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <span
                  className="aq-icon aq-badge-bob flex h-8 w-8 items-center justify-center"
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    color: accent,
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                What you&apos;ll learn
              </h3>
              <ul className="space-y-2.5">
                {learn.map((item, i) => (
                  <li
                    key={i}
                    className="aq-reveal flex gap-2.5 text-[15px] leading-relaxed text-foreground/85"
                    style={{ animationDelay: `${120 + i * 55}ms` } as CSSProperties}
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tools.length > 0 && (
            <div className="aq-reveal aq-card aq-card-hover p-5" style={{ animationDelay: "120ms" } as CSSProperties}>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <span className="aq-icon aq-badge-bob flex h-8 w-8 items-center justify-center text-accent">
                  <Wrench className="h-4 w-4" />
                </span>
                Tools &amp; tech
              </h3>
              <div className="flex flex-wrap gap-2">
                {tools.map((t, i) => (
                  <span
                    key={i}
                    className="aq-chip aq-reveal aq-tile"
                    style={{ animationDelay: `${180 + i * 45}ms` } as CSSProperties}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {prereqs.length > 0 && (
            <div className="aq-reveal aq-card aq-card-hover p-5" style={{ animationDelay: "180ms" } as CSSProperties}>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <span className="aq-icon aq-badge-bob flex h-8 w-8 items-center justify-center">
                  <ListChecks className="h-4 w-4" />
                </span>
                Before you start
              </h3>
              <ul className="space-y-2 text-[15px] leading-relaxed text-foreground/85">
                {prereqs.map((p, i) => (
                  <li
                    key={i}
                    className="aq-reveal flex gap-2.5"
                    style={{ animationDelay: `${240 + i * 55}ms` } as CSSProperties}
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sources.length > 0 && (
            <div className="aq-reveal aq-card aq-card-hover p-5" style={{ animationDelay: "240ms" } as CSSProperties}>
              <h3 className="mb-3 text-base font-bold">Sources</h3>
              <ul className="space-y-1">
                {sources.slice(0, 8).map((s, i) => (
                  <li key={i} className="aq-reveal" style={{ animationDelay: `${300 + i * 45}ms` } as CSSProperties}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/src flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 transition-colors group-hover/src:text-accent" />
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
