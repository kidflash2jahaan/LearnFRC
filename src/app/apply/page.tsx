import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadApplyState, type ApplyState } from "@/lib/app/admin-apply";
import { CopyLink } from "@/components/team/copy-link";
import { ApplyForm } from "./_apply-form";
import { WithdrawForm } from "./_withdraw-form";
import {
  APPLICATIONS_OPEN,
  HEADS,
  JOBS,
  MARKETING_RULES,
  OFFICIAL_POSTING,
  type ApplyMode,
} from "@/lib/applications";

export const metadata: Metadata = {
  // `absolute` on purpose. The root template appends " · LearnFRC", and this
  // title already ends in the site's name, so the default would print it twice.
  title: { absolute: "Help spread LearnFRC" },
  description:
    "Apply to help spread LearnFRC: show it to your own team and other teams, share the trailer and clips, suggest places to post, and make your own videos if you want. Unpaid, any age, for anyone who has been on an FRC team.",
  alternates: { canonical: "/apply" },
};

/**
 * The way in, for somebody who wants to help more teams find LearnFRC.
 *
 * ONE ROLE. This page used to describe four admin jobs (the feedback inbox,
 * suggested edits, verifying lessons, the numbers). Those came off it on
 * 2026-11-08: the only thing anyone can apply for now is marketing, and
 * accepting somebody puts a marketing tag on their account and nothing else
 * (src/lib/app/admin-apply-marketing.ts). The footer's "Help run it" link
 * still lands here.
 *
 * WHY THE PAGE IS SHAPED LIKE THIS. Every other "join us" page on the internet
 * opens by selling the opportunity. This one opens by describing the work,
 * because a person who finds out what the role is after being accepted is a
 * person who quietly stops answering. So the order is the order somebody
 * actually decides in: what the role is, what it does not come with, what
 * happens once you're in, whether it is for them, and only then the form.
 *
 * ONE COLUMN, AND THE FORM IS RULED ONTO THE PAPER rather than boxed, the same
 * way /contact is. The form swaps itself for a taped receipt on success, and a
 * card appearing inside a card would read as a rendering fault. The single card
 * on the page is whichever state card the visit lands on, so a card always
 * means "here is where you stand", never "here is a section".
 *
 * NO `export const dynamic`. Reading the session reads cookies, which makes this
 * route dynamic on its own, exactly as it does on /settings and /dashboard.
 * Declaring it again would only say the same thing in a second place.
 *
 * Server Component. The two forms and the copy button are the client leaves,
 * because they hold state; nothing else here does.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `2026-09-22T23:13:50Z` to `Sep 22, 2026`.
 *
 * UTC and table-driven for the same reason /admin's formatter is: this runs on
 * the server and the string is handed to the browser already made, so nothing
 * is recomputed on the client and hydration cannot disagree with it, and
 * `toLocaleDateString` returns different strings on different ICU builds.
 * The year is printed because an application can sit across a season boundary
 * and a bare "Sep 22" on a decision from last year reads as this week.
 */
function day(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/*
 * What a marketer does (JOBS), where what they make goes (OFFICIAL_POSTING),
 * the rules, the brand kit and the heading over each state (HEADS) live in
 * src/lib/applications.ts, shared with the acceptance email and the app's
 * GET /api/app/apply.
 */

export default async function ApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Where a signed-in account stands comes from loadApplyState
  // (src/lib/app/admin-apply.ts), the same answer the app's GET /api/app/apply
  // gives: on the admin team, a marketer already, pending, needs a handle,
  // applying again, or new. An accepted application whose account no longer
  // has the tag counts as no application at all, and pending is the only
  // status that blocks a new one (the server enforces that independently). A
  // handle is the only thing on an application that identifies a person, so
  // the page asks for it before the form rather than warning about it beside a
  // live Send button.
  let state: ApplyState | null = null;
  if (user) {
    const result = await loadApplyState(user);
    if (result.ok) state = result;
  }
  const mode: ApplyMode = state ? state.mode : "signed-out";
  const application = state?.application ?? null;
  const open = application?.status === "pending" ? application : null;
  const closed =
    application?.status === "rejected" || application?.status === "withdrawn"
      ? application
      : null;
  const handle = state?.record.username ?? null;
  const marketer = state?.marketer ?? null;
  const head = HEADS[mode];

  return (
    <div className="nb-wrap max-w-[52rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">apply / marketing</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">
          Help <span className="nb-mark">spread</span> LearnFRC.
        </h1>
        <p className="nb-lede mt-5">
          LearnFRC is free, and one person writes it. The lessons only help the
          teams that find them. If you&rsquo;re on an FRC team, or have been,
          you can help more of them find it.
        </p>
        <p className="nb-pen mt-5 max-w-[27ch] rotate-[-1.1deg]">
          telling your own team counts
        </p>
      </header>

      {/* ---- the work ----------------------------------------------------
          A ruled ledger, not four tiles. Each row is a part of the role and
          what it actually involves, which is a two-part shape, and a dashed
          rule between them carries it better than a border drawn all the way
          around each one. */}
      <section
        aria-labelledby="job"
        className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="job" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            What a marketer does
          </h2>
          <p className="nb-slug">four things, do as much as you like</p>
        </div>

        <dl className="mt-5">
          {JOBS.map((j) => (
            <div
              key={j.slug}
              className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-1 border-t border-dashed border-rule py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
            >
              <dt className="nb-slug font-bold text-ink">{j.slug}</dt>
              <dd className="text-[0.99rem] leading-relaxed text-graphite">
                {j.text}
              </dd>
            </div>
          ))}
        </dl>

        {/* Said plainly and on its own line, not folded into the last row:
            somebody sending in a video should know before they make it where
            it can end up, and that it might not. */}
        <p className="mt-4 max-w-[64ch] border-t border-dashed border-rule pt-4 text-[0.99rem] font-semibold leading-relaxed">
          {OFFICIAL_POSTING}
        </p>

        {/* The limits, said out loud here rather than discovered after being
            accepted. The page's one standing aside, so it gets the callout
            frame; the only other note that can appear is a reviewer's own
            words on a refused application, which is quoted material. */}
        <div className="nb-note mt-[clamp(1.4rem,3vw,2rem)] max-w-[70ch]">
          <p className="nb-slug">what the role does not come with</p>
          {/* `.nb-prose` rather than a hand-built list: the system already
              draws a `-` marker in blue on `ul > li`, and inventing a local
              one would be a second way to write the same bullet. */}
          <div className="nb-prose mt-2.5">
            <ul>
              <li>
                No admin access. Accepting you puts a marketing tag on your
                account and changes nothing else. There&rsquo;s no admin
                panel, no site numbers and no feedback inbox.
              </li>
              <li>
                No public name. Marketers aren&rsquo;t listed anywhere on the
                site. Your handle shows up only on my review page, next to how
                many people signed up through your invite link.
              </li>
              <li>
                No quota. Nobody counts your posts or your hours, and making
                videos is optional.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- once you're in -----------------------------------------------
          What acceptance actually hands over, before the form, so nobody has
          to apply to find out. The rules are a list because they are three
          separate things somebody will check against before posting. */}
      <section
        aria-labelledby="after"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="after" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          Once you&rsquo;re in
        </h2>
        <div className="mt-4 flex max-w-[64ch] flex-col gap-4 text-[0.99rem] leading-relaxed text-graphite">
          <p>
            You get one email. It has the trailer, your invite link, a small
            brand kit (the logo, the colours and the fonts) and the rules
            below.
          </p>
          <p>
            Your invite link is the referral link every account already has:
            learnfrc.com/signup with your handle on the end. Everyone who signs
            up through it is counted, and that count is how I see what&rsquo;s
            working.
          </p>
          <p>
            When you make something, reply to that email with it. Replies come
            straight to me.
          </p>
        </div>
        <div className="mt-5 max-w-[64ch]">
          <p className="nb-slug">the rules</p>
          <div className="nb-prose mt-2.5">
            <ul>
              {MARKETING_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- who it suits -------------------------------------------------
          Plain prose. A reader who got this far is reading rather than
          scanning, and boxing this would only put a border between them and
          the one paragraph that decides it. */}
      <section
        aria-labelledby="who"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="who" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
          Who this suits
        </h2>
        <div className="mt-4 flex max-w-[64ch] flex-col gap-4 text-[0.99rem] leading-relaxed text-graphite">
          <p>
            Anybody who is on an FRC team or has been. Student, mentor, alum,
            coach, any age. You don&rsquo;t need followers or editing skills.
            If your team&rsquo;s group chat would listen to you, that&rsquo;s
            enough.
          </p>
          <p>
            It is unpaid. Nothing on this site makes money, so there is
            nothing to pay anyone out of. What you get instead is more rookies
            finding a free curriculum before their first build season.
          </p>
        </div>
      </section>

      {/* ---- where you stand ---------------------------------------------
          One section, six states. The form is ruled onto the paper; the
          states that have no form get the page's one card instead. */}
      <section
        aria-labelledby="apply"
        className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="apply" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            {head.title}
          </h2>
          <p className="nb-slug">{head.slug}</p>
        </div>

        {mode === "signed-out" && (
          <div className="nb-box nb-tilt-2 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span
              className="nb-tape -top-3 left-[16%] rotate-[-3.2deg]"
              aria-hidden="true"
            />
            <p className="nb-slug">sign in first</p>
            {/* No claim about what else on the site needs an account. Nine
                routes redirect to /login and /about names three reasons to
                have one, so "the two things that do" was a sentence the rest
                of the site disproves. */}
            <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
              An application arrives as a handle and a team number, and your
              invite link is keyed on that handle, so it has to be attached to
              an account. Reading LearnFRC never needs one. An account is free
              and takes a minute.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href="/login?next=/apply" className="nb-btn">
                Sign in and apply
              </Link>
              <span className="nb-hint">
                No account yet?{" "}
                <Link href="/signup?next=/apply" className="nb-link">
                  Make one
                </Link>
                , it&rsquo;s free and it comes straight back here.
              </span>
            </div>
          </div>
        )}

        {mode === "on-the-team" && (
          <div className="nb-box nb-tilt-1 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span
              className="nb-tape -top-3 left-[22%] rotate-[-2.6deg]"
              aria-hidden="true"
            />
            <p className="nb-slug">you already have the keys</p>
            <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
              This account is on the admin team and can open the admin panel.
              There is nothing here left to apply for, and you can share
              LearnFRC with anyone you like without a tag.
            </p>
            <Link href="/admin" className="nb-btn mt-6">
              Open the admin panel
            </Link>
          </div>
        )}

        {mode === "marketer" && marketer && (
          <div className="nb-box nb-tilt-1 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span
              className="nb-tape -top-3 left-[18%] rotate-[-2.8deg]"
              aria-hidden="true"
            />
            <p className="nb-slug">
              tagged {day(marketer.since) ?? "already"} / your invite link
            </p>
            {marketer.inviteUrl ? (
              <>
                <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
                  Everyone who signs up through this link is counted. It&rsquo;s
                  your account&rsquo;s own referral link, so it works anywhere
                  you paste it.
                </p>
                <div className="mt-4">
                  <CopyLink url={marketer.inviteUrl} label="Invite link" />
                </div>
              </>
            ) : (
              <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
                Your invite link is keyed on your handle, and this account
                doesn&rsquo;t have one yet.{" "}
                <Link href="/settings" className="nb-link">
                  Pick one on your settings page
                </Link>{" "}
                and the link shows up here.
              </p>
            )}

            <div className="nb-hair mt-5 pt-4">
              <p className="nb-slug">the trailer and clips</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[0.95rem]">
                <li>
                  {marketer.trailerUrl ? (
                    <a
                      href={marketer.trailerUrl}
                      className="nb-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      The trailer
                    </a>
                  ) : (
                    <span className="text-graphite">
                      The trailer isn&rsquo;t public yet. You&rsquo;ll get the
                      link the day it goes up.
                    </span>
                  )}
                </li>
                {marketer.brandKit.clips.map((c) => (
                  <li key={c.url}>
                    <a
                      href={c.url}
                      className="nb-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="nb-hair mt-5 pt-4">
              <p className="nb-slug">the brand kit</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[0.95rem]">
                {marketer.brandKit.logos.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      className="nb-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
              {/* The swatch is the one place on the site a colour is the
                  content, so it is drawn rather than described. The hex code
                  beside it is what somebody actually copies. */}
              <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {marketer.brandKit.colors.map((c) => (
                  <li key={c.hex} className="flex items-baseline gap-2 text-[0.93rem]">
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 shrink-0 translate-y-[1px] border border-ink"
                      style={{ background: c.hex }}
                    />
                    <span>
                      {c.name} <span className="nb-slug text-ink">{c.hex}</span>
                      <span className="text-graphite">, {c.use}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="nb-hint mt-3">{marketer.brandKit.fonts}</p>
            </div>

            <p className="nb-hair mt-5 max-w-[58ch] pt-4 text-[0.99rem] leading-relaxed">
              When you make something, reply to the email you got when you were
              accepted. It comes straight to me.
            </p>
          </div>
        )}

        {mode === "pending" && open && (
          <>
            <div className="nb-box nb-tilt-3 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
              <span
                className="nb-tape -top-3 left-[12%] rotate-[-3.6deg]"
                aria-hidden="true"
              />
              <span
                className="nb-tape -bottom-3 right-[18%] rotate-[2.4deg]"
                aria-hidden="true"
              />
              <p className="nb-slug">sent {day(open.createdAt) ?? "recently"}</p>
              <p className="mt-3 font-semibold">
                It&rsquo;s on the desk, waiting to be read.
              </p>
              <p className="mt-2 max-w-[58ch] text-[0.99rem] leading-relaxed text-graphite">
                Nothing else is needed from you, and there is no second step.
                You&rsquo;ll get an email either way, and this page says where it
                stands until then.
              </p>
              <WithdrawForm />
            </div>
            <p className="nb-hint mt-4 max-w-[58ch]">
              One open application at a time. Withdrawing closes this one, and
              you can send a new one straight after.
            </p>
          </>
        )}

        {mode === "no-handle" && (
          <div className="nb-box nb-tilt-2 mt-6 p-[clamp(1.1rem,2.6vw,1.8rem)]">
            <span
              className="nb-tape -top-3 left-[20%] rotate-[-2.9deg]"
              aria-hidden="true"
            />
            <p className="nb-slug">one field on your settings page</p>
            {/* The whole state, not a warning printed beside a live form. The
                reviewer only ever sees a handle and a team number, so an
                application without a handle arrives with nothing on it to
                identify anybody. Asking here also means there is no
                half-written draft to lose on the trip to /settings. */}
            <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
              A handle is the only thing on an application that says who sent
              it, and your invite link is built from it. Without one, yours
              lands on the desk as a team number and nothing else. Pick one,
              then come back and the three questions are right here.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href="/settings" className="nb-btn">
                Pick a handle
              </Link>
              <span className="nb-hint">
                Your team number lives on the same page, and it&rsquo;s worth
                setting while you&rsquo;re there.
              </span>
            </div>
          </div>
        )}

        {(mode === "again" || mode === "new") && handle && (
          <>
            {closed && (
              <div className="mt-6">
                <p className="nb-slug">
                  {closed.status === "withdrawn"
                    ? `withdrawn ${day(closed.reviewedAt) ?? "earlier"}`
                    : `turned down ${day(closed.reviewedAt) ?? "earlier"}`}
                </p>
                <p className="mt-2 max-w-[60ch] text-[0.99rem] leading-relaxed">
                  {closed.status === "withdrawn"
                    ? "You pulled that one back before it was decided. You can send another whenever you like."
                    : "That one was turned down, which is not a permanent answer. If something has changed since, say so in the first box."}
                </p>
                {closed.reviewNote && (
                  <div className="nb-note mt-4 max-w-[64ch]">
                    <p className="nb-slug">what the reviewer wrote back</p>
                    <p className="mt-2 text-[0.95rem] leading-relaxed whitespace-pre-line">
                      {closed.reviewNote}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* `handle &&` above is how the type system sees what `mode`
                already guarantees: loadApplyState only answers "again" or
                "new" for an account that has a handle. */}
            {!APPLICATIONS_OPEN ? (
              <p className="nb-note mt-6" role="status">
                Applications are closed for now. Check back soon.
              </p>
            ) : (
            <div className="mt-6">
              <ApplyForm
                username={handle}
                teamNumber={state?.record.teamNumber ?? null}
                // The word, not the stored slug. `profiles.role` holds
                // `other` for a fifth of accounts, and a strip that claims to
                // be the whole record cannot print a value nobody would use
                // about themselves. The desk and the owner's email read the
                // same table.
                teamRole={state?.record.teamRoleLabel ?? null}
                again={!!closed}
              />
            </div>
            )}
          </>
        )}
      </section>

      <p className="nb-hint mt-[clamp(2.4rem,5vw,3.4rem)] max-w-[68ch]">
        Not looking to help spread it, just want to tell me something is wrong?
        The{" "}
        <Link href="/contact" className="nb-link">
          contact form
        </Link>{" "}
        is the shorter path and needs no account at all. Every change anyone has
        suggested is public on the{" "}
        <Link href="/contributions" className="nb-link">
          contributions page
        </Link>
        .
      </p>
    </div>
  );
}
