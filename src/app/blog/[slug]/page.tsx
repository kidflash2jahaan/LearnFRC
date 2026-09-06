import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRelated } from "@/lib/blog-data";
import { getArticles, getOverviewStats } from "@/lib/queries";
import { Markdown, extractHeadings } from "@/components/markdown";
import { ArticleSuggestEdit } from "@/components/blog/article-suggest-edit";
import { Provenance, extractLinkedReferences } from "@/components/lesson/provenance";
import { JsonLd } from "@/components/json-ld";
import { parseFaqs } from "@/lib/faq";
import { ShareButton } from "@/components/share-button";
import { ArticleViewBeacon } from "@/components/article-view-beacon";
import { ArticleSignupHook } from "@/components/blog/article-signup-hook";
import { ArticleNextStep } from "@/components/blog/article-next-step";
import { Reveal } from "@/components/motion/primitives";
import { ReadingRail } from "./_reading-rail";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

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
  // No `images` override here on purpose: the per-article
  // `blog/[slug]/opengraph-image.tsx` file convention supplies og:image, and
  // Next auto-fills twitter:image from it as long as neither sets `images`.
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
    },
    twitter: {
      card: "summary_large_image",
      title: a.title,
      description: a.description,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const articles = await getArticles();
  const siteStats = await getOverviewStats();
  const a = articles.find((x) => x.slug === slug);
  if (!a) notFound();
  const url = `${SITE}/blog/${a.slug}`;
  const related = getRelated(articles, a.slug, 3);

  // The contents list comes from the SAME function that stamps the ids onto
  // the rendered headings, so every anchor in the rail is guaranteed to exist.
  // The page's old local `buildToc` had its own slug rules and its own
  // duplicate counter, and the rail papered over the mismatch by tagging
  // headings in DOM order.
  const toc = extractHeadings(a.content).filter((h) => h.level === 2);
  const hasRail = toc.length > 1;
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
    author: { "@type": "Person", name: "Jahaan Pardhanani", url: SITE },
    publisher: { "@type": "Organization", name: "LearnFRC", url: SITE },
    mainEntityOfPage: url,
    image: `${SITE}/opengraph-image`,
    keywords: a.keywords.join(", "),
    wordCount,
  };

  // Emit FAQ rich-result schema only when the article actually has an FAQ
  // section with a real list of questions (Google requires 1 or more; we want 2).
  const faqs = parseFaqs(a.content);

  return (
    <article>
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
      {faqs.length >= 2 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }}
        />
      )}

      {/* ===================== THE HEAD OF THE SHEET =====================
          A page torn out of the binder starts with its own filing line, not
          with a hero. The figures that used to be three tiles here are one
          ruled mono line: they are reference data about the page, and the
          page's job is to be read, not to advertise its own word count. */}
      <header className="nb-wrap pb-[clamp(1.4rem,3vw,2.2rem)] pt-[clamp(1.8rem,4vw,3rem)]">
        <Link
          href="/blog"
          className="nb-slug inline-flex min-h-[var(--tap)] items-center text-ink hover:text-blue hover:underline hover:decoration-blue hover:decoration-2 hover:underline-offset-4"
        >
          back to all articles
        </Link>

        <p className="nb-marker mt-3">article / {a.readMins} min</p>

        <h1 className="max-w-[20ch] text-[clamp(2rem,1.15rem+2.9vw,3.4rem)]">
          {a.title}
        </h1>

        {a.description && <p className="nb-lede mt-5">{a.description}</p>}

        <div className="nb-hair mt-[clamp(1.3rem,2.6vw,1.9rem)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-4">
          <p className="nb-slug">
            <time dateTime={a.date}>{formattedDate}</time>
            {" / "}
            {wordCount.toLocaleString()} words
            {" / "}
            {toc.length} {toc.length === 1 ? "section" : "sections"}
          </p>
          <ShareButton
            variant="outline"
            label="Share"
            text={`${a.title}, a free FRC article on LearnFRC`}
            url={url}
          />
        </div>
      </header>

      {/* ===================== BODY AND MARGIN INDEX =====================
          The prose column sets its own 68ch measure from `nb-prose`; the rail
          only becomes a column at xl, and only when there is more than one
          section to index. Nothing above it clips overflow, so the sticky
          index tracks properly. */}
      <div
        className={`nb-wrap grid gap-[clamp(1.8rem,4vw,3.4rem)] pb-[clamp(2rem,4vw,3rem)] ${
          hasRail ? "xl:grid-cols-[minmax(0,1fr)_15rem]" : ""
        }`}
      >
        {/* `min-w-0` is load-bearing. A grid item defaults to `min-width:auto`,
            which is its MIN-CONTENT width, and a wide markdown table inside
            `nb-scroll` has a min-content width of ~720px. Without this the
            column grows to 720px inside a 500px phone, and because the root
            clips horizontal overflow the reader simply loses the right-hand
            third of every paragraph. With it, the column is the grid's width
            and the table scrolls inside its own scroller, which is what
            `nb-scroll` is for. */}
        <div data-article-body className="min-w-0">
          <Markdown content={a.content} />

          {/* Articles have no `resources` column the way lessons do, so the
              reference list is the set of external links the prose itself
              cites: real links, labelled as exactly that, and simply absent on
              the articles that link out to nothing. */}
          <Provenance
            kind="article"
            path={`/blog/${a.slug}`}
            sources={extractLinkedReferences(a.content)}
          >
            {a.id && (
              <ArticleSuggestEdit
                articleId={a.id}
                title={a.title}
                path={`/blog/${a.slug}`}
                content={a.content}
                dense
              />
            )}
          </Provenance>
        </div>

        {hasRail && (
          <aside>
            <ReadingRail items={toc} />
          </aside>
        )}
      </div>

      {/* The bridge into the guides sits ABOVE the account ask on purpose: a
          reader who just got their answer owes us nothing, so the first thing
          after the article should be more of what they came for. */}
      <ArticleNextStep slug={a.slug} />

      {/* Logged-out conversion hook, contextual to what brought them here. */}
      <ArticleSignupHook lessonCount={siteStats.lessonCount} slug={a.slug} />

      {/* ===================== KEEP READING =====================
          Three panels inside one drawn frame rather than three free-floating
          cards: they are the same kind of thing, read in whatever order, so
          they share a sheet. */}
      {related.length > 0 && (
        <section className="nb-wrap pt-[clamp(2.4rem,5vw,3.6rem)]">
          <div className="mb-[clamp(1.1rem,2.4vw,1.7rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
              Next in the same pile
            </h2>
            <p className="nb-pen max-w-[22ch] rotate-[1.4deg] min-[860px]:text-right">
              these are the closest, not the newest
            </p>
          </div>

          {/* The breakpoint is 861px, not md: `.nb-panel + .nb-panel` keeps its
              horizontal 2px divider up to and including 860px, so the columns
              split at 861. Splitting any earlier leaves the panels side by side
              with the rules still running across them.

              THE ONLY MOTION ON AN ARTICLE PAGE. Nothing in the prose column
              moves: a person is reading that, and a paragraph arriving while
              you are three lines into the one above it is an interruption
              wearing a nice curve. This frame is what is left when the reading
              stops, so it is the one thing that gets laid down as you reach it.

              It is also the only block on the page the right SIZE to be laid
              down, which was measured rather than guessed. A `view()` entry
              range is min(element height, viewport height), so with
              `entry 0% -> 55%` the motion plays over `0.55 * min(S, V)` of
              scrolling. On a 500x635 phone this frame stacks to 621px and
              plays over 342px, about 280ms at a normal flick. The ruled band
              that closes the page is 101px and would play over 56px, roughly
              50ms: real, and over before anyone could see it. An arrival
              nobody registers has not earned its place.

              `Reveal` on the frame, not `RevealGroup` on the three panels: the
              divider rules belong to the panels, so staggering them would run
              the rules around inside a frame that stayed still. */}
          <Reveal className="nb-box grid overflow-hidden min-[861px]:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="nb-panel group min-w-0 hover:bg-[rgba(27,54,200,0.05)]"
              >
                <p className="nb-slug">{r.readMins} min read</p>
                <h3 className="mt-2 group-hover:underline group-hover:decoration-blue group-hover:decoration-2 group-hover:underline-offset-[5px]">
                  {r.title}
                </h3>
                <p className="mt-2 text-[0.92rem] leading-snug text-graphite">
                  {r.description}
                </p>
                <span className="nb-hair nb-slug mt-auto pt-3 text-ink group-hover:text-blue">
                  read it
                </span>
              </Link>
            ))}
          </Reveal>
        </section>
      )}

      {/* ===================== THE END OF THE SHEET =====================
          Not a fourth call to action. By this point the reader has been handed
          the lessons that continue the subject and the three articles nearest
          to it, so the only thing left is the two doors out of the binder,
          written as one line.

          Measured at 101px tall, which is why it does not move: its arrival
          would be over in 56px of scroll. See the note on the frame above. */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.4rem,5vw,3.6rem)]">
        <div className="nb-rule flex flex-wrap items-center gap-x-6 gap-y-3 pt-[clamp(1.2rem,2.4vw,1.8rem)]">
          <p className="nb-slug">end of sheet</p>
          <p className="text-graphite">
            Keep going with{" "}
            <Link href="/blog" className="nb-link">
              the other {articles.length - 1} articles
            </Link>
            , or work through{" "}
            <Link href="/guides" className="nb-link">
              all {siteStats.lessonCount.toLocaleString()} lessons
            </Link>{" "}
            across {siteStats.deptCount} departments.
          </p>
        </div>
      </section>
    </article>
  );
}
