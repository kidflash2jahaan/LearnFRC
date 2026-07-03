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
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { PrivacyToc, type TocItem } from "./_toc";
import { PrivacyGlass } from "./_privacy-glass";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LearnFRC collects, uses, and protects your information.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "July 3, 2026";
const CONTACT = "29pardhananij@sagehillschool.org";

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6, #7c5cff)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const LINK =
  "font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent break-words";
const strong = "font-semibold text-foreground";

/* ---------- copy primitives ---------- */

function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[16px] leading-[1.7] text-foreground/80 first:mt-0">{children}</p>
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
    accent: "#7c5cff",
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
      <>
        <P>We keep cookies to a minimum and use them only for the essentials:</P>
        <Bullets
          items={[
            <>
              <strong className={strong}>Staying signed in.</strong> One essential
              cookie keeps you logged in as you move around the site.
            </>,
            <>
              <strong className={strong}>Where you came from.</strong> A first-party
              cookie remembers how you first found LearnFRC — say, a forum link or a
              teammate&apos;s invite — so we can see which channels actually help people
              discover us. It records the source, not who you are, and never follows you
              across other sites.
            </>,
            <>
              <strong className={strong}>Article views.</strong> We tally anonymous,
              aggregate view counts on guides to see what&apos;s useful. These counts
              aren&apos;t linked to your account, and your browser&apos;s sessionStorage
              is used only to avoid double-counting the same visit.
            </>,
          ]}
        />
        <P>
          We do <strong className={strong}>not</strong> use advertising cookies or
          cross-site tracking, and we never sell your data.
        </P>
      </>
    ),
  },
  {
    id: "providers",
    title: "Service providers",
    icon: Cog,
    accent: "#0a7a43",
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
    accent: "#c2367a",
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
    accent: "#7c5cff",
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
    accent: "#0a7a43",
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
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-160px", top: "-180px" }, color: "#8bbcff", opacity: 0.55 },
          { size: "500px", pos: { right: "-150px", top: "60px" }, color: "#6ff0ea", opacity: 0.4, delay: 2 },
          { size: "480px", pos: { left: "35%", top: "900px" }, color: "#c8b6ff", opacity: 0.32, delay: 4 },
        ]}
      />

      {/* ============================ HERO ============================ */}
      <header className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-28 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">Your data, decoded</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Privacy <span style={BRAND_GRADIENT}>you can read.</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              LearnFRC is a free platform for learning the FIRST Robotics Competition. We
              collect as little as we can — this page lays out exactly what, why, and the
              choices you have. Plain language, no fine print.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#collect" className="ac-btn text-sm">
                Read the policy
              </a>
              <span className="ac-chip inline-flex items-center gap-2 text-sm text-foreground/75">
                <RefreshCw className="h-3.5 w-3.5 text-primary" aria-hidden />
                Last updated {UPDATED}
              </span>
              <span className="ac-chip inline-flex items-center gap-2 text-sm text-foreground/75">
                <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
                We never sell your data
              </span>
            </div>
          </RiseItem>
        </RiseGroup>

        <PrivacyGlass />
      </header>

      {/* ================= SIGNATURE: sticky TOC + readable body ================= */}
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <p className="max-w-2xl text-[16px] leading-[1.7] text-foreground/80">
            LearnFRC (&quot;we,&quot; &quot;us&quot;) is a free educational platform for
            learning the FIRST Robotics Competition. This policy explains what we collect,
            why, and the choices you have. We aim to collect as little as possible.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
          {/* sticky scroll-spy rail — no transform on the sticky element itself
              (would risk breaking position:sticky), so the reveal fades only
              the card content inside it. */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <div className="ac-card p-3">
                <p className="ac-eyebrow px-3 pb-2 pt-1">On this page</p>
                <PrivacyToc items={TOC_ITEMS} />
              </div>
            </Reveal>
          </div>

          {/* article body */}
          <article className="max-w-3xl">
            <RevealGroup className="space-y-4">
              {SECTIONS.map((s, i) => {
                const Ico = s.icon;
                return (
                  <RevealItem key={s.id}>
                    <Hover lift={-3} scale={1.005}>
                      <section id={s.id} className="ac-card scroll-mt-28 p-6 sm:p-8">
                        <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight sm:text-2xl">
                          <span
                            aria-hidden
                            className="ac-badge grid h-10 w-10 shrink-0 place-items-center rounded-xl"
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
                    </Hover>
                  </RevealItem>
                );
              })}
            </RevealGroup>

            {/* contact CTA */}
            <Reveal>
              <Hover lift={-3} scale={1.005}>
                <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="ac-badge grid h-11 w-11 shrink-0 place-items-center"
                      style={{ "--a": "#2560e6" } as CSSProperties}
                    >
                      <Mail className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="text-[15px] text-foreground/80">
                      Want your data corrected or deleted? We&apos;re one email away.
                    </p>
                  </div>
                  <a
                    href={`mailto:${CONTACT}`}
                    className="ac-btn shrink-0 text-sm"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    Email us
                  </a>
                </div>
              </Hover>
            </Reveal>

            <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
              LearnFRC is an independent educational project and is not affiliated with or
              endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
