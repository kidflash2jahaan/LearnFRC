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
  Route as RouteIcon,
  GraduationCap,
} from "lucide-react";
import { getDepartmentBySlug, getCompletedLessonIds, flattenLessons } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { deptMeta, inkFor } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { DepartmentModules } from "@/components/guides/department-modules";
import { SuggestNewContent } from "@/components/guides/suggest-new-content";
import { AnimatedCounter } from "@/components/animated-counter";
import { JsonLd } from "@/components/json-ld";
import type { Resource } from "@/lib/types";
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
import { MasteryPanel } from "./_mastery-panel";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<Metadata> {
  const { department } = await params;
  const dept = await getDepartmentBySlug(department).catch(() => null);
  if (!dept) return { title: "Department" };
  const url = `${SITE}/guides/${department}`;
  const description = dept.tagline ?? dept.description ?? undefined;
  return {
    title: dept.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${dept.name} · LearnFRC`,
      description,
      url,
      type: "website",
    },
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

  const sidebarBlocks: {
    key: string;
    icon: typeof Sparkles;
    title: string;
    delay: number;
  }[] = [
    { key: "learn", icon: Sparkles, title: "What you'll learn", delay: 0.06 },
    { key: "tools", icon: Wrench, title: "Tools & tech", delay: 0.12 },
    { key: "prereqs", icon: ListChecks, title: "Before you start", delay: 0.18 },
    { key: "sources", icon: BookOpen, title: "Sources", delay: 0.24 },
  ];

  return (
    <div className="relative overflow-x-clip">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: dept.name,
          description: dept.tagline ?? dept.description ?? undefined,
          url: `${SITE}/guides/${dept.slug}`,
          isAccessibleForFree: true,
          inLanguage: "en",
          provider: {
            "@type": "Organization",
            name: "LearnFRC",
            url: SITE,
          },
        }}
      />
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
          ],
        }}
      />

      <Glow
        blobs={[
          { size: "640px", pos: { left: "-180px", top: "-240px" }, color: accent, opacity: 0.4 },
          { size: "560px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.4, delay: 2 },
          { size: "520px", pos: { left: "34%", top: "560px" }, color: "#c8b6ff", opacity: 0.32, delay: 4 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Rise>
          <Link
            href="/guides"
            className="group/back -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover/back:-translate-x-0.5" aria-hidden />
            All departments
          </Link>
        </Rise>

        <div className="mt-6 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          {/* hero copy */}
          <RiseGroup>
            <RiseItem>
              <div className="flex items-center gap-3">
                <span
                  className="ac-badge flex h-14 w-14 shrink-0 items-center justify-center"
                  style={{ "--a": accent } as CSSProperties}
                >
                  <Icon name={meta.icon} className="h-7 w-7" aria-hidden />
                </span>
                <span className="ac-chip inline-flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="ac-eyebrow">Department curriculum</span>
                </span>
              </div>
            </RiseItem>

            <RiseItem>
              <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.04] sm:text-5xl lg:text-[3.3rem]">
                <span
                  style={{
                    background: `linear-gradient(120deg, ${ink}, var(--accent))`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {dept.name}
                </span>
              </h1>
            </RiseItem>

            {dept.tagline && (
              <RiseItem>
                <p className="mt-4 max-w-2xl text-pretty text-xl font-medium text-foreground/80">
                  {dept.tagline}
                </p>
              </RiseItem>
            )}

            {dept.description && (
              <RiseItem>
                <p className="mt-3 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
                  {dept.description}
                </p>
              </RiseItem>
            )}

            <RiseItem>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <span className="ac-chip inline-flex items-center gap-1.5">
                  <Layers className="h-4 w-4" style={{ color: ink }} aria-hidden />
                  <AnimatedCounter value={totalModules} /> modules
                </span>
                <span className="ac-chip inline-flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" style={{ color: ink }} aria-hidden />
                  <AnimatedCounter value={totalLessons} /> lessons
                </span>
                <span className="ac-chip inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" style={{ color: ink }} aria-hidden />~
                  <AnimatedCounter value={totalHours} suffix="h" /> total
                </span>
              </div>
            </RiseItem>

            <RiseItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={ctaHref} className="ac-btn text-sm">
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                {pct === 100 && (
                  <Link href={`/certificate/${dept.slug}`} className="ac-btn-ghost text-sm">
                    <Award className="h-4 w-4" aria-hidden /> Get certificate
                  </Link>
                )}
              </div>
            </RiseItem>
          </RiseGroup>

          {/* SIGNATURE: mission-progress mastery ring */}
          <MasteryPanel
            pct={pct}
            doneCount={doneCount}
            totalLessons={totalLessons}
            accent={accent}
            ink={ink}
            loggedIn={!!user}
          />
        </div>

        {/* stat strip */}
        <RevealGroup className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {stats.map((s) => (
            <RevealItem key={s.label}>
              <Hover lift={-3} className="h-full">
                <div className="ac-card flex h-full items-center gap-3 p-4">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                      color: ink,
                    }}
                  >
                    <s.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-2xl font-extrabold leading-none" style={{ color: ink }}>
                      <AnimatedCounter value={s.value} suffix={s.suffix} />
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                </div>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ======================= THE CURRICULUM ======================= */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8 lg:py-12">
        {/* main: the module path */}
        <div className="lg:col-span-2">
          <Reveal className="mb-6 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: ink,
                }}
              >
                <RouteIcon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="ac-eyebrow">The learning path</p>
                <h2 className="mt-0.5 font-display text-2xl font-bold">Modules &amp; lessons</h2>
              </div>
            </div>
            <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">
              <AnimatedCounter value={totalModules} /> modules ·{" "}
              <AnimatedCounter value={totalLessons} /> lessons
            </span>
          </Reveal>

          {/* the connected spine + interactive module accordion */}
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-6 left-[19px] top-4 hidden w-px sm:block"
              style={{
                background: `linear-gradient(180deg, ${accent}, color-mix(in srgb, ${accent} 10%, transparent))`,
              }}
            />
            <DepartmentModules
              departmentSlug={dept.slug}
              modules={dept.modules}
              completedIds={[...completed]}
              accent={accent}
            />
          </div>

          {/* community authoring: contribute a whole new lesson */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-6 text-sm text-muted-foreground">
            <span>Know something this department is missing?</span>
            <SuggestNewContent
              departmentId={dept.id}
              departmentName={dept.name}
              modules={dept.modules.map((m) => ({ id: m.id, title: m.title }))}
              isLoggedIn={!!user}
              loginPath={`/signup?next=${encodeURIComponent(`/guides/${dept.slug}`)}`}
            />
          </div>
        </div>

        {/* sidebar: the field guide */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
        <RevealGroup className="space-y-5">
          {learn.length > 0 && (
            <RevealItem>
              <div className="ac-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                      color: ink,
                    }}
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </span>
                  What you&apos;ll learn
                </h3>
                <ul className="space-y-2.5">
                  {learn.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-foreground/85">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ink }} aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealItem>
          )}

          {tools.length > 0 && (
            <RevealItem>
              <div className="ac-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                      color: ink,
                    }}
                  >
                    <Wrench className="h-4 w-4" aria-hidden />
                  </span>
                  Tools &amp; tech
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tools.map((t, i) => (
                    <span
                      key={i}
                      className="ac-tile inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium"
                      style={{ "--a": accent, color: ink } as CSSProperties}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </RevealItem>
          )}

          {prereqs.length > 0 && (
            <RevealItem>
              <div className="ac-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                      color: ink,
                    }}
                  >
                    <ListChecks className="h-4 w-4" aria-hidden />
                  </span>
                  Before you start
                </h3>
                <ul className="space-y-2 text-[15px] leading-relaxed text-foreground/85">
                  {prereqs.map((p, i) => (
                    <li key={i} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ink }} aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealItem>
          )}

          {sources.length > 0 && (
            <RevealItem>
              <div className="ac-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                      color: ink,
                    }}
                  >
                    <BookOpen className="h-4 w-4" aria-hidden />
                  </span>
                  Sources
                </h3>
                <ul className="space-y-1">
                  {sources.slice(0, 8).map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/src flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 transition-colors group-hover/src:text-primary" aria-hidden />
                        <span>{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealItem>
          )}
        </RevealGroup>
        </aside>
      </div>

      {/* ============================= CTA ============================ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal>
          <div className="ac-glass relative overflow-hidden p-8 text-center sm:p-12" style={{ "--a": accent } as CSSProperties}>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full blur-2xl"
              style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)`, opacity: 0.25 }}
            />
            <span
              className="ac-badge relative mx-auto mb-5 flex h-14 w-14 items-center justify-center"
              style={{ "--a": accent } as CSSProperties}
            >
              <Icon name={meta.icon} className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="relative text-balance font-display text-3xl font-bold sm:text-4xl">
              {pct === 100
                ? "You've mastered this department."
                : doneCount > 0
                  ? "Pick up where you left off."
                  : `Ready to own ${dept.name}?`}
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground">
              {totalModules} modules, {totalLessons} lessons, all free — grounded in
              the real Game Manual and WPILib docs. Read now, track your mastery
              when you sign up.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href={ctaHref} className="ac-btn text-sm">
                {ctaLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              {pct === 100 ? (
                <Link href={`/certificate/${dept.slug}`} className="ac-btn-ghost text-sm">
                  <Award className="h-4 w-4" aria-hidden /> Get certificate
                </Link>
              ) : (
                <Link href="/guides" className="ac-btn-ghost text-sm">
                  Explore other departments
                </Link>
              )}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
