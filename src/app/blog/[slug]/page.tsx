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
import { ARTICLES, getArticle, getRelated } from "@/lib/blog-data";
import { Markdown } from "@/components/markdown";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { Reveal } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";
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

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
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

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  const url = `${SITE}/blog/${a.slug}`;
  const related = getRelated(a.slug, 3);
  const toc = buildToc(a.content);
  const wordCount = a.content.trim().split(/\s+/).length;

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

  return (
    <article className="relative isolate overflow-x-clip text-foreground">
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

      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[620px] w-[620px] opacity-70"
          style={{
            left: "-180px",
            top: "-240px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[560px] w-[560px] opacity-55"
          style={{
            right: "-160px",
            top: "-120px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[520px] w-[520px] opacity-40"
          style={{
            left: "38%",
            top: "560px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <header className="mx-auto max-w-3xl px-4 pb-8 pt-28 sm:px-6 sm:pt-28 lg:px-8">
        <Link
          href="/blog"
          className="aq-rise aq-rise-1 group inline-flex min-h-11 items-center gap-1.5 rounded-full -my-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <ArrowLeft
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
          />{" "}
          Back to all articles
        </Link>

        <div className="aq-rise aq-rise-2 mt-6 flex flex-wrap items-center gap-2.5">
          <span className="aq-chip aq-eyebrow inline-flex items-center gap-1.5">
            <BookOpen aria-hidden className="h-3.5 w-3.5" /> FRC Guide
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

        <h1 className="aq-rise aq-rise-3 aq-display mt-5 text-balance text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
          <span className="aq-grad-anim" style={GRADIENT_TEXT}>
            {a.title}
          </span>
        </h1>

        {a.description && (
          <p className="aq-rise aq-rise-4 mt-5 max-w-2xl text-lg leading-relaxed text-foreground/70">
            {a.description}
          </p>
        )}

        <div className="aq-rise aq-rise-5 mt-7 flex flex-wrap items-center gap-3">
          <ShareButton
            variant="brand"
            label="Share this guide"
            text={`${a.title} — a free FRC guide on LearnFRC`}
            url={url}
          />
          <Button asChild variant="ghost">
            <Link href="/guides">Browse the guides</Link>
          </Button>
        </div>

        {/* article-at-a-glance stats strip */}
        <dl className="aq-rise aq-rise-5 mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: Clock, value: a.readMins, suffix: " min", label: "to read" },
            { icon: FileText, value: wordCount, suffix: "", label: "words" },
            { icon: Hash, value: toc.length, suffix: "", label: "sections" },
          ].map((s) => (
            <div
              key={s.label}
              className="aq-card aq-card-hover rounded-2xl px-4 py-3 text-center"
            >
              <dt className="sr-only">{s.label}</dt>
              <s.icon
                aria-hidden
                className="mx-auto mb-1 h-4 w-4 text-primary"
              />
              <dd className="aq-display text-xl font-extrabold leading-none text-foreground">
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </dl>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <hr aria-hidden className="aq-rise aq-rise-5 aq-divider" />
      </div>

      {/* ===================== BODY + READING RAIL ==================== */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pt-8 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
        {/* Article body */}
        <div className="mx-auto w-full max-w-3xl xl:mx-0" data-article-body>
          <Reveal delay={0.1}>
            <Markdown content={a.content} />
          </Reveal>
        </div>

        {/* Signature: fixed reading-progress bar (all sizes) + sticky TOC
            scroll-spy (xl+). Rendered once; the nav self-hides below xl. */}
        <aside className="xl:order-none">
          <ReadingRail items={toc} />
        </aside>
      </div>

      {/* ======================== KEEP READING ======================= */}
      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 lg:px-8">
          <Reveal>
            <p className="aq-eyebrow flex items-center gap-1.5">
              <Sparkles aria-hidden className="h-3.5 w-3.5" /> Keep reading
            </p>
            <h2 className="aq-display mt-2 text-2xl font-bold tracking-tight">
              More from the pit
            </h2>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {related.map((r, i) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="aq-reveal aq-card aq-card-hover group flex flex-col gap-3 rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                style={{ animationDelay: `${i * 90}ms` } as CSSProperties}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock aria-hidden className="h-3 w-3" /> {r.readMins} min read
                </span>
                <h3 className="aq-display font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
                  {r.title}
                </h3>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read{" "}
                  <ArrowRight
                    aria-hidden
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============================= CTA =========================== */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <Reveal>
          <div
            className="aq-glass aq-sheen aq-float relative overflow-hidden rounded-[28px] p-8 text-center sm:px-16 sm:py-12"
            style={{ "--a": "#2560e6" } as CSSProperties}
          >
            <div className="aq-icon aq-badge-bob mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
              <BookOpen aria-hidden className="h-6 w-6 text-primary" />
            </div>
            <h2 className="aq-display text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              Learn every department of FRC —{" "}
              <span className="aq-grad-anim" style={GRADIENT_TEXT}>
                free
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-foreground/70">
              Structured lessons, quizzes, and team tools. Built by an FRC
              student, for the community.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-6">
              {[
                { value: 394, suffix: "+", label: "lessons", delay: 60 },
                { value: 12, suffix: "", label: "departments", delay: 150 },
                { value: 100, suffix: "%", label: "free", delay: 240 },
              ].map((s) => (
                <div
                  key={s.label}
                  className="aq-reveal flex flex-col items-center"
                  style={{ animationDelay: `${s.delay}ms` } as CSSProperties}
                >
                  <span className="aq-display text-2xl font-bold text-primary">
                    <AnimatedCounter value={s.value} suffix={s.suffix} />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <Button asChild variant="brand" className="mt-7">
              <Link href="/guides">
                Browse the guides{" "}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </article>
  );
}
