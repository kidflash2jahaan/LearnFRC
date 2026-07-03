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
import { deptMeta, deptInk, inkFor } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { RouteLine } from "./_route-line";

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
  return {
    title: path.title,
    description: path.description,
    alternates: { canonical: `/paths/${slug}` },
    openGraph: {
      title: `${path.title} · LearnFRC`,
      description: path.description,
      url: `/paths/${slug}`,
      type: "website",
    },
  };
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
  const pathInk = inkFor(path.color);

  const heroStats: { n: number; label: string; icon: typeof MapPin }[] = [
    { n: path.steps.length, label: "stops on the route", icon: MapPin },
    { n: path.outcomes.length, label: "skills you'll leave with", icon: Target },
    {
      n: new Set(path.steps.map((s) => s.deptSlug)).size,
      label: "departments visited",
      icon: Route,
    },
  ];

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "600px", pos: { left: "50%", top: "-220px" }, color: path.color, opacity: 0.4 },
          { size: "560px", pos: { right: "-190px", top: "180px" }, color: "#6ff0ea", opacity: 0.4, delay: 3 },
          { size: "520px", pos: { left: "-180px", top: "700px" }, color: "#c8b6ff", opacity: 0.32, delay: 6 },
        ]}
      />

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <Link
              href="/paths"
              className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All learning paths
            </Link>
          </RiseItem>

          {/* ============================ HERO ============================ */}
          <header className="relative mt-6">
            <RiseItem>
              <p className="ac-eyebrow inline-flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5" aria-hidden /> Learning path
              </p>
            </RiseItem>

            <RiseItem>
              <div className="mt-4 flex items-start gap-3 sm:gap-5">
                <span
                  className="ac-badge flex h-16 w-16 shrink-0 items-center justify-center sm:h-[76px] sm:w-[76px]"
                  style={{ "--a": path.color } as CSSProperties}
                >
                  <Icon name={path.icon} className="h-8 w-8 sm:h-9 sm:w-9" />
                </span>
                <h1
                  className="min-w-0 text-balance break-words font-display text-3xl font-extrabold leading-[1.04] sm:text-4xl md:text-[3.1rem]"
                  style={{
                    background: `linear-gradient(120deg, ${path.color}, #1aa9d6)`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {path.title}
                </h1>
              </div>
            </RiseItem>

            <RiseItem>
              <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/75">
                {path.description}
              </p>
            </RiseItem>

            {/* stat strip */}
            <RiseItem>
              <div className="mt-7 grid grid-cols-3 gap-3 sm:max-w-lg">
                {heroStats.map((s) => (
                  <div key={s.label} className="ac-card rounded-2xl p-3.5 text-center sm:p-4">
                    <s.icon className="mx-auto h-4 w-4 text-primary" aria-hidden />
                    <div className="mt-1.5 font-display text-2xl font-extrabold leading-none text-foreground sm:text-[1.75rem]">
                      <AnimatedCounter value={s.n} />
                    </div>
                    <div className="mt-1 text-[12px] leading-tight text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </RiseItem>

            <RiseItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                {firstStep && (
                  <Button asChild variant="brand" size="lg">
                    <Link href={`/guides/${firstStep.deptSlug}`}>
                      Start this path
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                )}
                <Link href="#outcomes" className="ac-btn-ghost text-sm">
                  What you&apos;ll learn
                </Link>
              </div>
            </RiseItem>
          </header>
        </RiseGroup>

        {/* ==================== SIGNATURE: THE ROUTE ==================== */}
        <section className="mt-16" aria-labelledby="route-heading">
          <Reveal className="mb-7 flex items-center gap-3">
            <h2 id="route-heading" className="ac-eyebrow inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> The route
            </h2>
            <span className="ac-divider flex-1" />
            <span
              className="ac-chip ac-tile inline-flex items-center gap-1"
              style={{ "--a": path.color } as CSSProperties}
            >
              <AnimatedCounter value={path.steps.length} />
              &nbsp;stops
            </span>
          </Reveal>

          <ol className="relative space-y-4">
            <RouteLine color={path.color} />

            {/* START marker */}
            <Reveal as="li" className="relative">
              <div className="flex items-center gap-4 pl-1">
                <span
                  className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_28px_-10px_rgba(37,96,230,0.7)]"
                  style={{ background: "linear-gradient(160deg,#2560e6,#0f7fb0)" }}
                >
                  <Sparkles className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Begin
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    Depart with no experience needed
                  </p>
                </div>
              </div>
            </Reveal>

            {/* STEP NODES — each <li> is a direct child of the <ol> (valid
                markup) and reveals independently with a staggered delay. */}
            {path.steps.map((step, i) => {
              const m = deptMeta(step.deptSlug);
              const deptName = nameBySlug.get(step.deptSlug) ?? step.label;
              const stepInk = deptInk(step.deptSlug);
              return (
                <Reveal key={step.deptSlug + i} as="li" delay={i * 0.06} className="relative">
                  <Hover lift={-3} scale={1.01}>
                    <Link
                      href={`/guides/${step.deptSlug}`}
                      className="ac-card group flex items-center gap-4 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="relative z-10 flex shrink-0 flex-col items-center">
                        <span
                          className="ac-badge flex h-14 w-14 items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                          style={{ "--a": m.color } as CSSProperties}
                        >
                          <Icon name={m.icon} className="h-6 w-6" />
                        </span>
                        <span
                          className="mt-2 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-bold tabular-nums"
                          style={{ color: stepInk }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </span>

                      <div className="min-w-0 flex-1 self-start">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          <span className="whitespace-nowrap">Stop {i + 1}</span>
                          <span aria-hidden>/</span>
                          <span className="leading-snug" style={{ color: stepInk }}>
                            {deptName}
                          </span>
                        </div>
                        <h3 className="mt-1 font-display text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                          {step.label}
                        </h3>
                        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
                          {step.note}
                        </p>
                      </div>

                      <ArrowRight
                        className="h-5 w-5 shrink-0 self-center text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary"
                        aria-hidden
                      />
                    </Link>
                  </Hover>
                </Reveal>
              );
            })}

            {/* DESTINATION marker */}
            <Reveal as="li" className="relative">
              <div className="flex items-center gap-4 pl-1">
                <span
                  className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_28px_-10px_rgba(15,127,176,0.7)]"
                  style={{ background: "linear-gradient(160deg,#1478a6,#5b4fd6)" }}
                >
                  <Flag className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                    Arrive
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    Path complete — you&apos;ve got the whole role
                  </p>
                </div>
              </div>
            </Reveal>
          </ol>
        </section>

        {/* ===================== DESTINATION: OUTCOMES ==================== */}
        <section id="outcomes" className="mt-16 scroll-mt-28">
          <Reveal>
            <div className="ac-glass relative overflow-hidden p-6 sm:p-8">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full blur-3xl"
                style={{ background: `radial-gradient(closest-side, ${path.color}33, transparent)` }}
              />
              <h2 className="flex items-center gap-2.5 font-display text-xl font-bold text-foreground sm:text-2xl">
                <span className="ac-badge flex h-10 w-10 items-center justify-center" style={{ "--a": path.color } as CSSProperties}>
                  <Target className="h-5 w-5" aria-hidden />
                </span>
                What you&apos;ll be able to do
              </h2>
              <p className="mt-2 text-base text-muted-foreground">
                The skills waiting at the end of the route.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {path.outcomes.map((o, i) => (
                  <Reveal
                    key={i}
                    as="li"
                    delay={i * 0.05}
                    className="ac-card flex items-start gap-3 p-4 text-base leading-relaxed text-foreground/90"
                  >
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: "linear-gradient(160deg,#2560e6,#0f7fb0)" }}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                    </span>
                    <span>{o}</span>
                  </Reveal>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ============================= CTA ============================= */}
        {firstStep && (
          <section className="mt-14">
            <Reveal>
              <div className="ac-glass px-6 py-10 text-center sm:px-12">
                <h2 className="text-balance font-display text-2xl font-bold text-foreground sm:text-3xl">
                  Ready to leave{" "}
                  <span
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
                  <span className="font-semibold" style={{ color: pathInk }}>
                    {nameBySlug.get(firstStep.deptSlug) ?? firstStep.label}
                  </span>{" "}
                  and work your way to{" "}
                  {lastStep ? nameBySlug.get(lastStep.deptSlug) ?? lastStep.label : "the finish"}
                  . Free — no login needed to start reading.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Button asChild variant="brand" size="lg">
                    <Link href={`/guides/${firstStep.deptSlug}`}>
                      Start this path
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                  <Link href="/paths" className="ac-btn-ghost text-sm">
                    Browse other paths
                  </Link>
                </div>
              </div>
            </Reveal>
          </section>
        )}
      </div>
    </div>
  );
}
