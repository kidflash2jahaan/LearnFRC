import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookA, Search, Sparkles, Tags } from "lucide-react";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/glossary-data";
import { GlossaryBrowser } from "@/components/glossary/glossary-browser";
import { AnimatedCounter } from "@/components/animated-counter";
import { RiseGroup, RiseItem, Reveal, Glow } from "@/components/motion/primitives";

export const metadata: Metadata = {
  title: "FRC Glossary",
  description:
    "A searchable glossary of FRC terms, acronyms, and jargon — from roboRIO and swerve to OPR and the Impact Award.",
  alternates: { canonical: "/glossary" },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default function GlossaryPage() {
  // Count how many distinct letters actually open a term — a fun stat for
  // the alphabet signature below.
  const lettersCovered = new Set(
    GLOSSARY.map((t) => (t.term[0] ?? "").toUpperCase()).filter(Boolean)
  ).size;

  const stats = [
    { icon: BookA, label: "terms indexed", value: GLOSSARY.length, suffix: "" },
    { icon: Tags, label: "categories", value: GLOSSARY_CATEGORIES.length, suffix: "" },
    { icon: Sparkles, label: "letters covered", value: lettersCovered, suffix: "/26" },
  ];

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "calc(50% - 280px)", top: "-260px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "460px", pos: { right: "-160px", top: "160px" }, color: "#6ff0ea", opacity: 0.45, delay: 2 },
          { size: "420px", pos: { left: "-140px", top: "480px" }, color: "#c8b6ff", opacity: 0.35, delay: 4 },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        {/* ============================ HERO ============================ */}
        <RiseGroup className="mx-auto max-w-3xl text-center">
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Every acronym, decoded</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.03] sm:text-5xl lg:text-6xl">
              The FRC <span style={BRAND_GRADIENT}>A to Z</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
              Every acronym and bit of jargon you&apos;ll hear in the pit, decoded.
              Search a term, jump to a letter, or filter by department — and
              learn the language of build season.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {stats.map(({ icon: StatIcon, label, value, suffix }) => (
                <span
                  key={label}
                  className="ac-card inline-flex items-center gap-2 rounded-2xl px-4 py-2.5"
                >
                  <span
                    className="ac-badge flex h-8 w-8 items-center justify-center"
                    style={{ "--a": "#2560e6" } as CSSProperties}
                  >
                    <StatIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <AnimatedCounter
                    value={value}
                    suffix={suffix}
                    className="text-base font-bold text-foreground"
                  />
                  <span className="text-sm text-muted-foreground">{label}</span>
                </span>
              ))}
            </div>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/guides" className="ac-btn text-sm">
                Browse the guides <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </RiseItem>
        </RiseGroup>

        {/* ================= SIGNATURE SEARCH + BROWSE ================= */}
        <Reveal className="mt-14" delay={0.05}>
          <GlossaryBrowser terms={GLOSSARY} categories={GLOSSARY_CATEGORIES} />
        </Reveal>
      </div>
    </div>
  );
}
