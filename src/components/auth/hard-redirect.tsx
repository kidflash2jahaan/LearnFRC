"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

/**
 * Full-page-load redirect. The login page renders this (instead of an RSC
 * redirect()) once a session exists: after the sign-in action sets auth
 * cookies, Next auto-refreshes the route and an RSC redirect would only
 * soft-navigate — leaving the navbar showing "Log in" until a manual refresh.
 * window.location guarantees the whole app reloads with the new session.
 */
export function HardRedirect({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <div className="grid min-h-[100svh] place-items-center">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Signing you in…
      </p>
    </div>
  );
}
