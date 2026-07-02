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
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
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

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/* ---------- small text primitives (local to this page) ---------- */

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[16px] leading-[1.7] text-foreground/80 first:mt-0">{children}</p>;
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-[1.7] text-foreground/80 marker:text-primary/60">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/* ---------- rule registry — content preserved verbatim ---------- */

type Rule = { id: string; icon: LucideIcon; a: string; title: string; body: ReactNode };

const RULES: Rule[] = [
  {
    id: "eligibility",
    icon: UserCheck,
    a: "#2560e6",
    title: "Who can use LearnFRC",
    body: (
      <P>
        You should be at least 13 years old to create an account. If you&apos;re under 18, you
        should have a parent or guardian&apos;s permission. By signing up you confirm the
        information you provide is accurate.
      </P>
    ),
  },
  {
    id: "account",
    icon: KeyRound,
    a: "#1aa9d6",
    title: "Your account",
    body: (
      <Bullets
        items={[
          "Keep your password secure; you're responsible for activity on your account.",
          "Choose a username and display name that aren't offensive or impersonating.",
          "Verify your email address to activate your account.",
        ]}
      />
    ),
  },
  {
    id: "acceptable-use",
    icon: ShieldAlert,
    a: "#7c5cff",
    title: "Acceptable use",
    body: (
      <>
        <P>You agree not to:</P>
        <Bullets
          items={[
            "Abuse, scrape, overload, or attempt to break the service or its security.",
            "Cheat or manipulate XP, quizzes, or the leaderboard.",
            "Harass others or post unlawful, harmful, or infringing content.",
            "Use LearnFRC for anything illegal.",
          ]}
        />
        <P>We may suspend or remove accounts that violate these terms.</P>
      </>
    ),
  },
  {
    id: "educational-content",
    icon: BookOpen,
    a: "#0f9d8f",
    title: "Educational content",
    body: (
      <P>
        Our lessons and quizzes are researched from public sources and provided for educational
        purposes. We work hard to keep them accurate, but for official competition decisions you
        should always confirm details against the current{" "}
        <a
          className={LINK}
          href="https://www.firstinspires.org/robotics/frc/game-and-season"
          target="_blank"
          rel="noopener noreferrer"
        >
          FRC Game Manual
          <ExternalLink className="mb-0.5 ml-0.5 inline h-3.5 w-3.5" aria-hidden="true" focusable="false" />
        </a>{" "}
        and official documentation. Content is provided &quot;as is&quot; without warranties.
      </P>
    ),
  },
  {
    id: "your-content",
    icon: FileText,
    a: "#2560e6",
    title: "Your content",
    body: (
      <P>
        Content you submit (such as your profile details or feedback) remains yours, but you
        grant LearnFRC a license to store and display it as needed to operate the service (for
        example, showing your public profile).
      </P>
    ),
  },
  {
    id: "trademarks",
    icon: Award,
    a: "#c2740f",
    title: "Trademarks",
    body: (
      <P>
        LearnFRC is an independent project and is{" "}
        <strong className={strong}>not affiliated with or endorsed by FIRST®</strong>. FIRST®,
        FRC®, and related marks belong to FIRST. References are for identification and
        educational purposes only.
      </P>
    ),
  },
  {
    id: "liability",
    icon: Scale,
    a: "#7c5cff",
    title: "Limitation of liability",
    body: (
      <P>
        To the maximum extent permitted by law, LearnFRC and its maintainers are not liable for
        any indirect or consequential damages arising from your use of the service. The service
        is provided without warranty of any kind.
      </P>
    ),
  },
  {
    id: "termination",
    icon: LogOut,
    a: "#1aa9d6",
    title: "Termination",
    body: (
      <P>
        You may delete your account at any time by contacting us. We may suspend or terminate
        access if these terms are violated.
      </P>
    ),
  },
  {
    id: "changes",
    icon: RefreshCw,
    a: "#2560e6",
    title: "Changes",
    body: (
      <P>
        We may update these terms; the date above reflects the latest version. Continued use
        after changes means you accept them.
      </P>
    ),
  },
  {
    id: "contact",
    icon: Mail,
    a: "#0f9d8f",
    title: "Contact",
    body: (
      <P>
        Questions about these terms? Email{" "}
        <a className={LINK} href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        . See also our{" "}
        <Link className={LINK} href="/privacy">
          Privacy Policy
        </Link>
        .
      </P>
    ),
  },
];

const RAIL_ITEMS: RailItem[] = RULES.map((r) => ({ id: r.id, title: r.title }));

export default function TermsPage() {
  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-170px", top: "-160px" }, color: "#8bbcff", opacity: 0.5 },
          { size: "520px", pos: { right: "-180px", top: "60px" }, color: "#6ff0ea", opacity: 0.4, delay: 2 },
          { size: "480px", pos: { left: "20%", top: "760px" }, color: "#c8b6ff", opacity: 0.35, delay: 4 },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* ============================ HERO ============================ */}
        <header className="max-w-2xl">
          <RiseGroup>
            <RiseItem>
              <span className="ac-chip inline-flex items-center gap-2">
                <ScrollText className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="ac-eyebrow">The house rules</span>
              </span>
            </RiseItem>
            <RiseItem>
              <h1 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                Terms of <span style={BRAND_GRADIENT}>Service.</span>
              </h1>
            </RiseItem>
            <RiseItem>
              <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
                LearnFRC is a free, independent place to learn the FIRST Robotics Competition.
                These are the plain-language terms for using it — read them like you&apos;d read
                the game manual before a match.
              </p>
            </RiseItem>
            <RiseItem>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href="#eligibility" className="ac-btn text-sm">
                  Read the rules <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <span className="ac-chip inline-flex items-center gap-2 text-xs font-medium text-foreground/75">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Last updated {UPDATED}
                </span>
                <Link
                  href="/privacy"
                  className="ac-chip inline-flex min-h-11 items-center gap-2 text-xs font-medium text-foreground/75 transition-colors hover:text-primary"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Privacy Policy
                </Link>
              </div>
            </RiseItem>
            <RiseItem>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span>
                  <b className="font-semibold text-foreground">
                    <AnimatedCounter value={RULES.length} />
                  </b>{" "}
                  short rules
                </span>
                <span>
                  <b className="font-semibold text-foreground">
                    <AnimatedCounter value={4} />
                  </b>
                  -minute read
                </span>
                <span>
                  <b className="font-semibold text-foreground">$0</b> — always
                </span>
              </div>
            </RiseItem>
          </RiseGroup>
        </header>

        {/* intro callout */}
        <Reveal>
          <div className="ac-glass relative mt-10 flex items-start gap-4 overflow-hidden p-6 sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.22),transparent_70%)] blur-2xl"
            />
            <span
              className="ac-badge grid h-12 w-12 shrink-0 place-items-center"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <Handshake className="h-6 w-6" strokeWidth={2.1} aria-hidden />
            </span>
            <p className="relative text-[16px] leading-relaxed text-foreground/85">
              Welcome to LearnFRC. By creating an account or using the service you agree to these
              terms. If you don&apos;t agree, that&apos;s okay — just don&apos;t use the service.
              We&apos;ll keep this short and gracious.
            </p>
          </div>
        </Reveal>

        {/* ==================== RAIL + RULEBOOK BODY ==================== */}
        <div className="mt-10 gap-10 lg:grid lg:grid-cols-[15rem_1fr]">
          {/* signature: sticky rulebook navigator (scroll-spy + progress ring) */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <div className="ac-card p-5">
                <ContentsRail items={RAIL_ITEMS} contact={CONTACT} />
              </div>
            </div>
          </div>

          {/* mobile jump menu — native disclosure, no JS required */}
          <details className="ac-card group mb-6 p-4 lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-primary" aria-hidden />
                Jump to a section
              </span>
              <ArrowRight className="h-4 w-4 text-primary transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <ol className="mt-3 space-y-1 border-t border-border pt-3">
              {RAIL_ITEMS.map((it, i) => (
                <li key={it.id}>
                  <a
                    href={`#${it.id}`}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-foreground/75 transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {it.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          {/* numbered rulebook sections */}
          <RevealGroup className="space-y-5">
            {RULES.map((rule, i) => {
              const RuleIcon = rule.icon;
              return (
                <RevealItem key={rule.id}>
                  <Hover lift={-3} scale={1.005}>
                    <section id={rule.id} className="ac-card group scroll-mt-28 p-6 sm:p-8">
                      <div className="flex items-center gap-4">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 font-display text-[15px] font-extrabold tabular-nums text-primary"
                          aria-hidden
                        >
                          {i + 1}
                        </span>
                        <span
                          className="ac-badge inline-flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                          style={{ "--a": rule.a } as CSSProperties}
                          aria-hidden
                        >
                          <RuleIcon className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                        <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                          {rule.title}
                        </h2>
                      </div>
                      <div className="mt-4">{rule.body}</div>
                    </section>
                  </Hover>
                </RevealItem>
              );
            })}

            {/* closing contact CTA */}
            <RevealItem>
              <div className="ac-card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="ac-badge grid h-11 w-11 shrink-0 place-items-center"
                    style={{ "--a": "#0f9d8f" } as CSSProperties}
                  >
                    <Mail className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-[15px] text-foreground/80">
                    Still have a question about the rules? We&apos;re one email away.
                  </p>
                </div>
                <a href={`mailto:${CONTACT}`} className="ac-btn text-sm">
                  <Mail className="h-4 w-4" aria-hidden />
                  Email us
                </a>
              </div>
            </RevealItem>
          </RevealGroup>
        </div>

        <Reveal>
          <p className="mx-auto mt-10 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
            LearnFRC is an independent educational project and is not affiliated with or endorsed
            by FIRST®. FIRST® and FRC® are trademarks of FIRST.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
