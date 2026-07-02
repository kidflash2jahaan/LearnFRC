import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Route, Layers, Target, Clock } from "lucide-react";
import { PATHS } from "@/lib/paths-data";
import { Icon } from "@/lib/icon-map";
import { deptMeta, deptInk } from "@/lib/departments";
import { AnimatedCounter } from "@/components/animated-counter";

export const metadata: Metadata = {
  title: "Learning Paths",
  description:
    "Guided, multi-department journeys through FRC — onboarding, programming, build & design, the Impact Award, and game day.",
};

export default function PathsPage() {
  const totalSteps = PATHS.reduce((s, p) => s + p.steps.length, 0);
  const deptsTouched = new Set(
    PATHS.flatMap((p) => p.steps.map((s) => s.deptSlug)),
  ).size;

  const stats = [
    { icon: Route, v: PATHS.length, label: "curated paths" },
    { icon: Layers, v: totalSteps, label: "guided steps" },
    { icon: Target, v: deptsTouched, label: "departments" },
  ];

  return (
    <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-24 left-[8%] h-80 w-80 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,96,230,0.22), transparent 70%)" }}
        />
        <div
          className="absolute top-40 right-[4%] h-96 w-96 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(26,169,214,0.20), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.16), transparent 70%)" }}
        />
      </div>

      {/* ===== HERO ===== */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="aq-eyebrow aq-rise aq-rise-1">
            <Route aria-hidden className="h-3.5 w-3.5" />
            Pick a journey, not a page
          </p>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Learning{" "}
            <span
              className="aq-grad-anim"
              style={{
                background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              paths
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
            Not sure where to start? Follow a guided route that threads the right
            departments together — from your first day in the pit to a
            robot-ready season.
          </p>

          <div className="aq-rise aq-rise-4 mt-8 flex flex-wrap items-center gap-3">
            <Link href={`/paths/${PATHS[0]?.slug ?? ""}`} className="aq-cta min-h-[44px]">
              Start the first path
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Link href="/guides" className="aq-ghost inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold">
              Browse departments
            </Link>
          </div>

          {/* stat chips */}
          <div className="aq-rise aq-rise-5 mt-8 flex flex-wrap gap-3">
            {stats.map((s, i) => (
              <span
                key={s.label}
                className="aq-chip aq-reveal"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <s.icon aria-hidden className="aq-badge-bob h-3.5 w-3.5 text-primary" />
                <span className="font-semibold tabular-nums text-foreground">
                  <AnimatedCounter value={s.v} />
                </span>
                <span className="text-muted-foreground">{s.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* floating glass preview of the first path */}
        {PATHS[0] && (
          <aside className="aq-glass aq-sheen aq-float aq-rise aq-rise-3 relative rounded-3xl p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span
                className="aq-badge aq-badge-bob flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ "--a": PATHS[0].color } as CSSProperties}
              >
                <Icon name={PATHS[0].icon} aria-hidden className="h-6 w-6" />
              </span>
              <div>
                <p className="aq-eyebrow">
                  Featured path
                </p>
                <p className="aq-display text-lg font-semibold leading-tight text-foreground">
                  {PATHS[0].title}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-foreground/70">
              {PATHS[0].description}
            </p>

            {/* the department journey */}
            <div className="mt-6 space-y-2.5">
              {PATHS[0].steps.slice(0, 5).map((step, i) => {
                const m = deptMeta(step.deptSlug);
                return (
                  <div
                    key={i}
                    className="aq-tile aq-reveal flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
                    style={{ "--a": m.color, animationDelay: `${i * 80}ms` } as CSSProperties}
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-white/60 text-foreground ring-1 ring-white/70">
                      <Icon name={m.icon} aria-hidden className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {step.label}
                    </span>
                    <span aria-hidden className="flex-none text-xs font-semibold tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </section>

      {/* ===== PATH CARDS ===== */}
      <div className="mt-20">
        <div className="aq-reveal flex items-end justify-between gap-4">
          <div>
            <p className="aq-eyebrow">Every route, decoded</p>
            <h2 className="aq-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Choose your path
            </h2>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Each path links straight into live department guides.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {PATHS.map((p, idx) => (
            <Link
              key={p.slug}
              href={`/paths/${p.slug}`}
              className="aq-card aq-card-hover aq-reveal group relative flex h-full flex-col overflow-hidden rounded-3xl p-6 sm:p-7"
              style={{ animationDelay: `${idx * 90}ms` }}
            >
              {/* soft colored corner wash */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-45"
                style={{ background: p.color }}
              />

              {/* top row */}
              <div className="flex items-center justify-between">
                <span
                  className="aq-badge aq-badge-bob flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ "--a": p.color } as CSSProperties}
                >
                  <Icon name={p.icon} aria-hidden className="h-7 w-7" />
                </span>
                <span aria-hidden className="text-xs font-semibold uppercase tabular-nums tracking-[0.18em] text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")} / {String(PATHS.length).padStart(2, "0")}
                </span>
              </div>

              <h3 className="aq-display mt-5 text-xl font-bold tracking-tight text-foreground">
                {p.title}
              </h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-foreground/70">
                {p.description}
              </p>

              {/* department journey connector */}
              <div className="mt-6 flex flex-wrap items-center gap-1.5">
                {p.steps.map((step, i) => {
                  const m = deptMeta(step.deptSlug);
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                        style={
                          {
                            "--a": m.color,
                            background: `color-mix(in srgb, ${m.color} 20%, #fff)`,
                            color: deptInk(step.deptSlug),
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
                          } as CSSProperties
                        }
                        title={step.label}
                        aria-label={step.label}
                      >
                        <Icon name={m.icon} aria-hidden className="h-4 w-4" />
                      </span>
                      {i < p.steps.length - 1 && (
                        <span
                          aria-hidden
                          className="h-0.5 w-3 rounded-full bg-border"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* meta footer */}
              <div className="mt-6 flex items-center justify-between border-t border-border/70 pt-4">
                <span className="inline-flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers aria-hidden className="h-3.5 w-3.5" />{" "}
                    <span className="tabular-nums"><AnimatedCounter value={p.steps.length} /></span> steps
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Target aria-hidden className="h-3.5 w-3.5" />{" "}
                    <span className="tabular-nums"><AnimatedCounter value={p.outcomes.length} /></span> outcomes
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  View path
                  <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* closing note */}
        <div className="aq-glass aq-sheen aq-reveal mt-12 flex flex-col items-start gap-4 rounded-3xl p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="aq-icon aq-badge-bob h-12 w-12 flex-none">
              <Clock aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <p className="aq-display text-lg font-bold text-foreground">
                No path fits your goal?
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                Every department stands on its own — dive straight into a guide
                and build your own route through the season.
              </p>
            </div>
          </div>
          <Link href="/guides" className="aq-cta min-h-[44px] flex-none">
            Explore all guides
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
