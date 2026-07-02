import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Target,
  Route,
  Flag,
  MapPin,
  Sparkles,
} from "lucide-react";
import { getPathBySlug, getAllPathSlugs } from "@/lib/paths-data";
import { getDepartments } from "@/lib/queries";
import { deptMeta, deptInk } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/animated-counter";
import { JourneySpine } from "./_journey-spine";

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
  const lastStep = path.steps[path.steps.length - 1];
  const ink = deptInk(firstStep?.deptSlug ?? "");

  const heroStats: { n: number; label: string; Icon: typeof MapPin }[] = [
    { n: path.steps.length, label: "stops on the route", Icon: MapPin },
    { n: path.outcomes.length, label: "skills you'll leave with", Icon: Target },
    {
      n: new Set(path.steps.map((s) => s.deptSlug)).size,
      label: "departments visited",
      Icon: Route,
    },
  ];

  return (
    <div
      data-theme="arena"
      className="aq-root relative mx-auto max-w-5xl overflow-x-clip px-4 pb-24 pt-28 text-foreground sm:px-6 lg:px-8"
    >
      {/* ===== ambient glows (decorative) ===== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span
          className="aq-float absolute -top-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background: `radial-gradient(closest-side, ${path.color}38, transparent)`,
          }}
        />
        <span
          className="aq-float absolute top-56 -right-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(26,169,214,0.22),transparent)] blur-3xl"
          style={{ animationDelay: "-3s" } as CSSProperties}
        />
        <span
          className="aq-float absolute bottom-32 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(139,127,255,0.18),transparent)] blur-3xl"
          style={{ animationDelay: "-6s" } as CSSProperties}
        />
      </div>

      <Link
        href="/paths"
        className="aq-rise aq-rise-1 mb-8 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All learning paths
      </Link>

      {/* ============================ HERO ============================ */}
      <header className="relative">
        <p className="aq-eyebrow aq-rise aq-rise-1 inline-flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5" aria-hidden="true" /> Learning path
        </p>

        <div className="mt-4 flex items-start gap-3 sm:gap-5">
          <span
            className="aq-badge aq-badge-bob aq-rise aq-rise-2 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl sm:h-[76px] sm:w-[76px]"
            style={{ "--a": path.color } as CSSProperties}
          >
            <Icon name={path.icon} className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden="true" />
          </span>
          <h1
            className="aq-display aq-grad-anim aq-rise aq-rise-2 min-w-0 text-balance break-words text-3xl font-extrabold leading-[1.04] sm:text-4xl md:text-[3.1rem]"
            style={{
              background:
                "linear-gradient(120deg,#2560e6,#1aa9d6,#7c5cff,#2560e6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            {path.title}
          </h1>
        </div>

        <p className="aq-rise aq-rise-3 mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/80">
          {path.description}
        </p>

        {/* stat strip */}
        <div className="aq-rise aq-rise-4 mt-7 grid grid-cols-3 gap-3 sm:max-w-lg">
          {heroStats.map((s) => (
            <div
              key={s.label}
              className="aq-glass aq-card-hover rounded-2xl p-3.5 text-center sm:p-4"
            >
              <s.Icon
                className="mx-auto h-4 w-4 text-primary"
                aria-hidden="true"
              />
              <div className="aq-display mt-1.5 text-2xl font-extrabold leading-none text-foreground sm:text-[1.75rem]">
                <AnimatedCounter value={s.n} />
              </div>
              <div className="mt-1 text-[12px] leading-tight text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="aq-rise aq-rise-5 mt-7 flex flex-wrap items-center gap-3">
          {firstStep && (
            <Button asChild variant="brand" size="lg">
              <Link href={`/guides/${firstStep.deptSlug}`}>
                Start this path
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
          <Link
            href="#outcomes"
            className="aq-ghost inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            What you&apos;ll learn
          </Link>
        </div>
      </header>

      {/* ==================== SIGNATURE: THE JOURNEY ==================== */}
      <section className="mt-16" aria-labelledby="route-heading">
        <div className="aq-reveal mb-7 flex items-center gap-3">
          <h2
            id="route-heading"
            className="aq-eyebrow inline-flex items-center gap-1.5"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> The route
          </h2>
          <span className="aq-divider flex-1" />
          <span className="aq-chip aq-tile">
            <AnimatedCounter value={path.steps.length} />
            &nbsp;stops
          </span>
        </div>

        <ol className="relative space-y-4">
          {/* animated progress spine (decorative, reduced-motion safe) */}
          <JourneySpine />

          {/* START marker */}
          <li className="aq-reveal relative">
            <div className="flex items-center gap-4 pl-1">
              <span
                className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_28px_-10px_rgba(37,96,230,0.7)]"
                style={{
                  background: "linear-gradient(160deg,#2560e6,#0f7fb0)",
                }}
              >
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Begin
                </div>
                <p className="aq-display text-lg font-semibold text-foreground">
                  Depart with no experience needed
                </p>
              </div>
            </div>
          </li>

          {/* STEP NODES */}
          {path.steps.map((step, i) => {
            const m = deptMeta(step.deptSlug);
            const deptName = nameBySlug.get(step.deptSlug) ?? step.label;
            const stepInk = deptInk(step.deptSlug);
            return (
              <li
                key={i}
                className="aq-reveal relative"
                style={{ animationDelay: `${i * 100}ms` } as CSSProperties}
              >
                <Link
                  href={`/guides/${step.deptSlug}`}
                  className="aq-card aq-card-hover group flex items-center gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {/* numbered node — sits on the spine */}
                  <span className="relative z-10 flex shrink-0 flex-col items-center">
                    <span
                      className="aq-badge flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                      style={{ "--a": m.color } as CSSProperties}
                    >
                      <Icon name={m.icon} className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span
                      className="mt-2 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ color: stepInk }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </span>

                  <div className="min-w-0 flex-1 self-start">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <span>Stop {i + 1}</span>
                      <span aria-hidden="true">/</span>
                      <span
                        className="truncate"
                        style={{ color: stepInk }}
                      >
                        {deptName}
                      </span>
                    </div>
                    <h3 className="aq-display mt-1 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                      {step.label}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.note}
                    </p>
                  </div>

                  <ArrowRight
                    className="h-5 w-5 shrink-0 self-center text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}

          {/* DESTINATION marker */}
          <li className="aq-reveal relative">
            <div className="flex items-center gap-4 pl-1">
              <span
                className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_28px_-10px_rgba(15,127,176,0.7)]"
                style={{
                  background: "linear-gradient(160deg,#1478a6,#5b4fd6)",
                }}
              >
                <Flag className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  Arrive
                </div>
                <p className="aq-display text-lg font-semibold text-foreground">
                  Path complete — you&apos;ve got the whole role
                </p>
              </div>
            </div>
          </li>
        </ol>
      </section>

      {/* ===================== DESTINATION: OUTCOMES ==================== */}
      <section id="outcomes" className="aq-reveal mt-16 scroll-mt-28">
        <div className="aq-glass aq-sheen aq-card-hover relative overflow-hidden rounded-[28px] p-6 sm:p-8">
          <span
            aria-hidden
            className="aq-float pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full blur-3xl"
            style={{
              background: `radial-gradient(closest-side, ${path.color}33, transparent)`,
            }}
          />
          <h2 className="aq-display flex items-center gap-2.5 text-xl font-bold text-foreground sm:text-2xl">
            <span className="aq-icon aq-badge-bob h-10 w-10">
              <Target className="h-5 w-5" aria-hidden="true" />
            </span>
            What you&apos;ll be able to do
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            The skills waiting at the end of the route.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {path.outcomes.map((o, i) => (
              <li
                key={i}
                className="aq-reveal aq-card aq-card-hover flex items-start gap-3 p-4 text-base leading-relaxed text-foreground/90"
                style={{ animationDelay: `${i * 80}ms` } as CSSProperties}
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                  style={{
                    background: "linear-gradient(160deg,#2560e6,#0f7fb0)",
                  }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================= CTA ============================= */}
      {firstStep && (
        <section className="aq-reveal mt-14">
          <div className="aq-glass aq-sheen rounded-3xl px-6 py-10 text-center sm:px-12">
            <h2 className="aq-display text-balance text-2xl font-bold text-foreground sm:text-3xl">
              Ready to leave{" "}
              <span
                className="aq-grad-anim"
                style={{
                  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Stop 01
              </span>
              ?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground">
              Begin with{" "}
              <span className="font-semibold" style={{ color: ink }}>
                {nameBySlug.get(firstStep.deptSlug) ?? firstStep.label}
              </span>{" "}
              and work your way to{" "}
              {lastStep
                ? nameBySlug.get(lastStep.deptSlug) ?? lastStep.label
                : "the finish"}
              . Free — no login needed to start reading.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="brand" size="lg">
                <Link href={`/guides/${firstStep.deptSlug}`}>
                  Start this path
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Link
                href="/paths"
                className="aq-ghost inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Browse other paths
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
