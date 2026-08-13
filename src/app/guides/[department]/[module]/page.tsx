import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  ListTree,
  Sparkles,
  SquareStack,
  Tag,
} from "lucide-react";
import {
  getAllDepartmentSlugs,
  getArticles,
  getDepartmentBySlug,
} from "@/lib/queries";
import type { DeptWithModules, ModuleRow } from "@/lib/queries";
import { deptMeta, inkFor } from "@/lib/departments";
import {
  GLOSSARY,
  glossarySlug,
  hasGlossaryDepth,
  type GlossaryTerm,
} from "@/lib/glossary-data";
import { Icon } from "@/lib/icon-map";
import { JsonLd } from "@/components/json-ld";
import {
  Rise,
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

/**
 * The module hub — /guides/<department>/<module>.
 *
 * Every lesson URL already contains this path segment, but the segment itself
 * had no page, so walking a lesson URL upward hit a 404 and ~100 real, linkable
 * levels of the catalog simply did not exist. This route makes each module a
 * first-class page: the module's own overview, its lessons as real
 * server-rendered links with summaries, sibling-module navigation, and the way
 * back up to the department.
 *
 * ── Why this page carries more than a lesson list ─────────────────────────
 * Measured against the rendered DOM of all 101 hubs and their 11 parents:
 * 42% of each hub's paragraph-length prose was present VERBATIM on its parent
 * department page (the accordion there renders every module's overview and
 * every lesson title), and one hub — electrical-wiring/motor-controllers-can-bus
 * — had literally zero paragraph-length prose the parent didn't already show.
 * A hub whose entire body is a subset of its parent is the textbook
 * thin/duplicative pattern, and shipping 101 of those in a day to a two-month
 * old domain is how a site teaches Google to distrust a whole path prefix.
 *
 * So each hub now also carries three things the department page structurally
 * does not have, all derived from real data and all rendered only when the
 * data actually supports them (no filler, no invented copy):
 *
 *   1. a per-module orientation paragraph (position, neighbours, real reading
 *      weight) built from facts that differ module to module,
 *   2. the FRC glossary terms this module's own text actually uses, with real
 *      definitions and links to the term pages,
 *   3. the same-named module in other departments — the single most useful
 *      disambiguation on a site with eight modules called "Worked Examples &
 *      Mini-Projects" — plus the blog articles that genuinely cover the topic.
 *
 * Fully static/ISR like its neighbours — the content is identical for everyone
 * and for crawlers, so there is no per-user state here at all (progress rings
 * live on the department and lesson pages, which already hydrate them).
 */
export const revalidate = 86400; // daily background ISR floor; content edits push live via /api/revalidate
export const dynamicParams = true; // unknown module slugs still render on-demand → notFound

export async function generateStaticParams() {
  const slugs = await getAllDepartmentSlugs();
  const out: { department: string; module: string }[] = [];
  for (const department of slugs) {
    const dept = await getDepartmentBySlug(department);
    if (!dept) continue;
    for (const m of dept.modules) out.push({ department, module: m.slug });
  }
  return out;
}

// ─── SEO derivation ────────────────────────────────────────────────────────
// A bare module title ("Worked Examples & Mini-Projects", "Prerequisites") can
// not match any real search, exactly like the bare lesson titles the lesson
// route already qualifies. Titles and descriptions here are DERIVED from the
// module + department rows — nothing is hardcoded per module.

/** Short topic qualifier per department, used to build query-shaped titles. */
const DEPT_KEYWORD: Record<string, string> = {
  "getting-started": "Rookie Guide",
  "mechanical-build": "Mechanical",
  "programming-software": "Programming",
  "electrical-wiring": "Electrical",
  "cad-design": "CAD",
  "scouting-strategy": "Scouting",
  "drive-team": "Drive Team",
  "business-operations": "Team Business",
  "media-outreach": "Media & Outreach",
  "impact-award": "Impact Award",
  safety: "Safety",
};

const TITLE_MAX = 62;
const DESC_MIN = 145;
const DESC_MAX = 160;

const squash = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** Split prose into sentences without cutting on "e.g." / decimals / "FLL, FTC." */
function sentencesOf(s?: string | null): string[] {
  return squash(s)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .filter(Boolean);
}

/** Trim to `max` chars on a word boundary, no ellipsis (titles must read clean). */
function clampWords(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/[\s,;:—-]+\S*$/, "").trim();
}

/**
 * The lead noun of a department qualifier ("Safety", "Scouting", "Drive"),
 * used to stop a title stuttering it back at us.
 */
const kwHead = (kw: string) => kw.split(/[\s&]+/)[0];

/**
 * "FRC Safety: Safety Worked Examples & Mini-Projects" is the shape a naive
 * prefix produces when the module title already carries the department word.
 * Drop the leading repeat — but only when what's left is still a real phrase,
 * so "Scouting Fundamentals" never degrades to "Fundamentals".
 */
function dedupeDeptWord(title: string, kw?: string): string {
  if (!kw) return title;
  const re = new RegExp(`^${kwHead(kw)}\\s+`, "i");
  if (!re.test(title)) return title;
  const rest = title.replace(re, "").trim();
  return rest.split(/\s+/).length >= 3 ? rest : title;
}

/** The half of "Foundations: Tools, Languages, and Your First Robot Program"
    that actually names the subject. */
function specificHalf(title: string): string {
  const i = title.indexOf(":");
  if (i <= 0) return title;
  const tail = title.slice(i + 1).trim();
  return tail.split(/\s+/).length >= 3 ? tail : title;
}

/**
 * "FRC CAD: Worked Examples & Mini-Projects — 4 Lessons" — the longest variant
 * that still fits a ~60-char title tag, falling back to progressively shorter
 * shapes so long module titles degrade instead of getting truncated by Google.
 *
 * Two rules the earlier version got wrong, both measured across all 101 hubs:
 *   • six titles fell off the end of the ladder and shipped the bare module
 *     title — no "FRC", no department, two of them over 62 chars ("Advanced
 *     Techniques & Case Studies: Building a Hall-of-Fame-Caliber Program", 75).
 *     A module hub that doesn't say which department it belongs to is exactly
 *     the title that can't be told apart from the other seven modules with the
 *     same name. Every rung now carries "FRC <department>", and the last rung
 *     clamps the subject instead of dropping the qualifier.
 *   • twelve stuttered the department word back ("FRC Safety: Safety Worked
 *     Examples & Mini-Projects"). Leading repeats are dropped first.
 */
function moduleTitleTag(title: string, kw: string | undefined, n: number): string {
  const plural = n === 1 ? "Lesson" : "Lessons";
  if (!kw) {
    return (
      [`${title} — ${n} FRC ${plural}`, `${title} — FRC`].find(
        (c) => c.length <= TITLE_MAX
      ) ?? `${clampWords(title, TITLE_MAX - 6)} — FRC`
    );
  }
  const base = dedupeDeptWord(title, kw);
  const spec = specificHalf(base);
  const candidates = base.includes(":")
    ? [
        // A title that already contains a colon gets the qualifier as a suffix,
        // so we never emit an unreadable "FRC X: Y: Z"…
        `${base} — ${n} FRC ${kw} ${plural}`,
        `${base} — FRC ${kw}`,
        // …unless it's too long to keep whole, at which point the half after
        // the colon is the part that names the subject.
        `FRC ${kw}: ${spec} — ${n} ${plural}`,
        `FRC ${kw}: ${spec}`,
      ]
    : [
        `FRC ${kw}: ${base} — ${n} ${plural}`,
        `FRC ${kw}: ${base}`,
        `${base} — FRC ${kw}`,
      ];
  const fit = candidates.find((c) => c.length <= TITLE_MAX);
  if (fit) return fit;
  // Guaranteed last rung: department-qualified, always within budget.
  const prefix = `FRC ${kw}: `;
  return prefix + clampWords(spec, TITLE_MAX - prefix.length);
}

/**
 * A 145–160 char snippet built from the module's real overview, topped up with
 * the actual lesson titles it contains (which is what a searcher wants to see)
 * rather than boilerplate.
 *
 * The top-up used to be one of three stock sentences ("N free lessons, no
 * signup needed.") and 47 of 101 descriptions ended in one of them — the exact
 * repeated tail that makes a batch of pages look machine-stamped. It is now a
 * fact line whose numbers move per module (lesson count, real reading time,
 * department), so the padding is at least information.
 */
function moduleDescription({
  overview,
  title,
  deptName,
  lessonTitles,
  minutes,
}: {
  overview?: string | null;
  title: string;
  deptName: string;
  lessonTitles: string[];
  minutes: number;
}): string {
  const n = lessonTitles.length;
  const plural = n === 1 ? "lesson" : "lessons";

  // 1 — the lead: as many whole overview sentences as fit.
  const sents = sentencesOf(overview);
  let lead = "";
  let i = 0;
  for (; i < sents.length; i++) {
    if (lead.length >= DESC_MIN) break;
    const next = lead ? `${lead} ${sents[i]}` : sents[i];
    if (next.length > DESC_MAX) break;
    lead = next;
  }
  if (!lead) {
    // A single overview sentence longer than the whole snippet budget: trim it
    // at a word boundary rather than dropping the module's real prose.
    const ov = squash(overview);
    lead = ov
      ? `${clampWords(ov, DESC_MAX - 1)}…`
      : `${title} — ${n} free FRC ${plural} in the LearnFRC ${deptName} guide.`;
  } else if (lead.length < 70 && i < sents.length) {
    // "Start here." is a legal sentence and a useless snippet. When the lead is
    // this short only because the NEXT sentence wouldn't fit whole, take a
    // clamped piece of it instead of padding with lesson titles.
    const frag = clampWords(sents[i], DESC_MAX - lead.length - 2);
    if (frag.split(/\s+/).length >= 5) lead = `${lead} ${frag}…`;
  }
  if (lead.length >= DESC_MIN) return lead;

  // 2 — top up. Each tail reserves its own room so the "Covers …" list is sized
  // around it rather than crowding it out and forcing the shortest filler.
  const tails =
    minutes > 0
      ? [
          `${n} free ${plural}, ~${minutes} min of reading in the LearnFRC ${deptName} guide.`,
          `${n} free ${plural}, ~${minutes} min of reading, no signup needed.`,
          `${n} free ${plural}, ~${minutes} min of reading.`,
          `${n} free ${plural}, ~${minutes} min.`,
          "",
        ]
      : [
          `${n} free ${plural} in the LearnFRC ${deptName} guide.`,
          `${n} free FRC ${plural}.`,
          "",
        ];

  let best = lead;
  for (const tail of tails) {
    const room = DESC_MAX - lead.length - (tail ? tail.length + 1 : 0) - 1;
    let covers = "";
    for (const t of lessonTitles) {
      const next = covers ? `${covers}, ${t}` : `Covers ${t}`;
      if (next.length + 1 > room) break;
      covers = next;
    }
    const out = [lead, covers ? `${covers}.` : "", tail].filter(Boolean).join(" ");
    if (out.length > DESC_MAX) continue;
    if (out.length >= DESC_MIN) return out;
    if (out.length > best.length) best = out;
  }

  return best;
}

/** Shared lookup for both generateMetadata and the page render. */
function findModule(dept: DeptWithModules | null, moduleSlug: string) {
  if (!dept) return null;
  const index = dept.modules.findIndex((m) => m.slug === moduleSlug);
  if (index === -1) return null;
  return { mod: dept.modules[index], index };
}

/** Department-page numbering: prerequisite modules read "Start here", rest 1..N. */
function moduleLabels(modules: ModuleRow[]): string[] {
  let regular = 0;
  return modules.map((m) => (m.is_prerequisite ? "Start here" : String(++regular)));
}

const moduleMinutes = (m: ModuleRow) =>
  (m.lessons ?? []).reduce((s, l) => s + (l.estimated_minutes ?? 0), 0);

// ─── Orientation prose ─────────────────────────────────────────────────────

/**
 * "Where this module sits" — the one paragraph the department page cannot
 * carry, because it only makes sense from inside a single module. Every clause
 * is a fact read off the catalog (position, neighbours, this module's share of
 * the department's reading time), and which clauses appear depends on the
 * module's own shape, so the 101 hubs don't all end up with one stamped
 * sentence. Verified after the fact: mean 8-gram overlap between any two hubs
 * stays in single digits.
 */
function moduleFit({
  title,
  label,
  isPre,
  count,
  prev,
  next,
  deptName,
  lessons,
  minutes,
  deptMinutes,
  isLongest,
}: {
  title: string;
  label: string;
  isPre: boolean;
  count: number;
  prev: ModuleRow | null;
  next: ModuleRow | null;
  deptName: string;
  lessons: number;
  minutes: number;
  deptMinutes: number;
  isLongest: boolean;
}): string {
  const plural = lessons === 1 ? "lesson" : "lessons";

  const where = isPre
    ? `${title} is the prerequisite module of the ${deptName} guide: the ground the ${count - 1} numbered modules after it assume you already have`
    : !prev
      ? `${title} opens the ${deptName} guide`
      : !next
        ? `${title} closes the ${deptName} guide as module ${label} of ${count}`
        : `${title} is module ${label} of ${count} in the ${deptName} guide`;

  const neighbours =
    prev && next
      ? `. It picks up where ${prev.title} left off and hands over to ${next.title}.`
      : next
        ? `, and ${next.title} follows it.`
        : prev
          ? `, after ${prev.title}.`
          : ".";

  const hours = Math.max(1, Math.round(deptMinutes / 60));
  const scale =
    minutes <= 0
      ? ` It holds ${lessons} of the guide's ${plural}.`
      : isLongest && count > 1
        ? ` At ~${minutes} minutes across ${lessons} ${plural} it is the longest module in the guide, which runs about ${hours} hours end to end.`
        : ` Its ${lessons} ${plural} are about ${minutes} minutes of the guide's ~${hours} hours.`;

  return `${where}${neighbours}${scale}`;
}

// ─── Catalog-wide indexes (cached once per revalidation window) ─────────────

type ModuleRef = {
  dept: string;
  deptName: string;
  slug: string;
  title: string;
  lessons: number;
  minutes: number;
};

/**
 * Every module in the catalog, slim. Cached as one entry so a hub render costs
 * a single small cache read rather than eleven department fetches — the
 * department query underneath is itself cached, but the aggregate is what all
 * 101 pages actually want.
 */
const moduleIndex = unstable_cache(
  async (): Promise<ModuleRef[]> => {
    const slugs = await getAllDepartmentSlugs();
    const depts = await Promise.all(slugs.map((s) => getDepartmentBySlug(s)));
    const out: ModuleRef[] = [];
    for (const d of depts) {
      if (!d) continue;
      for (const m of d.modules) {
        out.push({
          dept: d.slug,
          deptName: d.name,
          slug: m.slug,
          title: m.title,
          lessons: (m.lessons ?? []).length,
          minutes: moduleMinutes(m),
        });
      }
    }
    return out;
  },
  ["module-hub-module-index-v1"],
  { revalidate: 86400, tags: ["catalog", "departments"] }
);

type ArticleRef = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  readMins: number;
};

/** Articles without their markdown bodies — the hub only ever links to them. */
const articleIndex = unstable_cache(
  async (): Promise<ArticleRef[]> =>
    (await getArticles()).map((a) => ({
      slug: a.slug,
      title: a.title,
      description: a.description,
      keywords: a.keywords ?? [],
      readMins: a.readMins,
    })),
  ["module-hub-article-index-v1"],
  { revalidate: 86400, tags: ["catalog", "articles"] }
);

// ─── Same-named modules in other departments ───────────────────────────────

const twinNorm = (title: string, kw?: string) => {
  let s = title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (kw) s = s.replace(new RegExp(`\\b${kwHead(kw).toLowerCase()}\\b`, "g"), "");
  return s.replace(/\s+/g, " ").trim();
};

/**
 * The disambiguation block. Eight departments have a module called "Worked
 * Examples & Mini-Projects", eight have "Common Mistakes & Troubleshooting",
 * seven have "Advanced Techniques & Case Studies" — 23 of the 101 hubs share
 * a name with at least one sibling elsewhere in the catalog, which is the
 * single most legible reason a crawler (or a reader landing from search) would
 * read these pages as near-duplicates of each other.
 *
 * Matching is exact-on-normalised-title (with the department word stripped, so
 * "Safety Worked Examples & Mini-Projects" joins its cluster) plus containment
 * for the couple of titles that append a department phrase. No fuzzy
 * similarity: a wrong "related" link on a page whose whole problem is looking
 * auto-generated makes the problem worse, so an empty section is the correct
 * output when nothing genuinely matches.
 */
function titleTwins(self: ModuleRef, index: ModuleRef[]): ModuleRef[] {
  const mine = twinNorm(self.title, DEPT_KEYWORD[self.dept]);
  if (mine.split(" ").length < 3) return [];
  return index
    .filter((o) => {
      if (o.dept === self.dept) return false;
      const theirs = twinNorm(o.title, DEPT_KEYWORD[o.dept]);
      if (theirs.split(" ").length < 3) return false;
      return theirs === mine || theirs.includes(mine) || mine.includes(theirs);
    })
    .sort((a, b) => a.deptName.localeCompare(b.deptName));
}

// ─── Glossary terms this module actually uses ──────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-token match, so "PID" never fires inside "rapid". */
const looseRe = (p: string) => new RegExp(`(^|[^A-Za-z0-9])${escapeRe(p)}([^A-Za-z0-9]|$)`, "i");
/** Case-SENSITIVE for abbreviations, so the English word "can" is not "CAN". */
const strictRe = (p: string) => new RegExp(`(^|[^A-Za-z0-9])${escapeRe(p)}([^A-Za-z0-9]|$)`);
const isAbbrLike = (s: string) => /^[A-Z0-9][A-Z0-9-]{1,5}$/.test(s);

/**
 * Terms that are real glossary entries but so universal in FRC writing that
 * matching them says nothing about a module — "FIRST Robotics Competition"
 * fired on 47 of 101 hubs before this list existed.
 */
const TERM_DENY = new Set([
  "FIRST",
  "FIRST Robotics Competition",
  "FIRST Tech Challenge",
  "FIRST LEGO League",
  "Rookie Team",
]);

const TERM_MAX = 5;

/**
 * The glossary entries this module's own text genuinely uses, scored against
 * the module title, its lesson titles, its overview and its lesson summaries.
 * A hit in a title/overview is "strong" and can stand alone; summary-only hits
 * have to accumulate. Returns [] for the ~a third of modules whose subject the
 * glossary simply doesn't cover (team business, brand identity), which is the
 * honest answer — a wrong definition is worse than no section.
 */
function moduleTerms(text: {
  title: string;
  lessonTitles: string;
  overview: string;
  summaries: string;
}): GlossaryTerm[] {
  const scored: { t: GlossaryTerm; score: number }[] = [];
  for (const t of GLOSSARY) {
    if (TERM_DENY.has(t.term) || !hasGlossaryDepth(t)) continue;
    const names = [
      t.term,
      ...(t.abbr && t.abbr !== t.term ? [t.abbr] : []),
      ...(t.alsoCalled ?? []),
    ].filter((n) => n && n.length >= 3);
    let strong = 0;
    let weak = 0;
    for (const n of names) {
      const re = isAbbrLike(n) ? strictRe(n) : looseRe(n);
      const w = n.includes(" ") ? 1.6 : 1;
      if (re.test(text.title)) strong += 10 * w;
      if (re.test(text.lessonTitles)) strong += 6 * w;
      if (re.test(text.overview)) strong += 5 * w;
      if (re.test(text.summaries)) weak += 3 * w;
    }
    const score = strong + weak;
    if (strong >= 5 || score >= 9) scored.push({ t, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.t.term.localeCompare(b.t.term))
    .slice(0, TERM_MAX)
    .map((x) => x.t);
}

/** First sentence of a definition, clamped — the term page holds the rest. */
function shortDefinition(def: string): string {
  const first = sentencesOf(def)[0] ?? squash(def);
  if (first.length <= 165) return first;
  return `${first.slice(0, 164).replace(/[\s,;:—-]+\S*$/, "")}…`;
}

// ─── Articles that genuinely cover this module ─────────────────────────────

const STOP = new Set(
  "the and that with your this what how why when guide free lesson lessons module modules team teams robot robots frc first used using other into over each from for are was has have not but can they them will more most make made take does done very just also than then here there about their were which while".split(
    " "
  )
);
const tokens = (s: string) =>
  new Set(
    (s || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
const overlap = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};

const ARTICLE_MAX = 2;

/**
 * Up to two blog articles that really are about this module's subject.
 * Deliberately strict — cosine over the article's title+description+keywords
 * against the module's whole text, AND a floor on how much of the article's
 * own keyword set is hit, so "Common Mistakes & Troubleshooting" in the Impact
 * Award department stops matching the CAN-bus article. About a third of
 * modules get nothing, and render nothing.
 */
function moduleArticles(moduleText: string, articles: ArticleRef[]): ArticleRef[] {
  const mod = tokens(moduleText);
  const out: { a: ArticleRef; cos: number }[] = [];
  for (const a of articles) {
    const all = tokens(`${a.title} ${a.description} ${a.keywords.join(" ")}`);
    const kw = tokens(`${a.keywords.join(" ")} ${a.title}`);
    const inter = overlap(all, mod);
    const kwHit = overlap(kw, mod);
    const cos = inter / Math.sqrt((all.size || 1) * (mod.size || 1));
    if (inter >= 6 && kwHit >= 3 && cos >= 0.14) out.push({ a, cos });
  }
  return out
    .sort((x, y) => y.cos - x.cos || x.a.slug.localeCompare(y.a.slug))
    .slice(0, ARTICLE_MAX)
    .map((x) => x.a);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string; module: string }>;
}): Promise<Metadata> {
  const { department, module: moduleSlug } = await params;
  const dept = await getDepartmentBySlug(department).catch(() => null);
  const found = findModule(dept, moduleSlug);
  if (!dept || !found) return { title: "Module" };

  const { mod } = found;
  const lessons = mod.lessons ?? [];
  const url = `${SITE}/guides/${department}/${moduleSlug}`;
  const ogImage = `${SITE}/guides/${department}/opengraph-image`;
  const title = moduleTitleTag(mod.title, DEPT_KEYWORD[department], lessons.length);
  const description = moduleDescription({
    overview: mod.overview,
    title: mod.title,
    deptName: dept.name,
    lessonTitles: lessons.map((l) => l.title),
    minutes: moduleMinutes(mod),
  });

  return {
    // The root template appends " · LearnFRC"; these are already full-length
    // title tags, so emit them as-is (same posture as the department route).
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    // A module with no published lessons has nothing on it that isn't already
    // on the department page — it is a routing stub, not a page. None exist
    // today (all 101 modules have 3+ published lessons); this keeps one from
    // silently entering the index if the catalog ever ships an empty module.
    ...(lessons.length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ department: string; module: string }>;
}) {
  const { department, module: moduleSlug } = await params;
  const dept = await getDepartmentBySlug(department);
  if (!dept) notFound();
  const found = findModule(dept, moduleSlug);
  if (!found) notFound();

  const { mod, index } = found;
  const modules = dept.modules;
  const lessons = mod.lessons ?? [];
  const labels = moduleLabels(modules);
  const label = labels[index];
  const isPre = !!mod.is_prerequisite;

  const prev = index > 0 ? modules[index - 1] : null;
  const next = index < modules.length - 1 ? modules[index + 1] : null;

  const meta = deptMeta(dept.slug);
  const accent = meta.color;
  const ink = inkFor(accent);
  const accentStyle = { "--a": accent } as CSSProperties;

  const modulePath = `/guides/${dept.slug}/${mod.slug}`;
  const lessonHref = (slug: string) => `${modulePath}/${slug}`;
  const totalMinutes = moduleMinutes(mod);
  const deptLessonTotal = modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0);
  const deptMinutes = modules.reduce((s, m) => s + moduleMinutes(m), 0);
  const isLongest =
    totalMinutes > 0 && totalMinutes === Math.max(...modules.map(moduleMinutes));

  // Intro prose: the module's own overview when it has one, otherwise a factual
  // sentence derived from where this module sits in the department.
  const overview =
    squash(mod.overview) ||
    `${mod.title} is ${isPre ? "the recommended starting point" : `module ${label}`} of ${modules.length} in the LearnFRC ${dept.name} guide: ${lessons.length} free ${lessons.length === 1 ? "lesson" : "lessons"} you can read in any order.`;

  const fit = moduleFit({
    title: mod.title,
    label,
    isPre,
    count: modules.length,
    prev,
    next,
    deptName: dept.name,
    lessons: lessons.length,
    minutes: totalMinutes,
    deptMinutes,
    isLongest,
  });

  const lessonTitles = lessons.map((l) => l.title).join(" · ");
  const summaries = lessons.map((l) => l.summary ?? "").join(" ");
  const terms = moduleTerms({
    title: mod.title,
    lessonTitles,
    overview: squash(mod.overview),
    summaries,
  });

  const [index_, articles] = await Promise.all([moduleIndex(), articleIndex()]);
  const self: ModuleRef = {
    dept: dept.slug,
    deptName: dept.name,
    slug: mod.slug,
    title: mod.title,
    lessons: lessons.length,
    minutes: totalMinutes,
  };
  const twins = titleTwins(self, index_);
  const related = moduleArticles(
    `${mod.title} ${squash(mod.overview)} ${lessonTitles} ${summaries}`,
    articles
  );

  return (
    <div className="relative overflow-x-clip">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE}/guides` },
            {
              "@type": "ListItem",
              position: 3,
              name: dept.name,
              item: `${SITE}/guides/${dept.slug}`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: mod.title,
              item: `${SITE}${modulePath}`,
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${mod.title} — ${dept.name} lessons`,
          description: squash(mod.overview) || undefined,
          url: `${SITE}${modulePath}`,
          numberOfItems: lessons.length,
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          itemListElement: lessons.map((l, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: l.title,
            url: `${SITE}${lessonHref(l.slug)}`,
            item: {
              "@type": "LearningResource",
              name: l.title,
              description: l.summary ?? undefined,
              url: `${SITE}${lessonHref(l.slug)}`,
              learningResourceType: "lesson",
              inLanguage: "en",
              isAccessibleForFree: true,
              ...(l.estimated_minutes
                ? { timeRequired: `PT${l.estimated_minutes}M` }
                : {}),
              isPartOf: {
                "@type": "Course",
                name: dept.name,
                url: `${SITE}/guides/${dept.slug}`,
              },
            },
          })),
        }}
      />

      <Glow
        blobs={[
          { size: "620px", pos: { left: "-160px", top: "-230px" }, color: accent, opacity: 0.38 },
          { size: "540px", pos: { right: "-140px", top: "-90px" }, color: "#6ff0ea", opacity: 0.36, delay: 1.8 },
          { size: "500px", pos: { left: "30%", top: "620px" }, color: "#c8b6ff", opacity: 0.28, delay: 3.6 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-5xl px-4 pb-6 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Rise>
          {/* -my-2 + min-h-11: the crumbs are 20px of text, which is a 20px tap
              target on a phone. The negative margin absorbs the padding so the
              row still looks like a breadcrumb. */}
          <nav
            className="-my-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <Link
              href="/guides"
              className="inline-flex min-h-11 items-center py-2 transition-colors hover:text-primary"
            >
              Guides
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
            <Link
              href={`/guides/${dept.slug}`}
              className="inline-flex min-h-11 items-center py-2 transition-colors hover:text-primary"
            >
              {dept.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
            <span className="font-medium text-foreground">{mod.title}</span>
          </nav>
        </Rise>

        <RiseGroup className="mt-6">
          <RiseItem>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={`/guides/${dept.slug}`}
                className="ac-chip inline-flex min-h-11 items-center gap-2 !py-1 !pl-1.5 !pr-3.5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                style={accentStyle}
              >
                <span
                  className="ac-badge flex h-7 w-7 items-center justify-center rounded-full"
                  style={accentStyle}
                >
                  <Icon name={meta.icon} className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{dept.name}</span>
              </Link>
              <span className="ac-chip inline-flex items-center gap-1.5 text-xs">
                {isPre ? (
                  <Sparkles className="h-3.5 w-3.5" style={{ color: ink }} aria-hidden />
                ) : (
                  <Layers className="h-3.5 w-3.5" style={{ color: ink }} aria-hidden />
                )}
                <span className="font-medium">
                  {isPre
                    ? "Start here · Prerequisite module"
                    : `Module ${label} of ${modules.length}`}
                </span>
              </span>
            </div>
          </RiseItem>

          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-3xl font-extrabold leading-[1.06] tracking-tight sm:text-4xl lg:text-[2.9rem]">
              <span
                style={{
                  background: `linear-gradient(120deg, ${ink}, var(--accent))`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {mod.title}
              </span>
            </h1>
          </RiseItem>

          <RiseItem>
            <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/75">
              {overview}
            </p>
          </RiseItem>

          {/* The orientation paragraph — the part of this page that only makes
              sense from inside the module, and the reason it isn't a subset of
              the department page. */}
          <RiseItem>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              {fit}
            </p>
          </RiseItem>

          <RiseItem>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="ac-chip inline-flex items-center gap-1.5 text-sm">
                <BookOpen className="h-4 w-4" style={{ color: ink }} aria-hidden />
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </span>
              {totalMinutes > 0 && (
                <span className="ac-chip inline-flex items-center gap-1.5 text-sm">
                  <Clock className="h-4 w-4" style={{ color: ink }} aria-hidden />~
                  {totalMinutes} min
                </span>
              )}
              <span className="ac-chip inline-flex items-center gap-1.5 text-sm">
                <Layers className="h-4 w-4" style={{ color: ink }} aria-hidden />
                {deptLessonTotal} lessons in this guide
              </span>
            </div>
          </RiseItem>

          {lessons.length > 0 && (
            <RiseItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={lessonHref(lessons[0].slug)} className="ac-btn text-sm">
                  Start with {lessons.length === 1 ? "this lesson" : "lesson 1"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href={`/guides/${dept.slug}`} className="ac-btn-ghost text-sm">
                  All of {dept.name}
                </Link>
              </div>
            </RiseItem>
          )}
        </RiseGroup>
      </section>

      {/* ========================== THE LESSONS ========================= */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Reveal className="mb-5 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: ink,
              }}
            >
              <ListTree className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="ac-eyebrow">In this module</p>
              <h2 className="mt-0.5 font-display text-2xl font-bold">
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </h2>
            </div>
          </div>
        </Reveal>

        {lessons.length > 0 ? (
          <RevealGroup className="space-y-3">
            {lessons.map((l, i) => (
              <RevealItem key={l.id}>
                <Hover className="h-full" lift={-3}>
                  <Link
                    href={lessonHref(l.slug)}
                    className="ac-card group flex items-start gap-4 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border font-display text-sm font-semibold tabular-nums transition-transform duration-300 group-hover:scale-105"
                      style={{
                        color: ink,
                        borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[17px] font-bold leading-snug tracking-tight text-foreground group-hover:text-primary">
                        {l.title}
                      </span>
                      {l.summary && (
                        <span className="mt-1.5 block text-pretty text-sm leading-relaxed text-muted-foreground">
                          {l.summary}
                        </span>
                      )}
                      {l.estimated_minutes ? (
                        <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden />
                          <span className="tabular-nums">{l.estimated_minutes}</span> min
                          read
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight
                      className="mt-1 hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block"
                      aria-hidden
                    />
                  </Link>
                </Hover>
              </RevealItem>
            ))}
          </RevealGroup>
        ) : (
          <Reveal>
            <p className="ac-card p-5 text-sm text-muted-foreground">
              This module doesn&apos;t have published lessons yet.{" "}
              <Link href={`/guides/${dept.slug}`} className="underline hover:text-primary">
                Browse the rest of {dept.name}
              </Link>
              .
            </p>
          </Reveal>
        )}

        {/* prev / next module */}
        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
          <RevealItem>
            <Hover className="h-full" lift={-3}>
              <Link
                href={prev ? `/guides/${dept.slug}/${prev.slug}` : `/guides/${dept.slug}`}
                className="ac-card group flex h-full items-center gap-3 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                  <ArrowLeft
                    className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <small className="ac-eyebrow block">
                    {prev ? "Previous module" : "Department"}
                  </small>
                  <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                    {prev ? prev.title : dept.name}
                  </span>
                </span>
              </Link>
            </Hover>
          </RevealItem>
          <RevealItem>
            <Hover className="h-full" lift={-3}>
              <Link
                href={next ? `/guides/${dept.slug}/${next.slug}` : `/guides/${dept.slug}`}
                className="ac-card group flex h-full flex-row-reverse items-center gap-3 p-5 text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <small className="ac-eyebrow block">
                    {next ? "Next module" : "Finish"}
                  </small>
                  <span className="line-clamp-1 font-display font-semibold group-hover:text-primary">
                    {next ? next.title : `Back to ${dept.name}`}
                  </span>
                </span>
              </Link>
            </Hover>
          </RevealItem>
        </RevealGroup>
      </section>

      {/* ======================= TERMS IN THIS MODULE ==================== */}
      {terms.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="ac-card p-6" style={accentStyle}>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    color: ink,
                  }}
                >
                  <Tag className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="ac-eyebrow">Jargon check</p>
                  <h2 className="mt-0.5 text-balance font-display text-xl font-bold">
                    FRC terms used in {mod.title}
                  </h2>
                </div>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {terms.map((t) => (
                  <li key={t.term}>
                    <Link
                      href={`/glossary/${glossarySlug(t.term)}`}
                      className="flex h-full min-h-11 flex-col justify-center rounded-xl px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="font-display text-[15px] font-semibold text-foreground">
                        {t.term}
                        {/* Only when the abbreviation adds something — "CAN bus"
                            already contains "CAN" — and always with a real space
                            in the text node, not just a CSS margin. */}
                        {t.abbr && !looseRe(t.abbr).test(t.term) ? (
                          <>
                            {" "}
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t.abbr}
                            </span>
                          </>
                        ) : null}
                      </span>
                      <span className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                        {shortDefinition(t.definition)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>
      )}

      {/* ============ SAME MODULE NAME IN OTHER DEPARTMENTS ============= */}
      {twins.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="ac-card p-6">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    color: ink,
                  }}
                >
                  <SquareStack className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="ac-eyebrow">Not the one you wanted?</p>
                  {/* Deliberately does not quote this module's own title: a
                      few of these clusters are near-matches ("Common Safety
                      Mistakes & Troubleshooting" vs "Common Mistakes &
                      Troubleshooting"), and claiming the others carry this
                      exact name would be wrong. */}
                  <h2 className="mt-0.5 text-balance font-display text-xl font-bold">
                    {twins.length === 1
                      ? "One other department uses this module name"
                      : `${twins.length} other departments use this module name`}
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                This is the {dept.name} one: {lessons.length}{" "}
                {lessons.length === 1 ? "lesson" : "lessons"}
                {totalMinutes > 0 ? `, about ${totalMinutes} minutes` : ""}. The{" "}
                {twins.length === 1 ? "department" : "departments"} below run a module by the same
                name over completely different material.
              </p>
              <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {twins.map((t) => (
                  <li key={`${t.dept}/${t.slug}`} className="min-w-0">
                    <Link
                      href={`/guides/${t.dept}/${t.slug}`}
                      className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{t.deptName}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {t.lessons}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>
      )}

      {/* ===================== RELATED LONGER READS ===================== */}
      {related.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
          <Reveal className="mb-4 flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: ink,
              }}
            >
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="ac-eyebrow">Longer reads</p>
              <h2 className="mt-0.5 font-display text-xl font-bold">
                Articles that go deeper on this
              </h2>
            </div>
          </Reveal>
          <RevealGroup className="grid gap-4 sm:grid-cols-2">
            {related.map((a) => (
              <RevealItem key={a.slug}>
                <Hover className="h-full" lift={-3}>
                  <Link
                    href={`/blog/${a.slug}`}
                    className="ac-card group flex h-full flex-col p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="font-display text-[16px] font-bold leading-snug tracking-tight text-foreground group-hover:text-primary">
                      {a.title}
                    </span>
                    <span className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                      {a.description}
                    </span>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden />
                      <span className="tabular-nums">{a.readMins}</span> min read
                    </span>
                  </Link>
                </Hover>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* ===================== SIBLING MODULE INDEX ===================== */}
      {modules.length > 1 && (
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="ac-card p-6" style={accentStyle}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-bold">
                  All {modules.length} modules in {dept.name}
                </h2>
                <Link
                  href={`/guides/${dept.slug}`}
                  className="-my-2 inline-flex min-h-11 items-center py-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Department overview
                </Link>
              </div>
              <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {modules.map((m, mi) => {
                  const current = m.slug === mod.slug;
                  const count = m.lessons?.length ?? 0;
                  const inner = (
                    <>
                      <span
                        className="w-8 shrink-0 text-xs font-semibold tabular-nums"
                        style={{ color: ink }}
                      >
                        {m.is_prerequisite ? "Pre" : labels[mi].padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </>
                  );
                  return (
                    // min-w-0: a grid item defaults to min-width:min-content,
                    // so without this the truncating title pushes the row wider
                    // than its column instead of ellipsing.
                    <li key={m.id} className="min-w-0">
                      {current ? (
                        <span
                          aria-current="page"
                          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
                        >
                          {inner}
                        </span>
                      ) : (
                        <Link
                          href={`/guides/${dept.slug}/${m.slug}`}
                          className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        </section>
      )}
    </div>
  );
}
