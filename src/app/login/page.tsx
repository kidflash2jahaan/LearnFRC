import { AuthForm } from "@/components/auth/auth-form";
import { HardRedirect } from "@/components/auth/hard-redirect";
import { getSession } from "@/lib/auth";
import { SignInSheet, SignInAside } from "./_auth-scene";

export const metadata = {
  title: "Log in",
  description: "Welcome back. Sign in to pick up where you left off.",
  robots: { index: false, follow: true },
};

/**
 * SIGN IN — the shop door with a sheet clipped to it.
 *
 * This is the most repeated task on the site, so the page is a headline band
 * and then an asymmetric split: the sheet on the left at a fixed 27rem, wide
 * enough for the two fields and no wider, and the margin on the right carrying
 * what the account is for. The form is the first thing in the reading order
 * and the first thing in the tab order.
 *
 * BEHAVIOUR IS UNCHANGED: same `next` sanitising, same session check, and the
 * same HardRedirect rather than an RSC redirect() when a session already
 * exists, because a soft navigation would leave the navbar showing "Log in".
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string; email?: string }>;
}) {
  const { next, notice, email } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : undefined;
  const { user } = await getSession();
  // Already signed in (including right after the sign-in action sets cookies
  // and Next refreshes this route): HARD redirect so every layout picks up the
  // session. An RSC redirect() here would only soft-navigate.
  if (user) return <HardRedirect to={safeNext ?? "/dashboard"} />;
  const noticeExists = notice === "exists" ? "exists" : undefined;

  return (
    <div className="nb-wrap py-[clamp(2.4rem,5vw,4.2rem)]">
      <p className="nb-marker">returning</p>
      <h1 className="max-w-[16ch]">Sign in and pick the binder back up.</h1>
      <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
        Your progress, your certificates and your team are attached to the
        account, not the browser. Sign in on any machine in the shop and they
        follow you.
      </p>

      <div className="mt-[clamp(1.8rem,4vw,3rem)] grid items-start gap-[clamp(1.8rem,4vw,3.4rem)] lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
        <SignInSheet>
          <AuthForm
            mode="login"
            next={safeNext}
            notice={noticeExists}
            defaultEmail={email}
          />
        </SignInSheet>

        <SignInAside />
      </div>
    </div>
  );
}
