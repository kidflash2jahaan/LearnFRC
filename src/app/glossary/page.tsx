import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { BookA, Search, Sparkles, Tags } from "lucide-react";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/glossary-data";
import { AlphabetSearch } from "./_alphabet-search";
import { Reveal } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";

export const metadata: Metadata = {
  title: "FRC Glossary",
  description:
    "A searchable glossary of FRC terms, acronyms, and jargon — from roboRIO and swerve to OPR and the Impact Award.",
};

const HEADING_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,var(--primary),var(--accent))",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default function GlossaryPage() {
  // Count how many distinct letters actually open a term — a fun stat for the
  // alphabet signature.
  const lettersCovered = new Set(
    GLOSSARY.map((t) => (t.term[0] ?? "").toUpperCase()).filter(Boolean)
  ).size;

  const stats = [
    { icon: BookA, label: "terms indexed", value: GLOSSARY.length, suffix: "" },
    { icon: Tags, label: "categories", value: GLOSSARY_CATEGORIES.length, suffix: "" },
    { icon: Sparkles, label: "letters covered", value: lettersCovered, suffix: "/26" },
  ];

  return (
    <div className="relative isolate overflow-x-clip">
      {/* ambient glows the glass refracts */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span
          className="aq-float absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(37,96,230,0.22),transparent 70%)" }}
        />
        <span
          className="aq-float absolute top-24 -right-16 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(26,169,214,0.20),transparent 70%)", animationDelay: "1.6s" }}
        />
        <span
          className="aq-float absolute top-52 -left-20 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(124,92,246,0.16),transparent 70%)", animationDelay: "3s" }}
        />
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* ============================ HERO ============================ */}
        <header className="mx-auto max-w-3xl text-center">
          <p className="aq-eyebrow aq-rise aq-rise-1 justify-center">
            <Search className="h-3.5 w-3.5" aria-hidden />
            Every acronym, decoded
          </p>

          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-balance text-4xl font-extrabold leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">
            The FRC{" "}
            <span className="aq-grad-anim" style={HEADING_GRADIENT}>
              A&nbsp;to&nbsp;Z
            </span>
          </h1>

          <p className="aq-rise aq-rise-3 mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
            Every acronym and bit of jargon you&apos;ll hear in the pit, decoded.
            Jump straight to a letter, search a term, or filter by department —
            and learn the language of build season.
          </p>

          {/* stat badges */}
          <div className="aq-rise aq-rise-4 mt-8 flex flex-wrap items-center justify-center gap-3">
            {stats.map(({ icon: StatIcon, label, value, suffix }) => (
              <span
                key={label}
                className="aq-card aq-card-hover inline-flex items-center gap-2 rounded-2xl px-4 py-2.5"
              >
                <span className="aq-icon aq-badge-bob flex h-8 w-8 items-center justify-center rounded-xl">
                  <StatIcon className="h-4 w-4 text-primary" aria-hidden />
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
        </header>

        {/* ================= SIGNATURE + SEARCH ================= */}
        <Reveal className="mt-14 aq-rise aq-rise-5" delay={0.05}>
          <AlphabetSearch terms={GLOSSARY} categories={GLOSSARY_CATEGORIES} />
        </Reveal>
      </div>
    </div>
  );
}
