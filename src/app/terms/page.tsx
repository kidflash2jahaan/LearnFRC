import type { Metadata } from "next";
import type { CSSProperties } from "react";
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
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using LearnFRC.",
};

const UPDATED = "June 20, 2026";
const CONTACT = "29pardhananij@sagehillschool.org";

const LINK =
  "font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent";

function Section({
  icon: SectionIcon,
  a,
  title,
  children,
}: {
  icon: typeof ScrollText;
  a: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="aq-reveal aq-card aq-card-hover scroll-mt-28 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span
          className="aq-badge inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ "--a": a } as CSSProperties}
          aria-hidden
        >
          <SectionIcon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-3 text-[16px] leading-relaxed text-foreground/80">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="relative mx-auto max-w-3xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 top-8 -z-10 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(37,96,230,0.20), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-40 -z-10 h-80 w-80 rounded-full opacity-50 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(26,169,214,0.20), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-[36rem] -z-10 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(124,92,255,0.18), transparent 70%)",
        }}
      />

      {/* Hero */}
      <header className="text-center sm:text-left">
        <div className="aq-rise aq-rise-1 aq-eyebrow justify-center sm:justify-start">
          <ScrollText className="h-4 w-4" />
          The house rules
        </div>
        <h1 className="aq-rise aq-rise-2 mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Terms of{" "}
          <span
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Service
          </span>
        </h1>
        <p className="aq-rise aq-rise-3 mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed text-foreground/70 sm:mx-0">
          LearnFRC is a free, independent place to learn the FIRST Robotics
          Competition. These are the plain-language terms for using it — read
          them like you&apos;d read the game manual before a match.
        </p>
        <div className="aq-rise aq-rise-4 mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <span
            className="aq-chip"
            style={{ "--a": "#2560e6" } as CSSProperties}
          >
            <RefreshCw className="h-3.5 w-3.5 text-primary" />
            Last updated {UPDATED}
          </span>
          <Link href="/privacy" className="aq-chip">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Privacy Policy
          </Link>
        </div>
      </header>

      {/* Intro callout */}
      <Reveal delay={0.1} className="mt-10">
        <div className="aq-glass rounded-3xl p-6 sm:p-8">
          <div className="relative z-10 flex items-start gap-4">
            <span className="aq-icon h-12 w-12 shrink-0">
              <BookOpen className="h-6 w-6" strokeWidth={2.1} />
            </span>
            <p className="text-[16px] leading-relaxed text-foreground/85">
              Welcome to LearnFRC. By creating an account or using the service
              you agree to these terms. If you don&apos;t agree, that&apos;s
              okay — just don&apos;t use the service. We&apos;ll keep this short
              and gracious.
            </p>
          </div>
        </div>
      </Reveal>

      {/* Sections */}
      <div className="mt-8 space-y-5">
        <Section icon={UserCheck} a="#2560e6" title="Who can use LearnFRC">
          <p>
            You should be at least 13 years old to create an account. If
            you&apos;re under 18, you should have a parent or guardian&apos;s
            permission. By signing up you confirm the information you provide is
            accurate.
          </p>
        </Section>

        <Section icon={KeyRound} a="#1aa9d6" title="Your account">
          <ul className="space-y-2 pl-5 marker:text-primary/60 list-disc">
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
        </Section>

        <Section icon={ShieldAlert} a="#7c5cff" title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="space-y-2 pl-5 marker:text-primary/60 list-disc">
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
          <p>We may suspend or remove accounts that violate these terms.</p>
        </Section>

        <Section icon={BookOpen} a="#0f9d8f" title="Educational content">
          <p>
            Our lessons and quizzes are researched from public sources and
            provided for educational purposes. We work hard to keep them
            accurate, but for official competition decisions you should always
            confirm details against the current{" "}
            <a
              className={LINK}
              href="https://www.firstinspires.org/robotics/frc/game-and-season"
              target="_blank"
              rel="noopener noreferrer"
            >
              FRC Game Manual
              <ExternalLink className="mb-0.5 ml-0.5 inline h-3.5 w-3.5" />
            </a>{" "}
            and official documentation. Content is provided &quot;as is&quot;
            without warranties.
          </p>
        </Section>

        <Section icon={FileText} a="#2560e6" title="Your content">
          <p>
            Content you submit (such as your profile details or feedback)
            remains yours, but you grant LearnFRC a license to store and display
            it as needed to operate the service (for example, showing your
            public profile).
          </p>
        </Section>

        <Section icon={Award} a="#e8a01c" title="Trademarks">
          <p>
            LearnFRC is an independent project and is{" "}
            <strong className="font-semibold text-foreground">
              not affiliated with or endorsed by FIRST®
            </strong>
            . FIRST®, FRC®, and related marks belong to FIRST. References are
            for identification and educational purposes only.
          </p>
        </Section>

        <Section icon={Scale} a="#7c5cff" title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, LearnFRC and its maintainers
            are not liable for any indirect or consequential damages arising from
            your use of the service. The service is provided without warranty of
            any kind.
          </p>
        </Section>

        <Section icon={LogOut} a="#1aa9d6" title="Termination">
          <p>
            You may delete your account at any time by contacting us. We may
            suspend or terminate access if these terms are violated.
          </p>
        </Section>

        <Section icon={RefreshCw} a="#2560e6" title="Changes">
          <p>
            We may update these terms; the date above reflects the latest
            version. Continued use after changes means you accept them.
          </p>
        </Section>

        <Section icon={Mail} a="#0f9d8f" title="Contact">
          <p>
            Questions about these terms? Email{" "}
            <a className={LINK} href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            . See also our{" "}
            <Link className={LINK} href="/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>
      </div>

      <p className="mt-10 text-center text-sm leading-relaxed text-muted-foreground sm:text-left">
        LearnFRC is an independent educational project and is not affiliated with
        or endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
      </p>
    </div>
  );
}
