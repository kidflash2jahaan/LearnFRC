import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Home, BookOpen, Search, Compass } from "lucide-react";
import {
  Rise,
  RiseGroup,
  RiseItem,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { FieldRadar } from "./_not-found/field-radar";

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

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
    a: "#7c5cff",
    title: "Search the glossary",
    body: "Look up any acronym, decoded.",
  },
];

export default function NotFound() {
  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-150px", top: "-180px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "520px", pos: { right: "-170px", top: "-60px" }, color: "#6ff0ea", opacity: 0.5, delay: 3 },
          { size: "460px", pos: { left: "35%", bottom: "-200px" }, color: "#c8b6ff", opacity: 0.42, delay: 6 },
        ]}
      />

      <section className="mx-auto flex min-h-[78svh] max-w-3xl flex-col items-center px-4 pb-20 pt-28 text-center sm:px-6 lg:px-8">
        <RiseGroup className="flex w-full flex-col items-center">
          <RiseItem className="flex justify-center">
            <span className="ac-chip inline-flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 text-primary" aria-hidden="true" focusable="false" />
              <span className="ac-eyebrow">Off the field</span>
            </span>
          </RiseItem>

          <RiseItem>
            <p
              className="mt-6 font-display text-[5.5rem] font-extrabold leading-none sm:text-[7rem]"
              style={BRAND_GRADIENT}
            >
              404
            </p>
          </RiseItem>

          <RiseItem>
            <h1 className="mt-2 text-balance font-display text-2xl font-bold sm:text-3xl">
              This bot took an autonomous detour
            </h1>
          </RiseItem>

          <RiseItem>
            <p className="mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
              The page you were after isn&apos;t on this field. No penalty —
              pick a route below and we&apos;ll get you back in the match.
            </p>
          </RiseItem>

          <RiseItem>
            <div className="mt-7">
              <Link href="/" className="ac-btn text-sm">
                Back to home base <ArrowRight className="h-4 w-4" aria-hidden="true" focusable="false" />
              </Link>
            </div>
          </RiseItem>
        </RiseGroup>

        <Rise delay={0.22} className="mt-10 w-full max-w-sm">
          <FieldRadar />
        </Rise>

        <RevealGroup className="mt-12 grid w-full gap-3 sm:grid-cols-3">
          {ROUTES.map((r) => (
            <RevealItem key={r.href}>
              <Hover className="h-full">
                <Link
                  href={r.href}
                  className="ac-tile group relative flex h-full min-h-11 flex-col items-start p-[18px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  style={{ "--a": r.a } as CSSProperties}
                >
                  <span
                    className="ac-badge flex h-11 w-11 items-center justify-center"
                    style={{ "--a": r.a } as CSSProperties}
                  >
                    <r.icon className="h-[22px] w-[22px]" aria-hidden="true" focusable="false" />
                  </span>
                  <span className="mt-3 flex items-center gap-1 font-display text-[15px] font-bold leading-tight text-foreground">
                    {r.title}
                    <ArrowRight
                      className="h-4 w-4 text-primary transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                      focusable="false"
                    />
                  </span>
                  <span className="mt-1 text-sm text-muted-foreground">{r.body}</span>
                </Link>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>
    </div>
  );
}
