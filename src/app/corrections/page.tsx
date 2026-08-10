import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  MessageSquareQuote,
  PencilLine,
  ScrollText,
  Search,
} from "lucide-react";
import { Reveal, Glow } from "@/components/motion/primitives";
import { ReportForm } from "@/components/report-form";
import { getPublicContributions } from "@/lib/queries";
import {
  formatLogDate,
  sortedCorrections,
  type Correction,
  type CorrectionStatus,
} from "@/lib/corrections";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC" — don't repeat it here.
  title: "Corrections log",
  description:
    "Every substantive correction to a LearnFRC lesson or article: what was wrong, what it says now, and the source we checked it against — plus the problems we know about and haven't fixed yet.",
  alternates: { canonical: "/corrections" },
};

// Reader-submitted edits merge on their own schedule; the editorial half of the
// log is a constant, so this only needs to be fresh-ish.
export const revalidate = 300;

const HEADLINE_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const LINK =
  "rounded-sm underline decoration-border underline-offset-2 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Status pill. Carries its own text label — never colour alone. */
function StatusBadge({ status }: { status: CorrectionStatus }) {
  if (status === "corrected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
        <Check className="h-3 w-3" aria-hidden /> Corrected
      </span>
    );
  if (status === "open")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
        <AlertTriangle className="h-3 w-3" aria-hidden /> Not fixed yet
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
      <Search className="h-3 w-3" aria-hidden /> Checked — no error
    </span>
  );
}

function Entry({ c }: { c: Correction }) {
  const raisedLabel = c.status === "corrected" ? "What was wrong" : "What was raised";
  const outcomeLabel =
    c.status === "corrected"
      ? "What it says now"
      : c.status === "open"
        ? "Where it stands"
        : "What we found";

  return (
    <li id={c.id} className="ac-card scroll-mt-28 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusBadge status={c.status} />
        <time dateTime={c.date} className="text-xs font-medium text-muted-foreground">
          Logged {formatLogDate(c.date)}
        </time>
      </div>

      <h3 className="mt-3 font-display text-lg font-bold leading-snug text-foreground">
        <a href={`#${c.id}`} className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {c.summary}
        </a>
      </h3>

      {c.affects.length > 0 && (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{c.affects.length > 1 ? "Pages:" : "Page:"}</span>
          {c.affects.map((t, i) => (
            <span key={t.path}>
              <Link href={t.path} className={`font-medium text-foreground ${LINK}`}>
                {t.title}
              </Link>
              {i < c.affects.length - 1 && <span aria-hidden>,</span>}
            </span>
          ))}
        </p>
      )}

      <dl className="mt-4 space-y-3 text-sm leading-relaxed">
        <div>
          <dt className="font-semibold text-foreground">{raisedLabel}</dt>
          <dd className="mt-1 text-foreground/80">{c.raised}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{outcomeLabel}</dt>
          <dd className="mt-1 text-foreground/80">{c.outcome}</dd>
        </div>
      </dl>

      {c.quote && (
        <figure className="mt-4">
          <figcaption className="ac-eyebrow">Current text</figcaption>
          <blockquote className="mt-1.5 border-l-2 border-primary/40 pl-3 text-sm italic leading-relaxed text-foreground/80">
            {c.quote}
          </blockquote>
        </figure>
      )}

      {(c.sources?.length || c.reportedAt) && (
        <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
          {c.sources?.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">Source:</span> {s.title}
              </span>
            </a>
          ))}
          {c.reportedAt && (
            <a
              href={c.reportedAt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">Reported:</span> {c.reportedAt.title}
              </span>
            </a>
          )}
        </div>
      )}
    </li>
  );
}

export default async function CorrectionsPage() {
  const entries = sortedCorrections();
  const open = entries.filter((c) => c.status === "open");
  const logged = entries.filter((c) => c.status !== "open");

  // The other half of the record: edit suggestions readers sent through the
  // "Suggest an edit" control that were reviewed and merged. Real rows, real
  // dates, real people — nothing hand-written about this section.
  const { resolved } = await getPublicContributions();
  const merged = resolved.filter((c) => c.kind === "edit" && c.status === "merged");

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "600px", pos: { left: "-160px", top: "-180px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "520px", pos: { right: "-140px", top: "-80px" }, color: "#9bd0ff", opacity: 0.45, delay: 2 },
        ]}
      />

      <section className="mx-auto max-w-4xl px-4 pb-8 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Reveal>
          <span className="ac-chip inline-flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="ac-eyebrow">Public record</span>
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Corrections <span style={HEADLINE_GRADIENT}>log</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
            LearnFRC&rsquo;s lessons are AI-assisted: drafted from primary
            sources, then reviewed and edited by hand. That process gets things
            wrong sometimes. This page is where those mistakes are written down
            — what was wrong, what it says now, and the source you can check it
            against.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="#report" className="ac-btn text-sm">
              Found something wrong? Report it{" "}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <span className="text-sm text-muted-foreground">
              No account and no email address required.
            </span>
          </div>
        </Reveal>

        <Reveal>
          <div className="ac-card mt-8 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-foreground">
              How to read this page
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/80">
              <li className="flex flex-wrap items-baseline gap-2">
                <StatusBadge status="corrected" />
                <span>The content was wrong or misleading and has been changed.</span>
              </li>
              <li className="flex flex-wrap items-baseline gap-2">
                <StatusBadge status="checked" />
                <span>
                  Someone reported an error, we checked, and the content turned
                  out to be right. Logged anyway, because a log that only lists
                  wins isn&rsquo;t a log.
                </span>
              </li>
              <li className="flex flex-wrap items-baseline gap-2">
                <StatusBadge status="open" />
                <span>
                  A problem we know about and haven&rsquo;t fixed yet. Listed
                  here so you can see it before it bites you.
                </span>
              </li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              This log opened on {formatLogDate("2026-08-10")}. Entries dated
              that day include older fixes that were confirmed against the live
              pages when the log was started, so the date is when the entry was
              written down, not always when the edit shipped. From here on, each
              correction is logged as it happens. This page covers content
              accuracy only — it is not a changelog for site features.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* Known problems first. They're the least flattering and the most
            useful thing on the page. */}
        {open.length > 0 && (
          <Reveal>
            <h2 className="mt-6 font-display text-xl font-bold text-foreground">
              Known problems, not yet fixed
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Found during review, not corrected yet.
            </p>
            <ul className="mt-4 space-y-3">
              {open.map((c) => (
                <Entry key={c.id} c={c} />
              ))}
            </ul>
          </Reveal>
        )}

        <Reveal>
          <h2 className="mt-12 font-display text-xl font-bold text-foreground">
            Corrections and checks
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {logged.length} {logged.length === 1 ? "entry" : "entries"}, newest
            first.
          </p>
          {logged.length ? (
            <ul className="mt-4 space-y-3">
              {logged.map((c) => (
                <Entry key={c.id} c={c} />
              ))}
            </ul>
          ) : (
            <div className="ac-card mt-4 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing logged yet.
              </p>
            </div>
          )}
        </Reveal>

        {/* Reader edits that were reviewed and merged — straight from the
            database, not curated here. */}
        <Reveal>
          <h2 className="mt-12 font-display text-xl font-bold text-foreground">
            Reader edits, merged
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Changes readers submitted through &ldquo;Suggest an edit&rdquo; that
            were reviewed and merged into the content. Every suggestion — merged
            or declined — is visible on the{" "}
            <Link href="/contributions" className={`text-foreground ${LINK}`}>
              contributions page
            </Link>
            .
          </p>
          {merged.length ? (
            <ul className="mt-4 space-y-3">
              {merged.map((m) => (
                <li key={m.id} className="ac-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
                      <PencilLine className="h-3 w-3" aria-hidden /> Merged
                    </span>
                    <time
                      dateTime={m.date}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {formatLogDate(m.date)}
                    </time>
                  </div>
                  <h3 className="mt-2.5 font-display font-semibold leading-snug text-foreground">
                    {m.targetPath ? (
                      <Link href={m.targetPath} className={LINK}>
                        {m.targetTitle}
                      </Link>
                    ) : (
                      m.targetTitle
                    )}
                  </h3>
                  {m.note && (
                    <p className="mt-2 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground/80">
                      {m.note.slice(0, 400)}
                    </p>
                  )}
                  <p className="mt-2.5 text-sm text-muted-foreground">
                    Reported by{" "}
                    {m.byUsername ? (
                      <Link href={`/u/${m.byUsername}`} className={`text-foreground ${LINK}`}>
                        @{m.byUsername}
                      </Link>
                    ) : (
                      "a member"
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ac-card mt-4 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No reader edits merged yet.
              </p>
            </div>
          )}
        </Reveal>

        <Reveal>
          <div id="report" className="ac-card mt-12 scroll-mt-28 p-6">
            <h2 className="font-display text-xl font-bold text-foreground">
              Reporting an error
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              Two ways, and the first one needs nothing from you at all.
            </p>

            {/* The no-account route, first and in full — not a link to a
                control that tells signed-out readers to make an account.
                That gap was the single loudest criticism of this site, on a
                page written to answer criticism. */}
            <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4 sm:p-5">
              <h3 className="font-display text-base font-bold text-foreground">
                1. Just tell us — no account, no email needed
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                Describe what&rsquo;s wrong and send it. The email field is
                optional and exists only if you want a reply. A correction to a
                fact gets an entry on this page whether or not the person who
                reported it wrote the fix, and whether or not they told us who
                they are.
              </p>
              <div className="mt-4">
                <ReportForm kind="error" />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4 sm:p-5">
              <h3 className="font-display text-base font-bold text-foreground">
                2. Write the fix yourself
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                Open the lesson or article, scroll to the &ldquo;Sources &amp;
                corrections&rdquo; box at the bottom, and use{" "}
                <span className="font-semibold text-foreground">Suggest an edit</span>.
                You can rewrite the text yourself — it goes into a review queue
                that is public from the moment you submit it. This one needs a
                free account, because the change is credited to you.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/guides" className="ac-btn text-sm">
                  Browse the guides <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/contributions" className="ac-btn-ghost text-sm">
                  See the open queue
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
