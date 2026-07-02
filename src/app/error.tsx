"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { RotateCcw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
    try {
      fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Error",
          stack: error?.stack,
          digest: error?.digest,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          kind: "App error",
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never let reporting break the error page */
    }
  }, [error]);

  return (
    <div className="relative flex min-h-[80svh] flex-col items-center justify-center px-4 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(37,96,230,0.18), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-8 -z-10 h-64 w-64 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(26,169,214,0.16), transparent 70%)",
        }}
      />

      <div className="ac-glass max-w-md px-8 py-10">
        <p className="ac-eyebrow">Something broke</p>
        <div
          className="mt-2 font-display text-6xl font-bold"
          style={
            {
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            } as CSSProperties
          }
        >
          Oops
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          An unexpected error occurred. You can try again, or head back home.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button type="button" className="ac-btn text-sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
          <Link href="/" className="ac-btn-ghost text-sm">
            <Home className="h-4 w-4" aria-hidden /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
