import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { BookA, Search, Sparkles, Tags } from "lucide-react";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/glossary-data";
import { GlossaryBrowser } from "@/components/glossary/glossary-browser";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "FRC Glossary",
  description:
    "A searchable glossary of FRC terms, acronyms, and jargon — from roboRIO and swerve to OPR and the Impact Award.",
};

const HEADING_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default function GlossaryPage() {
  const stats = [
    { icon: BookA, label: "terms indexed", value: GLOSSARY.length },
    { icon: Tags, label: "categories", value: GLOSSARY_CATEGORIES.length },
  ];

  return (
    <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-24 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(37,96,230,0.22),transparent 70%)" }}
        />
        <div
          className="absolute top-24 -right-16 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(26,169,214,0.20),transparent 70%)" }}
        />
        <div
          className="absolute top-40 -left-20 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(124,92,246,0.16),transparent 70%)" }}
        />
      </div>

      {/* hero */}
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="aq-eyebrow aq-rise aq-rise-1 justify-center">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Every acronym, decoded
        </p>

        <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          The FRC{" "}
          <span style={HEADING_GRADIENT}>glossary</span>
        </h1>

        <p className="aq-rise aq-rise-3 mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
          Every acronym and bit of jargon you&apos;ll hear in the pit, decoded.
          Search a term, filter by department, and learn the language of build
          season.
        </p>

        {/* stat badges */}
        <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center justify-center gap-3">
          {stats.map(({ icon: StatIcon, label, value }) => (
            <span
              key={label}
              className="aq-card inline-flex items-center gap-2 rounded-2xl px-4 py-2"
            >
              <span className="aq-icon flex h-7 w-7 items-center justify-center rounded-xl">
                <StatIcon className="h-3.5 w-3.5 text-primary" aria-hidden />
              </span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {value}
              </span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </span>
          ))}
        </div>
      </Reveal>

      {/* search + browser panel */}
      <Reveal className="mt-14" delay={0.05}>
        <div className="aq-glass rounded-3xl p-5 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="aq-badge flex h-11 w-11 items-center justify-center" style={{ "--a": "#2560e6" } as CSSProperties}>
              <Search className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="aq-display text-xl font-bold leading-tight">
                Search the language of FRC
              </h2>
              <p className="text-sm text-muted-foreground">
                Type a term, an acronym, or a phrase — then narrow it down by
                category.
              </p>
            </div>
          </div>

          <div className="aq-divider mb-6" />

          <GlossaryBrowser terms={GLOSSARY} categories={GLOSSARY_CATEGORIES} />
        </div>
      </Reveal>
    </div>
  );
}
