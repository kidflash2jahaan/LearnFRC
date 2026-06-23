import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Settings as SettingsIcon, UserRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "@/components/motion/reveal";
import { SettingsForm } from "@/components/settings/settings-form";
import { PerfModeCard } from "@/components/perf-mode";

export const metadata = {
  title: "Settings · LearnFRC",
  description: "Update your profile, username, team, and how you appear across LearnFRC.",
};

export default async function SettingsPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/settings");

  return (
    <main className="relative overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-40 mask-b-faded" />
        <div className="absolute right-[-15%] top-[-10%] h-[420px] w-[560px] rounded-full opacity-20 blur-3xl aurora-bg animate-aurora" />
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-28 pb-24 sm:px-6">
        {/* Header */}
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-[var(--shadow-md)]">
              <SettingsIcon className="h-5.5 w-5.5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Settings
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Manage your profile and how you appear across LearnFRC.
              </p>
            </div>
          </div>
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
                <Link href={`/u/${profile.username}`}>
                  See public profile
                </Link>
              </Button>
            )}
          </div>
        </Reveal>

        {/* Profile form card */}
        <Reveal delay={0.1} className="mt-7">
          <Card className="overflow-hidden border-border/80 shadow-[var(--shadow-md)]">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                These details power your public profile and the leaderboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm profile={profile} email={user.email} />
            </CardContent>
          </Card>
        </Reveal>

        {/* Performance card */}
        <Reveal delay={0.13} className="mt-6">
          <PerfModeCard />
        </Reveal>

        {/* Sign out card */}
        <Reveal delay={0.16} className="mt-6">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                You&apos;re signed in as{" "}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Separator className="mb-5" />
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </main>
  );
}
