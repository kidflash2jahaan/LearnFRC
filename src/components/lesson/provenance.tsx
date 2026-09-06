import type { ReactNode } from "react";
import Link from "next/link";
import { formatLogDate, lastCorrectionForPath } from "@/lib/corrections";
import type { Resource } from "@/lib/types";

/**
 * The colophon at the foot of the page: where the facts came from, when the
 * page was last corrected, and how to tell us it is wrong.
 *
 * This exists because the loudest criticism of LearnFRC is that its content
 * reads as machine-generated. The honest answer is not a badge claiming the
 * opposite, it is showing the reader the primary sources, dating the last fix,
 * and putting the report-an-error control next to both.
 *
 * It is drawn as a colophon and not as a card, deliberately. A framed box would
 * make this look like a sidebar the reader can skip; ruled straight onto the
 * page under the running text, it reads as part of the document, which is what
 * it is. The references are set as a two-column reference list with the host on
 * the left, because the host is what tells you the authority of a source before
 * you decide to click it.
 *
 * Rules this component holds itself to:
 *  - It never invents a citation. `sources` renders only what it is handed, and
 *    a page with no source data gets no list rather than a padded one.
 *  - It claims nothing beyond what the site already says in its footer:
 *    AI-assisted, drafted from primary sources, reviewed for accuracy,
 *    corrected in the open.
 *  - It reuses the existing "Suggest an edit" control (passed in as `children`)
 *    instead of adding a second, competing report-an-error affordance.
 *
 * Server Component: no state, no effects, nothing crossing a client boundary.
 * `children` arrives as an already-created element, which is how the
 * client-only edit control gets in here.
 */

/** Hostname of a URL, minus a leading www., shown beside a source. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Pull the external references a markdown body actually links to.
 *
 * Articles have no `resources` column (lessons do), so their sources have to
 * come from the prose itself. These are real links a human put in the text,
 * nothing here is generated, and the UI labels them as exactly that:
 * "references linked in this article", not "sources we verified this against".
 * Returns [] for the roughly two thirds of articles that link out to nothing.
 */
export function extractLinkedReferences(markdown: string, limit = 10): Resource[] {
  const out: Resource[] = [];
  const seen = new Set<string>();
  // [label](https://…), the negative lookbehind drops image embeds ![alt](…).
  const re = /(?<!!)\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
  for (const m of markdown.matchAll(re)) {
    const title = m[1].replace(/[*_`]/g, "").trim();
    const url = m[2].replace(/[.,;]+$/, "");
    const host = hostOf(url);
    if (!title || !host) continue;
    // Internal links dressed as absolute URLs are not references.
    if (host === "learnfrc.com") continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title, url });
    if (out.length >= limit) break;
  }
  return out;
}

export function Provenance({
  kind,
  path,
  sources,
  children,
}: {
  kind: "lesson" | "article";
  /** Site-relative path of this page, which keys the corrections log lookup. */
  path: string;
  /** Authoritative references. Empty means the list is simply not rendered. */
  sources: Resource[];
  /** The existing Suggest-an-edit control. */
  children?: ReactNode;
}) {
  const noun = kind === "lesson" ? "lesson" : "article";
  const corrected = lastCorrectionForPath(path);
  const sourcesHeading =
    kind === "lesson"
      ? "sources and further reading"
      : "references linked in this article";

  return (
    <section
      aria-labelledby="provenance-heading"
      className="nb-rule mt-[clamp(2rem,4vw,3rem)] pt-4"
    >
      <p className="nb-slug">where this came from</p>
      <h2
        id="provenance-heading"
        className="mt-1.5 text-[clamp(1.15rem,1rem+0.6vw,1.45rem)]"
      >
        Sources and corrections
      </h2>

      <p className="mt-3 max-w-[62ch] text-[0.95rem] leading-relaxed text-graphite">
        This {noun} is AI-assisted: drafted from primary sources, then reviewed
        and edited by hand. Errors still get through. When one is reported we fix
        it and write down what changed, in public, in the{" "}
        <Link href="/corrections" className="nb-link">
          corrections log
        </Link>
        .
      </p>

      {/* The one line on this page that is a dated record rather than prose, so
          it is set as one: mono, ruled off, the way a log entry is. */}
      {corrected && (
        <p className="nb-slug mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-[3px] border-ink pl-3">
          <span className="font-bold text-ink">last corrected</span>
          <time dateTime={corrected.date}>{formatLogDate(corrected.date)}</time>
          <Link href={`/corrections#${corrected.id}`} className="nb-link">
            see what changed
          </Link>
        </p>
      )}

      {sources.length > 0 && (
        <div className="nb-hair mt-5 pt-4">
          <h3 className="nb-slug">{sourcesHeading}</h3>
          <ul className="mt-2 grid">
            {sources.map((r) => (
              <li
                key={r.url}
                className="grid items-baseline gap-x-[clamp(0.8rem,2vw,1.6rem)] gap-y-0.5 py-1.5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]"
              >
                <span className="nb-slug truncate">{hostOf(r.url)}</span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 text-[0.95rem] leading-snug text-ink underline decoration-rule decoration-2 underline-offset-4 hover:text-blue hover:decoration-blue"
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}
    </section>
  );
}
