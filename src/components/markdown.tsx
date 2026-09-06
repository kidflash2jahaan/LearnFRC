import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import {
  GLOSSARY_AUTOLINK_CLASS,
  GLOSSARY_AUTOLINK_MAX,
  rehypeGlossaryLinks,
} from "@/lib/glossary-link";

/* ================================================================== */
/*  The notebook markdown renderer                                     */
/*                                                                     */
/*  Every element the parser can emit is styled once, in `.nb-prose` in */
/*  globals.css: the 68ch measure, the vertical rhythm, headings on     */
/*  their 2px ink rules, blue hyphen bullets, mono list markers, the    */
/*  dashed table rules, inline code chips and the code listing panel.   */
/*  So this file went from ~200 lines of per-element utility classes to */
/*  a set of overrides for the three things CSS cannot know:            */
/*                                                                     */
/*    - which heading gets which slug id (order matters, see below);    */
/*    - whether a link is ours, someone else's, or one we auto-inserted;*/
/*    - that a table has to sit inside its own scroller.               */
/*                                                                     */
/*  The remark/rehype pipeline is untouched, and so is every id, so a   */
/*  contents rail built from `extractHeadings` still deep-links to the  */
/*  same anchors it did before.                                        */
/* ================================================================== */

export type TocHeading = { id: string; text: string; level: 2 | 3 };

/** Derived from ReactMarkdown itself so we never import unified directly. */
type RehypePlugins = NonNullable<
  React.ComponentProps<typeof ReactMarkdown>["rehypePlugins"]
>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/#+\s*$/, "")
    .trim();
}

/** Extract ## / ### headings from raw markdown, skipping fenced code blocks. */
export function extractHeadings(content: string): TocHeading[] {
  const out: TocHeading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```") || line.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!m) continue;
    const text = stripInlineMarkdown(m[2]);
    if (!text) continue;
    let id = slugify(text) || "section";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    out.push({ id, text, level: m[1].length <= 2 ? 2 : 3 });
  }
  return out;
}

/**
 * The section mark, in the margin of the heading.
 *
 * A typographic `#` rather than an icon: this is a binder, and the one thing
 * that is allowed to sit beside a heading is a mark someone could have written
 * there. Invisible until the heading is hovered or something inside it takes
 * focus, so 30 headings do not print 30 marks down the page.
 */
function HeadingAnchor({ id, text }: { id?: string; text?: string }) {
  if (!id) return null;
  return (
    <a
      href={`#${id}`}
      aria-label={`Link to the "${text ?? ""}" section`}
      className="ml-2 font-mono text-[0.6em] align-middle text-transparent no-underline group-hover:text-blue group-focus-within:text-blue focus-visible:text-blue"
    >
      #
    </a>
  );
}

export function Markdown({
  content,
  className,
  glossaryLinks = true,
  glossaryLinkMax = GLOSSARY_AUTOLINK_MAX,
}: {
  content: string;
  className?: string;
  /**
   * Auto-link the first mention of FRC jargon to its glossary entry.
   * Pass `false` anywhere the extra links would be noise (previews,
   * excerpts, the glossary itself).
   */
  glossaryLinks?: boolean;
  /** Hard cap on auto-links for this document. */
  glossaryLinkMax?: number;
}) {
  // Recomputed per render (cheap — one lesson's worth of text) so the id
  // sequence always matches this exact content string; a mutable index
  // walks it in document order as ReactMarkdown renders each heading node.
  const headings = extractHeadings(content);
  let hIdx = 0;
  const nextHeading = () => headings[hIdx++];

  // Glossary linking runs last so it sees the final tree (and therefore
  // skips code blocks that rehype-highlight has already claimed).
  const rehypePlugins: RehypePlugins = [
    [rehypeHighlight, { detect: true, ignoreMissing: true }],
  ];
  if (glossaryLinks) {
    rehypePlugins.push([rehypeGlossaryLinks, { max: glossaryLinkMax }]);
  }

  return (
    <div className={cn("nb-prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          // An h1 inside body copy is a document-structure mistake, not a
          // heading level: the page already owns the h1, so it renders as h2
          // and takes the next id in sequence like any other section head.
          h1: ({ node: _node, children, ...p }) => {
            const h = nextHeading();
            return (
              <h2 id={h?.id} className="group" {...p}>
                {children}
                <HeadingAnchor id={h?.id} text={h?.text} />
              </h2>
            );
          },
          h2: ({ node: _node, children, ...p }) => {
            const h = nextHeading();
            return (
              <h2 id={h?.id} className="group" {...p}>
                {children}
                <HeadingAnchor id={h?.id} text={h?.text} />
              </h2>
            );
          },
          h3: ({ node: _node, children, ...p }) => {
            const h = nextHeading();
            return (
              <h3 id={h?.id} className="group" {...p}>
                {children}
                <HeadingAnchor id={h?.id} text={h?.text} />
              </h3>
            );
          },
          a: ({ node: _node, href, className: nodeClass, ...p }) => {
            // Internal links (same-origin paths/anchors) must stay internal —
            // rendering them target=_blank made crawlers count our own lesson
            // cross-links as outbound external links. External links keep the
            // new-tab + noopener treatment.
            const h = href ?? "";
            const external =
              /^https?:\/\//i.test(h) && !h.startsWith("https://learnfrc.com");
            // Glossary auto-links are ours, not the author's. They get a dotted
            // underline instead of the solid blue one, so a paragraph the
            // plugin has been through never reads as link spam, and so the
            // author's own links stay the loudest thing in the sentence.
            const auto =
              typeof nodeClass === "string" &&
              nodeClass.split(/\s+/).includes(GLOSSARY_AUTOLINK_CLASS);
            const cls = auto
              ? cn(
                  "text-ink decoration-dotted decoration-[rgba(27,54,200,0.55)] decoration-1 underline-offset-[3px] hover:text-blue hover:decoration-blue",
                  nodeClass
                )
              : nodeClass;
            return external ? (
              <a className={cls} href={h} target="_blank" rel="noopener noreferrer" {...p} />
            ) : (
              <a
                className={cls}
                href={h.replace(/^https:\/\/learnfrc\.com/, "") || "#"}
                {...p}
              />
            );
          },
          // A wide table is the one thing in a lesson that can push the page
          // sideways, so it always gets its own scroller.
          table: ({ node: _node, ...p }) => (
            <div className="nb-scroll">
              <table {...p} />
            </div>
          ),
          // `.hljs` is what the token colours in globals.css hang off. The
          // panel around it is styled by `.nb-prose pre`.
          code: ({ className: codeClass, children, ...rest }) => {
            const isBlock = /language-/.test(codeClass || "");
            return isBlock ? (
              <code className={cn("hljs", codeClass)} {...rest}>
                {children}
              </code>
            ) : (
              <code className={codeClass} {...rest}>
                {children}
              </code>
            );
          },
          img: ({ node: _node, alt, ...p }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="border-2 border-ink" alt={alt ?? ""} {...p} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
