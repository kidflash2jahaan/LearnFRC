import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Settings as SettingsIcon, UserRound, ExternalLink } from "lucide-react";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "@/components/settings/settings-form";
import { PerfModeCard } from "@/components/perf-mode";

export const metadata = {
  title: "Settings · LearnFRC",
  description:
    "Update your profile, username, team, and how you appear across LearnFRC.",
};

export default async function SettingsPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/settings");

  return (
    <main className="relative overflow-hidden">
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-10%] top-[-8%] h-[380px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(37,96,230,0.18),transparent_70%)] blur-3xl" />
        <div className="absolute right-[-12%] top-[6%] h-[340px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.16),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-14%] left-[24%] h-[320px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.12),transparent_70%)] blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-28 pb-24 sm:px-6">
        {/* Hero */}
        <header className="flex flex-col items-start gap-4">
          <span className="aq-rise aq-rise-1 aq-eyebrow">Your account</span>
          <div className="aq-rise aq-rise-2 flex items-center gap-4">
            <span
              className="aq-badge shrink-0"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <SettingsIcon className="h-6 w-6" strokeWidth={2.25} />
            </span>
            <h1 className="aq-display text-3xl font-bold tracking-tight sm:text-4xl">
              <span
                style={{
                  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Settings
              </span>
            </h1>
          </div>
          <p className="aq-rise aq-rise-3 max-w-xl text-base leading-relaxed text-foreground/70">
            Tune your profile and how you show up across LearnFRC — from the
            leaderboard to your team&apos;s pit crew. Small details, gracious
            first impressions.
          </p>

          {/* Profile shortcuts */}
          <div className="aq-rise aq-rise-4 flex flex-wrap items-center gap-3">
            <Button asChild className="aq-cta">
              <Link href="/profile">
                <UserRound className="h-4 w-4" />
                View your profile
              </Link>
            </Button>
            {profile?.username && (
              <Button asChild className="aq-ghost">
                <Link href={`/u/${profile.username}`}>
                  <ExternalLink className="h-4 w-4" />
                  See public profile
                </Link>
              </Button>
            )}
          </div>
        </header>

        {/* Profile form */}
        <section className="aq-reveal mt-10">
          <div className="aq-card aq-card-hover p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span
                className="aq-icon shrink-0"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <UserRound className="h-5 w-5" />
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

        {/* Performance card */}
        <section className="aq-reveal mt-6">
          <PerfModeCard />
        </section>

        {/* Account / sign out */}
        <section className="aq-reveal mt-6">
          <div className="aq-card aq-card-hover p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span
                className="aq-icon shrink-0"
                style={{ "--a": "#1aa9d6" } as CSSProperties}
              >
                <LogOut className="h-5 w-5" />
              </span>
              <div>
                <h2 className="aq-display text-xl font-semibold tracking-tight">
                  Account
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  You&apos;re signed in as{" "}
                  <span className="font-mono font-medium text-foreground">
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
                <Button type="submit" variant="destructive" size="md" className="shrink-0">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
