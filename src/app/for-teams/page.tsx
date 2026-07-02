import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  Award,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { getDepartments } from "@/lib/queries";
import { deptMeta, inkFor } from "@/lib/departments";
import { ICONS } from "@/lib/icon-map";
import { AnimatedCounter } from "@/components/animated-counter";
import { Reveal } from "@/components/motion/reveal";
import { OnboardingRail } from "./_onboarding-rail";

export const metadata: Metadata = {
  title: "LearnFRC for Teams — free onboarding curriculum for FRC teams",
  description:
    "Onboard your whole FRC team with a ready-made curriculum across every department. Everyone who signs up with your team number is grouped automatically — and you can all see each other's progress. Free.",
};

// Icons are referenced by NAME and resolved inside the client rail —
// component functions can't cross the server -> client boundary.
const STEPS = [
  {
    n: "01",
    icon: "hash" as const,
    title: "Everyone adds your team number",
    body: "When your members sign up, they enter the same FRC team number. That's the only step — no codes, no invites, nothing to set up.",
  },
  {
    n: "02",
    icon: "users" as const,
    title: "Your team groups automatically",
    body: "Anyone with your team number is instantly grouped together, and new members show up the moment they join.",
  },
  {
    n: "03",
    icon: "eye" as const,
    title: "See each other's progress",
    body: "You and your teammates can all see who's completed which lessons, their XP, and recent activity — so you can push each other and spot who needs help.",
  },
];

const FEATURES = [
  {
    icon: GraduationCap,
    title: "A ready-made curriculum",
    body: "394 lessons across all 11 departments — stop rebuilding rookie training from scratch every season.",
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

const STATS: {
  value: number;
  suffix?: string;
  label: string;
}[] = [
  { value: 11, label: "departments" },
  { value: 101, label: "modules" },
  { value: 394, suffix: "+", label: "lessons" },
  { value: 100, suffix: "%", label: "free" },
];

// Illustrative roster shown in the hero "team assembles itself" panel.
const SAMPLE_ROSTER = [
  { initials: "AK", name: "Ava K.", role: "Mechanical", xp: 1240 },
  { initials: "RJ", name: "Ravi J.", role: "Programming", xp: 980 },
  { initials: "MB", name: "Mia B.", role: "Scouting", xp: 760 },
  { initials: "DP", name: "Dev P.", role: "Rookie", xp: 120 },
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
    <div className="relative overflow-x-clip">
      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[520px] w-[520px]"
          style={{
            top: "-8%",
            left: "4%",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[460px] w-[460px]"
          style={{
            top: "6%",
            right: "-4%",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[420px] w-[420px]"
          style={{
            top: "52%",
            left: "38%",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <section className="relative mx-auto max-w-6xl px-4 pt-28 pb-14 sm:px-6 sm:pt-28 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <span className="aq-chip aq-eyebrow aq-rise aq-rise-1 inline-flex items-center gap-2">
              <Users aria-hidden="true" className="h-3.5 w-3.5" /> For mentors &amp; team leads
            </span>
            <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-extrabold leading-[1.04] sm:text-5xl lg:text-[3.3rem]">
              Onboard your{" "}
              <span className="aq-grad-anim" style={HEADLINE_GRADIENT}>
                whole team
              </span>{" "}
              in one build season.
            </h1>
            <p className="aq-rise aq-rise-3 mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
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
                Go to your team{" "}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/guides"
                className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Browse the curriculum
              </Link>
            </div>
            <div className="aq-rise aq-rise-5 mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>
                <b className="font-semibold text-foreground">
                  <AnimatedCounter value={11} />
                </b>{" "}
                departments
              </span>
              <span>
                <b className="font-semibold text-foreground">
                  <AnimatedCounter value={394} suffix="+" />
                </b>{" "}
                lessons
              </span>
              <span>
                <b className="font-semibold text-foreground">$0</b> — always free
              </span>
            </div>
          </div>

          {/* floating glass panel — the team "assembling itself" */}
          <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-3 rounded-[28px] p-6 sm:p-7 lg:justify-self-end">
            <div className="mb-4 flex items-center gap-2">
              <span className="aq-display text-[17px] font-bold text-foreground">
                Team 254 · roster
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a7a43]">
                <span className="aq-pulse h-2 w-2 rounded-full bg-[#12b565]" />
                SAMPLE
              </span>
            </div>

            <ul className="space-y-2.5">
              {SAMPLE_ROSTER.map((r, i) => (
                <li
                  key={r.initials}
                  className="aq-card aq-card-hover aq-reveal flex items-center gap-3 rounded-2xl p-3"
                  style={{ animationDelay: `${0.15 + i * 0.12}s` } as CSSProperties}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary"
                  >
                    {r.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {r.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.role}</div>
                  </div>
                  <span className="shrink-0 tabular-nums text-xs font-semibold text-foreground/70">
                    <AnimatedCounter value={r.xp} /> XP
                  </span>
                </li>
              ))}
            </ul>
            <hr className="aq-divider my-4" />
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              One team number groups everyone — rookies, veterans, and mentors —
              into a shared roster you can all see.
            </p>
          </div>
        </div>
      </section>

      {/* ============= HOW IT WORKS — the signature 3-step rail ========= */}
      <section className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="aq-eyebrow justify-center">Three steps, zero setup</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-foreground/70">
            No admin dashboard, no invite codes. Your team assembles itself.
          </p>
        </Reveal>

        <OnboardingRail steps={STEPS} />
      </section>

      {/* ============= WHAT YOUR TEAM GETS — features + stats =========== */}
      <section className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="aq-eyebrow justify-center">Why teams pick LearnFRC</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a rookie season needs
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="aq-card aq-card-hover aq-reveal h-full rounded-[20px] p-6"
              style={{ animationDelay: `${i * 120}ms` } as CSSProperties}
            >
              <span className="aq-icon aq-badge-bob flex h-12 w-12 items-center justify-center">
                <f.icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* the whole program, by the numbers */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="aq-glass aq-card-hover aq-reveal rounded-2xl p-5 text-center"
              style={{ animationDelay: `${i * 90}ms` } as CSSProperties}
            >
              <div className="aq-display text-3xl font-extrabold leading-none" style={HEADLINE_GRADIENT}>
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-1.5 text-[13px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== SUGGESTED ROOKIE TRACK ==================== */}
      {track.length > 0 && (
        <section className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <p className="aq-eyebrow justify-center">Suggested rookie track</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              A starting path for new members
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-foreground/70">
              Not sure where to point rookies? Start them here and work down — or
              let them pick the department they&apos;re joining in the pit.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {track.map((d, i) => {
              const m = deptMeta(d.slug);
              const DeptIcon = ICONS[m.icon] ?? GraduationCap;
              return (
                <Link
                  key={d.slug}
                  href={`/guides/${d.slug}`}
                  className="aq-tile aq-reveal group block rounded-[20px] p-[18px]"
                  style={
                    { "--a": m.color, animationDelay: `${i * 80}ms` } as CSSProperties
                  }
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="aq-badge aq-badge-bob flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]"
                      style={{ "--a": m.color } as CSSProperties}
                    >
                      <DeptIcon aria-hidden="true" className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-bold tabular-nums"
                          style={{ color: inkFor(m.color) }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="truncate text-[15px] font-semibold text-foreground">
                          {d.name}
                        </div>
                      </div>
                      {d.tagline && (
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">
                          {d.tagline}
                        </div>
                      )}
                    </div>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="aq-arw h-4 w-4 shrink-0 text-foreground/60"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ============================= CTA ============================= */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="aq-glass aq-sheen aq-reveal rounded-[28px] px-8 py-12 text-center sm:px-16">
          <p className="aq-eyebrow justify-center">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> Ready when you are
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to onboard your team?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-foreground/70">
            Add your team number and tell your members to do the same — everyone
            groups together automatically. It&apos;s free, and there&apos;s
            nothing to set up.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/teams"
              className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Go to your team{" "}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
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
