import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Settings as SettingsIcon, UserRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { TerminalFrame, StatusPill } from "@/components/motion/terminal";
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
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-40 mask-b-faded" />
        <div className="absolute right-[-15%] top-[-10%] h-[420px] w-[560px] rounded-full opacity-20 blur-3xl aurora-bg" />
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-28 pb-24 sm:px-6">
        {/* Header */}
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary glow-primary">
              <SettingsIcon className="h-5.5 w-5.5" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                // account settings
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Settings
              </h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Manage your profile and how you appear across LearnFRC.
          </p>
        </Reveal>

        {/* Quick link to profile */}
        <Reveal delay={0.06}>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">
                <UserRound className="h-4 w-4" />
                View your profile
              </Link>
            </Button>
            {profile?.username && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/u/${profile.username}`}>See public profile</Link>
              </Button>
            )}
          </div>
        </Reveal>

        {/* Profile form */}
        <Reveal delay={0.1} className="mt-7">
          <TerminalFrame
            title="profile — ~/settings"
            glow
            bodyClassName="p-5 sm:p-6"
            right={<StatusPill tone="accent">editable</StatusPill>}
          >
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Profile
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              These details power your public profile and the leaderboard.
            </p>
            <div className="mt-5">
              <SettingsForm profile={profile} email={user.email} />
            </div>
          </TerminalFrame>
        </Reveal>

        {/* Performance card */}
        <Reveal delay={0.13} className="mt-6">
          <PerfModeCard />
        </Reveal>

        {/* Sign out card */}
        <Reveal delay={0.16} className="mt-6">
          <TerminalFrame title="session — ~/account" bodyClassName="p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Account
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              You&apos;re signed in as{" "}
              <span className="font-mono font-medium text-foreground">
                {user.email}
              </span>
              .
            </p>
            <div className="mt-5 flex flex-col items-start justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">
                Sign out of LearnFRC on this device.
              </p>
              <form action={signOut}>
                <Button type="submit" variant="destructive" size="md">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </TerminalFrame>
        </Reveal>
      </div>
    </main>
  );
}
