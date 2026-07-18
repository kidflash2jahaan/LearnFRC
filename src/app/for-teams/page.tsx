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
import { Icon } from "@/lib/icon-map";
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
import { OnboardingRail, type OnboardingStep } from "./_onboarding-rail";
import { TeamPanel, type RosterMember } from "./_team-panel";

export const metadata: Metadata = {
  title: "LearnFRC for Teams — free onboarding curriculum for FRC teams",
  description:
    "Onboard your whole FRC team with a ready-made curriculum across every department. Everyone who signs up with your team number is grouped automatically — and you can all see each other's progress. Free.",
  alternates: { canonical: "/for-teams" },
};

// Icons are referenced by NAME and resolved inside the client rail —
// component functions can't cross the server -> client boundary.
const STEPS: OnboardingStep[] = [
  {
    n: "01",
    icon: "hash",
    title: "Everyone adds your team number",
    body: "When your members sign up, they enter the same FRC team number. That's the only step — no codes, no invites, nothing to set up.",
  },
  {
    n: "02",
    icon: "users",
    title: "Your team groups automatically",
    body: "Anyone with your team number is instantly grouped together, and new members show up the moment they join.",
  },
  {
    n: "03",
    icon: "eye",
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

const STATS: { value: number; suffix?: string; label: string }[] = [
  { value: 11, label: "departments" },
  { value: 101, label: "modules" },
  { value: 394, suffix: "", label: "lessons" },
  { value: 100, suffix: "%", label: "free" },
];

// Illustrative roster shown in the hero "team assembles itself" panel.
const SAMPLE_ROSTER: RosterMember[] = [
  { initials: "AK", name: "Ava K.", role: "Mechanical", xp: 1240 },
  { initials: "RJ", name: "Ravi J.", role: "Programming", xp: 980 },
  { initials: "MB", name: "Mia B.", role: "Scouting", xp: 760 },
  { initials: "DP", name: "Dev P.", role: "Rookie", xp: 120 },
];

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function ForTeamsPage() {
  const departments = await getDepartments().catch(() => []);
  const track = departments.slice(0, 6);

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "480px", pos: { right: "-140px", top: "-40px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "500px", pos: { left: "34%", top: "620px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pb-20 lg:pt-32 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">For mentors &amp; team leads</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.04] sm:text-5xl lg:text-[3.3rem]">
              Onboard your <span style={BRAND_GRADIENT}>whole team</span> in one
              build season.
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              LearnFRC gives your team a structured curriculum for every
              department, and automatically groups everyone who signs up with
              your team number — so you can all see each other&apos;s progress
              from kickoff to competition. Completely free.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/teams" className="ac-btn text-sm">
                Go to your team <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/guides" className="ac-btn-ghost text-sm">
                Browse the curriculum
              </Link>
            </div>
          </RiseItem>
          <RiseItem>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>
                <b className="font-semibold text-foreground">
                  <AnimatedCounter value={11} />
                </b>{" "}
                departments
              </span>
              <span>
                <b className="font-semibold text-foreground">
                  <AnimatedCounter value={394} />
                </b>{" "}
                lessons
              </span>
              <span>
                <b className="font-semibold text-foreground">$0</b> — always
                free
              </span>
            </div>
          </RiseItem>
        </RiseGroup>

        <TeamPanel roster={SAMPLE_ROSTER} />
      </section>

      {/* ============= HOW IT WORKS — the signature 3-step rail ========= */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="ac-eyebrow justify-center">Three steps, zero setup</p>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-foreground/70">
            No admin dashboard, no invite codes. Your team assembles itself.
          </p>
        </Reveal>

        <OnboardingRail steps={STEPS} />
      </section>

      {/* ============= WHAT YOUR TEAM GETS — features + stats =========== */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="ac-eyebrow justify-center">Why teams pick LearnFRC</p>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold sm:text-4xl">
            Everything a rookie season needs
          </h2>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <RevealItem key={f.title}>
              <Hover className="h-full" lift={-5}>
                <div className="ac-card h-full p-6">
                  <span
                    className="ac-badge flex h-12 w-12 items-center justify-center"
                    style={{ "--a": "#2560e6" } as CSSProperties}
                  >
                    <f.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>

        <RevealGroup className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((s) => (
            <RevealItem key={s.label}>
              <Hover className="h-full">
                <div className="ac-glass h-full p-5 text-center">
                  <div
                    className="font-display text-3xl font-extrabold leading-none"
                    style={BRAND_GRADIENT}
                  >
                    <AnimatedCounter value={s.value} suffix={s.suffix} />
                  </div>
                  <div className="mt-1.5 text-[13px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </div>
                </div>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ==================== SUGGESTED ROOKIE TRACK ==================== */}
      {track.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <p className="ac-eyebrow justify-center">Suggested rookie track</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold sm:text-4xl">
              A starting path for new members
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-foreground/70">
              Not sure where to point rookies? Start them here and work down
              — or let them pick the department they&apos;re joining in the
              pit.
            </p>
          </Reveal>

          <RevealGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {track.map((d, i) => {
              const m = deptMeta(d.slug);
              return (
                <RevealItem key={d.slug}>
                  <Hover className="h-full">
                    <Link
                      href={`/guides/${d.slug}`}
                      className="ac-tile group block h-full p-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      style={{ "--a": m.color } as CSSProperties}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className="ac-badge flex h-12 w-12 shrink-0 items-center justify-center"
                          style={{ "--a": m.color } as CSSProperties}
                        >
                          <Icon name={m.icon} className="h-6 w-6" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-bold tabular-nums"
                              style={{ color: inkFor(m.color) }}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                              {d.name}
                            </div>
                          </div>
                          {d.tagline && (
                            <div className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">
                              {d.tagline}
                            </div>
                          )}
                        </div>
                        <ArrowUpRight
                          className="h-4 w-4 shrink-0 text-foreground/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </div>
                    </Link>
                  </Hover>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </section>
      )}

      {/* ============================= CTA ============================= */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <Reveal>
          <div className="ac-glass relative overflow-hidden p-8 text-center sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.25),transparent_70%)] blur-2xl"
            />
            <p className="ac-eyebrow flex items-center justify-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Ready when you
              are
            </p>
            <h2 className="mx-auto mt-3 max-w-xl text-balance font-display text-3xl font-bold sm:text-4xl">
              Ready to onboard your team?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Add your team number and tell your members to do the same —
              everyone groups together automatically. It&apos;s free, and
              there&apos;s nothing to set up.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/teams" className="ac-btn text-sm">
                Go to your team <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/guides" className="ac-btn-ghost text-sm">
                Browse the curriculum
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
