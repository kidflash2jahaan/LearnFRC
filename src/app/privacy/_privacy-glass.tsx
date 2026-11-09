import type { ReactNode } from "react";
import Link from "next/link";

/**
 * The record sheet. Every kind of data LearnFRC holds, why it is held, and the
 * one move that gets rid of it.
 *
 * A privacy policy is read by someone asking three questions: what do you have
 * on me, why, and how do I make it stop. Ten paragraphs make the reader
 * reassemble that answer themselves. A short ledger hands it over, and the
 * sections underneath stay for the detail. It covers the website and the app,
 * which share one account.
 *
 * The file name is historical. What used to live here was a floating glass
 * gauge whose headline figure, "88% of what we store is not personal", was
 * invented. Nothing in this table is: every row restates something the policy
 * below actually says.
 *
 * Server Component. Static rows cost no client JavaScript.
 */

type Row = { what: string; detail: string; why: string; remove: ReactNode };

export function DataLedger({
  contactHref,
  classesHref = null,
}: {
  contactHref: string;
  /**
   * The policy's "Live classes" section, only while classes are visible.
   * Null leaves the row out, so a release without classes has no trace.
   */
  classesHref?: string | null;
}) {
  const rows: Row[] = [
    {
      what: "Account",
      detail:
        "Email, name, username and password, plus your team number, role, bio and avatar if you add them. Signing in with Google or Apple shares your name and email, and Google your picture.",
      why: "Signs you in and fills your public profile.",
      remove: (
        <>
          Clear the field in{" "}
          <Link href="/settings" className="nb-link">
            settings
          </Link>
          , or delete the whole account there or in the app&rsquo;s Settings.
        </>
      ),
    },
    {
      what: "Learning activity",
      detail:
        "Lessons finished, quiz results, XP, streaks, badges, certificates and bookmarks.",
      why: "Shows your progress and issues department certificates.",
      remove: "Goes with the account when you delete it.",
    },
    ...(classesHref
      ? [
          {
            what: "Live classes",
            detail:
              "Birth month and year, a parent’s email and OK, join and leave times, video recordings, transcripts, class chat and AI notes, and the name on a teacher’s hours letter.",
            why: "Gets a parent’s OK, keeps every class safe and on topic, and counts teachers’ hours.",
            remove: (
              <>
                Recordings go after 7 days, transcripts and chat after a year,
                and most of the rest with the account. Consent proof and safety
                evidence stay longer:{" "}
                <a href={classesHref} className="nb-link">
                  see Live classes
                </a>
                .
              </>
            ),
          },
        ]
      : []),
    {
      what: "What you send",
      detail:
        "Contact messages, suggested edits, submitted lessons, helper applications, and reports and blocks.",
      why: "So we can answer, review and act on them.",
      remove: (
        <>
          Edits, submitted lessons and applications go with the account.{" "}
          <Link href={contactHref} className="nb-link">
            Ask
          </Link>{" "}
          for anything else.
        </>
      ),
    },
    {
      what: "Technical",
      detail:
        "The IP address you signed up from, IP records for rate limits, when you were last active, server logs and page counts.",
      why: "Stops abuse, keeps the service up, shows what is used.",
      remove:
        "Rate-limit records go after a day. The sign-up IP goes with the account.",
    },
    {
      what: "Newsletter",
      detail: "Your email address, and only if you opted in.",
      why: "Sends occasional updates about the site.",
      remove: (
        <>
          One click on the unsubscribe link in any email, or{" "}
          <Link href={contactHref} className="nb-link">
            ask
          </Link>
          .
        </>
      ),
    },
  ];

  return (
    <div className="nb-scroll">
      <table className="nb-table min-w-[46rem]">
        <caption className="nb-slug pb-3 text-left">
          everything LearnFRC holds, and how to get rid of it
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-[9rem]">
              what
            </th>
            <th scope="col">what it is</th>
            <th scope="col">why it is kept</th>
            <th scope="col">how to remove it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.what}>
              {/* A row header inherits the kit's 2px ink head rule and its
                  nowrap, both of which belong to the column heads above, not
                  to a label sitting in the body. */}
              <th
                scope="row"
                className="whitespace-normal border-b border-dashed border-rule align-baseline text-ink"
              >
                {r.what}
              </th>
              <td>{r.detail}</td>
              <td className="text-graphite">{r.why}</td>
              <td>{r.remove}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
