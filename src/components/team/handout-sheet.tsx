import { ShieldCheck } from "lucide-react";
import { InviteQr } from "./invite-qr";
import { teamInviteUrl, teamInviteDisplayUrl } from "./invite-link";

/**
 * THE HANDOUT — the artifact that actually gets printed.
 *
 * Kept as its own component, separate from the route, for two reasons: the
 * route is only an auth gate, and a sheet that goes on paper needs to be
 * renderable in isolation to be checked without logging anyone in.
 *
 * WHAT THE QR ENCODES
 * Exactly `teamInviteUrl(username)` — the same string /teams copies and shares,
 * from the same module, so the code on paper and the link on screen cannot
 * drift apart. It is a plain referral signup link: no token, no expiry, no use
 * cap, and it confers nothing on its own. Scanning it opens the ordinary
 * signup form and whoever scanned still makes their own account.
 *
 * That is also why this sheet has no "expires on" line and never needs
 * reprinting — there is no membership state anywhere in this feature, so a
 * sheet left on a shop table is a link to a public signup page, not a live
 * credential.
 *
 * THE "WHAT YOUR TEAMMATES WILL SEE" BOX IS NOT DECORATION. Readers are minors
 * and half of them will never open Settings. The sheet states, on paper,
 * exactly which fields a teammate can see (username, avatar, finished lessons,
 * last active), exactly which they cannot (real name, email), and how to undo
 * it — before they scan, not after.
 *
 * NOTHING HERE ANIMATES. A framer-motion `initial={{opacity:0}}` that never
 * gets its frame prints as a blank rectangle, and this component's entire job
 * is to print.
 */
export function HandoutSheet({
  username,
  teamNumber,
}: {
  /** Referral username — the sheet is meaningless without one. */
  username: string;
  /** Optional: the sheet renders correctly on a username alone. */
  teamNumber: number | null;
}) {
  const joinUrl = teamInviteUrl(username);
  const shownUrl = teamInviteDisplayUrl(username);
  const teamLine = teamNumber ? `Team ${teamNumber}` : "Your team";
  const withNumber = teamNumber
    ? ` and put ${teamNumber} in the team number box`
    : "";

  return (
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
          {teamNumber ? `Team ${teamNumber}` : "Free for every team"}
        </span>
      </div>

      {/* Headline */}
      <h1 className="mt-7 text-balance font-display text-[2rem] font-extrabold leading-[1.08] sm:text-[2.6rem]">
        {teamLine} is on LearnFRC
      </h1>
      <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-[#141c2e]/75">
        Free lessons for every seat on the team — mechanical, electrical, CAD,
        programming, controls, scouting, strategy, safety, business and
        outreach. No cost, no trial, no card. Take the subteam you actually work
        on and start.
      </p>

      {/* Code + steps. The `print:` variant is not redundant with `sm:` —
          browsers disagree about which width a print media query resolves
          against, and this layout stacking on paper would push the sheet onto a
          second page, which is the one thing a one-page handout must not do. */}
      <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,190px)_1fr] sm:gap-9 print:grid-cols-[minmax(0,180px)_1fr] print:gap-8">
        <div>
          {/* Same encoder and same component as the on-screen invite panel —
              one QR implementation in the codebase, not two. */}
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
            body={`About thirty seconds — an email address and a username${withNumber}. That number is what puts you on the team page with everyone else.`}
          />
          <Step
            n={3}
            title="Pick your subteam and start lesson one"
            body="Choose what you actually do on the team. Every lesson you finish shows up for the whole crew — and you both get +25 XP the moment you confirm your email."
          />
        </ol>
      </div>

      {/* What sharing actually means, stated on paper, before anyone scans */}
      <div className="mt-8 rounded-xl border border-[#141c2e]/15 bg-[#141c2e]/[0.03] px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#141c2e]/60">
          What your teammates will see
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#141c2e]/80">
          Everyone who signs up with the same team number shares one team page.
          On it, your teammates can see{" "}
          <strong className="font-semibold">
            your username, your picture, which lessons you have finished and
            when you were last active
          </strong>
          . They cannot see your real name or your email, and they cannot change
          anything on your account. Clear the team number in Settings whenever
          you like — your lessons and XP stay yours either way.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#141c2e]/12 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#141c2e]/55">
        <span>Free forever · No card · Every subteam</span>
        <span>learnfrc.com</span>
      </div>
    </div>
  );
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
