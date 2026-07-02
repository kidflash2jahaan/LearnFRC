import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Target, Route } from "lucide-react";
import { getPathBySlug, getAllPathSlugs } from "@/lib/paths-data";
import { getDepartments } from "@/lib/queries";
import { deptMeta, deptInk } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/animated-counter";

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
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span
          className="aq-float absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${path.color}33, transparent)` }}
        />
        <span className="aq-float absolute top-40 -right-16 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(26,169,214,0.22),transparent)] blur-3xl" style={{ animationDelay: "-3s" } as CSSProperties} />
        <span className="aq-float absolute bottom-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(139,127,255,0.18),transparent)] blur-3xl" style={{ animationDelay: "-6s" } as CSSProperties} />
      </div>

      <Link
        href="/paths"
        className="aq-rise aq-rise-1 mb-8 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft className="h-4 w-4" /> All learning paths
      </Link>

      {/* ===== HERO ===== */}
      <header className="aq-rise aq-rise-2 relative aq-sheen overflow-hidden rounded-3xl">
        <p className="aq-eyebrow aq-rise aq-rise-1">
          <Route className="h-3.5 w-3.5" /> Learning path
        </p>
        <div className="mt-4 flex items-start gap-3 sm:gap-5">
          <span
            className="aq-badge aq-badge-bob flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
            style={{ "--a": path.color } as CSSProperties}
          >
            <Icon name={path.icon} className="h-8 w-8" />
          </span>
          <h1
            className="aq-display aq-grad-anim aq-rise aq-rise-3 min-w-0 text-balance break-words text-3xl font-bold leading-[1.05] sm:text-4xl md:text-5xl"
            style={{
              color: "var(--foreground)",
              background: "linear-gradient(120deg,#2560e6,#1478a6,#5b4fd6,#2560e6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {path.title}
          </h1>
        </div>
        <p className="aq-rise aq-rise-4 mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/80">
          {path.description}
        </p>
        <div className="aq-rise aq-rise-5 mt-6 flex flex-wrap items-center gap-2">
          <span className="aq-chip aq-tile">
            <Route className="h-3.5 w-3.5 text-primary" />
            <AnimatedCounter value={path.steps.length} />
            &nbsp;step{path.steps.length === 1 ? "" : "s"}
          </span>
          <span className="aq-chip aq-tile">
            <Target className="h-3.5 w-3.5 text-primary" />
            <AnimatedCounter value={path.outcomes.length} />
            &nbsp;outcome{path.outcomes.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {/* ===== OUTCOMES ===== */}
      <section className="aq-reveal mt-10">
        <div className="aq-glass aq-sheen aq-card-hover rounded-3xl p-6 sm:p-7">
          <h2 className="aq-display flex items-center gap-2.5 text-xl font-semibold text-foreground">
            <span className="aq-icon aq-badge-bob h-9 w-9">
              <Target className="h-5 w-5" />
            </span>
            By the end, you&apos;ll be able to
          </h2>
          <ul className="mt-5 grid gap-3">
            {path.outcomes.map((o, i) => (
              <li
                key={i}
                className="aq-reveal flex gap-3 text-base leading-relaxed text-foreground/85"
                style={{ animationDelay: `${i * 90}ms` } as CSSProperties}
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: "linear-gradient(160deg,#2560e6,#0f7fb0)" }}
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
          <h2 className="aq-eyebrow">The route</h2>
          <span className="aq-divider flex-1" />
          <span className="aq-chip aq-tile">
            <AnimatedCounter value={path.steps.length} />
            &nbsp;stops
          </span>
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
              <li
                key={i}
                className="aq-reveal relative"
                style={{ animationDelay: `${i * 110}ms` } as CSSProperties}
              >
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
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                      <span style={{ color: deptInk(step.deptSlug) }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">{deptName}</span>
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
