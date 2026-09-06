"use client";

import * as React from "react";

/**
 * Full-page-load redirect. The login page renders this (instead of an RSC
 * redirect()) once a session exists: after the sign-in action sets auth
 * cookies, Next auto-refreshes the route and an RSC redirect would only
 * soft-navigate, leaving the navbar showing "Log in" until a manual refresh.
 * window.location guarantees the whole app reloads with the new session.
 *
 * It is on screen for a fraction of a second, so it says one thing and shows
 * one moving object. The bar is `nb-skeleton`, which is the system's only
 * loading mark and the only thing here that moves: a frozen grey block reads
 * as broken rather than as busy, and the pulse stops under reduced motion.
 */
export function HardRedirect({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div className="nb-wrap grid min-h-[60dvh] place-items-center py-16">
      <div
        className="nb-box nb-tilt-3 w-full max-w-[22rem] p-[clamp(1.1rem,2.4vw,1.6rem)]"
        role="status"
      >
        <span className="nb-tape -top-3 left-8 rotate-[-3deg]" aria-hidden="true" />
        <p className="nb-slug">signing you in</p>
        <p className="mt-2 text-[0.95rem] leading-snug">
          Loading your progress. This page will move on by itself.
        </p>
        <span className="nb-skeleton mt-4 block h-2 w-full" aria-hidden="true" />
      </div>
    </div>
  );
}
