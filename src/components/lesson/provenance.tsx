import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, History, ScrollText } from "lucide-react";
import { formatLogDate, lastCorrectionForPath } from "@/lib/corrections";
import type { Resource } from "@/lib/types";

/**
 * Per-page provenance: where this page's facts came from, when it was last
 * corrected, and how to tell us it's wrong.
 *
 * This exists because the loudest criticism of LearnFRC is that its content
 * reads as machine-generated. The honest answer isn't a badge claiming the
 * opposite — it's showing the reader the primary sources, dating the last fix,
 * and putting the report-an-error control right next to both.
 *
 * Rules this component holds itself to:
 *  - It never invents a citation. `sources` renders only what it is handed;
 *    when a page has no source data the list is omitted entirely rather than
 *    padded out.
 *  - It claims nothing beyond what the site already says publicly in the
 *    footer: AI-assisted, drafted from primary sources, reviewed for accuracy,
 *    corrected in the open.
 *  - It reuses the existing "Suggest an edit" control (passed in as `children`)
 *    instead of adding a second, competing "report an error" affordance.
 *
 * Server Component: no state, no effects, no functions crossing a client
 * boundary. `children` arrives as an already-created element, which is how the
 * client-only edit control gets in here.
 */

const LINK =
  "rounded-sm underline decoration-border underline-offset-2 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Hostname of a URL, minus a leading www., for display next to a source. */
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
 * come from the prose itself. These are real links a human put in the text —
 * nothing here is generated — and the UI labels them as exactly that:
 * "references linked in this article", not "sources we verified this against".
 * Returns [] for the ~two thirds of articles that link out to nothing.
 */
export function extractLinkedReferences(markdown: string, limit = 10): Resource[] {
  const out: Resource[] = [];
  const seen = new Set<string>();
  // [label](https://…) — the negative lookbehind drops image embeds ![alt](…).
  const re = /(?<!!)\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
  for (const m of markdown.matchAll(re)) {
    const title = m[1].replace(/[*_`]/g, "").trim();
    const url = m[2].replace(/[.,;]+$/, "");
    const host = hostOf(url);
    if (!title || !host) continue;
    // Internal links dressed as absolute URLs aren't references.
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
  accent = "#1aa9d6",
  ink,
  children,
}: {
  kind: "lesson" | "article";
  /** Site-relative path of this page — keys the corrections log lookup. */
  path: string;
  /** Authoritative references. Empty means the list is simply not rendered. */
  sources: Resource[];
  /** ac-badge tint. */
  accent?: string;
  /** Readable department ink for link hover; falls back to the brand colour. */
  ink?: string;
  /** The existing Suggest-an-edit control. */
  children?: ReactNode;
}) {
  const noun = kind === "lesson" ? "lesson" : "article";
  const corrected = lastCorrectionForPath(path);
  const sourcesHeading =
    kind === "lesson" ? "Sources and further reading" : "References linked in this article";

  return (
    <section
      aria-labelledby="provenance-heading"
      className="ac-card mt-8 p-6"
      style={{ "--ai": ink ?? "var(--primary)" } as CSSProperties}
    >
      <h2
        id="provenance-heading"
        className="flex items-center gap-2.5 font-display text-xl font-semibold"
      >
        <span
          className="ac-badge flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ "--a": accent } as CSSProperties}
        >
          <ScrollText className="h-5 w-5" aria-hidden />
        </span>
        Sources &amp; corrections
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        This {noun} is AI-assisted: drafted from primary sources, then reviewed
        and edited by hand. Errors still get through. When one is reported we
        fix it and write down what changed — publicly, in the{" "}
        <Link href="/corrections" className={`font-medium text-[color:var(--ai)] ${LINK}`}>
          corrections log
        </Link>
        .
      </p>

      {corrected && (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/85">
          <History className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="font-semibold">Last corrected</span>
          <time dateTime={corrected.date}>{formatLogDate(corrected.date)}</time>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <Link
            href={`/corrections#${corrected.id}`}
            className={`text-[color:var(--ai)] ${LINK}`}
          >
            see what changed
          </Link>
        </p>
      )}

      {sources.length > 0 && (
        <>
          <h3 className="mt-6 font-display text-sm font-semibold uppercase tracking-wide text-foreground/70">
            {sourcesHeading}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {sources.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-9 items-start gap-2 text-foreground/85 transition-colors hover:text-[color:var(--ai)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <ChevronRight
                    className="mt-1 h-4 w-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                  <span>
                    <span className="underline decoration-border underline-offset-2 group-hover:decoration-accent">
                      {r.title}
                    </span>
                    {hostOf(r.url) && (
                      <span className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground">
                        {hostOf(r.url)}
                      </span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {children}
    </section>
  );
}
