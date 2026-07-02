import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

/* ================================================================== */
/*  Arena Clay markdown renderer                                       */
/*  Light "liquid glass + clay" prose. Baloo headings, blue links,    */
/*  ink body, clean lists/tables, a soft glass "note" callout.        */
/*  The remark/rehype pipeline is untouched — only presentation.      */
/*  Code blocks intentionally STAY dark so the syntax highlighting     */
/*  (.hljs neon tokens) keeps its contrast.                            */
/*                                                                      */
/*  Headings also get a deterministic slug id (see extractHeadings)    */
/*  so a page can build a live "contents" rail (scroll-spy + deep-link) */
/*  from the same raw markdown without re-parsing React output.        */
/* ================================================================== */

export type TocHeading = { id: string; text: string; level: 2 | 3 };

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

function HeadingAnchor({ id, text }: { id?: string; text?: string }) {
  if (!id) return null;
  return (
    <a
      href={`#${id}`}
      aria-label={`Link to "${text ?? ""}" section`}
      className="ml-2 inline-block align-middle text-primary/0 transition-colors group-hover:text-primary/50 group-focus-within:text-primary/50 focus-visible:text-primary/50"
    >
      <Hash className="inline h-[0.65em] w-[0.65em]" aria-hidden />
    </a>
  );
}

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  // Recomputed per render (cheap — one lesson's worth of text) so the id
  // sequence always matches this exact content string; a mutable index
  // walks it in document order as ReactMarkdown renders each heading node.
  const headings = extractHeadings(content);
  let hIdx = 0;
  const nextHeading = () => headings[hIdx++];

  return (
    <div className={cn("text-base leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          h1: ({ children, ...p }) => {
            const h = nextHeading();
            return (
              <h2
                id={h?.id}
                className="group mt-12 mb-4 scroll-mt-24 font-display text-3xl font-bold tracking-tight text-foreground"
                {...p}
              >
                {children}
                <HeadingAnchor id={h?.id} text={h?.text} />
              </h2>
            );
          },
          h2: ({ children, ...p }) => {
            const h = nextHeading();
            return (
              <h2
                id={h?.id}
                className="group mt-12 mb-4 scroll-mt-24 font-display text-2xl font-bold tracking-tight text-foreground"
                {...p}
              >
                {children}
                <HeadingAnchor id={h?.id} text={h?.text} />
              </h2>
            );
          },
          h3: ({ children, ...p }) => {
            const h = nextHeading();
            return (
              <h3
                id={h?.id}
                className="group mt-8 mb-3 scroll-mt-24 font-display text-xl font-semibold tracking-tight text-foreground"
                {...p}
              >
                {children}
                <HeadingAnchor id={h?.id} text={h?.text} />
              </h3>
            );
          },
          h4: ({ ...p }) => (
            <h4
              className="mt-6 mb-2 scroll-mt-24 font-display text-lg font-semibold text-foreground"
              {...p}
            />
          ),
          p: ({ ...p }) => (
            <p className="my-4 text-[1.05rem] leading-7 text-foreground/90" {...p} />
          ),
          a: ({ ...p }) => (
            <a
              className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              target="_blank"
              rel="noopener noreferrer"
              {...p}
            />
          ),
          ul: ({ ...p }) => (
            <ul
              className="my-4 list-disc space-y-2 pl-6 text-foreground/90 marker:text-primary"
              {...p}
            />
          ),
          ol: ({ ...p }) => (
            <ol
              className="my-4 list-decimal space-y-2 pl-6 text-foreground/90 marker:font-semibold marker:text-primary"
              {...p}
            />
          ),
          li: ({ ...p }) => <li className="pl-1 leading-7" {...p} />,
          strong: ({ ...p }) => (
            <strong className="font-semibold text-foreground" {...p} />
          ),
          em: ({ ...p }) => <em className="italic text-foreground/90" {...p} />,
          // Soft glass "note" callout — replaces the old cyan neon quote.
          blockquote: ({ ...p }) => (
            <blockquote
              className="ac-glass my-6 rounded-2xl border-l-4 border-primary py-1 pl-5 pr-5 text-foreground/90 [&>p]:my-3 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_strong]:text-primary"
              {...p}
            />
          ),
          hr: () => <hr className="ac-divider my-10" />,
          code: ({ className, children, ...rest }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              // Fenced block: keep the dark-panel highlighting untouched.
              return (
                <code className={cn("hljs font-mono text-[0.85rem]", className)} {...rest}>
                  {children}
                </code>
              );
            }
            // Inline code: light clay chip.
            return (
              <code
                className="rounded-md border border-primary/15 bg-primary/[0.07] px-1.5 py-0.5 font-mono text-[0.82em] text-primary"
                {...rest}
              >
                {children}
              </code>
            );
          },
          // Fenced code blocks live in a clean dark clay panel (no fake
          // terminal chrome) so the neon syntax tokens keep their contrast.
          pre: ({ children, ...p }) => (
            <figure className="my-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-[var(--shadow-md)] transition-shadow hover:shadow-[var(--shadow-lg)]">
              <pre
                className="overflow-x-auto p-4 leading-6 text-white/90"
                {...p}
              >
                {children}
              </pre>
            </figure>
          ),
          table: ({ ...p }) => (
            <div className="ac-card my-6 overflow-x-auto rounded-2xl p-0">
              <table className="w-full border-collapse text-sm" {...p} />
            </div>
          ),
          th: ({ ...p }) => (
            <th
              className="border-b border-border bg-primary/[0.06] px-4 py-2.5 text-left font-mono text-xs font-semibold uppercase tracking-wide text-primary"
              {...p}
            />
          ),
          td: ({ ...p }) => (
            <td
              className="border-b border-border px-4 py-2.5 align-top text-foreground/90"
              {...p}
            />
          ),
          img: ({ ...p }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="my-6 rounded-2xl border border-border shadow-[var(--shadow-md)]" alt="" {...p} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
