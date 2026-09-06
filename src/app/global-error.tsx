"use client";

import * as React from "react";

/**
 * The last page in the binder.
 *
 * `global-error` replaces the root layout, which means globals.css never loads,
 * `next/font` never runs, and nothing on this page can reference an `nb-*`
 * class or a CSS variable. So the notebook is rebuilt here by hand, in inline
 * styles, from the same six values: newsprint ground, 23px graph ruling, a
 * card-stock box double-ruled in ink at two different hand radii, a ballpoint
 * button that presses into its own offset drop, and the photocopier grain over
 * the top of it. It is the one file in the project allowed to restate the
 * system instead of using it, and only because it cannot use it.
 *
 * Metadata exports are not supported in a client error boundary, so the title
 * is the React `<title>` element, per this fork's error.js reference.
 */

const PAPER = "#E6E8E3";
const CARD = "#F5F6F2";
const INK = "#16181B";
const GRAPHITE = "#565C60";
const BLUE = "#1B36C8";
const RULE = "rgba(22,24,27,0.30)";
const GRID = "rgba(27,54,200,0.055)";

const SANS =
  "Archivo, 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.14'/%3E%3C/svg%3E\")";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  React.useEffect(() => {
    // Error emails are disabled — log locally only.
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: PAPER,
          backgroundImage: `linear-gradient(to right, ${GRID} 1px, transparent 1px), linear-gradient(to bottom, ${GRID} 1px, transparent 1px)`,
          backgroundSize: "23px 23px",
          color: INK,
          fontFamily: SANS,
          fontSize: 16,
          lineHeight: 1.55,
        }}
      >
        <title>Something went wrong · LearnFRC</title>

        <div
          style={{
            position: "relative",
            maxWidth: 460,
            width: "100%",
            padding: "34px 30px",
            background: CARD,
            border: `2px solid ${INK}`,
            borderRadius: "250px 14px 235px 16px / 16px 230px 14px 250px",
            transform: "rotate(-0.45deg)",
          }}
        >
          {/* The inset hairline at a second, different hand radius. Drawing the
              two radii is what makes the box read as ruled rather than shaped. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 3,
              border: `1px solid ${RULE}`,
              borderRadius: "232px 18px 250px 12px / 14px 242px 18px 236px",
              pointerEvents: "none",
            }}
          />

          <p
            style={{
              margin: 0,
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              fontFamily: MONO,
              fontSize: 12.5,
              letterSpacing: "0.05em",
              color: GRAPHITE,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 34,
                height: 2,
                background: BLUE,
                transform: "translateY(-4px) rotate(-1deg)",
              }}
            />
            error / the whole page failed
          </p>

          <h1
            style={{
              margin: "14px 0 0",
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            The site could not draw this page.
          </h1>

          <p style={{ margin: "14px 0 0", color: GRAPHITE }}>
            This one goes deeper than a single page, so there is nothing on
            screen to fall back to. Try it again. If it keeps happening, give it
            a minute and come back.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "20px 0 0",
                paddingTop: 16,
                borderTop: `1px dashed ${RULE}`,
                fontFamily: MONO,
                fontSize: 12.5,
                color: GRAPHITE,
              }}
            >
              digest /{" "}
              <span style={{ fontWeight: 700, color: INK }}>{error.digest}</span>
            </p>
          )}

          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 26,
              minHeight: 44,
              padding: "12px 20px",
              cursor: "pointer",
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 13.5,
              color: CARD,
              background: BLUE,
              border: `2px solid ${BLUE}`,
              borderRadius: "120px 8px 110px 9px / 9px 112px 8px 120px",
              boxShadow: `3px 3px 0 ${INK}`,
            }}
          >
            Try again
          </button>
        </div>

        {/* Photocopier grain, over everything, so the ink overprints. */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            pointerEvents: "none",
            mixBlendMode: "multiply",
            opacity: 0.5,
            backgroundImage: GRAIN,
          }}
        />
      </body>
    </html>
  );
}
