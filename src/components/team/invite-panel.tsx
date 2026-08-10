"use client";

import * as React from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldOff,
} from "lucide-react";
import { InviteQr } from "./invite-qr";
import {
  createSpaceInviteAction,
  loadSpaceInviteAction,
  revokeSpaceInviteAction,
  type PanelInvite,
} from "@/app/join/space/actions";
import { cn } from "@/lib/utils";

/**
 * The lead's invite link — the only way anyone joins a team space.
 *
 * HOW TO MOUNT IT (from the team page, which owns the space):
 *
 *     <InvitePanel spaceId={space.id} teamName={space.name} />
 *
 * That is the whole integration. Pass nothing else: the panel fetches the live
 * link itself through a lead-gated server action, so the token never has to be
 * threaded through props and never lands in the page's RSC payload for a space
 * the viewer might not lead. If the page already has the invite in hand it can
 * pass `initialInvite` to skip the round trip.
 *
 * WHY THERE IS NO "INVITE BY EMAIL" AND NO "INVITE @USERNAME" HERE
 * ----------------------------------------------------------------
 * Both were considered and both are deliberately absent. Email would turn this
 * site into an outbound-mail primitive an adult could point at a child, carrying
 * our verified sender domain. A username field would answer "does this person
 * have an account?" about a specific named minor. A link the lead pastes into
 * the Discord their team already uses does the job without either. There is also
 * no note field, no custom message and no space name to type — no free text
 * travels from a lead to a member anywhere in this feature.
 */
export function InvitePanel({
  spaceId,
  teamName,
  initialInvite,
  className,
}: {
  spaceId: string;
  /** Derived server-side (`Team 447`). Never typed by anyone. */
  teamName: string;
  /** Omit to have the panel load it; `null` means "no live link". */
  initialInvite?: PanelInvite | null;
  className?: string;
}) {
  const [invite, setInvite] = React.useState<PanelInvite | null | undefined>(
    initialInvite
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | "load" | "create" | "revoke">(
    initialInvite === undefined ? "load" : null
  );
  const [confirming, setConfirming] = React.useState<null | "rotate" | "revoke">(null);
  const [copied, setCopied] = React.useState(false);
  const [showQr, setShowQr] = React.useState(false);

  const loaded = React.useRef(false);
  React.useEffect(() => {
    if (initialInvite !== undefined || loaded.current) return;
    loaded.current = true;
    let live = true;
    void (async () => {
      const res = await loadSpaceInviteAction(spaceId);
      if (!live) return;
      if (res.ok) setInvite(res.invite);
      else setError(res.error);
      setBusy(null);
    })();
    return () => {
      live = false;
    };
  }, [spaceId, initialInvite]);

  const run = async (
    kind: "create" | "revoke",
    fn: () => Promise<{ ok: true; invite: PanelInvite | null } | { ok: false; error: string }>
  ) => {
    setBusy(kind);
    setError(null);
    setConfirming(null);
    const res = await fn();
    if (res.ok) {
      setInvite(res.invite);
      setCopied(false);
      // A rotated link is a different secret — never leave the old QR up.
      if (!res.invite) setShowQr(false);
    } else {
      setError(res.error);
    }
    setBusy(null);
  };

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the link is visible and selectable either way */
    }
  };

  return (
    <div className={cn("ac-card p-5 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        <span
          className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
          style={{ "--a": "#2560e6" } as React.CSSProperties}
        >
          <Link2 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold leading-tight text-foreground">
            Invite your team
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/70">
            One link. Paste it in your team&apos;s group chat, or put the QR on
            the projector at your next meeting.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {busy === "load" ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Checking for a live link…
        </div>
      ) : invite ? (
        <>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={invite.url}
              aria-label="Invite link"
              onFocus={(e) => e.currentTarget.select()}
              className="ac-input w-full min-w-0 font-mono text-[13px] text-foreground/85"
            />
            <button
              type="button"
              onClick={copy}
              className="ac-btn flex items-center justify-center gap-2 text-sm sm:shrink-0"
              aria-live="polite"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Expires {formatExpiry(invite.expiresAt)} · {invite.uses} of{" "}
            {invite.maxUses} joins used. Everyone who opens it has to make an
            account and agree to share their progress before they join — the link
            on its own adds nobody.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              aria-expanded={showQr}
              className="ac-btn-ghost flex items-center gap-2 text-sm"
            >
              <QrCode className="h-4 w-4" aria-hidden />
              {showQr ? "Hide QR code" : "Show QR code"}
            </button>

            <ConfirmButton
              armed={confirming === "rotate"}
              busy={busy === "create"}
              onArm={() => setConfirming("rotate")}
              onCancel={() => setConfirming(null)}
              onConfirm={() => void run("create", () => createSpaceInviteAction(spaceId))}
              idle="New link"
              armedLabel="Replace it — the old link stops working"
              icon="rotate"
            />

            <ConfirmButton
              armed={confirming === "revoke"}
              busy={busy === "revoke"}
              onArm={() => setConfirming("revoke")}
              onCancel={() => setConfirming(null)}
              onConfirm={() => void run("revoke", () => revokeSpaceInviteAction(spaceId))}
              idle="Turn off"
              armedLabel="Turn the link off for good"
              icon="off"
            />
          </div>

          {showQr && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-white/70 p-4 sm:flex-row sm:items-center sm:gap-5">
              <InviteQr
                url={invite.url}
                title={`QR code to join ${teamName}`}
                className="h-44 w-44 shrink-0 rounded-xl sm:h-40 sm:w-40"
              />
              <div className="text-center sm:text-left">
                <p className="text-sm font-semibold text-foreground">
                  Point a phone camera at this
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  It opens the same link. Put it on the projector and the whole
                  room can join in one go — each person still sees exactly what
                  gets shared and has to agree before anything happens.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-5 text-sm leading-relaxed text-foreground/70">
            There&apos;s no live invite link right now, so nobody new can join{" "}
            {teamName}.
          </p>
          <button
            type="button"
            onClick={() => void run("create", () => createSpaceInviteAction(spaceId))}
            disabled={busy === "create"}
            aria-busy={busy === "create"}
            className="ac-btn mt-4 flex items-center justify-center gap-2 text-sm"
          >
            {busy === "create" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Link2 className="h-4 w-4" aria-hidden />
            )}
            Create an invite link
          </button>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Links last a week and can be switched off or replaced whenever you
            want.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Two-press control for the destructive pair.
 *
 * "New link" quietly kills the link that is already circulating in a team's
 * group chat, and "Turn off" closes the only door into the space. Both are
 * recoverable, but a misfire during a meeting is a bad minute, so neither fires
 * on the first press.
 */
function ConfirmButton({
  armed,
  busy,
  onArm,
  onCancel,
  onConfirm,
  idle,
  armedLabel,
  icon,
}: {
  armed: boolean;
  busy: boolean;
  onArm: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  idle: string;
  armedLabel: string;
  icon: "rotate" | "off";
}) {
  const Glyph = icon === "rotate" ? RefreshCw : ShieldOff;
  if (!armed)
    return (
      <button
        type="button"
        onClick={onArm}
        disabled={busy}
        aria-busy={busy}
        className="ac-btn-ghost flex items-center gap-2 text-sm"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Glyph className="h-4 w-4" aria-hidden />
        )}
        {idle}
      </button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="ac-btn-ghost flex items-center gap-2 text-sm font-semibold text-destructive"
      >
        <Glyph className="h-4 w-4" aria-hidden />
        {armedLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline"
      >
        Cancel
      </button>
    </span>
  );
}

/**
 * Absolute date in UTC rather than "in 6 days".
 *
 * A relative string would need Date.now(), which differs between the server
 * render and hydration and can land either side of a rounding boundary — a
 * hydration mismatch for a cosmetic gain. A fixed locale and an explicit time
 * zone render identically in both places.
 */
function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "soon";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
