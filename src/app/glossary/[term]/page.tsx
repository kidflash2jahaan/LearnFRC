import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookA,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Tags,
} from "lucide-react";
import { GLOSSARY, glossarySlug, type GlossaryTerm } from "@/lib/glossary-data";
import { JsonLd } from "@/components/json-ld";
import { inkFor } from "@/lib/departments";
import { RiseGroup, RiseItem, Reveal, RevealGroup, RevealItem, Hover, Glow } from "@/components/motion/primitives";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

// Category → accent color, mirroring the browse grid's palette so a term's
// detail page reads as the same family as its card.
const CATEGORY_COLOR: Record<string, string> = {
  General: "#22d3ee",
  "Competition & Game": "#ff8a3d",
  Software: "#b16bff",
  Electrical: "#ffe53d",
  Mechanical: "#ff6b5d",
  "Sensors & Controls": "#2dd4bf",
  Awards: "#ffd23d",
  "Data & Scouting": "#5dff9b",
  Community: "#ff5db1",
};
const DEFAULT_COLOR = "#2560e6";

// Slug → term, built once. Also the lookup for generateStaticParams and the
// page/metadata resolvers, so every path here agrees on slugs.
const BY_SLUG = new Map<string, GlossaryTerm>(
  GLOSSARY.map((t) => [glossarySlug(t.term), t])
);

/** Meaningful tokens for keyword-overlap scoring (drops short/stop words). */
const STOP = new Set([
  "the", "and", "that", "with", "for", "from", "into", "over", "one", "its",
  "are", "was", "has", "have", "each", "not", "but", "can", "team", "teams",
  "robot", "robots", "frc", "first", "used", "use", "using", "other",
]);
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
}

/**
 * Pick up to 4 related terms: same category and keyword overlap both count,
 * with a deterministic alphabetical tiebreak so the set is stable per build.
 */
function relatedTerms(self: GlossaryTerm, n = 4): GlossaryTerm[] {
  const mine = tokens(`${self.term} ${self.definition}`);
  return GLOSSARY.filter((t) => t.term !== self.term)
    .map((t) => {
      let score = t.category === self.category ? 3 : 0;
      const theirs = tokens(`${t.term} ${t.definition}`);
      for (const w of theirs) if (mine.has(w)) score += 1;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score || a.t.term.localeCompare(b.t.term))
    .slice(0, n)
    .map((r) => r.t);
}

/**
 * A clean 140–160 char meta description built only from the term + its real
 * definition (never fabricated), with a neutral site tail to reach length and
 * a word-boundary trim when the combined text runs long.
 */
function buildDescription(t: GlossaryTerm): string {
  const MAX = 160;
  let d = `${t.term} — ${t.definition}`;
  if (d.length < 140) d += " Part of the LearnFRC glossary of FRC terms and acronyms.";
  if (d.length > MAX) {
    const cut = d.slice(0, MAX - 1);
    const lastSpace = cut.lastIndexOf(" ");
    d = (lastSpace > 120 ? cut.slice(0, lastSpace) : cut).replace(/[\s—:-]+$/, "") + "…";
  }
  return d;
}

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: glossarySlug(t.term) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}): Promise<Metadata> {
  const { term } = await params;
  const t = BY_SLUG.get(term);
  if (!t) return { title: "Term not found" };
  const url = `${SITE}/glossary/${term}`;
  const description = buildDescription(t);
  return {
    title: `${t.term} — FRC Glossary`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${t.term} — FRC Glossary`,
      description,
      url,
      type: "article",
      images: [{ url: `${SITE}/opengraph-image`, width: 1200, height: 630 }],
    },
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term } = await params;
  const t = BY_SLUG.get(term);
  if (!t) notFound();

  const slug = glossarySlug(t.term);
  const url = `${SITE}/glossary/${slug}`;
  const accent = CATEGORY_COLOR[t.category] ?? DEFAULT_COLOR;
  const related = relatedTerms(t);

  return (
    <div className="relative overflow-x-clip text-foreground">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          name: t.term,
          description: t.definition,
          url,
          inDefinedTermSet: `${SITE}/glossary`,
          ...(t.abbr && t.abbr !== t.term ? { alternateName: t.abbr } : {}),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Glossary", item: `${SITE}/glossary` },
            { "@type": "ListItem", position: 3, name: t.term, item: url },
          ],
        }}
      />

      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-240px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "480px", pos: { right: "-150px", top: "-100px" }, color: "#6ff0ea", opacity: 0.45, delay: 3 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <header className="mx-auto max-w-3xl px-4 pb-8 pt-28 sm:px-6 lg:px-8">
        <RiseGroup>
          <RiseItem>
            {/* Breadcrumb (matches the BreadcrumbList schema above) */}
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href="/" className="transition-colors hover:text-primary">
                    Home
                  </Link>
                </li>
                <ChevronRight aria-hidden className="h-3.5 w-3.5 opacity-60" />
                <li>
                  <Link href="/glossary" className="transition-colors hover:text-primary">
                    Glossary
                  </Link>
                </li>
                <ChevronRight aria-hidden className="h-3.5 w-3.5 opacity-60" />
                <li aria-current="page" className="font-medium text-foreground">
                  {t.term}
                </li>
              </ol>
            </nav>
          </RiseItem>

          <RiseItem>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span
                className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
                style={{ "--a": accent } as CSSProperties}
              >
                <BookA aria-hidden className="h-[18px] w-[18px]" />
              </span>
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: inkFor(accent) }}
              >
                {t.category}
              </span>
              {t.abbr && t.abbr !== t.term && (
                <span className="rounded-lg border border-border bg-background/60 px-2 py-0.5 font-mono text-[11px] font-medium text-accent">
                  {t.abbr}
                </span>
              )}
            </div>
          </RiseItem>

          <RiseItem>
            <h1 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span style={GRADIENT_TEXT}>{t.term}</span>
            </h1>
          </RiseItem>

          <RiseItem>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/80">
              {t.definition}
            </p>
          </RiseItem>

          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {t.internalLink && (
                <Link href={t.internalLink} className="ac-btn text-sm">
                  Read the full guide <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              )}
              {t.link && (
                <a
                  href={t.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ac-btn-ghost inline-flex items-center gap-1.5 text-sm"
                >
                  Official source <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </RiseItem>
        </RiseGroup>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <hr aria-hidden className="ac-divider" />
      </div>

      {/* ======================= RELATED TERMS ======================= */}
      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
          <Reveal>
            <p className="ac-eyebrow flex items-center gap-1.5">
              <Tags aria-hidden className="h-3.5 w-3.5" /> Related terms
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              Keep decoding the jargon
            </h2>
          </Reveal>
          <RevealGroup className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <RevealItem key={r.term}>
                <Hover className="h-full" lift={-4} scale={1.01}>
                  <Link
                    href={`/glossary/${glossarySlug(r.term)}`}
                    className="ac-card group flex h-full flex-col p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: inkFor(CATEGORY_COLOR[r.category] ?? DEFAULT_COLOR) }}
                    >
                      {r.category}
                    </span>
                    <h3 className="mt-1.5 font-display text-lg font-bold leading-tight tracking-tight transition-colors group-hover:text-primary">
                      {r.term}
                    </h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {r.definition}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      View term
                      <ArrowRight
                        aria-hidden
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </Hover>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* ========================= LEARN MORE ======================== */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <Reveal>
          <div
            className="ac-glass relative overflow-hidden p-8 text-center sm:px-16 sm:py-12"
            style={{ "--a": "#2560e6" } as CSSProperties}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.25),transparent_70%)] blur-2xl"
            />
            <span className="ac-badge mx-auto mb-4 flex h-12 w-12 items-center justify-center">
              <BookOpen aria-hidden className="h-6 w-6" />
            </span>
            <h2 className="text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Learn the language of <span style={GRADIENT_TEXT}>build season</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-foreground/70">
              {t.internalLink
                ? "Go deeper with a full LearnFRC guide, or keep browsing every acronym in the glossary."
                : "Browse every FRC acronym and bit of jargon, or start free structured lessons across every department."}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {t.internalLink ? (
                <Link href={t.internalLink} className="ac-btn text-sm">
                  Read the full guide <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              ) : (
                <Link href="/guides" className="ac-btn text-sm">
                  Browse the guides <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              )}
              <Link
                href="/glossary"
                className="ac-btn-ghost inline-flex items-center gap-1.5 text-sm"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" /> Back to the glossary
              </Link>
            </div>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles aria-hidden className="h-3.5 w-3.5" /> {GLOSSARY.length} terms and
              counting
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
