import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PrintButton } from "@/components/certificate/print-button";
import { HandoutSheet } from "@/components/team/handout-sheet";

/**
 * THE MEETING HANDOUT: one printed page you hand round at a first meeting.
 *
 * WHY PAPER, ON A WEBSITE
 * Every in-app prompt this site can fire is bounded by the people already on
 * LearnFRC, and that pool is tiny: 109 of 144 teams here have exactly one
 * member. A sheet handed out at a build-season meeting is the one surface
 * whose reach is NOT bounded by our user count. It reaches the thirty students
 * in the room, none of whom have an account. That is the whole argument for
 * this route.
 *
 * This file is only the gate: session, username, and the print chrome. The
 * artifact itself is <HandoutSheet>, which needs nothing but a username.
 *
 * PRINT MECHANICS. Same technique as the certificate page: everything is
 * hidden for print except `#sheet` (rendered by HandoutSheet), which is lifted
 * to the top of the page.
 */

export const metadata: Metadata = {
  title: "Team handout · LearnFRC",
  description:
    "A printable one-page handout for getting your FRC team onto LearnFRC.",
  // /teams is already disallowed in robots.ts, which covers this route. The
  // noindex is belt and braces, and the nofollow keeps a crawler off the
  // personalised signup link printed on it.
  robots: { index: false, follow: false },
};

/** Everything hidden for print except `#sheet`, lifted to the page origin. */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #sheet, #sheet * { visibility: visible !important; }
  #sheet {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    border-radius: 0 !important;
    background: #ffffff !important;
  }
  /* The sheet is drawn so that nothing depends on a fill surviving: its
     numerals are ruled boxes, not knocked-out white on a disc. Opting colour
     adjustment back in is therefore about fidelity, not legibility, and it
     costs ink only on the two rules that are actually blue. */
  #sheet, #sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @page { size: portrait; margin: 0.55in; }
}
`;

export default async function TeamHandoutPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login?next=/teams/print");

  const username = profile?.username ?? null;
  // No username means no `?ref=`, which means a QR that credits nobody. Print
  // nothing rather than a handout that quietly loses the reward for both sides.
  if (!username)
    return (
      <Shell>
        <NoUsername />
      </Shell>
    );

  const teamNumber = profile?.team_number ?? null;

  return (
    <Shell>
      <div className="mb-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/teams" className="nb-navlink">
          back to your team
        </Link>
        <PrintButton />
      </div>

      <div className="nb-note mb-[clamp(1.2rem,2.6vw,1.8rem)] print:hidden">
        <p className="nb-slug">before you print</p>
        <p className="mt-2 text-[0.95rem] leading-snug">
          One page, one code. Print a stack before your next meeting and hand
          them round: anyone who scans it lands on a free signup credited to
          you. The code has no expiry and no limit, so the same sheet works all
          season
          {teamNumber ? ` for team ${teamNumber}` : ""}, and you both get +25 XP
          for every teammate who confirms their email.
        </p>
      </div>

      <HandoutSheet username={username} teamNumber={teamNumber} />
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page frame, and the one state that has no sheet to show            */
/* ------------------------------------------------------------------ */

function Shell({ children }: { children: ReactNode }) {
  return (
    <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(1.6rem,4vw,2.8rem)]">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto max-w-[52rem]">{children}</div>
    </section>
  );
}

/**
 * The handout's QR is a referral link, and a referral link with no username
 * credits nobody. Send them to the one field that fixes it.
 */
function NoUsername() {
  return (
    <div className="nb-box nb-tilt-2 relative p-[clamp(1.4rem,3.2vw,2.2rem)] print:hidden">
      <span className="nb-tape -top-3 left-[18%] rotate-[-4deg]" aria-hidden="true" />

      <p className="nb-marker">handout / needs a username</p>

      <h1 className="text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)]">
        Pick a username first.
      </h1>

      <p className="nb-lede mt-3">
        The code on the handout is your own invite link, so it needs a username
        to credit. Choose one and the sheet is ready to print.
      </p>

      <div className="mt-[clamp(1.2rem,2.4vw,1.7rem)]">
        <Link href="/settings" className="nb-btn">
          Choose a username
        </Link>
      </div>
    </div>
  );
}
