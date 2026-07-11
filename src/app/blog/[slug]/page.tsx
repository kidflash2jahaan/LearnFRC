import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Calendar,
  FileText,
  Hash,
  Sparkles,
} from "lucide-react";
import { getRelated } from "@/lib/blog-data";
import { getArticles } from "@/lib/queries";
import { Markdown } from "@/components/markdown";
import { ArticleSuggestEdit } from "@/components/blog/article-suggest-edit";
import { JsonLd } from "@/components/json-ld";
import { ShareButton } from "@/components/share-button";
import { ArticleViewBeacon } from "@/components/article-view-beacon";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { ReadingRail, type TocItem } from "./_reading-rail";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/** Turn a heading string into a URL-safe anchor id. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Pull the "## " headings out of the markdown, in order, for the TOC. */
function buildToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  for (const line of markdown.split("\n")) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const text = m[1].replace(/\*\*|\*|`/g, "").trim();
    let id = slugify(text) || "section";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    items.push({ id, text });
  }
  return items;
}

/** Split a title into a solid lead and a gradient-highlighted final word. */
function splitTitle(title: string): { lead: string; tail: string } {
  const words = title.trim().split(" ");
  const tail = words.pop() ?? title;
  return { lead: words.join(" "), tail };
}

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = (await getArticles()).find((x) => x.slug === slug);
  if (!a) return { title: "Article not found" };
  const url = `${SITE}/blog/${a.slug}`;
  const img = `${SITE}/opengraph-image`;
  return {
    title: a.title,
    description: a.description,
    keywords: a.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: a.title,
      description: a.description,
      url,
      type: "article",
      publishedTime: a.date,
      images: [{ url: img, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: a.title,
      description: a.description,
      images: [img],
    },
  };
}

const STATS_ICON_CLASS = "mx-auto mb-1 h-4 w-4 text-primary";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const articles = await getArticles();
  const a = articles.find((x) => x.slug === slug);
  if (!a) notFound();
  const url = `${SITE}/blog/${a.slug}`;
  const related = getRelated(articles, a.slug, 3);
  const toc = buildToc(a.content);
  const wordCount = a.content.trim().split(/\s+/).length;
  const { lead: titleLead, tail: titleTail } = splitTitle(a.title);

  const formattedDate = new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    dateModified: a.date,
    author: { "@type": "Organization", name: "LearnFRC", url: SITE },
    publisher: { "@type": "Organization", name: "LearnFRC", url: SITE },
    mainEntityOfPage: url,
    image: `${SITE}/opengraph-image`,
    keywords: a.keywords.join(", "),
  };

  const stats = [
    { icon: Clock, value: a.readMins, suffix: " min", label: "to read" },
    { icon: FileText, value: wordCount, suffix: "", label: "words" },
    { icon: Hash, value: toc.length, suffix: "", label: "sections" },
  ];

  return (
    <article className="relative overflow-x-clip text-foreground">
      <ArticleViewBeacon slug={a.slug} />
      <JsonLd data={jsonLd} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Articles", item: `${SITE}/blog` },
            { "@type": "ListItem", position: 3, name: a.title, item: url },
          ],
        }}
      />

      <Glow
        blobs={[
          { size: "620px", pos: { left: "-180px", top: "-240px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "560px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.5, delay: 3 },
          { size: "520px", pos: { left: "38%", top: "560px" }, color: "#c8b6ff", opacity: 0.35, delay: 6 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <header className="mx-auto max-w-3xl px-4 pb-8 pt-28 sm:px-6 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <Link
              href="/blog"
              className="group -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-full py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ArrowLeft
                aria-hidden
                className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              />
              Back to all articles
            </Link>
          </RiseItem>

          <RiseItem>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="ac-chip inline-flex items-center gap-1.5">
                <BookOpen aria-hidden className="h-3.5 w-3.5 text-primary" />
                <span className="ac-eyebrow">FRC Article</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock aria-hidden className="h-3.5 w-3.5" /> {a.readMins} min read
              </span>
              <span aria-hidden className="text-border">
                •
              </span>
              <time
                dateTime={a.date}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Calendar aria-hidden className="h-3.5 w-3.5" /> {formattedDate}
              </time>
            </div>
          </RiseItem>

          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
              {titleLead && `${titleLead} `}
              <span style={GRADIENT_TEXT}>{titleTail}</span>
            </h1>
          </RiseItem>

          {a.description && (
            <RiseItem>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/70">
                {a.description}
              </p>
            </RiseItem>
          )}

          <RiseItem>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="ac-btn text-sm">
                Start learning — free <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <ShareButton
                variant="outline"
                label="Share"
                text={`${a.title} — a free FRC article on LearnFRC`}
                url={url}
              />
            </div>
          </RiseItem>

          <RiseItem>
            <dl className="mt-8 grid grid-cols-3 gap-3">
              {stats.map((s) => (
                <Hover key={s.label} lift={-3} scale={1.02} className="h-full">
                  <div className="ac-card h-full rounded-2xl px-4 py-3 text-center">
                    <dt className="sr-only">{s.label}</dt>
                    <s.icon aria-hidden className={STATS_ICON_CLASS} />
                    <dd className="font-display text-xl font-extrabold leading-none text-foreground">
                      <AnimatedCounter value={s.value} suffix={s.suffix} />
                    </dd>
                    <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </Hover>
              ))}
            </dl>
          </RiseItem>
        </RiseGroup>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <hr aria-hidden className="ac-divider" />
      </div>

      {/* ===================== BODY + READING RAIL ==================== */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pt-8 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
        {/* Article body */}
        <div className="mx-auto w-full max-w-3xl xl:mx-0" data-article-body>
          <Reveal delay={0.1}>
            <Markdown content={a.content} />
          </Reveal>
          {a.id && (
            <ArticleSuggestEdit
              articleId={a.id}
              title={a.title}
              path={`/blog/${a.slug}`}
              content={a.content}
            />
          )}
        </div>

        {/* Signature: fixed reading-progress bar (all sizes) + sticky TOC
            scroll-spy (xl+). No ancestor here uses overflow-hidden, so the
            sticky nav tracks correctly. */}
        <aside className="xl:order-none">
          <ReadingRail items={toc} />
        </aside>
      </div>

      {/* ======================== KEEP READING ======================= */}
      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 lg:px-8">
          <Reveal>
            <p className="ac-eyebrow flex items-center gap-1.5">
              <Sparkles aria-hidden className="h-3.5 w-3.5" /> Keep reading
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              More from the pit
            </h2>
          </Reveal>
          <RevealGroup className="mt-6 grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <RevealItem key={r.slug}>
                <Hover className="h-full" lift={-5}>
                  <Link
                    href={`/blog/${r.slug}`}
                    className="ac-card group flex h-full flex-col gap-3 rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Clock aria-hidden className="h-3 w-3" /> {r.readMins} min read
                    </span>
                    <h3 className="font-display font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
                      {r.title}
                    </h3>
                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read
                      <ArrowRight
                        aria-hidden
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </Hover>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* ============================= CTA =========================== */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <Reveal>
          <div
            className="ac-glass relative overflow-hidden p-8 text-center sm:px-16 sm:py-12"
            style={{ "--a": "#2560e6" } as CSSProperties}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.25),transparent_70%)] blur-2xl"
            />
            <span className="ac-badge mx-auto mb-4 flex h-12 w-12 items-center justify-center">
              <BookOpen aria-hidden className="h-6 w-6" />
            </span>
            <h2 className="text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Start learning FRC — <span style={GRADIENT_TEXT}>free</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-foreground/70">
              Structured lessons and quizzes across every department. Create a
              free account to save your progress, track your team, and earn a
              certificate.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-6">
              {[
                { value: 394, suffix: "", label: "lessons" },
                { value: 11, suffix: "", label: "departments" },
                { value: 100, suffix: "%", label: "free" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <span className="font-display text-2xl font-bold text-primary">
                    <AnimatedCounter value={s.value} suffix={s.suffix} />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="ac-btn text-sm">
                Create your free account <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link href="/guides" className="ac-btn-ghost text-sm">
                Browse the guides first
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </article>
  );
}
