import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/logo";
import { NewsletterForm } from "@/components/newsletter-form";

const COLS = [
  {
    title: "Learn",
    links: [
      { label: "All Guides", href: "/guides" },
      { label: "Learning Paths", href: "/paths" },
      { label: "Articles", href: "/blog" },
      { label: "Glossary", href: "/glossary" },
      { label: "Resources", href: "/resources" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Leaderboard", href: "/leaderboard" },
      { label: "Log in", href: "/login" },
      { label: "Get started", href: "/signup" },
    ],
  },
];

const FRC_LINKS = [
  { label: "FIRST Inspires", href: "https://www.firstinspires.org/robotics/frc" },
  { label: "WPILib Docs", href: "https://docs.wpilib.org" },
  { label: "Chief Delphi", href: "https://www.chiefdelphi.com" },
  { label: "The Blue Alliance", href: "https://www.thebluealliance.com" },
];

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-border bg-card/30">
      {/* neon top hairline */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {/* system-status strip */}
        <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[var(--glow-primary)] animate-glow-pulse" />
            system: online
          </span>
          <span className="text-border">/</span>
          <span>393+ lessons</span>
          <span className="text-border">/</span>
          <span>11 departments</span>
          <span className="text-border">/</span>
          <span>100% free, forever</span>
        </div>

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The complete, structured guide to mastering every department of the
              FIRST Robotics Competition — from swerve drives to the Impact Award.
            </p>
            <div className="mt-5">
              <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                $ subscribe --new-content
              </p>
              <NewsletterForm />
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
              FRC Community
            </h4>
            <ul className="mt-4 space-y-2.5">
              {FRC_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {l.label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>
            Built by{" "}
            <span className="font-medium text-foreground">Jahaan Pardhanani</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <Link href="/privacy" className="text-xs transition-colors hover:text-primary">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs transition-colors hover:text-primary">
              Terms
            </Link>
            <p className="text-xs">
              © {new Date().getFullYear()} LearnFRC · Not affiliated with or
              endorsed by FIRST®
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          LearnFRC lessons are AI-assisted: drafted from primary sources like the
          WPILib docs, game manual, and vendor sites, then reviewed and
          fact-checked for accuracy. Spot something off?{" "}
          <a
            href="https://www.chiefdelphi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-primary"
          >
            Flag it on Chief Delphi
          </a>{" "}
          and it gets fixed fast.
        </p>
      </div>
    </footer>
  );
}
