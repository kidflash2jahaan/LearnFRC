import Link from "next/link";
import { redirect } from "next/navigation";
import { needsUsernameSetup } from "@/lib/onboarding-server";
import { getSession } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SettingsForm } from "@/components/settings/settings-form";
import { PerfModeCard } from "@/components/perf-mode";
import { IdentityCard } from "./_identity-card";

export const metadata = {
  title: "Settings",
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

/**
 * Settings, as the member's own page in the team binder.
 *
 * LAYOUT: this is the one surface in my set where somebody arrived with a job
 * to do, so it is built to get out of the way. No marketing headline, no
 * pitch, no split hero: a record strip that says whose sheet this is, then the
 * form, ruled straight onto the paper rather than boxed. The form IS the page,
 * and a card drawn around the thing the page exists for only adds an edge to
 * look past.
 *
 * The jump-link row that used to sit under the headline is gone. Three
 * sections on one narrow column is a scroll, not a navigation problem, and a
 * strip of chips above the first field is furniture the task never needed.
 *
 * Server Component. The form and the motion toggle are the client leaves,
 * because both hold state; nothing else here does.
 */
export default async function SettingsPage() {
  const { user, profile, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/settings");
  // Required handle: hold them on the setup step (see onboarding-server.ts).
  if (needsUsernameSetup(profile)) redirect("/dashboard");

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
    <div className="nb-wrap max-w-[54rem] pb-[clamp(3rem,6vw,4.5rem)] pt-[clamp(2rem,4.5vw,3.2rem)]">
      <header>
        <p className="nb-marker">settings / your own record</p>
        <h1 className="text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">
          Your details, and{" "}
          <span className="nb-mark">who can see them</span>.
        </h1>
        <p className="nb-lede mt-4">
          Everything here is yours to change. Saving updates your public profile,
          the leaderboard and your team&rsquo;s roster at the same time.
        </p>
      </header>

      <div className="mt-[clamp(1.6rem,3.4vw,2.4rem)]">
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
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/profile" className="nb-btn-ghost nb-btn-sm">
          Your profile
        </Link>
        {profile?.username && (
          <Link
            href={`/u/${profile.username}`}
            className="nb-btn-ghost nb-btn-sm"
          >
            Public page, as others see it
          </Link>
        )}
      </div>

      {/* ---- the form -------------------------------------------------- */}
      <section
        id="profile"
        aria-labelledby="profile-h"
        className="mt-[clamp(2.4rem,5vw,3.4rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="profile-h" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            Profile
          </h2>
          <p className="nb-slug">your full name is never shown publicly</p>
        </div>
        <div className="mt-6">
          <SettingsForm profile={profile} email={user.email} />
        </div>
      </section>

      {/* ---- motion -----------------------------------------------------
          PerfModeCard draws its own hand-ruled card and carries its own
          heading, so this section adds neither. A second heading above it
          would name the same control twice. */}
      <div id="performance" className="mt-[clamp(2.4rem,5vw,3.4rem)]">
        <PerfModeCard />
      </div>

      {/* ---- session ----------------------------------------------------- */}
      <section
        id="account"
        aria-labelledby="account-h"
        className="mt-[clamp(2.4rem,5vw,3.4rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="account-h" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          Session
        </h2>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <p className="max-w-[52ch] text-[0.99rem] leading-relaxed text-graphite">
            Signed in as{" "}
            <span className="nb-slug font-bold text-ink">{user.email}</span>.
            Signing out clears this device only. Your progress, XP and
            certificates stay exactly where they are.
          </p>
          <SignOutButton className="shrink-0" />
        </div>
      </section>
    </div>
  );
}
