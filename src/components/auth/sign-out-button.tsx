"use client";

import * as React from "react";
import { LogOut, Loader2 } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Signs out, then performs a FULL page load back to the homepage so every
 * layout/navbar immediately reflects the cleared session (a soft client
 * transition would keep showing the avatar until a manual refresh).
 */
export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      type="button"
      variant="destructive"
      size="md"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
        } finally {
          window.location.assign("/");
        }
      }}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden />
      )}
      Sign out
    </Button>
  );
}
