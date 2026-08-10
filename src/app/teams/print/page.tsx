import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { PrintButton } from "@/components/certificate/print-button";
import { HandoutSheet } from "@/components/team/handout-sheet";

/**
 * THE MEETING HANDOUT — one printed page you hand round at a first meeting.
 *
 * WHY PAPER, ON A WEBSITE
 * -----------------------
 * Every in-app prompt this site can fire is bounded by the people already on
 * LearnFRC, and that pool is tiny: 109 of 144 teams here have exactly one
 * member. A sheet handed out at a build-season meeting is the one surface whose
 * reach is NOT bounded by our user count — it reaches the thirty students in
 * the room, none of whom have an account. That is the whole argument for this
 * route.
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

/** Hidden for print, lifted `#sheet` to the page origin. */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #sheet, #sheet * { visibility: visible !important; }
  #sheet {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
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
  if (!username) return <Shell><NoUsername /></Shell>;

  const teamNumber = profile?.team_number ?? null;

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/teams"
          className="group inline-flex min-h-11 items-center gap-1.5 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft
            aria-hidden
            className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5"
          />
          Back to your team
        </Link>
        <PrintButton />
      </div>

      <div className="mb-5 rounded-2xl border border-[color:var(--border)] bg-white/70 px-5 py-4 print:hidden">
        <p className="text-sm leading-relaxed text-foreground/75">
          One page, one code. Print a stack before your next meeting and hand
          them out — anyone who scans it lands on a free signup credited to you.
          The code has no expiry and no limit, so the same sheet works all
          season
          {teamNumber ? (
            <>
              {" "}
              for{" "}
              <strong className="font-semibold text-foreground">
                Team {teamNumber}
              </strong>
            </>
          ) : null}
          , and you both get +25 XP for every teammate who confirms their email.
        </p>
      </div>

      <HandoutSheet username={username} teamNumber={teamNumber} />
    </Shell>
  );
}

/* ----------------------------------------------------------------- */
/*  Page frame + the one state that has no sheet to show              */
/* ----------------------------------------------------------------- */

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6">{children}</div>
    </div>
  );
}

/**
 * The handout's QR is a referral link, and a referral link with no username
 * credits nobody. Send them to the one field that fixes it.
 */
function NoUsername() {
  return (
    <div className="ac-card px-6 py-12 text-center print:hidden">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--primary)]/10 text-primary">
        <UserPlus aria-hidden className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-xl font-bold text-foreground">
        Pick a username first
      </p>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-foreground/70">
        The code on the handout is your personal invite link, so it needs a
        username to credit. Choose one in Settings and the sheet is ready to
        print.
      </p>
      <div className="mt-6 flex justify-center">
        <Link href="/settings" className="ac-btn text-sm">
          Choose a username
        </Link>
      </div>
    </div>
  );
}
