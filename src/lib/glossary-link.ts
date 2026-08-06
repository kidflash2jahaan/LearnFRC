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
/*    • never inside a blockquote — on this site block quotes carry      */
/*      verbatim quotations and copy-paste templates (see SKIP_TAGS)     */
/*    • at most ONE auto-link per paragraph / list item / table cell,    */
/*      and never two closer together than MIN_GAP characters            */
/*    • hard cap of 4 auto-links per page                                */
/*    • whole-word matches only (no substrings, no fuzzy matching)       */
/*    • no slicing a longer name in half ("PID" out of "PID controller") */
/*    • skipped entirely if the author already linked that entry         */
/*    • switched off with <Markdown glossaryLinks={false} />             */
/*                                                                       */
/*  NOTE ON SELF-LINKING: a glossary term page cannot link to itself     */
/*  today because /glossary/[slug] renders its prose directly rather     */
/*  than through <Markdown>. If a term page ever adopts <Markdown>,      */
/*  pass glossaryLinks={false} — otherwise a term will link to itself.   */
/* ==================================================================== */

/** Marker class so the renderer can style auto-links more quietly than */
/** author-written links (and so QA can count them). */
export const GLOSSARY_AUTOLINK_CLASS = "glossary-autolink";

/**
 * Hard ceiling on auto-links per rendered page.
 *
 * Lowered from 6 after auditing the rendered HTML of all 480 lessons and
 * articles: the old ceiling was routinely spent inside a single sentence
 * (a bill-of-materials paragraph took all six), which read as link spam
 * and left the remaining 3,000 words with nothing. Four well-spaced links
 * is more than a reader ever follows.
 */
export const GLOSSARY_AUTOLINK_MAX = 4;

/**
 * Minimum characters of prose between two auto-links, measured in document
 * order across the whole article. Stops the linker from peppering one dense
 * paragraph just because that is where the jargon happens to cluster.
 */
const MIN_GAP = 400;

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
  // Measured false-positive rate of 33% across the live corpus: a third of
  // every "FIRST" match was the first word of a longer proper noun the
  // linker then cut in half — "FIRST Impact Award" (19), "FIRST Robotics
  // Competition" (12), "FIRST Dashboard" (4), "FIRST AGE", "FIRST Hall of
  // Fame", "FIRST Safety Manual". The set of FIRST-branded names is
  // open-ended, so no matching rule can be trusted here. The remaining
  // matches ("FIRST publishes…", "FIRST's median budget") are also the
  // lowest-information link on the page: every one of those pages already
  // links FRC, whose entry explains what FIRST is.
  "first",
  // "Champs" is genuine FRC slang for the FIRST Championship, but it is
  // also the tail of off-season event names — the corpus linked "Chezy
  // Champs" to the Championship twice, once in a sentence whose whole
  // point was that Chezy Champs is NOT it. The "FIRST Championship"
  // spelling still links, which is where the value was anyway.
  "champs",
]);

/**
 * Aliases whose lowercase form is also an ordinary English word. These stay
 * eligible (CAN bus is exactly the jargon a rookie needs) but get the extra
 * ENGLISH_FOLLOWERS check below.
 */
const AMBIGUOUS_ENGLISH = new Set(["can", "cots"]);

/**
 * A modal verb is followed by a bare infinitive. When an AMBIGUOUS_ENGLISH
 * alias is followed by one of these, it is being used as the English word,
 * not the FRC term — the live corpus linked "Leadership was redefined on
 * what CAN be done" (a quotation from another team's award essay) to the
 * CAN bus entry. The linker simply moves on to the next occurrence.
 */
const ENGLISH_FOLLOWERS = new Set([
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "not", "never", "only", "also", "still", "always", "already", "easily",
  "quickly", "really", "sometimes", "either", "both", "then",
  "help", "make", "take", "get", "give", "see", "go", "come", "keep",
  "put", "use", "find", "tell", "show", "write", "add", "happen",
  "cause", "affect", "become", "seem", "hold", "bring", "feel", "look",
  "mean", "need", "want", "learn", "teach", "save", "cost", "carry",
  "reach", "leave", "let", "ask", "expect", "afford", "handle",
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
  // Block quotes on this site are not decoration: they hold sample
  // sponsorship letters, sample press releases and Impact Award essays that
  // readers are told to copy, plus verbatim quotations of FIRST's own
  // wording. Auto-links inside them end up pasted into a letter to a
  // sponsor, or silently edit someone else's words.
  "blockquote",
  "q",
  "cite",
]);

/**
 * Block containers that get at most one auto-link each. A paragraph is the
 * unit a reader takes in at a glance, so this is what actually keeps prose
 * from looking peppered.
 */
const BLOCK_TAGS = new Set(["p", "li", "td", "dd", "dt", "summary", "caption"]);

type Alias = {
  /** Canonical spelling used for matching. */
  needle: string;
  /** Match respects letter case (acronym-bearing aliases do). */
  caseSensitive: boolean;
  /** Allow a single trailing "s" so "encoders" still links. */
  allowPlural: boolean;
  /** Doubles as an ordinary English word — needs the follower check. */
  englishWord: boolean;
  slug: string;
  term: string;
};

/** Two or more consecutive capitals ⇒ the alias carries an acronym. */
const ACRONYM_RUN = /[A-Z]{2,}/;
const WORDISH = /[A-Za-z0-9_-]/;
const ALIAS_SHAPE = /^[A-Za-z0-9][A-Za-z0-9 .'’-]*$/;

/**
 * Every multi-word glossary name, lowercased and bucketed by first word —
 * including names that are themselves denied, because a name we refuse to
 * link is still a name we refuse to cut in half. Used to reject "PID" when
 * the text actually reads "PID controller" or "PID control".
 */
const PHRASE_BY_HEAD = new Map<string, string[]>();

function recordPhrase(raw: string) {
  const name = raw.toLowerCase().replace(/\s+/g, " ").trim();
  const head = name.split(" ")[0];
  if (!head || head === name) return;
  const list = PHRASE_BY_HEAD.get(head);
  if (list) list.push(name);
  else PHRASE_BY_HEAD.set(head, [name]);
}

/** Does `text` read like the opening of a longer glossary name? */
function startsALongerName(text: string): boolean {
  const head = text.split(" ")[0];
  const list = PHRASE_BY_HEAD.get(head);
  return list ? list.some((name) => name.startsWith(text)) : false;
}

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
      // Only letters, digits, spaces and light punctuation — anything else
      // is a phrase we should not be pattern-matching in prose.
      if (!ALIAS_SHAPE.test(raw)) continue;
      // Recorded before the deny/length filters: a name we refuse to link is
      // still a name we refuse to slice.
      recordPhrase(raw);

      if (seen.has(lower)) continue;
      if (ALIAS_DENY.has(lower)) continue;

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
        englishWord: AMBIGUOUS_ENGLISH.has(lower),
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

/** The next word, only when it follows a single space — "" otherwise. */
function nextWord(value: string, end: number): string {
  const m = /^[  ]([A-Za-z][A-Za-z0-9'’-]*)/.exec(value.slice(end));
  return m ? m[1] : "";
}

/**
 * Reject a boundary-clean match that is still the wrong thing to link:
 * the head of a longer glossary name, or an English word wearing an
 * acronym's clothes.
 */
function acceptable(
  value: string,
  start: number,
  end: number,
  alias: Alias
): boolean {
  const next = nextWord(value, end);
  if (!next) return true;
  const combined = `${value.slice(start, end)} ${next}`.toLowerCase();
  if (startsALongerName(combined)) return false;
  if (alias.englishWord && ENGLISH_FOLLOWERS.has(next.toLowerCase())) {
    return false;
  }
  return true;
}

/**
 * First acceptable occurrence of `alias` at or after `from`. Rejected
 * positions are stepped over rather than aborting the search, so a term
 * that appears once in a bad context and once in a good one still links.
 */
function findMatch(
  value: string,
  lowered: string,
  alias: Alias,
  from: number
): { start: number; end: number } | null {
  const hay = alias.caseSensitive ? value : lowered;
  let i = from;
  for (;;) {
    i = hay.indexOf(alias.needle, i);
    if (i < 0) return null;
    let end = i + alias.needle.length;
    let ok = boundaryOk(value, i, end);
    if (
      !ok &&
      alias.allowPlural &&
      (value[end] === "s" || value[end] === "S") &&
      boundaryOk(value, i, end + 1)
    ) {
      end += 1;
      ok = true;
    }
    if (ok && acceptable(value, i, end, alias)) return { start: i, end };
    i += 1;
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
  /** Characters of document text walked so far (skipped subtrees included). */
  chars: number;
  /** Offset just past the most recent auto-link, for the MIN_GAP rule. */
  lastEnd: number;
  /** Whether the enclosing block element already has an auto-link. */
  blockUsed: boolean;
};

/**
 * Place at most one link in this text node. Returns `null` when nothing
 * matched so the caller can leave the node untouched. Always advances the
 * document character counter, matched or not.
 */
function linkifyText(value: string, state: PassState): ElementContent[] | null {
  const base = state.chars;
  state.chars += value.length;

  if (state.blockUsed || state.count >= state.max) return null;

  // Earliest index in this node that satisfies the spacing rule.
  const earliest = Math.max(0, state.lastEnd + MIN_GAP - base);
  if (earliest >= value.length) return null;

  const lowered = value.toLowerCase();
  let best: { alias: Alias; start: number; end: number } | null = null;
  for (const alias of ALIASES) {
    if (state.used.has(alias.slug)) continue;
    const m = findMatch(value, lowered, alias, earliest);
    if (!m) continue;
    const better =
      !best ||
      m.start < best.start ||
      (m.start === best.start && m.end - m.start > best.end - best.start);
    if (better) best = { alias, start: m.start, end: m.end };
  }
  if (!best) return null;

  const out: ElementContent[] = [];
  if (best.start > 0) out.push({ type: "text", value: value.slice(0, best.start) });
  out.push(anchor(best.alias, value.slice(best.start, best.end)));
  if (best.end < value.length) {
    out.push({ type: "text", value: value.slice(best.end) });
  }

  state.used.add(best.alias.slug);
  state.count += 1;
  state.blockUsed = true;
  state.lastEnd = base + best.end;
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
    const child = kids[i];

    if (child.type === "text") {
      // Skipped text still separates prose, so it still counts toward MIN_GAP.
      if (skipping || state.count >= state.max) {
        state.chars += child.value.length;
        continue;
      }
      const replacement = linkifyText(child.value, state);
      if (replacement) {
        kids.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
      continue;
    }

    if (isElement(child)) {
      const isBlock = BLOCK_TAGS.has(child.tagName);
      const outer = state.blockUsed;
      if (isBlock) state.blockUsed = false;
      walk(child, skipping || SKIP_TAGS.has(child.tagName), state);
      if (isBlock) state.blockUsed = outer;
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
    walk(tree, false, {
      used,
      count: 0,
      max,
      chars: 0,
      lastEnd: -MIN_GAP,
      blockUsed: false,
    });
  };
}
