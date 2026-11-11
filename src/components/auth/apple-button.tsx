"use client";

import * as React from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { safeNextPath } from "@/lib/safe-next";

/**
 * The Apple logo, in the button's own white.
 *
 * Like the Google mark beside it, this is the one place Apple's mark and
 * Apple's colours appear, and both follow Apple's rules for a Sign in with
 * Apple button rather than this site's palette: a black button, the logo and
 * the words in white, the words in the system font. Recolouring it to match
 * the binder would break Apple's guidelines and make it harder to recognise.
 */
function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/**
 * Continue with Apple. Supabase's Apple provider, the same redirect flow as
 * the Google button: Apple's page, back through Supabase, then /auth/callback.
 *
 * Shown only when NEXT_PUBLIC_APPLE_SIGNIN=1 (src/lib/auth-providers.ts), and
 * placed above Google at the same size, because Apple's guidelines ask for
 * Sign in with Apple to be at least as prominent as any other sign-in option.
 *
 * `provider=apple` on the callback URL tells /auth/callback that the provider
 * token Supabase hands back is Apple's, so it can be kept for revoking the
 * account's Apple sign-in when the account is deleted.
 */
export function AppleSignInButton({
  next,
  referrer,
  via,
}: {
  next?: string;
  /** Referrer's username from ?ref=. Must survive the trip to Apple. */
  referrer?: string;
  /** Share surface from ?via=. Must survive the trip to Apple. */
  via?: string;
}) {
  const [loading, setLoading] = React.useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const dest = safeNextPath(next) ?? "/dashboard";
      // ref/via ride along on the callback URL, exactly as on the Google
      // button, or a referral through this button would go unrecorded.
      const cb = new URL("/auth/callback", window.location.origin);
      cb.searchParams.set("next", dest);
      cb.searchParams.set("provider", "apple");
      if (referrer) cb.searchParams.set("ref", referrer);
      if (via) cb.searchParams.set("via", via);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: cb.toString() },
      });
      if (error) {
        setLoading(false);
        toast.error(
          /provider is not enabled|not enabled/i.test(error.message)
            ? "Apple sign-in isn't set up yet, use email for now."
            : error.message
        );
      }
      // On success the browser is leaving for Apple, so the button stays busy.
    } catch {
      setLoading(false);
      toast.error("Couldn't start Apple sign-in. Use email instead.");
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      className={cn("nb-btn-apple w-full")}
    >
      {/* Hidden while busy, like the Google mark: the label carries the state. */}
      {!loading && <AppleMark className="h-[17px] w-[17px] -translate-y-px" />}
      {loading ? "Opening Apple" : "Continue with Apple"}
    </button>
  );
}
