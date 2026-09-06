import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ClauseIndex, type Clause } from "./_contents-rail";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using LearnFRC.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "June 20, 2026";
// NOT an email address. learnfrc.com publishes no MX record, so every address
// printed here bounced, and a personal mailbox can't be published (the
// maintainer is a minor). /contact is an anonymous form that reaches the same
// inbox and actually works.
const CONTACT_PATH = "/contact";
const MANUAL = "https://www.firstinspires.org/robotics/frc/game-and-season";

/* ---------- the clauses. Substance preserved, dashes rewritten. ---------- */

type Rule = Clause & { body: ReactNode };

const RULES: Rule[] = [
  {
    id: "eligibility",
    title: "Who can use LearnFRC",
    body: (
      <p>
        You should be at least 13 years old to create an account. If you are
        under 18, you should have a parent or guardian&rsquo;s permission. By
        signing up you confirm the information you provide is accurate.
      </p>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>
          Keep your password secure. You are responsible for activity on your
          account.
        </li>
        <li>
          Choose a username and display name that aren&rsquo;t offensive and
          don&rsquo;t impersonate anyone.
        </li>
        <li>Verify your email address to activate your account.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>
            Abuse, scrape, overload, or attempt to break the service or its
            security.
          </li>
          <li>Cheat or manipulate XP, quizzes, or the leaderboard.</li>
          <li>Harass others or post unlawful, harmful, or infringing content.</li>
          <li>Use LearnFRC for anything illegal.</li>
        </ul>
        <p>We may suspend or remove accounts that violate these terms.</p>
      </>
    ),
  },
  {
    id: "educational-content",
    title: "Educational content",
    body: (
      <p>
        Our lessons and quizzes are researched from public sources and provided
        for educational purposes. We work hard to keep them accurate, but for
        official competition decisions you should always confirm details against
        the current{" "}
        <a href={MANUAL} target="_blank" rel="noopener noreferrer">
          FRC Game Manual
        </a>{" "}
        and official documentation. Content is provided &ldquo;as is&rdquo;
        without warranties.
      </p>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <p>
        Content you submit, such as your profile details or feedback, remains
        yours. You grant LearnFRC a license to store and display it as needed to
        operate the service, for example showing your public profile.
      </p>
    ),
  },
  {
    id: "trademarks",
    title: "Trademarks",
    body: (
      <p>
        LearnFRC is an independent project and is{" "}
        <strong>not affiliated with or endorsed by FIRST®</strong>. FIRST®, FRC®,
        and related marks belong to FIRST. References are for identification and
        educational purposes only.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the maximum extent permitted by law, LearnFRC and its maintainers are
        not liable for any indirect or consequential damages arising from your
        use of the service. The service is provided without warranty of any kind.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Termination",
    body: (
      <p>
        You may delete your account at any time, either in{" "}
        <Link href="/settings">settings</Link> or by asking us. We may suspend or
        terminate access if these terms are violated.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        We may update these terms. The date above reflects the latest version.
        Continued use after changes means you accept them.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms? Send them through our{" "}
        <Link href={CONTACT_PATH}>contact form</Link>, no account needed. See
        also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
];

const CLAUSES: Clause[] = RULES.map(({ id, title }) => ({ id, title }));

/**
 * The terms, as the rules page at the front of the binder.
 *
 * LAYOUT: a contract, not a feature grid. Ten clauses run as one continuous
 * ledger with the ordinal hanging in the margin, opened by a single ink rule
 * and separated by dashed hairlines, so the whole document reads as one
 * agreement instead of ten equally-weighted boxes. The contents sit on the
 * first page, taped down, the way a printed rulebook prints them, which is why
 * nothing here needs to track your scroll position.
 *
 * Deliberately different from /privacy, which is the other long legal page:
 * that one leads with a table because its reader arrives with a question about
 * their own data. This one's reader arrives asking what they just agreed to, so
 * it leads with the agreement and then numbers it.
 *
 * Server Component throughout. This page ships no client JavaScript.
 */
export default function TermsPage() {
  return (
    <div className="nb-wrap max-w-[52rem] pb-[clamp(3rem,6vw,4.5rem)] pt-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">terms / the rules of the room</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">
          Ten rules, and none of them are{" "}
          <span className="nb-mark">a surprise</span>.
        </h1>
        <p className="nb-lede mt-5">
          LearnFRC is a free, independent place to learn the FIRST Robotics
          Competition. These are the terms for using it, written to be read
          rather than skipped.
        </p>
        <p className="nb-slug mt-5">
          revised {UPDATED} / {RULES.length} clauses / about a four minute read
        </p>
      </header>

      {/* ---- the agreement itself ----------------------------------------
          The one sentence with legal weight goes above the contents, not
          buried at clause nine. A note frame rather than a card, because it is
          an aside on the page, not another section of it. */}
      <p className="nb-note mt-[clamp(1.8rem,4vw,2.8rem)] max-w-[38rem]">
        <span className="nb-slug">what you are agreeing to</span>
        <span className="mt-2 block text-[0.99rem] leading-relaxed">
          By creating an account or using the service you accept these terms. If
          you don&rsquo;t accept them, don&rsquo;t use the service. Reading the
          lessons needs no account, so nothing on this page applies to you until
          you make one.
        </span>
      </p>

      <div className="mt-[clamp(1.6rem,3.4vw,2.4rem)]">
        <ClauseIndex clauses={CLAUSES} contactHref={CONTACT_PATH} />
      </div>

      {/* ---- the ledger of clauses ---------------------------------------
          Grid, not a list marker: the ordinal sits in its own column so every
          clause body starts on the same left edge no matter how long the
          number gets, which is what makes a numbered contract scannable. It
          collapses to a single column under 640px, where a 3rem gutter would
          cost a fifth of the line length. */}
      <section
        aria-label="The clauses"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink"
      >
        {RULES.map((rule, i) => (
          <section
            key={rule.id}
            id={rule.id}
            className="grid gap-x-[clamp(1rem,3vw,2.2rem)] border-b border-dashed border-rule py-[clamp(1.4rem,3vw,2.2rem)] sm:grid-cols-[3.5rem_minmax(0,38rem)]"
          >
            <p
              className="nb-slug font-bold tabular-nums text-blue sm:text-[0.95rem]"
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, "0")}
            </p>
            <div className="mt-1 sm:mt-0">
              <h2 className="text-[clamp(1.25rem,1.05rem+0.8vw,1.6rem)]">
                {rule.title}
              </h2>
              <div className="nb-prose mt-3">{rule.body}</div>
            </div>
          </section>
        ))}
      </section>

      {/* ---- the way out -------------------------------------------------- */}
      <section
        aria-labelledby="ask"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <div>
          <h2 id="ask" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            Still not sure what a clause means?
          </h2>
          <p className="nb-sub mt-3">
            One form, one person reading it. You don&rsquo;t need an account and
            you don&rsquo;t need to leave an email address unless you want an
            answer back.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={CONTACT_PATH} className="nb-btn">
            Ask about the terms
          </Link>
          <Link href="/privacy" className="nb-btn-ghost">
            Read the privacy policy
          </Link>
        </div>
      </section>

      <p className="nb-hint mt-[clamp(2rem,4vw,3rem)] max-w-[68ch]">
        LearnFRC is an independent educational project and is not affiliated with
        or endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
      </p>
    </div>
  );
}
