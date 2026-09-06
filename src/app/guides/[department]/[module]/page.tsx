import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import {
  getAllDepartmentSlugs,
  getArticles,
  getDepartmentBySlug,
} from "@/lib/queries";
import type { DeptWithModules, ModuleRow } from "@/lib/queries";
import {
  GLOSSARY,
  glossarySlug,
  hasGlossaryDepth,
  type GlossaryTerm,
} from "@/lib/glossary-data";
import { JsonLd } from "@/components/json-ld";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

/**
 * The module hub, /guides/<department>/<module>.
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
 * every lesson title), and one hub, electrical-wiring/motor-controllers-can-bus
 *, had literally zero paragraph-length prose the parent didn't already show.
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
 *   3. the same-named module in other departments, the single most useful
 *      disambiguation on a site with eight modules called "Worked Examples &
 *      Mini-Projects", plus the blog articles that genuinely cover the topic.
 *
 * Fully static/ISR like its neighbours, the content is identical for everyone
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
// module + department rows, nothing is hardcoded per module.

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
 * Drop the leading repeat, but only when what's left is still a real phrase,
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
 * "FRC CAD: Worked Examples & Mini-Projects, 4 Lessons", the longest variant
 * that still fits a ~60-char title tag, falling back to progressively shorter
 * shapes so long module titles degrade instead of getting truncated by Google.
 *
 * Two rules the earlier version got wrong, both measured across all 101 hubs:
 *   • six titles fell off the end of the ladder and shipped the bare module
 *     title, no "FRC", no department, two of them over 62 chars ("Advanced
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
 * A 145-160 char snippet built from the module's real overview, topped up with
 * the actual lesson titles it contains (which is what a searcher wants to see)
 * rather than boilerplate.
 *
 * The top-up used to be one of three stock sentences ("N free lessons, no
 * signup needed.") and 47 of 101 descriptions ended in one of them, the exact
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

  // 1, the lead: as many whole overview sentences as fit.
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

  // 2, top up. Each tail reserves its own room so the "Covers …" list is sized
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
 * "Where this module sits", the one paragraph the department page cannot
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
    ? `${title} is the prerequisite module of the ${deptName} guide — the ground the ${count - 1} numbered modules after it assume you already have`
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
 * a single small cache read rather than eleven department fetches, the
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

/** Articles without their markdown bodies, the hub only ever links to them. */
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
 * seven have "Advanced Techniques & Case Studies", 23 of the 101 hubs share
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
 * matching them says nothing about a module, "FIRST Robotics Competition"
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
 * honest answer, a wrong definition is worse than no section.
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

/** First sentence of a definition, clamped, the term page holds the rest. */
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
 * Deliberately strict, cosine over the article's title+description+keywords
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
    // on the department page, it is a routing stub, not a page. None exist
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
    `${mod.title} is ${isPre ? "the recommended starting point" : `module ${label}`} of ${modules.length} in the LearnFRC ${dept.name} guide — ${lessons.length} free ${lessons.length === 1 ? "lesson" : "lessons"} you can read in any order.`;

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
    <>
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

      {/* ================= THE TAB DIVIDER =================
          A module is the card divider between two sections of the binder, so
          the top of this page is written on the paper itself: the trail back
          up, the module's name, what it is, and where it sits. No card, no
          panel. The first ruled box on the page is the lessons log, which is
          the thing a person came here to read. */}
      <section className="nb-wrap pb-[clamp(1.6rem,3vw,2.4rem)] pt-[clamp(1.8rem,4vw,3rem)]">
        {/* The trail is mono because it is a file path, not a sentence. Each
            link carries its own 44px target through the padding, and the
            negative margin gives that padding back to the layout so the row
            still measures like one line of type. */}
        <nav aria-label="Breadcrumb" className="nb-slug -my-2 flex flex-wrap items-center gap-x-2">
          <Link href="/guides" className="inline-flex min-h-11 items-center py-2 hover:text-blue">
            guides
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/guides/${dept.slug}`}
            className="inline-flex min-h-11 items-center py-2 hover:text-blue"
          >
            {dept.slug}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="inline-flex min-h-11 items-center py-2 font-bold text-ink">
            {mod.slug}
          </span>
        </nav>

        <p className="nb-marker mt-[clamp(1.1rem,2.4vw,1.7rem)]">
          {isPre ? "start here, before the numbered modules" : `module ${label} of ${modules.length}`}
        </p>

        <h1 className="max-w-[18ch]">{mod.title}</h1>

        <p className="nb-lede mt-[clamp(0.9rem,1.8vw,1.3rem)]">{overview}</p>

        {/* The orientation paragraph: where this module sits, who it follows,
            what share of the guide it is. Set narrower and in graphite so it
            reads as the note under the overview rather than a second lede. */}
        <p className="mt-4 max-w-[58ch] text-[0.97rem] leading-relaxed text-graphite">
          {fit}
        </p>

        {/* Figures ruled straight across the page, the way a spec block is
            typed at the top of a drawing. Deliberately not a card: the only
            cards on this page hold things you can open. */}
        <dl className="nb-rule mt-[clamp(1.5rem,3vw,2.2rem)] grid grid-cols-2 gap-x-[clamp(1rem,3vw,2.5rem)] gap-y-4 pt-4 sm:grid-cols-4">
          <div>
            <dt className="nb-slug">lessons here</dt>
            <dd className="nb-count mt-1.5">{lessons.length}</dd>
          </div>
          {totalMinutes > 0 && (
            <div>
              <dt className="nb-slug">reading time</dt>
              <dd className="nb-count mt-1.5">
                {totalMinutes}
                <small>min</small>
              </dd>
            </div>
          )}
          <div>
            <dt className="nb-slug">modules in {dept.slug}</dt>
            <dd className="nb-count mt-1.5">{modules.length}</dd>
          </div>
          <div>
            <dt className="nb-slug">lessons in the guide</dt>
            <dd className="nb-count mt-1.5">{deptLessonTotal}</dd>
          </div>
        </dl>

        {lessons.length > 0 && (
          <div className="mt-[clamp(1.4rem,2.8vw,2rem)] flex flex-wrap items-center gap-3">
            <Link href={lessonHref(lessons[0].slug)} className="nb-btn">
              {lessons.length === 1 ? "Open the lesson" : "Start at lesson 01"}
            </Link>
            <Link href={`/guides/${dept.slug}`} className="nb-btn-ghost">
              All of {dept.name}
            </Link>
          </div>
        )}
      </section>

      {/* ================= THE LESSONS =================
          A carbon-copy log, not a stack of cards. Every row is one lesson and
          the whole row is the target: the slug and read time on the left, the
          title and what it covers in the middle, the word you click on the
          right. Eight of these read as a list you can run your finger down;
          eight cards read as eight decisions. */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)]" aria-labelledby="lessons-heading">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="nb-marker">what is behind this tab</p>
            <h2 id="lessons-heading" className="max-w-[20ch]">
              {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}, in the order they were written.
            </h2>
          </div>
          {lessons.length > 1 && (
            <p className="nb-pen max-w-[20ch] rotate-[1.4deg] text-right">
              you can read them out of order, nothing is locked
            </p>
          )}
        </div>

        {lessons.length > 0 ? (
          <ol className="nb-list mt-[clamp(1.2rem,2.4vw,1.8rem)]">
            {lessons.map((l, i) => (
              <li key={l.id}>
                <Link href={lessonHref(l.slug)} className="nb-row">
                  <span className="nb-slug">
                    lesson {String(i + 1).padStart(2, "0")}
                    {l.estimated_minutes ? ` / ${l.estimated_minutes} min` : ""}
                  </span>
                  <span className="min-w-0">
                    <h3>{l.title}</h3>
                    {l.summary && (
                      <span className="mt-1.5 block max-w-[62ch] text-[0.94rem] leading-snug text-graphite">
                        {l.summary}
                      </span>
                    )}
                  </span>
                  <span className="nb-slug hidden sm:block">read it</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="nb-note mt-[clamp(1.2rem,2.4vw,1.8rem)] max-w-[46rem]">
            <p className="nb-slug">nothing filed here yet</p>
            <p className="mt-2 text-[0.97rem] leading-relaxed">
              This module has no published lessons.{" "}
              <Link href={`/guides/${dept.slug}`} className="nb-link">
                Read the rest of {dept.name}
              </Link>{" "}
              while it gets written.
            </p>
          </div>
        )}

        {/* Where this tab hands over. One box torn across the page rather than
            two cards, because previous and next are one movement through the
            binder, not two separate offers. */}
        <div className="nb-box mt-[clamp(1.8rem,3.5vw,2.8rem)] grid sm:grid-cols-2">
          <Link
            href={prev ? `/guides/${dept.slug}/${prev.slug}` : `/guides/${dept.slug}`}
            className="nb-panel gap-1.5 no-underline"
          >
            <span className="nb-slug">
              {prev ? "← the module before" : "← up to the department"}
            </span>
            <h3 className="mt-1">{prev ? prev.title : dept.name}</h3>
          </Link>
          <Link
            href={next ? `/guides/${dept.slug}/${next.slug}` : `/guides/${dept.slug}`}
            className="nb-panel gap-1.5 no-underline sm:text-right"
          >
            <span className="nb-slug">
              {next ? "the module after →" : "back to the department →"}
            </span>
            <h3 className="mt-1">{next ? next.title : dept.name}</h3>
          </Link>
        </div>
      </section>

      {/* ================= JARGON =================
          A taped index card of the terms this module's own text actually uses.
          A card, because a definition list is a thing you pull out and keep
          beside the lesson, and because after two ruled sections the page
          needs something that sits on top of the paper. */}
      {terms.length > 0 && (
        <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)]" aria-labelledby="terms-heading">
          <div className="nb-box nb-tilt-3 relative p-[clamp(1.2rem,2.6vw,2rem)]">
            {/* Inline transform, not a utility: the reduced-motion block in
                globals.css flattens `.nb-tape` by overriding `transform`, and
                an inline declaration is what that override is written against. */}
            <span
              className="nb-tape -top-3 left-[12%]"
              style={{ transform: "rotate(-4.2deg)" }}
              aria-hidden="true"
            />
            <span
              className="nb-tape -bottom-3 right-[16%]"
              style={{ transform: "rotate(2.8deg)" }}
              aria-hidden="true"
            />

            <p className="nb-slug">words this module uses without explaining</p>
            <h2 id="terms-heading" className="mt-2 max-w-[24ch] text-[clamp(1.4rem,1.1rem+1vw,2rem)]">
              The {terms.length === 1 ? "term" : "terms"} to look up first
            </h2>

            <dl className="mt-[clamp(1rem,2vw,1.5rem)] grid gap-0 sm:grid-cols-2 sm:gap-x-[clamp(1.2rem,3vw,2.4rem)]">
              {terms.map((t) => (
                <div key={t.term} className="nb-hair py-3 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
                  <dt>
                    <Link
                      href={`/glossary/${glossarySlug(t.term)}`}
                      className="nb-link inline-flex min-h-11 items-center font-bold"
                    >
                      {t.term}
                      {/* Only when the abbreviation adds something: "CAN bus"
                          already contains "CAN". The space is a real text node,
                          not a CSS margin, so it survives copy and paste. */}
                      {t.abbr && !looseRe(t.abbr).test(t.term) ? (
                        <>
                          {" "}
                          <span className="nb-slug ml-2 normal-case">{t.abbr}</span>
                        </>
                      ) : null}
                    </Link>
                  </dt>
                  <dd className="max-w-[46ch] text-[0.94rem] leading-snug text-graphite">
                    {shortDefinition(t.definition)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* ================= NOT THIS ONE? =================
          Eight departments run a module called "Worked Examples &
          Mini-Projects". A margin note is the right weight for that: it is a
          correction to a wrong turn, not a section of the guide. */}
      {twins.length > 0 && (
        <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)]" aria-labelledby="twins-heading">
          <div className="nb-note max-w-[52rem]">
            <p className="nb-slug">landed on the wrong one?</p>
            {/* Deliberately does not quote this module's own title: a few of
                these clusters are near-matches, and claiming the others carry
                this exact name would be wrong. */}
            <h2 id="twins-heading" className="mt-1.5 text-[clamp(1.05rem,1rem+0.4vw,1.3rem)]">
              {twins.length === 1
                ? "One other department uses this module name"
                : `${twins.length} other departments use this module name`}
            </h2>
            <p className="mt-2 max-w-[58ch] text-[0.94rem] leading-snug text-graphite">
              This is the {dept.name} one: {lessons.length}{" "}
              {lessons.length === 1 ? "lesson" : "lessons"}
              {totalMinutes > 0 ? `, about ${totalMinutes} minutes` : ""}. The{" "}
              {twins.length === 1 ? "module" : "modules"} below share the name over
              completely different material.
            </p>
            <ul className="mt-3 grid gap-0 sm:grid-cols-2 sm:gap-x-6">
              {twins.map((t) => (
                <li key={`${t.dept}/${t.slug}`} className="nb-hair min-w-0 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
                  <Link
                    href={`/guides/${t.dept}/${t.slug}`}
                    className="flex min-h-11 items-baseline gap-3 py-1.5 no-underline hover:text-blue"
                  >
                    <span className="min-w-0 flex-1 truncate text-[0.95rem] font-bold">
                      {t.deptName}
                    </span>
                    <span className="nb-slug shrink-0">
                      {t.lessons} {t.lessons === 1 ? "lesson" : "lessons"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ================= LONGER READS =================
          Articles are the in-the-pit companion to a module's theory. Two rows,
          same log form as the lessons above, so it is obvious these are the
          same kind of thing pointing somewhere else. */}
      {related.length > 0 && (
        <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)]" aria-labelledby="reads-heading">
          <p className="nb-marker">when it breaks, not how it works</p>
          <h2 id="reads-heading" className="max-w-[22ch] text-[clamp(1.4rem,1.1rem+1.1vw,2.1rem)]">
            {related.length === 1
              ? "An article that goes deeper on this"
              : "Articles that go deeper on this"}
          </h2>
          <ul className="nb-list mt-[clamp(1rem,2vw,1.5rem)]">
            {related.map((a) => (
              <li key={a.slug}>
                <Link href={`/blog/${a.slug}`} className="nb-row">
                  <span className="nb-slug">article / {a.readMins} min</span>
                  <span className="min-w-0">
                    <h3>{a.title}</h3>
                    <span className="mt-1.5 block max-w-[62ch] text-[0.94rem] leading-snug text-graphite">
                      {a.description}
                    </span>
                  </span>
                  <span className="nb-slug hidden sm:block">read it</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ================= THE DEPARTMENT INDEX =================
          The index page at the front of the binder, so it is set as a real
          table: number, module, lessons. The current row is marked three ways
          (a "you are here" figure, bold ink, and a blue bar) because state
          that only exists as colour disappears on a photocopy. */}
      {modules.length > 1 && (
        <section className="nb-wrap pb-[clamp(2.6rem,5vw,4rem)]" aria-labelledby="index-heading">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h2 id="index-heading" className="text-[clamp(1.4rem,1.1rem+1.1vw,2.1rem)]">
              All {modules.length} modules in {dept.name}
            </h2>
            <Link href={`/guides/${dept.slug}`} className="nb-link nb-slug inline-flex min-h-11 items-center">
              department overview
            </Link>
          </div>

          <div className="nb-scroll mt-[clamp(1rem,2vw,1.5rem)]">
            <table className="nb-table">
              <caption className="sr-only">
                Every module in {dept.name}, with its lesson count. The current
                module is marked.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[5.5rem]">
                    no.
                  </th>
                  <th scope="col">module</th>
                  <th scope="col" className="text-right">
                    lessons
                  </th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m, mi) => {
                  const current = m.slug === mod.slug;
                  const count = m.lessons?.length ?? 0;
                  return (
                    <tr key={m.id} {...(current ? { "aria-current": "page" as const } : {})}>
                      <td className="align-baseline">
                        <span className="nb-slug">
                          {m.is_prerequisite ? "pre" : labels[mi].padStart(2, "0")}
                        </span>
                      </td>
                      <td className="align-baseline">
                        {current ? (
                          <span className="flex items-baseline gap-3 border-l-[3px] border-blue pl-3 font-bold">
                            {m.title}
                            <span className="nb-slug shrink-0 text-blue">you are here</span>
                          </span>
                        ) : (
                          <Link
                            href={`/guides/${dept.slug}/${m.slug}`}
                            className="inline-flex min-h-11 items-center pl-3 no-underline hover:text-blue"
                          >
                            {m.title}
                          </Link>
                        )}
                      </td>
                      <td className="pr-0 text-right align-baseline">
                        <span className="nb-slug">{count}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
