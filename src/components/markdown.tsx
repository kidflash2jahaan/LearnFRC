import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

/* ================================================================== */
/*  Arena Clay markdown renderer                                       */
/*  Light "liquid glass + clay" prose. Baloo headings, blue links,    */
/*  ink body, clean lists/tables, a soft glass "note" callout.        */
/*  The remark/rehype pipeline is untouched — only presentation.      */
/*  Code blocks intentionally STAY dark so the syntax highlighting     */
/*  (.hljs neon tokens) keeps its contrast.                            */
/* ================================================================== */

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("aq-reveal text-base leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          h1: ({ ...p }) => (
            <h2
              className="mt-12 mb-4 scroll-mt-24 aq-display text-3xl font-bold tracking-tight text-foreground"
              {...p}
            />
          ),
          h2: ({ ...p }) => (
            <h2
              className="mt-12 mb-4 scroll-mt-24 aq-display text-2xl font-bold tracking-tight text-foreground"
              {...p}
            />
          ),
          h3: ({ ...p }) => (
            <h3
              className="mt-8 mb-3 scroll-mt-24 aq-display text-xl font-semibold tracking-tight text-foreground"
              {...p}
            />
          ),
          h4: ({ ...p }) => (
            <h4
              className="mt-6 mb-2 scroll-mt-24 aq-display text-lg font-semibold text-foreground"
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
              className="aq-glass my-6 rounded-2xl border-l-4 border-primary py-1 pl-5 pr-5 text-foreground/90 [&>p]:my-3 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_strong]:text-primary"
              {...p}
            />
          ),
          hr: () => <hr className="aq-divider my-10" />,
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
            <div className="aq-card my-6 overflow-x-auto rounded-2xl p-0">
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
