import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  Hash,
  Eye,
  GraduationCap,
  Award,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { getDepartments } from "@/lib/queries";
import { deptMeta } from "@/lib/departments";
import { ICONS } from "@/lib/icon-map";

export const metadata: Metadata = {
  title: "LearnFRC for Teams — free onboarding curriculum for FRC teams",
  description:
    "Onboard your whole FRC team with a ready-made curriculum across every department. Everyone who signs up with your team number is grouped automatically — and you can all see each other's progress. Free.",
};

const STEPS = [
  {
    icon: Hash,
    title: "Everyone adds your team number",
    body: "When your members sign up, they enter the same FRC team number. That's the only step — no codes, no invites, nothing to set up.",
  },
  {
    icon: Users,
    title: "Your team groups automatically",
    body: "Anyone with your team number is instantly grouped together, and new members show up the moment they join.",
  },
  {
    icon: Eye,
    title: "See each other's progress",
    body: "You and your teammates can all see who's completed which lessons, their XP, and recent activity — so you can push each other and spot who needs help.",
  },
];

const FEATURES = [
  {
    icon: GraduationCap,
    title: "A ready-made curriculum",
    body: "393+ lessons across all 11 departments — stop rebuilding rookie training from scratch every season.",
  },
  {
    icon: Award,
    title: "Quizzes & certificates",
    body: "Every lesson ends in a quiz, and members earn certificates — real proof they learned the material.",
  },
  {
    icon: CheckCircle2,
    title: "Free, forever",
    body: "No ads, no paywall, no per-seat pricing. Built by a student, for the community.",
  },
];

const STATS = [
  { value: "11", label: "departments" },
  { value: "100", label: "modules" },
  { value: "393+", label: "lessons" },
  { value: "100%", label: "free" },
];

const HEADLINE_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function ForTeamsPage() {
  const departments = await getDepartments().catch(() => []);
  const track = departments.slice(0, 6);

  return (
    <div className="relative overflow-hidden">
      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[420px] w-[420px]"
          style={{ top: "-6%", left: "8%", background: "rgba(37,96,230,0.28)" }}
        />
        <span
          className="h-[380px] w-[380px]"
          style={{ top: "12%", right: "4%", background: "rgba(26,169,214,0.24)" }}
        />
        <span
          className="h-[360px] w-[360px]"
          style={{ top: "48%", left: "42%", background: "rgba(139,127,255,0.18)" }}
        />
      </div>

      {/* HERO */}
      <section className="relative mx-auto max-w-6xl px-4 pt-28 pb-14 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="aq-eyebrow aq-rise aq-rise-1">
              <Users className="h-3.5 w-3.5" /> For mentors &amp; team leads
            </p>
            <h1 className="aq-rise aq-rise-2 mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Onboard your{" "}
              <span style={HEADLINE_GRADIENT}>whole team</span> without
              rebuilding training every season
            </h1>
            <p className="aq-rise aq-rise-3 mt-5 max-w-xl text-lg leading-relaxed text-foreground/70">
              LearnFRC gives your team a structured curriculum for every
              department, and automatically groups everyone who signs up with
              your team number — so you can all see each other&apos;s progress
              from kickoff to competition. Completely free.
            </p>
            <div className="aq-rise aq-rise-4 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/teams"
                className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Go to your team <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/guides"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Browse the curriculum
              </Link>
            </div>
          </div>

          {/* floating glass stat panel */}
          <div className="aq-glass aq-rise aq-rise-3 rounded-[28px] p-6 sm:p-7 lg:justify-self-end">
            <p className="aq-eyebrow">The whole program, ready</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {STATS.map((s) => (
                <div key={s.label} className="aq-card rounded-2xl p-4 text-center">
                  <div
                    className="aq-display text-4xl font-bold"
                    style={HEADLINE_GRADIENT}
                  >
                    {s.value}
                  </div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            <hr className="aq-divider my-5" />
            <p className="text-sm leading-relaxed text-foreground/70">
              One team number groups everyone — rookies, veterans, and mentors
              — into a shared roster you can all see.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="aq-reveal text-center">
          <p className="aq-eyebrow justify-center">Three steps, zero setup</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-foreground/70">
            No admin dashboard, no invite codes. Your team assembles itself.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="aq-card aq-card-hover aq-reveal relative h-full rounded-[20px] p-6"
            >
              <span className="pointer-events-none absolute right-6 top-5 font-mono text-3xl font-bold text-primary/15">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="aq-icon flex h-12 w-12 items-center justify-center">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="aq-reveal text-center">
          <p className="aq-eyebrow justify-center">Why teams pick LearnFRC</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a rookie season needs
          </h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="aq-card aq-card-hover aq-reveal h-full rounded-[20px] p-6"
            >
              <span className="aq-icon flex h-12 w-12 items-center justify-center">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SUGGESTED ROOKIE TRACK */}
      {track.length > 0 && (
        <section className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="aq-reveal text-center">
            <p className="aq-eyebrow justify-center">Suggested rookie track</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              A starting path for new members
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-foreground/70">
              Not sure where to point rookies? Start them here and work down —
              or let them pick the department they&apos;re joining in the pit.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {track.map((d, i) => {
              const m = deptMeta(d.slug);
              const DeptIcon = ICONS[m.icon] ?? GraduationCap;
              return (
                <Link
                  key={d.slug}
                  href={`/guides/${d.slug}`}
                  className="aq-tile aq-reveal group block rounded-[20px] p-[18px]"
                  style={{ "--a": m.color } as CSSProperties}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="aq-badge flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]"
                      style={{ "--a": m.color } as CSSProperties}
                    >
                      <DeptIcon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#182338]/60">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="truncate text-[15px] font-semibold text-[#182338]">
                          {d.name}
                        </div>
                      </div>
                      {d.tagline && (
                        <div className="mt-0.5 truncate text-sm text-[#182338]/70">
                          {d.tagline}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="aq-arw h-4 w-4 shrink-0 text-[#182338]/60" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* CTA BAND */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="aq-glass aq-reveal rounded-[28px] px-8 py-12 text-center sm:px-16">
          <p className="aq-eyebrow justify-center">Ready when you are</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to onboard your team?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-foreground/70">
            Add your team number and tell your members to do the same —
            everyone groups together automatically. It&apos;s free, and
            there&apos;s nothing to set up.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/teams"
              className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Go to your team <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/guides"
              className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Browse the curriculum
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
