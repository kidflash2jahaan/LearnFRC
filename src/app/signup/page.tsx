import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  BookOpenCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Sign up",
  description:
    "Create your free LearnFRC account and start mastering FIRST Robotics.",
  robots: { index: false, follow: true },
};

const VALUE_PROPS = [
  {
    icon: BookOpenCheck,
    title: "A complete FRC curriculum",
    body: "11 departments of structured, web-grounded lessons — from swerve and WPILib to the Impact Award.",
  },
  {
    icon: Sparkles,
    title: "Free forever",
    body: "No paywalls, no credit card. Just sign up and start learning today.",
  },
  {
    icon: Trophy,
    title: "Earn XP & badges",
    body: "Track progress, unlock achievements, and climb the global leaderboard.",
  },
];

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string }>;
}) {
  const { next, ref } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/dashboard");

  const safeNext = next && next.startsWith("/") ? next : undefined;
  const refValue = (ref || "").toLowerCase().replace(/[^a-z0-9_]/g, "") || undefined;

  return (
    <main className="relative min-h-[100svh] overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-50 mask-b-faded" />
        <div className="absolute left-[-10%] top-[-10%] h-[460px] w-[640px] rounded-full opacity-30 blur-3xl aurora-bg animate-aurora" />
      </div>

      <div className="mx-auto grid min-h-[100svh] max-w-7xl items-stretch gap-0 px-4 pb-16 pt-24 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:pt-28">
        {/* ===================== BRAND PANEL ===================== */}
        <BrandPanel />

        {/* ===================== FORM ===================== */}
        <section className="flex items-center justify-center py-6 lg:py-10">
          <Reveal className="w-full max-w-md" y={24}>
            <Card className="overflow-hidden border-border/80 shadow-[var(--shadow-lg)]">
              <CardContent className="p-7 pt-7 sm:p-8">
                {/* Mobile wordmark (brand panel hidden on small screens) */}
                <Link
                  href="/"
                  className="mb-6 inline-flex items-center gap-2.5 lg:hidden"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-[var(--shadow-md)]">
                    <Bot className="h-5 w-5" />
                  </span>
                  <span className="text-lg font-bold tracking-tight">
                    Learn<span className="text-gradient">FRC</span>
                  </span>
                </Link>

                <h1 className="text-2xl font-bold tracking-tight">
                  Create your free account
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Start mastering FRC in minutes — it&apos;s free, forever.
                </p>

                <div className="mt-6">
                  <AuthForm mode="signup" next={safeNext} referrer={refValue} />
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </section>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <section className="relative hidden flex-col justify-center overflow-hidden rounded-3xl border border-border bg-card/30 p-10 lg:flex">
      {/* Brand backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-brand opacity-95" />
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      </div>

      <Reveal>
        <Link href="/" className="inline-flex items-center gap-2.5 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
            <Bot className="h-5.5 w-5.5" />
          </span>
          <span className="text-xl font-bold tracking-tight">LearnFRC</span>
        </Link>
      </Reveal>

      <Reveal delay={0.08} className="mt-auto pt-16">
        <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
          Go from rookie to robot-ready.
        </h2>
        <p className="mt-3 max-w-md text-pretty leading-relaxed text-white/85">
          Join LearnFRC and get the structured, cited guide that takes any
          student through every part of FIRST Robotics.
        </p>
      </Reveal>

      <ul className="mt-10 space-y-5">
        {VALUE_PROPS.map((p, i) => (
          <Reveal as="li" key={p.title} delay={0.14 + i * 0.07}>
            <div className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
                <p.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <CheckCircle2 className="h-4 w-4 text-white/90" />
                  {p.title}
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-white/80">
                  {p.body}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>

      <Reveal delay={0.4} className="mt-12">
        <p className="text-sm text-white/70">
          Trusted sources · Real part numbers & code · Built for every role.
        </p>
      </Reveal>
    </section>
  );
}
