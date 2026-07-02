import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock, Calendar } from "lucide-react";
import { ARTICLES, getArticle, getRelated } from "@/lib/blog-data";
import { Markdown } from "@/components/markdown";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { Reveal } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#0d7ea3)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

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
    <article className="relative mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="aq-float absolute -top-24 -left-20 h-72 w-72 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,96,230,0.20), transparent 70%)" }}
        />
        <div
          className="aq-float absolute top-40 -right-24 h-80 w-80 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(26,169,214,0.18), transparent 70%)", animationDelay: "1.2s" }}
        />
        <div
          className="aq-float absolute bottom-10 left-1/3 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(124,92,246,0.14), transparent 70%)", animationDelay: "2.4s" }}
        />
      </div>

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

      {/* Hero */}
      <header>
        <Link
          href="/blog"
          className="aq-rise aq-rise-1 inline-flex min-h-11 items-center gap-1.5 rounded-full py-2 -my-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to all articles
        </Link>

        <div className="aq-rise aq-rise-2 mt-6 flex flex-wrap items-center gap-2.5">
          <span className="aq-chip aq-badge-bob inline-flex items-center gap-1.5">
            <BookOpen aria-hidden className="h-3.5 w-3.5" /> Guide
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock aria-hidden className="h-3.5 w-3.5" /> {a.readMins} min read
          </span>
          <span aria-hidden className="text-border">•</span>
          <time
            dateTime={a.date}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Calendar aria-hidden className="h-3.5 w-3.5" /> {formattedDate}
          </time>
        </div>

        <h1 className="aq-rise aq-rise-3 aq-display mt-5 text-balance text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
          <span className="aq-grad-anim" style={GRADIENT_TEXT}>{a.title}</span>
        </h1>

        {a.description && (
          <p className="aq-rise aq-rise-3 mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
            {a.description}
          </p>
        )}

        <div className="aq-rise aq-rise-4 mt-6">
          <ShareButton
            variant="ghost"
            label="Share this guide"
            text={`${a.title} — a free FRC guide on LearnFRC`}
            url={url}
          />
        </div>
      </header>

      <hr aria-hidden className="aq-rise aq-rise-5 aq-divider mt-8" />

      {/* Article body */}
      <Reveal delay={0.1}>
        <div className="mt-8">
          <Markdown content={a.content} />
        </div>
      </Reveal>

      {/* Keep reading */}
      {related.length > 0 && (
        <Reveal as="section" className="mt-16 aq-reveal">
          <p className="aq-eyebrow">Keep reading</p>
          <h2 className="aq-display mt-2 text-2xl font-bold tracking-tight">
            More from the pit
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {related.map((r, i) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="aq-reveal aq-card aq-card-hover group flex flex-col gap-3 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                style={{ animationDelay: `${i * 90}ms` } as CSSProperties}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock aria-hidden className="h-3 w-3" /> {r.readMins} min read
                </span>
                <h3 className="aq-display font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
                  {r.title}
                </h3>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      )}

      {/* CTA */}
      <Reveal className="aq-reveal">
        <div
          className="aq-glass aq-sheen aq-float relative mt-14 overflow-hidden p-8 text-center"
          style={{ "--a": "#2560e6" } as CSSProperties}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl aq-icon aq-badge-bob">
            <BookOpen aria-hidden className="h-6 w-6 text-primary" />
          </div>
          <h2 className="aq-display text-2xl font-bold tracking-tight">
            Learn every department of FRC —{" "}
            <span className="aq-grad-anim" style={GRADIENT_TEXT}>free</span>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-foreground/70">
            Structured lessons, quizzes, and team tools. Built by an FRC student,
            for the community.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
            <div className="aq-reveal flex flex-col items-center" style={{ animationDelay: "60ms" } as CSSProperties}>
              <span className="aq-display text-2xl font-bold text-primary">
                <AnimatedCounter value={394} suffix="+" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">lessons</span>
            </div>
            <div className="aq-reveal flex flex-col items-center" style={{ animationDelay: "150ms" } as CSSProperties}>
              <span className="aq-display text-2xl font-bold text-primary">
                <AnimatedCounter value={12} />
              </span>
              <span className="text-xs font-medium text-muted-foreground">departments</span>
            </div>
            <div className="aq-reveal flex flex-col items-center" style={{ animationDelay: "240ms" } as CSSProperties}>
              <span className="aq-display text-2xl font-bold text-primary">
                <AnimatedCounter value={100} suffix="%" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">free</span>
            </div>
          </div>
          <Button asChild variant="brand" className="mt-6">
            <Link href="/guides">
              Browse the guides <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Reveal>
    </article>
  );
}
