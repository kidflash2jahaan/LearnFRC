import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/report-form";
import { getPublicContributions } from "@/lib/queries";
import {
  formatLogDate,
  sortedCorrections,
  type Correction,
  type CorrectionStatus,
} from "@/lib/corrections";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC", so don't repeat it here.
  title: "Corrections log",
  description:
    "Every substantive correction to a LearnFRC lesson or article: what was wrong, what it says now, and the source we checked it against, plus the problems we know about and haven't fixed yet.",
  alternates: { canonical: "/corrections" },
};

// Reader-submitted edits merge on their own schedule; the editorial half of the
// log is a constant, so this only needs to be fresh-ish.
export const revalidate = 300;

/**
 * A status stamp.
 *
 * There is one accent in this system, so status cannot be a hue. It is carried
 * by three physically different marks, each of which also says what it means in
 * words: a filled blue chip for a fix that shipped, a heavy 3px ink edge for a
 * problem still open (the same weight `nb-error` and an invalid input use), and
 * a plain drawn chip for a report that turned out not to be an error. All three
 * survive a greyscale photocopy, which is the actual test.
 */
const STAMP: Record<CorrectionStatus, { label: string; className: string }> = {
  corrected: { label: "corrected", className: "" },
  open: { label: "not fixed yet", className: "border-[3px]" },
  checked: { label: "checked, no error", className: "border-dashed" },
};

function Stamp({ status }: { status: CorrectionStatus }) {
  const s = STAMP[status];
  return (
    <span className={`nb-tag ${s.className}`} data-on={status === "corrected" ? "" : undefined}>
      {s.label}
    </span>
  );
}

/**
 * One entry in the log.
 *
 * Deliberately not a card. Fifteen identical bordered cards is a wall, and a
 * reader scanning for "has this bitten me yet" needs the date and the status in
 * a fixed left gutter they can run their eye down. So the log is ruled: a
 * carbon-copy column of dates and stamps, and the account of what happened in
 * the flexible column beside it.
 */
function Entry({ c }: { c: Correction }) {
  const raisedLabel = c.status === "corrected" ? "What was wrong" : "What was raised";
  const outcomeLabel =
    c.status === "corrected"
      ? "What it says now"
      : c.status === "open"
        ? "Where it stands"
        : "What we found";

  return (
    <li
      id={c.id}
      className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-3 border-b border-dashed border-rule py-[clamp(1.3rem,2.6vw,2rem)] md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
    >
      {/* left gutter: when, and what state it is in */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:block">
        <time dateTime={c.date} className="nb-slug block font-bold text-ink">
          {formatLogDate(c.date)}
        </time>
        <span className="md:mt-2.5 md:block">
          <Stamp status={c.status} />
        </span>
        {c.affects.length > 0 && (
          <p className="nb-slug mt-0 w-full md:mt-3">
            {c.affects.map((t, i) => (
              <span key={t.path}>
                <Link href={t.path} className="nb-link text-[0.78rem]">
                  {t.title}
                </Link>
                {i < c.affects.length - 1 && <span aria-hidden="true">, </span>}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* right: the account */}
      <div className="min-w-0">
        <h3 className="text-[clamp(1.1rem,1rem+0.5vw,1.35rem)]">
          <a href={`#${c.id}`} className="text-ink no-underline hover:text-blue">
            {c.summary}
          </a>
        </h3>

        <dl className="mt-4 max-w-[68ch]">
          <dt className="nb-slug font-bold text-ink">{raisedLabel}</dt>
          <dd className="mt-1 text-[0.97rem] leading-relaxed text-graphite">{c.raised}</dd>
          <dt className="nb-slug mt-3 font-bold text-ink">{outcomeLabel}</dt>
          <dd className="mt-1 text-[0.97rem] leading-relaxed text-graphite">{c.outcome}</dd>
        </dl>

        {c.quote && (
          <figure className="mt-4 max-w-[68ch]">
            <figcaption className="nb-slug">what the page says now</figcaption>
            <blockquote className="mt-1.5 border-l-[3px] border-blue pl-3 text-[0.97rem] leading-relaxed">
              {c.quote}
            </blockquote>
          </figure>
        )}

        {(c.sources?.length || c.reportedAt) && (
          <ul className="nb-hair mt-4 flex list-none flex-col gap-1.5 pt-3">
            {c.sources?.map((s) => (
              <li key={s.url} className="nb-slug">
                source /{" "}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nb-link text-[0.78rem]"
                >
                  {s.title}
                </a>
              </li>
            ))}
            {c.reportedAt && (
              <li className="nb-slug">
                reported /{" "}
                <a
                  href={c.reportedAt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nb-link text-[0.78rem]"
                >
                  {c.reportedAt.title}
                </a>
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

export default async function CorrectionsPage() {
  const entries = sortedCorrections();
  const open = entries.filter((c) => c.status === "open");
  const logged = entries.filter((c) => c.status !== "open");
  const correctedCount = entries.filter((c) => c.status === "corrected").length;
  const checkedCount = entries.filter((c) => c.status === "checked").length;

  // The other half of the record: edit suggestions readers sent through the
  // "Suggest an edit" control that were reviewed and merged. Real rows, real
  // dates, real people. Nothing hand-written about this section.
  const { resolved } = await getPublicContributions();
  const merged = resolved.filter((c) => c.kind === "edit" && c.status === "merged");

  const tally = [
    { n: open.length, label: "known and not fixed" },
    { n: correctedCount, label: "corrected" },
    { n: checkedCount, label: "checked, not an error" },
    { n: merged.length, label: "reader edits merged" },
  ];

  return (
    <>
      {/* ---- head -------------------------------------------------------- */}
      <div className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,3.8rem)]">
        <div className="max-w-[54ch]">
          <p className="nb-marker">corrections / the public record</p>
          <h1>
            Everything this site has got <span className="nb-mark">wrong</span>.
          </h1>
          <p className="nb-lede mt-5">
            LearnFRC&rsquo;s lessons are AI-assisted: drafted from primary
            sources, then reviewed and edited by hand. That process gets things
            wrong sometimes. This page is where those mistakes are written down,
            with what it says now and the source you can check it against.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href="#report" className="nb-btn">
              Report something wrong
            </a>
            <span className="nb-hint">
              No account and no email address required.
            </span>
          </div>
        </div>
      </div>

      {/* ---- the tally, stamped on the one inverted band ------------------
          The page's argument is the count itself: a log that only ever listed
          wins would not be worth publishing, so the number of open problems is
          printed first and at the same size as the fixes. */}
      <section className="nb-slab py-[clamp(2rem,4.5vw,3.2rem)]" aria-label="Log totals">
        <div className="nb-wrap grid gap-[clamp(1.2rem,3vw,2.6rem)] sm:grid-cols-2 lg:grid-cols-4">
          {tally.map((t) => (
            <p key={t.label} className="nb-stamp">
              <b>{t.n}</b>
              <span>{t.label}</span>
            </p>
          ))}
        </div>
      </section>

      {/* ---- how to read the page ---------------------------------------- */}
      <div className="nb-wrap py-[clamp(2.2rem,4.5vw,3.4rem)]">
        <div className="grid gap-[clamp(1.4rem,4vw,3rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
          <div>
            <p className="nb-marker">how to read this page</p>
            <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.1rem)]">
              Three stamps, and none of them is a colour.
            </h2>
            <p className="nb-sub mt-4">
              This log opened on {formatLogDate("2026-08-10")}. Entries dated
              that day include older fixes that were confirmed against the live
              pages when the log was started, so the date is when the entry was
              written down, not always when the edit shipped. From here on, each
              correction is logged as it happens. This page covers content
              accuracy only, it is not a changelog for site features.
            </p>
          </div>

          <dl className="lg:pt-1">
            {(
              [
                ["corrected", "The content was wrong or misleading and has been changed."],
                [
                  "checked",
                  "Someone reported an error, we checked, and the content turned out to be right. Logged anyway, because a log that only lists wins isn't a log.",
                ],
                [
                  "open",
                  "A problem we know about and haven't fixed yet. Listed here so you can see it before it bites you.",
                ],
              ] as [CorrectionStatus, string][]
            ).map(([status, meaning]) => (
              <div
                key={status}
                className="grid gap-x-4 gap-y-2 border-t border-dashed border-rule py-3.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-baseline"
              >
                <dt>
                  <Stamp status={status} />
                </dt>
                <dd className="text-[0.97rem] leading-relaxed text-graphite">{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ---- the log ------------------------------------------------------
          Known problems first. They're the least flattering and the most
          useful thing on the page. */}
      <div className="nb-wrap pb-[clamp(3rem,6vw,4.5rem)]">
        {open.length > 0 && (
          <section aria-labelledby="open-log" className="border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="open-log" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
                Known problems, not yet fixed
              </h2>
              <p className="nb-slug">found during review, not corrected yet</p>
            </div>
            <ul className="nb-list mt-5 list-none">
              {open.map((c) => (
                <Entry key={c.id} c={c} />
              ))}
            </ul>
            <p className="nb-pen mt-6 rotate-[-0.9deg]">
              the open ones are the whole reason this page exists
            </p>
          </section>
        )}

        <section
          aria-labelledby="logged"
          className="mt-[clamp(2.6rem,5vw,4rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="logged" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
              Corrections and checks
            </h2>
            <p className="nb-slug">
              {logged.length} {logged.length === 1 ? "entry" : "entries"}, newest first
            </p>
          </div>
          {logged.length ? (
            <ul className="nb-list mt-5 list-none">
              {logged.map((c) => (
                <Entry key={c.id} c={c} />
              ))}
            </ul>
          ) : (
            <p className="nb-note mt-5 max-w-[52ch]">
              <span className="nb-slug">log / empty</span>
              <span className="mt-1.5 block text-[0.97rem]">
                Nothing logged yet. The first entry lands the first time
                something here turns out to be wrong.
              </span>
            </p>
          )}
        </section>

        {/* Reader edits that were reviewed and merged, straight from the
            database. Tighter than the editorial log above: there is no
            "what was wrong / what it says now" pair to print, so these are one
            ruled line each rather than a full entry. */}
        <section
          aria-labelledby="reader-edits"
          className="mt-[clamp(2.6rem,5vw,4rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <h2 id="reader-edits" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            Reader edits, merged
          </h2>
          <p className="nb-sub mt-3">
            Changes readers submitted through &ldquo;Suggest an edit&rdquo; that
            were reviewed and merged into the content. Every suggestion, merged
            or declined, is visible on the{" "}
            <Link href="/contributions" className="nb-link">
              contributions page
            </Link>
            .
          </p>

          {merged.length ? (
            <ul className="nb-list mt-5 list-none">
              {merged.map((m) => (
                <li
                  key={m.id}
                  className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-2 border-b border-dashed border-rule py-[clamp(1rem,2vw,1.4rem)] md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:block">
                    <time dateTime={m.date} className="nb-slug block font-bold text-ink">
                      {formatLogDate(m.date)}
                    </time>
                    <span className="md:mt-2.5 md:block">
                      <span className="nb-tag" data-on="">
                        merged
                      </span>
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[1.05rem]">
                      {m.targetPath ? (
                        <Link href={m.targetPath} className="text-ink no-underline hover:text-blue">
                          {m.targetTitle}
                        </Link>
                      ) : (
                        m.targetTitle
                      )}
                    </h3>
                    {m.note && (
                      <p className="mt-2 max-w-[68ch] border-l-[3px] border-blue pl-3 text-[0.95rem] leading-relaxed text-graphite">
                        {m.note.slice(0, 400)}
                      </p>
                    )}
                    <p className="nb-slug mt-2">
                      reported by{" "}
                      {m.byUsername ? (
                        <Link href={`/u/${m.byUsername}`} className="nb-link text-[0.78rem]">
                          @{m.byUsername}
                        </Link>
                      ) : (
                        "a member"
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="nb-note mt-5 max-w-[52ch]">
              <span className="nb-slug">queue / empty</span>
              <span className="mt-1.5 block text-[0.97rem]">
                No reader edits merged yet. The first one to land shows up here
                with the date and the handle that sent it.
              </span>
            </p>
          )}
        </section>

        {/* ---- reporting -------------------------------------------------
            The no-account route first and in full, not a link to a control
            that tells signed-out readers to make an account. That gap was the
            loudest criticism of this site, on a page written to answer
            criticism. */}
        <section
          id="report"
          aria-labelledby="report-h"
          className="mt-[clamp(2.6rem,5vw,4rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <h2 id="report-h" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            Reporting an error
          </h2>
          <p className="nb-sub mt-3">
            Two ways, and the first one needs nothing from you at all.
          </p>

          <div className="mt-7 grid gap-[clamp(1.8rem,4vw,3rem)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="nb-slug font-bold text-ink">
                1 / just tell me, no account and no email needed
              </p>
              <p className="mt-2 max-w-[58ch] text-[0.97rem] leading-relaxed text-graphite">
                Describe what&rsquo;s wrong and send it. The email field is
                optional and exists only if you want a reply. A correction to a
                fact gets an entry on this page whether or not the person who
                reported it wrote the fix, and whether or not they told me who
                they are.
              </p>
              <div className="mt-5">
                <ReportForm kind="error" />
              </div>
            </div>

            <div className="lg:border-l-2 lg:border-ink lg:pl-[clamp(1.4rem,3vw,2.4rem)]">
              <p className="nb-slug font-bold text-ink">2 / write the fix yourself</p>
              <p className="mt-2 max-w-[52ch] text-[0.97rem] leading-relaxed text-graphite">
                Open the lesson or article, scroll to the &ldquo;Sources and
                corrections&rdquo; box at the bottom, and use{" "}
                <strong className="font-bold text-ink">Suggest an edit</strong>.
                You can rewrite the text yourself: it goes into a review queue
                that is public from the moment you submit it. This one needs a
                free account, because the change is credited to you.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/guides" className="nb-btn-ghost">
                  Browse the guides
                </Link>
                <Link href="/contributions" className="nb-btn-ghost">
                  See the open queue
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
