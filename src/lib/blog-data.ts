// Article DATA now lives in the `articles` database table (so articles can be
// edited via the same review flow as lessons). Load it with `getArticles()`
// from "@/lib/queries". This file keeps only the shared type and the pure
// related-articles scorer.

export interface Article {
  id?: string;
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  date: string; // YYYY-MM-DD
  readMins: number;
  content: string; // markdown
}

/** Most related articles to `slug`, scored by shared tokens across keywords + title. */
export function getRelated(articles: Article[], slug: string, n = 3): Article[] {
  const self = articles.find((a) => a.slug === slug);
  if (!self) return [];
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2)
    );
  const mine = tokens([...self.keywords, self.title].join(" "));
  return articles
    .filter((x) => x.slug !== slug)
    .map((x) => {
      const t = tokens([...x.keywords, x.title].join(" "));
      let score = 0;
      for (const w of t) if (mine.has(w)) score++;
      return { x, score };
    })
    .sort((p, q) => q.score - p.score)
    .slice(0, n)
    .map((r) => r.x);
}
