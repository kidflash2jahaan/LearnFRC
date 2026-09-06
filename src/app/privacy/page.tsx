import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyToc, type TocItem } from "./_toc";
import { DataLedger } from "./_privacy-glass";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LearnFRC collects, uses, and protects your information.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "July 3, 2026";
// NOT an email address. learnfrc.com publishes no MX record, so every address
// printed here bounced, including the one on the legally-operative "request
// deletion of your data" line. A personal mailbox is not an option either:
// the maintainer is a minor, and a school address publishes his surname,
// initials, graduating year and school to every scraper that reads this page.
// /contact is an anonymous form that reaches the same inbox and actually works.
const CONTACT_PATH = "/contact";

/* ---------- section registry (drives both the index and the body) ---------- */

type Section = TocItem & { body: ReactNode };

const SECTIONS: Section[] = [
  {
    id: "collect",
    title: "Information we collect",
    body: (
      <>
        <p>
          <strong>Account information</strong>{" "}you provide when you sign up: your
          email address, display name, username, and optionally your FRC team
          number, role, bio, and avatar.
        </p>
        <p>
          <strong>Learning activity</strong>{" "}we store so we can show your
          progress: lessons you complete, quiz completions, XP, streaks, badges,
          and bookmarks.
        </p>
        <p>
          <strong>Technical data</strong>{" "}such as a temporary record of your IP
          address, used only to rate-limit abuse and keep the service secure,
          plus standard server logs.
        </p>
        <p>
          <strong>Newsletter.</strong>{" "}If you opt in, we keep your email so we
          can send occasional updates.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use your information",
    body: (
      <ul>
        <li>Create and operate your account and save your progress.</li>
        <li>
          Send essential emails: email verification, welcome, password reset.
        </li>
        <li>
          Send occasional learning reminders to account holders, like your next
          lesson or a streak about to end. These are on by default and every one
          carries a one-click unsubscribe. Opting out stops them permanently.
        </li>
        <li>Send product updates only if you subscribed to the newsletter.</li>
        <li>Prevent abuse, spam, and security incidents.</li>
      </ul>
    ),
  },
  {
    id: "public",
    title: "What is public",
    body: (
      <>
        <p>
          Your <strong>public profile</strong>{" "}(username, display name, team
          number, XP, level, and badges) is visible to others and may appear on
          the leaderboard. Your email address is never shown publicly. You can
          change these details in your settings.
        </p>
        <p>
          <strong>Team visibility.</strong>{" "}If you provide your FRC team number,
          you are automatically grouped with other registered users who entered
          the same team number. Members of the same team can see each
          other&rsquo;s <strong>learning progress</strong>{" "}(lessons completed,
          XP, level, badges, and last activity) along with your display name,
          unless you turn on &ldquo;hide my name,&rdquo; in which case your
          username is shown instead. Your email is never shared. If you
          don&rsquo;t want to appear in a team view, leave your team number blank
          (or remove it) in your settings.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <p>We keep cookies to a minimum and use them only for the essentials:</p>
        <ul>
          <li>
            <strong>Staying signed in.</strong>{" "}One essential cookie keeps you
            logged in as you move around the site.
          </li>
          <li>
            <strong>Where you came from.</strong>{" "}A first-party cookie remembers
            how you first found LearnFRC, say a forum link or a teammate&rsquo;s
            invite, so we can see which channels actually help people discover
            us. It records the source, not who you are, and it never follows you
            across other sites.
          </li>
          <li>
            <strong>Article views.</strong>{" "}We tally anonymous, aggregate view
            counts on guides to see what is useful. These counts aren&rsquo;t
            linked to your account, and your browser&rsquo;s sessionStorage is
            used only to avoid double-counting the same visit.
          </li>
        </ul>
        <p>
          We do <strong>not</strong>{" "}use advertising cookies or cross-site
          tracking, and we never sell your data.
        </p>
      </>
    ),
  },
  {
    id: "providers",
    title: "Service providers",
    body: (
      <>
        <p>We rely on a few trusted providers to run LearnFRC:</p>
        <ul>
          <li>
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Supabase
            </a>
            , database and authentication.
          </li>
          <li>
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vercel
            </a>
            , hosting and analytics.
          </li>
          <li>
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Resend
            </a>
            , sending transactional and newsletter email.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "children",
    title: "Children's privacy",
    body: (
      <p>
        LearnFRC is intended for FRC participants, who are generally high-school
        students. It is not directed to children under 13. If you are under 13,
        please do not create an account without a parent or guardian&rsquo;s
        involvement. If we learn we have collected data from a child under 13
        without consent, we will delete it.
      </p>
    ),
  },
  {
    id: "retention",
    title: "Keeping and deleting your data",
    body: (
      <p>
        We keep your account data while your account is active. You can request
        access to, correction of, or deletion of your data, including full
        account deletion, through our{" "}
        <Link href={CONTACT_PATH}>contact form</Link>. No account is needed to
        send it, and you don&rsquo;t have to give us an email address unless you
        want a reply.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Data is encrypted in transit, access is restricted with row-level
        security, and passwords are hashed by our authentication provider, so we
        never see them. No system is perfectly secure, but we work to protect
        your information.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        We may update this policy. When we do, we revise the date above.
        Significant changes are highlighted on the site.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions? Send them through our{" "}
        <Link href={CONTACT_PATH}>contact form</Link>. See also our{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

const TOC_ITEMS: TocItem[] = SECTIONS.map(({ id, title }) => ({ id, title }));

/**
 * The privacy policy, as the records page of the binder.
 *
 * LAYOUT: the reader arrives with three questions, so the answer to all three
 * is a ledger at the top rather than the tenth paragraph of section seven.
 * Under it, the policy runs as a single ruled column with a numbered index
 * pinned beside it. Deliberately card-free: a legal document is one continuous
 * argument, and wrapping each clause in its own box makes ten equal boxes,
 * which is exactly the shape that says "nobody read this". The only box on the
 * page is the deletion card, because that is the one thing a reader might have
 * come here to do.
 *
 * Server Component. The index is the single client leaf, and only because it
 * has to know which section you are looking at.
 */
export default function PrivacyPage() {
  return (
    <div className="nb-wrap max-w-[60rem] pb-[clamp(3rem,6vw,4.5rem)] pt-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">privacy / the record sheet</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">
          What we keep, and how to <span className="nb-mark">delete it</span>.
        </h1>
        <p className="nb-lede mt-5">
          LearnFRC is free to read with no account at all. If you make one, this
          page is the complete list of what gets stored, why it is stored, and
          the move that gets rid of each piece.
        </p>
        <p className="nb-slug mt-5">
          revised {UPDATED} / {SECTIONS.length} sections / no advertising
          cookies, no data sold
        </p>
      </header>

      {/* ---- the ledger -------------------------------------------------
          The summary the rest of the page is the detail for. It is a table
          because "what, why, how do I remove it" is three columns of the same
          four rows, and prose is the wrong shape for that. */}
      <section
        aria-labelledby="hold"
        className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="hold" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          What we hold
        </h2>
        <p className="nb-sub mt-3">
          LearnFRC is a free educational platform for learning the FIRST Robotics
          Competition. We aim to collect as little as possible, and everything we
          do collect is in this table.
        </p>
        <div className="mt-6">
          <DataLedger contactHref={CONTACT_PATH} />
        </div>
      </section>

      {/* ---- index + policy body ---------------------------------------
          The index is desktop-only on purpose. On a phone it would be four
          hundred pixels of contents before the first sentence, and the table
          above has already answered the question most readers came with. */}
      <div className="mt-[clamp(2.4rem,5vw,3.6rem)] gap-[clamp(2rem,4vw,3.4rem)] lg:grid lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <div className="nb-box sticky top-24 p-3">
            <PrivacyToc items={TOC_ITEMS} />
          </div>
        </div>

        {/* The measure is capped here rather than left to `nb-prose`. That
            class asks for 68ch, but `ch` is the width of a zero, and in
            Bricolage 68 of them is 93 characters of running text: half again
            the 65-ish the system asks for. globals.css belongs to the
            foundation, so the reading column is held in rem at the page level
            instead, and every block in it shares the one measure. */}
        <article className="max-w-[38rem]">
          {SECTIONS.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              className="mt-[clamp(1.8rem,3.6vw,2.8rem)] border-t-2 border-ink pt-[clamp(1.3rem,2.6vw,2rem)] first:mt-0"
            >
              <div className="flex items-baseline gap-3">
                <span className="nb-slug shrink-0 font-bold tabular-nums text-blue">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-[clamp(1.3rem,1.05rem+0.9vw,1.75rem)]">
                  {s.title}
                </h2>
              </div>
              <div className="nb-prose mt-4">{s.body}</div>
            </section>
          ))}

          {/* ---- the one thing a reader might be here to do -------------- */}
          <div className="nb-box nb-tilt-2 mt-[clamp(2.4rem,5vw,3.4rem)] p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span
              className="nb-tape -top-3 left-[16%] rotate-[-3.6deg]"
              aria-hidden="true"
            />
            <p className="nb-slug">request / access, correction or deletion</p>
            <p className="mt-3 max-w-[54ch] text-[0.99rem] leading-relaxed">
              Ask for a copy of your data, a correction to it, or the whole
              account gone. It goes to one person and it gets done. You
              don&rsquo;t need an account to send the request, and you
              don&rsquo;t have to leave an email address unless you want the
              answer.
            </p>
            <div className="nb-hair mt-5 flex flex-wrap items-center gap-3 pt-5">
              <Link href={CONTACT_PATH} className="nb-btn">
                Send the request
              </Link>
              {/* Short on purpose. `.nb-btn` is `white-space: nowrap`, so a
                  long label cannot wrap and simply runs off the right edge of
                  a 320px screen. The paragraph above already says you can do
                  it yourself. */}
              <Link href="/settings" className="nb-btn-ghost">
                Delete it in settings
              </Link>
            </div>
          </div>

          <p className="nb-hint mt-[clamp(2rem,4vw,3rem)] max-w-[68ch]">
            LearnFRC is an independent educational project and is not affiliated
            with or endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
          </p>
        </article>
      </div>
    </div>
  );
}
