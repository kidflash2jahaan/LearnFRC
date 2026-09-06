import { cache, type CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GLOSSARY,
  glossarySlug,
  hasGlossaryDepth,
  type GlossaryTerm,
} from "@/lib/glossary-data";
import { getAllDepartmentSlugs, getDepartmentBySlug, flattenLessons } from "@/lib/queries";
import { JsonLd } from "@/components/json-ld";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

// Daily background ISR floor, matching the rest of the catalog-backed routes.
// These pages now link into real lessons, so they have to re-render when the
// catalog moves; content edits still push live via /api/revalidate.
export const revalidate = 86400;

/**
 * The related-terms wall. Uneven spans and four different angles, because a
 * wall of cards that all measure the same and all hang straight is a grid, and
 * a grid says these four are interchangeable. They are not: they are four
 * cards somebody pinned up in whatever order they came to hand.
 */
const RELATED_SPANS = [7, 5, 5, 7];
const RELATED_TILTS = ["nb-tilt-1", "nb-tilt-2", "nb-tilt-3", "nb-tilt-4"];

// Slug → term, built once. Also the lookup for generateStaticParams and the
// page/metadata resolvers, so every path here agrees on slugs.
const BY_SLUG = new Map<string, GlossaryTerm>(
  GLOSSARY.map((t) => [glossarySlug(t.term), t])
);
const BY_TERM = new Map<string, GlossaryTerm>(GLOSSARY.map((t) => [t.term, t]));

/* ───────────────────────── lesson matching ─────────────────────────── */

type LessonMatch = {
  path: string;
  title: string;
  summary: string | null;
  departmentName: string;
  moduleTitle: string;
};

/**
 * Every published lesson, flattened to the fields needed for matching and for
 * rendering a link. Built from the existing cached catalog helpers, so no new
 * query surface, and no lesson `content` (the list columns are enough, and
 * pulling 400 markdown bodies to fuzzy-match a glossary term would be absurd).
 *
 * Sorted by path so the index, and therefore every tie-break below it, is
 * deterministic regardless of what order Postgres hands back the departments.
 */
const lessonIndex = cache(async (): Promise<LessonMatch[]> => {
  const slugs = await getAllDepartmentSlugs();
  const depts = await Promise.all(slugs.map((s) => getDepartmentBySlug(s)));
  const out: LessonMatch[] = [];
  for (const d of depts) {
    if (!d) continue;
    for (const l of flattenLessons(d)) {
      out.push({
        path: `/guides/${l.departmentSlug}/${l.moduleSlug}/${l.slug}`,
        title: l.title,
        summary: l.summary,
        departmentName: l.departmentName,
        moduleTitle: l.moduleTitle,
      });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
});

// A cue only counts as a hit on a whole-token boundary, so "CAN" never matches
// "can", and "PID" never matches "rapid".
function cueRegex(phrase: string): RegExp {
  const esc = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i");
}

const TITLE_HIT = 6;
const SUMMARY_HIT = 3;
/** Multi-word cues are far less likely to be coincidental, so they weigh more. */
const PHRASE_WEIGHT = 1.5;
/**
 * Floor for showing a lesson at all: one title hit, or two summary hits. Set
 * deliberately high. On a page whose whole job is to send readers somewhere
 * useful, a wrong link costs more than an empty section.
 */
const MIN_SCORE = 6;
const MAX_LESSONS = 3;

/**
 * The two or three lessons that genuinely cover this term, scored against real
 * lesson titles and summaries at build time. Returns [] when nothing clears
 * the bar: several terms (KitBot, Rookie All-Star) have no lesson that
 * actually discusses them, and an honest empty section beats a
 * plausible-looking wrong link.
 */
function matchLessons(t: GlossaryTerm, index: LessonMatch[]): LessonMatch[] {
  const cues = t.lessonCues ?? [];
  if (!cues.length) return [];
  const compiled = cues.map((c) => ({
    re: cueRegex(c),
    weight: c.includes(" ") ? PHRASE_WEIGHT : 1,
  }));
  return index
    .map((l) => {
      let score = 0;
      for (const { re, weight } of compiled) {
        if (re.test(l.title)) score += TITLE_HIT * weight;
        if (l.summary && re.test(l.summary)) score += SUMMARY_HIT * weight;
      }
      return { score, l };
    })
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.l.title.localeCompare(b.l.title))
    .slice(0, MAX_LESSONS)
    .map((x) => x.l);
}

/* ───────────────────────── related terms ───────────────────────────── */

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
 * Up to 4 related terms. Curated `related` entries lead (the heuristic is fine
 * inside a category and poor across them, and the cross-category hops are the
 * ones worth having); the existing category + keyword-overlap score then fills
 * whatever slots are left, with a deterministic alphabetical tiebreak.
 */
function relatedTerms(self: GlossaryTerm, n = 4): GlossaryTerm[] {
  const picked: GlossaryTerm[] = [];
  const seen = new Set<string>([self.term]);
  for (const name of self.related ?? []) {
    const t = BY_TERM.get(name);
    if (!t || seen.has(t.term)) continue;
    seen.add(t.term);
    picked.push(t);
    if (picked.length >= n) return picked;
  }

  const mine = tokens(`${self.term} ${self.definition}`);
  const fill = GLOSSARY.filter((t) => !seen.has(t.term))
    .map((t) => {
      let score = t.category === self.category ? 3 : 0;
      const theirs = tokens(`${t.term} ${t.definition}`);
      for (const w of theirs) if (mine.has(w)) score += 1;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score || a.t.term.localeCompare(b.t.term))
    .slice(0, n - picked.length)
    .map((r) => r.t);
  return [...picked, ...fill];
}

/* ───────────────────────────── metadata ────────────────────────────── */

/**
 * A clean 140 to 160 character meta description built only from the term and
 * its real definition (never fabricated), with a neutral site tail to reach
 * length and a word-boundary trim when the combined text runs long.
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

/** Every genuine alternate name for the term, deduped against the term itself. */
function alternateNames(t: GlossaryTerm): string[] {
  const out: string[] = [];
  const seen = new Set([t.term.toLowerCase()]);
  for (const n of [t.abbr, ...(t.alsoCalled ?? [])]) {
    if (!n) continue;
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
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
    // A term with no hand-written "in a match" section is a definition and
    // nothing more. It still renders for anyone who browses to it, but it
    // doesn't go in the index: thin pages at this scale are a real liability.
    ...(hasGlossaryDepth(t) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: `${t.term} — FRC Glossary`,
      description,
      url,
      type: "article",
      images: [{ url: `${SITE}/opengraph-image`, width: 1200, height: 630 }],
    },
  };
}

/**
 * One term.
 *
 * A glossary entry IS an index card, so this is the one page in the binder
 * where the card is not a container for the content but the content itself:
 * the term, the drawer it is filed in, and the definition, on a single taped
 * card at the top of the sheet. Everything under it is what a person does
 * next, in the order they would want it: what the term looks like in a real
 * match, the lessons that use it, and the cards filed nearest to this one.
 */
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
  const related = relatedTerms(t);
  const lessons = matchLessons(t, await lessonIndex());
  const altNames = alternateNames(t);
  const shortName = t.abbr && t.abbr !== t.term ? t.abbr : t.term;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          name: t.term,
          description: t.definition,
          url,
          inDefinedTermSet: `${SITE}/glossary`,
          ...(altNames.length ? { alternateName: altNames } : {}),
          // The practical "where you meet it" copy is a disambiguating
          // elaboration on the definition, not the definition itself.
          ...(t.inMatch ? { disambiguatingDescription: t.inMatch } : {}),
          ...(lessons.length
            ? {
                subjectOf: lessons.map((l) => ({
                  "@type": "LearningResource",
                  name: l.title,
                  url: `${SITE}${l.path}`,
                })),
              }
            : {}),
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

      {/* ===================== THE CARD =====================
          The whole point of the page, and the only thing above the fold.
          Everything about it is the filing metaphor taken literally: the
          drawer slug at the top left, the short form stamped at the right,
          the term, the definition, and the two places to go for more. */}
      <section className="nb-wrap pb-[clamp(1.8rem,3.5vw,2.6rem)] pt-[clamp(1.8rem,4vw,3rem)]">
        {/* Matches the BreadcrumbList schema above. */}
        <nav aria-label="Breadcrumb" className="nb-slug">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link href="/" className="hover:text-blue hover:underline">
                home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/glossary" className="hover:text-blue hover:underline">
                glossary
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-bold text-ink">
              {slug}
            </li>
          </ol>
        </nav>

        <div className="nb-box nb-tilt-3 mt-[clamp(1.2rem,2.4vw,1.8rem)] max-w-[46rem] p-[clamp(1.3rem,3vw,2.2rem)]">
          <span className="nb-tape -top-3 left-[13%] rotate-[-3.6deg]" aria-hidden="true" />
          <span className="nb-tape -bottom-3 right-[18%] rotate-[2.4deg]" aria-hidden="true" />

          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <p className="nb-slug min-w-0">drawer / {t.category}</p>
            {t.abbr && t.abbr !== t.term && (
              <span className="nb-tag shrink-0">{t.abbr}</span>
            )}
          </div>

          <h1 className="mt-3 text-[clamp(2.1rem,1.3rem+2.6vw,3.4rem)]">
            {t.term}
          </h1>

          <p className="mt-4 max-w-[54ch] text-[1.05rem] leading-relaxed">
            {t.definition}
          </p>

          {t.alsoCalled && t.alsoCalled.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-2">
              <span className="nb-slug">also called</span>
              {t.alsoCalled.map((n) => (
                <span key={n} className="nb-tag">
                  {n}
                </span>
              ))}
            </p>
          )}

          {(t.internalLink || t.link) && (
            <div className="nb-hair mt-[clamp(1.2rem,2.4vw,1.7rem)] flex flex-wrap gap-3 pt-[clamp(1rem,2vw,1.4rem)]">
              {t.internalLink && (
                <Link href={t.internalLink} className="nb-btn">
                  Read the full guide
                </Link>
              )}
              {t.link && (
                <a
                  href={t.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nb-btn-ghost"
                >
                  Official source
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===================== IN A MATCH =====================
          The reason this page exists: what the term actually looks like from
          the driver station, the pit, or the CAD review. Hand-written per
          term, and omitted entirely rather than filled with anything generic,
          which is why it is a margin note and not a section of its own. */}
      {t.inMatch && (
        <section className="nb-wrap pb-[clamp(1.8rem,3.5vw,2.6rem)]">
          <div className="nb-note max-w-[52rem]">
            <p className="nb-slug">where you actually meet {shortName}</p>
            <p className="mt-2.5 text-[1rem] leading-relaxed">{t.inMatch}</p>
          </div>
        </section>
      )}

      {/* ===================== THE LESSONS =====================
          Real lessons from the catalogue, matched at build time on titles and
          summaries. Empty when nothing scores high enough, see matchLessons. */}
      {lessons.length > 0 && (
        <section className="nb-wrap pb-[clamp(2.2rem,4.5vw,3.4rem)]">
          <div className="nb-rule pt-[clamp(1.6rem,3.2vw,2.4rem)]">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <div>
                <h2 className="max-w-[24ch] text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
                  Lessons that use {shortName}
                </h2>
                <p className="nb-sub mt-2 text-[0.98rem]">
                  Free and structured, and none of them need an account to read.
                </p>
              </div>
              <p className="nb-count shrink-0">
                {lessons.length}
                <small>{lessons.length === 1 ? "lesson" : "lessons"}</small>
              </p>
            </div>

            <div className="nb-list mt-[clamp(1rem,2vw,1.4rem)]">
              {lessons.map((l) => (
                <Link key={l.path} href={l.path} className="nb-row">
                  <span className="nb-slug">
                    {l.departmentName}
                    <br />
                    {l.moduleTitle}
                  </span>
                  <span className="min-w-0">
                    <h3>{l.title}</h3>
                    {l.summary && (
                      <span className="mt-1.5 block text-[0.94rem] leading-snug text-graphite">
                        {l.summary}
                      </span>
                    )}
                  </span>
                  <span className="nb-slug hidden whitespace-nowrap min-[769px]:block">
                    open
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================== THE CARDS NEXT TO IT ===================== */}
      {related.length > 0 && (
        <section className="nb-wrap pb-[clamp(2.2rem,4.5vw,3.4rem)]">
          <div className="nb-rule pt-[clamp(1.6rem,3.2vw,2.4rem)]">
            <div className="mb-[clamp(1.2rem,2.6vw,1.9rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
                Filed next to it
              </h2>
              <p className="nb-pen max-w-[20ch] rotate-[1.2deg] min-[900px]:text-right">
                the jargon travels in packs
              </p>
            </div>

            {/* Both breakpoints are written as arbitrary `min-[…]` queries on
                purpose. A named variant like `sm:` lands LATER in the compiled
                sheet than an arbitrary one, so `sm:grid-cols-2` would beat
                `min-[1080px]:grid-cols-12` at every width above 1080 and the
                wall would silently collapse to two columns. */}
            <div className="grid grid-cols-1 gap-[clamp(0.85rem,1.7vw,1.35rem)] min-[640px]:grid-cols-2 min-[1080px]:grid-cols-12">
              {related.map((r, i) => (
                <Link
                  key={r.term}
                  href={`/glossary/${glossarySlug(r.term)}`}
                  className={`nb-box nb-lift flex flex-col p-[clamp(1rem,1.9vw,1.4rem)] ${
                    RELATED_TILTS[i % RELATED_TILTS.length]
                  } min-[1080px]:[grid-column:var(--span)]`}
                  style={
                    {
                      "--span": `span ${RELATED_SPANS[i % RELATED_SPANS.length]}`,
                    } as CSSProperties
                  }
                >
                  <span className="nb-tape -top-3 left-4 h-[21px] w-[74px] rotate-[-4deg]" aria-hidden="true" />

                  <p className="nb-slug">{r.category}</p>
                  <h3 className="mt-2">{r.term}</h3>
                  <p className="mt-2 flex-1 text-[0.92rem] leading-snug text-graphite">
                    {r.definition}
                  </p>
                  <span className="nb-hair nb-slug mt-4 pt-3 text-ink">
                    read the entry
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================== BACK TO THE DRAWER =====================
          Two doors and one sentence. The card at the top already carries the
          "read the full guide" ask for the terms that have one, so repeating
          it here would be the same button twice on one page. */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-[clamp(1.4rem,2.8vw,2rem)]">
          <p className="max-w-[46ch] text-graphite">
            {t.term} is one of {GLOSSARY.length.toLocaleString()} entries in the
            catalogue. The guides are where these words get used in order,
            instead of one at a time.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/glossary" className="nb-btn-ghost">
              Back to the catalogue
            </Link>
            <Link href="/guides" className="nb-btn-ghost">
              Browse the guides
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
