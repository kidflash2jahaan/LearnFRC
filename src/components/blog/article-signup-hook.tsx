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
/** Match the ask to the search intent that brought the reader here — a
    mid-panic troubleshooting visit and a budget-planning visit convert on
    different promises. Order matters: first matching cluster wins. */
const INTENT_COPY: {
  match: RegExp;
  headline: [string, string]; // [plain, gradient] halves of the h2
  body: (count: number) => string;
  cta: string;
}[] = [
  {
    match: /grant|cost|budget|sponsor|registration|calendar|start-an|scholarship/,
    headline: ["Don't miss a", "2027 deadline"],
    body: () =>
      "Registration rounds, grant windows, and the payment cliff sneak up fast. A free account saves your team's checklists and progress through the business guides.",
    cta: "Track it free",
  },
  {
    match: /swerve|cad|onshape|design|drivetrain|elevator|intake|mechanism|gear/,
    headline: ["Keep building —", "the full course is free"],
    body: () =>
      "This article pairs with a full structured design course — swerve layout, assemblies, worked mini-projects. A free account saves your progress lesson by lesson.",
    cta: "Save my progress",
  },
  {
    match: /troubleshoot|brownout|deploy|can-bus|no-robot-code|blink|status|error|wiring|radio/,
    headline: ["Bookmark the fix", "before you need it again"],
    body: () =>
      "Pit problems repeat. A free account lets you bookmark troubleshooting guides and checklists so they're one tap away at competition.",
    cta: "Create a free account",
  },
  {
    match: /mentor|preseason|training|onboarding|rookie|joining|first-team/,
    headline: ["Turn this into", "a training plan"],
    body: (count) =>
      `LearnFRC's ${count}+ free lessons are a ready-made curriculum — assign a path, track who finished what, and hand out certificates.`,
    cta: "Set up your team free",
  },
];

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
  const intent = INTENT_COPY.find((c) => c.match.test(slug));
  const headline = intent?.headline ?? (["Want the whole path, not just", "this article?"] as [string, string]);
  const body =
    intent?.body(articleCount) ??
    `LearnFRC has ${articleCount}+ free FRC lessons and guides across every department. Create a free account to save your place, track your progress, and earn a certificate.`;
  const cta = intent?.cta ?? "Create a free account";

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
                {headline[0]} <span style={GRADIENT_TEXT}>{headline[1]}</span>
              </h2>
              <p className="mt-2 max-w-xl text-pretty text-[15px] leading-relaxed text-foreground/70">
                {body}
              </p>
              <Link
                href={`/signup?next=${encoded}&ref=article-hook`}
                className="ac-btn mt-5 text-sm"
              >
                {cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
