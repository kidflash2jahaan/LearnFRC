"use client";

import * as React from "react";
import Link from "next/link";

/**
 * The route-level error boundary: a correction stamped into the binder.
 *
 * `unstable_retry` rather than `reset`, per this fork's error.js reference:
 * `reset` only clears the boundary's state and re-renders the same children,
 * while `unstable_retry` re-fetches them, which is what a reader pressing "Try
 * again" after a failed server render actually wants.
 *
 * The digest is printed. It is the one string that lets a report be matched to
 * a server log, and hiding it in the console helps nobody standing in a pit.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  React.useEffect(() => {
    console.error(error);

    // Deploy skew: a tab opened before a deploy submits a Server Action id
    // that no longer exists. A hard reload picks up the new build and the
    // user's action works on retry — recover automatically, once per URL,
    // and skip the error report (it's expected churn right after deploys).
    if (/not found on the server|failed to find server action/i.test(error?.message || "")) {
      const key = "lf_skew_reload_" + window.location.pathname;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return;
      }
    }

    // Error emails are disabled — the console log above is the record.
  }, [error]);

  return (
    <div className="nb-wrap flex min-h-[70svh] items-center py-[clamp(2.5rem,6vw,4.5rem)]">
      <div className="nb-box nb-tilt-3 w-full max-w-lg p-[clamp(1.4rem,3vw,2.2rem)]">
        <span className="nb-tape -top-3 left-[26%] rotate-[-3deg]" aria-hidden="true" />

        <p className="nb-marker">error / this page did not render</p>

        <h1 className="text-[clamp(1.8rem,1.2rem+2vw,2.6rem)]">
          Something on this page threw.
        </h1>

        <p className="nb-sub mt-4">
          The rest of the site is fine. Try the page again, and if it keeps
          failing, the code below is what identifies it in the server log.
        </p>

        {error.digest && (
          <p className="nb-slug mt-5 border-t border-dashed border-rule pt-4">
            digest / <span className="font-bold text-ink">{error.digest}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="nb-btn" onClick={() => unstable_retry()}>
            Try again
          </button>
          <Link href="/" className="nb-btn-ghost">
            Back to the front page
          </Link>
        </div>
      </div>
    </div>
  );
}
