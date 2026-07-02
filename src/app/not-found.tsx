import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Home, BookOpen, Search, Compass } from "lucide-react";
import { LostBot } from "./_not-found/lost-bot";

/** FRC-flavored ways back onto the field. */
const ROUTES = [
  {
    href: "/",
    icon: Home,
    a: "#2560e6",
    title: "Back to home base",
    body: "Return to the pit and start fresh.",
  },
  {
    href: "/guides",
    icon: BookOpen,
    a: "#1aa9d6",
    title: "Browse the guides",
    body: "Every department, start to finish.",
  },
  {
    href: "/glossary",
    icon: Search,
    a: "#7c3aed",
    title: "Search the glossary",
    body: "Look up any acronym, decoded.",
  },
];

export default function NotFound() {
  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate flex min-h-[86svh] flex-col items-center justify-center overflow-x-clip px-4 py-20 text-center text-foreground"
    >
      {/* ambient glows the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="aq-float h-[560px] w-[560px] opacity-70"
          style={{
            left: "-140px",
            top: "-160px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="aq-float h-[520px] w-[520px] opacity-60"
          style={{
            right: "-160px",
            top: "-80px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
            animationDelay: "-3s",
          }}
        />
        <span
          className="aq-float h-[480px] w-[480px] opacity-50"
          style={{
            left: "40%",
            bottom: "-180px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
            animationDelay: "-6s",
          }}
        />
      </div>

      {/* signature: lost robot off the field */}
      <div className="aq-rise aq-rise-1">
        <LostBot />
      </div>

      <p className="aq-eyebrow aq-rise aq-rise-2 mt-6 inline-flex items-center gap-2">
        <Compass className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
        Off the field
      </p>

      <div
        className="aq-display aq-grad-anim aq-rise aq-rise-2 mt-2 text-[5.5rem] font-extrabold leading-none sm:text-[7rem]"
        style={{
          background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        404
      </div>

      <h1 className="aq-display aq-rise aq-rise-3 mt-3 text-balance text-2xl font-bold sm:text-3xl">
        This bot took an autonomous detour
      </h1>

      <p className="aq-rise aq-rise-4 mt-3 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
        The page you were after isn&apos;t on this field. No penalty — pick a
        route below and we&apos;ll get you back in the match.
      </p>

      {/* ways back — glass tiles */}
      <div className="aq-rise aq-rise-5 mt-8 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
        {ROUTES.map((r, i) => (
          <Link
            key={r.href}
            href={r.href}
            className="aq-tile aq-card-hover aq-reveal group relative flex min-h-[44px] flex-col items-start rounded-[20px] p-4 text-left"
            style={
              {
                "--a": r.a,
                animationDelay: `${i * 0.09}s`,
              } as CSSProperties
            }
          >
            <span
              className="aq-badge aq-badge-bob flex h-11 w-11 items-center justify-center rounded-[14px]"
              style={{ "--a": r.a } as CSSProperties}
            >
              <r.icon className="h-[22px] w-[22px]" aria-hidden="true" focusable="false" />
            </span>
            <span className="aq-display mt-3 flex items-center gap-1 text-[15px] font-bold leading-tight text-foreground">
              {r.title}
              <ArrowRight
                className="h-4 w-4 text-primary transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
                focusable="false"
              />
            </span>
            <span className="mt-1 text-sm text-muted-foreground">{r.body}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
