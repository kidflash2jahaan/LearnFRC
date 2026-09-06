"use client";

import * as React from "react";
import Link from "next/link";

/**
 * The one account ask on an article page.
 *
 * The blog route has no server-side auth, so this probes /api/me on mount and
 * unmounts once the reader is known to be signed in. Its initial state is
 * logged-out, so the ask ships inside the static article HTML for crawlers and
 * for logged-out readers; a signed-in reader sees it only until the probe
 * resolves.
 *
 * It is a card taped to the page rather than a banner. A banner is something a
 * site does to a reader; a sign-up sheet stuck on the wall of a shop is
 * something a reader can walk past, and this one comes after the article, the
 * lessons that continue it, and everything else the page owes them.
 *
 * The headline was a two-tone gradient span. The binder prints in one colour,
 * so it is one sentence now, and the intent still decides which sentence.
 */

/**
 * Match the ask to the search intent that brought the reader here. A
 * mid-panic troubleshooting visit and a budget-planning visit convert on
 * different promises. Order matters: the first matching cluster wins.
 */
const INTENT_COPY: {
  match: RegExp;
  headline: string;
  body: (count: number) => string;
  cta: string;
}[] = [
  {
    match: /grant|cost|budget|sponsor|registration|calendar|start-an|scholarship/,
    headline: "Don't miss a 2027 deadline",
    body: () =>
      "Registration rounds, grant windows and the payment cliff all sneak up fast. A free account saves your team's checklists and your progress through the business guides.",
    cta: "Track it free",
  },
  {
    match: /swerve|cad|onshape|design|drivetrain|elevator|intake|mechanism|gear/,
    headline: "Keep building, the whole course is free",
    body: () =>
      "This article pairs with a full structured design course: swerve layout, assemblies, worked mini-projects. A free account saves your progress lesson by lesson.",
    cta: "Save my progress",
  },
  {
    match: /troubleshoot|brownout|deploy|can-bus|no-robot-code|blink|status|error|wiring|radio/,
    headline: "Bookmark the fix before you need it again",
    body: () =>
      "Pit problems repeat. A free account lets you bookmark troubleshooting guides and checklists so they are one tap away at competition.",
    cta: "Create a free account",
  },
  {
    match: /mentor|preseason|training|onboarding|rookie|joining|first-team/,
    headline: "Turn this into a training plan",
    body: (count) =>
      `LearnFRC's ${count} free lessons are a ready-made curriculum. Assign a path, track who finished what, and hand out certificates.`,
    cta: "Set up your team free",
  },
];

export function ArticleSignupHook({
  lessonCount,
  slug,
}: {
  /** Real count of guide LESSONS. This used to be handed the article count
      (91), so every article page advertised "91+ free FRC lessons" for a
      catalogue of 394, understating the site by a factor of four in the exact
      sentence meant to make signing up worth it. */
  lessonCount: number;
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
  const headline = intent?.headline ?? "Want the whole path, not just this article?";
  const body =
    intent?.body(lessonCount) ??
    `LearnFRC has ${lessonCount} free FRC lessons across every department. Create a free account to save your place, track your progress, and earn a certificate.`;
  const cta = intent?.cta ?? "Create a free account";

  return (
    <section className="nb-wrap pt-[clamp(2.4rem,5vw,3.6rem)]">
      <div className="nb-box nb-tilt-1 max-w-[44rem] p-[clamp(1.3rem,2.8vw,2rem)]">
        <span className="nb-tape -top-3 left-[14%] rotate-[-3.8deg]" aria-hidden="true" />

        <p className="nb-slug">if you want to keep the ticks</p>

        <h2 className="mt-2 max-w-[22ch] text-[clamp(1.35rem,1.05rem+1.2vw,2rem)]">
          {headline}
        </h2>

        <p className="mt-3 max-w-[52ch] text-[0.98rem] text-graphite">{body}</p>

        <Link
          href={`/signup?next=${encoded}&ref=article-hook`}
          className="nb-btn mt-[clamp(1.1rem,2.2vw,1.5rem)]"
        >
          {cta}
        </Link>

        <p className="nb-hint mt-3">
          Reading never needs one. This is only for saving where you got to.
        </p>
      </div>
    </section>
  );
}
