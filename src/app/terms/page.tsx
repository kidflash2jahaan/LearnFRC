import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using LearnFRC.",
};

const UPDATED = "June 20, 2026";
const CONTACT = "kidflash2jahaan@gmail.com";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-bold tracking-tight">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 leading-relaxed text-foreground/80">{children}</p>;
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <P>
        Welcome to LearnFRC, a free educational platform for learning the FIRST Robotics
        Competition. By using LearnFRC, you agree to these terms. If you don&apos;t agree, please
        don&apos;t use the service.
      </P>

      <H>Who can use LearnFRC</H>
      <P>
        You should be at least 13 years old to create an account. If you are under 18, you should
        have a parent or guardian&apos;s permission. By signing up you confirm the information you
        provide is accurate.
      </P>

      <H>Your account</H>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/80">
        <li>Keep your password secure; you&apos;re responsible for activity on your account.</li>
        <li>Choose a username and display name that aren&apos;t offensive or impersonating.</li>
        <li>Verify your email address to activate your account.</li>
      </ul>

      <H>Acceptable use</H>
      <P>You agree not to:</P>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/80">
        <li>Abuse, scrape, overload, or attempt to break the service or its security.</li>
        <li>Cheat or manipulate XP, quizzes, or the leaderboard.</li>
        <li>Harass others or post unlawful, harmful, or infringing content.</li>
        <li>Use LearnFRC for anything illegal.</li>
      </ul>
      <P>We may suspend or remove accounts that violate these terms.</P>

      <H>Educational content</H>
      <P>
        Our lessons and quizzes are researched from public sources and provided for educational
        purposes. We work hard to keep them accurate, but for official competition decisions you
        should always confirm details against the current{" "}
        <a className="text-primary hover:underline" href="https://www.firstinspires.org/robotics/frc/game-and-season" target="_blank" rel="noopener noreferrer">FRC Game Manual</a>{" "}
        and official documentation. Content is provided &quot;as is&quot; without warranties.
      </P>

      <H>Your content</H>
      <P>
        Content you submit (such as your profile details or feedback) remains yours, but you grant
        LearnFRC a license to store and display it as needed to operate the service (for example,
        showing your public profile).
      </P>

      <H>Trademarks</H>
      <P>
        LearnFRC is an independent project and is <strong>not affiliated with or endorsed by
        FIRST®</strong>. FIRST®, FRC®, and related marks belong to FIRST. References are for
        identification and educational purposes only.
      </P>

      <H>Limitation of liability</H>
      <P>
        To the maximum extent permitted by law, LearnFRC and its maintainers are not liable for any
        indirect or consequential damages arising from your use of the service. The service is
        provided without warranty of any kind.
      </P>

      <H>Termination</H>
      <P>
        You may delete your account at any time by contacting us. We may suspend or terminate
        access if these terms are violated.
      </P>

      <H>Changes</H>
      <P>
        We may update these terms; the date above reflects the latest version. Continued use after
        changes means you accept them.
      </P>

      <H>Contact</H>
      <P>
        Questions about these terms? Email{" "}
        <a className="text-primary hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>. See
        also our{" "}
        <Link className="text-primary hover:underline" href="/privacy">Privacy Policy</Link>.
      </P>
    </div>
  );
}
