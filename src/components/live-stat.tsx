"use client";

import * as React from "react";
import type { SocialProofStats } from "@/lib/social-proof-stats";

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
 *
 * PRESENTATION
 * ------------
 * One card, three panels divided by the 2px ink rule that turns horizontal
 * under 860px: the same strip the "how it works" section is drawn on, because
 * these are the same kind of thing, three readings taken off one instrument.
 * The figures are Space Mono with tabular numerals, so when the live values
 * land nothing on the row shifts sideways.
 */
export function LiveStats({ initial }: { initial: SocialProofStats }) {
  const [stats, setStats] = React.useState<SocialProofStats>(initial);

  React.useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    // Slight delay keeps this off the critical path: the page paints with the
    // cached figures, and only then do we ask for fresher ones.
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
    { slug: "accounts", value: stats.learners, label: "learners with an account" },
    { slug: "teams", value: stats.teams, label: "FRC teams represented" },
    { slug: "completions", value: stats.lessonsCompleted, label: "lessons completed" },
  ];

  return (
    /* 861px, not a named breakpoint: `.nb-panel` swaps its divider from a left
       rule to a top rule at 860px, so the column count has to turn over on the
       same pixel or one layout gets the wrong rule. */
    <dl className="nb-box mt-6 grid grid-cols-1 min-[861px]:grid-cols-3">
      {cells.map((s) => (
        <div key={s.slug} className="nb-panel">
          <dt className="nb-slug">tally / {s.slug}</dt>
          <dd className="mt-2">
            <span className="block font-mono text-[clamp(2rem,1.3rem+2.4vw,3rem)] font-bold leading-none tracking-[-0.03em] tabular-nums text-blue">
              {s.value.toLocaleString()}
            </span>
            <span className="mt-2 block text-[0.95rem] leading-snug text-graphite">
              {s.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
