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
  Sparkles,
} from "lucide-react";
import { getDepartments } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import {
  StatusPill,
  NeonCounter,
  TerminalFrame,
  TypeLine,
} from "@/components/motion/terminal";

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
  { to: 11, suffix: "", label: "departments" },
  { to: 100, suffix: "", label: "modules" },
  { to: 393, suffix: "+", label: "lessons" },
  { to: 100, suffix: "%", label: "free" },
];

export default async function ForTeamsPage() {
  const departments = await getDepartments().catch(() => []);
  const track = departments.slice(0, 6);

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
        <div className="absolute left-1/2 top-[-8%] h-[440px] w-[820px] -translate-x-1/2 rounded-full opacity-30 blur-3xl aurora-bg" />
      </div>

      {/* HERO */}
      <section className="mx-auto max-w-5xl px-4 pt-32 pb-12 text-center sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-4 flex justify-center">
            <StatusPill tone="primary">
              <Users className="h-3 w-3" /> For mentors &amp; team leads
            </StatusPill>
          </div>
          <h1 className="text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Onboard your{" "}
            <span className="text-gradient">whole team</span> — without
            rebuilding training every year
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            LearnFRC gives your team a structured curriculum for every
            department, and automatically groups everyone who signs up with your
            team number — so you can all see each other&apos;s progress.
            Completely free.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="brand" size="lg">
              <Link href="/teams">
                Go to your team <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/guides">Browse the curriculum</Link>
            </Button>
          </div>
        </Reveal>

        {/* stat band */}
        <Reveal delay={0.12} className="mx-auto mt-12 max-w-3xl">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm"
              >
                <div className="font-display text-3xl font-bold text-gradient">
                  <NeonCounter to={s.to} suffix={s.suffix} />
                </div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            // setup.sh
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <StaggerItem key={s.title}>
              <div className="group relative h-full rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--glow-primary)]">
                <span className="absolute right-5 top-4 font-mono text-3xl font-bold text-border">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Stagger className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <div className="group h-full rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--glow-accent)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* SUGGESTED ROOKIE TRACK */}
      {track.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center">
              <div className="mb-3 flex justify-center">
                <StatusPill tone="accent">
                  <Sparkles className="h-3 w-3" /> Suggested rookie track
                </StatusPill>
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                A starting path for new members
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                Not sure where to point rookies? Start them here and work down —
                or let them pick the department they&apos;re joining.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="mx-auto mt-8 max-w-2xl">
            <TerminalFrame title="rookie_track.sh — ~/learnfrc">
              <TypeLine
                prompt="~/learnfrc $"
                text="./onboard --role rookie --start here"
                className="text-sm text-foreground"
              />
              <Stagger className="mt-4 space-y-2.5">
                {track.map((d, i) => (
                  <StaggerItem key={d.slug}>
                    <Link
                      href={`/guides/${d.slug}`}
                      className="group flex items-center gap-4 rounded-xl border border-border bg-background/40 p-3.5 transition-all hover:border-primary/40 hover:bg-card/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 font-mono text-sm font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium transition-colors group-hover:text-primary">
                          {d.name}
                        </div>
                        {d.tagline && (
                          <div className="truncate text-sm text-muted-foreground">
                            {d.tagline}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            </TerminalFrame>
          </Reveal>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/60 p-8 text-center shadow-[var(--glow-primary)] backdrop-blur-sm sm:p-12">
            <div aria-hidden className="absolute inset-0 -z-10 bg-dots opacity-30" />
            <div
              aria-hidden
              className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary to-transparent"
            />
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              ready
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to onboard your team?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
              Add your team number and tell your members to do the same —
              everyone groups together automatically. It&apos;s free, and
              there&apos;s nothing to set up.
            </p>
            <Button asChild variant="brand" size="lg" className="mt-6">
              <Link href="/teams">
                Go to your team <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
