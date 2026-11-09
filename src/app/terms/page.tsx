import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { FirstTrademarkNotice } from "@/components/footer";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { classesVisibleOnStaticPages } from "@/lib/classes/static-pages";
import { ClauseIndex, type Clause } from "./_contents-rail";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using LearnFRC on the website and in the app, including the rules for what you post.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "November 9, 2026";
// The contact form, which needs no account and no email address. The public
// address is the other way in, printed beside it.
const CONTACT_PATH = "/contact";
const MAILTO = `mailto:${PUBLIC_CONTACT_EMAIL}`;
const MANUAL = "https://www.firstinspires.org/robotics/frc/game-and-season";

/** The contact address as a link, for the running text below. */
function Email() {
  return (
    <a href={MAILTO} className="[overflow-wrap:anywhere]">
      {PUBLIC_CONTACT_EMAIL}
    </a>
  );
}

/* ---------- the clauses ---------- */

type Rule = Clause & { body: ReactNode };

/**
 * The live classes rule (classes-design.md section 11), shown only while
 * classes are visible. It sits right above Trademarks. Keep it in step with
 * TEACHER_CODE and the recording notice in src/lib/classes/notice.ts, and
 * the Teachers bullet with FULL_SEASON_SENTENCE in
 * src/lib/classes/teacher-rules.ts.
 */
const CLASSES_RULE: Rule = {
  id: "classes",
  title: "Live classes",
  body: (
    <>
      <p>
        Live classes are free online classes on LearnFRC, taught by FRC
        students. If you sign up for one, teach one, or say OK to one as a
        parent or guardian, these apply too.
      </p>
      <ul>
        <li>
          <strong>13 to 17 only.</strong>{" "}Teachers and students both have to
          be 13 to 17. We ask your birth month and year once, and an answer
          under 13 deletes the account. Anyone 18 or older can&rsquo;t join or
          teach. LearnFRC staff can drop into any class, and they always show
          as staff.
        </li>
        <li>
          <strong>A parent&rsquo;s OK.</strong>{" "}A parent or guardian has to
          say OK by email before you join or teach. The address has to be
          theirs, not one you control.
        </li>
        <li>
          <strong>Recorded and reviewed.</strong>{" "}Every class is recorded on
          video and transcribed by Cloudflare, and Anthropic&rsquo;s Claude AI
          reads the transcript and chat and writes notes so LearnFRC can check
          the class was safe and on topic. You accept a notice saying so
          before every class. The{" "}
          {/* {" "} after a closing tag, not a bare space: the compiler drops
              a bare one when the line holds an entity like &rsquo;. */}
          <Link href="/privacy#classes">privacy policy</Link>{" "}says
          what&rsquo;s kept and for how long.
        </li>
        <li>
          <strong>Your username is shown.</strong>{" "}Everyone in a class sees
          your LearnFRC username, so keep contact details out of your profile
          bio.
        </li>
        <li>
          <strong>Keep everything in the class.</strong>{" "}No private contact:
          no DMs, no other apps, no meeting up. Don&rsquo;t share or ask for
          personal information, like someone&rsquo;s age, school, location,
          phone number or socials. Student cameras stay off, and nobody asks
          anyone to turn one on. Don&rsquo;t try to get around the chat filter,
          which stops links outside LearnFRC and the docs, @handles, emails,
          phone numbers and other apps&rsquo; usernames. The zero-tolerance
          rule above covers everything said and sent in a class.
        </li>
        <li>
          <strong>Teachers.</strong>{" "}Teachers have finished at least one
          full FRC season: a build season and at least one official event. You
          agree to the teacher code when you
          apply: teach the topic you scheduled, remove anyone who breaks these
          rules and report it, and don&rsquo;t present a class as
          FIRST&rsquo;s or your team&rsquo;s official outreach. Report your
          hours honestly. Misreporting them ends your teaching and withdraws
          your letters.
        </li>
        <li>
          <strong>What LearnFRC can do.</strong>{" "}We can remove anyone from a
          class, end any class, pause every class and suspend a teacher, at any
          time. When something may be a safety problem we keep the recording,
          transcript and chat as evidence, and we may report it to NCMEC (the
          National Center for Missing &amp; Exploited Children) or to law
          enforcement and give them what we kept.
        </li>
        <li>
          <strong>Hours letters.</strong>{" "}A letter records teaching time
          from LearnFRC&rsquo;s records and is approved and signed by an adult
          volunteer. We don&rsquo;t promise that any school, club or program
          will accept it, so check its rules first.
        </li>
        <li>
          <strong>Not FIRST.</strong>{" "}Classes aren&rsquo;t <i>FIRST</i>{" "}
          events, and <i>FIRST</i>{" "}isn&rsquo;t overseeing, involved with,
          or responsible for them. See <a href="#trademarks">Trademarks</a>.
        </li>
      </ul>
    </>
  ),
};

/** The clauses, with live classes added when they're visible. */
function rulesFor(classes: boolean): Rule[] {
  return [
    {
      id: "eligibility",
      title: "Who can use LearnFRC",
      body: (
        <p>
          Anyone can read the lessons, no account needed. To make an account, on
          the website or in the app, you should have a parent or guardian
          involved if you&rsquo;re under 13, and their OK if you&rsquo;re under
          18. The details you sign up with should be true.
          {classes ? (
            <>
              {" "}Live classes have their own age rule: they&rsquo;re only for
              people 13 to 17 (see <a href="#classes">Live classes</a>).
            </>
          ) : null}
        </p>
      ),
    },
    {
      id: "account",
      title: "Your account",
      body: (
        <ul>
          <li>
            Keep your password to yourself. You&rsquo;re responsible for what
            happens on your account.
          </li>
          <li>
            If you sign in with Google or Apple, their terms also cover that
            sign-in.
          </li>
          <li>
            Pick a username and name that aren&rsquo;t offensive and don&rsquo;t
            pretend to be someone else.
          </li>
          <li>
            Confirm your email address to finish making an account with a
            password.
          </li>
        </ul>
      ),
    },
    {
      id: "zero-tolerance",
      title: "No objectionable content, no abuse",
      body: (
        <>
          <p>
            LearnFRC has zero tolerance for objectionable content and abusive
            users. That covers anything hateful, harassing, bullying, threatening,
            sexual or violent, plus spam, pretending to be someone else, and
            posting someone else&rsquo;s personal information. It applies to
            everything you can put on LearnFRC: your username, name, bio and
            avatar, suggested edits, submitted lessons
            {classes ? ", what you say and send in a live class" : ""} and
            anything else.
          </p>
          <ul>
            <li>
              A filter blocks profanity and slurs in names, usernames and bios
              before they&rsquo;re saved.
            </li>
            <li>
              You can report a user or something they posted, and you can block a
              user so you stop seeing them. You can also report anything by
              emailing <Email />.
            </li>
            <li>
              Every report is reviewed within 24 hours. If something breaks this
              rule, we remove it and remove the account that posted it.
            </li>
            <li>An account removed for this can&rsquo;t come back with a new one.</li>
          </ul>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Using the site fairly",
      body: (
        <>
          <p>You agree not to:</p>
          <ul>
            <li>
              Scrape, overload, or try to break the service or its security.
            </li>
            <li>Cheat or game XP, quizzes, or the leaderboard.</li>
            <li>Use LearnFRC for anything illegal.</li>
          </ul>
        </>
      ),
    },
    {
      id: "educational-content",
      title: "Educational content",
      body: (
        <p>
          Lessons and quizzes are researched from public sources and provided
          for learning. We work hard to keep them accurate, but for anything that
          matters at competition, check the current{" "}
          <a href={MANUAL} target="_blank" rel="noopener noreferrer">
            FRC Game Manual
          </a>{" "}
          and official documentation. Content is provided &ldquo;as is&rdquo;,
          without warranties.
        </p>
      ),
    },
    {
      id: "your-content",
      title: "What you post",
      body: (
        <p>
          What you post, like your profile, suggested edits and submitted
          lessons, stays yours. You let LearnFRC store and show it to run the
          service: your public profile, the contributions page, and the lesson
          itself if we accept your edit or lesson. Once an edit or lesson is
          part of a lesson, we can keep using and changing it, even after your
          account is gone. Only post what you have the right to share.
        </p>
      ),
    },
    ...(classes ? [CLASSES_RULE] : []),
    {
      id: "trademarks",
      title: "Trademarks",
      body: (
        <>
          <p>
            LearnFRC is an independent project and is{" "}
            <strong>not affiliated with, sponsored by or endorsed by FIRST</strong>.
            FIRST names are used only to identify what the lessons are about.
          </p>
          <p>
            <FirstTrademarkNotice />
          </p>
          <p>
            <i>FIRST</i>&reg; LEGO&reg; League is a jointly held trademark of{" "}
            <i>FIRST</i>&reg; (
            <a href="https://www.firstinspires.org" target="_blank" rel="noopener noreferrer">
              www.firstinspires.org
            </a>
            ) and the LEGO Group, neither of which is overseeing, involved with,
            or responsible for this activity, product, or service. FRC game
            names, like REBUILT&trade;, are trademarks of <i>FIRST</i>.
          </p>
        </>
      ),
    },
    {
      id: "liability",
      title: "Limitation of liability",
      body: (
        <p>
          To the fullest extent the law allows, LearnFRC and the people who run
          it aren&rsquo;t liable for indirect or consequential damages from your
          use of the service. The service is provided without warranty of any
          kind.
        </p>
      ),
    },
    {
      id: "termination",
      title: "Ending your account",
      body: (
        <p>
          You can delete your account at any time: on the website under{" "}
          <Link href="/settings">Settings</Link>, &ldquo;Delete my account&rdquo;,
          or in the app under Settings, &ldquo;Delete my account&rdquo;. You can
          also ask us to do it. We can suspend or remove an account that breaks
          these terms, without warning when the rule broken is the one on
          objectionable content and abuse.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes",
      body: (
        <p>
          We may update these terms. The date at the top shows the latest
          version, and using LearnFRC after a change means you accept it.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <p>
          LearnFRC is run by Jahaan Pardhanani. Questions about these terms go
          to <Email />, or through the <Link href={CONTACT_PATH}>contact form</Link>,
          no account needed. See also the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      ),
    },
  ];
}

/** The clause count in words, for the headline. Digits past twenty. */
const COUNT_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];

/**
 * The terms, as the rules page at the front of the binder.
 *
 * LAYOUT: a contract, not a feature grid. The clauses run as one continuous
 * ledger with the ordinal hanging in the margin, opened by a single ink rule
 * and separated by dashed hairlines, so the whole document reads as one
 * agreement instead of a dozen equally-weighted boxes. The contents sit on the
 * first page, taped down, the way a printed rulebook prints them, which is why
 * nothing here needs to track your scroll position.
 *
 * Deliberately different from /privacy, which is the other long legal page:
 * that one leads with a table because its reader arrives with a question about
 * their own data. This one's reader arrives asking what they just agreed to, so
 * it leads with the agreement and then numbers it.
 *
 * COVERS the website and the app. The "No objectionable content, no abuse"
 * clause is what App Review guideline 1.2 asks every app with user content to
 * put in its terms: zero tolerance, reporting, blocking, and reports acted on
 * within 24 hours. Don't soften it without changing how reports are handled.
 *
 * The "Live classes" clause, and the lines that point at it, show only while
 * classes are visible (a cached read, see src/lib/classes/static-pages.ts).
 *
 * Server Component throughout. This page ships no client JavaScript.
 */
export default async function TermsPage() {
  const classes = await classesVisibleOnStaticPages();
  const rules = rulesFor(classes);
  const clauses: Clause[] = rules.map(({ id, title }) => ({ id, title }));
  const count = COUNT_WORDS[rules.length] ?? String(rules.length);
  return (
    <div className="nb-wrap max-w-[52rem] pb-[clamp(3rem,6vw,4.5rem)] pt-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">terms / the rules of the room</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">
          {count} rules, and none of them are{" "}
          <span className="nb-mark">a surprise</span>.
        </h1>
        <p className="nb-lede mt-5">
          LearnFRC is a free, independent place to learn the FIRST Robotics
          Competition, on the website and in the app. These are the terms for
          using it, written to be read rather than skipped.
        </p>
        <p className="nb-slug mt-5">
          revised {UPDATED} / {rules.length} clauses / about a{" "}
          {classes ? "six" : "four"} minute read
        </p>
      </header>

      {/* ---- the agreement itself ----------------------------------------
          The one sentence with legal weight goes above the contents, not
          buried at the end. A note frame rather than a card, because it is
          an aside on the page, not another section of it. */}
      <p className="nb-note mt-[clamp(1.8rem,4vw,2.8rem)] max-w-[38rem]">
        <span className="nb-slug">what you are agreeing to</span>
        <span className="mt-2 block text-[0.99rem] leading-relaxed">
          By making an account or using LearnFRC, on the website or in the app,
          you accept these terms. If you don&rsquo;t accept them, don&rsquo;t
          use it. Reading the lessons needs no account, and most of these rules
          only matter once you make one.
        </span>
      </p>

      <div className="mt-[clamp(1.6rem,3.4vw,2.4rem)]">
        <ClauseIndex clauses={clauses} contactHref={CONTACT_PATH} />
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
        {rules.map((rule, i) => (
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
            Email{" "}
            <a href={MAILTO} className="nb-link [overflow-wrap:anywhere]">
              {PUBLIC_CONTACT_EMAIL}
            </a>{" "}
            or use the form. One person reads it, and the form needs no account
            and no email address unless you want an answer back.
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
    </div>
  );
}
