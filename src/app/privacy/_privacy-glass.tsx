import type { ReactNode } from "react";
import Link from "next/link";

/**
 * The record sheet. Every kind of data LearnFRC holds, why it is held, and the
 * one move that gets rid of it.
 *
 * A privacy policy is read by someone asking three questions: what do you have
 * on me, why, and how do I make it stop. Ten paragraphs make the reader
 * reassemble that answer themselves. A four-row ledger hands it over, and the
 * sections underneath stay for the detail.
 *
 * The file name is historical. What used to live here was a floating glass
 * gauge whose headline figure, "88% of what we store is not personal", was
 * invented. Nothing in this table is: every row restates something the policy
 * below actually says.
 *
 * Server Component. Four static rows cost no client JavaScript.
 */

type Row = { what: string; detail: string; why: string; remove: ReactNode };

export function DataLedger({ contactHref }: { contactHref: string }) {
  const rows: Row[] = [
    {
      what: "Account",
      detail:
        "Email, display name, username, and optionally your team number, role, bio and avatar.",
      why: "Signs you in and fills your public profile.",
      remove: (
        <>
          Clear the field in{" "}
          <Link href="/settings" className="nb-link">
            settings
          </Link>
          , or delete the whole account there.
        </>
      ),
    },
    {
      what: "Learning activity",
      detail:
        "Lessons finished, quiz results, XP, streaks, badges and bookmarks.",
      why: "Shows your progress and issues department certificates.",
      remove: "Goes with the account when you delete it.",
    },
    {
      what: "Technical",
      detail: "A temporary record of your IP address, plus standard server logs.",
      why: "Rate-limits abuse and keeps the service up.",
      remove: "Expires on its own. Nothing for you to do.",
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
