import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LogOut,
  UserRound,
  ExternalLink,
  ShieldCheck,
  Gauge,
  SlidersHorizontal,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "@/components/settings/settings-form";
import { PerfModeCard } from "@/components/perf-mode";
import { RiseGroup, RiseItem, Reveal, Glow } from "@/components/motion/primitives";
import { IdentityCard } from "./_identity-card";

export const metadata = {
  title: "Settings · LearnFRC",
  description:
    "Update your profile, username, team, and how you appear across LearnFRC.",
  robots: { index: false, follow: false },
};

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  mentor: "Mentor",
  alum: "Alum",
  coach: "Coach",
  other: "Team member",
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const JUMP_LINKS = [
  { href: "#profile", label: "Profile", icon: UserRound },
  { href: "#performance", label: "Performance", icon: Gauge },
  { href: "#account", label: "Account", icon: ShieldCheck },
];

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
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "520px", pos: { right: "-180px", top: "-120px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "480px", pos: { left: "34%", top: "520px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-14">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Your control panel</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.04] sm:text-5xl">
              Tune how you show up on{" "}
              <span style={BRAND_GRADIENT}>LearnFRC.</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              One calm control panel for your profile, privacy, and presence —
              from the leaderboard to your team&apos;s pit crew. Small
              details, gracious first impressions.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/profile" className="ac-btn text-sm">
                <UserRound className="h-4 w-4" aria-hidden />
                View your profile
              </Link>
              {profile?.username && (
                <Link href={`/u/${profile.username}`} className="ac-btn-ghost text-sm">
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  See public profile
                </Link>
              )}
            </div>
          </RiseItem>
          <RiseItem>
            <nav aria-label="Settings sections" className="mt-6 flex flex-wrap gap-2">
              {JUMP_LINKS.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="ac-chip group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <s.icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {s.label}
                </Link>
              ))}
            </nav>
          </RiseItem>
        </RiseGroup>

        <IdentityCard
          displayName={displayName}
          handle={profile?.username ? `@${profile.username}` : user.email ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          seed={profile?.username || user.email || undefined}
          roleLabel={roleLabel}
          isAdmin={isAdmin}
          xp={profile?.xp ?? 0}
          teamNumber={profile?.team_number ?? null}
          joined={joined}
        />
      </section>

      {/* ========================= CONTROL PANELS ===================== */}
      <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        {/* Profile */}
        <section id="profile" className="scroll-mt-24">
          <Reveal delay={0.05}>
            <div className="ac-card p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span
                  className="ac-badge flex h-12 w-12 shrink-0 items-center justify-center"
                  style={{ "--a": "#2560e6" } as CSSProperties}
                >
                  <UserRound className="h-6 w-6" aria-hidden strokeWidth={2.25} />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    Profile
                  </h2>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    These details power your public profile and the leaderboard.
                  </p>
                </div>
              </div>
              <div className="ac-divider my-6" />
              <SettingsForm profile={profile} email={user.email} />
            </div>
          </Reveal>
        </section>

        {/* Performance */}
        <section id="performance" className="mt-6 scroll-mt-24">
          <Reveal delay={0.05}>
            <div className="ac-card p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span
                  className="ac-badge flex h-12 w-12 shrink-0 items-center justify-center"
                  style={{ "--a": "#7c5cff" } as CSSProperties}
                >
                  <Gauge className="h-6 w-6" aria-hidden strokeWidth={2.25} />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    Performance
                  </h2>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    Dial motion up or down for a smoother ride on any device.
                  </p>
                </div>
              </div>
              <div className="ac-divider my-6" />
              <PerfModeCard />
            </div>
          </Reveal>
        </section>

        {/* Account / sign out */}
        <section id="account" className="mt-6 scroll-mt-24">
          <Reveal delay={0.05}>
            <div className="ac-card p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span
                  className="ac-badge flex h-12 w-12 shrink-0 items-center justify-center"
                  style={{ "--a": "#1aa9d6" } as CSSProperties}
                >
                  <ShieldCheck className="h-6 w-6" aria-hidden strokeWidth={2.25} />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    Account
                  </h2>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    You&apos;re signed in as{" "}
                    <span className="font-medium text-foreground">{user.email}</span>.
                  </p>
                </div>
              </div>
              <div className="ac-divider my-6" />
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Sign out of LearnFRC on this device. You can always jump back
                  in before the next build season.
                </p>
                <form action={signOut}>
                  <Button type="submit" variant="destructive" size="md" className="shrink-0">
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
