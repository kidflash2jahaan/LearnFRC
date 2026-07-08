import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Compass, Route, Layers, Target, MapPin, Flag } from "lucide-react";
import { PATHS } from "@/lib/paths-data";
import { Icon } from "@/lib/icon-map";
import { deptMeta, deptInk } from "@/lib/departments";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { RoutePreview } from "./_route-preview";

export const metadata: Metadata = {
  title: "FRC Learning Paths — Guided Tracks by Goal",
  description:
    "Guided, multi-department journeys through FRC — onboarding, programming, build & design, the Impact Award, and game day.",
  alternates: { canonical: "/paths" },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default function PathsPage() {
  const totalSteps = PATHS.reduce((s, p) => s + p.steps.length, 0);
  const deptsTouched = new Set(
    PATHS.flatMap((p) => p.steps.map((s) => s.deptSlug)),
  ).size;

  const stats = [
    { icon: Route, v: PATHS.length, label: "curated routes" },
    { icon: Layers, v: totalSteps, label: "guided stops" },
    { icon: Target, v: deptsTouched, label: "departments" },
  ];

  const featured = PATHS[0];
  const featuredStations = featured
    ? featured.steps.map((step) => {
        const m = deptMeta(step.deptSlug);
        return {
          deptSlug: step.deptSlug,
          label: step.label,
          color: m.color,
          icon: m.icon,
          ink: deptInk(step.deptSlug),
        };
      })
    : [];

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "620px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "560px", pos: { right: "-180px", top: "60px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "480px", pos: { left: "28%", top: "560px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-20 lg:pt-32 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Pick a journey, not a page</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-[3.3rem]">
              Learn FRC as a <span style={BRAND_GRADIENT}>guided journey</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              Not sure where to start? Each learning path is a mapped route —
              department by department — that threads the right guides
              together, from your first day in the pit to a robot-ready
              season.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={`/paths/${featured?.slug ?? ""}`} className="ac-btn text-sm">
                Start the first route <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/guides" className="ac-btn-ghost text-sm">
                Browse departments
              </Link>
            </div>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap gap-3">
              {stats.map((s) => (
                <span key={s.label} className="ac-chip inline-flex items-center gap-2">
                  <s.icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="font-semibold tabular-nums text-foreground">
                    <AnimatedCounter value={s.v} />
                  </span>
                  <span className="text-muted-foreground">{s.label}</span>
                </span>
              ))}
            </div>
          </RiseItem>
        </RiseGroup>

        {/* SIGNATURE: mapped route preview of the featured path */}
        {featured && (
          <RoutePreview
            title={featured.title}
            description={featured.description}
            slug={featured.slug}
            color={featured.color}
            icon={featured.icon}
            stations={featuredStations}
            outcomeCount={featured.outcomes.length}
          />
        )}
      </section>

      {/* ===== ROUTE CARDS ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ac-eyebrow inline-flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5" aria-hidden />
                Every route, mapped
              </p>
              <h2 className="mt-2 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Choose your route
              </h2>
            </div>
            <p className="hidden max-w-xs text-sm text-muted-foreground sm:block">
              Each stop links straight into a live department guide — travel
              at your own pace.
            </p>
          </div>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-6 md:grid-cols-2">
          {PATHS.map((p, idx) => (
            <RevealItem key={p.slug}>
              <Hover className="h-full" lift={-6}>
                <article className="ac-card group relative flex h-full flex-col overflow-hidden p-6 sm:p-7">
                  {/* soft colored corner wash */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-45"
                    style={{ background: p.color }}
                  />

                  {/* top row */}
                  <div className="flex items-center justify-between">
                    <span
                      className="ac-badge flex h-14 w-14 items-center justify-center"
                      style={{ "--a": p.color } as CSSProperties}
                    >
                      <Icon name={p.icon} className="h-7 w-7" />
                    </span>
                    <span
                      aria-hidden
                      className="rounded-full bg-white/60 px-2.5 py-1 text-xs font-semibold uppercase tabular-nums tracking-[0.16em] text-muted-foreground ring-1 ring-white/70"
                    >
                      Route {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
                    {p.description}
                  </p>

                  {/* the route: vertical spine of stops */}
                  <div className="relative mt-6 flex-1">
                    <span
                      aria-hidden
                      className="absolute left-[15px] top-4 bottom-8 w-0.5 rounded-full"
                      style={{
                        background:
                          "linear-gradient(to bottom, rgba(37,96,230,0.45), rgba(26,169,214,0.45))",
                      }}
                    />
                    <ol className="space-y-2.5">
                      <li className="flex items-center gap-3">
                        <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                          <MapPin className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Start
                        </span>
                      </li>
                      {p.steps.map((step, i) => {
                        const m = deptMeta(step.deptSlug);
                        return (
                          <li key={i} className="flex items-center gap-3">
                            <span
                              className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-lg ring-1 ring-white/70 transition-transform duration-200 group-hover:scale-110"
                              style={
                                {
                                  background: `color-mix(in srgb, ${m.color} 20%, #fff)`,
                                  color: deptInk(step.deptSlug),
                                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
                                } as CSSProperties
                              }
                            >
                              <Icon name={m.icon} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                              {step.label}
                            </span>
                            <span
                              aria-hidden
                              className="flex-none text-xs font-semibold tabular-nums text-muted-foreground"
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          </li>
                        );
                      })}
                      <li className="flex items-center gap-3">
                        <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                          <Flag className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Season-ready
                        </span>
                      </li>
                    </ol>
                  </div>

                  {/* meta footer */}
                  <div className="mt-6 flex items-center justify-between border-t border-border/70 pt-4">
                    <span className="inline-flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" aria-hidden />{" "}
                        <span className="tabular-nums">
                          <AnimatedCounter value={p.steps.length} />
                        </span>{" "}
                        stops
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" aria-hidden />{" "}
                        <span className="tabular-nums">
                          <AnimatedCounter value={p.outcomes.length} />
                        </span>{" "}
                        outcomes
                      </span>
                    </span>
                    <Link
                      href={`/paths/${p.slug}`}
                      className="relative z-10 inline-flex items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <span
                        className="absolute inset-0"
                        aria-label={`View ${p.title} route`}
                      />
                      View route
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                        aria-hidden
                      />
                    </Link>
                  </div>
                </article>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* closing note */}
        <Reveal>
          <div className="ac-glass relative mt-14 flex flex-col items-start gap-4 overflow-hidden p-7 sm:flex-row sm:items-center sm:justify-between">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.22),transparent_70%)] blur-2xl"
            />
            <div className="flex items-center gap-4">
              <span
                className="ac-badge flex h-12 w-12 flex-none items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Compass className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="font-display text-lg font-bold text-foreground">
                  No route fits your goal?
                </p>
                <p className="mt-1 text-sm text-foreground/70">
                  Every department stands on its own — dive straight into a
                  guide and chart your own route through the season.
                </p>
              </div>
            </div>
            <Link href="/guides" className="ac-btn flex-none text-sm">
              Explore all guides <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
