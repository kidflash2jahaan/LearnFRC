import Link from "next/link";
import { Home, BookOpen } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[80svh] flex-col items-center justify-center px-4 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-10 -z-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />

      <p className="aq-eyebrow aq-rise aq-rise-1">Off the field</p>

      <div
        className="aq-display aq-rise aq-rise-1 mt-3 text-8xl font-bold sm:text-9xl"
        style={{
          background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        404
      </div>

      <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
        This page took an autonomous detour
      </h1>

      <p className="aq-rise aq-rise-3 mt-3 max-w-md text-base leading-relaxed text-foreground/70">
        We couldn&apos;t find what you were looking for. Let&apos;s get you back
        on the field.
      </p>

      <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="aq-cta">
          <Home className="h-4 w-4" /> Home
        </Link>
        <Link href="/guides" className="aq-ghost">
          <BookOpen className="h-4 w-4" /> Browse guides
        </Link>
      </div>
    </div>
  );
}
