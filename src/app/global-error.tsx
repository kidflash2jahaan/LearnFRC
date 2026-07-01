"use client";

import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    try {
      fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Error",
          stack: error?.stack,
          digest: error?.digest,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          kind: "Global error",
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#e6eefb",
          color: "#182338",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            padding: "40px 32px",
            borderRadius: 24,
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(37,96,230,0.14)",
            boxShadow:
              "0 20px 60px -24px rgba(37,96,230,0.28), 0 2px 8px rgba(24,35,56,0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#2560e6",
            }}
          >
            Something broke
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.15,
              color: "#182338",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 16,
              lineHeight: 1.6,
              color: "#4d5b78",
            }}
          >
            A critical error occurred. Please try again — if it keeps happening,
            come back in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 28,
              padding: "13px 24px",
              borderRadius: 16,
              border: "none",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 600,
              color: "white",
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              boxShadow: "0 10px 24px -8px rgba(37,96,230,0.55)",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
