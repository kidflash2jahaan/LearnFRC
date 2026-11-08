import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { PrivacyToc, type TocItem } from "./_toc";
import { DataLedger } from "./_privacy-glass";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What LearnFRC stores about you on the website and in the app, why, who can see it, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "November 8, 2026";
// The contact form. It needs no account and no email address, so it stays the
// first way to reach us. The address is the second, for anyone who would
// rather write an email: PUBLIC_CONTACT_EMAIL, the one public contact address
// for the site, the app and the App Store listing.
const CONTACT_PATH = "/contact";
const MAILTO = `mailto:${PUBLIC_CONTACT_EMAIL}`;

/** The contact address as a link, for the running text below. */
function Email() {
  return (
    <a href={MAILTO} className="[overflow-wrap:anywhere]">
      {PUBLIC_CONTACT_EMAIL}
    </a>
  );
}

/* ---------- section registry (drives both the index and the body) ---------- */

type Section = TocItem & { body: ReactNode };

const SECTIONS: Section[] = [
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>
          <strong>Your account.</strong>{" "}Your email address, your name, a
          username and a password. The password is stored scrambled by our
          sign-in provider, so nobody at LearnFRC can read it. If you want, you
          can add your FRC team number, your role on the team, a short bio and
          a link to an avatar picture.
        </p>
        <p>
          <strong>Signing in with Google or Apple.</strong>{" "}Google gives us
          your name, email address and profile picture, and the picture becomes
          your avatar until you change it. Apple gives us your name if you
          choose to share it, and an email address, which can be a private relay
          address that forwards to your real inbox. We never see your Google or
          Apple password.
        </p>
        <p>
          <strong>Your learning.</strong>{" "}Lessons you finish, quizzes you
          pass, XP, streaks, badges, certificates and bookmarks. If you read
          without an account, lessons you finish are saved under a random ID in
          your browser or the app and on our server, and they move into your
          account if you make one.
        </p>
        <p>
          <strong>What you send us.</strong>{" "}Messages through the contact
          form (with an email address only if you leave one), edits you suggest,
          lessons you submit, and applications to help spread the word about
          LearnFRC.
        </p>
        <p>
          <strong>Reports and blocks.</strong>{" "}When you report someone, we
          store who sent the report, who it is about, what was reported (a
          profile, a suggested edit or a lesson proposal), the reason picked,
          any details added, and whether it came from the site or the app.
          When you block someone, we store that you blocked them and let
          LearnFRC&rsquo;s admins know, so they can check that account. A
          block hides that account from you and changes nothing for anyone
          else.
        </p>
        <p>
          <strong>How you found us.</strong>{" "}The site or link you first came
          from, and who invited you if you joined through someone&rsquo;s
          invite link.
        </p>
        <p>
          <strong>Technical data.</strong>{" "}The IP address you signed up from,
          kept with your account so a banned person can&rsquo;t just make a new
          one. Short-lived records of IP addresses for rate limits, deleted
          after a day. When you were last active, and standard server logs.
          Page views are recorded with the page, where you came from and a
          random ID kept in your browser, not your name or email.
        </p>
        <p>
          <strong>Newsletter.</strong>{" "}Your email address, only if you
          subscribe.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <>
        <ul>
          <li>Run your account and save your progress on the site and in the app.</li>
          <li>
            Send account email: confirming your address, password resets, a
            welcome note, answers to messages you send, and decisions on helper
            applications.
          </li>
          <li>
            Send learning reminders, only if you turn them on with the box at
            signup or the switch in Settings. Every one has a one-click
            unsubscribe.
          </li>
          <li>Send the newsletter, only if you subscribed.</li>
          <li>
            Keep the site safe: rate limits, a ban list, a filter that blocks
            profanity and slurs in names, usernames and bios, and acting on
            reports.
          </li>
          <li>
            Review suggested edits and submitted lessons. An automated AI
            reviewer reads the text you submitted, not who you are.
          </li>
          <li>Count visits and where people come from, to see what is working.</li>
        </ul>
        <p>
          We don&rsquo;t sell your data, we don&rsquo;t show ads, and we
          don&rsquo;t use advertising trackers.
        </p>
      </>
    ),
  },
  {
    id: "public",
    title: "What other people can see",
    body: (
      <>
        <p>
          <strong>Your public profile:</strong>{" "}your username, avatar, team
          number, role, bio, XP, level, badges, how many lessons you&rsquo;ve
          finished and when you joined. It can appear on the leaderboard. Your
          name and email address are never shown to other people. Your name
          only appears to you, in Settings and on your certificates.
        </p>
        <p>
          <strong>Your team.</strong>{" "}If you add a team number, other
          LearnFRC members with the same number see your username, avatar,
          role, XP, the lessons you&rsquo;ve finished and when you were last
          active. Remove the number in Settings and you leave the team view.
        </p>
        <p>
          <strong>Suggested edits</strong>{" "}are public on the{" "}
          <Link href="/contributions">contributions page</Link>, under your
          username.
        </p>
        <p>
          <strong>Helpers.</strong>{" "}If you&rsquo;re accepted as a marketing
          helper, your account gets a marketing tag. Helpers&rsquo; names are
          never shown publicly.
        </p>
        <p>
          <strong>Reports</strong>{" "}are seen only by LearnFRC&rsquo;s
          admins. We don&rsquo;t tell anyone who reported them, and blocking
          someone doesn&rsquo;t notify them.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and your device",
    body: (
      <>
        <ul>
          <li>
            <strong>Staying signed in.</strong>{" "}One essential cookie on the
            site. The app keeps your sign-in in your device&rsquo;s Keychain.
          </li>
          <li>
            <strong>Where you came from.</strong>{" "}A first-party cookie
            remembers the site or invite link that first brought you here. It
            records the source, not who you are.
          </li>
          <li>
            <strong>Your starting goal.</strong>{" "}If you answer the question
            on the start page, the answer is kept in your browser or the app for
            a year, not on your account.
          </li>
          <li>
            <strong>Small things in your browser or the app,</strong>{" "}like
            lessons finished as a guest, notices you dismissed, cached lessons,
            and reminders you set in the app, which are scheduled on your device.
          </li>
        </ul>
        <p>
          Our analytics count visits without cookies. On the site, a video loads
          from YouTube&rsquo;s privacy-enhanced player only when you press
          play; in the app, videos open in YouTube, and the app shows their
          thumbnails from YouTube&rsquo;s image server. Once a video is playing,
          YouTube&rsquo;s own privacy policy applies to it. No advertising
          cookies, and no tracking across other sites.
        </p>
      </>
    ),
  },
  {
    id: "providers",
    title: "Who helps us run it",
    body: (
      <>
        <p>A few companies handle data for us, only to run LearnFRC:</p>
        <ul>
          <li>
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
              Supabase
            </a>
            , the database and sign-in.
          </li>
          <li>
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vercel
            </a>
            , hosting and visit counts.
          </li>
          <li>
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Resend
            </a>
            , sending email.
          </li>
          <li>
            Google and Apple, only if you sign in with them, and YouTube, for
            videos.
          </li>
          <li>
            An AI model provider, which reads the text of suggested edits and
            submitted lessons so they can be reviewed.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        LearnFRC is for FRC students, who are mostly in high school. It
        isn&rsquo;t meant for children under 13. If you&rsquo;re under 13,
        don&rsquo;t make an account without a parent or guardian involved. If
        we learn we have data from a child under 13 without a parent&rsquo;s
        consent, we delete it.
      </p>
    ),
  },
  {
    id: "retention",
    title: "Keeping and deleting your data",
    body: (
      <>
        <p>
          We keep your data while your account exists. You can delete your
          account yourself at any time: on the website under{" "}
          <Link href="/settings">Settings</Link>, &ldquo;Delete my
          account&rdquo;, or in the app under Settings, &ldquo;Delete my
          account&rdquo;. It happens straight away and takes your profile,
          progress, badges, bookmarks, suggested edits, submitted lessons and
          any helper application with it. If you signed in with Apple, deleting
          your account also disconnects LearnFRC from your Apple Account.
        </p>
        <p>A few things stay after an account is deleted:</p>
        <ul>
          <li>
            Messages you sent through the contact form, no longer linked to
            your account. Ask and we&rsquo;ll delete them.
          </li>
          <li>Changes from your edits that were already merged into a lesson.</li>
          <li>
            Reports, for as long as we need them to deal with the report and
            spot repeat problems. A report someone sent is no longer linked to
            their deleted account. A report about an account keeps its handle
            and a copy of what was reported (its public profile, or the
            suggested edit or lesson proposal) as it was at the time. Blocks go
            with the account.
          </li>
          <li>
            If an account was banned, its email address and IP address stay on
            the ban list.
          </li>
          <li>Routine backups at our database provider, until they expire.</li>
        </ul>
        <p>
          The newsletter is separate: unsubscribe with the link in any issue.
          To get a copy of your data, fix something, or have anything above
          deleted, email <Email /> or use the{" "}
          <Link href={CONTACT_PATH}>contact form</Link>.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Data is encrypted in transit, each account can only read its own
        private data, and passwords are stored scrambled by our sign-in
        provider. No system is perfectly secure, but we work to protect your
        information and will tell you if something goes wrong that affects it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        If we change this policy, we update the date at the top. If a change
        affects what we collect or who can see it, we say so on the site first.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        LearnFRC is run by Jahaan Pardhanani. Questions about your data go to{" "}
        <Email />, or through the <Link href={CONTACT_PATH}>contact form</Link>,
        which needs no account. See also the{" "}
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
 * COVERS the website and the iPhone, iPad and Mac app, which share one account
 * system. Keep it true when either changes what it stores: every row of the
 * ledger restates something a section below says.
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
          LearnFRC is free to read with no account at all. If you make one, on
          the website or in the app, this page is the complete list of what
          gets stored, who can see it, and how to get rid of it.
        </p>
        <p className="nb-slug mt-5">
          revised {UPDATED} / {SECTIONS.length} sections / no ads, no data sold
        </p>
      </header>

      {/* ---- the ledger -------------------------------------------------
          The summary the rest of the page is the detail for. It is a table
          because "what, why, how do I remove it" is three columns of the same
          rows, and prose is the wrong shape for that. */}
      <section
        aria-labelledby="hold"
        className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="hold" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          What we hold
        </h2>
        <p className="nb-sub mt-3">
          LearnFRC is a free place to learn the FIRST Robotics Competition. We
          collect as little as we can, and everything we do collect is in this
          table.
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
              Delete your account yourself in Settings, on the website or in
              the app. For a copy of your data, a correction, or anything else
              deleted, email{" "}
              <a href={MAILTO} className="nb-link [overflow-wrap:anywhere]">
                {PUBLIC_CONTACT_EMAIL}
              </a>{" "}
              or send the form. It goes to one person and it gets done.
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
        </article>
      </div>
    </div>
  );
}
