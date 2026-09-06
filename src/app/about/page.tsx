import type { Metadata } from "next";
import Link from "next/link";
import { getDepartments, getArticles } from "@/lib/queries";
import { JsonLd } from "@/components/json-ld";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";
// NOT an email address. learnfrc.com publishes no MX record, so anything
// printed here bounced, and this page also emitted it as machine-readable
// JSON-LD, so a bad address was being handed to crawlers as fact. A personal
// mailbox is not an option: the maintainer is a minor. The JSON-LD below now
// carries a `contactPoint` with this URL instead of an `email`.
const CONTACT_PATH = "/contact";
const REPO = "https://github.com/kidflash2jahaan/LearnFRC";
const AUTHOR = "Jahaan Pardhanani";
const MANUAL = "https://www.firstinspires.org/robotics/frc/game-and-season";

export const metadata: Metadata = {
  title: "About LearnFRC — who writes it and how it's checked",
  description:
    "LearnFRC is a free FRC curriculum built and maintained by Jahaan Pardhanani, a high-school student. Here's how lessons are drafted from primary sources, reviewed for accuracy, and corrected in the open.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: `${SITE}/about`,
    title: "About LearnFRC — who writes it and how it's checked",
    description:
      "Who builds LearnFRC, how its lessons are drafted from primary sources and reviewed, and how to suggest a correction.",
  },
};

// The counts below come from the live catalog, so this page can never drift
// out of date the way a hard-coded "394 lessons" would.
export const revalidate = 86400;

/**
 * The colophon page of the binder: who wrote it, what it was written from, and
 * what happens when it is wrong.
 *
 * It used to be a wall of identical gradient cards, each with a coloured icon
 * tile in a hue the palette does not own, under drifting light. A reader
 * arrives here to decide whether to trust a page before they rely on it in
 * their pit, and a stack of equal cards tells them nothing about which claim
 * carries weight. So the page is built as one spread with four different
 * textures, in the order the reader's question actually goes:
 *
 *   1. who is responsible          taped masthead card, tilted, never straightened
 *   2. what is in the binder       a ruled tally of live figures, printed off a rule
 *   3. how a page gets written     one hand-ruled card, four numbered entries
 *   4. everything else             plain measured prose under 2px ink rules
 *
 * Server Component. Nothing on this page holds state and nothing animates.
 */

/** How a lesson gets written. Four steps, in order, drawn as a numbered log. */
const PIPELINE: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Start from primary sources",
    body: "Every lesson is scoped against the documents that actually govern FRC: the WPILib docs, the FIRST game manual and team updates, and vendor documentation from the companies whose parts you're using. Each department page lists the sources its lessons draw from, and lessons link out to the originals so you can check the claim yourself.",
  },
  {
    n: "02",
    title: "Draft with AI assistance",
    body: "The first draft of a lesson is AI-assisted, written against those sources rather than from memory. This is disclosed on every page of the site, not buried here. You should always know how what you're reading was made.",
  },
  {
    n: "03",
    title: "Review for accuracy before publishing",
    body: "Drafts are reviewed against the sources before they go live. Rules, part numbers, deadlines, and API names are the things most likely to be wrong or out of date, so those get checked hardest, and anything that couldn't be verified gets cut rather than hedged.",
  },
  {
    n: "04",
    title: "Fix it in the open when it's wrong",
    body: "Readers can suggest an edit on any lesson or article. Every open suggestion is public on the contributions page: you can see what's been reported, what's been merged, and who reported it.",
  },
];

export default async function AboutPage() {
  const [departments, articles] = await Promise.all([
    getDepartments(),
    getArticles(),
  ]);

  const deptCount = departments.length;
  const moduleCount = departments.reduce((s, d) => s + d.moduleCount, 0);
  const lessonCount = departments.reduce((s, d) => s + d.lessonCount, 0);
  const articleCount = articles.length;

  const tally = [
    { value: deptCount, label: "departments", note: "one per job on a team" },
    { value: moduleCount, label: "modules", note: "a department, broken up" },
    { value: lessonCount, label: "lessons", note: "written and reviewed" },
    { value: articleCount, label: "articles", note: "longer, season-specific" },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${SITE}/about#page`,
        url: `${SITE}/about`,
        name: "About LearnFRC",
        description:
          "Who builds LearnFRC, how its lessons are drafted from primary sources and reviewed for accuracy, and how to suggest a correction.",
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@id": `${SITE}/#org` },
        mainEntity: { "@id": `${SITE}/#person` },
      },
      {
        // Site-wide author identity. Article schema across the blog should
        // reference this @id rather than re-declaring an author each time.
        "@type": "Person",
        "@id": `${SITE}/#person`,
        name: AUTHOR,
        url: `${SITE}/about`,
        description:
          "High-school student in the FIRST Robotics Competition community; builds, writes, and edits LearnFRC.",
        // No `email`. The domain runs no mail server, so any address here is a
        // machine-readable claim that resolves to a bounce, and this node
        // describes a minor. Reach him through the Organization contactPoint.
        knowsAbout: [
          "FIRST Robotics Competition",
          "FRC robot design",
          "WPILib",
          "Swerve drive",
          "CAD for FRC",
          "FRC electrical and controls",
          "FRC team operations",
        ],
        sameAs: ["https://github.com/kidflash2jahaan"],
        mainEntityOfPage: { "@id": `${SITE}/about#page` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE}/#org`,
        name: "LearnFRC",
        url: SITE,
        logo: `${SITE}/opengraph-image`,
        description:
          "A free, complete learning platform for the FIRST Robotics Competition.",
        founder: { "@id": `${SITE}/#person` },
        // `contactPoint` with a `url` instead of `email`: ContactPoint inherits
        // `url` from Thing and `contactType` is one of its own properties, so
        // this is valid schema.org, and unlike the address it replaces, it
        // points somewhere that answers.
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          url: `${SITE}${CONTACT_PATH}`,
          availableLanguage: "English",
        },
        sameAs: [REPO],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          {
            "@type": "ListItem",
            position: 2,
            name: "About",
            item: `${SITE}/about`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* ---- 1. masthead ------------------------------------------------ */}
      <div className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,3.8rem)]">
        <div className="grid gap-[clamp(1.6rem,4vw,3.4rem)] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)] lg:items-start">
          <div>
            <p className="nb-marker">about / the colophon</p>
            <h1>
              One student, <span className="nb-mark">every department</span>.
            </h1>
            <p className="nb-lede mt-5">
              LearnFRC is a free FRC curriculum built and maintained by {AUTHOR},
              a high-school student. This page is the honest version: who writes
              it, what it is drafted from, how it gets checked, and how to tell
              me when it is wrong.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/guides" className="nb-btn">
                Browse the guides
              </Link>
              <a href="#how" className="nb-btn-ghost">
                How lessons are made
              </a>
            </div>
          </div>

          {/* The masthead card. Not a stats panel: the numbers get their own
              rule below. This card answers the only question a reader has at
              the top of an about page, which is who is on the hook. */}
          <div className="lg:justify-self-end lg:pt-2">
            <div className="nb-box nb-tilt-1 w-full max-w-sm p-[clamp(1.2rem,2.4vw,1.7rem)]">
              <span className="nb-tape -top-3 left-[24%] rotate-[-3.4deg]" aria-hidden="true" />
              <span className="nb-tape -bottom-3 right-[18%] rotate-[2.6deg]" aria-hidden="true" />

              <p className="nb-slug border-b border-dashed border-rule pb-3">
                who is responsible
              </p>
              <p className="mt-4 text-[1.15rem] font-bold leading-tight">{AUTHOR}</p>
              <p className="mt-1 text-[0.95rem] text-graphite">
                Writes, edits, builds and runs the site. No company, no
                editorial staff, no review board.
              </p>

              <dl className="nb-hair mt-4 pt-4">
                {[
                  ["drafted", "AI-assisted, against sources"],
                  ["reviewed", "by hand, before publishing"],
                  ["corrected", "in public, with the date"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5"
                  >
                    <dt className="nb-slug min-w-[5.5rem] font-bold text-ink">{k}</dt>
                    <dd className="min-w-0 flex-1 text-[0.92rem] text-graphite">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="nb-pen mt-4 rotate-[-1.2deg] pl-2">
              if it&rsquo;s wrong, it&rsquo;s mine to fix
            </p>
          </div>
        </div>
      </div>

      {/* ---- 2. the tally ------------------------------------------------
          Four live figures ruled off the way a count is written on a printed
          sheet: a heavy rule, the number under it, the unit under that. Each
          cell carries its own rule rather than sitting in a card, so the row
          reads as one table and not as four tiles. */}
      <div className="nb-wrap pb-[clamp(2.4rem,5vw,4rem)]">
        <p className="nb-marker">the catalogue today</p>
        <dl className="grid gap-x-[clamp(1rem,2.5vw,2rem)] gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {tally.map((t) => (
            <div key={t.label} className="border-t-2 border-ink pt-3">
              <dd className="nb-count text-[clamp(2rem,1.2rem+2.4vw,3.1rem)] leading-none">
                {t.value.toLocaleString()}
              </dd>
              {/* The note lives inside the <dt>, not beside it: a <dl>'s
                  grouping <div> may hold only <dt> and <dd>, and a loose <p>
                  breaks the term/description pairing a screen reader reads
                  out. A block <span> renders identically to the <p> it was. */}
              <dt className="mt-2 text-[1.02rem] font-bold">
                {t.label}
                <span className="nb-slug mt-1 block font-normal">{t.note}</span>
              </dt>
            </div>
          ))}
        </dl>
        <p className="nb-hint mt-5 max-w-[56ch]">
          Counted from the catalogue when this page was built, not typed in by
          hand. Everything is free to read without an account: no ads, nothing
          to buy, no paid tier.
        </p>
      </div>

      {/* ---- 3. how a page gets written ---------------------------------- */}
      <section id="how" className="nb-wrap border-t-2 border-ink py-[clamp(2.4rem,5vw,4rem)]">
        <div className="max-w-[52ch]">
          <p className="nb-marker">how a lesson gets written</p>
          <h2>You should be able to check my work.</h2>
          <p className="nb-sub mt-4">
            Before you rely on a page in your pit, you should be able to judge
            whether to trust it. Here is the whole process, in order.
          </p>
        </div>

        {/* One card, four ruled entries. A 2x2 grid of cards would say the four
            steps are alternatives; a numbered log says they happen in order. */}
        <div className="nb-box mt-[clamp(1.6rem,3.4vw,2.4rem)] p-[clamp(1.1rem,2.6vw,2rem)]">
          <span className="nb-tape -top-3 left-[8%] rotate-[-2.8deg]" aria-hidden="true" />

          <ol className="list-none">
            {PIPELINE.map((step, i) => (
              <li
                key={step.n}
                className={
                  "grid grid-cols-[auto_minmax(0,1fr)] gap-x-[clamp(1rem,2.4vw,1.8rem)] gap-y-2 " +
                  (i > 0 ? "nb-hair mt-6 pt-6" : "")
                }
              >
                {/* The number is decorative: <ol> already carries the order,
                    and reading "01" before every heading only doubles it. */}
                <span
                  aria-hidden="true"
                  className="nb-box-sm grid h-11 w-11 rotate-[-2deg] place-items-center border-blue font-mono text-[1.05rem] font-bold text-blue"
                >
                  {step.n}
                </span>
                <div className="min-w-0">
                  <h3>{step.title}</h3>
                  <p className="mt-2 max-w-[64ch] text-[0.97rem] leading-relaxed text-graphite">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="nb-hair mt-6 flex flex-wrap items-center justify-between gap-4 pt-6">
            <p className="max-w-[44ch] text-[0.97rem] text-graphite">
              Every correction anyone has sent is visible, including the ones
              still open.
            </p>
            <Link href="/contributions" className="nb-btn nb-btn-sm shrink-0">
              See the correction queue
            </Link>
          </div>
        </div>
      </section>

      {/* ---- 4. the long read --------------------------------------------
          Plain prose from here down. The reader who got this far is reading,
          not scanning, and boxing paragraphs would only put a border between
          them and the text. Sections open on the same 2px ink rule the binder
          uses to change subject. */}
      <div className="nb-wrap pb-[clamp(3rem,6vw,4.5rem)]">
        <section id="what" className="border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="max-w-[18ch]">A curriculum, not a forum thread.</h2>
          <div className="nb-prose mt-5">
            <p>
              LearnFRC is a free, structured curriculum for the FIRST Robotics
              Competition. It covers {deptCount} departments, from mechanical
              build and CAD to programming, electrical, controls, strategy,
              business and outreach, broken into {moduleCount} modules and{" "}
              {lessonCount} lessons, plus {articleCount} longer articles on the
              things teams ask about every season: budgets, grants, offseason
              events, swerve, scouting.
            </p>
            <p>
              It exists because most of what a rookie needs to know is real but
              scattered: a Chief Delphi thread from 2019, a paragraph in the
              WPILib docs, a vendor PDF, someone&rsquo;s team handbook that
              never left their Drive. LearnFRC puts it in one place, in an order
              that makes sense if you&rsquo;re starting from zero.
            </p>
            <p>
              Everything is free to read without an account. An account only
              exists so the site can remember what you&rsquo;ve finished, group
              you with your team, and let you suggest edits under your name.
            </p>
          </div>
        </section>

        <section id="who" className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="max-w-[18ch]">One person, and his name is on it.</h2>
          <div className="nb-prose mt-5">
            <p>
              I&rsquo;m {AUTHOR}, a high-school student in the FRC community,
              and I build, write, edit, and run the site.
            </p>
            <p>
              That&rsquo;s worth saying plainly, because it tells you how to
              read this site. There is no company behind LearnFRC, no editorial
              staff, and no institutional review board. What there is instead:
              primary sources on every claim, a disclosed drafting process, a
              public correction queue, and one person whose name is on all of
              it. If something here is wrong, it&rsquo;s mine to fix, and{" "}
              <Link className="nb-link" href={CONTACT_PATH}>
                you can tell me directly
              </Link>
              , without an account.
            </p>
            <p>
              LearnFRC is in beta and the code is public on{" "}
              <a
                className="nb-link"
                href={REPO}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              .
            </p>
          </div>
        </section>

        {/* The four disclaimers. Written out as a dl rather than a bullet list
            because each one is a claim and its consequence, and the ruled
            two-part shape says so without a bullet doing the work. */}
        <section id="trust" className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="max-w-[20ch]">Four things LearnFRC won&rsquo;t pretend to be.</h2>

          <dl className="mt-6 max-w-[68ch]">
            <div className="border-t border-dashed border-rule py-4">
              <dt className="font-bold">Not the rulebook.</dt>
              <dd className="mt-1.5 text-[0.99rem] leading-relaxed text-graphite">
                LearnFRC explains the game, but the{" "}
                <a className="nb-link" href={MANUAL} target="_blank" rel="noopener noreferrer">
                  official FIRST game manual
                </a>{" "}
                is the only authority on rules. Where they disagree, the manual
                wins and we&rsquo;re wrong.
              </dd>
            </div>
            <div className="border-t border-dashed border-rule py-4">
              <dt className="font-bold">Not affiliated with FIRST.</dt>
              <dd className="mt-1.5 text-[0.99rem] leading-relaxed text-graphite">
                LearnFRC is an independent educational project and is not
                affiliated with, sponsored by, or endorsed by FIRST®. FIRST®
                and FRC® are trademarks of FIRST.
              </dd>
            </div>
            <div className="border-t border-dashed border-rule py-4">
              <dt className="font-bold">Not a substitute for building.</dt>
              <dd className="mt-1.5 text-[0.99rem] leading-relaxed text-graphite">
                Reading about swerve is not the same as assembling one. The
                lessons are written to get you to the shop faster, not to
                replace it.
              </dd>
            </div>
            <div className="border-y border-dashed border-rule py-4">
              <dt className="font-bold">Not finished.</dt>
              <dd className="mt-1.5 text-[0.99rem] leading-relaxed text-graphite">
                The site is in beta. Content is added and revised continuously,
                and a lesson written for one season may need updating for the
                next.
              </dd>
            </div>
          </dl>
        </section>

        <section id="correct" className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="max-w-[20ch]">Corrections are the most useful thing you can send.</h2>
          <div className="nb-prose mt-5">
            <p>There are two ways to send one.</p>
            <p>
              <strong>Suggest an edit on the page itself.</strong>{" "}Open any{" "}
              <Link className="nb-link" href="/guides">
                lesson
              </Link>{" "}
              or{" "}
              <Link className="nb-link" href="/blog">
                article
              </Link>{" "}
              and use the &ldquo;Suggest an edit&rdquo; control. You&rsquo;ll
              need a free account so the change is attributable to someone. Your
              suggestion lands in a public queue on the{" "}
              <Link className="nb-link" href="/contributions">
                contributions page
              </Link>
              , where anyone can see what&rsquo;s open, what was merged, and who
              sent it.
            </p>
            <p>
              <strong>Or just describe it.</strong>{" "}If it&rsquo;s faster to say
              what&rsquo;s wrong than to write the fix, use the{" "}
              <Link className="nb-link" href={CONTACT_PATH}>
                contact form
              </Link>{" "}
              with the page URL. No account, and no email address unless you
              want a reply.
            </p>
            <p>
              Rule references, part numbers, prices, and deadlines go stale
              every season. Those are exactly the reports worth sending.
            </p>
          </div>
        </section>

        <section id="follow" className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="max-w-[20ch]">New pages, however you read things.</h2>
          <div className="nb-prose mt-5">
            <p>
              New articles are published to an{" "}
              <a className="nb-link" href="/rss.xml">
                RSS feed
              </a>{" "}
              you can add to any reader, and there&rsquo;s an email list in the
              footer of every page if you&rsquo;d rather get new lessons that
              way. Both are free, and the email list is one-click unsubscribe.
            </p>
          </div>
        </section>

        {/* Closing strip: the one question this page can't answer, and the
            three places to go next. */}
        <div className="nb-hair mt-[clamp(2.4rem,5vw,3.6rem)] flex flex-wrap items-center justify-between gap-4 pt-6">
          <p className="max-w-[46ch] text-[0.99rem] text-graphite">
            Questions, corrections, or something you wish LearnFRC covered?
          </p>
          <Link href={CONTACT_PATH} className="nb-btn shrink-0">
            Message me
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="nb-tag min-h-[var(--tap)] px-3"
          >
            Source on GitHub
          </a>
          <a href="/rss.xml" className="nb-tag min-h-[var(--tap)] px-3">
            RSS feed
          </a>
          <Link href="/privacy" className="nb-tag min-h-[var(--tap)] px-3">
            Privacy policy
          </Link>
          <Link href="/terms" className="nb-tag min-h-[var(--tap)] px-3">
            Terms of service
          </Link>
        </div>

        <p className="nb-hint mt-8 max-w-[68ch]">
          LearnFRC is an independent educational project and is not affiliated
          with or endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
        </p>
      </div>
    </>
  );
}
