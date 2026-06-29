import type { Metadata } from "next";
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Reveal } from "@/components/motion/reveal";
import { StatusPill, TypeLine, NeonCounter } from "@/components/motion/terminal";
import { DepartmentModules } from "@/components/guides/department-modules";
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

  return (
    <div className="relative">
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

      {/* hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14]"
          style={{ background: `radial-gradient(60% 80% at 20% 0%, ${meta.color}, transparent 60%)` }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-b-faded opacity-50" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }}
        />

        <div className="mx-auto max-w-5xl px-4 pt-28 pb-12 sm:px-6 lg:px-8">
          <Reveal>
            <Link
              href="/guides"
              className="group/back inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover/back:-translate-x-0.5" />
              cd ../guides
            </Link>
          </Reveal>

          <Reveal delay={0.04}>
            <p className="mt-4 font-mono text-xs text-foreground/70">
              <TypeLine prompt="~/learnfrc/guides $" text={`open ${dept.slug}`} />
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-[var(--shadow-md)]"
                style={{ backgroundImage: `linear-gradient(135deg, ${meta.color}, ${meta.to})` }}
              >
                <Icon name={meta.icon} className="h-8 w-8" />
              </span>
              <div>
                <h1 className="text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  {dept.name}
                </h1>
                <p className="mt-1.5 text-pretty text-lg text-muted-foreground">
                  {dept.tagline}
                </p>
              </div>
            </div>
          </Reveal>

          {dept.description && (
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-3xl text-pretty leading-relaxed text-foreground/85">
                {dept.description}
              </p>
            </Reveal>
          )}

          <Reveal delay={0.16}>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
                <Layers className="h-3.5 w-3.5" style={{ color: meta.color }} />
                <NeonCounter to={totalModules} duration={1} /> modules
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" style={{ color: meta.color }} />
                <NeonCounter to={totalLessons} duration={1.2} /> lessons
              </span>
              {user && doneCount > 0 && (
                <StatusPill tone="primary">{pct}% complete</StatusPill>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild variant="brand" size="lg">
                <Link href={ctaHref}>
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {pct === 100 && (
                <Button asChild variant="outline" size="lg">
                  <Link href={`/certificate/${dept.slug}`}>
                    <Award className="h-4 w-4" /> Get certificate
                  </Link>
                </Button>
              )}
              {user && (
                <div className="flex min-w-[180px] flex-1 items-center gap-3">
                  <Progress
                    value={pct}
                    style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
                  />
                  <span className="font-mono text-sm font-medium">{pct}%</span>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8">
        {/* main: modules */}
        <div className="lg:col-span-2">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <span className="font-mono text-primary">{"//"}</span> Curriculum
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {totalModules} modules · {totalLessons} lessons
            </span>
          </div>
          <DepartmentModules
            departmentSlug={dept.slug}
            modules={dept.modules}
            completedIds={[...completed]}
            accent={meta.color}
          />
        </div>

        {/* sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {learn.length > 0 && (
            <Reveal className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-[var(--glow-primary)]">
              <h3 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> what_you&apos;ll_learn
              </h3>
              <ul className="space-y-2.5">
                {learn.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {tools.length > 0 && (
            <Reveal className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-md transition-all duration-300 hover:border-accent/40 hover:shadow-[var(--glow-accent)]">
              <h3 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <Wrench className="h-4 w-4 text-accent" /> tools &amp; tech
              </h3>
              <div className="flex flex-wrap gap-2">
                {tools.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-md border border-border bg-background/50 px-2.5 py-1 font-mono text-xs text-foreground/80"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          )}

          {prereqs.length > 0 && (
            <Reveal className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-md transition-all duration-300 hover:border-primary/40">
              <h3 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <ListChecks className="h-4 w-4 text-primary" /> prerequisites
              </h3>
              <ul className="space-y-2 text-sm text-foreground/85">
                {prereqs.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-primary">&gt;</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {sources.length > 0 && (
            <Reveal className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-md transition-all duration-300 hover:border-accent/40">
              <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                sources
              </h3>
              <ul className="space-y-2">
                {sources.slice(0, 8).map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/src inline-flex items-start gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 transition-colors group-hover/src:text-accent" />
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </aside>
      </div>
    </div>
  );
}
