"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const NAV = [
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Articles" },
  { href: "/paths", label: "Paths" },
  { href: "/glossary", label: "Glossary" },
  { href: "/resources", label: "Resources" },
  { href: "/tools", label: "Tools" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/for-teams", label: "For teams" },
];

/**
 * The last slot is audience-dependent. Signed OUT, "For teams" is the pitch
 * page, the right thing for a mentor deciding whether this is worth their
 * team's time. Signed IN, that page has already done its job and the useful
 * destination is the member's own team, which otherwise lives only inside the
 * avatar dropdown where nobody thinks to look. 109 of 144 teams have exactly
 * one member, and the invite link that would fix that is on /teams, so the
 * route to it has to be visible, not discoverable-if-you-hunt.
 *
 * Swapping after load is safe and matches what this component already does:
 * `me` starts { authed: false } on both server and first client render, so the
 * server HTML and the hydration pass agree, and the swap happens in the same
 * post-fetch update that draws the avatar.
 */
function navFor(authed: boolean) {
  if (!authed) return NAV;
  return NAV.map((item) =>
    item.href === "/for-teams" ? { href: "/teams", label: "My team" } : item
  );
}

type Me = {
  authed: boolean;
  profile: Profile | null;
  email?: string | null;
  isAdmin: boolean;
};

/**
 * The caret under the account name, drawn at the same weight as the one the
 * kit puts inside a select, so the two read as the same pen.
 *
 * It turns over when the menu is open. That is the only motion in the header,
 * and it is here because it is the only thing in the header that was saying
 * something untrue: a chevron pointing down under an open menu is still
 * advertising the thing it already did. Radix stamps `data-state` on the
 * trigger, so the mark answers the state rather than a click handler.
 *
 * 140ms on the response curve, the hover/focus timing, because that is what
 * this is: the interface acknowledging a pointer. Under reduced motion the
 * global rule zeroes the duration and the caret simply arrives pointing up,
 * which is the whole point of it, so nothing is lost.
 */
function Caret() {
  return (
    <svg
      width="11"
      height="7"
      viewBox="0 0 14 9"
      aria-hidden="true"
      className="shrink-0 transition-[rotate] duration-[var(--nb-t-hover)] ease-[var(--nb-ease-out)] group-data-[state=open]:rotate-180"
    >
      <path
        d="M1 1.4 7 7.6 13 1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The header is an index card taped across the top of the binder: card stock,
 * a 2px ink rule under it, and a strip of section tabs. It is deliberately not
 * a floating glass bar, and it does not change on scroll, because a header
 * that restyles itself as you read is a second visual language.
 *
 * There is no hamburger. Eight destinations exist at every width; below xl the
 * tab strip drops to its own row and flicks sideways like the divider tabs in
 * a real binder, with a fade on the right edge saying there is more. That is
 * strictly more navigable than hiding all eight behind a button, and it costs
 * no state, no portal and no animation library.
 */
export function Navbar() {
  const pathname = usePathname();
  const [me, setMe] = React.useState<Me>({ authed: false, profile: null, isAdmin: false });
  const [loaded, setLoaded] = React.useState(false);

  // Auth is fetched client-side so the root layout can stay static/cacheable.
  React.useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (active) {
            setMe(d);
            setLoaded(true);
          }
        })
        .catch(() => active && setLoaded(true));
    load();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { authed, profile, email, isAdmin } = me;
  const openSearch = () => window.dispatchEvent(new Event("open-search"));
  const who = profile?.full_name || profile?.username || "Learner";

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--ink)] bg-[var(--card)]">
      <nav
        aria-label="Main"
        className="nb-wrap flex flex-wrap items-center gap-x-[clamp(0.7rem,1.8vw,1.4rem)] py-1.5 xl:h-16 xl:flex-nowrap xl:py-0"
      >
        <Logo className="mr-auto xl:mr-0" />

        {/* The tab strip. `nb-scroll` only actually scrolls once the tabs stop
            fitting, so the same markup is a single quiet line at xl and a
            flickable strip below it. The vertical padding is not decoration:
            it holds the 2px focus ring clear of the scroll container's edge. */}
        <div
          className={[
            "nb-scroll order-3 flex w-full items-center gap-x-[clamp(0.55rem,1.5vw,1.3rem)] py-1.5",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "max-xl:border-t max-xl:border-dashed max-xl:border-[var(--rule)] max-xl:pr-8",
            "max-xl:[mask-image:linear-gradient(to_right,#000_calc(100%-2.2rem),transparent)]",
            "xl:order-none xl:mr-auto xl:w-auto xl:overflow-visible",
          ].join(" ")}
        >
          {navFor(authed).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="nb-navlink"
              >
                {item.label}
              </Link>
            );
          })}

          {/* Signed out, "Log in" rides at the end of the strip behind a rule,
              which keeps it reachable at 390px without a second row of chrome
              competing with the one CTA. */}
          {loaded && !authed && (
            <>
              <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--rule)]" />
              <Link href="/login" className="nb-navlink">
                Log in
              </Link>
            </>
          )}
        </div>

        {/* The bottom padding below xl is clearance, not spacing: these buttons
            carry a 3px offset ink drop, and without it the drop lands on the
            dashed rule that opens the tab row. */}
        <div className="flex shrink-0 items-center gap-2 max-xl:pb-1.5">
          <button
            type="button"
            onClick={openSearch}
            className="nb-btn-ghost nb-btn-sm"
            aria-label="Search lessons and articles"
          >
            search
            <kbd
              aria-hidden="true"
              className="hidden rounded-[var(--hand-s)] border border-[var(--rule)] px-1.5 py-px font-[inherit] text-[0.68rem] font-normal lg:inline-block"
            >
              &#8984;K
            </kbd>
          </button>

          {!loaded ? (
            <Skeleton className="size-10 rounded-full" />
          ) : authed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  /* `group` so the caret can read this trigger's data-state.
                     The colour move is the same one every nav item makes, on
                     the same timing, so the avatar stops being the one control
                     in the header that does not answer a pointer. */
                  className="group flex min-h-11 cursor-pointer items-center gap-1.5 text-[var(--graphite)] transition-colors duration-[var(--nb-t-hover)] ease-[var(--nb-ease-out)] hover:text-[var(--ink)] data-[state=open]:text-[var(--ink)]"
                  aria-label="Account menu"
                >
                  <Avatar
                    name={profile?.full_name || profile?.username || email}
                    src={profile?.avatar_url}
                    seed={profile?.id}
                  />
                  <Caret />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>
                  <div className="truncate text-[0.95rem] font-bold">{who}</div>
                  <div className="nb-slug truncate">{email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/teams">My team</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bookmarks">Bookmarks</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async (e) => {
                    e.preventDefault();
                    try {
                      await signOut();
                    } finally {
                      // Full reload so the whole app drops the session at once.
                      window.location.assign("/");
                    }
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/signup" className="nb-btn nb-btn-sm">
              Get started
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
