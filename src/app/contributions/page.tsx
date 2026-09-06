import type { Metadata } from "next";
import Link from "next/link";
import { getPublicContributions, type PublicContribution } from "@/lib/queries";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC", so it is not repeated here.
  title: "Community contributions",
  description:
    "See what the LearnFRC community is improving in the open — pending edit suggestions and new-lesson proposals, plus what's recently been merged. Anyone with an account can suggest a change.",
  alternates: { canonical: "/contributions" },
};

// The queue changes as people submit and as edits are reviewed; keep it fresh
// without hitting the DB on every request.
export const revalidate = 60;

/**
 * The change log, clipped to the wall of the shop.
 *
 * WHAT THIS PAGE IS FOR: a stranger or a member asks "is this site edited by
 * one person behind a curtain, or can I fix the thing I just found wrong?" So
 * the page has exactly two jobs, and the layout is those two jobs: show the
 * queue as it actually stands, and tell somebody how to add a line to it.
 *
 * WHY IT IS SHAPED LIKE A LEDGER, not like the other account pages. A ledger is
 * read down the margin: you scan the left gutter for the state of each line,
 * then step right into the one that interests you. So every entry hangs its
 * status and its kind in a fixed left column and puts the work in the wide one.
 * That is also why the two lists are drawn differently. An open item is a thing
 * you might act on, so it gets room and it quotes the author's note; a resolved
 * item is a receipt, so it collapses to one line and runs two columns. Printing
 * both lists in the same shape would say they deserve the same attention, and
 * they do not.
 *
 * THREE STATES, NEVER BY COLOUR ALONE. Open is a drawn chip, merged is a filled
 * chip, declined is a dashed one, and all three carry the word. The old page
 * used a green pill, a grey pill and a blue pill, which is three hues this
 * palette does not own to say what three words already say.
 *
 * Behaviour is unchanged: same route, same `revalidate`, same metadata, same
 * single `getPublicContributions()` call, same links out.
 *
 * Server Component. The old page wrapped every block in a scroll-reveal and lay
 * two drifting blurred blobs behind it; both are gone, and with them the client
 * bundle they cost.
 */

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

/** `edit` and `submission` are the two things a member can file. */
function kindSlug(kind: PublicContribution["kind"]): string {
  return kind === "edit" ? "edit / suggestion" : "lesson / proposal";
}

/**
 * The state of one line, stamped three ways so it survives a photocopy: a
 * filled chip for merged, a drawn chip for open, a dashed chip for declined,
 * each of them carrying the word as well as the shape.
 */
function StatusStamp({ status }: { status: PublicContribution["status"] }) {
  if (status === "merged")
    return (
      <span className="nb-tag" data-on="">
        Merged
      </span>
    );
  if (status === "declined")
    return <span className="nb-tag border-dashed text-graphite">Declined</span>;
  return <span className="nb-tag">Open</span>;
}

/** The byline, as it is written on a work order: who filed it, and when. */
function Byline({ c }: { c: PublicContribution }) {
  const when = timeAgo(c.date);
  return (
    <p className="nb-slug mt-1.5">
      filed by{" "}
      {c.byUsername ? (
        <Link href={`/u/${c.byUsername}`} className="nb-link">
          @{c.byUsername}
        </Link>
      ) : (
        <span className="text-ink">a member</span>
      )}
      {when ? ` / ${when}` : ""}
    </p>
  );
}

/** One open line: status in the gutter, the work in the wide column. */
function OpenEntry({ c }: { c: PublicContribution }) {
  return (
    <li className="grid items-baseline gap-x-[clamp(1rem,3vw,2.2rem)] gap-y-2 border-b border-dashed border-rule py-[clamp(1rem,2.2vw,1.5rem)] min-[760px]:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
      <div className="flex flex-wrap items-center gap-2">
        <StatusStamp status={c.status} />
        <span className="nb-slug">{kindSlug(c.kind)}</span>
      </div>

      <div className="min-w-0">
        <h3 className="text-[1.02rem] leading-tight">
          {c.targetPath ? (
            <Link href={c.targetPath} className="nb-link">
              {c.targetTitle}
            </Link>
          ) : (
            c.targetTitle
          )}
        </h3>

        <Byline c={c} />

        {/* The author's own words, quoted rather than paraphrased. This is the
            part that tells a reader whether the change is worth their time, so
            it gets the callout frame instead of being folded into the byline. */}
        {c.note && (
          <div className="nb-note mt-3 max-w-[62ch]">
            <p className="nb-slug">what they wrote</p>
            <p className="mt-1 text-[0.93rem] leading-snug">
              &ldquo;{c.note.slice(0, 400)}&rdquo;
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

/** One resolved line: a receipt, so it is one line and it runs two columns. */
function ResolvedLine({ c }: { c: PublicContribution }) {
  const when = timeAgo(c.date);
  return (
    <li className="nb-hair flex flex-wrap items-baseline gap-x-3 gap-y-1.5 py-[clamp(0.75rem,1.6vw,1.05rem)]">
      <StatusStamp status={c.status} />
      <span className="min-w-0 flex-1 text-[0.97rem] font-bold leading-snug">
        {c.targetPath ? (
          <Link href={c.targetPath} className="nb-link">
            {c.targetTitle}
          </Link>
        ) : (
          c.targetTitle
        )}
      </span>
      <span className="nb-slug shrink-0">{when}</span>
    </li>
  );
}

export default async function ContributionsPage() {
  const { open, resolved } = await getPublicContributions();

  return (
    <>
      {/* ===================== THE MASTHEAD =====================
          Full width and left aligned, deliberately not the split card the rest
          of the account area opens with. There is no personal figure to put in
          the second column here: this page is about everybody else's work. */}
      <section className="nb-wrap pb-[clamp(1.6rem,3.4vw,2.4rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <p className="nb-marker">
          <span>learnfrc / change log</span>
        </p>

        <h1 className="max-w-[18ch] text-[clamp(2.1rem,1.3rem+2.8vw,3.4rem)]">
          Every change to this site, in the open.
        </h1>

        <p className="nb-lede mt-[clamp(0.9rem,2vw,1.4rem)]">
          Anyone with an account can suggest an edit or propose a lesson. This is
          the whole queue, both the part waiting on a review and the part that
          already went live.
        </p>

        <p className="nb-pen mt-4 max-w-[26ch] rotate-[-1.1deg]">
          if a lesson is wrong, you can be the one who fixes it
        </p>
      </section>

      {/* ===================== THE INTAKE STRIP =====================
          One drawn frame split into two unequal panels: what the ledger holds
          right now, and how a person adds to it. Two panels rather than a
          numbered three-step, because there are only two things to say and a
          third would have to be invented to fill the frame. */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3.2rem)]">
        {/* No `overflow-hidden` on this box, deliberately: the tape has to hang
            over the top edge to read as holding the card down, and a clip would
            slice it off. The panel divider is a vertical rule in the middle of
            the frame, so it never reaches a rounded corner and needs no clip. */}
        <div className="nb-box grid min-[861px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <span
            className="nb-tape -top-3 left-[14%] rotate-[-3.6deg]"
            aria-hidden="true"
          />

          <div className="nb-panel">
            <p className="nb-slug">the ledger, right now</p>

            <div className="mt-[clamp(1rem,2.2vw,1.5rem)] flex flex-wrap gap-x-[clamp(1.6rem,4vw,3rem)] gap-y-4">
              <p className="nb-count text-[clamp(1.8rem,1.3rem+1.6vw,2.6rem)]">
                {open.length}
                <small>open</small>
              </p>
              <p className="nb-count text-[clamp(1.8rem,1.3rem+1.6vw,2.6rem)]">
                {resolved.length}
                <small>recently resolved</small>
              </p>
            </div>

            <p className="nb-hair mt-auto pt-[clamp(1rem,2.2vw,1.4rem)] text-[0.95rem] leading-snug text-graphite">
              Every suggestion is read by a person, and the decision is written
              here either way. Nothing gets quietly dropped.
            </p>
          </div>

          <div className="nb-panel">
            <p className="nb-slug">how to file one</p>

            <p className="mt-[clamp(1rem,2.2vw,1.5rem)] max-w-[42ch] text-[0.98rem] leading-relaxed">
              Open the lesson or article that is wrong, scroll to the bottom, and
              hit &ldquo;Suggest an edit&rdquo;. Say what is wrong and what it
              should say instead. You keep the credit when it lands.
            </p>

            <div className="mt-auto pt-[clamp(1.1rem,2.4vw,1.6rem)]">
              <Link href="/guides" className="nb-btn">
                Find something to improve
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== OPEN, WAITING ON A REVIEW ===================== */}
      <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
              Waiting on a review
            </h2>
            <p className="nb-sub mt-3">
              Filed, not yet decided. The note under each one is the author&rsquo;s
              own, so you can see the argument before you open the page.
            </p>
          </div>
          {open.length > 0 && (
            <p className="nb-count shrink-0">
              {open.length}
              <small>{open.length === 1 ? "item" : "items"}</small>
            </p>
          )}
        </div>

        {open.length === 0 ? (
          <div className="nb-note mt-[clamp(1.2rem,2.6vw,1.8rem)] max-w-[46rem]">
            <p className="nb-slug">queue empty</p>
            <p className="mt-1.5 text-[0.95rem] leading-snug">
              Every suggestion filed so far has been decided. Spot something
              wrong?{" "}
              <Link href="/guides" className="nb-link">
                Open a lesson
              </Link>{" "}
              and suggest the fix.
            </p>
          </div>
        ) : (
          <ul className="nb-list mt-[clamp(1.2rem,2.6vw,1.8rem)]">
            {open.map((c) => (
              <OpenEntry key={`${c.kind}-${c.id}`} c={c} />
            ))}
          </ul>
        )}
      </section>

      {/* ===================== RECENTLY RESOLVED =====================
          Deliberately the densest block on the page. These are receipts: the
          reader wants to know the queue moves, not to study each line. */}
      {resolved.length > 0 && (
        <section className="nb-wrap border-t-2 border-ink py-[clamp(2.2rem,4.5vw,3.6rem)]">
          <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
            Already decided
          </h2>
          <p className="nb-sub mt-3">
            The last few that were merged or turned down. A declined suggestion
            stays on the record too.
          </p>

          <ul className="mt-[clamp(1.2rem,2.6vw,1.8rem)] grid gap-x-[clamp(1.6rem,4vw,3.2rem)] min-[900px]:grid-cols-2">
            {resolved.map((c) => (
              <ResolvedLine key={`${c.kind}-${c.id}`} c={c} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
