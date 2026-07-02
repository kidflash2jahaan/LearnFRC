import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Database,
  Activity,
  Cog,
  Mail,
  Eye,
  Cookie,
  Baby,
  Trash2,
  Lock,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";
import { PrivacyToc, type TocItem } from "./_toc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LearnFRC collects, uses, and protects your information.",
};

const UPDATED = "June 22, 2026";
const CONTACT = "29pardhananij@sagehillschool.org";

const LINK =
  "font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent break-words";
const strong = "font-semibold text-foreground";

/* ---------- primitives ---------- */

function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[16px] leading-[1.7] text-foreground/80 first:mt-0">
      {children}
    </p>
  );
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

/* ---------- section registry (drives both the TOC and the body) ---------- */

type Section = TocItem & { icon: LucideIcon; accent: string; body: ReactNode };

const SECTIONS: Section[] = [
  {
    id: "collect",
    title: "Information we collect",
    icon: Database,
    accent: "#2560e6",
    body: (
      <>
        <P>
          <strong className={strong}>Account information</strong> you provide when you sign
          up: your email address, display name, username, and (optionally) your FRC team
          number, role, bio, and avatar.
        </P>
        <P>
          <strong className={strong}>Learning activity</strong> we store so we can show your
          progress: lessons you complete, quiz completions, XP, streaks, badges, and
          bookmarks.
        </P>
        <P>
          <strong className={strong}>Technical data</strong> such as a temporary record of
          your IP address used only to rate-limit abuse and keep the service secure, plus
          standard server logs.
        </P>
        <P>
          <strong className={strong}>Newsletter</strong>: if you opt in, we keep your email to
          send occasional updates.
        </P>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use your information",
    icon: Activity,
    accent: "#1aa9d6",
    body: (
      <Bullets
        items={[
          "Create and operate your account and save your progress.",
          "Send essential emails (email verification, welcome, password reset).",
          "Send product updates only if you subscribed to the newsletter.",
          "Prevent abuse, spam, and security incidents.",
        ]}
      />
    ),
  },
  {
    id: "public",
    title: "What's public",
    icon: Eye,
    accent: "#8b7fff",
    body: (
      <>
        <P>
          Your <strong className={strong}>public profile</strong> (username, display name,
          team number, XP, level, and badges) is visible to others and may appear on the
          leaderboard. Your email address is never shown publicly. You can change these
          details in your settings.
        </P>
        <P>
          <strong className={strong}>Team visibility.</strong> If you provide your FRC team
          number, you are automatically grouped with other registered users who entered the
          same team number. Members of the same team can see each other&apos;s{" "}
          <strong className={strong}>learning progress</strong> (lessons completed, XP, level,
          badges, and last activity) along with your display name — unless you turn on
          &quot;hide my name,&quot; in which case your username is shown instead. Your email
          is never shared. If you don&apos;t want to appear in a team view, leave your team
          number blank (or remove it) in your settings.
        </P>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    icon: Cookie,
    accent: "#c2740f",
    body: (
      <P>
        We use a single essential cookie to keep you signed in. We use privacy-friendly
        product analytics to understand usage; we do not use advertising or cross-site
        tracking cookies, and we do not sell your data.
      </P>
    ),
  },
  {
    id: "providers",
    title: "Service providers",
    icon: Cog,
    accent: "#0c8f4f",
    body: (
      <>
        <P>We rely on a few trusted providers to run LearnFRC:</P>
        <Bullets
          items={[
            <>
              <a
                className={LINK}
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Supabase
              </a>{" "}
              — database and authentication.
            </>,
            <>
              <a
                className={LINK}
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel
              </a>{" "}
              — hosting and analytics.
            </>,
            <>
              <a
                className={LINK}
                href="https://resend.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Resend
              </a>{" "}
              — sending transactional and newsletter email.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "children",
    title: "Children's privacy",
    icon: Baby,
    accent: "#c53b6b",
    body: (
      <P>
        LearnFRC is intended for FRC participants, who are generally high-school students. It
        is not directed to children under 13. If you are under 13, please do not create an
        account without a parent or guardian&apos;s involvement. If we learn we have collected
        data from a child under 13 without consent, we will delete it.
      </P>
    ),
  },
  {
    id: "retention",
    title: "Keeping and deleting your data",
    icon: Trash2,
    accent: "#2560e6",
    body: (
      <P>
        We keep your account data while your account is active. You can request access to,
        correction of, or deletion of your data — including full account deletion — by
        emailing{" "}
        <a className={LINK} href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        .
      </P>
    ),
  },
  {
    id: "security",
    title: "Security",
    icon: Lock,
    accent: "#1aa9d6",
    body: (
      <P>
        Data is encrypted in transit, access is restricted with row-level security, and
        passwords are hashed by our authentication provider — we never see them. No system is
        perfectly secure, but we work to protect your information.
      </P>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    icon: RefreshCw,
    accent: "#8b7fff",
    body: (
      <P>
        We may update this policy; we&apos;ll revise the date above when we do. Significant
        changes will be highlighted on the site.
      </P>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    icon: MessageCircle,
    accent: "#0c8f4f",
    body: (
      <P>
        Questions? Email{" "}
        <a className={LINK} href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        . See also our{" "}
        <Link className={LINK} href="/terms">
          Terms of Service
        </Link>
        .
      </P>
    ),
  },
];

const TOC_ITEMS: TocItem[] = SECTIONS.map(({ id, title }) => ({ id, title }));

/* ---------- page ---------- */

export default function PrivacyPage() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="aq-float absolute -top-16 -left-24 h-72 w-72 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle,rgba(37,96,230,0.16),transparent 70%)",
          }}
        />
        <div
          className="aq-float absolute top-40 -right-24 h-80 w-80 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle,rgba(26,169,214,0.14),transparent 70%)",
            animationDelay: "1.2s",
          }}
        />
        <div
          className="aq-float absolute bottom-24 left-1/3 h-72 w-72 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle,rgba(139,127,255,0.12),transparent 70%)",
            animationDelay: "2.4s",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <header className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <span className="aq-eyebrow aq-rise aq-rise-1">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Your data, decoded
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Privacy{" "}
            <span
              className="aq-grad-anim"
              style={{
                background: "linear-gradient(120deg,#2560e6,#1aa9d6,#7c5cff,#2560e6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              you can read.
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-xl text-lg leading-relaxed text-foreground/70">
            LearnFRC is a free platform for learning the FIRST Robotics Competition. We
            collect as little as we can — this page lays out exactly what, why, and the
            choices you have. Plain language, no fine print.
          </p>
          <div className="aq-rise aq-rise-4 mt-6 flex flex-wrap items-center gap-3">
            <span className="aq-chip">
              <RefreshCw className="h-3.5 w-3.5 text-primary" aria-hidden />
              Last updated {UPDATED}
            </span>
            <span className="aq-chip">
              <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
              We never sell your data
            </span>
            <a
              href="#collect"
              className="aq-cta rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Read the policy
            </a>
          </div>
        </div>

        {/* signature-adjacent: privacy-at-a-glance glass panel */}
        <aside className="aq-glass aq-float aq-rise aq-rise-5 rounded-3xl p-6 lg:justify-self-end lg:max-w-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground/70">
            <span
              className="aq-pulse inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--success)" }}
            />
            Privacy at a glance
          </div>

          {/* data-minimization ring */}
          <div className="mt-5 flex items-center gap-4">
            <div className="relative h-[74px] w-[74px] shrink-0">
              <svg viewBox="0 0 82 82" className="h-[74px] w-[74px]" aria-hidden>
                <circle
                  cx="41"
                  cy="41"
                  r="34"
                  fill="none"
                  stroke="rgba(120,145,190,.28)"
                  strokeWidth="9"
                />
                <circle
                  className="aq-ring-anim"
                  cx="41"
                  cy="41"
                  r="34"
                  fill="none"
                  stroke="url(#privRing)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray="213.6"
                  strokeDashoffset="26"
                  transform="rotate(-90 41 41)"
                />
                <defs>
                  <linearGradient id="privRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2560e6" />
                    <stop offset="1" stopColor="#1aa9d6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 grid place-items-center text-base font-bold text-foreground">
                <AnimatedCounter value={88} suffix="%" />
              </span>
            </div>
            <p className="text-sm leading-snug text-foreground/70">
              of what we store is just your learning progress — not personal data.
            </p>
          </div>

          {/* stat count-ups */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="aq-display text-xl font-extrabold leading-none text-foreground">
                <AnimatedCounter value={1} />
              </div>
              <div className="mt-1 text-[12px] text-foreground/70">essential cookie</div>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="aq-display text-xl font-extrabold leading-none text-foreground">
                <AnimatedCounter value={0} />
              </div>
              <div className="mt-1 text-[12px] text-foreground/70">trackers sold</div>
            </div>
          </div>

          {/* encryption bar */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[12px] text-foreground/70">
              <span>Encrypted in transit</span>
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

      {/* intro line */}
      <p className="aq-reveal mt-12 max-w-2xl text-[16px] leading-[1.7] text-foreground/80">
        LearnFRC (&quot;we,&quot; &quot;us&quot;) is a free educational platform for learning
        the FIRST Robotics Competition. This policy explains what we collect, why, and the
        choices you have. We aim to collect as little as possible.
      </p>

      {/* ================= SIGNATURE: sticky TOC + readable body ================= */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        {/* sticky scroll-spy rail */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="aq-card aq-reveal p-3">
            <p className="aq-eyebrow px-3 pb-2 pt-1">On this page</p>
            <PrivacyToc items={TOC_ITEMS} />
          </div>
        </div>

        {/* article body */}
        <article className="max-w-3xl">
          <div className="space-y-4">
            {SECTIONS.map((s, i) => {
              const Ico = s.icon;
              return (
                <section
                  key={s.id}
                  id={s.id}
                  className="aq-reveal aq-card aq-card-hover scroll-mt-28 p-6 sm:p-8"
                  style={{ animationDelay: `${(i % 4) * 70}ms` } as CSSProperties}
                >
                  <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight sm:text-2xl">
                    <span
                      aria-hidden
                      className="aq-badge aq-badge-bob grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                      style={{ "--a": s.accent } as CSSProperties}
                    >
                      <Ico className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="mr-2 align-middle font-mono text-sm font-semibold text-muted-foreground/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s.title}
                    </span>
                  </h2>
                  <div className="mt-4">{s.body}</div>
                </section>
              );
            })}
          </div>

          {/* contact CTA */}
          <div className="aq-reveal aq-card-hover mt-6 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="aq-icon aq-badge-bob grid h-11 w-11 place-items-center">
                <Mail className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-[15px] text-foreground/80">
                Want your data corrected or deleted? We&apos;re one email away.
              </p>
            </div>
            <a
              href={`mailto:${CONTACT}`}
              className="aq-cta shrink-0 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Email us
            </a>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            LearnFRC is an independent educational project and is not affiliated with or
            endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
          </p>
        </article>
      </div>
    </div>
  );
}
