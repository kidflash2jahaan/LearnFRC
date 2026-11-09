import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { classesVisibleOnStaticPages } from "@/lib/classes/static-pages";
import { PrivacyToc, type TocItem } from "./_toc";
import { DataLedger } from "./_privacy-glass";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What LearnFRC stores about you on the website and in the app, why, who can see it, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "November 9, 2026";
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

/* ---------- live classes (classes-design.md section 11) ----------
   Everything about classes shows only while classes are visible, so a
   release without them carries no trace of them. The recording notice links
   to #classes, so the id is load-bearing. Every row of the retention table
   restates section 3.10 of the design: change them together. */

const CLASSES_ID = "classes";

/** How long each kind of classes data is kept (design 3.10). */
const CLASS_RETENTION: { what: string; where: string; kept: string }[] = [
  {
    what: "Video recordings, and the audio file used for the transcript",
    where: "Cloudflare",
    kept: "7 days, then deleted",
  },
  {
    what: "A recording kept as evidence",
    where: "A private Cloudflare storage bucket",
    kept: "1 year from the hold, longer only if a report or law enforcement needs it",
  },
  {
    what: "Transcripts",
    where: "Cloudflare, and our copy",
    kept: "7 days at Cloudflare. Ours for 1 year after the class, unless it’s kept as evidence",
  },
  {
    what: "Class chat, including messages the filter stopped",
    where: "Our database",
    kept: "1 year after the class, unless it’s kept as evidence",
  },
  {
    what: "AI notes, join and leave times, camera and screen-share times, teaching minutes",
    where: "Our database",
    kept: "As long as the class’s record exists, since hours letters depend on it",
  },
  {
    what: "Birth month and year",
    where: "Our database",
    kept: "While your account exists",
  },
  {
    what: "Teacher applications",
    where: "Our database",
    kept: "Turned down or withdrawn: 180 days after that. Accepted: while your account exists. An adult reference’s name and email: until the application is decided or withdrawn",
  },
  {
    what: "A parent’s email and answer, and the recording notices you accepted",
    where: "Our database",
    kept: "While your account exists, then until 1 year after it’s deleted or the end of the year you turn 19, whichever is later",
  },
  {
    what: "Evidence holds",
    where: "Our database and the private bucket",
    kept: "1 year, then deleted unless it’s extended for a report or law enforcement",
  },
  {
    what: "Messages Cloudflare sends us about who joined and left",
    where: "Our database",
    kept: "90 days",
  },
  {
    what: "Meeting and participant records (your username and an internal ID)",
    where: "Cloudflare",
    kept: "Indefinitely, on Cloudflare’s side. We delete yours when you delete your account",
  },
  {
    what: "Call analytics (the IP address, city and device of each connection)",
    where: "Cloudflare",
    kept: "6 months, and we can’t delete them",
  },
];

const CLASSES_BODY: ReactNode = (
  <>
    <p>
      Live classes are free online classes on LearnFRC, taught by FRC
      students. They&rsquo;re only for people 13 to 17, as teachers and as
      students. This section adds to the rest of the policy, and it only
      matters if you sign up for a class, teach one, or are the parent or
      guardian who says OK.
    </p>
    <p>
      <strong>What we collect for classes.</strong>
    </p>
    <ul>
      <li>
        Your birth month and year, asked once before your first class, so we
        know whether you can take part and whether a parent or guardian needs
        to say OK.
      </li>
      <li>
        Your parent or guardian&rsquo;s email address. When they answer: their
        answer, the name they type, the time, their browser, and a scrambled
        code made from their network address.
      </li>
      <li>
        If you apply to teach: your answers on the application, including your
        FRC seasons, team numbers and the events you went to, the name your
        school knows you by, which goes on hours letters, and an adult
        reference&rsquo;s name and email if you add one. We only email a
        reference if we can&rsquo;t confirm your seasons from event results,
        and only to ask whether you were on the team, and we delete their name
        and email once your application is decided or withdrawn. While you
        write, the form keeps a draft in that browser on that device; sending
        the application, clearing the draft or signing out there deletes
        it.
      </li>
      <li>
        The classes you sign up for or teach, each time you accept the
        recording notice, and when you joined and left each class.
      </li>
      <li>
        Scrambled codes made from your network (IP) address when you ask for
        a parent&rsquo;s OK and each time you accept the notice, never the
        address itself. They show us when two people join from the same
        network.
      </li>
      <li>When a camera or screen share was on in a class, and whose.</li>
      <li>
        A video recording of every class: what&rsquo;s said, and any camera or
        screen share that&rsquo;s on. Student cameras can&rsquo;t be turned on.
      </li>
      <li>A transcript of each class that shows who said what.</li>
      <li>
        The class chat, including messages the chat filter stopped before
        anyone else saw them.
      </li>
      <li>
        Notes on each class, written by Anthropic&rsquo;s Claude AI from the
        transcript and chat: a summary and a list of things to check.
      </li>
      <li>
        Hours letters: the name on the letter, the classes and minutes it
        covers, and its verify code.
      </li>
      <li>
        Evidence holds. When something may be a safety problem, like an
        urgent flag in the notes, a report about a class or a ban, we keep a
        copy of the class&rsquo;s recording, transcript and chat, the email
        address and username of the person involved, and Cloudflare&rsquo;s
        connection details (IP address, city and device) for the people
        involved and the teacher.
      </li>
    </ul>
    <p>
      We use it to run classes, get a parent&rsquo;s OK, check that every
      class was safe and on topic, count teachers&rsquo; minutes, issue hours
      letters, and act on reports.
    </p>
    <p>
      <strong>Who sees it.</strong>
    </p>
    <ul>
      <li>
        Everyone in a class sees everyone else&rsquo;s LearnFRC username and
        the class chat. A username leads to a public profile, so your bio has
        to be free of contact details before you join or teach.
      </li>
      <li>
        Signed in, you see a class&rsquo;s teacher&rsquo;s username in the
        class list. Signed-out visitors never see a username anywhere in
        classes, and the homepage shows none to anyone.
      </li>
      <li>
        Jahaan Pardhanani, who runs LearnFRC, and Dhiren Pardhanani, an adult
        volunteer who is LearnFRC&rsquo;s safety lead and signs hours letters,
        can see everything above. Anything about possible sexual content,
        grooming or exploitation is seen only by Dhiren.
      </li>
      <li>
        Your parent or guardian gets one email from us about classes, and you
        get an email when they answer.
      </li>
      <li>
        Anyone with an hours letter&rsquo;s verify code can see the name on
        it, its dates, its total time and its list of classes. That&rsquo;s
        how a school checks a letter.
      </li>
    </ul>
    <p>
      <strong>Who helps run classes.</strong>
    </p>
    <ul>
      <li>
        Cloudflare runs the video, records and transcribes classes, and stores
        evidence holds. It gets your username and an internal ID number, never
        your email address.
      </li>
      <li>
        Anthropic&rsquo;s Claude writes the class notes. The transcript and
        chat reach it through Vercel&rsquo;s AI Gateway with zero data
        retention, so Anthropic doesn&rsquo;t keep them or train on them.
        People in them are labeled by role and age range, not by username.
      </li>
      <li>Supabase stores the rest and delivers the class chat.</li>
      <li>Resend sends class emails.</li>
    </ul>
    <p>
      <strong>Cloudflare&rsquo;s own records.</strong>{" "}Cloudflare keeps a
      record of every meeting and participant indefinitely. Yours holds only
      your LearnFRC username and an internal ID, and we delete it when you
      delete your account. Cloudflare also keeps call analytics, with the IP
      address, city and device of each connection, for 6 months, and we
      can&rsquo;t delete those.
    </p>
    <p>
      <strong>How long it&rsquo;s kept.</strong>
    </p>
    <div className="nb-scroll">
      <table className="min-w-[34rem]">
        <caption className="sr-only">
          How long each kind of live classes data is kept, and where.
        </caption>
        <thead>
          <tr>
            <th scope="col">what</th>
            <th scope="col">where</th>
            <th scope="col">how long</th>
          </tr>
        </thead>
        <tbody>
          {CLASS_RETENTION.map((r) => (
            <tr key={r.what}>
              <td>{r.what}</td>
              <td>{r.where}</td>
              <td>{r.kept}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p>
      <strong>After an account is deleted.</strong>{" "}Its classes data goes
      with it, except for three things: the recording notices it accepted and
      its parent&rsquo;s OK, kept with its username as proof for the time in
      the table; evidence holds, for their year; and attendance, no longer
      linked to the account, so a teacher&rsquo;s minutes keep their proof.
      Deleting a teacher&rsquo;s account cancels their upcoming classes and
      deletes their hours letters, so those letters&rsquo; verify links stop
      working.
    </p>
    <p>
      <strong>Safety.</strong>{" "}If a class shows that someone may be in
      danger or that a child is being exploited, we may give what we kept,
      including evidence holds and consent records, to NCMEC (the National
      Center for Missing &amp; Exploited Children) or to law enforcement. That
      can happen after the account is deleted, too.
    </p>
    <p>
      <strong>Ages.</strong>{" "}Classes are only for 13 to 17. An age answer
      under 13 deletes the account straight away (see{" "}
      <a href="#children">Children</a>). Anyone 18 or older can&rsquo;t join
      or teach.
    </p>
  </>
);

/* ---------- section registry (drives both the index and the body) ---------- */

type Section = TocItem & { body: ReactNode };

/** The policy's sections, with live classes woven in when they're visible. */
function sectionsFor(classes: boolean): Section[] {
  return [
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
            and lessons you submit.
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
          {classes ? (
            <p>
              <strong>Live classes.</strong>{" "}If you join or teach a live
              class, or say OK to one as a parent, we collect more, like a
              video recording of each class, a transcript, the class chat and
              AI notes. It&rsquo;s all listed under{" "}
              <a href={`#${CLASSES_ID}`}>Live classes</a>. A report can also be
              about someone in a class, and then it stores which class.
            </p>
          ) : null}
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
              welcome note, answers to messages you send, and decisions on
              applications you send.
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
            {classes ? (
              <li>
                Run live classes: get a parent&rsquo;s OK, record and transcribe
                every class, have an AI write notes on it, review it for safety,
                and count teachers&rsquo; minutes for hours letters. See{" "}
                <a href={`#${CLASSES_ID}`}>Live classes</a>.
              </li>
            ) : null}
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
          {classes ? (
            <p>
              <strong>Live classes.</strong>{" "}Everyone in a class sees your
              username and what you send in the class chat. Signed-out visitors
              never see a username in classes. A teacher&rsquo;s hours letter
              shows their name to anyone with its verify code. See{" "}
              <a href={`#${CLASSES_ID}`}>Live classes</a>.
            </p>
          ) : null}
          <p>
            <strong>Reports</strong>{" "}are seen only by LearnFRC&rsquo;s
            admins. We don&rsquo;t tell anyone who reported them, and blocking
            someone doesn&rsquo;t notify them.
          </p>
        </>
      ),
    },
    ...(classes ? [{ id: CLASSES_ID, title: "Live classes", body: CLASSES_BODY }] : []),
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
            {classes ? (
              <li>
                <strong>Live classes.</strong>{" "}If the age question for
                classes is answered with an age under 13, a cookie stays on that
                device for a year. It holds no personal data and only means
                classes aren&rsquo;t offered there. When a parent opens the link
                in our email, a cookie holds the link&rsquo;s code for up to an
                hour, so the code never shows in the address bar.
              </li>
            ) : null}
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
              , the database and sign-in{classes ? ", and delivering class chat" : ""}.
            </li>
            <li>
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel
              </a>
              , hosting and visit counts
              {classes
                ? ", and the AI Gateway that passes class transcripts and chat to Anthropic with zero data retention"
                : ""}
              .
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
            {classes ? (
              <>
                <li>
                  <a
                    href="https://www.cloudflare.com/privacypolicy/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Cloudflare
                  </a>
                  , live class video, recording, transcription, and storage for
                  evidence holds.
                </li>
                <li>
                  <a
                    href="https://www.anthropic.com/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Anthropic
                  </a>
                  , whose Claude AI writes notes on each live class from its
                  transcript and chat, reached through Vercel&rsquo;s AI Gateway
                  with zero data retention.
                </li>
              </>
            ) : null}
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
        <>
          <p>
            LearnFRC is for FRC students, who are mostly in high school. It
            isn&rsquo;t meant for children under 13. If you&rsquo;re under 13,
            don&rsquo;t make an account without a parent or guardian involved. If
            we learn we have data from a child under 13 without a parent&rsquo;s
            consent, we delete it.
          </p>
          {classes ? (
            <p>
              Live classes are only for people 13 to 17. Before anyone joins or
              teaches a class, we ask their birth month and year once. If the
              answer is under 13, we delete the account straight away and
              don&rsquo;t keep the answer, and a cookie stops classes being
              offered on that device. Anyone 13 to 17 needs a parent or
              guardian&rsquo;s OK by email before they join or teach. See{" "}
              <a href={`#${CLASSES_ID}`}>Live classes</a>.
            </p>
          ) : null}
        </>
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
            any application you sent with it
            {classes ? ", and your live classes data apart from what’s listed below" : ""}.
            If you signed in with Apple, deleting
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
            {classes ? (
              <li>
                From live classes: the recording notices you accepted and your
                parent&rsquo;s OK, kept as proof; evidence holds, for their
                year; and attendance, no longer linked to you, so a
                teacher&rsquo;s minutes keep their proof. How long each is kept
                is under <a href={`#${CLASSES_ID}`}>Live classes</a>, and safety
                evidence may go to NCMEC or law enforcement.
              </li>
            ) : null}
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
}

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
 * Live classes add a section, a ledger row and lines in five other sections,
 * all only while classes are visible (a cached read, see
 * src/lib/classes/static-pages.ts), so the page stays static.
 *
 * Server Component. The index is the single client leaf, and only because it
 * has to know which section you are looking at.
 */
export default async function PrivacyPage() {
  const classes = await classesVisibleOnStaticPages();
  const sections = sectionsFor(classes);
  const tocItems: TocItem[] = sections.map(({ id, title }) => ({ id, title }));
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
          revised {UPDATED} / {sections.length} sections / no ads, no data sold
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
          <DataLedger contactHref={CONTACT_PATH} classesHref={classes ? `#${CLASSES_ID}` : null} />
        </div>
      </section>

      {/* ---- index + policy body ---------------------------------------
          The index is desktop-only on purpose. On a phone it would be four
          hundred pixels of contents before the first sentence, and the table
          above has already answered the question most readers came with. */}
      <div className="mt-[clamp(2.4rem,5vw,3.6rem)] gap-[clamp(2rem,4vw,3.4rem)] lg:grid lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <div className="nb-box sticky top-24 p-3">
            <PrivacyToc items={tocItems} />
          </div>
        </div>

        {/* The measure is capped here rather than left to `nb-prose`. That
            class asks for 68ch, but `ch` is the width of a zero, and in
            Bricolage 68 of them is 93 characters of running text: half again
            the 65-ish the system asks for. globals.css belongs to the
            foundation, so the reading column is held in rem at the page level
            instead, and every block in it shares the one measure. */}
        <article className="max-w-[38rem]">
          {sections.map((s, i) => (
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
