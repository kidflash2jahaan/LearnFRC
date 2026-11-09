"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { analyticsBeforeSend } from "@/components/site-analytics-url";

/**
 * Vercel Web Analytics and Speed Insights, with one `beforeSend` that cuts any
 * URL under /classes/parent/, /letters/ or /verify/ back to the bare prefix
 * before it leaves the browser (site-analytics-url.ts says why).
 *
 * A client component only because a Server Component can't hand a function
 * prop to these. The callback is a module-level function, so its identity
 * never changes and neither library re-registers it on a re-render.
 */
export function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={analyticsBeforeSend} />
      <SpeedInsights beforeSend={analyticsBeforeSend} />
    </>
  );
}
