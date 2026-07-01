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

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LearnFRC collects, uses, and protects your information.",
};

const UPDATED = "June 22, 2026";
const CONTACT = "29pardhananij@sagehillschool.org";

const LINK =
  "font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent";

function Section({
  icon,
  title,
  accent,
  children,
}: {
  icon: ReactNode;
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section className="aq-reveal scroll-mt-28">
      <div className="aq-divider mb-8" />
      <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight sm:text-2xl">
        <span
          aria-hidden
          className="aq-badge grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ "--a": accent } as CSSProperties}
        >
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[16px] leading-relaxed text-foreground/80 first:mt-0">
      {children}
    </p>
  );
}

const strong = "font-semibold text-foreground";

export default function PrivacyPage() {
  return (
    <div className="relative mx-auto max-w-3xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-16 -left-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(37,96,230,0.16),transparent 70%)" }}
        />
        <div
          className="absolute top-40 -right-24 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(26,169,214,0.14),transparent 70%)" }}
        />
        <div
          className="absolute bottom-24 left-1/3 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle,rgba(139,127,255,0.12),transparent 70%)" }}
        />
      </div>

      {/* hero */}
      <header>
        <span className="aq-eyebrow aq-rise aq-rise-1">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Your data, decoded
        </span>
        <h1 className="aq-rise aq-rise-2 mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Privacy{" "}
          <span
            style={{
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Policy
          </span>
        </h1>
        <p className="aq-rise aq-rise-3 mt-4 max-w-2xl text-lg text-foreground/70">
          LearnFRC is a free platform for learning the FIRST Robotics Competition. We
          collect as little as we can, and this page lays out exactly what, why, and the
          choices you have.
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
        </div>
      </header>

      {/* body card */}
      <article className="aq-reveal aq-card mt-12 p-6 sm:p-10">
        <P>
          LearnFRC (&quot;we,&quot; &quot;us&quot;) is a free educational platform for
          learning the FIRST Robotics Competition. This policy explains what we collect,
          why, and the choices you have. We aim to collect as little as possible.
        </P>

        <div className="mt-10 space-y-10">
          <Section icon={<Database className="h-5 w-5" aria-hidden />} title="Information we collect" accent="#2560e6">
            <P>
              <strong className={strong}>Account information</strong> you provide when you
              sign up: your email address, display name, username, and (optionally) your FRC
              team number, role, bio, and avatar.
            </P>
            <P>
              <strong className={strong}>Learning activity</strong> we store so we can show
              your progress: lessons you complete, quiz completions, XP, streaks, badges, and
              bookmarks.
            </P>
            <P>
              <strong className={strong}>Technical data</strong> such as a temporary record
              of your IP address used only to rate-limit abuse and keep the service secure,
              plus standard server logs.
            </P>
            <P>
              <strong className={strong}>Newsletter</strong>: if you opt in, we keep your
              email to send occasional updates.
            </P>
          </Section>

          <Section icon={<Activity className="h-5 w-5" aria-hidden />} title="How we use your information" accent="#1aa9d6">
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-foreground/80 marker:text-primary/60">
              <li>Create and operate your account and save your progress.</li>
              <li>Send essential emails (email verification, welcome, password reset).</li>
              <li>Send product updates only if you subscribed to the newsletter.</li>
              <li>Prevent abuse, spam, and security incidents.</li>
            </ul>
          </Section>

          <Section icon={<Eye className="h-5 w-5" aria-hidden />} title="What's public" accent="#8b7fff">
            <P>
              Your <strong className={strong}>public profile</strong> (username, display
              name, team number, XP, level, and badges) is visible to others and may appear
              on the leaderboard. Your email address is never shown publicly. You can change
              these details in your settings.
            </P>
            <P>
              <strong className={strong}>Team visibility.</strong> If you provide your FRC
              team number, you are automatically grouped with other registered users who
              entered the same team number. Members of the same team can see each other&apos;s{" "}
              <strong className={strong}>learning progress</strong> (lessons completed, XP,
              level, badges, and last activity) along with your display name — unless you turn
              on &quot;hide my name,&quot; in which case your username is shown instead. Your
              email is never shared. If you don&apos;t want to appear in a team view, leave
              your team number blank (or remove it) in your settings.
            </P>
          </Section>

          <Section icon={<Cookie className="h-5 w-5" aria-hidden />} title="Cookies" accent="#e08a2b">
            <P>
              We use a single essential cookie to keep you signed in. We use
              privacy-friendly product analytics to understand usage; we do not use
              advertising or cross-site tracking cookies, and we do not sell your data.
            </P>
          </Section>

          <Section icon={<Cog className="h-5 w-5" aria-hidden />} title="Service providers" accent="#12b565">
            <P>We rely on a few trusted providers to run LearnFRC:</P>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-foreground/80 marker:text-primary/60">
              <li>
                <a className={LINK} href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
                  Supabase
                </a>{" "}
                — database and authentication.
              </li>
              <li>
                <a className={LINK} href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                  Vercel
                </a>{" "}
                — hosting and analytics.
              </li>
              <li>
                <a className={LINK} href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                  Resend
                </a>{" "}
                — sending transactional and newsletter email.
              </li>
            </ul>
          </Section>

          <Section icon={<Baby className="h-5 w-5" aria-hidden />} title="Children's privacy" accent="#e0517d">
            <P>
              LearnFRC is intended for FRC participants, who are generally high-school
              students. It is not directed to children under 13. If you are under 13, please
              do not create an account without a parent or guardian&apos;s involvement. If we
              learn we have collected data from a child under 13 without consent, we will
              delete it.
            </P>
          </Section>

          <Section icon={<Trash2 className="h-5 w-5" aria-hidden />} title="Keeping and deleting your data" accent="#2560e6">
            <P>
              We keep your account data while your account is active. You can request access
              to, correction of, or deletion of your data — including full account deletion —
              by emailing{" "}
              <a className={LINK} href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>
              .
            </P>
          </Section>

          <Section icon={<Lock className="h-5 w-5" aria-hidden />} title="Security" accent="#1aa9d6">
            <P>
              Data is encrypted in transit, access is restricted with row-level security, and
              passwords are hashed by our authentication provider — we never see them. No
              system is perfectly secure, but we work to protect your information.
            </P>
          </Section>

          <Section icon={<RefreshCw className="h-5 w-5" aria-hidden />} title="Changes" accent="#8b7fff">
            <P>
              We may update this policy; we&apos;ll revise the date above when we do.
              Significant changes will be highlighted on the site.
            </P>
          </Section>

          <Section icon={<MessageCircle className="h-5 w-5" aria-hidden />} title="Contact" accent="#12b565">
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
          </Section>
        </div>
      </article>

      {/* contact CTA */}
      <div className="aq-reveal mt-10 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="aq-icon grid h-11 w-11 place-items-center">
            <Mail className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-[15px] text-foreground/80">
            Want your data corrected or deleted? We&apos;re one email away.
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

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        LearnFRC is an independent educational project and is not affiliated with or endorsed
        by FIRST®. FIRST® and FRC® are trademarks of FIRST.
      </p>
    </div>
  );
}
