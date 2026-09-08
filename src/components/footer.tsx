import Link from "next/link";
import { Logo } from "@/components/logo";
import { NewsletterForm } from "@/components/newsletter-form";
import { getOverviewStats } from "@/lib/queries";

/**
 * The inside back cover of the binder: every destination written out, the
 * counts along the bottom rule, and the note about how the pages were made.
 *
 * The columns are grouped by what a person is trying to do, not by which part
 * of the codebase owns the route. "the record" is the one worth naming: About,
 * Contributions and Corrections are where the site says who wrote it and what
 * it got wrong, and burying a corrections log in the fine print is the same as
 * not having one.
 */
const LEARN = [
  { label: "Guides", href: "/guides" },
  { label: "Articles", href: "/blog" },
  { label: "Learning paths", href: "/paths" },
  { label: "Glossary", href: "/glossary" },
  { label: "Tools and calculators", href: "/tools" },
  { label: "Resources", href: "/resources" },
];

const TEAM = [
  { label: "For teams", href: "/for-teams" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Log in", href: "/login" },
  { label: "Get started", href: "/signup" },
];

const RECORD = [
  { label: "Who made this", href: "/about" },
  { label: "Contributions", href: "/contributions" },
  { label: "Corrections", href: "/corrections" },
  { label: "Contact", href: "/contact" },
];

const ELSEWHERE = [
  { label: "FIRST Inspires", href: "https://www.firstinspires.org/robotics/frc" },
  { label: "WPILib docs", href: "https://docs.wpilib.org" },
  { label: "Chief Delphi", href: "https://www.chiefdelphi.com" },
  { label: "The Blue Alliance", href: "https://www.thebluealliance.com" },
];

/**
 * Drawn at the same weight as the caret in the header, so every mark on the
 * site reads as the same pen. Marks a link that leaves LearnFRC.
 *
 * Inline rather than a flex sibling: "The Blue Alliance" wraps to two lines in
 * a narrow column, and as a flex child the arrow would detach from the text and
 * park itself at the far right of the row.
 */
function Offsite() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className="ml-1.5 inline-block align-middle"
    >
      <path
        d="M2.6 7.4 7.4 2.6M3.4 2.6h4v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A footer link is a 44px touch target, which is why the rows carry their own
 * min-height instead of the list carrying a gap: a 19px line with 10px between
 * rows is a 29px target, and the system's floor has no small-screen exception.
 * The hover is an underline rather than a bottom border, because a border would
 * sit at the foot of the 44px box instead of under the word.
 *
 * The colour is eased on the shared hover timing, which is the only change the
 * footer needed. It was the one hover on the site that snapped: `nb-navlink`
 * and `nb-link` both ride --nb-t-hover, and nineteen links in the back cover
 * were cutting straight to blue. Only `color` is transitioned. The underline
 * arrives with it and `text-decoration-line` cannot be interpolated, so easing
 * the decoration colour as well would just draw a line that fades in late.
 *
 * Nothing else here moves, on purpose. See the report: an arrival on the back
 * cover is decoration on chrome that appears at the foot of every page.
 */
const COL_LINK =
  "inline-flex min-h-11 items-center text-[0.95rem] text-[var(--ink)] no-underline decoration-2 underline-offset-4 transition-[color] duration-[var(--nb-t-hover)] ease-[var(--nb-ease-out)] hover:text-[var(--blue)] hover:underline";

export async function Footer() {
  // Read, never hardcode. The footer is on every page, so a stale figure here
  // is the most-seen wrong number on the site. Cached for a day and refreshed
  // by the "catalog" tag when content changes.
  const { lessonCount, deptCount } = await getOverviewStats().catch(() => ({
    lessonCount: 0,
    deptCount: 0,
  }));
  const catalogue =
    lessonCount > 0 && deptCount > 0
      ? `${lessonCount.toLocaleString()} lessons across ${deptCount} departments`
      : null;

  return (
    <footer className="nb-rule mt-16">
      <div className="nb-wrap pb-[clamp(1.6rem,3vw,2.4rem)] pt-[clamp(2.4rem,4.5vw,3.6rem)]">
        <div className="grid gap-x-[clamp(1.4rem,3vw,2.8rem)] gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Logo className="text-[1.35rem]" />
            <p className="mt-3 max-w-[34ch] text-[0.95rem] text-[var(--graphite)]">
              {catalogue ? `${catalogue}, ` : ""}from swerve geometry to the Impact Award
              essay. Written by a high-school student who needed this and could not find it.
            </p>
            <p className="nb-pen mt-3 max-w-[24ch] -rotate-1">free to read, no account needed</p>

            <div className="mt-6">
              <p className="nb-slug mb-2">new lessons in your inbox</p>
              <NewsletterForm />
            </div>
          </div>

          {[
            { title: "learn", links: LEARN },
            { title: "team", links: TEAM },
            { title: "the record", links: RECORD },
          ].map((col) => (
            <div key={col.title}>
              <h2 className="nb-slug font-bold">{col.title}</h2>
              <ul className="mt-2 flex list-none flex-col p-0">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={COL_LINK}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="nb-slug font-bold">elsewhere</h2>
            <ul className="mt-2 flex list-none flex-col p-0">
              {ELSEWHERE.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={COL_LINK}
                  >
                    <span>
                      {l.label}
                      <Offsite />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The bottom rule carries the record of the thing itself: who built
            it, what it contains, and the two legal pages. Mono, because all of
            it is catalogue data. */}
        <div className="nb-hair nb-slug mt-[clamp(1.8rem,3.5vw,2.6rem)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-4">
          {/* FIRST is a registered mark, and this line exists precisely to
              respect it, so it carries the symbol on first use. The rebuild
              dropped both the symbol and the copyright year; the legal pages
              kept theirs, which made the footer the one place on the site
              understating the notice it is there to make. */}
          <span>
            &copy; {new Date().getFullYear()} LearnFRC. Built by{" "}
            <span className="font-bold text-[var(--ink)]">Jahaan Pardhanani</span>. Not
            affiliated with or endorsed by FIRST&reg;.
          </span>
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {/* These two are standalone targets rather than links inside a
                sentence, so they take the 44px floor like every other control.
                The row aligns on baselines, so a taller box still sits on the
                same line as the counts beside it. */}
            <Link href="/privacy" className="nb-link inline-flex min-h-11 items-center">
              Privacy
            </Link>
            <Link href="/terms" className="nb-link inline-flex min-h-11 items-center">
              Terms
            </Link>
            {catalogue ? (
              <span>
                {lessonCount.toLocaleString()} lessons / {deptCount} departments
              </span>
            ) : null}
            <span>&copy; {new Date().getFullYear()}</span>
          </span>
        </div>

        {/* Written down rather than buried: the pages are AI-assisted, and the
            two places that track what that costs are linked from here. */}
        <div className="nb-note mt-6 max-w-[78ch]">
          <p className="nb-slug mb-1.5">note on accuracy</p>
          <p className="text-[0.88rem] leading-[1.55] text-[var(--graphite)]">
            LearnFRC is in beta. Lessons are AI-assisted: drafted from primary sources like the
            WPILib docs, the game manual and vendor sites, then reviewed for accuracy. If
            something looks wrong,{" "}
            <Link href="/guides" className="nb-link">
              open the lesson and suggest an edit
            </Link>
            . Every open suggestion is public on the{" "}
            <Link href="/contributions" className="nb-link">
              contributions page
            </Link>
            , and every fix we make to a fact is written down in the{" "}
            <Link href="/corrections" className="nb-link">
              corrections log
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
