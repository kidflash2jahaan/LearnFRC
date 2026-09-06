import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "./_password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

/**
 * The three steps of a password reset, written down the left margin the way a
 * lab book carries its numbering. Each step gets a state word as well as a
 * rule, because the page has to survive being read in greyscale and a blue bar
 * on its own says nothing.
 */
const STEPS = [
  { n: "1", label: "reset asked for" },
  { n: "2", label: "link opened" },
  { n: "3", label: "new password" },
] as const;

/**
 * SET A NEW PASSWORD — the last page of the recovery, laid out as a ruled sheet
 * with its sequence written in the margin.
 *
 * Nobody arrives here on purpose. They clicked a link in an inbox and this is
 * step three of three, so the page's first job is to say where they are in a
 * sequence they did not choose to be in, and its second is to be one field pair
 * and a button. That is why the composition is a margin column and a text
 * column rather than another card: /login and /signup are taped sheets you
 * chose to walk up to, and this one is the end of somebody else's errand.
 *
 * TWO STATES, ONE FRAME. The recovery link mints a session before it lands
 * here, so a session means the link worked. No session means it was already
 * used or it timed out, and the margin says so in the same three rows rather
 * than swapping the page for a different one.
 *
 * BEHAVIOUR IS UNCHANGED: same `getSession` check, same metadata, same
 * /forgot-password escape hatch.
 */
export default async function UpdatePasswordPage() {
  // The recovery link (via /auth/confirm) mints a session before landing here.
  // No session ⇒ the user opened this page directly or the link expired.
  const { user } = await getSession();

  return (
    <div className="nb-wrap py-[clamp(2.4rem,5vw,4.2rem)]">
      <div className="grid gap-[clamp(1.6rem,4vw,3rem)] lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
        {/* ── The margin. Where you are, in three rows. ───────────────── */}
        <aside
          aria-label="Where you are in the reset"
          className="lg:border-r-2 lg:border-ink lg:pr-[clamp(1rem,2vw,1.8rem)]"
        >
          <p className="nb-slug border-b-2 border-ink pb-2">
            recovery {user ? "3 / 3" : "stopped"}
          </p>

          <ol className="mt-3">
            {STEPS.map((step, i) => {
              // With a live session the sequence has reached its third row, so
              // that row is the one you are standing on. Without one it stopped
              // at the second, and the third is drawn as never reached rather
              // than as current.
              const isHere = !!user && i === 2;
              const state = user
                ? ["done", "done", "you are here"][i]
                : ["done", "expired", "not reached"][i];
              return (
                <li
                  key={step.n}
                  className={[
                    "flex items-baseline gap-2.5 border-b border-dashed border-rule py-2.5 pl-2",
                    // The bar is an inset shadow rather than a left border: the
                    // row's other rules are dashed, and Tailwind sets
                    // border-style on all four sides at once.
                    isHere
                      ? "bg-[rgba(27,54,200,0.06)] shadow-[inset_3px_0_0_var(--blue)]"
                      : "",
                  ].join(" ")}
                >
                  <span className="nb-slug font-bold text-ink">{step.n}</span>
                  <span className="min-w-0">
                    <span className="nb-slug block text-ink">{step.label}</span>
                    <span className="nb-slug block">{state}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* ── The sheet. One field pair, or one dead end. ─────────────── */}
        <div className="max-w-[33rem]">
          {user ? (
            <>
              <h1 className="max-w-[15ch]">Write in a new password.</h1>
              <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
                The link checked out, so the account is open in front of you.
                Pick the new password and it saves you straight into the
                dashboard, already signed in.
              </p>

              <div className="mt-[clamp(1.4rem,3vw,2.2rem)] border-t-2 border-ink pt-[clamp(1.2rem,2.6vw,1.8rem)]">
                <PasswordForm />
              </div>

              <p className="nb-pen mt-6 max-w-[26ch] rotate-[-1.2deg]">
                using a password manager? save it there before you press the
                button
              </p>
            </>
          ) : (
            <>
              <h1 className="max-w-[16ch]">That link is no longer any good.</h1>
              <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
                It opened, but there is nothing behind it any more, so there is
                no account here to change the password on.
              </p>

              <div className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[34rem]">
                <p className="nb-slug">why it stopped working</p>
                <p className="mt-1.5 text-[0.95rem] leading-snug">
                  A reset link lasts an hour and works exactly once. If you
                  asked twice, only the newest one opens, and clicking an older
                  one from further up the inbox lands you here. Nothing is
                  wrong with the account.
                </p>
              </div>

              <div className="mt-[clamp(1.4rem,3vw,2rem)] flex flex-wrap gap-3">
                <Link href="/forgot-password" className="nb-btn">
                  Send a fresh link
                </Link>
                <Link href="/login" className="nb-btn-ghost">
                  Back to the sign-in sheet
                </Link>
              </div>

              <p className="nb-pen mt-6 max-w-[28ch] rotate-[0.8deg]">
                open the newest one in your inbox, not the first one you find
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
