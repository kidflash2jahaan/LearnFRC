import Link from "next/link";
import { Bot, ExternalLink } from "lucide-react";
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
    <footer className="relative mt-24 border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
                <Bot className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold tracking-tight">
                Learn<span className="text-gradient">FRC</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The complete, structured guide to mastering every department of the
              FIRST Robotics Competition — from swerve drives to the Impact Award.
            </p>
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">Get updates on new content</p>
              <NewsletterForm />
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="text-sm font-semibold">FRC Community</h4>
            <ul className="mt-4 space-y-2.5">
              {FRC_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
            <span className="font-medium text-foreground">
              Jahaan Pardhanani
            </span>{" "}
            · Software Lead, Sage Hill Robotics{" "}
            <span className="font-mono text-foreground">5835</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <Link
              href="/privacy"
              className="text-xs transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <p className="text-xs">
              © {new Date().getFullYear()} LearnFRC · Not affiliated with or
              endorsed by FIRST®
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground/70">
          LearnFRC lessons are AI-assisted: drafted from primary sources like the
          WPILib docs, game manual, and vendor sites, then reviewed and
          fact-checked for accuracy. Spot something off?{" "}
          <a
            href="https://www.chiefdelphi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Let me know
          </a>{" "}
          and it gets fixed fast.
        </p>
      </div>
    </footer>
  );
}
