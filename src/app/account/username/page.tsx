import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { SIGNED_IN_HOME, signedInLanding } from "@/lib/signed-in-routes";
import { needsUsernameStep, usernameStepHref, USERNAME_STEP_PATH } from "@/lib/usernames";
import { ProfileSetupForm } from "@/components/onboarding/profile-setup-form";

export const metadata: Metadata = {
  title: "Choose your username",
  robots: { index: false, follow: false },
};

/**
 * THE USERNAME STEP. Every account has a username (the database makes sure of
 * it), but one that arrived without (Google sign-in) carries a generated
 * handle like `gearbox_4821` that the person never chose. This page asks once:
 * keep it, or pick your own. Either clears `profiles.username_generated`.
 *
 * People are sent here from the OAuth callback (before the page they came
 * for), from the signed-in pages that need a settled name (dashboard, start,
 * bookmarks, profile) and from the navbar on most other pages (not Settings
 * or contact, so nobody has to accept a handle to get help or leave).
 * `next` is where they were headed; the form goes there afterwards. It goes
 * through safeNextPath and then signedInLanding (src/lib/signed-in-routes.ts),
 * the same as /signup: a same-site path, percent-encoded so redirect() can put
 * it in a Location header ("/guides/日本" was a 500), and never one that resolves
 * to another site. So this can't be used to bounce someone off the site.
 *
 * Signed out, it goes to sign-in and comes back. With nothing to choose (the
 * flag is already clear), it goes straight on to `next`.
 */
export default async function UsernameStepPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: rawNext } = await searchParams;
  // Same-site and encoded, or the dashboard.
  const next = signedInLanding(
    safeNextPath(typeof rawNext === "string" ? rawNext : undefined)
  );
  // Never come back here as the destination: that would be a loop.
  const destination = next.startsWith(USERNAME_STEP_PATH) ? SIGNED_IN_HOME : next;

  const { user, profile } = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(usernameStepHref(destination))}`);
  if (!needsUsernameStep(profile)) redirect(destination);

  return (
    <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.2rem,5vw,4rem)]">
      <div className="max-w-[38rem]">
        <ProfileSetupForm mode="choose" handle={profile?.username ?? null} next={destination} />
      </div>
    </section>
  );
}
