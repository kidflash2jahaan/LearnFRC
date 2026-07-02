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
  Clock,
  Route,
  GraduationCap,
} from "lucide-react";
import { getDepartmentBySlug, getCompletedLessonIds, flattenLessons } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { deptMeta, inkFor } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { DepartmentModules } from "@/components/guides/department-modules";
import { AnimatedCounter } from "@/components/animated-counter";
import { JsonLd } from "@/components/json-ld";
import type { Resource } from "@/lib/types";
import { ProgressDial } from "./_progress-dial";

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
  // Darker, same-hue tone for accent text/numbers/icons — the neon accents
  // (electrical yellow especially) are illegible as text on the light theme.
  const ink = inkFor(accent);

  // Estimated total time across every lesson, surfaced as an at-a-glance stat.
  const totalMinutes = flat.reduce((sum, l) => sum + (l.estimated_minutes ?? 0), 0);
  const totalHours = Math.max(1, Math.round(totalMinutes / 60));

  // Journey stat strip — animated counters that summarize the whole path.
  const stats: {
    icon: typeof Layers;
    value: number;
    suffix?: string;
    label: string;
  }[] = [
    { icon: Layers, value: totalModules, label: totalModules === 1 ? "module" : "modules" },
    { icon: BookOpen, value: totalLessons, label: "lessons" },
    { icon: Clock, value: totalHours, suffix: "h", label: "of reading" },
    {
      icon: GraduationCap,
      value: pct,
      suffix: "%",
      label: user ? "mastered" : "start free",
    },
  ];

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate overflow-x-clip text-foreground"
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

      {/* ambient light the glass refracts — tinted by the department accent */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[640px] w-[640px] opacity-60"
          style={{
            left: "-180px",
            top: "-240px",
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
            left: "34%",
            top: "460px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Link
          href="/guides"
          className="aq-rise aq-rise-1 group/back -my-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover/back:-translate-x-0.5" />
          All departments
        </Link>

        <div className="mt-6 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          {/* hero copy */}
          <div>
            <div className="aq-rise aq-rise-1 flex items-center gap-3">
              <span
                className="aq-badge aq-badge-bob flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{ "--a": accent } as CSSProperties}
              >
                <Icon name={meta.icon} className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="aq-eyebrow">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Department
                curriculum
              </span>
            </div>

            <h1 className="aq-rise aq-rise-2 aq-display mt-5 text-balance text-4xl font-extrabold leading-[1.04] sm:text-5xl lg:text-[3.3rem]">
              <span
                className="aq-grad-anim"
                style={{
                  background: `linear-gradient(120deg, ${accent}, var(--accent), ${accent})`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {dept.name}
              </span>
            </h1>

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
                <Layers className="h-4 w-4" style={{ color: ink }} aria-hidden="true" />
                <AnimatedCounter value={totalModules} /> modules
              </span>
              <span className="aq-chip">
                <BookOpen className="h-4 w-4" style={{ color: ink }} aria-hidden="true" />
                <AnimatedCounter value={totalLessons} /> lessons
              </span>
              <span className="aq-chip">
                <Clock className="h-4 w-4" style={{ color: ink }} aria-hidden="true" />~
                <AnimatedCounter value={totalHours} suffix="h" /> total
              </span>
            </div>

            <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={ctaHref}
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              {pct === 100 && (
                <Link
                  href={`/certificate/${dept.slug}`}
                  className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Award className="h-4 w-4" aria-hidden="true" /> Get certificate
                </Link>
              )}
            </div>
          </div>

          {/* SIGNATURE: mission-control progress dial */}
          <aside className="aq-rise aq-rise-4 aq-float lg:justify-self-end">
            <div
              className="aq-glass aq-sheen relative overflow-hidden rounded-[28px] p-6 sm:p-8"
              style={{ "--a": accent } as CSSProperties}
            >
              <div className="flex items-center gap-2">
                <span
                  className="aq-pulse inline-block h-2 w-2 rounded-full"
                  style={{ background: accent }}
                  aria-hidden="true"
                />
                <span className="aq-eyebrow">Mission progress</span>
              </div>

              <div className="mt-4">
                <ProgressDial
                  pct={pct}
                  doneCount={doneCount}
                  totalLessons={totalLessons}
                  accent={accent}
                  ink={ink}
                />
              </div>

              {!user && (
                <p className="mt-5 text-center text-sm leading-relaxed text-foreground/70">
                  Reading is free — no login needed. Sign in to light up this dial
                  as you master the department.
                </p>
              )}
              {user && doneCount === totalLessons && totalLessons > 0 && (
                <p className="mt-5 text-center text-sm font-semibold" style={{ color: ink }}>
                  Department complete. Gracious professionalism, well earned.
                </p>
              )}
              {user && doneCount > 0 && doneCount < totalLessons && (
                <p className="mt-5 text-center text-sm text-foreground/70">
                  {totalLessons - doneCount} lessons to the finish line — keep
                  going.
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* stat strip */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="aq-card aq-card-hover aq-reveal flex items-center gap-3 rounded-2xl p-4"
              style={{ animationDelay: `${i * 0.08}s` } as CSSProperties}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: ink,
                }}
              >
                <s.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div
                  className="aq-display text-2xl font-extrabold leading-none"
                  style={{ color: ink }}
                >
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================= THE CURRICULUM ======================= */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8 lg:py-12">
        {/* main: the module path */}
        <div className="lg:col-span-2">
          <div className="aq-reveal mb-6 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: ink,
                }}
              >
                <Route className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="aq-eyebrow">The learning path</p>
                <h2 className="aq-display mt-0.5 text-2xl font-bold">
                  Modules &amp; lessons
                </h2>
              </div>
            </div>
            <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">
              <AnimatedCounter value={totalModules} /> modules ·{" "}
              <AnimatedCounter value={totalLessons} /> lessons
            </span>
          </div>

          {/* the connected spine + interactive module accordion */}
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-6 left-[19px] top-4 hidden w-px sm:block"
              style={{
                background: `linear-gradient(180deg, ${accent}, color-mix(in srgb, ${accent} 10%, transparent))`,
              }}
            />
            <div className="aq-reveal relative sm:pl-0">
              <DepartmentModules
                departmentSlug={dept.slug}
                modules={dept.modules}
                completedIds={[...completed]}
                accent={accent}
              />
            </div>
          </div>
        </div>

        {/* sidebar: the field guide */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {learn.length > 0 && (
            <div
              className="aq-reveal aq-card aq-card-hover p-5"
              style={{ animationDelay: "60ms" } as CSSProperties}
            >
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <span
                  className="aq-icon aq-badge-bob flex h-8 w-8 items-center justify-center"
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    color: ink,
                  }}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
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
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: ink }}
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tools.length > 0 && (
            <div
              className="aq-reveal aq-card aq-card-hover p-5"
              style={{ animationDelay: "120ms" } as CSSProperties}
            >
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <span
                  className="aq-icon aq-badge-bob flex h-8 w-8 items-center justify-center"
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    color: ink,
                  }}
                >
                  <Wrench className="h-4 w-4" aria-hidden="true" />
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
            <div
              className="aq-reveal aq-card aq-card-hover p-5"
              style={{ animationDelay: "180ms" } as CSSProperties}
            >
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <span
                  className="aq-icon aq-badge-bob flex h-8 w-8 items-center justify-center"
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    color: ink,
                  }}
                >
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
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
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: ink }}
                      aria-hidden="true"
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sources.length > 0 && (
            <div
              className="aq-reveal aq-card aq-card-hover p-5"
              style={{ animationDelay: "240ms" } as CSSProperties}
            >
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <span
                  className="aq-icon aq-badge-bob flex h-8 w-8 items-center justify-center"
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    color: ink,
                  }}
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </span>
                Sources
              </h3>
              <ul className="space-y-1">
                {sources.slice(0, 8).map((s, i) => (
                  <li
                    key={i}
                    className="aq-reveal"
                    style={{ animationDelay: `${300 + i * 45}ms` } as CSSProperties}
                  >
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/src flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 transition-colors group-hover/src:text-primary" />
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* ============================= CTA ============================ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div
          className="aq-glass aq-sheen aq-reveal relative overflow-hidden rounded-[28px] px-8 py-12 text-center sm:px-16"
          style={{ "--a": accent } as CSSProperties}
        >
          <span
            className="aq-badge aq-badge-bob mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ "--a": accent } as CSSProperties}
          >
            <Icon name={meta.icon} className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="aq-display text-balance text-3xl font-bold text-foreground sm:text-4xl">
            {pct === 100
              ? "You've mastered this department."
              : doneCount > 0
                ? "Pick up where you left off."
                : `Ready to own ${dept.name}?`}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-foreground/70">
            {totalModules} modules, {totalLessons} lessons, all free — grounded in
            the real Game Manual and WPILib docs. Read now, track your mastery
            when you sign up.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {pct === 100 ? (
              <Link
                href={`/certificate/${dept.slug}`}
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Award className="h-4 w-4" aria-hidden="true" /> Get certificate
              </Link>
            ) : (
              <Link
                href="/guides"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Explore other departments
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
