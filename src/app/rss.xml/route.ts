import { getArticles } from "@/lib/queries";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

/**
 * RSS 2.0 feed for the article library.
 *
 * Statically generated and revalidated hourly. The underlying `getArticles()`
 * is itself durably cached under the `catalog` tag, so accepting an article
 * edit refreshes the data immediately and this route picks it up on its next
 * revalidation window.
 */
export const revalidate = 3600;

/**
 * How many articles ride in the feed. Full-text items average ~13KB of
 * markdown each, so shipping all 86 would make a multi-megabyte response that
 * no reader wants to poll. Readers only ever surface recent items anyway.
 */
const MAX_ITEMS = 20;

/** Author + channel identity, kept in sync with /about. */
const AUTHOR = "Jahaan Pardhanani";

/* ------------------------------------------------------------------ */
/*  Escaping                                                          */
/* ------------------------------------------------------------------ */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape a raw string for use as XML/HTML text or an attribute value. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Strip the code points XML 1.0 forbids outright. Nothing in the corpus has
 * them today, but a stray control character from a paste would otherwise make
 * the whole feed unparseable.
 */
function stripInvalidXmlChars(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
}

/**
 * A handful of article titles are stored HTML-encoded (e.g. "Deadlines &amp;
 * Amounts"). Decode that layer before XML-escaping, or the feed would show a
 * literal "&amp;". Applied only to title/description — the markdown body
 * contains no entities and must be treated as literal text.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/* ------------------------------------------------------------------ */
/*  Markdown -> HTML                                                  */
/*                                                                    */
/*  A deliberately small converter for the subset the article corpus  */
/*  actually uses: headings, GFM tables, fenced code, blockquotes,    */
/*  lists, rules, paragraphs, and inline code/bold/italic/links.      */
/*  Everything else is emitted as escaped text, so strings like       */
/*  "<R103>" (game-manual rule references) and "List<Double>" survive */
/*  as literal text instead of being mistaken for markup.             */
/* ------------------------------------------------------------------ */

/** Resolve a link target against the site / the article it appears in. */
function absoluteUrl(href: string, itemUrl: string): string {
  if (href.startsWith("#")) return `${itemUrl}${href}`;
  if (href.startsWith("/")) return `${SITE}${href}`;
  return href;
}

/** Inline markdown on a single line of text. */
function inline(src: string, itemUrl: string): string {
  // Escape first; every regex below then runs over already-safe text, and the
  // tags we splice in are the only markup in the result.
  let s = esc(src);

  // Pull code spans out so bold/italic/link rules can't fire inside them.
  const codes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `\u0001${codes.length - 1}\u0001`;
  });

  // [text](href) — href is already escaped, so `&` reads as `&amp;` in the
  // attribute, which is what HTML wants.
  s = s.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g,
    (_m, text: string, href: string) =>
      `<a href="${absoluteUrl(href, itemUrl)}">${text}</a>`
  );

  // Bold first, and the body may contain lone `*` so that nested italics
  // ("**BAE *FIRST* Team Grant**") still match; the italic pass below then
  // converts what's left inside.
  s = s.replace(/\*\*((?:[^*\n]|\*(?!\*))+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return s.replace(
    /\u0001(\d+)\u0001/g,
    (_m, i: string) => `<code>${codes[Number(i)]}</code>`
  );
}

const RE_FENCE = /^\s*```/;
const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const RE_QUOTE = /^\s*>\s?/;
const RE_UL = /^\s*[-*+]\s+/;
const RE_OL = /^\s*\d+[.)]\s+/;

/** Does this line open a block that a running paragraph must yield to? */
function isBlockStart(line: string): boolean {
  return (
    !line.trim() ||
    RE_FENCE.test(line) ||
    RE_HEADING.test(line) ||
    RE_HR.test(line) ||
    RE_QUOTE.test(line) ||
    RE_UL.test(line) ||
    RE_OL.test(line)
  );
}

/** Is `line` a GFM table header followed by `next`, its delimiter row? */
function isTableHead(line: string, next: string | undefined): boolean {
  if (!next || !line.includes("|")) return false;
  return /^[\s|:-]+$/.test(next) && next.includes("-") && next.includes("|");
}

/** Split a GFM table row into trimmed cells. */
function tableCells(row: string): string[] {
  const cells = row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.map((c) => c.trim());
}

function mdToHtml(md: string, itemUrl: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // ── fenced code ──────────────────────────────────────────────
    if (RE_FENCE.test(line)) {
      const lang = line.trim().slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !RE_FENCE.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence (or EOF)
      const cls = lang ? ` class="language-${esc(lang.split(/\s+/)[0])}"` : "";
      out.push(`<pre><code${cls}>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // ── GFM table ────────────────────────────────────────────────
    if (isTableHead(line, lines[i + 1])) {
      const head = tableCells(line);
      i += 2; // header + delimiter
      const body: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        body.push(tableCells(lines[i]));
        i++;
      }
      const th = head.map((c) => `<th>${inline(c, itemUrl)}</th>`).join("");
      const rows = body
        .map(
          (r) =>
            `<tr>${r.map((c) => `<td>${inline(c, itemUrl)}</td>`).join("")}</tr>`
        )
        .join("");
      out.push(
        `<table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`
      );
      continue;
    }

    // ── heading (h1 is demoted: the item title is already the h1) ──
    const h = RE_HEADING.exec(line);
    if (h) {
      const level = Math.min(6, Math.max(2, h[1].length));
      out.push(`<h${level}>${inline(h[2].trim(), itemUrl)}</h${level}>`);
      i++;
      continue;
    }

    // ── horizontal rule ──────────────────────────────────────────
    if (RE_HR.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    // ── blockquote (recursive on the un-marked body) ─────────────
    if (RE_QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) {
        buf.push(lines[i].replace(RE_QUOTE, ""));
        i++;
      }
      out.push(`<blockquote>${mdToHtml(buf.join("\n"), itemUrl)}</blockquote>`);
      continue;
    }

    // ── lists (flat; the corpus has effectively no nesting) ──────
    if (RE_UL.test(line) || RE_OL.test(line)) {
      const ordered = RE_OL.test(line) && !RE_UL.test(line);
      const marker = ordered ? RE_OL : RE_UL;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(lines[i].replace(marker, "").trim());
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(
        `<${tag}>${items.map((t) => `<li>${inline(t, itemUrl)}</li>`).join("")}</${tag}>`
      );
      continue;
    }

    // ── paragraph ────────────────────────────────────────────────
    const para: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      !isBlockStart(lines[i]) &&
      !isTableHead(lines[i], lines[i + 1])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${inline(para.join(" "), itemUrl)}</p>`);
  }

  return out.join("");
}

/* ------------------------------------------------------------------ */
/*  Feed                                                              */
/* ------------------------------------------------------------------ */

/** RFC 822 date, which is what RSS 2.0 requires. */
function rfc822(dateOnly: string): string {
  // Articles carry a date, not a timestamp. Pin to midday UTC so the value is
  // stable regardless of where the response is rendered.
  const d = new Date(`${dateOnly}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export async function GET(): Promise<Response> {
  const articles = (await getArticles()).slice(0, MAX_ITEMS);

  const items = articles
    .map((a) => {
      const url = `${SITE}/blog/${a.slug}`;
      const title = esc(decodeEntities(a.title));
      const description = esc(decodeEntities(a.description));
      const html = esc(mdToHtml(a.content, url));
      const categories = (a.keywords ?? [])
        .slice(0, 8)
        .map((k) => `      <category>${esc(k)}</category>`)
        .join("\n");
      return [
        "    <item>",
        `      <title>${title}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${rfc822(a.date)}</pubDate>`,
        `      <dc:creator>${esc(AUTHOR)}</dc:creator>`,
        `      <description>${description}</description>`,
        categories,
        `      <content:encoded>${html}</content:encoded>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  // Newest article date drives lastBuildDate, so the value only moves when the
  // library actually changes rather than on every regeneration.
  const lastBuild = articles.length
    ? rfc822(articles[0].date)
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>LearnFRC — FIRST Robotics Competition guides</title>
    <link>${SITE}/blog</link>
    <description>Free, structured guides for every department of the FIRST Robotics Competition — mechanical, CAD, programming, electrical, controls, strategy, business and outreach.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <managingEditor>noreply@learnfrc.com (${esc(AUTHOR)})</managingEditor>
    <webMaster>noreply@learnfrc.com (${esc(AUTHOR)})</webMaster>
    <copyright>© ${new Date().getUTCFullYear()} LearnFRC</copyright>
    <generator>Next.js</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(stripInvalidXmlChars(xml), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
