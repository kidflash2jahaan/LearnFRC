import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LearnFRC collects, uses, and protects your information.",
};

const UPDATED = "June 20, 2026";
const CONTACT = "kidflash2jahaan@gmail.com";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-bold tracking-tight">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 leading-relaxed text-foreground/80">{children}</p>;
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <P>
        LearnFRC (&quot;we,&quot; &quot;us&quot;) is a free educational platform for learning the FIRST
        Robotics Competition. This policy explains what we collect, why, and the
        choices you have. We aim to collect as little as possible.
      </P>

      <H>Information we collect</H>
      <P>
        <strong>Account information</strong> you provide when you sign up: your email address,
        display name, username, and (optionally) your FRC team number, role, bio, and avatar.
      </P>
      <P>
        <strong>Learning activity</strong> we store so we can show your progress: lessons you
        complete, quiz completions, XP, streaks, badges, and bookmarks.
      </P>
      <P>
        <strong>Technical data</strong> such as a temporary record of your IP address used only
        to rate-limit abuse and keep the service secure, plus standard server logs.
      </P>
      <P>
        <strong>Newsletter</strong>: if you opt in, we keep your email to send occasional updates.
      </P>

      <H>How we use your information</H>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/80">
        <li>Create and operate your account and save your progress.</li>
        <li>Send essential emails (email verification, welcome, password reset).</li>
        <li>Send product updates only if you subscribed to the newsletter.</li>
        <li>Prevent abuse, spam, and security incidents.</li>
      </ul>

      <H>What&apos;s public</H>
      <P>
        Your <strong>public profile</strong> (username, display name, team number, XP, level, and
        badges) is visible to others and may appear on the leaderboard. Your email address is
        never shown publicly. You can change these details in your settings.
      </P>

      <H>Cookies</H>
      <P>
        We use a single essential cookie to keep you signed in. We use privacy-friendly product
        analytics to understand usage; we do not use advertising or cross-site tracking cookies,
        and we do not sell your data.
      </P>

      <H>Service providers</H>
      <P>We rely on a few trusted providers to run LearnFRC:</P>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/80">
        <li>
          <a className="text-primary hover:underline" href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase</a>{" "}
          — database and authentication.
        </li>
        <li>
          <a className="text-primary hover:underline" href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel</a>{" "}
          — hosting and analytics.
        </li>
        <li>
          <a className="text-primary hover:underline" href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Resend</a>{" "}
          — sending transactional and newsletter email.
        </li>
      </ul>

      <H>Children&apos;s privacy</H>
      <P>
        LearnFRC is intended for FRC participants, who are generally high-school students. It is
        not directed to children under 13. If you are under 13, please do not create an account
        without a parent or guardian&apos;s involvement. If we learn we have collected data from a
        child under 13 without consent, we will delete it.
      </P>

      <H>Keeping and deleting your data</H>
      <P>
        We keep your account data while your account is active. You can request access to,
        correction of, or deletion of your data — including full account deletion — by emailing{" "}
        <a className="text-primary hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </P>

      <H>Security</H>
      <P>
        Data is encrypted in transit, access is restricted with row-level security, and passwords
        are hashed by our authentication provider — we never see them. No system is perfectly
        secure, but we work to protect your information.
      </P>

      <H>Changes</H>
      <P>
        We may update this policy; we&apos;ll revise the date above when we do. Significant changes
        will be highlighted on the site.
      </P>

      <H>Contact</H>
      <P>
        Questions? Email{" "}
        <a className="text-primary hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>. See
        also our <Link className="text-primary hover:underline" href="/terms">Terms of Service</Link>.
      </P>

      <p className="mt-10 text-xs text-muted-foreground">
        LearnFRC is an independent educational project and is not affiliated with or endorsed by
        FIRST®. FIRST® and FRC® are trademarks of FIRST.
      </p>
    </div>
  );
}
