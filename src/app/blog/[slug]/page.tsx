import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { ARTICLES, getArticle, getRelated } from "@/lib/blog-data";
import { Markdown } from "@/components/markdown";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

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
    <article className="mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
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
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All articles
      </Link>

      <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        {a.title}
      </h1>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {a.readMins} min read
        </span>
        <span>·</span>
        <time dateTime={a.date}>
          {new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
      </div>

      <div className="mt-5">
        <ShareButton
          variant="outline"
          label="Share this guide"
          text={`${a.title} — a free FRC guide on LearnFRC`}
          url={url}
        />
      </div>

      <div className="mt-6">
        <Markdown content={a.content} />
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-bold tracking-tight">Keep reading</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {r.readMins} min read
                </div>
                <h3 className="mt-2 font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
                  {r.title}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
        <h2 className="text-lg font-bold">Learn every department of FRC — free</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          393+ structured lessons, quizzes, and team tools. Built by an FRC student,
          for the community.
        </p>
        <Button asChild variant="brand" className="mt-4">
          <Link href="/guides">
            Browse the guides <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
