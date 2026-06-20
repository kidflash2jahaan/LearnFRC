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
} from "lucide-react";
import { getDepartmentBySlug, getCompletedLessonIds, flattenLessons } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { deptMeta } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Reveal } from "@/components/motion/reveal";
import { DepartmentModules } from "@/components/guides/department-modules";
import { JsonLd } from "@/components/json-ld";
import type { Resource } from "@/lib/types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

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
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
          style={{ background: `radial-gradient(60% 80% at 20% 0%, ${meta.color}, transparent 60%)` }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid mask-b-faded opacity-50" />

        <div className="mx-auto max-w-5xl px-4 pt-28 pb-12 sm:px-6 lg:px-8">
          <Reveal>
            <Link
              href="/guides"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> All guides
            </Link>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-[var(--shadow-md)]"
                style={{ backgroundImage: `linear-gradient(135deg, ${meta.color}, ${meta.to})` }}
              >
                <Icon name={meta.icon} className="h-8 w-8" />
              </span>
              <div>
                <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                  {dept.name}
                </h1>
                <p className="mt-1.5 text-pretty text-lg text-muted-foreground">
                  {dept.tagline}
                </p>
              </div>
            </div>
          </Reveal>

          {dept.description && (
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-3xl text-pretty leading-relaxed text-foreground/85">
                {dept.description}
              </p>
            </Reveal>
          )}

          <Reveal delay={0.15}>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> {totalModules} modules
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> {totalLessons} lessons
              </span>
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
          <h2 className="mb-5 text-xl font-bold tracking-tight">Curriculum</h2>
          <DepartmentModules
            departmentSlug={dept.slug}
            modules={dept.modules}
            completedIds={[...completed]}
            accent={meta.color}
          />
        </div>

        {/* sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {learn.length > 0 && (
            <Reveal className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> What you&apos;ll learn
              </h3>
              <ul className="space-y-2.5">
                {learn.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {tools.length > 0 && (
            <Reveal className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4 text-primary" /> Tools &amp; tech
              </h3>
              <div className="flex flex-wrap gap-2">
                {tools.map((t, i) => (
                  <Badge key={i} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            </Reveal>
          )}

          {prereqs.length > 0 && (
            <Reveal className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="h-4 w-4 text-primary" /> Prerequisites
              </h3>
              <ul className="space-y-2 text-sm text-foreground/80">
                {prereqs.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </Reveal>
          )}

          {sources.length > 0 && (
            <Reveal className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">Sources</h3>
              <ul className="space-y-2">
                {sources.slice(0, 8).map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
