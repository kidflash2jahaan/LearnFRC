import type { CSSProperties } from "react";
import { qrCode } from "@/lib/qr";

/**
 * The invite link as a QR code, encoded locally and rendered as inline SVG.
 *
 * The point of this thing is a lead putting it on the projector at a team
 * meeting: fifteen phones scan it at once and nobody types a URL. That is also
 * why it is NOT an <img> pointed at a QR web service — that would post a live
 * invite credential to a third party on every render, and it would leave the
 * page blank in a pit with no wifi.
 *
 * Fixed black-on-white, deliberately, in both themes: a scanner needs dark
 * modules on a light field, and a "dark mode" QR is an unscannable QR. The
 * white plate is part of the code (it is the quiet zone), not decoration.
 */
export function InviteQr({
  url,
  className,
  title = "QR code for this team's invite link",
}: {
  url: string;
  className?: string;
  title?: string;
}) {
  // ECC M at ~56 bytes lands on version 4 (33x33). Bigger modules read from
  // further away than more error correction does, which is the trade that
  // matters when the audience is at the back of a classroom.
  const code = qrCode(url, { ecc: "M", margin: 4 });
  if (!code) return null;

  return (
    <svg
      viewBox={`0 0 ${code.viewBox} ${code.viewBox}`}
      role="img"
      aria-label={title}
      className={className}
      // Keeps module edges hard at any scale — antialiased edges are what makes
      // an on-screen QR fail to scan.
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated" } as CSSProperties}
    >
      <rect width={code.viewBox} height={code.viewBox} fill="#ffffff" />
      <path d={code.path} fill="#0b1220" />
    </svg>
  );
}
