"use client";

import type { CSSProperties } from "react";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Reveal } from "@/components/motion/primitives";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/**
 * Contextual "you read one article — here's the whole path" conversion hook for
 * blog articles. The blog route has no server-side auth, so — like the Navbar —
 * it probes /api/me client-side and hides once the reader is known to be signed
 * in. Its initial state is logged-out, so the ask SSRs into the static article
 * HTML (present for crawlers / logged-out readers); a signed-in reader sees it
 * only until the probe resolves, then it unmounts. Distinct from the generic
 * footer CTA: this one is about continuing *this* path and saving progress.
 */
export function ArticleSignupHook({
  articleCount,
  slug,
}: {
  articleCount: number;
  slug: string;
}) {
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.authed) setAuthed(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (authed) return null;

  const encoded = encodeURIComponent(`/blog/${slug}`);

  return (
    <section className="mx-auto max-w-3xl px-4 pt-14 sm:px-6 lg:px-8">
      <Reveal>
        <div
          className="ac-glass relative overflow-hidden rounded-3xl p-6 sm:p-8"
          style={{ "--a": "#2560e6" } as CSSProperties}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(37,96,230,0.18),transparent_70%)] blur-2xl"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
            <span className="ac-badge flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
              <Compass className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="ac-eyebrow">Go deeper</p>
              <h2 className="mt-1.5 text-balance font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl">
                Want the whole path, not just{" "}
                <span style={GRADIENT_TEXT}>this article</span>?
              </h2>
              <p className="mt-2 max-w-xl text-pretty text-[15px] leading-relaxed text-foreground/70">
                LearnFRC has {articleCount}+ free FRC lessons and guides across
                every department. Create a free account to save your place,
                track your progress, and earn a certificate.
              </p>
              <Link
                href={`/signup?next=${encoded}&ref=article-hook`}
                className="ac-btn mt-5 text-sm"
              >
                Create a free account
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
