import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ScrollText,
  UserCheck,
  KeyRound,
  ShieldAlert,
  BookOpen,
  FileText,
  Award,
  Scale,
  LogOut,
  RefreshCw,
  Mail,
  ExternalLink,
  Handshake,
  Clock,
} from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";
import { ContentsRail, type RailItem } from "./_contents-rail";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using LearnFRC.",
};

const UPDATED = "June 20, 2026";
const CONTACT = "29pardhananij@sagehillschool.org";

const LINK =
  "font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent break-words";

const strong = "font-semibold text-foreground";

type Rule = {
  id: string;
  icon: typeof ScrollText;
  a: string;
  title: string;
  body: ReactNode;
};

/** The eleven house rules, in reading order — content preserved verbatim. */
const RULES: Rule[] = [
  {
    id: "eligibility",
    icon: UserCheck,
    a: "#2560e6",
    title: "Who can use LearnFRC",
    body: (
      <p>
        You should be at least 13 years old to create an account. If
        you&apos;re under 18, you should have a parent or guardian&apos;s
        permission. By signing up you confirm the information you provide is
        accurate.
      </p>
    ),
  },
  {
    id: "account",
    icon: KeyRound,
    a: "#1aa9d6",
    title: "Your account",
    body: (
      <ul className="space-y-2 pl-5 list-disc marker:text-primary/60">
        <li>
          Keep your password secure; you&apos;re responsible for activity on
          your account.
        </li>
        <li>
          Choose a username and display name that aren&apos;t offensive or
          impersonating.
        </li>
        <li>Verify your email address to activate your account.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    icon: ShieldAlert,
    a: "#7c5cff",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul className="mt-3 space-y-2 pl-5 list-disc marker:text-primary/60">
          <li>
            Abuse, scrape, overload, or attempt to break the service or its
            security.
          </li>
          <li>Cheat or manipulate XP, quizzes, or the leaderboard.</li>
          <li>
            Harass others or post unlawful, harmful, or infringing content.
          </li>
          <li>Use LearnFRC for anything illegal.</li>
        </ul>
        <p className="mt-3">
          We may suspend or remove accounts that violate these terms.
        </p>
      </>
    ),
  },
  {
    id: "educational-content",
    icon: BookOpen,
    a: "#0f9d8f",
    title: "Educational content",
    body: (
      <p>
        Our lessons and quizzes are researched from public sources and provided
        for educational purposes. We work hard to keep them accurate, but for
        official competition decisions you should always confirm details against
        the current{" "}
        <a
          className={LINK}
          href="https://www.firstinspires.org/robotics/frc/game-and-season"
          target="_blank"
          rel="noopener noreferrer"
        >
          FRC Game Manual
          <ExternalLink
            className="mb-0.5 ml-0.5 inline h-3.5 w-3.5"
            aria-hidden="true"
            focusable="false"
          />
        </a>{" "}
        and official documentation. Content is provided &quot;as is&quot;
        without warranties.
      </p>
    ),
  },
  {
    id: "your-content",
    icon: FileText,
    a: "#2560e6",
    title: "Your content",
    body: (
      <p>
        Content you submit (such as your profile details or feedback) remains
        yours, but you grant LearnFRC a license to store and display it as needed
        to operate the service (for example, showing your public profile).
      </p>
    ),
  },
  {
    id: "trademarks",
    icon: Award,
    a: "#e8a01c",
    title: "Trademarks",
    body: (
      <p>
        LearnFRC is an independent project and is{" "}
        <strong className={strong}>
          not affiliated with or endorsed by FIRST®
        </strong>
        . FIRST®, FRC®, and related marks belong to FIRST. References are for
        identification and educational purposes only.
      </p>
    ),
  },
  {
    id: "liability",
    icon: Scale,
    a: "#7c5cff",
    title: "Limitation of liability",
    body: (
      <p>
        To the maximum extent permitted by law, LearnFRC and its maintainers are
        not liable for any indirect or consequential damages arising from your
        use of the service. The service is provided without warranty of any
        kind.
      </p>
    ),
  },
  {
    id: "termination",
    icon: LogOut,
    a: "#1aa9d6",
    title: "Termination",
    body: (
      <p>
        You may delete your account at any time by contacting us. We may suspend
        or terminate access if these terms are violated.
      </p>
    ),
  },
  {
    id: "changes",
    icon: RefreshCw,
    a: "#2560e6",
    title: "Changes",
    body: (
      <p>
        We may update these terms; the date above reflects the latest version.
        Continued use after changes means you accept them.
      </p>
    ),
  },
  {
    id: "contact",
    icon: Mail,
    a: "#0f9d8f",
    title: "Contact",
    body: (
      <p>
        Questions about these terms? Email{" "}
        <a className={`${LINK} break-words`} href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        . See also our{" "}
        <Link className={LINK} href="/privacy">
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
];

const RAIL_ITEMS: RailItem[] = RULES.map((r) => ({ id: r.id, title: r.title }));

export default function TermsPage() {
  return (
    <div className="relative mx-auto max-w-6xl overflow-x-clip px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-16 -left-24 h-72 w-72 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle,rgba(37,96,230,0.16),transparent 70%)",
          }}
        />
        <div
          className="absolute top-40 -right-24 h-80 w-80 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle,rgba(26,169,214,0.14),transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-24 left-1/3 h-72 w-72 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle,rgba(139,127,255,0.12),transparent 70%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <span className="aq-eyebrow aq-rise aq-rise-1">
            <ScrollText className="h-3.5 w-3.5" aria-hidden />
            The house rules
          </span>
          <h1 className="aq-rise aq-rise-2 mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Terms of{" "}
            <span
              className="aq-grad-anim"
              style={{
                background:
                  "linear-gradient(120deg,#2560e6,#1aa9d6,#7c5cff,#2560e6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Service
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
            LearnFRC is a free, independent place to learn the FIRST Robotics
            Competition. These are the plain-language terms for using it — read
            them like you&apos;d read the game manual before a match.
          </p>
          <div className="aq-rise aq-rise-4 mt-6 flex flex-wrap items-center gap-3">
            <span className="aq-chip">
              <RefreshCw className="h-3.5 w-3.5 text-primary" aria-hidden />
              Last updated {UPDATED}
            </span>
            <Link href="/privacy" className="aq-chip">
              <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
              Privacy Policy
            </Link>
          </div>
        </div>

        {/* floating pre-match briefing panel (signature-adjacent) */}
        <aside
          aria-hidden
          className="aq-glass aq-float aq-sheen aq-rise aq-rise-5 hidden w-64 rounded-3xl p-5 lg:block"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-foreground/70">
            <span
              className="aq-pulse inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--success)" }}
            />
            Pre-match briefing
          </div>

          {/* reading-time ring */}
          <div className="mt-5 flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-border"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="url(#terms-ring)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="aq-ring-anim"
                  style={
                    { strokeDasharray: 97.4, strokeDashoffset: 20 } as CSSProperties
                  }
                />
                <defs>
                  <linearGradient id="terms-ring" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2560e6" />
                    <stop offset="1" stopColor="#1aa9d6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 grid place-items-center text-sm font-bold text-foreground">
                <Clock className="h-5 w-5 text-primary" aria-hidden />
              </span>
            </div>
            <p className="text-xs leading-snug text-foreground/70">
              A{" "}
              <span className="font-semibold text-foreground">
                <AnimatedCounter value={4} />
              </span>
              -minute read across{" "}
              <span className="font-semibold text-foreground">
                <AnimatedCounter value={RULES.length} />
              </span>{" "}
              short sections.
            </p>
          </div>

          {/* stat count-ups */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="text-lg font-bold text-foreground">
                <AnimatedCounter value={RULES.length} />
              </div>
              <div className="text-[11px] text-foreground/70">house rules</div>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="text-lg font-bold text-foreground">
                <AnimatedCounter value={100} suffix="%" />
              </div>
              <div className="text-[11px] text-foreground/70">free, always</div>
            </div>
          </div>

          {/* plain-language bar */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] text-foreground/70">
              <span>Plain language</span>
              <span className="font-semibold text-foreground">
                <AnimatedCounter value={100} suffix="%" />
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className="aq-bar-anim h-full rounded-full"
                style={{
                  width: "100%",
                  background: "linear-gradient(90deg,#2560e6,#1aa9d6)",
                }}
              />
            </div>
          </div>
        </aside>
      </header>

      {/* intro callout */}
      <div className="aq-reveal aq-glass aq-sheen mt-12 flex items-start gap-4 rounded-3xl p-6 sm:p-8">
        <span className="aq-icon aq-badge-bob grid h-12 w-12 shrink-0 place-items-center">
          <Handshake className="h-6 w-6" strokeWidth={2.1} aria-hidden />
        </span>
        <p className="text-[16px] leading-relaxed text-foreground/85">
          Welcome to LearnFRC. By creating an account or using the service you
          agree to these terms. If you don&apos;t agree, that&apos;s okay — just
          don&apos;t use the service. We&apos;ll keep this short and gracious.
        </p>
      </div>

      {/* ==================== RAIL + MANUAL BODY ==================== */}
      <div className="mt-10 gap-10 lg:grid lg:grid-cols-[15rem_1fr]">
        {/* signature: sticky "match plan" contents rail (scroll-spy) */}
        <div className="hidden lg:block">
          <div className="sticky top-28">
            <div className="aq-card rounded-3xl p-5">
              <ContentsRail items={RAIL_ITEMS} />
            </div>
          </div>
        </div>

        {/* numbered manual sections */}
        <div className="space-y-5">
          {RULES.map((rule, i) => {
            const RuleIcon = rule.icon;
            return (
              <section
                key={rule.id}
                id={rule.id}
                className="aq-reveal aq-card aq-card-hover group scroll-mt-28 p-6 sm:p-8"
                style={{ animationDelay: `${0.05 * i}s` } as CSSProperties}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="aq-display grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-[15px] font-extrabold tabular-nums text-primary"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span
                    className="aq-badge aq-badge-bob inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                    style={{ "--a": rule.a } as CSSProperties}
                    aria-hidden
                  >
                    <RuleIcon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                    {rule.title}
                  </h2>
                </div>
                <div className="mt-4 space-y-3 text-[16px] leading-relaxed text-foreground/80">
                  {rule.body}
                </div>
              </section>
            );
          })}

          {/* closing contact CTA */}
          <div className="aq-reveal aq-card-hover flex flex-col items-start gap-4 rounded-2xl border border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="aq-icon aq-badge-bob grid h-11 w-11 shrink-0 place-items-center">
                <Mail className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-[15px] text-foreground/80">
                Still have a question about the rules? We&apos;re one email away.
              </p>
            </div>
            <a
              href={`mailto:${CONTACT}`}
              className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Email us
            </a>
          </div>
        </div>
      </div>

      <p className="aq-reveal mx-auto mt-10 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        LearnFRC is an independent educational project and is not affiliated with
        or endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
      </p>
    </div>
  );
}
