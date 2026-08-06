import type { Element, ElementContent, Root } from "hast";
import { GLOSSARY, glossarySlug } from "@/lib/glossary-data";

/* ==================================================================== */
/*  Conservative glossary auto-linking                                   */
/*                                                                       */
/*  A rehype pass that turns the FIRST mention of a piece of FRC jargon  */
/*  into a link to its glossary entry. This exists for one reason: a     */
/*  rookie reading "the roboRIO talks to the PDH over CAN" should be     */
/*  able to click through instead of bouncing to Google. It is           */
/*  deliberately restrained — over-linking reads as manipulative and     */
/*  wrecks the prose:                                                    */
/*                                                                       */
/*    • first occurrence of a term only, per page                        */
/*    • never inside a heading, code, an existing link, or a table head  */
/*    • hard cap of 6 auto-links per page                                */
/*    • whole-word matches only (no substrings, no fuzzy matching)       */
/*    • skipped entirely if the author already linked that entry         */
/*    • switched off with <Markdown glossaryLinks={false} />             */
/* ==================================================================== */

/** Marker class so the renderer can style auto-links more quietly than */
/** author-written links (and so QA can count them). */
export const GLOSSARY_AUTOLINK_CLASS = "glossary-autolink";

/** Hard ceiling on auto-links per rendered page. */
export const GLOSSARY_AUTOLINK_MAX = 6;

/**
 * Terms that are real glossary entries but read as ordinary English in
 * prose. Auto-linking these produces noise ("regional differences",
 * "the blue alliance scored") rather than help, so they only ever get
 * linked when an author writes the link by hand.
 */
const ALIAS_DENY = new Set([
  "auto",
  "alliance",
  "district",
  "regional",
  "inspection",
  "playoffs",
  "first choice",
  "the blue alliance",
  "open alliance",
]);

/** Elements whose subtree must never be touched. */
const SKIP_TAGS = new Set([
  "a",
  "abbr",
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  "script",
  "style",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "th",
  "figcaption",
]);

type Alias = {
  /** Canonical spelling used for matching. */
  needle: string;
  /** Match respects letter case (acronym-bearing aliases do). */
  caseSensitive: boolean;
  /** Allow a single trailing "s" so "encoders" still links. */
  allowPlural: boolean;
  slug: string;
  term: string;
};

/** Two or more consecutive capitals ⇒ the alias carries an acronym. */
const ACRONYM_RUN = /[A-Z]{2,}/;
const WORDISH = /[A-Za-z0-9_-]/;

function buildAliases(): Alias[] {
  const out: Alias[] = [];
  const seen = new Set<string>();

  for (const entry of GLOSSARY) {
    const slug = glossarySlug(entry.term);
    // "Gyroscope / IMU" → match "Gyroscope"; the abbr covers the rest.
    const primary = entry.term.split("/")[0].trim();
    const candidates = [primary, entry.abbr?.trim()].filter(
      (c): c is string => Boolean(c)
    );

    for (const raw of candidates) {
      const lower = raw.toLowerCase();
      if (seen.has(lower)) continue;
      if (ALIAS_DENY.has(lower)) continue;
      // Only letters, digits, spaces and light punctuation — anything else
      // is a phrase we should not be pattern-matching in prose.
      if (!/^[A-Za-z0-9][A-Za-z0-9 .'’-]*$/.test(raw)) continue;

      const caseSensitive = ACRONYM_RUN.test(raw);
      // Acronyms are unambiguous at 3 chars; plain words need more length
      // before a whole-word match is safe.
      const minLength = caseSensitive ? 3 : 5;
      if (raw.length < minLength) continue;

      seen.add(lower);
      out.push({
        needle: caseSensitive ? raw : lower,
        caseSensitive,
        allowPlural: !caseSensitive && !lower.endsWith("s"),
        slug,
        term: entry.term,
      });
    }
  }

  // Longest first so "Alliance Selection" wins over a shorter overlap.
  return out.sort((a, b) => b.needle.length - a.needle.length);
}

/** Built once at module load — the glossary is a static import. */
const ALIASES = buildAliases();

/** Exported for tests / QA: how many terms are eligible for auto-linking. */
export const GLOSSARY_AUTOLINK_ALIAS_COUNT = ALIASES.length;

function boundaryOk(value: string, start: number, end: number): boolean {
  const before = start > 0 ? value[start - 1] : "";
  const after = end < value.length ? value[end] : "";
  if (before && WORDISH.test(before)) return false;
  if (after && WORDISH.test(after)) return false;
  return true;
}

function findMatch(
  value: string,
  lowered: string,
  alias: Alias
): { start: number; end: number } | null {
  const hay = alias.caseSensitive ? value : lowered;
  let from = 0;
  for (;;) {
    const i = hay.indexOf(alias.needle, from);
    if (i < 0) return null;
    const end = i + alias.needle.length;
    if (boundaryOk(value, i, end)) return { start: i, end };
    if (
      alias.allowPlural &&
      (value[end] === "s" || value[end] === "S") &&
      boundaryOk(value, i, end + 1)
    ) {
      return { start: i, end: end + 1 };
    }
    from = i + 1;
  }
}

function anchor(alias: Alias, text: string): Element {
  return {
    type: "element",
    tagName: "a",
    properties: {
      href: `/glossary/${alias.slug}`,
      className: [GLOSSARY_AUTOLINK_CLASS],
      title: `${alias.term} — LearnFRC glossary`,
    },
    children: [{ type: "text", value: text }],
  };
}

type PassState = {
  used: Set<string>;
  count: number;
  max: number;
};

/**
 * Split one text node around the terms it contains. Returns `null` when
 * nothing matched so the caller can leave the node untouched.
 */
function linkifyText(value: string, state: PassState): ElementContent[] | null {
  const out: ElementContent[] = [];
  let cursor = 0;

  while (state.count < state.max && cursor < value.length) {
    const rest = value.slice(cursor);
    const restLower = rest.toLowerCase();

    let best: { alias: Alias; start: number; end: number } | null = null;
    for (const alias of ALIASES) {
      if (state.used.has(alias.slug)) continue;
      const m = findMatch(rest, restLower, alias);
      if (!m) continue;
      const better =
        !best ||
        m.start < best.start ||
        (m.start === best.start && m.end - m.start > best.end - best.start);
      if (better) best = { alias, start: m.start, end: m.end };
    }
    if (!best) break;

    if (best.start > 0) {
      out.push({ type: "text", value: rest.slice(0, best.start) });
    }
    out.push(anchor(best.alias, rest.slice(best.start, best.end)));
    state.used.add(best.alias.slug);
    state.count += 1;
    cursor += best.end;
  }

  if (out.length === 0) return null;
  if (cursor < value.length) {
    out.push({ type: "text", value: value.slice(cursor) });
  }
  return out;
}

function isElement(node: unknown): node is Element {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as { type?: string }).type === "element"
  );
}

/** Collect glossary links the author already wrote so we never duplicate one. */
function collectExistingGlossaryLinks(node: Root | Element, into: Set<string>) {
  for (const child of node.children as ElementContent[]) {
    if (!isElement(child)) continue;
    if (child.tagName === "a") {
      const href = child.properties?.href;
      if (typeof href === "string" && href.startsWith("/glossary/")) {
        into.add(href.slice("/glossary/".length).replace(/[#?].*$/, ""));
      }
    }
    collectExistingGlossaryLinks(child, into);
  }
}

function walk(node: Root | Element, skipping: boolean, state: PassState) {
  const kids = node.children as ElementContent[];
  for (let i = 0; i < kids.length; i += 1) {
    if (state.count >= state.max) return;
    const child = kids[i];

    if (child.type === "text") {
      if (skipping) continue;
      const replacement = linkifyText(child.value, state);
      if (replacement) {
        kids.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
      continue;
    }

    if (isElement(child)) {
      walk(child, skipping || SKIP_TAGS.has(child.tagName), state);
    }
  }
}

/**
 * rehype plugin. Usage:
 *   rehypePlugins={[rehypeGlossaryLinks]}
 *   rehypePlugins={[[rehypeGlossaryLinks, { max: 3 }]]}
 *
 * State lives inside the transformer, so every render/parse starts from a
 * clean slate — the "first occurrence" and cap rules are per document.
 */
export function rehypeGlossaryLinks(options: { max?: number } = {}) {
  const max = Math.max(0, options.max ?? GLOSSARY_AUTOLINK_MAX);
  return (tree: Root) => {
    if (max === 0 || ALIASES.length === 0) return;
    const used = new Set<string>();
    collectExistingGlossaryLinks(tree, used);
    walk(tree, false, { used, count: 0, max });
  };
}
