import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/logo";
import { NewsletterForm } from "@/components/newsletter-form";

const LEARN = [
  { label: "All Guides", href: "/guides" },
  { label: "Learning Paths", href: "/paths" },
  { label: "Articles", href: "/blog" },
  { label: "Glossary", href: "/glossary" },
  { label: "Resources", href: "/resources" },
];

const ACCOUNT = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Log in", href: "/login" },
  { label: "Get started", href: "/signup" },
];

const COMMUNITY = [
  { label: "FIRST Inspires", href: "https://www.firstinspires.org/robotics/frc" },
  { label: "WPILib Docs", href: "https://docs.wpilib.org" },
  { label: "Chief Delphi", href: "https://www.chiefdelphi.com" },
  { label: "The Blue Alliance", href: "https://www.thebluealliance.com" },
];

export function Footer() {
  return (
    <footer className="relative mt-14 overflow-x-clip">
      {/* soft glass base that melts into the page field */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-white/45 to-white/75"
      />
      <div className="ac-divider" />

      <div className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8">
        {/* stat chips */}
        <div className="mb-10 flex flex-wrap items-center gap-2.5">
          <span className="ac-chip inline-flex items-center text-sm font-medium text-foreground">394 lessons</span>
          <span className="ac-chip inline-flex items-center text-sm font-medium text-foreground">11 departments</span>
          <span className="ac-chip inline-flex items-center text-sm font-medium text-foreground">100% free, forever</span>
        </div>

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The complete, structured guide to mastering every department of
              the FIRST Robotics Competition — from swerve drives to the Impact
              Award.
            </p>
            <div className="mt-5">
              <p className="ac-eyebrow mb-2">New lessons in your inbox</p>
              <NewsletterForm />
            </div>
          </div>

          {[
            { title: "Learn", links: LEARN },
            { title: "Account", links: ACCOUNT },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="ac-eyebrow">{col.title}</h4>
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
            <h4 className="ac-eyebrow">FRC Community</h4>
            <ul className="mt-4 space-y-2.5">
              {COMMUNITY.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {l.label}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>
            Built by <span className="font-semibold text-foreground">Jahaan Pardhanani</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <Link href="/privacy" className="text-xs transition-colors hover:text-primary">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs transition-colors hover:text-primary">
              Terms
            </Link>
            <p className="text-xs">
              © {new Date().getFullYear()} LearnFRC · Not affiliated with or endorsed by FIRST®
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          LearnFRC lessons are AI-assisted: drafted from primary sources like
          the WPILib docs, game manual, and vendor sites, then reviewed and
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
