import type { Metadata } from "next";
import { BookA } from "lucide-react";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/glossary-data";
import { GlossaryBrowser } from "@/components/glossary/glossary-browser";
import { Reveal } from "@/components/motion/reveal";
import { StatusPill, TypeLine } from "@/components/motion/terminal";

export const metadata: Metadata = {
  title: "FRC Glossary",
  description:
    "A searchable glossary of FRC terms, acronyms, and jargon — from roboRIO and swerve to OPR and the Impact Award.",
};

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <div className="mb-4 flex justify-center">
          <StatusPill tone="accent">
            <BookA className="h-3.5 w-3.5" />
            {GLOSSARY.length} terms indexed
          </StatusPill>
        </div>
        <h1 className="text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
          The FRC <span className="text-gradient-animated">glossary</span>
        </h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">
          Every acronym and bit of jargon you&apos;ll hear in the pit, decoded.
          Search it, filter it, learn the language.
        </p>
        <div className="mt-5 inline-flex max-w-full items-center gap-2 overflow-hidden rounded-lg border border-border bg-card/60 px-3.5 py-2 backdrop-blur-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
          <TypeLine
            prompt="~/learnfrc $"
            text="grep -i frc glossary.db"
            className="truncate text-[13px] text-muted-foreground"
          />
        </div>
      </Reveal>

      <div className="mt-12">
        <GlossaryBrowser terms={GLOSSARY} categories={GLOSSARY_CATEGORIES} />
      </div>
    </div>
  );
}
