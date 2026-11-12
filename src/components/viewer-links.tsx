"use client";

import Link from "next/link";
import { useViewerSignedIn } from "@/lib/signed-in-viewer";

export type ViewerLink = { label: string; href: string };

/**
 * A list of links with a second version for a signed-in reader. The server
 * HTML is the signed-out list (the layout is static and cached for everyone);
 * the swap happens once the navbar knows who is reading
 * (src/lib/signed-in-viewer.ts). Keep both lists the same length so nothing
 * below them moves when it swaps.
 */
export function ViewerLinks({
  links,
  signedInLinks,
  className,
}: {
  links: readonly ViewerLink[];
  signedInLinks: readonly ViewerLink[];
  className?: string;
}) {
  const signedIn = useViewerSignedIn();
  return (
    <>
      {(signedIn ? signedInLinks : links).map((l) => (
        <li key={l.href}>
          <Link href={l.href} className={className}>
            {l.label}
          </Link>
        </li>
      ))}
    </>
  );
}
