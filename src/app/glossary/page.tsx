import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/glossary-data";
import { GlossaryBrowser } from "@/components/glossary/glossary-browser";
import { JsonLd } from "@/components/json-ld";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Glossary",
  description:
    "A searchable glossary of FRC terms, acronyms, and jargon, from roboRIO and swerve to OPR and the Impact Award.",
  alternates: { canonical: "/glossary" },
};

/**
 * The card catalogue.
 *
 * This page is a tool, and a tool page's masthead should get out of the way:
 * everything a reader does here happens in the search box, so the head of the
 * sheet is four lines and a row of figures, then the ink rule, then the
 * catalogue itself. There is no hero, no featured shelf and no closing pitch,
 * because all three would push the search field below the fold on a laptop.
 *
 * The figures are the drawer label: how much is filed in here, printed once,
 * in mono, at the top, the way the front of a card drawer is labelled.
 */
export default function GlossaryPage() {
  // How many of the 26 letters actually open a term. It is the one figure here
  // that says something the term count does not: the catalogue is broad, not
  // just deep in one place.
  const lettersCovered = new Set(
    GLOSSARY.map((t) => (t.term[0] ?? "").toUpperCase()).filter(Boolean)
  ).size;

  const tally = [
    { label: "terms filed", value: GLOSSARY.length.toLocaleString() },
    { label: "categories", value: String(GLOSSARY_CATEGORIES.length) },
    { label: "letters in use", value: `${lettersCovered}/26` },
  ];

  return (
    <>
      {/* DefinedTermSet, every glossary entry as a machine-readable term, so
          search engines can surface the glossary as a structured vocabulary. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          "@id": `${SITE}/glossary`,
          name: "FRC Glossary",
          url: `${SITE}/glossary`,
          hasDefinedTerm: GLOSSARY.map((t) => ({
            "@type": "DefinedTerm",
            name: t.term,
            description: t.definition,
            inDefinedTermSet: { "@id": `${SITE}/glossary` },
          })),
        }}
      />

      {/* ===================== THE DRAWER LABEL ===================== */}
      <section className="nb-wrap pb-[clamp(1.6rem,3vw,2.4rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <p className="nb-marker">the card catalogue</p>

            <h1 className="max-w-[15ch]">
              Every acronym you&rsquo;ll hear in the pit.
            </h1>

            <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
              Search a term, narrow it to one department, or jump to a letter.
              Written the way somebody would explain it across a workbench, not
              the way the manual defines it.
            </p>
          </div>

          <p className="nb-pen max-w-[19ch] rotate-[-1.4deg] min-[900px]:text-right">
            look it up mid-argument, that is what it is for
          </p>
        </div>

        <div className="nb-hair mt-[clamp(1.4rem,2.8vw,2rem)] flex flex-wrap items-end justify-between gap-x-10 gap-y-5 pt-[clamp(0.9rem,1.8vw,1.3rem)]">
          <dl className="flex flex-wrap gap-x-[clamp(1.6rem,4vw,3.4rem)] gap-y-4">
            {tally.map((t) => (
              <div key={t.label}>
                <dt className="nb-slug">{t.label}</dt>
                <dd className="nb-count mt-1.5">{t.value}</dd>
              </div>
            ))}
          </dl>

          <Link href="/guides" className="nb-btn-ghost nb-btn-sm shrink-0">
            Browse the guides
          </Link>
        </div>
      </section>

      {/* ===================== THE CATALOGUE =====================
          The browser owns its own search field, filters and grid. It centres
          on the axis of its results, which is why the label above it is the
          only left-aligned thing on the page. */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <GlossaryBrowser terms={GLOSSARY} categories={GLOSSARY_CATEGORIES} />
        </div>
      </section>
    </>
  );
}
