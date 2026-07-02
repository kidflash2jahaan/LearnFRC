"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Search,
  Menu,
  X,
  LayoutDashboard,
  User,
  Bookmark,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
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
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/for-teams", label: "For teams" },
];

type Me = {
  authed: boolean;
  profile: Profile | null;
  email?: string | null;
  isAdmin: boolean;
};

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [me, setMe] = React.useState<Me>({
    authed: false,
    profile: null,
    isAdmin: false,
  });
  const [loaded, setLoaded] = React.useState(false);
  const reduceMotion = useReducedMotion();

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

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const openSearch = () => window.dispatchEvent(new Event("open-search"));

  return (
    <header
      data-theme="arena"
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled
          ? "aq-glass border-b border-primary/15 shadow-[var(--shadow-sm)]"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Logo />

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 380, damping: 30 }
                    }
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={openSearch}
            className="hidden cursor-pointer items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:flex"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
            <span className="hidden lg:inline">Search</span>
            <kbd
              aria-hidden="true"
              className="hidden h-5 items-center rounded-full border border-border bg-white/60 px-1.5 text-[10px] lg:inline-flex"
            >
              ⌘K
            </kbd>
          </button>
          <button
            onClick={openSearch}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground sm:hidden"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {!loaded ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" aria-hidden />
          ) : authed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar
                    name={profile?.full_name || profile?.username || email}
                    src={profile?.avatar_url}
                    seed={profile?.id}
                    className="h-9 w-9 ring-1 ring-primary/30"
                  />
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DropdownMenuLabel>
                  <div className="truncate text-sm font-semibold text-foreground">
                    {profile?.full_name || profile?.username || "Learner"}
                  </div>
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/teams">
                    <Users className="h-4 w-4" /> My team
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bookmarks">
                    <Bookmark className="h-4 w-4" /> Bookmarks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void signOut();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link href="/signup">Get started</Link>
              </Button>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border text-foreground hover:border-primary/40 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="aq-glass overflow-hidden border-b border-primary/15 md:hidden"
          >
            <nav aria-label="Mobile" className="space-y-1 px-4 py-4">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary"
                >
                  {item.label}
                </Link>
              ))}
              {loaded && !authed && (
                <div className="flex items-center gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild variant="brand" size="sm" className="flex-1">
                    <Link href="/signup">Get started</Link>
                  </Button>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
