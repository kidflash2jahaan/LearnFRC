import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { ARTICLES } from "@/lib/blog-data";
import { Badge } from "@/components/ui/badge";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

export const metadata: Metadata = {
  title: "FRC Guides & Articles",
  description:
    "In-depth FRC guides: how to start a team, swerve drive explained, how to win the Impact Award, and more — free, from an FRC student.",
  alternates: { canonical: `${SITE}/blog` },
  openGraph: {
    title: "FRC Guides & Articles · LearnFRC",
    description:
      "In-depth FRC guides for every department — free, from an FRC student.",
    url: `${SITE}/blog`,
    type: "website",
  },
};

export default function BlogPage() {
  const articles = [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="mx-auto max-w-4xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <Reveal>
        <Badge variant="primary" className="mb-3">
          Articles
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          FRC guides &amp; articles
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          In-depth, practical guides to the parts of FRC people search for most —
          starting a team, understanding swerve, and winning the Impact Award.
        </p>
      </Reveal>

      <Stagger className="mt-8 grid gap-5 sm:grid-cols-2">
        {articles.map((a) => (
          <StaggerItem key={a.slug}>
            <Link
              href={`/blog/${a.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-1 hover:border-primary/40"
            >
              <h2 className="text-lg font-bold tracking-tight">{a.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {a.description}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {a.readMins} min read
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  Read
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
