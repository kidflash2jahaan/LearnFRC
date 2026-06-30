import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Route, Layers, Target } from "lucide-react";
import { PATHS } from "@/lib/paths-data";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { TerminalFrame, StatusPill, TypeLine, NeonCounter } from "@/components/motion/terminal";

export const metadata: Metadata = {
  title: "Learning Paths",
  description:
    "Guided, multi-department journeys through FRC — onboarding, programming, build & design, the Impact Award, and game day.",
};

export default function PathsPage() {
  const totalSteps = PATHS.reduce((s, p) => s + p.steps.length, 0);
  const deptsTouched = new Set(PATHS.flatMap((p) => p.steps.map((s) => s.deptSlug)))
    .size;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      {/* ===== HERO ===== */}
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="mb-4 flex justify-center">
          <StatusPill tone="primary">
            <Route className="h-3.5 w-3.5" />
            {PATHS.length} curated journeys
          </StatusPill>
        </div>
        <h1 className="text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Learning <span className="text-gradient">paths</span>
        </h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">
          Not sure where to start? Follow a guided path that threads the right
          departments together for your goal.
        </p>
      </Reveal>

      {/* terminal summary strip */}
      <Reveal delay={0.08} className="mx-auto mt-10 max-w-3xl">
        <TerminalFrame
          title="paths.index — ~/learnfrc"
          glow
          right={<StatusPill tone="accent">routes loaded</StatusPill>}
        >
          <TypeLine
            prompt="~/learnfrc $"
            text="plan --from rookie --to robot-ready"
            className="text-sm text-foreground"
          />
          <div className="mt-4 grid grid-cols-3 gap-3 font-mono">
            {[
              { v: PATHS.length, label: "paths" },
              { v: totalSteps, label: "steps" },
              { v: deptsTouched, label: "departments" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-border bg-background/40 p-3 text-center"
              >
                <div className="text-2xl font-bold text-primary">
                  <NeonCounter to={s.v} />
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </TerminalFrame>
      </Reveal>

      {/* ===== PATH CARDS ===== */}
      <Stagger className="mt-14 grid gap-5 md:grid-cols-2">
        {PATHS.map((p, idx) => (
          <StaggerItem key={p.slug}>
            <Link
              href={`/paths/${p.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ background: p.color }}
              />
              {/* top row */}
              <div className="flex items-center justify-between">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-[var(--shadow-md)] ring-1 ring-white/10"
                  style={{ backgroundImage: `linear-gradient(135deg, ${p.color}, ${p.color})` }}
                >
                  <Icon name={p.icon} className="h-6 w-6" />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                  path_{String(idx + 1).padStart(2, "0")}
                </span>
              </div>

              <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
                {p.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {p.description}
              </p>

              {/* step connector — the department journey */}
              <div className="mt-5 flex items-center gap-1.5">
                {p.steps.map((step, i) => {
                  const m = deptMeta(step.deptSlug);
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/50 transition-transform group-hover:scale-110"
                        style={{ color: m.color }}
                        title={step.label}
                      >
                        <Icon name={m.icon} className="h-3.5 w-3.5" />
                      </span>
                      {i < p.steps.length - 1 && (
                        <span className="h-px w-3 bg-gradient-to-r from-border to-border/30" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* meta */}
              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 font-mono text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> {p.steps.length} steps
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" /> {p.outcomes.length} outcomes
                  </span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5 font-medium"
                  style={{ color: p.color }}
                >
                  View path
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
