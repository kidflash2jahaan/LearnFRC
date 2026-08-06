import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  Compass,
  ExternalLink,
  GitPullRequestArrow,
  Library,
  Mail,
  NotebookPen,
  PencilLine,
  Rss,
  Scale,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getDepartments, getArticles } from "@/lib/queries";
import { JsonLd } from "@/components/json-ld";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";
const CONTACT = "29pardhananij@sagehillschool.org";
const REPO = "https://github.com/kidflash2jahaan/LearnFRC";
const AUTHOR = "Jahaan Pardhanani";

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

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6, #7c5cff)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const LINK =
  "font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent break-words";
const strong = "font-semibold text-foreground";

/* ---------- copy primitives (mirrors /privacy and /terms) ---------- */

function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[16px] leading-[1.7] text-foreground/80 first:mt-0">
      {children}
    </p>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-[1.7] text-foreground/80 marker:text-primary/60">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

type Section = {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  body: ReactNode;
};

/* ---------- how a lesson gets written (the E-E-A-T bit) ---------- */

const PIPELINE: { n: string; icon: LucideIcon; title: string; body: string }[] = [
  {
    n: "01",
    icon: Library,
    title: "Start from primary sources",
    body: "Every lesson is scoped against the documents that actually govern FRC — the WPILib docs, the FIRST game manual and team updates, and vendor documentation from the companies whose parts you're using. Each department page lists the sources its lessons draw from, and lessons link out to the originals so you can check the claim yourself.",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "Draft with AI assistance",
    body: "The first draft of a lesson is AI-assisted, written against those sources rather than from memory. This is disclosed on every page of the site, not buried here — you should always know how what you're reading was made.",
  },
  {
    n: "03",
    icon: SearchCheck,
    title: "Review for accuracy before publishing",
    body: "Drafts are reviewed against the sources before they go live. Rules, part numbers, deadlines, and API names are the things most likely to be wrong or out of date, so those get checked hardest — and anything that couldn't be verified gets cut rather than hedged.",
  },
  {
    n: "04",
    icon: GitPullRequestArrow,
    title: "Fix it in the open when it's wrong",
    body: "Readers can suggest an edit on any lesson or article. Every open suggestion is public on the contributions page — you can see what's been reported, what's been merged, and who reported it.",
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

  const stats = [
    { label: "departments", value: deptCount },
    { label: "modules", value: moduleCount },
    { label: "lessons", value: lessonCount },
    { label: "articles", value: articleCount },
  ];

  const SECTIONS: Section[] = [
    {
      id: "what",
      title: "What LearnFRC is",
      icon: Compass,
      accent: "#2560e6",
      body: (
        <>
          <P>
            LearnFRC is a free, structured curriculum for the FIRST Robotics
            Competition. It covers {deptCount} departments — mechanical build, CAD,
            programming, electrical, controls, strategy, business, outreach and
            more — broken into {moduleCount} modules and {lessonCount} lessons, plus{" "}
            {articleCount} longer articles on the things teams ask about every
            season: budgets, grants, offseason events, swerve, scouting.
          </P>
          <P>
            It exists because most of what a rookie needs to know is real but
            scattered — a Chief Delphi thread from 2019, a paragraph in the WPILib
            docs, a vendor PDF, someone&apos;s team handbook that never left their
            Drive. LearnFRC puts it in one place, in an order that makes sense if
            you&apos;re starting from zero.
          </P>
          <P>
            Everything is free to read without an account. An account only exists
            so the site can remember what you&apos;ve finished, group you with your
            team, and let you suggest edits under your name.{" "}
            <span className={strong}>
              There are no ads, nothing to buy, and no paid tier
            </span>{" "}
            — this is not a business.
          </P>
        </>
      ),
    },
    {
      id: "who",
      title: "Who builds it",
      icon: User,
      accent: "#7c5cff",
      body: (
        <>
          <P>
            LearnFRC is a one-person project. I&apos;m{" "}
            <span className={strong}>{AUTHOR}</span>, a high-school student in the
            FRC community, and I build, write, edit, and run the site.
          </P>
          <P>
            That&apos;s worth saying plainly, because it tells you how to read this
            site. There is no company behind LearnFRC, no editorial staff, and no
            institutional review board. What there is instead: primary sources on
            every claim, a disclosed drafting process, a public correction queue,
            and one person whose name is on all of it. If something here is wrong,
            it&apos;s mine to fix — and{" "}
            <a className={LINK} href={`mailto:${CONTACT}`}>
              you can email me directly
            </a>
            .
          </P>
          <P>
            LearnFRC is in beta and the code is public on{" "}
            <a
              className={LINK}
              href={REPO}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            .
          </P>
        </>
      ),
    },
    {
      id: "trust",
      title: "What we won't pretend to be",
      icon: Scale,
      accent: "#c2740f",
      body: (
        <>
          <Bullets
            items={[
              <>
                <span className={strong}>Not the rulebook.</span> LearnFRC explains
                the game, but the{" "}
                <a
                  className={LINK}
                  href="https://www.firstinspires.org/robotics/frc/game-and-season"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  official FIRST game manual
                </a>{" "}
                is the only authority on rules. Where they disagree, the manual
                wins and we&apos;re wrong.
              </>,
              <>
                <span className={strong}>Not affiliated with FIRST.</span> LearnFRC
                is an independent educational project and is not affiliated with,
                sponsored by, or endorsed by FIRST®. FIRST® and FRC® are
                trademarks of FIRST.
              </>,
              <>
                <span className={strong}>Not a substitute for building.</span>{" "}
                Reading about swerve is not the same as assembling one. The lessons
                are written to get you to the shop faster, not to replace it.
              </>,
              <>
                <span className={strong}>Not finished.</span> The site is in beta.
                Content is added and revised continuously, and a lesson written for
                one season may need updating for the next.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "correct",
      title: "Found something wrong? Fix it",
      icon: PencilLine,
      accent: "#0a7a43",
      body: (
        <>
          <P>
            Corrections are the most valuable thing you can send. There are two
            ways to send one:
          </P>
          <Bullets
            items={[
              <>
                <span className={strong}>Suggest an edit on the page itself.</span>{" "}
                Open any{" "}
                <Link className={LINK} href="/guides">
                  lesson
                </Link>{" "}
                or{" "}
                <Link className={LINK} href="/blog">
                  article
                </Link>{" "}
                and use the &quot;Suggest an edit&quot; control. You&apos;ll need a
                free account so the change is attributable to someone. Your
                suggestion lands in a public queue on the{" "}
                <Link className={LINK} href="/contributions">
                  contributions page
                </Link>
                , where anyone can see what&apos;s open, what was merged, and who
                sent it.
              </>,
              <>
                <span className={strong}>Email it.</span> If it&apos;s faster to
                just describe the problem, send it to{" "}
                <a className={LINK} href={`mailto:${CONTACT}`}>
                  {CONTACT}
                </a>{" "}
                with the page URL.
              </>,
            ]}
          />
          <P>
            Rule references, part numbers, prices, and deadlines go stale every
            season — those are exactly the reports worth sending.
          </P>
        </>
      ),
    },
    {
      id: "follow",
      title: "Following along",
      icon: Rss,
      accent: "#1aa9d6",
      body: (
        <>
          <P>
            New articles are published to an{" "}
            <a className={LINK} href="/rss.xml">
              RSS feed
            </a>{" "}
            you can add to any reader, and there&apos;s an email list in the footer
            of every page if you&apos;d rather get new lessons that way. Both are
            free, and the email list is one-click unsubscribe.
          </P>
        </>
      ),
    },
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
        email: CONTACT,
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
        email: CONTACT,
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
    <div className="relative overflow-x-clip">
      <JsonLd data={jsonLd} />

      <Glow
        blobs={[
          {
            size: "560px",
            pos: { left: "-160px", top: "-180px" },
            color: "#8bbcff",
            opacity: 0.55,
          },
          {
            size: "500px",
            pos: { right: "-150px", top: "60px" },
            color: "#c8b6ff",
            opacity: 0.42,
            delay: 2,
          },
          {
            size: "480px",
            pos: { left: "35%", top: "860px" },
            color: "#6ff0ea",
            opacity: 0.3,
            delay: 4,
          },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <header className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-28 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">About LearnFRC</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              One student,{" "}
              <span style={BRAND_GRADIENT}>every department.</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              LearnFRC is a free, structured FRC curriculum built and maintained by{" "}
              {AUTHOR}, a high-school student. This page is the honest version:
              who writes it, what it&apos;s drafted from, how it gets checked, and
              how to tell me when it&apos;s wrong.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/guides" className="ac-btn text-sm">
                <BookOpen className="h-4 w-4" aria-hidden />
                Browse the guides
              </Link>
              <a href="#how" className="ac-btn-ghost text-sm">
                How lessons are made
              </a>
            </div>
          </RiseItem>
        </RiseGroup>

        {/* live catalog panel — real numbers, straight from the DB */}
        <Reveal>
          <div className="ac-glass p-6 sm:p-7">
            <p className="ac-eyebrow">The curriculum today</p>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="ac-card p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </dt>
                  <dd className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground">
                    <AnimatedCounter value={s.value} />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Counted live from the catalog, not typed in by hand. Free to read
              without an account — no ads, nothing to buy.
            </p>
          </div>
        </Reveal>
      </header>

      {/* ===================== HOW A LESSON IS MADE ===================== */}
      <section
        id="how"
        className="mx-auto max-w-6xl scroll-mt-28 px-4 pb-4 sm:px-6 lg:px-8"
      >
        <Reveal>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="ac-badge grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <NotebookPen className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              How a lesson gets written
            </h2>
          </div>
          <p className="mt-3 max-w-2xl text-[16px] leading-[1.7] text-foreground/80">
            You should be able to judge whether to trust a page before you rely on
            it in your pit. Here is the whole process, in order.
          </p>
        </Reveal>

        <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2">
          {PIPELINE.map((step) => {
            const Ico = step.icon;
            return (
              <RevealItem key={step.n}>
                <Hover lift={-3} scale={1.005}>
                  <div className="ac-card h-full p-6">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="ac-badge grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                        style={{ "--a": "#1aa9d6" } as CSSProperties}
                      >
                        <Ico className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="font-mono text-sm font-semibold text-muted-foreground/70">
                        {step.n}
                      </span>
                      <h3 className="min-w-0 text-lg font-bold tracking-tight">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-3 text-[15px] leading-[1.7] text-foreground/80">
                      {step.body}
                    </p>
                  </div>
                </Hover>
              </RevealItem>
            );
          })}
        </RevealGroup>

        <Reveal>
          <div className="mt-4 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="ac-badge grid h-11 w-11 shrink-0 place-items-center"
                style={{ "--a": "#0a7a43" } as CSSProperties}
              >
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-[15px] leading-relaxed text-foreground/80">
                Every correction anyone has sent is visible — including the ones
                still open.
              </p>
            </div>
            <Link href="/contributions" className="ac-btn shrink-0 text-sm">
              See the correction queue
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ========================= LONG-FORM BODY ========================= */}
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <RevealGroup className="space-y-4">
            {SECTIONS.map((s) => {
              const Ico = s.icon;
              return (
                <RevealItem key={s.id}>
                  <Hover lift={-3} scale={1.005}>
                    <section id={s.id} className="ac-card scroll-mt-28 p-6 sm:p-8">
                      <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight sm:text-2xl">
                        <span
                          aria-hidden
                          className="ac-badge grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                          style={{ "--a": s.accent } as CSSProperties}
                        >
                          <Ico className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0">{s.title}</span>
                      </h2>
                      <div className="mt-4">{s.body}</div>
                    </section>
                  </Hover>
                </RevealItem>
              );
            })}
          </RevealGroup>

          <Reveal>
            <Hover lift={-3} scale={1.005}>
              <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="ac-badge grid h-11 w-11 shrink-0 place-items-center"
                    style={{ "--a": "#2560e6" } as CSSProperties}
                  >
                    <Mail className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-[15px] text-foreground/80">
                    Questions, corrections, or something you wish LearnFRC covered?
                  </p>
                </div>
                <a href={`mailto:${CONTACT}`} className="ac-btn shrink-0 text-sm">
                  <Mail className="h-4 w-4" aria-hidden />
                  Email me
                </a>
              </div>
            </Hover>
          </Reveal>

          <Reveal>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="ac-chip inline-flex min-h-[44px] items-center gap-2 text-sm text-foreground/75"
              >
                Source on GitHub
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              <a
                href="/rss.xml"
                className="ac-chip inline-flex min-h-[44px] items-center gap-2 text-sm text-foreground/75"
              >
                <Rss className="h-3.5 w-3.5 text-primary" aria-hidden />
                RSS feed
              </a>
              <Link
                href="/privacy"
                className="ac-chip inline-flex min-h-[44px] items-center gap-2 text-sm text-foreground/75"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                Privacy
              </Link>
            </div>
          </Reveal>

          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            LearnFRC is an independent educational project and is not affiliated
            with or endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
          </p>
        </div>
      </div>
    </div>
  );
}
