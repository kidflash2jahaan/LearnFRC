import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

/* ================================================================== */
/*  NEON TERMINAL markdown renderer                                    */
/*  Keeps the remark/rehype pipeline intact — only presentation       */
/*  changes: console headings, neon inline tokens, code-window blocks, */
/*  cyan "tip" blockquotes, square-bullet lists, terminal tables.     */
/* ================================================================== */

/** Small mono "#"-style marker that prefixes headings, console-comment feel. */
function HeadMark({ level }: { level: number }) {
  return (
    <span
      aria-hidden
      className="mr-2 select-none align-middle font-mono text-accent/80"
    >
      {"#".repeat(level)}
    </span>
  );
}

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("text-[0.97rem]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          h1: ({ children, ...p }) => (
            <h2
              className="mt-10 mb-3 scroll-mt-24 font-display text-2xl font-bold tracking-tight text-foreground"
              {...p}
            >
              <HeadMark level={1} />
              {children}
            </h2>
          ),
          h2: ({ children, ...p }) => (
            <h2
              className="mt-10 mb-3 scroll-mt-24 font-display text-xl font-bold tracking-tight text-foreground"
              {...p}
            >
              <HeadMark level={2} />
              {children}
            </h2>
          ),
          h3: ({ children, ...p }) => (
            <h3
              className="mt-7 mb-2 scroll-mt-24 font-display text-lg font-semibold tracking-tight text-foreground"
              {...p}
            >
              <HeadMark level={3} />
              {children}
            </h3>
          ),
          h4: ({ ...p }) => (
            <h4 className="mt-5 mb-2 font-display font-semibold text-foreground" {...p} />
          ),
          p: ({ ...p }) => (
            <p className="my-4 leading-7 text-foreground/85" {...p} />
          ),
          a: ({ ...p }) => (
            <a
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
              target="_blank"
              rel="noopener noreferrer"
              {...p}
            />
          ),
          ul: ({ ...p }) => (
            <ul
              className="my-4 list-[square] space-y-2 pl-6 text-foreground/85 marker:text-accent"
              {...p}
            />
          ),
          ol: ({ ...p }) => (
            <ol
              className="my-4 list-decimal space-y-2 pl-6 text-foreground/85 marker:font-mono marker:text-primary/70"
              {...p}
            />
          ),
          li: ({ ...p }) => <li className="leading-7" {...p} />,
          strong: ({ ...p }) => (
            <strong className="font-semibold text-foreground" {...p} />
          ),
          em: ({ ...p }) => <em className="text-foreground/90" {...p} />,
          blockquote: ({ ...p }) => (
            <blockquote
              className="my-6 rounded-xl border border-accent/30 bg-gradient-to-b from-accent/[0.08] to-accent/[0.01] py-3 pl-5 pr-4 text-foreground/85 [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_strong]:text-accent"
              {...p}
            />
          ),
          hr: () => (
            <hr className="my-9 h-px border-0 bg-gradient-to-r from-transparent via-border to-transparent" />
          ),
          code: ({ className, children, ...rest }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <code className={cn("hljs font-mono text-[0.85rem]", className)} {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded-md border border-primary/20 bg-primary/[0.08] px-1.5 py-0.5 font-mono text-[0.82em] text-primary"
                {...rest}
              >
                {children}
              </code>
            );
          },
          // Render fenced code blocks inside a neon "code window" with a
          // macOS-style titlebar (traffic-light dots) for the terminal look.
          pre: ({ children, ...p }) => (
            <figure className="group/code my-6 overflow-hidden rounded-xl border border-border bg-[#070b14] shadow-[var(--shadow-md)] transition-shadow hover:shadow-[var(--glow-primary)]">
              <figcaption className="terminal-titlebar flex items-center gap-2 px-3.5 py-2">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </span>
                <span className="ml-1 inline-flex items-center gap-1.5 font-mono text-[0.7rem] text-muted-foreground">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  snippet
                </span>
              </figcaption>
              <pre
                className="overflow-x-auto p-4 leading-6 text-foreground/90"
                {...p}
              >
                {children}
              </pre>
            </figure>
          ),
          table: ({ ...p }) => (
            <div className="my-6 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm" {...p} />
            </div>
          ),
          th: ({ ...p }) => (
            <th
              className="border-b border-border bg-muted/60 px-3 py-2 text-left font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              {...p}
            />
          ),
          td: ({ ...p }) => (
            <td className="border-b border-border px-3 py-2 align-top text-foreground/85" {...p} />
          ),
          img: ({ ...p }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="my-6 rounded-xl border border-border" alt="" {...p} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
