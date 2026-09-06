import { InviteQr } from "./invite-qr";
import { teamInviteUrl, teamInviteDisplayUrl } from "./invite-link";

/**
 * THE HANDOUT, the artifact that actually gets printed.
 *
 * Kept as its own component, separate from the route, for two reasons: the
 * route is only an auth gate, and a sheet that goes on paper has to be
 * renderable in isolation so it can be checked without logging anyone in.
 *
 * WHAT THE QR ENCODES
 * Exactly `teamInviteUrl(username)`, the same string /teams copies and shares,
 * from the same module, so the code on paper and the link on screen cannot
 * drift apart. It is a plain referral signup link: no token, no expiry, no use
 * cap, and it confers nothing on its own. Scanning it opens the ordinary
 * signup form and whoever scanned still makes their own account. That is also
 * why the sheet has no "expires on" line and never needs reprinting.
 *
 * WHY IT IS WHITE AND NOT CARD STOCK. Every other surface on this site is the
 * binder's `--card`, but this one is going through a printer, and a printer
 * throws background colour away by default. Drawing it on white means what you
 * see is what comes out, and it means nothing on the sheet depends on a fill
 * surviving: the step numerals are ruled boxes with ink numbers rather than
 * white numerals knocked out of a filled circle, which is the version that
 * prints blank when a browser strips backgrounds.
 *
 * THE "WHAT YOUR TEAMMATES WILL SEE" NOTE IS NOT DECORATION. Readers are
 * minors and half of them will never open Settings. The sheet states, on
 * paper, exactly which fields a teammate can see, exactly which they cannot,
 * and how to undo it, before they scan rather than after.
 *
 * NOTHING HERE ANIMATES, and nothing here is a client component. A component
 * whose entire job is to print cannot depend on a frame ever arriving.
 */
export function HandoutSheet({
  username,
  teamNumber,
}: {
  /** Referral username. The sheet is meaningless without one. */
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
      className="nb-box bg-white p-[clamp(1.4rem,4vw,2.6rem)] print:p-8"
    >
      {/* Masthead */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-[clamp(1rem,2.2vw,1.4rem)]">
        <span className="nb-brand text-[1.35rem]">
          learn<b>FRC</b>
        </span>
        <span className="nb-slug">
          {teamNumber ? `team / ${teamNumber}` : "free for every team"}
        </span>
      </div>

      <div className="nb-rule pt-[clamp(1.2rem,2.6vw,1.8rem)]">
        <h1 className="text-[clamp(1.9rem,1.3rem+2.4vw,2.9rem)]">
          {teamLine} is on LearnFRC
        </h1>

        <p className="mt-3 max-w-[62ch] text-[0.98rem] leading-relaxed text-graphite">
          Free lessons for every seat on the team: mechanical, electrical, CAD,
          programming, controls, scouting, strategy, safety, business and
          outreach. No cost, no trial, no card. Take the subteam you actually
          work on and start.
        </p>
      </div>

      {/* Code and steps. The `print:` variant is not redundant with `sm:`:
          browsers disagree about which width a print media query resolves
          against, and this layout stacking on paper would push the sheet onto
          a second page, which is the one thing a one-page handout must not
          do. */}
      <div className="mt-[clamp(1.4rem,3vw,2.2rem)] grid gap-[clamp(1.4rem,3vw,2.4rem)] sm:grid-cols-[minmax(0,12rem)_1fr] print:grid-cols-[minmax(0,11rem)_1fr] print:gap-7">
        <div>
          {/* The code sits on its own white plate. That plate is the scanner's
              quiet zone, not a decoration, which is why nothing tints it. */}
          <div className="border-2 border-ink bg-white p-2">
            {/* Same encoder and same component as the on-screen invite panel:
                one QR implementation in this codebase, not two. */}
            <InviteQr
              url={joinUrl}
              className="h-auto w-full"
              title={`QR code linking to ${shownUrl}`}
            />
          </div>
          <p className="nb-slug mt-3">or type this in</p>
          <p className="nb-slug mt-1 break-all font-bold text-ink">{shownUrl}</p>
        </div>

        <ol className="flex flex-col gap-[clamp(1rem,2.2vw,1.4rem)]">
          <Step
            n={1}
            title="Scan the code"
            body="Point your phone camera at it and tap the link that pops up. There is no app to install."
          />
          <Step
            n={2}
            title="Make a free account"
            body={`About thirty seconds: an email address and a username${withNumber}. That number is what puts you on the team sheet with everyone else.`}
          />
          <Step
            n={3}
            title="Pick your subteam, start lesson one"
            body="Choose what you actually do on the team. Every lesson you finish shows up for the whole crew, and you both get +25 XP the moment you confirm your email."
          />
        </ol>
      </div>

      {/* What sharing actually means, stated on paper, before anyone scans. */}
      <div className="nb-note mt-[clamp(1.4rem,3vw,2.2rem)] bg-white">
        <p className="nb-slug">what your teammates will see</p>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-graphite">
          Everyone who signs up with the same team number shares one team
          sheet. On it, your teammates can see{" "}
          <b className="font-bold text-ink">
            your username, your picture, which lessons you have finished and
            when you were last active
          </b>
          . They cannot see your real name or your email, and they cannot
          change anything on your account. Clear the team number in Settings
          whenever you like: your lessons and XP stay yours either way.
        </p>
      </div>

      {/* Footer */}
      <div className="nb-rule mt-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pt-[clamp(0.8rem,1.8vw,1.1rem)]">
        <span className="nb-slug">free forever / no card / every subteam</span>
        <span className="nb-slug">learnfrc.com</span>
      </div>
    </div>
  );
}

/**
 * One numbered step. The numeral is ruled, not filled: a white numeral knocked
 * out of a solid disc is the single most common thing to vanish when a browser
 * strips backgrounds for print, and a handout whose steps are unnumbered is a
 * handout nobody can follow.
 */
function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3.5">
      <span
        className="nb-box-sm flex h-8 w-8 shrink-0 items-center justify-center bg-white"
        aria-hidden="true"
      >
        <span className="nb-slug font-bold text-ink">{n}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-[1.05rem] font-extrabold leading-snug tracking-[-0.02em]">
          {title}
        </span>
        <span className="mt-1 block text-[0.9rem] leading-relaxed text-graphite">
          {body}
        </span>
      </span>
    </li>
  );
}
