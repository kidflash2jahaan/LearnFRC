import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Layers,
} from "lucide-react";
import { getDepartments, getCompletedLessonIds } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DepartmentCard } from "@/components/department-card";
import { AnimatedCounter } from "@/components/animated-counter";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Glow,
} from "@/components/motion/primitives";
import { PitRow, type PitStop } from "./_pit-row";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Explore every FRC department — mechanical, CAD, programming, electrical, business, outreach, scouting, drive team and more. Structured guides from fundamentals to advanced.",
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function GuidesPage() {
  const [departments, { user }] = await Promise.all([
    getDepartments(),
    getSession(),
  ]);

  const progress: Record<string, number> = {};
  if (user) {
    const supabase = await createClient();
    const [{ data: lessons }, completed] = await Promise.all([
      supabase.from("lessons").select("id, modules(department_id)"),
      getCompletedLessonIds(user.id),
    ]);
    const totals: Record<string, number> = {};
    const done: Record<string, number> = {};
    for (const l of lessons ?? []) {
      const dep = (l.modules as { department_id?: string } | null)?.department_id;
      if (!dep) continue;
      totals[dep] = (totals[dep] ?? 0) + 1;
      if (completed.has(l.id as string)) done[dep] = (done[dep] ?? 0) + 1;
    }
    for (const d of departments)
      progress[d.id] = totals[d.id]
        ? Math.round(((done[d.id] ?? 0) / totals[d.id]) * 100)
        : 0;
  }

  const totalModules = departments.reduce((s, d) => s + d.moduleCount, 0);
  const totalLessons = departments.reduce((s, d) => s + d.lessonCount, 0);

  // Signature hero device: the first stops on the pit walk.
  const pitStops: PitStop[] = departments.slice(0, 6).map((d) => ({
    slug: d.slug,
    name: d.name,
    icon: deptMeta(d.slug).icon,
    color: deptMeta(d.slug).color,
    lessonCount: d.lessonCount,
  }));

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "640px", pos: { left: "-170px", top: "-220px" }, color: "#8bbcff", opacity: 0.65 },
          { size: "580px", pos: { right: "-190px", top: "-120px" }, color: "#6ff0ea", opacity: 0.55, delay: 2 },
          { size: "540px", pos: { left: "30%", top: "520px" }, color: "#c8b6ff", opacity: 0.45, delay: 4 },
        ]}
      />

      {/* ============================ HERO — walk the pit ============================ */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:pb-20 lg:pt-36 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Pick your department</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-[3.4rem]">
              Walk the pit,{" "}
              <span style={BRAND_GRADIENT}>department by department.</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              A full FRC team is eleven teams in one. This is the whole map of
              build season — every stop a complete curriculum of structured
              modules and example-rich lessons that carry you from your first
              day in the pit to robot-ready.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/guides/getting-started" className="ac-btn text-sm">
                Start with the basics <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/glossary" className="ac-btn-ghost text-sm">
                Decode the acronyms
              </Link>
            </div>
          </RiseItem>
          <RiseItem>
            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold text-foreground">
                  <AnimatedCounter value={departments.length} />
                </dd>
                <dt>departments</dt>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold text-foreground">
                  <AnimatedCounter value={totalModules} />
                </dd>
                <dt>modules</dt>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold text-foreground">
                  <AnimatedCounter value={totalLessons} />
                </dd>
                <dt>lessons</dt>
              </div>
            </dl>
          </RiseItem>
        </RiseGroup>

        <PitRow stops={pitStops} totalCount={departments.length} />
      </section>

      {/* ============================ THE FULL WALK ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal>
          <p className="ac-eyebrow inline-flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" aria-hidden /> Every track, mapped
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-balance font-display text-3xl font-bold sm:text-4xl">
              Explore all <AnimatedCounter value={departments.length} /> departments
            </h2>
            <span className="ac-chip inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <Icon name="Rocket" className="h-4 w-4" aria-hidden />
              Fundamentals → advanced
            </span>
          </div>
        </Reveal>

        <RevealGroup className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d, i) => (
            <RevealItem key={d.slug} className="h-full">
              <DepartmentCard
                slug={d.slug}
                name={d.name}
                tagline={d.tagline}
                moduleCount={d.moduleCount}
                lessonCount={d.lessonCount}
                progressPct={user ? progress[d.id] : undefined}
                index={i + 1}
              />
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ============================ CLOSING CTA ============================ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="ac-glass relative overflow-hidden p-8 text-center sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.25),transparent_70%)] blur-2xl"
            />
            <p className="ac-eyebrow">Not sure where to stand?</p>
            <h2 className="mx-auto mt-3 max-w-xl text-balance font-display text-3xl font-bold sm:text-4xl">
              Start at the <span style={BRAND_GRADIENT}>beginning.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Getting Started walks you through the whole map — what each
              department does and where a rookie fits. Every path begins at
              zero and ends robot-ready.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/guides/getting-started" className="ac-btn text-sm">
                Take the intro track <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/glossary" className="ac-btn-ghost text-sm">
                Browse the glossary
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
