import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Target, Route } from "lucide-react";
import { getPathBySlug, getAllPathSlugs } from "@/lib/paths-data";
import { getDepartments } from "@/lib/queries";
import { deptMeta } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return getAllPathSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = getPathBySlug(slug);
  if (!path) return { title: "Path" };
  return { title: path.title, description: path.description };
}

export default async function PathPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const path = getPathBySlug(slug);
  if (!path) notFound();

  const departments = await getDepartments().catch(() => []);
  const nameBySlug = new Map(departments.map((d) => [d.slug, d.name]));

  const firstStep = path.steps[0];

  return (
    <div className="relative mx-auto max-w-3xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span
          className="absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${path.color}33, transparent)` }}
        />
        <span className="absolute top-40 -right-16 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(26,169,214,0.22),transparent)] blur-3xl" />
        <span className="absolute bottom-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(139,127,255,0.18),transparent)] blur-3xl" />
      </div>

      <Link
        href="/paths"
        className="aq-rise aq-rise-1 mb-8 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft className="h-4 w-4" /> All learning paths
      </Link>

      {/* ===== HERO ===== */}
      <header className="aq-rise aq-rise-2">
        <p className="aq-eyebrow">
          <Route className="h-3.5 w-3.5" /> Learning path
        </p>
        <div className="mt-4 flex items-start gap-5">
          <span
            className="aq-badge flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
            style={{ "--a": path.color } as CSSProperties}
          >
            <Icon name={path.icon} className="h-8 w-8" />
          </span>
          <h1
            className="aq-display text-balance text-4xl font-bold leading-[1.05] sm:text-5xl"
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {path.title}
          </h1>
        </div>
        <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
          {path.description}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="aq-chip">
            <Route className="h-3.5 w-3.5 text-primary" />
            {path.steps.length} step{path.steps.length === 1 ? "" : "s"}
          </span>
          <span className="aq-chip">
            <Target className="h-3.5 w-3.5 text-primary" />
            {path.outcomes.length} outcome{path.outcomes.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {/* ===== OUTCOMES ===== */}
      <section className="aq-reveal mt-10">
        <div className="aq-glass rounded-3xl p-6 sm:p-7">
          <h2 className="aq-display flex items-center gap-2.5 text-xl font-semibold text-foreground">
            <span className="aq-icon h-9 w-9">
              <Target className="h-5 w-5" />
            </span>
            By the end, you&apos;ll be able to
          </h2>
          <ul className="mt-5 grid gap-3">
            {path.outcomes.map((o, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-foreground/85">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: "linear-gradient(160deg,#3b78f2,#149fd0)" }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== STEP TIMELINE ===== */}
      <section className="mt-14">
        <div className="aq-reveal mb-6 flex items-center gap-3">
          <p className="aq-eyebrow">The route</p>
          <span className="aq-divider flex-1" />
          <span className="aq-chip">{path.steps.length} stops</span>
        </div>

        <ol className="relative space-y-4">
          {/* connector spine */}
          <span
            aria-hidden
            className="absolute bottom-8 left-[27px] top-8 w-px bg-gradient-to-b from-primary/50 via-border to-accent/50"
          />
          {path.steps.map((step, i) => {
            const m = deptMeta(step.deptSlug);
            const deptName = nameBySlug.get(step.deptSlug) ?? step.label;
            return (
              <li key={i} className="aq-reveal relative">
                <Link
                  href={`/guides/${step.deptSlug}`}
                  className="aq-card aq-card-hover group flex items-center gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span
                    className="aq-badge relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                    style={{ "--a": m.color } as CSSProperties}
                  >
                    <Icon name={m.icon} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                      <span className="font-semibold text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="font-semibold text-muted-foreground">{deptName}</span>
                    </div>
                    <h3 className="aq-display mt-1 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                      {step.label}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.note}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 self-center text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {firstStep && (
        <div className="aq-reveal mt-12 flex justify-center">
          <Button asChild variant="brand" size="lg">
            <Link href={`/guides/${firstStep.deptSlug}`}>
              Start this path
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
