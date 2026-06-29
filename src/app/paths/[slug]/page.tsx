import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Target, GitBranch } from "lucide-react";
import { getPathBySlug, getAllPathSlugs } from "@/lib/paths-data";
import { getDepartments } from "@/lib/queries";
import { deptMeta } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { TerminalFrame, StatusPill } from "@/components/motion/terminal";

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
    <div className="mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <Reveal>
        <Link
          href="/paths"
          className="mb-6 inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> cd ../paths
        </Link>
      </Reveal>

      {/* ===== HEADER ===== */}
      <Reveal delay={0.05}>
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-[var(--shadow-md)] ring-1 ring-white/10"
            style={{ background: path.color }}
          >
            <Icon name={path.icon} className="h-8 w-8" />
          </span>
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" style={{ color: path.color }} />
              learning_path
            </div>
            <h1 className="mt-1 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {path.title}
            </h1>
          </div>
        </div>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
          {path.description}
        </p>
      </Reveal>

      {/* ===== OUTCOMES ===== */}
      <Reveal delay={0.1} className="mt-8">
        <TerminalFrame
          title="outcomes.md — ~/learnfrc"
          right={
            <span className="font-mono text-[11px] text-muted-foreground">
              {path.outcomes.length} goals
            </span>
          }
        >
          <h2 className="flex items-center gap-2 font-display font-semibold">
            <Target className="h-5 w-5" style={{ color: path.color }} />
            By the end, you&apos;ll be able to
          </h2>
          <ul className="mt-4 space-y-2.5">
            {path.outcomes.map((o, i) => (
              <li key={i} className="flex gap-2.5 text-foreground/90">
                <Check
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: path.color }}
                />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </TerminalFrame>
      </Reveal>

      {/* ===== TIMELINE ===== */}
      <Reveal delay={0.12} className="mt-12">
        <div className="mb-5 flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            // the route
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent" />
          <StatusPill tone="muted" pulse={false}>
            {path.steps.length} steps
          </StatusPill>
        </div>
      </Reveal>

      <div className="relative">
        {/* connector line: cyan -> lime gradient */}
        <div
          aria-hidden
          className="absolute bottom-6 left-[34px] top-6 w-px bg-gradient-to-b from-accent/60 via-border to-primary/60"
        />
        <ol className="space-y-4">
          {path.steps.map((step, i) => {
            const m = deptMeta(step.deptSlug);
            const deptName = nameBySlug.get(step.deptSlug) ?? step.label;
            return (
              <Reveal as="li" key={i} delay={i * 0.06} className="relative">
                <Link
                  href={`/guides/${step.deptSlug}`}
                  className="group flex gap-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
                >
                  <div className="relative z-10 flex flex-col items-center">
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[var(--shadow-md)] ring-1 ring-white/10 transition-transform group-hover:scale-105"
                      style={{ backgroundImage: `linear-gradient(135deg, ${m.color}, ${m.to})` }}
                    >
                      <Icon name={m.icon} className="h-6 w-6" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      <span className="text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>·</span>
                      <span style={{ color: m.color }}>{deptName}</span>
                    </div>
                    <h3 className="mt-1 font-display font-semibold transition-colors group-hover:text-primary">
                      {step.label}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.note}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </Reveal>
            );
          })}
        </ol>
      </div>

      {firstStep && (
        <Reveal className="mt-10 text-center">
          <Button asChild variant="brand" size="lg">
            <Link href={`/guides/${firstStep.deptSlug}`}>
              Start this path
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Reveal>
      )}
    </div>
  );
}
