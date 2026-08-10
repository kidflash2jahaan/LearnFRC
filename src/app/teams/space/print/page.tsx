import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, Printer, Users, Link2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getMyTeamSpace, getSpaceInvite } from "@/lib/team-space";
import { PrintButton } from "@/components/certificate/print-button";
import { InviteQr } from "@/components/team/invite-qr";
import { inviteUrl } from "@/app/join/space/invite-link";
import { ensureSheetInvite } from "./actions";

/**
 * THE MEETING SHEET — one printed page a mentor hands out at a first meeting.
 *
 * WHY PAPER, ON A WEBSITE
 * -----------------------
 * Every in-app prompt this feature can fire is bounded by the people already on
 * LearnFRC, and the numbers say that pool is tiny: 109 of 144 teams have exactly
 * one member, and only ~26 accounts clear any sensible engagement bar for a
 * "start a space" nudge. A sheet handed out at a build-season meeting is the one
 * surface whose reach is NOT bounded by our user count — it reaches the thirty
 * students in the room, none of whom have an account. That is the whole growth
 * argument for this route.
 *
 * WHAT THE QR ENCODES, AND WHAT IT DELIBERATELY DOES NOT
 *  - Exactly `inviteUrl(token)` — the same string the lead's on-screen invite
 *    panel copies, built by the same module, so the printed code and the pasted
 *    link can never drift apart. Nothing is appended: `/join/space/continue`
 *    already stamps `via=team-invite` server-side, so encoding attribution into
 *    the QR would put the same contract in two places and cost modules for it.
 *  - An INVITE TOKEN, not a team number. A number would be an enumeration
 *    oracle over which teams have spaces; a rotatable token is revocable,
 *    expiring and use-capped, which is what makes a sheet left on a shop table
 *    survivable.
 *  - Clicking or scanning still confers NOTHING. `/join/space` requires an
 *    account and an explicit press; this sheet is a pointer to a consent
 *    screen, and its copy says the same thing that screen says.
 *
 * THE CONSENT BOX IS NOT DECORATION. Readers are minors and half of them will
 * never open Settings. The sheet states, on paper, exactly which fields the
 * space sees (finished lessons, last active), exactly which it does not (name,
 * email) and how to leave — before they scan, not after.
 *
 * PRINT MECHANICS. Same technique as the certificate page: everything is hidden
 * for print except `#sheet`, which is lifted to the top of the page. Nothing on
 * the sheet animates — a framer-motion `initial={{opacity:0}}` that never gets
 * its frame prints as a blank rectangle, and this page's entire job is to print.
 */

export const metadata: Metadata = {
  title: "Team join sheet · LearnFRC",
  description: "A printable one-page sheet for getting your team onto LearnFRC.",
  // Belt and braces: /teams is already disallowed in robots.ts, and this page
  // renders a live invite token. It must never be indexed, and its outbound
  // link must never be followed.
  robots: { index: false, follow: false },
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

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

export default async function TeamSheetPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/teams/space/print");

  const space = await getMyTeamSpace();
  // Same hand-off /teams/space itself performs: there is no sheet without a
  // space, and the create screen is one field away.
  if (!space) redirect("/teams/space/new");
  if (space.myRole !== "lead")
    return <Shell><NotLead teamNumber={space.teamNumber} /></Shell>;

  const res = await getSpaceInvite(space.id);
  const invite = res.ok ? res.data : null;
  if (!invite) return <Shell><NoLink teamNumber={space.teamNumber} /></Shell>;

  const joinUrl = inviteUrl(invite.token, SITE);
  const shownUrl = joinUrl.replace(/^https?:\/\//, "");
  const expires = new Date(invite.expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const spotsLeft = Math.max(0, invite.maxUses - invite.uses);

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/teams/space"
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
          them out — anyone who scans it lands on the join screen for{" "}
          <strong className="font-semibold text-foreground">
            Team {space.teamNumber}
          </strong>
          , makes a free account, and picks a subteam. The code dies on {expires}
          , or once {spotsLeft} more {spotsLeft === 1 ? "person joins" : "people join"}
          , whichever comes first — a sheet left on a table is not a standing
          invitation.
        </p>
      </div>

      {/* ==================== THE PRINTED ARTIFACT ==================== */}
      <div
        id="sheet"
        className="rounded-[24px] border border-[color:var(--border)] bg-white p-8 text-[#141c2e] shadow-[0_24px_55px_-24px_rgba(38,78,150,0.28)] sm:p-10"
      >
        {/* Masthead */}
        <div className="flex items-center justify-between gap-4 border-b border-[#141c2e]/12 pb-5">
          <span className="inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1d4fd0] text-white">
              <ShieldCheck aria-hidden className="h-[18px] w-[18px]" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              LearnFRC
            </span>
          </span>
          <span className="rounded-full border border-[#141c2e]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
            Team {space.teamNumber}
          </span>
        </div>

        {/* Headline */}
        <h1 className="mt-7 text-balance font-display text-[2rem] font-extrabold leading-[1.08] sm:text-[2.6rem]">
          Team {space.teamNumber} is on LearnFRC
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-[#141c2e]/75">
          Free lessons for every seat on the team — mechanical, electrical, CAD,
          programming, controls, scouting, strategy, safety, business and
          outreach. No cost, no trial, no card. Take the subteam you actually
          work on and start.
        </p>

        {/* Code + steps. The `print:` variant is not redundant with `sm:` —
            browsers disagree about which width a print media query resolves
            against, and this layout stacking on paper would push the sheet onto
            a second page, which is the one thing a one-page handout must not do. */}
        <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,190px)_1fr] sm:gap-9 print:grid-cols-[minmax(0,180px)_1fr] print:gap-8">
          <div>
            {/* Same encoder and same component as the lead's on-screen invite
                panel — one QR implementation in the codebase, not two. */}
            <InviteQr
              url={joinUrl}
              className="h-auto w-full max-w-[190px]"
              title={`QR code linking to ${shownUrl}`}
            />
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#141c2e]/55">
              Or type this in
            </p>
            <p className="mt-1 break-all font-mono text-[13px] font-semibold leading-snug">
              {shownUrl}
            </p>
          </div>

          <ol className="space-y-5">
            <Step
              n={1}
              title="Scan the code"
              body="Point your phone camera at it and tap the link that pops up. No app to install."
            />
            <Step
              n={2}
              title="Make a free account"
              body="About thirty seconds — an email address and a username. Then press join, and you're on the team."
            />
            <Step
              n={3}
              title="Pick your subteam and start lesson one"
              body="Choose what you actually do on the team. Every lesson you finish shows up for the whole crew."
            />
          </ol>
        </div>

        {/* Consent, stated on paper, before anyone scans */}
        <div className="mt-8 rounded-xl border border-[#141c2e]/15 bg-[#141c2e]/[0.03] px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#141c2e]/60">
            What Team {space.teamNumber} will see
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#141c2e]/80">
            Once you join, whoever set this space up can see{" "}
            <strong className="font-semibold">
              which lessons you have finished and when you were last active
            </strong>
            . They cannot see your name or your email, they cannot change
            anything on your account, and you can leave the space at any time
            from Settings — your lessons and XP stay yours either way.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#141c2e]/12 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#141c2e]/55">
          <span>
            Code works until {expires} · {pluralSpots(spotsLeft)}
          </span>
          <span>learnfrc.com</span>
        </div>
      </div>
    </Shell>
  );
}

function pluralSpots(n: number) {
  return n === 1 ? "1 spot left" : `${n} spots left`;
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1d4fd0] text-[13px] font-bold text-white">
        {n}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[17px] font-bold leading-snug">
          {title}
        </span>
        <span className="mt-0.5 block text-[13.5px] leading-relaxed text-[#141c2e]/70">
          {body}
        </span>
      </span>
    </li>
  );
}

/* ----------------------------------------------------------------- */
/*  Page frame + the two states that have no sheet to show            */
/* ----------------------------------------------------------------- */

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6">{children}</div>
    </div>
  );
}

function Notice({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="ac-card px-6 py-12 text-center print:hidden">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--primary)]/10 text-primary">
        {icon}
      </span>
      <p className="mt-4 font-display text-xl font-bold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-foreground/70">
        {body}
      </p>
      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  );
}

function NotLead({ teamNumber }: { teamNumber: number }) {
  return (
    <Notice
      icon={<Users aria-hidden className="h-6 w-6" />}
      title={`You're a member of Team ${teamNumber}`}
      body="Only the person who set the space up can hand out join codes — that keeps one team's link in one pair of hands. Ask them for the sheet."
      action={
        <Link href="/teams/space" className="ac-btn text-sm">
          Back to your team
        </Link>
      }
    />
  );
}

/**
 * No live link. The button mints one; it never rotates an existing one (see
 * actions.ts), so pressing it twice cannot invalidate sheets already handed
 * out. A plain <form> so it works without JavaScript — this is the page people
 * open on a shop laptop ten minutes before a meeting.
 */
function NoLink({ teamNumber }: { teamNumber: number }) {
  return (
    <Notice
      icon={<Link2 aria-hidden className="h-6 w-6" />}
      title={`Team ${teamNumber}'s join link isn't live`}
      body={`Team ${teamNumber}'s invite link has expired, been used up, or was never created. Make a new one and the sheet is ready to print.`}
      action={
        <form action={ensureSheetInvite}>
          <button type="submit" className="ac-btn text-sm">
            <Printer aria-hidden className="h-4 w-4" />
            Create the join link
          </button>
        </form>
      }
    />
  );
}
