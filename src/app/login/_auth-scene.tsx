import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The two halves of the sign-in spread.
 *
 * The page it replaces was a floating glass card ringed by six department
 * badges that drifted up and down forever, with a green "Pit is open" dot
 * pulsing beside it. None of that was true: nothing on the page was live, the
 * badges were not links, and the only thing a returning learner wants from
 * this route is to get through it. So the spread is a sign-in sheet clipped to
 * the shop door, and beside it, in the margin, a short note about what the
 * account is actually for.
 *
 * Both halves are Server Components. The only client code left on this route
 * is the form itself, which needs `useActionState`.
 */

/** The clipped sheet the form is filled in on. */
export function SignInSheet({ children }: { children: ReactNode }) {
  return (
    <div className="nb-box nb-tilt-3 p-[clamp(1.15rem,2.6vw,1.8rem)]">
      {/* Two strips, different angles, because nobody tapes anything twice the
          same way. Decoration only: nothing here reads as state. */}
      <span className="nb-tape -top-3 left-[18%] rotate-[-3.4deg]" aria-hidden="true" />
      <span className="nb-tape -bottom-3 right-[14%] rotate-[2.2deg]" aria-hidden="true" />

      <p className="nb-slug border-b border-dashed border-rule pb-3">
        sign-in sheet
      </p>

      <div className="mt-5">{children}</div>
    </div>
  );
}

/**
 * What the account is for, written out plainly.
 *
 * Three lines, ruled apart, and then the fact that matters most to somebody who
 * has landed here by accident: reading the site never required an account and
 * still does not. Saying so costs one sign-in and buys the trust of everyone
 * who was about to bounce.
 */
const KEEPS = [
  {
    slug: "progress",
    text: "Every lesson you have passed, counted per department, so you always know which one you are mid-way through.",
  },
  {
    slug: "certificates",
    text: "Clear a department's quizzes and it prints you a certificate with your name on it.",
  },
  {
    slug: "team",
    text: "Your team page fills in as your teammates sign up, and the leaderboard starts counting.",
  },
];

export function SignInAside() {
  return (
    <aside className="lg:pt-2">
      <p className="nb-marker">what the account holds</p>

      <dl className="nb-list">
        {KEEPS.map((k) => (
          <div
            key={k.slug}
            className="grid gap-1 border-b border-dashed border-rule py-4 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-6"
          >
            <dt className="nb-slug">{k.slug}</dt>
            <dd className="max-w-[46ch] text-[0.95rem] leading-snug text-graphite">
              {k.text}
            </dd>
          </div>
        ))}
      </dl>

      <p className="nb-pen mt-6 max-w-[26ch] rotate-[-1.2deg]">
        reading was never behind a login. this is just the scorekeeping.
      </p>

      <p className="mt-6">
        <Link href="/guides" className="nb-btn-ghost nb-btn-sm">
          Read the guides without an account
        </Link>
      </p>
    </aside>
  );
}
