"use client";

import * as React from "react";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

/**
 * Signs out, then performs a FULL page load back to the homepage so every
 * layout and the navbar immediately reflect the cleared session. A soft client
 * transition would keep showing the avatar until a manual refresh.
 *
 * There is no red in this palette and inventing one would put a seventh colour
 * on the page to say something the label already says. Severity is carried the
 * way `nb-error` and an invalid input carry it: a heavier ink edge, which
 * survives a greyscale photocopy where a hue would not.
 */
export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = React.useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      className={cn("nb-btn-ghost border-[3px]", className)}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
        } finally {
          window.location.assign("/");
        }
      }}
    >
      {busy ? "Signing out" : "Sign out"}
    </button>
  );
}
