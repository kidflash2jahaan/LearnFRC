import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  KeyRound,
  LayoutDashboard,
  GraduationCap,
  Award,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { getDepartments } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "LearnFRC for Teams — free onboarding curriculum for mentors",
  description:
    "Onboard your whole FRC team with a ready-made curriculum across every department. Create a team, share one join code, and track every member's progress. Free.",
};

const STEPS = [
  {
    icon: Users,
    title: "Create your team",
    body: "Takes 10 seconds — name it and add your team number. You become the manager.",
  },
  {
    icon: KeyRound,
    title: "Share one join code",
    body: "Drop the code or invite link in your team's Slack/Discord. New members sign up and join; members who already have an account just enter the code — their progress carries over.",
  },
  {
    icon: LayoutDashboard,
    title: "Track everyone's progress",
    body: "Your dashboard shows each member's completed lessons across every department, their XP, and when they were last active.",
  },
];

const FEATURES = [
  {
    icon: GraduationCap,
    title: "A ready-made curriculum",
    body: "390+ lessons across all 11 departments — stop rebuilding rookie training from scratch every season.",
  },
  {
    icon: Award,
    title: "Quizzes & certificates",
    body: "Every lesson ends in a quiz, and members earn certificates — real proof they learned the material.",
  },
  {
    icon: CheckCircle2,
    title: "Free, forever",
    body: "No ads, no paywall, no per-seat pricing. Built by a student (FRC 5835) for the community.",
  },
];

export default async function ForTeamsPage() {
  const departments = await getDepartments().catch(() => []);
  const track = departments.slice(0, 6);

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-grid opacity-40 mask-b-faded" />
        <div className="absolute left-1/2 top-[-6%] h-[440px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl aurora-bg" />
      </div>

      {/* HERO */}
      <section className="mx-auto max-w-5xl px-4 pt-32 pb-12 text-center sm:px-6 lg:px-8">
        <Reveal>
          <Badge variant="primary" className="mb-4">
            <Users className="h-3 w-3" /> For mentors &amp; team leads
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Onboard your <span className="text-gradient">whole team</span> — without
            rebuilding training every year
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            LearnFRC gives your team a structured curriculum for every department, one
            join code to bring everyone in, and a dashboard to see who&apos;s learned
            what. Completely free.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="brand" size="lg">
              <Link href="/teams">
                Create your team <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/guides">Browse the curriculum</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <StaggerItem key={s.title}>
              <div className="relative h-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
                <span className="absolute right-5 top-5 font-display text-3xl font-bold text-border">
                  {i + 1}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <s.icon className="h-5.5 w-5.5" />
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
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
              <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
                  <f.icon className="h-5.5 w-5.5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
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
              <Badge variant="accent" className="mb-3">
                <Sparkles className="h-3 w-3" /> Suggested rookie track
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                A starting path for new members
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                Not sure where to point rookies? Start them here and work down — or let
                them pick the department they&apos;re joining.
              </p>
            </div>
          </Reveal>
          <Stagger className="mx-auto mt-8 max-w-2xl space-y-3">
            {track.map((d, i) => (
              <StaggerItem key={d.slug}>
                <Link
                  href={`/guides/${d.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-primary/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft font-display font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{d.name}</div>
                    {d.tagline && (
                      <div className="truncate text-sm text-muted-foreground">{d.tagline}</div>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-md)] sm:p-12">
            <div aria-hidden className="absolute inset-0 -z-10 bg-dots opacity-40" />
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to onboard your team?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
              Create your team now and share the code with your members. It&apos;s free,
              and setup takes under a minute.
            </p>
            <Button asChild variant="brand" size="lg" className="mt-6">
              <Link href="/teams">
                Create your team <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
