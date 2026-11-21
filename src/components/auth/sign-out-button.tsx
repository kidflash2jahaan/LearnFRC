"use client";

import * as React from "react";
import { signOut } from "@/app/actions/auth";
import { dropAllTeachDrafts } from "@/lib/classes/teach-draft";
import { cn } from "@/lib/utils";

const SIGN_OUT_FAILED = "Couldn't sign you out. Check your connection and try again.";

/**
 * Sign out, then a FULL page load to the home page so every layout and the
 * navbar drop the session at once (a soft client transition would keep
 * showing the avatar until a manual refresh).
 *
 * Only after the action resolves: then the session cookies are gone
 * (app/actions/auth.ts). If it fails, "/" would send a reader who is still
 * signed in to their dashboard and look like Sign out did nothing, so it
 * stays put and returns an error to show instead. The navbar's menu item
 * uses this too.
 *
 * Once signed out it also deletes any unsent teacher application draft in
 * this browser (src/lib/classes/teach-draft.ts): family computers are
 * shared. Not before: a sign out that fails leaves them signed in, and
 * their draft with them.
 */
export function useSignOut() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setBusy(false);
      setError(SIGN_OUT_FAILED);
      return;
    }
    dropAllTeachDrafts();
    // Still busy while the page loads, so a second click does nothing.
    window.location.assign("/");
  }, []);

  return { busy, error, run };
}

/**
 * There is no red in this palette and inventing one would put a seventh colour
 * on the page to say something the label already says. Severity is carried the
 * way `nb-error` and an invalid input carry it: a heavier ink edge, which
 * survives a greyscale photocopy where a hue would not.
 *
 * Both places it sits are wrapping flex rows, so the error takes a line of its
 * own under the button.
 */
export function SignOutButton({ className }: { className?: string }) {
  const { busy, error, run } = useSignOut();

  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        className={cn("nb-btn-ghost border-[3px]", className)}
        onClick={run}
      >
        {busy ? "Signing out" : "Sign out"}
      </button>
      {error && (
        <p className="nb-error basis-full" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
