import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LogOut,
  Settings as SettingsIcon,
  UserRound,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Gauge,
  SlidersHorizontal,
  Trophy,
  Hash,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { SettingsForm } from "@/components/settings/settings-form";
import { PerfModeCard } from "@/components/perf-mode";
import { AnimatedCounter } from "@/components/animated-counter";

export const metadata = {
  title: "Settings · LearnFRC",
  description:
    "Update your profile, username, team, and how you appear across LearnFRC.",
};

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  mentor: "Mentor",
  alum: "Alum",
  coach: "Coach",
  other: "Team member",
};

export default async function SettingsPage() {
  const { user, profile, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/settings");

  const displayName =
    profile?.full_name || profile?.username || user.email || "Your account";
  const roleLabel = ROLE_LABELS[profile?.role ?? "student"] ?? "Team member";
  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate overflow-x-clip text-foreground"
    >
      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[560px] w-[560px] opacity-70"
          style={{
            left: "-160px",
            top: "-200px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[520px] w-[520px] opacity-60"
          style={{
            right: "-180px",
            top: "-120px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[480px] w-[480px] opacity-45"
          style={{
            left: "34%",
            top: "520px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-20 sm:px-6 sm:pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-14">
        <div>
          <span className="aq-chip aq-eyebrow aq-rise aq-rise-1 inline-flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Your control panel
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-extrabold leading-[1.04] sm:text-5xl">
            Tune how you show up on{" "}
            <span
              className="aq-grad-anim"
              style={{
                background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              LearnFRC.
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
            One calm control panel for your profile, privacy, and presence —
            from the leaderboard to your team&apos;s pit crew. Small details,
            gracious first impressions.
          </p>

          <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center gap-3">
            <Button asChild className="aq-cta">
              <Link href="/profile">
                <UserRound aria-hidden focusable="false" className="h-4 w-4" />
                View your profile
              </Link>
            </Button>
            {profile?.username && (
              <Button asChild className="aq-ghost">
                <Link href={`/u/${profile.username}`}>
                  <ExternalLink
                    aria-hidden
                    focusable="false"
                    className="h-4 w-4"
                  />
                  See public profile
                </Link>
              </Button>
            )}
          </div>

          {/* jump-to rail */}
          <nav
            aria-label="Settings sections"
            className="aq-rise aq-rise-5 mt-6 flex flex-wrap gap-2"
          >
            {[
              { href: "#profile", label: "Profile", icon: UserRound },
              { href: "#performance", label: "Performance", icon: Gauge },
              { href: "#account", label: "Account", icon: ShieldCheck },
            ].map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="aq-chip group inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                <s.icon
                  className="h-3.5 w-3.5 text-primary"
                  aria-hidden="true"
                />
                {s.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* SIGNATURE: live identity readout card */}
        <div className="aq-glass aq-float aq-sheen aq-rise aq-rise-3 rounded-3xl p-6 lg:justify-self-end">
          <div className="mb-5 flex items-center gap-2">
            <span className="aq-display text-[17px] font-bold text-foreground">
              Your identity
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#0a7a43]">
              <span className="aq-pulse h-2 w-2 rounded-full bg-[#12b565]" />
              Live
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Avatar
              name={displayName}
              src={profile?.avatar_url || null}
              seed={profile?.username || user.email || undefined}
              className="h-20 w-20 shrink-0 ring-2 ring-white/70 shadow-[var(--shadow-md)]"
            />
            <div className="min-w-0">
              <div className="truncate aq-display text-xl font-bold leading-tight text-foreground">
                {displayName}
              </div>
              <div className="mt-0.5 truncate text-sm text-muted-foreground">
                {profile?.username ? `@${profile.username}` : user.email}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="aq-chip inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {roleLabel}
                </span>
                {isAdmin && (
                  <span className="aq-chip inline-flex items-center gap-1 text-xs font-semibold text-[#7c3aed]">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="aq-divider my-5" />

          {/* stat readouts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/50 p-4 text-center ring-1 ring-white/60">
              <span
                className="aq-icon aq-badge-bob mx-auto mb-2 flex h-9 w-9 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Trophy className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="aq-display text-2xl font-extrabold leading-none text-foreground">
                <AnimatedCounter value={profile?.xp ?? 0} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">XP earned</div>
            </div>
            <div className="rounded-2xl bg-white/50 p-4 text-center ring-1 ring-white/60">
              <span
                className="aq-icon aq-badge-bob mx-auto mb-2 flex h-9 w-9 items-center justify-center"
                style={{ "--a": "#1aa9d6" } as CSSProperties}
              >
                <Hash className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="aq-display text-2xl font-extrabold leading-none text-foreground">
                {profile?.team_number ? (
                  <AnimatedCounter value={profile.team_number} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {profile?.team_number ? "your team" : "no team yet"}
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {joined
              ? `Member since ${joined} — edit the details below.`
              : "Edit your details below to complete your profile."}
          </p>
        </div>
      </section>

      {/* ========================= CONTROL PANELS ===================== */}
      <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        {/* Profile */}
        <section
          id="profile"
          className="aq-reveal scroll-mt-24"
          style={{ animationDelay: "0.05s" } as CSSProperties}
        >
          <div className="aq-card aq-sheen p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span
                className="aq-badge aq-badge-bob shrink-0"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <UserRound
                  aria-hidden
                  focusable="false"
                  className="h-6 w-6"
                  strokeWidth={2.25}
                />
              </span>
              <div>
                <h2 className="aq-display text-xl font-semibold tracking-tight">
                  Profile
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  These details power your public profile and the leaderboard.
                </p>
              </div>
            </div>
            <div className="aq-divider my-6" />
            <SettingsForm profile={profile} email={user.email} />
          </div>
        </section>

        {/* Performance */}
        <section
          id="performance"
          className="aq-reveal mt-6 scroll-mt-24"
          style={{ animationDelay: "0.1s" } as CSSProperties}
        >
          <div className="aq-card aq-sheen p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span
                className="aq-badge aq-badge-bob shrink-0"
                style={{ "--a": "#6d3fe0" } as CSSProperties}
              >
                <Gauge
                  aria-hidden
                  focusable="false"
                  className="h-6 w-6"
                  strokeWidth={2.25}
                />
              </span>
              <div>
                <h2 className="aq-display text-xl font-semibold tracking-tight">
                  Performance
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  Dial motion up or down for a smoother ride on any device.
                </p>
              </div>
            </div>
            <div className="aq-divider my-6" />
            <PerfModeCard />
          </div>
        </section>

        {/* Account / sign out */}
        <section
          id="account"
          className="aq-reveal mt-6 scroll-mt-24"
          style={{ animationDelay: "0.15s" } as CSSProperties}
        >
          <div className="aq-card aq-sheen p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span
                className="aq-badge aq-badge-bob shrink-0"
                style={{ "--a": "#1aa9d6" } as CSSProperties}
              >
                <ShieldCheck
                  aria-hidden
                  focusable="false"
                  className="h-6 w-6"
                  strokeWidth={2.25}
                />
              </span>
              <div>
                <h2 className="aq-display text-xl font-semibold tracking-tight">
                  Account
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  You&apos;re signed in as{" "}
                  <span className="font-medium text-foreground">
                    {user.email}
                  </span>
                  .
                </p>
              </div>
            </div>
            <div className="aq-divider my-6" />
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sign out of LearnFRC on this device. You can always jump back in
                before the next build season.
              </p>
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="destructive"
                  size="md"
                  className="shrink-0"
                >
                  <LogOut
                    aria-hidden
                    focusable="false"
                    className="h-4 w-4"
                  />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
