import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, ShieldCheck, ArrowLeft, KeyRound, Sparkles } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { AnimatedCounter } from "@/components/animated-counter";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Log in",
  description: "Welcome back. Sign in to pick up where you left off.",
  robots: { index: false, follow: true },
};

const HEADING_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/** Department slugs whose glossy tiles ring the auth card. */
const ORBIT = [
  "mechanical-build",
  "programming-software",
  "cad-design",
  "electrical-wiring",
  "scouting-strategy",
  "drive-team",
] as const;

const STATS = [
  { value: 11, suffix: "", label: "departments" },
  { value: 180, suffix: "+", label: "lessons" },
  { value: 4200, suffix: "+", label: "learners" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/dashboard");

  const safeNext = next && next.startsWith("/") ? next : undefined;

  return (
    <main
      data-theme="arena"
      className="aq-root relative isolate min-h-[100svh] overflow-hidden text-foreground"
    >
      {/* Ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[620px] w-[620px] opacity-70"
          style={{
            left: "-180px",
            top: "-200px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[560px] w-[560px] opacity-60"
          style={{
            right: "-160px",
            top: "-120px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[520px] w-[520px] opacity-50"
          style={{
            left: "40%",
            bottom: "-220px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      <div className="mx-auto flex min-h-[100svh] max-w-2xl flex-col px-4 pb-16 pt-20 sm:px-6">
        {/* Global navbar provides branding + navigation — no page-level header. */}

        {/* Signature: the auth card center-stage, ringed by a department orbit */}
        <div className="relative flex flex-1 flex-col items-center justify-center py-10">
          {/* Orbit rail — glossy department tiles drifting behind the card (decorative) */}
          <div
            className="pointer-events-none absolute inset-0 -z-[1] hidden sm:block"
            aria-hidden
          >
            {ORBIT.map((slug, i) => {
              const m = deptMeta(slug);
              // Six anchor points spread around the card.
              const spots: CSSProperties[] = [
                { left: "4%", top: "12%" },
                { right: "6%", top: "8%" },
                { left: "0%", top: "52%" },
                { right: "2%", top: "48%" },
                { left: "10%", bottom: "8%" },
                { right: "12%", bottom: "6%" },
              ];
              const spot = spots[i];
              return (
                <span
                  key={slug}
                  className="aq-tile aq-float absolute grid h-14 w-14 place-items-center rounded-2xl opacity-70"
                  style={
                    {
                      "--a": m.color,
                      ...spot,
                      animationDelay: `${i * 0.6}s`,
                    } as CSSProperties
                  }
                >
                  <span
                    className="aq-badge grid h-9 w-9 place-items-center rounded-xl"
                    style={{ "--a": m.color } as CSSProperties}
                  >
                    <Icon name={m.icon} className="h-[18px] w-[18px]" />
                  </span>
                </span>
              );
            })}
          </div>

          {/* The welcoming glass auth card */}
          <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-2 relative w-full max-w-md rounded-[28px] p-6 sm:p-8">
            {/* Live status strip */}
            <div className="flex items-center justify-between">
              <span className="aq-chip inline-flex items-center gap-1.5">
                <ShieldCheck
                  className="aq-badge-bob h-3.5 w-3.5 text-primary"
                  aria-hidden
                />
                Secure sign in
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a7a43]">
                <span className="aq-pulse h-2 w-2 rounded-full bg-[#12b565]" />
                Pit is open
              </span>
            </div>

            {/* Welcome header */}
            <div className="mt-6 flex items-start gap-3.5">
              <span
                className="aq-badge aq-badge-bob grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
                style={{ "--a": "var(--primary)" } as CSSProperties}
              >
                <KeyRound className="h-6 w-6 text-foreground" aria-hidden />
              </span>
              <div>
                <p className="aq-eyebrow">Welcome back to the pit</p>
                <h1 className="aq-display mt-1 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[27px]">
                  Pick up where{" "}
                  <span className="aq-grad-anim" style={HEADING_GRADIENT}>
                    you left off
                  </span>
                </h1>
              </div>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Sign in to keep building. Your lessons, XP, and streak are
              waiting — every seat on the team, from drivetrain to scouting.
            </p>

            <hr className="aq-divider my-6" />

            {/* Auth form — functionally untouched */}
            <AuthForm mode="login" next={safeNext} />
          </div>

          {/* Count-up stats — proof under the card */}
          <dl className="aq-rise aq-rise-4 mt-8 grid w-full max-w-md grid-cols-3 gap-3">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="aq-card aq-card-hover aq-reveal rounded-2xl px-3 py-4 text-center"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <dt className="aq-display text-2xl font-extrabold leading-none text-foreground">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </dt>
                <dd className="mt-1 text-[13px] text-muted-foreground">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>

          <p
            className="aq-reveal mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            style={{ animationDelay: "280ms" }}
          >
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            100% free · No experience needed · Built for every seat on the team.
          </p>
        </div>
      </div>
    </main>
  );
}
