"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { AnimatedCounter } from "@/components/animated-counter";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import type { SocialProofStats } from "@/lib/social-proof-stats";

// Mirrors the home page's brand gradient. Duplicated from social-proof.tsx
// rather than imported, because that module is a Server Component and pulling
// a value across the boundary just to share four CSS lines is not worth it.
const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/**
 * The home page's three public counters, kept current without making the page
 * dynamic.
 *
 * WHY IT WORKS THIS WAY
 * ---------------------
 * The home page is statically rendered and its data cache is deliberately 24h,
 * because Next takes the MINIMUM revalidate across everything a page reads, so
 * a short window there would rebuild the site's busiest page constantly. The
 * admin panel is live only because getSession() reads cookies, which makes that
 * entire route dynamic; doing the same to `/` would throw its caching away.
 *
 * So the server ships the cached numbers inside the HTML, and this asks
 * /api/stats for the live ones once after paint, replacing them only if they
 * differ and look sane.
 *
 * HYDRATION
 * ---------
 * State starts as exactly the server-rendered values, so the first client
 * render is byte-identical to the SSR output and hydration cannot mismatch.
 * The fetch happens in an effect, strictly afterwards. With JavaScript off the
 * cached numbers still render, still read correctly, and are still indexable,
 * which is why the server figures are the source of truth rather than a spinner.
 *
 * A failed, aborted or slow fetch changes nothing on screen: we never zero a
 * counter and never guess. Whatever the server measured stays until something
 * better arrives.
 *
 * This component renders the whole grid itself rather than taking a render
 * prop, because a Server Component cannot pass a function across the boundary.
 */
export function LiveStats({ initial }: { initial: SocialProofStats }) {
  const [stats, setStats] = React.useState<SocialProofStats>(initial);

  React.useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    // Slight delay keeps this off the critical path: the page paints, the
    // counters animate up from the cached values, and only then do we ask.
    const t = setTimeout(() => {
      fetch("/api/stats", { signal: controller.signal, cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: SocialProofStats | null) => {
          if (!alive || !d) return;
          // Guard the shape. A proxy or error page returning something other
          // than our JSON must never be able to print NaN into a public
          // counter, and a zero learner count is a bug rather than a fact.
          const sane =
            Number.isFinite(d.learners) &&
            Number.isFinite(d.teams) &&
            Number.isFinite(d.lessonsCompleted) &&
            d.learners > 0;
          if (sane) setStats(d);
        })
        .catch(() => {
          /* offline, aborted, or 503: keep the server's numbers */
        });
    }, 1200);
    return () => {
      alive = false;
      clearTimeout(t);
      controller.abort();
    };
  }, []);

  const cells = [
    { value: stats.learners, label: "learners with an account" },
    { value: stats.teams, label: "FRC teams represented" },
    { value: stats.lessonsCompleted, label: "lessons completed" },
  ];

  return (
    <RevealGroup className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cells.map((s) => (
        <RevealItem key={s.label}>
          <Hover className="h-full">
            <div className="ac-card h-full p-5 text-center">
              <div
                className="font-display text-3xl font-extrabold leading-none"
                style={BRAND_GRADIENT}
              >
                <AnimatedCounter value={s.value} />
              </div>
              <div className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                {s.label}
              </div>
            </div>
          </Hover>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
